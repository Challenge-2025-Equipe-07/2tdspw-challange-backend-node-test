#!/usr/bin/env bash
# Publish this API to the existing Azure Web App.
# Does not run az deployment group create. That would clear Firebase and CHAT_WEBHOOK_SECRET.
# Reads POSTGRES_ADMIN_PASSWORD, POSTGRES_HOST, CHAT_WEBHOOK_SECRET, and the
# VAPID keys from the environment or from .env. Does not print those values.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RESOURCE_GROUP="${RESOURCE_GROUP:-rg-veti}"
WEB_APP="${WEB_APP:-veti-api-nyhmyyhlqmwgk}"
POSTGRES_USER="${POSTGRES_USER:-vetiadmin}"

read_env() {
  local key="$1"
  if [[ -n "${!key:-}" ]]; then
    return
  fi
  if [[ ! -f .env ]]; then
    return
  fi
  local raw
  raw="$(grep -E "^${key}=" .env | tail -n 1 | cut -d= -f2- || true)"
  raw="${raw%\"}"
  raw="${raw#\"}"
  raw="${raw%\'}"
  raw="${raw#\'}"
  printf -v "$key" '%s' "$raw"
}

read_env POSTGRES_ADMIN_PASSWORD
read_env POSTGRES_HOST
read_env CHAT_WEBHOOK_SECRET
read_env VAPID_PUBLIC_KEY
read_env VAPID_PRIVATE_KEY
read_env VAPID_SUBJECT

if [[ -z "${POSTGRES_ADMIN_PASSWORD:-}" || -z "${POSTGRES_HOST:-}" ]]; then
  echo "Set POSTGRES_ADMIN_PASSWORD and POSTGRES_HOST in the environment or .env." >&2
  exit 1
fi
if [[ -z "${CHAT_WEBHOOK_SECRET:-}" ]]; then
  echo "Set CHAT_WEBHOOK_SECRET in the environment or .env." >&2
  exit 1
fi

POSTGRES_SERVER="${POSTGRES_HOST%%.*}"
CLIENT_IP="${CLIENT_IP:-$(curl -4 -fsS ifconfig.me)}"

echo "Allowing ${CLIENT_IP} through the Postgres firewall"
az postgres flexible-server firewall-rule update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_SERVER" \
  --rule-name AllowClient \
  --start-ip-address "$CLIENT_IP" \
  --end-ip-address "$CLIENT_IP" \
  --output none

ENCODED_PASSWORD="$(
  node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' \
    "$POSTGRES_ADMIN_PASSWORD"
)"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${ENCODED_PASSWORD}@${POSTGRES_HOST}:5432/veti?sslmode=require"

echo "Applying migrations to ${POSTGRES_HOST}"
npx prisma migrate deploy --config prisma7.config.ts

echo "Building the API"
npm ci
npx prisma generate --config prisma7.config.ts
npm run build

ZIP="/tmp/veti-api.zip"
rm -rf /tmp/veti-zip
mkdir /tmp/veti-zip
cp -R dist package.json package-lock.json node_modules /tmp/veti-zip
(
  cd /tmp/veti-zip
  npm prune --omit=dev
  rm -f "$ZIP"
  zip -q -r "$ZIP" .
)

echo "Publishing ${WEB_APP}"
az webapp deploy \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEB_APP" \
  --src-path "$ZIP" \
  --type zip

echo "Setting CHAT_WEBHOOK_SECRET"
az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEB_APP" \
  --settings "CHAT_WEBHOOK_SECRET=${CHAT_WEBHOOK_SECRET}" \
  --output none

if [[ -n "${VAPID_PUBLIC_KEY:-}" && -n "${VAPID_PRIVATE_KEY:-}" && -n "${VAPID_SUBJECT:-}" ]]; then
  echo "Setting VAPID keys"
  az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$WEB_APP" \
    --settings \
      "VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY}" \
      "VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY}" \
      "VAPID_SUBJECT=${VAPID_SUBJECT}" \
    --output none
fi

echo "Checking https://${WEB_APP}.azurewebsites.net/"
alive=0
for _ in 1 2 3 4 5; do
  if curl -fsS --max-time 30 "https://${WEB_APP}.azurewebsites.net/"; then
    echo
    alive=1
    break
  fi
  sleep 3
done
if [[ "$alive" -ne 1 ]]; then
  echo "The site did not respond. The free plan may still be waking up." >&2
  exit 1
fi
