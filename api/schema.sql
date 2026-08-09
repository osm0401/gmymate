CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(20) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS music_connections (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    provider ENUM('spotify', 'apple', 'youtube') NOT NULL,
    access_token TEXT NULL,
    refresh_token TEXT NULL,
    expires_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uniq_user_provider (user_id, provider),
    CONSTRAINT fk_music_connections_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS playlists (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(80) NOT NULL,
    workout_tag VARCHAR(20) NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT fk_playlists_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS playlist_tracks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    playlist_id BIGINT NOT NULL,
    provider ENUM('spotify', 'apple', 'youtube') NOT NULL,
    track_ref VARCHAR(120) NOT NULL,
    title VARCHAR(200) NOT NULL,
    artist VARCHAR(200) NULL,
    bpm SMALLINT UNSIGNED NULL,
    genre VARCHAR(60) NULL,
    position SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    volume TINYINT UNSIGNED NOT NULL DEFAULT 100,
    CONSTRAINT fk_playlist_tracks_playlist FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Run this one manually if playlist_tracks already existed before the
-- `volume` column was added above (CREATE TABLE IF NOT EXISTS won't alter it).
ALTER TABLE playlist_tracks ADD COLUMN IF NOT EXISTS volume TINYINT UNSIGNED NOT NULL DEFAULT 100;

-- One JSON blob per user (profile/settings/habits/today's log/history/inbody).
-- ponytail: whole-blob last-write-wins sync, no per-field merge — fine for
-- one person across a couple devices; revisit with per-field timestamps if
-- this ever needs concurrent multi-device editors.
CREATE TABLE IF NOT EXISTS user_data (
    user_id BIGINT NOT NULL PRIMARY KEY,
    data_json LONGTEXT NOT NULL,
    updated_at DATETIME NOT NULL,
    CONSTRAINT fk_user_data_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
