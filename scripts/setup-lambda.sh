#!/usr/bin/env bash
# =============================================================================
# scripts/setup-lambda.sh — ONE-TIME Lambda + API setup
# Run from Git Bash on Windows, or any bash on Mac/Linux.
# Run AFTER setup.sh. Adds the /api/* backend to your CloudFront distribution.
#
# Usage:
#   bash scripts/setup-lambda.sh
# =============================================================================
set -euo pipefail

# ─── FILL THIS IN (output from setup.sh) ─────────────────────────────────────
CLOUDFRONT_ID="E2C4ZYW75CTXZT"
# ─────────────────────────────────────────────────────────────────────────────

PROFILE="admin"
FUNCTION_NAME="tracker-api"
ROLE_NAME="tracker-lambda-role"
REGION="us-east-1"
RUNTIME="nodejs20.x"

if [[ "$CLOUDFRONT_ID" == "EXXXXXXXXXX" ]]; then
  echo "✗ Set CLOUDFRONT_ID at the top of setup-lambda.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "=== Lambda API setup for tracker.abhijeetkharkar.com ==="
echo ""

# ── 1. Install serverless-http ────────────────────────────────────────────────
echo "▶ Installing serverless-http..."
cd "$PROJECT_DIR"
npm install serverless-http --save --silent
echo "  Done"

# ── 2. Create IAM role ────────────────────────────────────────────────────────
echo "▶ Creating IAM execution role: $ROLE_NAME..."
if aws iam get-role --role-name "$ROLE_NAME" --profile "$PROFILE" 2>/dev/null; then
  echo "  Role already exists — skipping"
  ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" \
    --profile "$PROFILE" --query 'Role.Arn' --output text)
else
  ROLE_ARN=$(aws iam create-role \
    --role-name "$ROLE_NAME" \
    --profile "$PROFILE" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "lambda.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' \
    --query 'Role.Arn' --output text)

  aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --profile "$PROFILE" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

  echo "  Role created — waiting 10s for IAM to propagate..."
  sleep 10
fi
echo "  Role ARN: $ROLE_ARN"

# ── 3. Build Lambda zip (cross-platform via Node.js) ─────────────────────────
echo "▶ Building Lambda deployment package..."
node "$SCRIPT_DIR/make-lambda-zip.js"

# ── 4. Create Lambda function ─────────────────────────────────────────────────
echo "▶ Creating Lambda function: $FUNCTION_NAME..."
cd "$PROJECT_DIR"
if aws lambda get-function --function-name "$FUNCTION_NAME" \
    --region "$REGION" --profile "$PROFILE" 2>/dev/null; then
  echo "  Function already exists — updating code instead"
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://./lambda-deploy.zip" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query 'FunctionArn' --output text
else
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime "$RUNTIME" \
    --handler "lambda.handler" \
    --role "$ROLE_ARN" \
    --zip-file "fileb://./lambda-deploy.zip" \
    --timeout 15 \
    --memory-size 256 \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query 'FunctionArn' --output text
fi

rm -f lambda-deploy.zip
echo "  Function ready ✓"

# ── 5. Create Lambda Function URL ────────────────────────────────────────────
echo "▶ Creating Lambda Function URL..."
if aws lambda get-function-url-config \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" --profile "$PROFILE" 2>/dev/null; then
  echo "  Function URL already exists — skipping"
  LAMBDA_URL=$(aws lambda get-function-url-config \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" --profile "$PROFILE" \
    --query 'FunctionUrl' --output text)
else
  LAMBDA_URL=$(aws lambda create-function-url-config \
    --function-name "$FUNCTION_NAME" \
    --auth-type NONE \
    --region "$REGION" --profile "$PROFILE" \
    --query 'FunctionUrl' --output text)

  aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id AllowPublicAccess \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --function-url-auth-type NONE \
    --region "$REGION" --profile "$PROFILE" > /dev/null
fi

# Strip https:// and trailing slash
LAMBDA_DOMAIN=$(echo "$LAMBDA_URL" | sed 's|https://||' | sed 's|/$||')
echo "  Function URL: https://$LAMBDA_DOMAIN"

# ── 6. Update CloudFront — add Lambda origin + /api/* behaviour ───────────────
echo "▶ Updating CloudFront distribution: $CLOUDFRONT_ID..."

# Use Node.js + AWS SDK to avoid Windows path/escaping issues
node "$SCRIPT_DIR/update-cloudfront.js" "$CLOUDFRONT_ID" "$LAMBDA_DOMAIN" "$PROFILE"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "✅ Lambda API setup complete!"
echo ""
echo "  /api/* → Lambda (Express + SQLite)"
echo "  /*     → S3 (React frontend)"
echo ""
echo "  Open scripts/deploy.sh and set:"
echo "  LAMBDA_FUNCTION_NAME=\"$FUNCTION_NAME\""
echo ""
echo "  ⚠️  Wait 5–10 min for CloudFront to propagate the new behaviour."
echo ""
