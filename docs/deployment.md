# Deployment

The Dothome website is deployed directly from the `gmymate` repository. The
script excludes Git metadata, documentation, deployment tools, example config
files, and local-only secrets that are not required by the server.

## One-time credential setup

From the `gmymate` directory, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy\setup-ftp.ps1
```

Enter the Dothome FTP password in the Windows credential prompt. The resulting
credential file is encrypted for the current Windows account and ignored by
Git. Do not put the password in source code or chat.

## Upload changed files

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy\deploy-ftp.ps1
```

Useful options:

```powershell
# Preview the files without uploading.
powershell -ExecutionPolicy Bypass -File .\scripts\deploy\deploy-ftp.ps1 -DryRun

# Upload every production file again.
powershell -ExecutionPolicy Bypass -File .\scripts\deploy\deploy-ftp.ps1 -Full
```

The current target is `kpgo.dothome.co.kr:21`, with production files placed in
the `/html` directory. Change `scripts/deploy/ftp.settings.json` if Dothome shows
different FTP details.

## Private server configuration

These ignored files are uploaded because the PHP server requires them:

- `api/config/database.php`
- `api/config/gemini.php`

The deploy script does not print their contents. Plain FTP is not encrypted in
transit; use FTPS by setting `requireTls` to `true` when the hosting plan supports
it.
