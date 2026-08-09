import { escapeHtml, readJson, showToast, writeJson } from "../core/storage.js";
import {
  connectAppleMusic,
  onTrackEnded,
  playAppleMusic,
  playSpotify,
  playYouTube,
  setProviderVolume,
  toggleAppleMusic,
  toggleSpotify,
  toggleYouTube
} from "../core/music-player.js";

async function apiFetch(url, options) {
  try {
    const response = await fetch(url, { credentials: "same-origin", ...options });
    return await response.json();
  } catch {
    return { ok: false, error: "네트워크 연결을 확인해주세요." };
  }
}

function cleanTitle(title) {
  return String(title)
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[【】『』《》〈〉「」]/g, "")
    .replace(/[([][^)\]]*(official|m\/?v|lyrics?|audio|visualizer|hd|4k|가사|뮤직비디오|자막)[^)\]]*[)\]]/giu, "")
    .replace(/\s*\|.*$/u, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function setupMusic() {
  const playlistList = document.querySelector("#playlistList");

  if (!playlistList) {
    return;
  }

  const playlistForm = document.querySelector("#playlistForm");
  const openPlaylistFormButton = document.querySelector("[data-open-playlist-form]");
  const playlistDetail = document.querySelector("#playlistDetail");
  const playlistDetailName = document.querySelector("#playlistDetailName");
  const playlistTrackList = document.querySelector("#playlistTrackList");
  const musicSearchForm = document.querySelector("#musicSearchForm");
  const musicSearchResults = document.querySelector("#musicSearchResults");
  const musicPlayer = document.querySelector("#musicPlayer");
  const nowPlayingTitle = document.querySelector("#nowPlayingTitle");
  const nowPlayingArtist = document.querySelector("#nowPlayingArtist");
  const playerToggleButton = document.querySelector("[data-player-toggle]");
  const musicRecommendResults = document.querySelector("#musicRecommendResults");

  let playlists = [];
  let activePlaylistId = null;
  let activeProvider = null;
  let autoAdvanceQueue = null; // { tracks: Track[], index: number }
  let bpmMatches = [];

  handleProviderRedirect("spotify", "Spotify");
  handleProviderRedirect("youtube", "YouTube");
  loadPlaylists().then(applyPendingBpmRecommendation);
  loadConnections();

  function applyPendingBpmRecommendation() {
    const pendingBpm = sessionStorage.getItem("gmymatePendingBpm");

    if (!pendingBpm) {
      return;
    }

    sessionStorage.removeItem("gmymatePendingBpm");
    const presetButton = document.querySelector(`[data-bpm-preset="${pendingBpm}"]`);

    if (presetButton) {
      showToast("루틴에 맞는 음악을 추천할게요.");
      presetButton.click();
    }
  }

  onTrackEnded(() => {
    if (!autoAdvanceQueue) {
      return;
    }

    const { tracks, index } = autoAdvanceQueue;
    const nextTrack = tracks[index + 1];

    if (!nextTrack) {
      autoAdvanceQueue = null;
      return;
    }

    playTrack(nextTrack, { tracks, index: index + 1 });
  });

  function handleProviderRedirect(paramName, label) {
    const params = new URLSearchParams(window.location.search);
    const status = params.get(paramName);

    if (!status) {
      return;
    }

    const messages = {
      connected: `${label} 연결됐어요.`,
      denied: `${label} 연결이 취소됐어요.`,
      error: `${label} 연결에 실패했어요.`
    };

    showToast(messages[status] || "");
    params.delete(paramName);
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  async function loadPlaylists() {
    const result = await apiFetch("./api/music/playlists.php");

    if (!result.ok) {
      return;
    }

    // PDO returns numeric columns as strings; normalize once here so every
    // later `item.id === playlistId` (playlistId comes from Number(dataset...))
    // comparison actually matches instead of silently failing.
    playlists = result.playlists.map((playlist) => ({ ...playlist, id: Number(playlist.id) }));
    renderPlaylists();
  }

  function renderPlaylists() {
    if (playlists.length === 0) {
      playlistList.innerHTML = `<p class="empty-history">아직 플레이리스트가 없어요.</p>`;
      return;
    }

    playlistList.innerHTML = playlists.map((playlist) => `
      <button class="music-playlist-card" type="button" data-open-playlist="${playlist.id}">
        <strong>${escapeHtml(playlist.name)}</strong>
        <span>${playlist.workout_tag ? `${escapeHtml(playlist.workout_tag)} · ` : ""}${playlist.tracks.length}곡</span>
      </button>
    `).join("");
  }

  function openPlaylist(playlistId) {
    const playlist = playlists.find((item) => item.id === playlistId);

    if (!playlist) {
      return;
    }

    activePlaylistId = playlistId;
    playlistDetail.hidden = false;
    playlistDetailName.textContent = playlist.name;
    renderTracks(playlist);
    musicSearchResults.innerHTML = "";
  }

  function renderTracks(playlist) {
    if (playlist.tracks.length === 0) {
      playlistTrackList.innerHTML = `<p class="empty-history">곡을 검색해서 추가해보세요.</p>`;
      return;
    }

    playlistTrackList.innerHTML = playlist.tracks.map((track) => trackRowHtml(track, true)).join("");
  }

  function trackRowHtml(track, removable) {
    const meta = `${escapeHtml(track.artist || "")}${track.bpm ? ` · ${track.bpm}BPM` : ""}`;
    const payload = escapeHtml(JSON.stringify(track));
    const volume = track.volume ?? 100;

    return `
      <div class="music-track-row">
        <div>
          <strong>${escapeHtml(cleanTitle(track.title))}</strong>
          <span>${meta}</span>
          ${removable ? `
            <label class="music-track-volume">
              <span>볼륨</span>
              <input type="range" min="0" max="100" value="${volume}" data-track-volume="${track.id}">
            </label>
          ` : ""}
        </div>
        <div class="music-track-actions">
          ${removable ? `
            <button class="icon-button" type="button" data-move-track="${track.id}:up" aria-label="위로 이동">↑</button>
            <button class="icon-button" type="button" data-move-track="${track.id}:down" aria-label="아래로 이동">↓</button>
            <button class="icon-button" type="button" data-remove-track="${track.id}" aria-label="곡 삭제">✕</button>
          ` : ""}
          <button class="icon-button" type="button" data-play-track="${payload}" aria-label="재생">▶</button>
        </div>
      </div>
    `;
  }

  playlistList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-playlist]");

    if (button) {
      openPlaylist(Number(button.dataset.openPlaylist));
    }
  });

  openPlaylistFormButton?.addEventListener("click", () => {
    playlistForm.hidden = !playlistForm.hidden;
  });

  playlistForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(playlistForm).entries());

    const result = await apiFetch("./api/music/playlists.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: data.name, workoutTag: data.workoutTag })
    });

    if (!result.ok) {
      showToast(result.error || "만들기에 실패했어요.");
      return;
    }

    playlistForm.reset();
    playlistForm.hidden = true;
    showToast("플레이리스트를 만들었어요.");
    await loadPlaylists();
  });

  document.querySelector("[data-delete-playlist]")?.addEventListener("click", async () => {
    if (!activePlaylistId || !window.confirm("이 플레이리스트를 삭제할까요?")) {
      return;
    }

    const result = await apiFetch("./api/music/playlists.php", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activePlaylistId })
    });

    if (!result.ok) {
      showToast(result.error || "삭제에 실패했어요.");
      return;
    }

    activePlaylistId = null;
    playlistDetail.hidden = true;
    await loadPlaylists();
  });

  musicSearchForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(musicSearchForm).entries());
    const uiProvider = data.provider;
    const query = data.q?.trim();
    const storedProvider = uiProvider === "youtube-liked" ? "youtube" : uiProvider;

    if (uiProvider !== "youtube-liked" && !query) {
      return;
    }

    const endpoints = {
      spotify: `./api/music/spotify-search.php?q=${encodeURIComponent(query)}`,
      youtube: `./api/music/youtube-search.php?q=${encodeURIComponent(query)}`,
      "youtube-liked": "./api/music/youtube-liked-videos.php"
    };

    const result = await apiFetch(endpoints[uiProvider]);

    if (!result.ok) {
      musicSearchResults.innerHTML = `<p class="empty-history">${escapeHtml(result.error || "검색에 실패했어요.")}</p>`;
      return;
    }

    const items = storedProvider === "spotify"
      ? result.items.map((item) => ({ trackRef: item.uri, title: item.title, artist: item.artist }))
      : result.items.map((item) => ({ trackRef: item.videoId, title: item.title, artist: item.channel }));

    if (items.length === 0) {
      musicSearchResults.innerHTML = `<p class="empty-history">결과가 없어요.</p>`;
      return;
    }

    musicSearchResults.innerHTML = items.map((item) => `
      <div class="music-track-row">
        <div>
          <strong>${escapeHtml(cleanTitle(item.title))}</strong>
          <span>${escapeHtml(item.artist || "")}</span>
        </div>
        <button class="icon-button" type="button" data-add-track="${escapeHtml(JSON.stringify({ provider: storedProvider, ...item }))}" aria-label="${escapeHtml(cleanTitle(item.title))} 플레이리스트에 추가">+</button>
      </div>
    `).join("");
  });

  musicSearchResults?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-add-track]");

    if (!button || !activePlaylistId) {
      return;
    }

    const track = JSON.parse(button.dataset.addTrack);
    let bpm = null;

    if (track.provider === "spotify") {
      const trackId = track.trackRef.replace("spotify:track:", "");
      const features = await apiFetch(`./api/music/spotify-audio-features.php?id=${encodeURIComponent(trackId)}`);
      bpm = features.bpm || null;
    }

    const result = await apiFetch("./api/music/playlist-tracks.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playlistId: activePlaylistId,
        provider: track.provider,
        trackRef: track.trackRef,
        title: track.title,
        artist: track.artist,
        bpm
      })
    });

    if (!result.ok) {
      showToast(result.error || "추가에 실패했어요.");
      return;
    }

    showToast("곡을 추가했어요.");
    await loadPlaylists();
    openPlaylist(activePlaylistId);
  });

  playlistTrackList.addEventListener("click", async (event) => {
    const playButton = event.target.closest("[data-play-track]");
    const removeButton = event.target.closest("[data-remove-track]");
    const moveButton = event.target.closest("[data-move-track]");

    if (moveButton) {
      const [trackId, direction] = moveButton.dataset.moveTrack.split(":");
      const result = await apiFetch("./api/music/playlist-tracks.php", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: Number(trackId), direction })
      });

      if (!result.ok) {
        showToast(result.error || "순서 변경에 실패했어요.");
        return;
      }

      await loadPlaylists();
      openPlaylist(activePlaylistId);
      return;
    }

    if (playButton) {
      const track = JSON.parse(playButton.dataset.playTrack);
      const playlist = playlists.find((item) => item.id === activePlaylistId);
      const trackIndex = playlist?.tracks.findIndex((item) => item.id === track.id) ?? -1;
      await playTrack(track, trackIndex >= 0 ? { tracks: playlist.tracks, index: trackIndex } : null);
      return;
    }

    if (removeButton) {
      const result = await apiFetch("./api/music/playlist-tracks.php", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: Number(removeButton.dataset.removeTrack) })
      });

      if (!result.ok) {
        showToast(result.error || "삭제에 실패했어요.");
        return;
      }

      await loadPlaylists();
      openPlaylist(activePlaylistId);
    }
  });

  playlistTrackList.addEventListener("change", async (event) => {
    const slider = event.target.closest("[data-track-volume]");

    if (!slider) {
      return;
    }

    const trackId = Number(slider.dataset.trackVolume);
    const volume = Number(slider.value);

    const playlist = playlists.find((item) => item.id === activePlaylistId);
    const track = playlist?.tracks.find((item) => item.id === trackId);
    if (track) {
      track.volume = volume;
    }

    const currentTrackId = autoAdvanceQueue?.tracks[autoAdvanceQueue.index]?.id;
    if (activeProvider && currentTrackId === trackId) {
      setProviderVolume(activeProvider, volume);
    }

    await apiFetch("./api/music/playlist-tracks.php", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: trackId, volume })
    });
  });

  function rememberPlayedTrack(track) {
    const played = readJson("gmymateTodayPlayedTracks", []);
    const title = cleanTitle(track.title);

    if (played.some((item) => item.title === title)) {
      return;
    }

    played.push({ title, artist: track.artist || "" });
    writeJson("gmymateTodayPlayedTracks", played.slice(-30));
  }

  async function playTrack(track, queueContext = null) {
    musicPlayer.hidden = false;
    nowPlayingTitle.textContent = cleanTitle(track.title);
    nowPlayingArtist.textContent = track.artist || "";
    activeProvider = track.provider;
    autoAdvanceQueue = queueContext;
    rememberPlayedTrack(track);

    try {
      if (track.provider === "youtube") {
        await playYouTube(track.track_ref || track.trackRef, "youtubePlayerMount");
      } else if (track.provider === "spotify") {
        await playSpotify(track.track_ref || track.trackRef);
      } else if (track.provider === "apple") {
        await playAppleMusic(track.track_ref || track.trackRef);
      }

      setProviderVolume(track.provider, track.volume ?? 100);
    } catch (error) {
      showToast(error.message || "재생에 실패했어요.");
    }
  }

  playerToggleButton?.addEventListener("click", () => {
    if (activeProvider === "youtube") {
      toggleYouTube();
    } else if (activeProvider === "spotify") {
      toggleSpotify();
    } else if (activeProvider === "apple") {
      toggleAppleMusic();
    }
  });

  async function loadConnections() {
    const result = await apiFetch("./api/music/connections.php");

    if (!result.ok) {
      return;
    }

    result.providers.forEach((provider) => {
      const button = document.querySelector(`[data-connect-provider="${provider}"]`);

      if (button) {
        button.textContent = "연결 완료";
        button.disabled = true;
      }
    });
  }

  document.querySelectorAll("[data-connect-provider]").forEach((button) => {
    button.addEventListener("click", async () => {
      const provider = button.dataset.connectProvider;

      if (provider === "spotify") {
        window.location.href = "./api/music/spotify-connect.php";
        return;
      }

      if (provider === "youtube") {
        window.location.href = "./api/music/google-connect.php";
        return;
      }

      if (provider === "apple") {
        try {
          await connectAppleMusic();
          showToast("Apple Music 연결됐어요.");
        } catch (error) {
          showToast(error.message || "Apple Music 연결에 실패했어요.");
        }
      }
    });
  });

  document.querySelectorAll("[data-bpm-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const [min, max] = button.dataset.bpmPreset.split("-").map(Number);
      bpmMatches = playlists
        .flatMap((playlist) => playlist.tracks)
        .filter((track) => track.bpm && track.bpm >= min && track.bpm <= max);

      if (bpmMatches.length === 0) {
        musicRecommendResults.innerHTML = `<p class="empty-history">BPM 태그가 있는 곡이 없어요. Spotify로 곡을 추가하면 자동으로 태그돼요.</p>`;
        return;
      }

      musicRecommendResults.innerHTML = bpmMatches.map((track) => trackRowHtml(track, false)).join("");
    });
  });

  musicRecommendResults?.addEventListener("click", async (event) => {
    const playButton = event.target.closest("[data-play-track]");

    if (playButton) {
      const track = JSON.parse(playButton.dataset.playTrack);
      const index = bpmMatches.findIndex((item) => item.id === track.id);
      await playTrack(track, index >= 0 ? { tracks: bpmMatches, index } : null);
    }
  });
}
