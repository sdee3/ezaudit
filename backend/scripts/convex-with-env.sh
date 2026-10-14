#!/usr/bin/env bash
# Run the Convex CLI with a scrubbed environment so a stray CONVEX_DEPLOY_KEY
# in the parent shell cannot select another app's deployment.
set -euo pipefail

BACKEND_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USE_PROD=false
ARGS=()
for arg in "$@"; do
  case "${arg}" in
    --prod|--production) USE_PROD=true ;;
    *) ARGS+=("${arg}") ;;
  esac
done

if [[ "${USE_PROD}" == true ]]; then
  # shellcheck source=load-backend-env.sh
  source "${BACKEND_ROOT}/scripts/load-backend-env.sh" --prod
else
  # shellcheck source=load-backend-env.sh
  source "${BACKEND_ROOT}/scripts/load-backend-env.sh"
fi

if [[ -z "${CONVEX_DEPLOY_KEY:-}" ]]; then
  echo "CONVEX_DEPLOY_KEY is missing from ${ENV_FILE}." >&2
  exit 1
fi
if [[ -z "${CONVEX_DEPLOYMENT:-}" ]]; then
  if [[ "${USE_PROD}" == true ]]; then
    echo "CONVEX_DEPLOYMENT is missing from ${ENV_FILE} (expected prod:<ref>)." >&2
    exit 1
  fi
  CONVEX_DEPLOYMENT="dev:bold-orca-397"
fi

cd "${BACKEND_ROOT}"
exec env -i \
  PATH="${PATH:-/usr/bin:/bin}" \
  HOME="${HOME:-}" \
  USER="${USER:-}" \
  TMPDIR="${TMPDIR:-/tmp}" \
  CONVEX_DEPLOYMENT="${CONVEX_DEPLOYMENT}" \
  CONVEX_DEPLOY_KEY="${CONVEX_DEPLOY_KEY}" \
  npx convex "${ARGS[@]}"
