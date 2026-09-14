#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-prod}"
REGION="${2:-us-east-1}"
PROFILE="${3:-admin}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_NAME="cinema-manager-agent-stack-$ENVIRONMENT"
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

echo -e "\033[0;32mCinema Manager Agent infrastructure deployed successfully\033[0m"
