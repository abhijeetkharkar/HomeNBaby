# Home & Baby Tracker — Architecture & Infrastructure

## Overview

A task-tracking app for two concurrent life events: moving to a 3BHK (June 1, 2026) and having a baby (due July 13, 2026) in Texas. Categories include Admin, Garden, Baby, Hospital, and Timeline.

**Live URL:** https://tracker.abhijeetkharkar.com

---

## Tech Stack

| Layer      | Technology                                  |
|------------|---------------------------------------------|
| Frontend   | React 18 + TypeScript + Material UI (Vite)  |
| Backend    | Express.js + SQLite3                        |
| Hosting    | AWS CloudFront + S3 (frontend)              |
| API        | AWS API Gateway HTTP API + Lambda (backend) |
| DNS        | Route 53                                    |
| TLS        | ACM wildcard cert `*.abhijeetkharkar.com`   |

---

## Architecture Diagram

```
                        ┌──────────────────────────────────┐
                        │         Route 53 (DNS)           │
                        │  tracker.abhijeetkharkar.com     │
                        │  → Alias to CloudFront           │
                        └──────────────┬───────────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────────┐
                        │     CloudFront Distribution       │
                        │        E2C4ZYW75CTXZT            │
                        │                                  │
                        │  ACM: *.abhijeetkharkar.com      │
                        │                                  │
                        │  Behaviors:                      │
                        │  ┌────────────┬────────────────┐ │
                        │  │ Path       │ Origin         │ │
                        │  ├────────────┼────────────────┤ │
                        │  │ /api/*     │ lambda-api     │ │
                        │  │ /* (default)│ S3 bucket     │ │
                        │  └────────────┴────────────────┘ │
                        └─────────┬──────────────┬─────────┘
                                  │              │
                    ┌─────────────┘              └──────────────┐
                    ▼                                           ▼
     ┌──────────────────────────┐            ┌─────────────────────────────┐
     │   S3 Bucket (Frontend)   │            │  API Gateway HTTP API       │
     │                          │            │  (ulkx22lpm5)               │
     │  tracker.abhijeetkharkar │            │                             │
     │  .com                    │            │  $default route → Lambda    │
     │                          │            └──────────────┬──────────────┘
     │  - index.html (no-cache) │                           │
     │  - assets/* (immutable,  │                           ▼
     │    Vite-hashed)          │            ┌─────────────────────────────┐
     └──────────────────────────┘            │  Lambda: tracker-api        │
                                             │  Runtime: nodejs20.x        │
                                             │  Handler: lambda.handler    │
                                             │  Memory: 256 MB             │
                                             │  Timeout: 15s               │
                                             │                             │
                                             │  serverless-http wraps      │
                                             │  Express app (server.js)    │
                                             │                             │
                                             │  SQLite DB at /tmp/tasks.db │
                                             │  (ephemeral per invocation  │
                                             │   cold start)               │
                                             └─────────────────────────────┘
```

---

## Request Flow

### Frontend (static assets)
```
Browser → tracker.abhijeetkharkar.com/* → CloudFront → S3 bucket
```
- `index.html` served with `Cache-Control: no-cache` (always fresh)
- All other assets (JS/CSS) served with `max-age=31536000,immutable` (Vite content-hashes filenames)

### API calls
```
Browser → tracker.abhijeetkharkar.com/api/* → CloudFront → API Gateway HTTP API → Lambda → Express → SQLite
```
- CloudFront `/api/*` behavior forwards to API Gateway origin
- CachePolicy: `CachingDisabled` (4135ea2d-6df8-44a3-9df3-4b5a84be39ad)
- OriginRequestPolicy: `AllViewerExceptHostHeader` (b689b0a8-53d0-40ab-baf2-68738e2966ac)
- All HTTP methods allowed (GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE)

---

## Project Structure

```
HomeNBaby/
├── src/                        # React frontend (TypeScript)
│   ├── api/tasks.ts            #   fetch/save tasks via /api/tasks
│   ├── App.tsx                 #   main app with tab navigation
│   ├── components/
│   │   ├── layout/Header.tsx
│   │   ├── tasks/              #   TaskCard, SubtaskRow, NestedItemRow
│   │   └── views/              #   CategoryView, TimetableView
│   ├── hooks/useTasks.ts       #   data fetching hook
│   ├── theme/index.ts          #   MUI theme
│   └── types/index.ts          #   TypeScript interfaces
├── server.js                   # Express API (serves both local & Lambda)
├── lambda.js                   # Lambda entry point (wraps Express via serverless-http)
├── vite.config.ts              # Vite config (builds to public/)
├── package.json
├── tasks.db                    # Local SQLite database
├── scripts/
│   ├── setup.sh                # One-time: S3 bucket, CloudFront, Route 53, ACM
│   ├── setup-lambda.sh         # One-time: IAM role, Lambda function, API Gateway, CloudFront /api/* behavior
│   ├── deploy.sh               # Repeatable: build frontend → S3, build Lambda → update function code
│   ├── make-lambda-zip.js      # Cross-platform Lambda zip builder (archiver + linux/x64 sqlite3)
│   ├── update-cloudfront.js    # Adds lambda-api origin + /api/* behavior to CloudFront
│   └── fix-origin.js           # Updates an existing CloudFront origin's domain
└── docs/
    └── architecture.md         # This file
```

---

## Deployment Scripts

### One-time setup

| Script                    | Purpose                                                       |
|---------------------------|---------------------------------------------------------------|
| `scripts/setup.sh`        | Creates S3 bucket, OAC, CloudFront distribution, Route 53 alias, finds ACM cert |
| `scripts/setup-lambda.sh` | Creates IAM role, Lambda function, API Gateway HTTP API, adds /api/* CloudFront behavior |

### Regular deployment

```bash
bash scripts/deploy.sh
```

Steps:
1. `npm run build` — Vite builds React to `public/`
2. `aws s3 sync` — uploads hashed assets with immutable cache headers
3. `aws s3 cp` — uploads `index.html` with no-cache headers
4. `aws cloudfront create-invalidation` — invalidates `/index.html`
5. `node scripts/make-lambda-zip.js` — builds Lambda zip with linux/x64 sqlite3
6. `aws lambda update-function-code` — pushes new code to Lambda

### Cross-platform notes

All scripts are designed for **Git Bash on Windows**:
- `MSYS_NO_PATHCONV=1` prefix on AWS CLI commands with `/` paths (Git Bash mangles them)
- `archiver` npm package for zipping (no `zip` command on Windows)
- `npm_config_platform=linux npm_config_arch=x64` for cross-compiling sqlite3 native module
- Node.js AWS SDK scripts replace shell-piped JSON manipulation (avoids path/escaping issues)

---

## AWS Resources

| Resource                     | ID / Name                                    |
|------------------------------|----------------------------------------------|
| AWS Account                  | 797884421713                                 |
| AWS CLI Profile              | `admin`                                      |
| Region                       | us-east-1                                    |
| S3 Bucket                    | tracker.abhijeetkharkar.com                  |
| CloudFront Distribution      | E2C4ZYW75CTXZT                               |
| ACM Certificate              | `*.abhijeetkharkar.com` (existing, ISSUED)   |
| Route 53 Hosted Zone         | Z13Z70GHALBE08                               |
| Lambda Function              | tracker-api                                  |
| Lambda IAM Role              | tracker-lambda-role                          |
| API Gateway HTTP API         | ulkx22lpm5                                   |
| API Gateway Endpoint         | https://ulkx22lpm5.execute-api.us-east-1.amazonaws.com |

---

## Known Limitation

**SQLite on Lambda is ephemeral.** The database lives at `/tmp/tasks.db` and is recreated on every cold start. `server.js` seeds all tasks on startup via `DROP TABLE IF EXISTS` + `INSERT`. This means:
- Task completion state (checkboxes) resets on cold starts
- No persistent user data across Lambda invocations
- Acceptable for now since all task definitions are hardcoded in `server.js`

To make state persistent, migrate to DynamoDB or RDS in the future.
