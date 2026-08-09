let youtubePlayer = null;
let youtubeReadyPromise = null;
let spotifyPlayer = null;
let spotifyDeviceId = null;
let spotifyHasStarted = false;
let appleMusicKit = null;
let endedCallback = null;

export function onTrackEnded(callback) {
  endedCallback = callback;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`${src} 로드 실패`));
    document.head.appendChild(script);
  });
}

export async function playYouTube(videoId, mountId) {
  if (!youtubeReadyPromise) {
    youtubeReadyPromise = new Promise((resolve) => {
      window.onYouTubeIframeAPIReady = resolve;
      loadScript("https://www.youtube.com/iframe_api");
    });
  }

  await youtubeReadyPromise;

  if (!youtubePlayer) {
    youtubePlayer = new window.YT.Player(mountId, {
      height: "0",
      width: "0",
      events: {
        onReady: () => youtubePlayer.loadVideoById(videoId),
        onStateChange: (event) => {
          if (event.data === window.YT.PlayerState.ENDED) {
            endedCallback?.();
          }
        }
      }
    });
    return;
  }

  youtubePlayer.loadVideoById(videoId);
}

export function toggleYouTube() {
  if (!youtubePlayer) {
    return;
  }

  const state = youtubePlayer.getPlayerState();
  if (state === window.YT.PlayerState.PLAYING) {
    youtubePlayer.pauseVideo();
  } else {
    youtubePlayer.playVideo();
  }
}

async function fetchSpotifyAccessToken() {
  const response = await fetch("./api/music/spotify-token.php", { credentials: "same-origin" });
  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.error || "Spotify 연결이 필요해요.");
  }

  return result.accessToken;
}

export async function playSpotify(uri) {
  spotifyHasStarted = false;
  const accessToken = await fetchSpotifyAccessToken();

  if (!spotifyPlayer) {
    await loadScript("https://sdk.scdn.co/spotify-player.js");
    await new Promise((resolve) => {
      window.onSpotifyWebPlaybackSDKReady = resolve;
    });

    spotifyPlayer = new window.Spotify.Player({
      name: "gmymate",
      getOAuthToken: (callback) => {
        fetchSpotifyAccessToken().then(callback);
      }
    });

    spotifyPlayer.addListener("ready", ({ device_id: deviceId }) => {
      spotifyDeviceId = deviceId;
    });

    spotifyPlayer.addListener("player_state_changed", (state) => {
      if (!state) {
        return;
      }

      if (!state.paused) {
        spotifyHasStarted = true;
        return;
      }

      if (spotifyHasStarted && state.position === 0) {
        spotifyHasStarted = false;
        endedCallback?.();
      }
    });

    await spotifyPlayer.connect();
    await new Promise((resolve) => {
      const check = () => (spotifyDeviceId ? resolve() : setTimeout(check, 200));
      check();
    });
  }

  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ uris: [uri] })
  });
}

export function toggleSpotify() {
  spotifyPlayer?.togglePlay();
}

export async function connectAppleMusic() {
  if (!appleMusicKit) {
    await loadScript("https://js-cdn.music.apple.com/musickit/v3/musickit.js");
    const tokenResponse = await fetch("./api/music/apple-developer-token.php", { credentials: "same-origin" });
    const tokenResult = await tokenResponse.json();

    if (!tokenResult.ok) {
      throw new Error(tokenResult.error || "Apple Music 연결이 필요해요.");
    }

    await window.MusicKit.configure({
      developerToken: tokenResult.developerToken,
      app: { name: "gmymate", build: "1.0" }
    });

    appleMusicKit = window.MusicKit.getInstance();
    appleMusicKit.addEventListener(window.MusicKit.Events.mediaPlaybackDidEnd, () => {
      endedCallback?.();
    });
  }

  await appleMusicKit.authorize();
}

export async function playAppleMusic(trackId) {
  if (!appleMusicKit) {
    await connectAppleMusic();
  }

  await appleMusicKit.setQueue({ song: trackId });
  await appleMusicKit.play();
}

export function toggleAppleMusic() {
  if (!appleMusicKit) {
    return;
  }

  if (appleMusicKit.isPlaying) {
    appleMusicKit.pause();
  } else {
    appleMusicKit.play();
  }
}

// percent is 0-100 (matches the UI slider); each SDK wants its own range/scale.
export function setProviderVolume(provider, percent) {
  const ratio = Math.max(0, Math.min(100, percent)) / 100;

  if (provider === "youtube") {
    youtubePlayer?.setVolume(percent);
  } else if (provider === "spotify") {
    spotifyPlayer?.setVolume(ratio);
  } else if (provider === "apple" && appleMusicKit) {
    appleMusicKit.volume = ratio;
  }
}
