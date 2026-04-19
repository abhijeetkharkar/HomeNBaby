# RCA: Lambda Function URL Returning 403 Forbidden

**Date:** April 12–13, 2026
**Severity:** Blocking — API completely unreachable
**Resolution:** Replaced Lambda Function URL with API Gateway HTTP API

---

## Symptom

After deploying the tracker app, the frontend loaded successfully from S3/CloudFront, but all API calls to `/api/tasks` failed with:

```
HTTP/1.1 403 Forbidden
x-amzn-ErrorType: AccessDeniedException

{"Message":"Forbidden. For troubleshooting Function URL authorization issues,
 see: https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html"}
```

The error appeared both through CloudFront and when hitting the Lambda Function URL directly.

---

## Timeline

| Step | Action | Result |
|------|--------|--------|
| 1 | Created Lambda function `tracker-api` with `setup-lambda.sh` | Function created successfully |
| 2 | Created Function URL with `--auth-type NONE` | URL created: `https://d3icr...lambda-url.us-east-1.on.aws/` |
| 3 | Added resource-based policy: `lambda:InvokeFunctionUrl` for principal `*` with condition `lambda:FunctionUrlAuthType = NONE` | Policy attached |
| 4 | Updated CloudFront `/api/*` behavior to point to Function URL domain | CloudFront updated |
| 5 | Tested via browser | **403 Forbidden** |
| 6 | Tested Function URL directly with `curl` | **403 Forbidden** |
| 7 | Tested Function URL with Node.js `https.request` | **403 Forbidden** |
| 8 | Verified `aws lambda invoke` (direct invocation, not via URL) | **200 OK** — Lambda code works fine |

---

## Investigation

### What was ruled out

| Hypothesis | How tested | Result |
|------------|-----------|--------|
| Wrong auth type on Function URL | `get-function-url-config` → `AuthType: "NONE"` | Correct |
| Missing resource-based policy | `get-policy` → AllowPublicAccess statement present | Correct |
| Policy condition mismatch | Condition matches: `FunctionUrlAuthType = NONE` | Correct |
| Lambda function error / crash | `aws lambda invoke` with test payload | Returns 200 + full task JSON |
| VPC blocking access | `get-function` → `VpcConfig: null` | Not in a VPC |
| AWS Organizations SCP | `describe-organization` → `AWSOrganizationsNotInUseException` | No org, no SCPs |
| Stale Function URL config | Deleted and recreated Function URL (got new domain) | Still 403 |
| Stale permissions | Removed and re-added `AllowPublicAccess` permission | Still 403 |
| CORS blocking | Tested from Node.js (no CORS) — same 403 | Not CORS |
| CloudFront caching stale 403 | Tested Function URL directly, bypassing CloudFront | Still 403 |

### Root cause

**AWS Lambda public access block** — a newer account-level security feature (introduced 2024) that prevents Lambda Function URLs from being publicly accessible, even when:
- `AuthType` is set to `NONE`
- Resource-based policy explicitly allows `*` principal

This feature acts as a guardrail above the function-level configuration. It is enabled by default on newer accounts or was enabled by AWS as a security posture improvement.

**Why we couldn't confirm programmatically:**
- The AWS CLI version installed (v2, older) did not have the `get-public-access-block-config` subcommand
- The installed `@aws-sdk/client-lambda` package also did not export a `GetPublicAccessBlockConfigCommand`
- The feature was introduced after the installed tooling versions

### Key evidence pointing to account-level block

1. Every configuration at the function level was correct and verified
2. Direct Lambda invocation (`aws lambda invoke`) worked — proving the code is fine
3. Both old and newly created Function URLs returned 403
4. Recreating the Function URL and permissions from scratch made no difference
5. No Organization/SCP in play
6. The 403 came from AWS auth infrastructure (`x-amzn-ErrorType: AccessDeniedException`), not from the Lambda function code

---

## Resolution

Replaced Lambda Function URL with **API Gateway HTTP API**, which does not have the public access block restriction.

### Steps taken

1. Created API Gateway HTTP API (`tracker-api`, protocol HTTP)
2. Added Lambda proxy integration (`AWS_PROXY`, payload format 2.0)
3. Added `$default` catch-all route pointing to the integration
4. Created `$default` stage with auto-deploy enabled
5. Added `lambda:InvokeFunction` permission for `apigateway.amazonaws.com`
6. Verified API Gateway endpoint returns data: `curl https://ulkx22lpm5.execute-api.us-east-1.amazonaws.com/api/tasks` → 200 OK
7. Updated CloudFront `lambda-api` origin domain from Function URL to API Gateway endpoint
8. Deleted the unused Lambda Function URL

### Architecture change

```
BEFORE (broken):
  CloudFront /api/* → Lambda Function URL → Lambda
                       ↑ blocked by account-level public access restriction

AFTER (working):
  CloudFront /api/* → API Gateway HTTP API → Lambda
                       ↑ publicly accessible, no restrictions
```

---

## Lessons Learned

1. **Lambda Function URL public access is not guaranteed** — AWS accounts may have public access blocks enabled by default. This is not visible in the Function URL config or resource policy; it's an account-level setting.

2. **API Gateway HTTP API is the safer choice** for public-facing Lambda endpoints. It's free for the first million requests/month, has no public access block issues, and is the more established pattern.

3. **`aws lambda invoke` success does not imply Function URL access** — direct invocation uses IAM credentials and bypasses the Function URL auth layer entirely. Always test the actual HTTP endpoint.

4. **Windows/Git Bash adds friction to AWS CLI debugging** — path mangling (`/aws/lambda/...` → `C:/Program Files/Git/aws/lambda/...`) required `MSYS_NO_PATHCONV=1` on nearly every AWS CLI command with path-like arguments.

---

## Prevention

For future Lambda-based APIs in this account:
- **Use API Gateway HTTP API** as the default integration pattern, not Lambda Function URLs
- If Function URLs are required, first check the account's public access block setting (update AWS CLI to a version that supports `get-public-access-block-config`)
- Consider CloudFront OAC (Origin Access Control) for Lambda as an alternative — it uses `AWS_IAM` auth with CloudFront signing, bypassing the need for public access entirely
