#!/usr/bin/env bash
# =============================================================================
# scripts/setup-sns-sms.sh — One-time: Add SNS SMS permissions to Lambda role
# Run from Git Bash on Windows.
#
# Usage:
#   bash scripts/setup-sns-sms.sh
# =============================================================================
set -euo pipefail

PROFILE="admin"
REGION="us-east-1"
REMINDER_FUNCTION="tracker-reminder"

echo ""
echo "=== Setting up SNS SMS for baby tracker reminders ==="
echo ""

# ── Get account ID ────────────────────────────────────────────────────────────
ACCOUNT_ID=$(aws sts get-caller-identity --profile "$PROFILE" --query 'Account' --output text)
SNS_POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/tracker-sns-sms-policy"

# ── Create SNS SMS policy ────────────────────────────────────────────────────
echo "▶ Creating SNS SMS publish policy..."

SNS_POLICY_DOC=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sns:Publish"
      ],
      "Resource": "*"
    }
  ]
}
EOF
)

if aws iam get-policy --policy-arn "$SNS_POLICY_ARN" --profile "$PROFILE" 2>/dev/null; then
  echo "  Policy already exists — updating..."
  aws iam create-policy-version \
    --policy-arn "$SNS_POLICY_ARN" \
    --policy-document "$SNS_POLICY_DOC" \
    --set-as-default \
    --profile "$PROFILE" > /dev/null
  echo "  ✓ Policy updated"
else
  aws iam create-policy \
    --policy-name "tracker-sns-sms-policy" \
    --policy-document "$SNS_POLICY_DOC" \
    --profile "$PROFILE" \
    --query 'Policy.Arn' \
    --output text
  echo "  ✓ Policy created"
fi

# ── Attach to Lambda role ────────────────────────────────────────────────────
aws iam attach-role-policy \
  --role-name "tracker-lambda-role" \
  --policy-arn "$SNS_POLICY_ARN" \
  --profile "$PROFILE" 2>/dev/null || true

echo "  ✓ Policy attached to tracker-lambda-role"

# ── Update Lambda env vars with phone numbers ────────────────────────────────
echo ""
echo "▶ Setting phone number environment variables on $REMINDER_FUNCTION..."

# Prompt for phone numbers
read -p "Enter Abhijeet's phone number (e.g. +14085551234): " ABHIJEET_PHONE
read -p "Enter Prajakta's phone number (e.g. +14085551234): " PRAJAKTA_PHONE

aws lambda update-function-configuration \
  --function-name "$REMINDER_FUNCTION" \
  --environment "Variables={ABHIJEET_PHONE=$ABHIJEET_PHONE,PRAJAKTA_PHONE=$PRAJAKTA_PHONE,TABLE_NAME=tracker-baby-logs}" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query 'FunctionArn' \
  --output text > /dev/null

echo "  ✓ Environment variables set"

echo ""
echo "✅ SNS SMS setup complete!"
echo "   The reminder Lambda will now send SMS to:"
echo "     Abhijeet: $ABHIJEET_PHONE"
echo "     Prajakta: $PRAJAKTA_PHONE"
echo ""
echo "Next: Deploy the updated Lambda code:"
echo "  bash scripts/deploy-reminder.sh"
echo ""
