#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-prod}"
REGION="${2:-us-east-1}"
PROFILE="${3:-admin}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$APP_ROOT/dist"
ZIP_FILE="$DIST_DIR/lambda.zip"
STACK_NAME="cinema-manager-api-stack-$ENVIRONMENT"
TEMPLATE_FILE="$SCRIPT_DIR/template.yaml"
PARAM_FILE="$SCRIPT_DIR/parameters/$ENVIRONMENT.json"

PROFILE_ARGS=()
if [[ -n "$PROFILE" && "$PROFILE" != "none" && "$PROFILE" != "default-env" ]]; then
  PROFILE_ARGS=("--profile" "$PROFILE")
fi

echo -e "\033[0;36mBundling Cinema Manager API (NestJS)...\033[0m"
mkdir -p "$DIST_DIR"
(
  cd "$APP_ROOT"
  npx esbuild src/main.ts --bundle --platform=node --target=node20 \
    --external:@nestjs/microservices \
    --external:@nestjs/websockets \
    --external:class-transformer \
    --external:class-validator \
    "--outfile=$DIST_DIR/index.js"
  cd "$DIST_DIR"
  zip -q -r lambda.zip index.js
)

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

echo -e "\033[0;36mFetching Lambda function name...\033[0m"
FUNCTION_NAME=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  ${PROFILE_ARGS[@]+"${PROFILE_ARGS[@]}"} \
  --query "Stacks[0].Outputs[?OutputKey=='CinemaApiLambdaName'].OutputValue" \
  --output text)

if [[ -f "$ZIP_FILE" ]]; then
  echo -e "\033[0;36mUpdating Lambda function code for $FUNCTION_NAME...\033[0m"
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://$ZIP_FILE" \
    --region "$REGION" \
    ${PROFILE_ARGS[@]+"${PROFILE_ARGS[@]}"} > /dev/null
fi

echo -e "\033[0;32mCinema Manager API deployed successfully\033[0m"
