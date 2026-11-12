# Deploying the Yara demo

One Docker image (root `Dockerfile`) builds the web app and serves it from the API, so the demo is a single URL. On start it runs the migrations, seeds the content into the database, purges expired data and starts the server on `$PORT`.

## Render (recommended for the demo)

1. In Render, choose **New > Blueprint** and select this repository. Render reads `render.yaml` and creates:
   - `yara`, a Docker web service with a health check on `/health`.
   - `yara-db`, a PostgreSQL database. Its connection string is passed to the service automatically.
2. Fill in the secret variables that Render asks for (all optional except the tutor key if you want AI help):
   - `YARA_ANTHROPIC_API_KEY`
   - `YARA_AZURE_SPEECH_KEY` and `YARA_AZURE_SPEECH_REGION`
3. Deploy, then open the service URL.

The free web service sleeps when idle, so the first visit after a pause takes about a minute. Open the URL a few minutes before the demo.

## Railway

1. Create a project from this GitHub repository. Railway builds the root `Dockerfile`.
2. Add a PostgreSQL database to the same project.
3. Set the variables listed below on the service, with `YARA_DATABASE_URL` set to `${{Postgres.DATABASE_URL}}`.
4. In **Settings > Networking**, generate a public domain.

## Variables

| Variable | Value | Required |
| --- | --- | --- |
| `YARA_ENVIRONMENT` | `production` | yes |
| `YARA_DATABASE_URL` | Postgres connection string. `postgres://` and `postgresql://` are both accepted | yes |
| `YARA_RECOVERY_PEPPER` | Random secret of at least 32 characters (`openssl rand -hex 32`). Never change it after launch, or the 6 words stop working | yes |
| `YARA_TRUST_PROXY_HEADERS` | `true` | yes |
| `YARA_TUTOR_PROVIDER` | `gemini` or `anthropic` for real AI help, `fake` for a demo without a key, `none` to hide it | yes |
| `YARA_GEMINI_API_KEY` | Key from aistudio.google.com | with `gemini` |
| `YARA_GEMINI_MODEL` | `gemini-3.5-flash-lite` (default) or another Gemini text model | no |
| `YARA_ANTHROPIC_API_KEY` | Key from console.anthropic.com | with `anthropic` |
| `YARA_TUTOR_MODEL` | `claude-haiku-5-5` | no |
| `YARA_GUEST_LIMIT` / `YARA_RECOVER_LIMIT` | New guests per hour and recovery attempts per 15 minutes from one connection. Defaults are 30 and 10; `render.yaml` raises them to 300 and 60 because at a live demo everyone shares the venue Wi-Fi | no |
| `YARA_AZURE_SPEECH_KEY` / `YARA_AZURE_SPEECH_REGION` | Azure AI Speech key and region, only needed to record audio for devices without a voice | no |

Render generates the pepper and links the database by itself; Railway needs both set by hand.

## Optional: recorded audio

Phones without a Spanish or Arabic voice fall back to recorded MP3s. With the Azure variables set, open a shell on the service and run:

```bash
python -m yara_api.cli audio
```

The audio is stored in the database, so it is generated only once.
