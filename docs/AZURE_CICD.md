# Heimdall — Azure App Service CI/CD Setup

The GitHub Actions workflow in [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml) runs automated tests and builds on every Pull Request and push to `main`, and deploys to **Azure App Service** when changes land on `main` in the **`UNAQ-Hackathon`** organization repository (`github.repository_owner == 'UNAQ-Hackathon'`).

## Pipeline Behavior

- **Pull requests & fork pushes to `main`**: Runs `ci-frontend` (`npm test` + `npm run build`), `ci-api` (`node --test`), and `ci-analytics` (`unittest`). Deployment jobs are skipped outside `UNAQ-Hackathon`.
- **Push / merge to `main` in `UNAQ-Hackathon`**: Runs all three CI jobs in parallel, packages self-contained deployment archives via [`deploy/azure/package.sh`](../deploy/azure/package.sh), and deploys all three services to Azure App Service.
- **Manual run (`workflow_dispatch`)**: Allows redeploying `all` or a single service (`frontend`, `api`, `analytics`) from the GitHub Actions tab on `main`.

## 1. GitHub Repository / Environment Configuration

In the **`UNAQ-Hackathon`** repository (`Settings → Secrets and variables → Actions`, or inside the `production` GitHub Environment):

### Secrets (required for CD)

Download the **Publish Profile** XML from each Azure App Service (`Overview → Download publish profile`) and store its contents in:

| Secret | Target App Service |
|---|---|
| `AZURE_WEBAPP_PUBLISH_PROFILE_FRONTEND` | Frontend Web App |
| `AZURE_WEBAPP_PUBLISH_PROFILE_API` | API Web App |
| `AZURE_WEBAPP_PUBLISH_PROFILE_ANALYTICS` | Analytics Web App |

> Note: In Azure App Service, ensure **SCM Basic Auth Publishing Credentials** is enabled (`Settings → Configuration → General settings`) if you use Publish Profile deployment.

### Variables

| Variable | Example Value | Purpose |
|---|---|---|
| `VITE_API_URL` | `https://heimdall-api.azurewebsites.net/api` | Baked into the Vite bundle during `frontend` build (defaults to `/api` if unset) |

## 2. Azure App Service Setup (3 Linux Web Apps)

### A. Frontend (`heimdall-frontend`)

- **Runtime stack:** Node 22 LTS (Linux)
- **Startup command:** *(leave default; runs `npm start` → `node server.mjs`)*
- **Health check path:** `/healthz`
- **App settings:**
  - `SCM_DO_BUILD_DURING_DEPLOYMENT=false` (zero external runtime dependencies)
- **Package contents:** Built `dist/` + [`deploy/azure/frontend/server.mjs`](../deploy/azure/frontend/server.mjs) (SPA fallback to `index.html`, immutable `/assets/` cache headers, `.glb` MIME type).

### B. REST API (`heimdall-api`)

- **Runtime stack:** Node 22 LTS (Linux)
- **Startup command:** *(leave default; runs `npm start` → `node src/server.js`)*
- **Health check path:** `/api/health`
- **App settings:**
  - `NODE_ENV=production`
  - `SCM_DO_BUILD_DURING_DEPLOYMENT=false` (production `node_modules` are packaged during CI)
  - `MONGODB_URI=<your-mongodb-atlas-uri>`
  - `ANALYTICS_API_URL=https://<your-analytics-app>.azurewebsites.net`
  - `CORS_ORIGIN=https://<your-frontend-app>.azurewebsites.net`
  - `DEVIN_API_KEY=<key>` (and/or `GEMINI_API_KEY=<key>` as configured)
- **Package contents:** `api/src`, `api/public`, `api/node_modules`, and `data/processed/psi-investigations.json`.

### C. Analytics Engine (`heimdall-analytics`)

- **Runtime stack:** Python 3.12 (Linux)
- **Startup command:**
  ```bash
  python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
  ```
- **Health check path:** `/api/health`
- **App settings:**
  - `ENV=production`
  - `WEBSITES_PORT=8000`
  - `SCM_DO_BUILD_DURING_DEPLOYMENT=true` (installs `requirements.txt` via Oryx during deployment)
  - `CORS_ORIGINS=https://<your-api-app>.azurewebsites.net,https://<your-frontend-app>.azurewebsites.net`
- **Package contents:** `analytics/app`, `analytics/firehazr`, `analytics/requirements.txt`, and `PredictorFireHazard-main/Sensibilidad de gases/knn` (including `resultados/modelo.json` and `resumen.json`).

## 3. Testing Packaging Locally

```bash
cd frontend && npm run build && cd ..
./deploy/azure/package.sh all
```

Staged folders and `.zip` archives are generated under `deploy-artifacts/` (gitignored).
