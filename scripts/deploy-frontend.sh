#!/usr/bin/env bash
# =============================================================================
# scripts/deploy-frontend.sh — Deploy React frontend to S3 + CloudFront
# Run from Git Bash on Windows, or any bash on Mac/Linux.
#
# Usage:
#   bash scripts/deploy-frontend.sh
# =============================================================================
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
PROFILE="admin"
CLOUDFRONT_ID="E2C4ZYW75CTXZT"
BUCKET="tracker.abhijeetkharkar.com"
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo ""
echo "=== Deploying frontend → S3 + CloudFront ==="
echo ""

# ── 1. Build ──────────────────────────────────────────────────────────────────
echo "▶ Building frontend..."
npm run build
cp favicon.svg public/favicon.svg
echo "  Built to public/"

# ── 2. Upload hashed assets (Vite fingerprints filenames — long cache) ────────
echo "▶ Uploading assets..."
aws s3 sync public/ s3://"$BUCKET"/ \
  --profile "$PROFILE" \
  --exclude "index.html" \
  --cache-control "max-age=31536000,public,immutable" \
  --delete \
  --no-progress

# ── 3. Upload index.html (no-cache — must always be fresh) ───────────────────
echo "▶ Uploading index.html..."
aws s3 cp public/index.html s3://"$BUCKET"/index.html \
  --profile "$PROFILE" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --content-type "text/html"

# ── 4. Invalidate CloudFront ──────────────────────────────────────────────────
echo "▶ Invalidating CloudFront..."
MSYS_NO_PATHCONV=1 aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_ID" \
  --profile "$PROFILE" \
  --paths "/index.html" \
  --query 'Invalidation.Id' \
  --output text > /dev/null

echo ""
echo "✅ Frontend deployed! Live in ~15 sec."
echo ""
