#!/usr/bin/env bash
# =============================================================================
# scripts/deploy-backend.sh — Deploy Express API to Lambda
# Run from Git Bash on Windows, or any bash on Mac/Linux.
#
# Usage:
#   bash scripts/deploy-backend.sh
# =============================================================================
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
PROFILE="admin"
LAMBDA_FUNCTION_NAME="tracker-api"
REGION="us-east-1"
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo ""
echo "=== Deploying backend → Lambda ==="
echo ""

# ── 1. Build Lambda package ──────────────────────────────────────────────────
echo "▶ Building Lambda package..."
node "$SCRIPT_DIR/make-lambda-zip.js"

# ── 2. Push to Lambda ────────────────────────────────────────────────────────
echo "▶ Updating Lambda function..."
aws lambda update-function-code \
  --function-name "$LAMBDA_FUNCTION_NAME" \
  --zip-file "fileb://./lambda-deploy.zip" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query 'FunctionArn' \
  --output text > /dev/null

rm -f lambda-deploy.zip
echo "  Lambda updated ✓"

echo ""
echo "✅ Backend deployed! Live immediately."
echo ""
