# 08 — Deployment and Environment

## Local development

| Service | Command | Port |
|---|---|---|
| MongoDB (optional; Atlas via `MONGODB_URI` also works) | `docker compose up -d mongo` | 27017 |
| Analytics | `cd analytics && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000` | 8000 |
| API | `cd api && npm run dev` (`node --watch src/server.js`) | 5000 |
| Frontend | `cd frontend && npm run dev` | 5173 |

Health checks: `GET :5000/api/health`, `GET :8000/api/health`.

### Local ports and proxies

- Vite proxies `/api` to `http://localhost:5000` by default.
- For a non-default API port, set in ignored `frontend/.env.local`:

  ```
  VITE_API_URL=/api
  VITE_API_PROXY_TARGET=http://localhost:5080
  ```

- Keep all secrets in `api/.env` (gitignored). Never put keys in `VITE_*`
  variables — they ship to the browser.
- `node --watch` does **not** reload `.env` — restart the API after changing
  environment. Restart Vite after changing `frontend/.env.local`.

## Environment variables (`api/.env`)

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | API port |
| `MONGODB_URI` | `mongodb://localhost:27017/heimdall` | Investigations store (optional — JSON fallback exists) |
| `AI_PROVIDER` | `auto` | `auto` (chain) or force `gemini` / `openai` / `devin` |
| `AI_INTERPRET_MAX_TOKENS` | `320` | FireHazR interpretation output cap |
| `GEMINI_API_KEY` | — | Google AI Studio key |
| `GEMINI_API_BASE` | `https://generativelanguage.googleapis.com` | API base |
| `GEMINI_MODEL` | `gemini-2.5-flash` | model id |
| `GEMINI_TOKEN_LIMIT` | `60000` | provider budget |
| `GEMINI_MAX_OUTPUT_TOKENS` | `512` | output cap |
| `OPENAI_COMPAT_API_KEY` | — | any OpenAI-compatible key (Groq `gsk_...`) |
| `OPENAI_COMPAT_API_BASE` | `https://api.groq.com/openai/v1` | base URL |
| `OPENAI_COMPAT_MODEL` | `openai/gpt-oss-120b` | model id |
| `OPENAI_COMPAT_TOKEN_LIMIT` | `60000` | provider budget |
| `OPENAI_COMPAT_MAX_OUTPUT_TOKENS` | `512` | output cap |
| `OPENAI_COMPAT_REASONING_EFFORT` | `low` | keeps reasoning models within budget |
| `DEVIN_API_KEY` / `DEVIN_API_BASE` / `DEVIN_MODEL` | optional | last-resort fallback; empty key removes it from the chain |

See `api/.env.example` for the annotated template.

## Production (Azure App Service)

| App | Workflow | Package |
|---|---|---|
| `heimdall-uaq` (Node API) | `.github/workflows/main_heimdall-uaq.yml` | `api/` **plus** `data/processed` copied to `api/data/processed/` before artifact upload |
| `heimdall-analytics-uaq` (FastAPI) | `.github/workflows/main_heimdall-analytics-uaq.yml` | `analytics/` + model artifacts |
| frontend | `azure-static-web-apps-lively-river-0744b331e.yml` | `frontend` build |
| all three | `ci-cd.yml` | tests + package via `deploy/azure/package.sh`, deploy on `main` in `UNAQ-Hackathon` |

### Critical packaging detail

The API workflow uploads `./api` only — without the extra copy step the
canonical dataset `data/processed/psi-investigations.json` never reaches
`/home/site` and `rank_investigations` failed with ENOENT in production.
The workflow now copies `data/processed` into `api/data/processed` (one of
the candidate paths `processed-dataset.js` searches), and the loader also
degrades to `[]` + warning as a second defense. `api/data/` is gitignored —
it exists only inside the CI artifact.

### Secrets

Store provider keys (`GEMINI_API_KEY`, `OPENAI_COMPAT_API_KEY`) in Azure App
Settings / GitHub secrets — never in the repo or frontend env. Azure publish
profiles are documented in [AZURE_CICD.md](AZURE_CICD.md).

## Production behavior under quota exhaustion

With `AI_PROVIDER=auto` and both Gemini + Groq keys configured, a Gemini
429/RPD exhaustion fails over to Groq automatically and responses carry the
real `providerLabel`. If all providers fail, endpoints return honest errors
(503 for interpret) and the UI shows them — no canned or fabricated output.
