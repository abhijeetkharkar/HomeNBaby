#!/usr/bin/env bash
# =============================================================================
# scripts/deploy.sh — Full deployment (frontend + backend)
# Run from Git Bash on Windows, or any bash on Mac/Linux.
#
# Usage:
#   bash scripts/deploy.sh            # deploy everything
#   bash scripts/deploy-frontend.sh   # frontend only (S3 + CloudFront)
#   bash scripts/deploy-backend.sh    # backend only (Lambda)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  Deploying tracker.abhijeetkharkar.com (full)   ║"
echo "╚══════════════════════════════════════════════════╝"

bash "$SCRIPT_DIR/deploy-frontend.sh"
bash "$SCRIPT_DIR/deploy-backend.sh"

echo "✅ Full deploy complete! https://tracker.abhijeetkharkar.com"
echo ""
