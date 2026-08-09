<?php
// Copy this file to spotify-config.php and fill in your Spotify app credentials.
// Register a free app at https://developer.spotify.com/dashboard
// spotify-config.php is gitignored — never commit real credentials.
return [
    'client_id' => 'your_spotify_client_id',
    'client_secret' => 'your_spotify_client_secret',
    // Must exactly match a Redirect URI registered in your Spotify app settings.
    'redirect_uri' => 'https://kpgo.dothome.co.kr/api/music/spotify-callback.php',
];
