#!/usr/bin/env bash
# Upload seed-gallery to Cloudflare R2 using the S3-compatible API (awscli).
#
# Prerequisites:
#   1. R2 enabled in Cloudflare Dashboard (https://dash.cloudflare.com/)
#   2. R2 API token with "Object Read & Write" permission
#      Create at: https://dash.cloudflare.com/?to=/:account/r2/api-tokens
#   3. awscli installed: brew install awscli  (or https://aws.amazon.com/cli/)
#
# Usage:
#   chmod +x scripts/upload-seed-gallery-r2.sh
#   ./scripts/upload-seed-gallery-r2.sh
#
# Required env vars (set before running):
#   R2_ACCESS_KEY_ID     — R2 token Access Key ID
#   R2_SECRET_ACCESS_KEY — R2 token Secret Access Key
#   R2_ACCOUNT_ID        — Cloudflare Account ID (cf0ed37d49b5ddad4614caa0aa4edb26)
#
# Alternative: set up ~/.aws/credentials with an r2 profile:
#   [r2]
#   aws_access_key_id = <R2_ACCESS_KEY_ID>
#   aws_secret_access_key = <R2_SECRET_ACCESS_KEY>
#   region = auto

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SEED_GALLERY_DIR="$PROJECT_DIR/public/seed-gallery"

R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-cf0ed37d49b5ddad4614caa0aa4edb26}"
BUCKET_NAME="happyimage-seed-gallery"
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

say() { printf '%b\n' "$*"; }

die() {
  say "${RED}[ERROR]${NC} $*" >&2
  exit 1
}

check_deps() {
  if ! command -v aws &>/dev/null; then
    die "awscli not found. Install it: brew install awscli"
  fi

  if [ ! -d "$SEED_GALLERY_DIR" ]; then
    die "Seed gallery directory not found: $SEED_GALLERY_DIR"
  fi
}

check_r2_bucket() {
  say "${YELLOW}Checking R2 bucket '$BUCKET_NAME'...${NC}"

  if aws s3api head-bucket \
    --bucket "$BUCKET_NAME" \
    --endpoint-url "$R2_ENDPOINT" \
    --profile "${AWS_PROFILE:-r2}" \
    &>/dev/null; then
    say "${GREEN}Bucket '$BUCKET_NAME' exists.${NC}"
  else
    die "Bucket '$BUCKET_NAME' not found or not accessible. Create it first:\n  npx wrangler r2 bucket create $BUCKET_NAME"
  fi
}

check_credentials() {
  say "${YELLOW}Checking R2 credentials...${NC}"

  if aws sts get-caller-identity \
    --endpoint-url "$R2_ENDPOINT" \
    --profile "${AWS_PROFILE:-r2}" \
    &>/dev/null; then
    say "${GREEN}R2 credentials OK.${NC}"
  else
    cat >&2 <<EOF
${RED}[ERROR]${NC} Cannot authenticate with R2. Set up credentials:

Option A — Environment variables:
  export R2_ACCESS_KEY_ID="<your-access-key-id>"
  export R2_SECRET_ACCESS_KEY="<your-secret-access-key>"
  export R2_ACCOUNT_ID="$R2_ACCOUNT_ID"

Option B — AWS profile (~/.aws/credentials):
  [r2]
  aws_access_key_id = <your-access-key-id>
  aws_secret_access_key = <your-secret-access-key>
  region = auto

Then run:
  export AWS_PROFILE=r2
  ./scripts/upload-seed-gallery-r2.sh

Get your R2 token at: https://dash.cloudflare.com/?to=/:account/r2/api-tokens
(Use "Object Read & Write" permission, or "Admin Read & Write")

EOF
    exit 1
  fi
}

list_counts() {
  local dir="$1"
  local label="$2"
  local count
  count=$(find "$dir" -type f | wc -l | tr -d ' ')
  local size
  size=$(du -sh "$dir" | cut -f1)
  say "  $label: ${count} files, ${size}"
}

do_upload() {
  say "${YELLOW}Uploading seed-gallery to R2...${NC}"
  say "  Source: $SEED_GALLERY_DIR"
  say "  Target: s3://$BUCKET_NAME/"
  say ""

  list_counts "$SEED_GALLERY_DIR/images"      "images"
  list_counts "$SEED_GALLERY_DIR/thumbnails"   "thumbnails"
  list_counts "$SEED_GALLERY_DIR/static"       "static"
  say ""

  # Sync with R2. The seed-gallery/ prefix matches what the Worker uses.
  # --no-follow-symlinks: don't traverse symlinks
  # --size-only: skip files with same size (faster than checksum)
  aws s3 sync "$SEED_GALLERY_DIR" "s3://$BUCKET_NAME/seed-gallery/" \
    --endpoint-url "$R2_ENDPOINT" \
    --profile "${AWS_PROFILE:-r2}" \
    --no-follow-symlinks \
    --size-only \
    --exclude "README.md"

  say ""
  say "${GREEN}Upload complete!${NC}"
  say ""
  say "Next steps:"
  say "  1. Verify:  npx wrangler r2 object list $BUCKET_NAME --prefix seed-gallery/ | head"
  say "  2. Deploy:  pnpm run cf:deploy"
}

# ── main ──────────────────────────────────────────────────────────────

check_deps

# If env vars are set, configure a temporary profile
if [ -n "${R2_ACCESS_KEY_ID:-}" ] && [ -n "${R2_SECRET_ACCESS_KEY:-}" ]; then
  export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
  export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
  export AWS_PROFILE="${AWS_PROFILE:-r2}"
  say "${GREEN}Using R2 credentials from environment.${NC}"
fi

check_credentials
check_r2_bucket
do_upload
