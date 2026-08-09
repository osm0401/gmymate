<?php
// Copy this file to apple-config.php and fill in your Apple Developer credentials.
// Requires a paid Apple Developer Program membership ($99/year) with MusicKit enabled.
// apple-config.php is gitignored — never commit real credentials.
return [
    'team_id' => 'your_apple_team_id',
    'key_id' => 'your_musickit_key_id',
    // Paste the full contents of the .p8 private key file Apple gave you,
    // including the -----BEGIN PRIVATE KEY----- / -----END PRIVATE KEY----- lines.
    'private_key' => "-----BEGIN PRIVATE KEY-----\nyour_key_contents\n-----END PRIVATE KEY-----",
];
