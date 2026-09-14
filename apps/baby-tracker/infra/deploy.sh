#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-prod}"
REGION="${2:-us-east-1}"
PROFILE="${3:-admin}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STACK_NAME="baby-tracker-stack-$ENVIRONMENT"
TEMPLATE_FILE="$SCRIPT_DIR/template.yaml"
PARAM_FILE="$SCRIPT_DIR/parameters/$ENVIRONMENT.json"

PROFILE_ARGS=()
if [[ -n "$PROFILE" && "$PROFILE" != "none" && "$PROFILE" != "default-env" ]]; then
  PROFILE_ARGS=("--profile" "$PROFILE")
fi

echo -e "\033[0;36mDeploying CloudFormation stack: $STACK_NAME...\033[0m"
PARAMS=()
if [[ -f "$PARAM_FILE" ]]; then
  while IFS= read -r line; do
    [[ -n "$line" ]] && PARAMS+=("$line")
  done < <(jq -r 'to_entries[] | "\(.key)=\(.value)"' "$PARAM_FILE")
fi

DEPLOY_CMD=(aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE_FILE" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset)

if [[ ${#PARAMS[@]} -gt 0 ]]; then
  DEPLOY_CMD+=(--parameter-overrides "${PARAMS[@]}")
fi

if [[ ${#PROFILE_ARGS[@]} -gt 0 ]]; then
  DEPLOY_CMD+=("${PROFILE_ARGS[@]}")
fi

"${DEPLOY_CMD[@]}"

echo -e "\033[0;36mFetching stack outputs...\033[0m"
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  ${PROFILE_ARGS[@]+"${PROFILE_ARGS[@]}"} \
  --query "Stacks[0].Outputs[?OutputKey=='TrackerBucketName'].OutputValue" \
  --output text)

DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  ${PROFILE_ARGS[@]+"${PROFILE_ARGS[@]}"} \
  --query "Stacks[0].Outputs[?OutputKey=='TrackerDistributionId'].OutputValue" \
  --output text)

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  ${PROFILE_ARGS[@]+"${PROFILE_ARGS[@]}"} \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  ${PROFILE_ARGS[@]+"${PROFILE_ARGS[@]}"} \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
  --output text)

echo -e "\033[0;33mUserPoolId: $USER_POOL_ID\033[0m"
echo -e "\033[0;33mUserPoolClientId: $USER_POOL_CLIENT_ID\033[0m"

echo -e "\033[0;36mBuilding Baby Tracker frontend with injected Cognito config...\033[0m"
(
  cd "$APP_ROOT"
  export VITE_USER_POOL_ID="$USER_POOL_ID"
  export VITE_USER_POOL_CLIENT_ID="$USER_POOL_CLIENT_ID"
  export VITE_API_URL="https://api.abhijeetkharkar.com"
  npm run build
)

echo -e "\033[0;36mSyncing dist/ to s3://$BUCKET_NAME...\033[0m"
aws s3 sync "$APP_ROOT/dist" "s3://$BUCKET_NAME" --delete --region "$REGION" ${PROFILE_ARGS[@]+"${PROFILE_ARGS[@]}"}

echo -e "\033[0;36mInvalidating CloudFront cache for $DIST_ID...\033[0m"
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" --region "$REGION" ${PROFILE_ARGS[@]+"${PROFILE_ARGS[@]}"} > /dev/null

echo -e "\033[0;32mBaby Tracker app deployed successfully to https://babytracker.abhijeetkharkar.com\033[0m"
