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
TABLE_NAME="tracker-tasks"

echo ""
echo "=== Creating DynamoDB table: $TABLE_NAME ==="
echo ""

# Check if table already exists
if aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" --profile "$PROFILE" --output text 2>/dev/null | head -1 | grep -q "$TABLE_NAME"; then
  echo "⚠ Table '$TABLE_NAME' already exists. Skipping creation."
else
  aws dynamodb create-table \
    --table-name "$TABLE_NAME" \
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
    --table-name "$TABLE_NAME" \
    --region "$REGION" \
    --profile "$PROFILE"

  echo "  ✓ Table created"
fi

# Add DynamoDB permissions to the Lambda role
echo ""
echo "▶ Adding DynamoDB permissions to tracker-lambda-role..."

POLICY_ARN="arn:aws:iam::policy/tracker-dynamodb-policy"

# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --profile "$PROFILE" --query 'Account' --output text)
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/tracker-dynamodb-policy"

# Create policy if it doesn't exist
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
      "Resource": "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${TABLE_NAME}"
    }
  ]
}
EOF
)

if aws iam get-policy --policy-arn "$POLICY_ARN" --profile "$PROFILE" 2>/dev/null; then
  echo "  Policy already exists"
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
  --policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/tracker-dynamodb-policy" \
  --profile "$PROFILE" 2>/dev/null || true

echo "  ✓ Policy attached to tracker-lambda-role"

echo ""
echo "✅ DynamoDB infrastructure ready!"
echo "   Table: $TABLE_NAME (PAY_PER_REQUEST — free tier covers 25 RCU + 25 WCU)"
echo ""
echo "Next step:"
echo "  node scripts/seed-dynamo.js   (seed task data)"
echo ""
