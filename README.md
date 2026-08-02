# GAINMUSCLE

GAINMUSCLE is a mobile-first workout tracker with account login, onboarding,
set-by-set workout logging, routines, progress summaries, rest timers, and an
exercise-focused Gemini assistant.

## Project structure

```text
gmymate/
|-- api/                 PHP endpoints and server modules
|   |-- config/          Local secrets and shareable examples
|   |-- core/            HTTP, session, database, and bootstrap helpers
|   |-- repositories/    Database queries
|   `-- services/        Authentication and user services
|-- docs/                Deployment documentation
|-- scripts/deploy/      FTP setup and changed-file deployment
|-- src/
|   |-- core/            Shared browser data, storage, and auth guards
|   |-- features/        Page and feature behavior
|   `-- styles/          Feature-focused stylesheets
|-- index.html           Login and registration
|-- onboarding.html      Initial profile setup
`-- main.html            Main mobile application
```

## Local development

The frontend has no build step, but login and AI features require PHP. Serve the
project through a PHP-capable local server or upload it to Dothome. Opening the
HTML files directly only previews static layout.

Create these private files from their examples before using server features:

- `api/config/database.php`
- `api/config/gemini.php`

Both files are ignored by Git. Never place passwords or API keys in public PHP,
HTML, or JavaScript files.

## Deployment

See [docs/deployment.md](docs/deployment.md). FTP deployment reads directly from
this repository, uploads only changed production files, and no longer requires a
separate upload mirror.

## Storage

Accounts and profile information use PHP sessions and MySQL. Workout state and
interface preferences currently use browser storage, so cross-device workout
synchronization is still a future backend task.
