# CLAUDE.md — Home & Baby Tracker

## What this project is

A task-tracking web app for two concurrent life events: moving to a 3BHK (June 1, 2026) and having a baby (due July 13, 2026) in Texas. Categories: Admin, Garden, Baby, Hospital, Timeline.

**Live:** https://tracker.abhijeetkharkar.com

## Tech stack

- **Frontend:** React 18 + TypeScript + Material UI, built with Vite
- **Backend:** Express.js + SQLite3, wrapped by `serverless-http` for Lambda
- **Infra:** AWS — CloudFront + S3 (frontend), API Gateway HTTP API + Lambda (backend), Route 53, ACM

## Project structure

```
HomeNBaby/
├── src/                          # React frontend (TypeScript)
│   ├── api/tasks.ts              #   API calls: GET /api/tasks, POST /api/tasks/toggle
│   ├── App.tsx                   #   Root component — tab navigation across categories
│   ├── components/
│   │   ├── layout/Header.tsx     #   Top bar with countdown badges
│   │   ├── tasks/                #   TaskCard, SubtaskRow, NestedItemRow
│   │   └── views/                #   CategoryView (checklist), TimetableView (timeline)
│   ├── hooks/useTasks.ts         #   Data fetching + toggle hook
│   ├── theme/index.ts            #   MUI theme customisation
│   └── types/index.ts            #   TypeScript interfaces
├── server.js                     # Express API + all task seed data
│                                 #   - Seeds SQLite on every start (DROP + INSERT)
│                                 #   - Routes: GET /api/tasks, POST /api/tasks/toggle
│                                 #   - Static files + SPA fallback only when running locally
│                                 #   - DB path: /tmp/tasks.db on Lambda, ./tasks.db locally
├── lambda.js                     # Lambda handler — serverless(app)
├── vite.config.ts                # Builds to public/ (not dist/), proxy /api to :3000
├── index.html                    # Vite entry point
├── scripts/
│   ├── setup.sh                  # One-time: S3, CloudFront, Route 53, ACM
│   ├── setup-lambda.sh           # One-time: IAM role, Lambda, API Gateway, CF /api/* behavior
│   ├── deploy.sh                 # Repeatable: build + push frontend (S3) and backend (Lambda)
│   ├── make-lambda-zip.js        # Cross-platform Lambda zip (archiver, linux/x64 sqlite3)
│   ├── update-cloudfront.js      # Adds lambda-api origin + /api/* behavior to CloudFront
│   └── fix-origin.js             # Updates an existing CF origin domain (one-off fix script)
└── docs/
    ├── architecture.md           # Full architecture diagram and infrastructure reference
    └── rca-lambda-function-url-403.md  # RCA for the Function URL 403 issue
```

## Architecture (quick reference)

```
tracker.abhijeetkharkar.com
  /*       → CloudFront → S3 bucket (React SPA)
  /api/*   → CloudFront → API Gateway HTTP API (ulkx22lpm5) → Lambda (tracker-api)
```

## How to run locally

```bash
npm install
npm run dev          # Starts Express on :3000 + Vite on :5173 (proxy /api → :3000)
```

Open http://localhost:5173

## How to deploy

All scripts must be run from **Git Bash** on Windows (not PowerShell, not CMD).

### Prerequisites

- Node.js 20+ and npm
- AWS CLI v2 configured with the `admin` profile (`aws configure --profile admin`)
- Git Bash (ships with Git for Windows)
- npm dependencies installed (`npm install`)

### First-time setup (new AWS account / new subdomain)

Run these two scripts **once, in order**. They create all AWS infrastructure from scratch.

**Step 1 — Frontend infrastructure** (S3 bucket, CloudFront distribution, Route 53 alias, ACM cert):

```bash
bash scripts/setup.sh
```

What it does:
1. Creates S3 bucket `tracker.abhijeetkharkar.com`
2. Finds the existing `*.abhijeetkharkar.com` ACM wildcard cert
3. Creates a CloudFront distribution with OAC for S3
4. Adds a Route 53 A-record alias pointing the subdomain to CloudFront

Output: prints the CloudFront Distribution ID (e.g. `E2C4ZYW75CTXZT`). Copy this.

**Step 2 — Backend infrastructure** (IAM role, Lambda function, API Gateway, CloudFront /api/* behavior):

```bash
# First: open scripts/setup-lambda.sh and paste the CloudFront ID from Step 1
# into the CLOUDFRONT_ID variable at the top of the file.

bash scripts/setup-lambda.sh
```

What it does:
1. Installs `serverless-http` dependency
2. Creates IAM execution role `tracker-lambda-role`
3. Builds Lambda zip with linux/x64 sqlite3 binary (`make-lambda-zip.js`)
4. Creates Lambda function `tracker-api` (nodejs20.x, 256 MB, 15s timeout)
5. Creates API Gateway HTTP API with `$default` route → Lambda proxy integration
6. Grants API Gateway permission to invoke Lambda
7. Adds `lambda-api` origin + `/api/*` cache behavior to the CloudFront distribution

After this completes, wait 5–10 minutes for CloudFront to propagate.

### Regular deployment (after code changes)

```bash
bash scripts/deploy.sh
```

What it does:
1. `npm run build` — Vite builds React app to `public/`
2. `aws s3 sync public/ s3://tracker.abhijeetkharkar.com/` — uploads hashed assets with `immutable` cache headers, deletes stale files
3. `aws s3 cp public/index.html` — uploads index.html separately with `no-cache` headers (always fresh)
4. `aws cloudfront create-invalidation /index.html` — purges CloudFront edge cache for the HTML
5. `node scripts/make-lambda-zip.js` — builds Lambda deployment zip (copies `server.js`, `lambda.js`, `package.json`, installs production deps with linux/x64 sqlite3)
6. `aws lambda update-function-code` — pushes new zip to Lambda

Frontend changes are live in ~15 seconds (after CloudFront invalidation). Lambda changes are live immediately.

### Deployment configuration

All three scripts have configuration variables at the top:

| Variable               | File                | Value                          |
|------------------------|---------------------|--------------------------------|
| `PROFILE`              | All scripts         | `admin`                        |
| `CLOUDFRONT_ID`        | `setup-lambda.sh`, `deploy.sh` | `E2C4ZYW75CTXZT`    |
| `LAMBDA_FUNCTION_NAME` | `deploy.sh`         | `tracker-api`                  |
| `BUCKET`               | `deploy.sh`         | `tracker.abhijeetkharkar.com`  |
| `REGION`               | All scripts         | `us-east-1`                    |

### Troubleshooting deployment

- **`Invalid invalidation paths`** — Git Bash mangles `/index.html` into a Windows path. Fix: prefix the `aws cloudfront create-invalidation` command with `MSYS_NO_PATHCONV=1` (already done in `deploy.sh`).
- **`archiver not found`** — Run `npm install` in the project root. `archiver` is a devDependency used by `make-lambda-zip.js`.
- **Lambda returns old data after deploy** — Lambda code updates are instant, but if the function is warm it may still serve from the old instance for a few minutes. Invoke `aws lambda update-function-configuration --function-name tracker-api --region us-east-1 --profile admin --description "redeploy $(date)"` to force a cold start.
- **CloudFront still serves old frontend** — The invalidation only covers `/index.html`. Hashed asset filenames change on rebuild, so browsers fetch the new ones automatically. If stuck, run: `MSYS_NO_PATHCONV=1 aws cloudfront create-invalidation --distribution-id E2C4ZYW75CTXZT --profile admin --paths "/*"`

## Key conventions

- **All task data lives in `server.js`** as seed data. The DB is recreated on every server/Lambda start. There is no persistent state — checkbox toggles reset on Lambda cold starts.
- **Vite builds to `public/`**, not `dist/`. The `outDir` is set in `vite.config.ts`. The `.gitignore` excludes `public/`.
- **Frontend API calls use relative paths** (`/api/tasks`, not a full URL). Vite dev server proxies these to Express locally; CloudFront routes them to API Gateway in prod.
- **Windows/Git Bash is the dev environment.** All bash scripts use `MSYS_NO_PATHCONV=1` before AWS CLI commands that contain `/` paths to prevent Git Bash MSYS path mangling. Node.js scripts are preferred over shell-piped JSON manipulation to avoid path/escaping issues.
- **AWS profile is `admin`** for all CLI and SDK calls.
- **Lambda zip cross-compiles sqlite3** for linux/x64 using `npm_config_platform=linux npm_config_arch=x64` in `make-lambda-zip.js`.

## AWS resources

| Resource                | ID / Value                        |
|-------------------------|-----------------------------------|
| CloudFront Distribution | E2C4ZYW75CTXZT                    |
| S3 Bucket               | tracker.abhijeetkharkar.com       |
| Lambda Function         | tracker-api                       |
| API Gateway HTTP API    | ulkx22lpm5                        |
| Route 53 Hosted Zone    | Z13Z70GHALBE08                    |
| ACM Cert                | *.abhijeetkharkar.com (existing)  |
| IAM Role                | tracker-lambda-role               |
| Region                  | us-east-1                         |
| AWS CLI Profile         | admin                             |

## Things to watch out for

- **Do not use Lambda Function URLs in this account** — account-level public access block silently returns 403 even with `AuthType: NONE` and correct resource policies. Use API Gateway HTTP API instead. See `docs/rca-lambda-function-url-403.md` for full details.
- **`public/` is a build artifact**, not source. Don't edit files there; edit `src/` and rebuild.
- **SQLite is ephemeral on Lambda.** Task completion state does not persist across cold starts. All data reseeds from `server.js`.
- **CloudFront propagation takes 5–10 minutes** after config changes. Don't panic if changes aren't immediate.
