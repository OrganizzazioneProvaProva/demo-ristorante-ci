#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_ACCOUNT_ID:?Missing Cloudflare account ID}"
: "${CLOUDFLARE_API_TOKEN:?Missing Cloudflare API token}"

wrangler=$1
assets=$2
config="$(dirname "${BASH_SOURCE[0]}")/wrangler.jsonc"
scratch=$(mktemp -d)
trap 'rm -r -- "$scratch"' EXIT
uuid='^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
paths=(/ /menu/ /en/menu/)

for path in "${paths[@]}"; do
  [[ -s "$assets${path}index.html" ]] || { echo "Missing asset for $path" >&2; exit 1; }
done
[[ -s "$assets/_headers" ]] || { echo "Missing asset _headers" >&2; exit 1; }

current_version() {
  "$wrangler" deployments status --config "$config" --json |
    node -e '
      const { versions } = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
      if (versions?.length !== 1 || versions[0].percentage !== 100) {
        throw new Error("Expected a single active Worker version at 100%");
      }
      process.stdout.write(versions[0].version_id);
    '
}

activate_version() {
  "$wrangler" versions deploy "$1@100%" --config "$config" --yes
}

verify_site() {
  local path status
  for path in "${paths[@]}"; do
    if ! status=$(curl -q --fail --silent --show-error --max-time 15 \
      --output "$scratch/response.html" --write-out '%{http_code}' \
      "https://demo.edordopng.dev$path") ||
      [[ "$status" != 200 ]] || ! cmp -s "$assets${path}index.html" "$scratch/response.html"; then
      echo "Public response differs from the artifact at $path" >&2
      return 1
    fi
  done
}

previous=$(current_version)
[[ "$previous" =~ $uuid ]] || { echo "Invalid active Worker version ID" >&2; exit 1; }
WRANGLER_OUTPUT_FILE_PATH="$scratch/upload.ndjson" "$wrangler" versions upload \
  --config "$config" --assets "$assets"
candidate=$(node -e '
  const records = require("node:fs").readFileSync(process.argv[1], "utf8").trim().split("\n").map(JSON.parse);
  const upload = records.find((record) => record.type === "version-upload" && record.worker_name === "demo-ristorante");
  if (typeof upload?.version_id !== "string") throw new Error("Missing uploaded Worker version ID");
  process.stdout.write(upload.version_id);
' "$scratch/upload.ndjson")
[[ "$candidate" =~ $uuid && "$candidate" != "$previous" ]] ||
  { echo "Invalid uploaded Worker version ID" >&2; exit 1; }
[[ "$(current_version)" == "$previous" ]] ||
  { echo "Active version changed during upload" >&2; exit 1; }

if activate_version "$candidate"; then
  for attempt in {1..6}; do
    if verify_site && [[ "$(current_version)" == "$candidate" ]]; then
      echo "Verified $candidate on the home page and both menus."
      exit 0
    fi
    if (( attempt < 6 )); then sleep 5; fi
  done
fi

if [[ "$(current_version)" == "$candidate" ]]; then
  echo "Restoring previously active version $previous." >&2
  activate_version "$previous"
  [[ "$(current_version)" == "$previous" ]] ||
    { echo "Previous version could not be confirmed" >&2; exit 1; }
fi
echo "Deployment verification failed. Check the active version in Cloudflare." >&2
exit 1
