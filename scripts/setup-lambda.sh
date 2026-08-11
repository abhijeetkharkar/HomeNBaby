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

# ── 5. Create API Gateway HTTP API ────────────────────────────────────────────
echo "▶ Creating API Gateway HTTP API..."
EXISTING_APIGW=$(aws apigatewayv2 get-apis \
  --region "$REGION" --profile "$PROFILE" \
  --query "Items[?Name=='tracker-api'].ApiId" --output text 2>/dev/null || true)

if [[ -n "$EXISTING_APIGW" ]]; then
  API_ID="$EXISTING_APIGW"
  echo "  API Gateway already exists (${API_ID}) — skipping"
else
  LAMBDA_ARN=$(aws lambda get-function \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" --profile "$PROFILE" \
    --query 'Configuration.FunctionArn' --output text)

  API_ID=$(aws apigatewayv2 create-api \
    --name "tracker-api" \
    --protocol-type HTTP \
    --region "$REGION" --profile "$PROFILE" \
    --query 'ApiId' --output text)

  INTEG_ID=$(aws apigatewayv2 create-integration \
    --api-id "$API_ID" \
    --integration-type AWS_PROXY \
    --integration-uri "$LAMBDA_ARN" \
    --payload-format-version "2.0" \
    --region "$REGION" --profile "$PROFILE" \
    --query 'IntegrationId' --output text)

  aws apigatewayv2 create-route \
    --api-id "$API_ID" \
    --route-key '$default' \
    --target "integrations/${INTEG_ID}" \
    --region "$REGION" --profile "$PROFILE" > /dev/null

  aws apigatewayv2 create-stage \
    --api-id "$API_ID" \
    --stage-name '$default' \
    --auto-deploy \
    --region "$REGION" --profile "$PROFILE" > /dev/null

  aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id AllowAPIGateway \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:$(aws sts get-caller-identity --profile "$PROFILE" --query 'Account' --output text):${API_ID}/*/*" \
    --region "$REGION" --profile "$PROFILE" > /dev/null

  echo "  API Gateway created (${API_ID}) ✓"
fi

APIGW_DOMAIN=$(aws apigatewayv2 get-api \
  --api-id "$API_ID" \
  --region "$REGION" --profile "$PROFILE" \
  --query 'ApiEndpoint' --output text | sed 's|https://||')
echo "  API endpoint: https://$APIGW_DOMAIN"

# ── 6. Update CloudFront — add API Gateway origin + /api/* behaviour ──────────
echo "▶ Updating CloudFront distribution: $CLOUDFRONT_ID..."

# Use Node.js + AWS SDK to avoid Windows path/escaping issues
node "$SCRIPT_DIR/update-cloudfront.js" "$CLOUDFRONT_ID" "$APIGW_DOMAIN" "$PROFILE"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "✅ Lambda API setup complete!"
echo ""
echo "  /api/* → CloudFront → API Gateway → Lambda (Express + DynamoDB)"
echo "  /*     → CloudFront → S3 (React frontend)"
echo ""
echo "  Open scripts/deploy.sh and set:"
echo "  LAMBDA_FUNCTION_NAME=\"$FUNCTION_NAME\""
echo ""
echo "  ⚠️  Wait 5–10 min for CloudFront to propagate the new behaviour."
echo ""
