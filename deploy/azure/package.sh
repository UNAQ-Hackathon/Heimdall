#!/usr/bin/env bash
set -euo pipefail

# Stage self-contained Azure App Service deployment bundles for frontend, api, and analytics.
# Usage: ./deploy/azure/package.sh [all|frontend|api|analytics]

TARGET="${1:-all}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${ROOT_DIR}/deploy-artifacts"

mkdir -p "${OUT_DIR}"

create_zip() {
  local src_dir="$1"
  local zip_path="$2"
  rm -f "${zip_path}"
  if command -v zip >/dev/null 2>&1; then
    (cd "${src_dir}" && zip -qr "${zip_path}" .)
  else
    python3 -c '
import pathlib, sys, zipfile
src = pathlib.Path(sys.argv[1])
out = pathlib.Path(sys.argv[2])
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
    for item in sorted(src.rglob("*")):
        if item.is_file() or item.is_symlink():
            zf.write(item, item.relative_to(src))
' "${src_dir}" "${zip_path}"
  fi
}

package_frontend() {
  local stage="${OUT_DIR}/frontend"
  if [[ ! -d "${ROOT_DIR}/frontend/dist" ]]; then
    echo "Error: frontend/dist not found. Run 'npm run build' in frontend/ first." >&2
    exit 1
  fi
  rm -rf "${stage}"
  mkdir -p "${stage}/dist"
  cp "${ROOT_DIR}/deploy/azure/frontend/package.json" "${stage}/package.json"
  cp "${ROOT_DIR}/deploy/azure/frontend/server.mjs" "${stage}/server.mjs"
  cp -R "${ROOT_DIR}/frontend/dist/." "${stage}/dist/"
  create_zip "${stage}" "${OUT_DIR}/frontend.zip"
  echo "Packaged ${OUT_DIR}/frontend.zip"
}

package_api() {
  local stage="${OUT_DIR}/api"
  rm -rf "${stage}"
  mkdir -p "${stage}/data/processed"
  cp "${ROOT_DIR}/api/package.json" "${stage}/package.json"
  cp "${ROOT_DIR}/api/package-lock.json" "${stage}/package-lock.json"
  cp -R "${ROOT_DIR}/api/src" "${stage}/src"
  cp -R "${ROOT_DIR}/api/public" "${stage}/public"
  cp -R "${ROOT_DIR}/data/processed/." "${stage}/data/processed/"
  (cd "${stage}" && npm ci --omit=dev --ignore-scripts)
  create_zip "${stage}" "${OUT_DIR}/api.zip"
  echo "Packaged ${OUT_DIR}/api.zip"
}

package_analytics() {
  local stage="${OUT_DIR}/analytics"
  local knn_rel="PredictorFireHazard-main/Sensibilidad de gases/knn"
  rm -rf "${stage}"
  mkdir -p "${stage}/${knn_rel}"
  cp "${ROOT_DIR}/analytics/requirements.txt" "${stage}/requirements.txt"
  cp -R "${ROOT_DIR}/analytics/app" "${stage}/app"
  cp -R "${ROOT_DIR}/analytics/firehazr" "${stage}/firehazr"
  cp -R "${ROOT_DIR}/${knn_rel}/." "${stage}/${knn_rel}/"
  find "${stage}" -type d -name "__pycache__" -prune -exec rm -rf {} +
  find "${stage}" -type f -name "*.pyc" -delete
  create_zip "${stage}" "${OUT_DIR}/analytics.zip"
  echo "Packaged ${OUT_DIR}/analytics.zip"
}

case "${TARGET}" in
  all)
    package_frontend
    package_api
    package_analytics
    ;;
  frontend) package_frontend ;;
  api) package_api ;;
  analytics) package_analytics ;;
  *)
    echo "Unknown target '${TARGET}'. Expected: all, frontend, api, or analytics." >&2
    exit 1
    ;;
esac
