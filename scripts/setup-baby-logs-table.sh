#!/usr/bin/env bash
# =============================================================================
# scripts/setup-baby-logs-table.sh
# Run from Git Bash on Windows.
# =============================================================================
set -euo pipefail

PROFILE="admin"
REGION="us-east-1"
TASKS_TABLE="tracker-tasks"
NAMES_TABLE="tracker-baby-names"
LOGS_TABLE="tracker-baby-logs"

echo ""
echo "=== Creating DynamoDB table: $LOGS_TABLE ==="
echo ""

if aws dynamodb describe-table --table-name "$LOGS_TABLE" --region "$REGION" --profile "$PROFILE" --output text 2>/dev/null | head -1 | grep -q "$LOGS_TABLE"; then
  echo "⚠ Table '$LOGS_TABLE' already exists. Skipping creation."
else
  aws dynamodb create-table \
    --table-name "$LOGS_TABLE" \
    --attribute-definitions \
      AttributeName=date,AttributeType=S \
      AttributeName=logId,AttributeType=S \
    --key-schema \
      AttributeName=date,KeyType=HASH \
      AttributeName=logId,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query 'TableDescription.TableArn' \
    --output text

  echo "  Waiting for table to become active..."
  aws dynamodb wait table-exists \
    --table-name "$LOGS_TABLE" \
    --region "$REGION" \
    --profile "$PROFILE"

  echo "  ✓ Table created"
fi

# ── Add DynamoDB permissions to the Lambda role ───────────────────────────────
echo ""
echo "▶ Updating DynamoDB permissions for tracker-lambda-role to include $LOGS_TABLE..."

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
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${NAMES_TABLE}",
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${LOGS_TABLE}"
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
  echo "  ✓ Policy updated (now covers all 3 tables)"
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
echo "✅ DynamoDB table $LOGS_TABLE ready!"
