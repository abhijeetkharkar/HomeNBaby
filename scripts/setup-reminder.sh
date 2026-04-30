#!/usr/bin/env bash
# scripts/setup-reminder.sh - Deploy the daily reminder Lambda + EventBridge
# Run AFTER setup-ses.sh. Re-running is safe - updates existing resources.
# Usage: bash scripts/setup-reminder.sh   (from project root)
set -euo pipefail

PROFILE="admin"
REGION="us-east-1"
FROM_EMAIL="reminders@tracker.abhijeetkharkar.com"
TABLE_NAME="tracker-tasks"
LAMBDA_NAME="tracker-reminder"
LAMBDA_ROLE="tracker-lambda-role"
RULE_NAME="tracker-daily-reminder"

# Always resolve from the current working directory (project root)
PROJECT_DIR="$(pwd)"
SCRIPT_DIR="$PROJECT_DIR/scripts"

echo ""
echo "+--------------------------------------------------+"
echo "|       Deploying Daily Reminder Lambda            |"
echo "+--------------------------------------------------+"
echo ""

# -- Step 1: Attach SES send permission to Lambda role -------------------------
echo "> Ensuring SES permission on $LAMBDA_ROLE..."

POLICY_NAME="tracker-ses-policy"
POLICY_DOC='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["ses:SendEmail","ses:SendRawEmail"],"Resource":"*"}]}'

POLICY_ARN=$(aws iam list-policies \
  --profile "$PROFILE" \
  --query "Policies[?PolicyName=='${POLICY_NAME}'].Arn" \
  --output text)

if [ -z "$POLICY_ARN" ] || [ "$POLICY_ARN" = "None" ]; then
  POLICY_ARN=$(aws iam create-policy \
    --policy-name "$POLICY_NAME" \
    --policy-document "$POLICY_DOC" \
    --profile "$PROFILE" \
    --query "Policy.Arn" \
    --output text)
  echo "  Policy created: $POLICY_ARN"
else
  echo "  Policy exists: $POLICY_ARN"
fi

aws iam attach-role-policy \
  --role-name "$LAMBDA_ROLE" \
  --policy-arn "$POLICY_ARN" \
  --profile "$PROFILE" 2>/dev/null || true
echo "  Attached to $LAMBDA_ROLE OK"

# -- Step 2: Package the reminder Lambda ---------------------------------------
echo ""
echo "> Packaging reminder Lambda..."

BUILD_DIR="$PROJECT_DIR/reminder-build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

cp "$PROJECT_DIR/lambda-reminder.js" "$BUILD_DIR/index.js"

cat > "$BUILD_DIR/package.json" << 'PKGJSON'
{
  "name": "tracker-reminder",
  "version": "1.0.0",
  "dependencies": {
    "@aws-sdk/client-ses": "^3.0.0",
    "@aws-sdk/client-dynamodb": "^3.0.0",
    "@aws-sdk/lib-dynamodb": "^3.0.0"
  }
}
PKGJSON

cd "$BUILD_DIR"
npm install --production --silent
cd "$PROJECT_DIR"

ZIP_OUT="$PROJECT_DIR/reminder-deploy.zip"
node "$SCRIPT_DIR/make-reminder-zip.js" "$BUILD_DIR" "$ZIP_OUT"
echo "  reminder-deploy.zip ready"

# Convert to Windows path for AWS CLI fileb:// on Git Bash
ZIP_WIN=$(cygpath -w "$ZIP_OUT" 2>/dev/null || echo "$ZIP_OUT")

# -- Step 3: Create or update the Lambda function ------------------------------
echo ""
echo "> Deploying Lambda function..."

LAMBDA_ROLE_ARN=$(aws iam get-role \
  --role-name "$LAMBDA_ROLE" \
  --profile "$PROFILE" \
  --query "Role.Arn" \
  --output text)

LAMBDA_EXISTS=$(aws lambda get-function \
  --function-name "$LAMBDA_NAME" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --query "Configuration.FunctionName" \
  --output text 2>/dev/null || echo "NOT_FOUND")

ENV_VARS="Variables={TABLE_NAME=${TABLE_NAME},FROM_EMAIL=${FROM_EMAIL}}"

if [ "$LAMBDA_EXISTS" = "NOT_FOUND" ]; then
  aws lambda create-function \
    --function-name "$LAMBDA_NAME" \
    --runtime nodejs20.x \
    --role "$LAMBDA_ROLE_ARN" \
    --handler "index.handler" \
    --zip-file "fileb://$ZIP_WIN" \
    --timeout 30 \
    --memory-size 256 \
    --environment "$ENV_VARS" \
    --profile "$PROFILE" \
    --region "$REGION" > /dev/null
  echo "  Lambda created OK"
else
  aws lambda update-function-code \
    --function-name "$LAMBDA_NAME" \
    --zip-file "fileb://$ZIP_WIN" \
    --profile "$PROFILE" \
    --region "$REGION" > /dev/null
  aws lambda wait function-updated \
    --function-name "$LAMBDA_NAME" \
    --profile "$PROFILE" \
    --region "$REGION"
  aws lambda update-function-configuration \
    --function-name "$LAMBDA_NAME" \
    --environment "$ENV_VARS" \
    --profile "$PROFILE" \
    --region "$REGION" > /dev/null
  echo "  Lambda updated OK"
fi

rm -f "$ZIP_OUT"
rm -rf "$BUILD_DIR"

LAMBDA_ARN=$(aws lambda get-function \
  --function-name "$LAMBDA_NAME" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --query "Configuration.FunctionArn" \
  --output text)

# -- Step 4: EventBridge rule - 8:00 AM Central (13:00 UTC during CDT) --------
echo ""
echo "> Setting up EventBridge schedule (8:00 AM Central = 13:00 UTC)..."

aws events put-rule \
  --name "$RULE_NAME" \
  --schedule-expression "cron(0 13 * * ? *)" \
  --state ENABLED \
  --description "Daily Home and Baby Tracker reminder at 8am Central" \
  --profile "$PROFILE" \
  --region "$REGION" > /dev/null
echo "  Rule created/updated OK"

RULE_ARN=$(aws events describe-rule \
  --name "$RULE_NAME" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --query "Arn" \
  --output text)

aws events put-targets \
  --rule "$RULE_NAME" \
  --targets "Id=reminder-lambda,Arn=${LAMBDA_ARN}" \
  --profile "$PROFILE" \
  --region "$REGION" > /dev/null
echo "  Lambda target set OK"

aws lambda add-permission \
  --function-name "$LAMBDA_NAME" \
  --statement-id "EventBridgeInvoke" \
  --action "lambda:InvokeFunction" \
  --principal "events.amazonaws.com" \
  --source-arn "$RULE_ARN" \
  --profile "$PROFILE" \
  --region "$REGION" > /dev/null 2>&1 || true
echo "  Invoke permission granted OK"

echo ""
echo "DONE - Reminder Lambda deployed!"
echo ""
echo "  Function:  $LAMBDA_NAME"
echo "  Schedule:  Daily 8:00 AM Central (cron(0 13 * * ? *))"
echo "  From:      $FROM_EMAIL"
echo "  To:        abhijeetkharkar@gmail.com / prajaktap999@gmail.com"
echo ""
echo "  Test:"
echo "  aws lambda invoke --function-name $LAMBDA_NAME --profile admin --region $REGION /tmp/out.json"
echo ""