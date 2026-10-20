#!/usr/bin/env bash
# Push deployment env vars from backend/.env.local (or .env.production with --prod).
# Unset keys are skipped. CREDITS_SERVICE_SECRET_EZAUDIT is set only when present.
set -euo pipefail

BACKEND_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USE_PROD=false
if [[ "${1:-}" == "--prod" || "${1:-}" == "--production" ]]; then
  USE_PROD=true
fi

if [[ "${USE_PROD}" == true ]]; then
  # shellcheck source=load-backend-env.sh
  source "${BACKEND_ROOT}/scripts/load-backend-env.sh" --prod
else
  # shellcheck source=load-backend-env.sh
  source "${BACKEND_ROOT}/scripts/load-backend-env.sh"
fi

KEYS=(
  CLERK_JWT_ISSUER_DOMAIN
  LIGHTHOUSE_WORKER_URL
  LIGHTHOUSE_WORKER_SECRET
  LIGHTHOUSE_AWS_ACCESS_KEY_ID
  LIGHTHOUSE_AWS_SECRET_ACCESS_KEY
  LIGHTHOUSE_AWS_SESSION_TOKEN
  RESEND_API_KEY
  RESEND_FROM_EMAIL
  CREDITS_SERVICE_SECRET_EZAUDIT
)

set_any=false
for key in "${KEYS[@]}"; do
  val="${!key:-}"
  if [[ -z "${val}" ]]; then
    echo "Skipping ${key} (unset)."
    continue
  fi
  set_any=true
  echo "Setting Convex env ${key}..."
  # Pass the value on stdin so it never appears in the echoed CLI command.
  if [[ "${USE_PROD}" == true ]]; then
    printf '%s' "${val}" | bash "${BACKEND_ROOT}/scripts/convex-with-env.sh" --prod env set "${key}"
  else
    printf '%s' "${val}" | bash "${BACKEND_ROOT}/scripts/convex-with-env.sh" env set "${key}"
  fi
done

if [[ "${set_any}" == false ]]; then
  echo "No deployment env vars to set."
fi
