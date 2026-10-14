#!/usr/bin/env bash
# Load backend/.env.local or, with --prod, backend/.env.production.
# Parse as dotenv. Never `source`: Convex deploy keys contain `|` and a trailing `=`.
set -euo pipefail

BACKEND_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

load_dotenv_file() {
  local env_file="$1"
  local line trimmed key val
  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line%$'\r'}"
    trimmed="${line#"${line%%[![:space:]]*}"}"
    [[ -z "${trimmed}" || "${trimmed}" == \#* ]] && continue
    if [[ "${trimmed}" == export[[:space:]]* ]]; then
      trimmed="${trimmed#export}"
      trimmed="${trimmed#"${trimmed%%[![:space:]]*}"}"
    fi
    [[ "${trimmed}" != *=* ]] && continue
    key="${trimmed%%=*}"
    val="${trimmed#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    key="${key#"${key%%[![:space:]]*}"}"
    [[ "${key}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    case "${val}" in
      \"*\") val="${val#\"}"; val="${val%\"}" ;;
      \'*\') val="${val#\'}"; val="${val%\'}" ;;
    esac
    export "${key}=${val}"
  done < "${env_file}"
}

USE_PROD=false
for arg in "$@"; do
  if [[ "${arg}" == "--prod" || "${arg}" == "--production" ]]; then
    USE_PROD=true
  fi
done

if [[ "${USE_PROD}" == true ]]; then
  ENV_FILE="${BACKEND_ROOT}/.env.production"
else
  ENV_FILE="${BACKEND_ROOT}/.env.local"
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Add CONVEX_DEPLOYMENT and CONVEX_DEPLOY_KEY there (do not commit it)." >&2
  exit 1
fi

load_dotenv_file "${ENV_FILE}"
