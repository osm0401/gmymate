# GAINMUSCLE API

The browser continues to call the two public endpoint files:

- `auth.php`: login, registration, logout, and session checks
- `profile.php`: onboarding and profile updates
- `data.php`: settings, habits, exercises, routines, active workouts, and workout history
- `gemini.php`: authenticated Gemini workout-assistant requests

Internal code is organized by responsibility:

- `config/`: real and example database settings
- `core/`: HTTP responses, sessions, PDO connection, and bootstrap loading
- `repositories/`: SQL for reading and writing database tables
- `services/`: authentication state and API response shaping

## Database changes

Put table-specific SQL in `repositories/`. Keep credentials only in
`config/database.php`; this file is ignored by Git. Use
`config/database.example.php` as the shareable template.

## Gemini configuration

Copy `config/gemini.example.php` to `config/gemini.php`, then place the Gemini
API key in the copied file. `config/gemini.php` is ignored by Git and must be
uploaded to the server separately. You can use the `GEMINI_API_KEY` environment
variable instead when the host supports it.

The AI chat in `main.html` calls `/api/gemini.php`, which requires a signed-in
GAINMUSCLE session and limits each session to eight requests per minute.

## Deployment

The deployment script uploads the production API files to Dothome's `html/api`
directory. The public URLs remain:

- `/api/auth.php`
- `/api/profile.php`
- `/api/data.php`
- `/api/gemini.php`

## Dothome error responses

Dothome replaces non-2xx PHP response bodies with its own HTML error page. API
errors therefore use HTTP 200 for transport and include the intended status as
`errorStatus` in the JSON body. Clients must use the JSON `success` field.
