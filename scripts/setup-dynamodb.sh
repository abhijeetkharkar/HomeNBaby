#!/usr/bin/env bash
# =============================================================================
# scripts/setup-dynamodb.sh — One-time: Create DynamoDB table for tracker
# Run from Git Bash on Windows.
#
# Usage:
#   bash scripts/setup-dynamodb.sh
# =============================================================================
set -euo pipefail

PROFILE="admin"
REGION="us-east-1"
TASKS_TABLE="tracker-tasks"
NAMES_TABLE="tracker-baby-names"

# ── Create tracker-tasks table ────────────────────────────────────────────────
echo ""
echo "=== Creating DynamoDB table: $TASKS_TABLE ==="
echo ""

if aws dynamodb describe-table --table-name "$TASKS_TABLE" --region "$REGION" --profile "$PROFILE" --output text 2>/dev/null | head -1 | grep -q "$TASKS_TABLE"; then
  echo "⚠ Table '$TASKS_TABLE' already exists. Skipping creation."
else
  aws dynamodb create-table \
    --table-name "$TASKS_TABLE" \
    --attribute-definitions \
      AttributeName=id,AttributeType=N \
    --key-schema \
      AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query 'TableDescription.TableArn' \
    --output text

  echo "  Waiting for table to become active..."
  aws dynamodb wait table-exists \
    --table-name "$TASKS_TABLE" \
    --region "$REGION" \
    --profile "$PROFILE"

  echo "  ✓ Table created"
fi

# ── Create tracker-baby-names table ──────────────────────────────────────────
echo ""
echo "=== Creating DynamoDB table: $NAMES_TABLE ==="
echo ""

if aws dynamodb describe-table --table-name "$NAMES_TABLE" --region "$REGION" --profile "$PROFILE" --output text 2>/dev/null | head -1 | grep -q "$NAMES_TABLE"; then
  echo "⚠ Table '$NAMES_TABLE' already exists. Skipping creation."
else
  aws dynamodb create-table \
    --table-name "$NAMES_TABLE" \
    --attribute-definitions \
      AttributeName=id,AttributeType=S \
    --key-schema \
      AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query 'TableDescription.TableArn' \
    --output text

  echo "  Waiting for table to become active..."
  aws dynamodb wait table-exists \
    --table-name "$NAMES_TABLE" \
    --region "$REGION" \
    --profile "$PROFILE"

  echo "  ✓ Table created"
fi

# ── Add DynamoDB permissions to the Lambda role ───────────────────────────────
echo ""
echo "▶ Adding DynamoDB permissions to tracker-lambda-role..."

# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --profile "$PROFILE" --query 'Account' --output text)
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/tracker-dynamodb-policy"

POLICY_DOC=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Scan",
        "dynamodb:Query",
        "dynamodb:BatchWriteItem",
        "dynamodb:BatchGetItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${TASKS_TABLE}",
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${NAMES_TABLE}"
      ]
    }
  ]
}
EOF
)

if aws iam get-policy --policy-arn "$POLICY_ARN" --profile "$PROFILE" 2>/dev/null; then
  echo "  Policy already exists — updating..."
  aws iam create-policy-version \
    --policy-arn "$POLICY_ARN" \
    --policy-document "$POLICY_DOC" \
    --set-as-default \
    --profile "$PROFILE" > /dev/null
  echo "  ✓ Policy updated (now covers both tables)"
else
  aws iam create-policy \
    --policy-name "tracker-dynamodb-policy" \
    --policy-document "$POLICY_DOC" \
    --profile "$PROFILE" \
    --query 'Policy.Arn' \
    --output text
  echo "  ✓ Policy created"
fi

# Attach to Lambda role
aws iam attach-role-policy \
  --role-name "tracker-lambda-role" \
  --policy-arn "$POLICY_ARN" \
  --profile "$PROFILE" 2>/dev/null || true

echo "  ✓ Policy attached to tracker-lambda-role"

echo ""
echo "✅ DynamoDB infrastructure ready!"
echo "   Tables (PAY_PER_REQUEST — free tier covers 25 RCU + 25 WCU):"
echo "     $TASKS_TABLE  (partition key: id, Number)"
echo "     $NAMES_TABLE  (partition key: id, String)"
echo ""
echo "Next steps:"
echo "  node scripts/seed-dynamo.js    (seed task data)"
echo "  node scripts/seed-names.js     (seed baby names — 563 names)"
echo ""
