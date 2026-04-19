# 🏠👶 HomeNBaby Tracker

An interactive checklist app for tracking moving and baby preparation tasks. Built for a move date of **June 1, 2026** and baby due **July 13, 2026**.

**Live:** [tracker.abhijeetkharkar.com](https://tracker.abhijeetkharkar.com)

## Features

- **Category views** — Tasks organized into Admin, Garden, Baby, and Hospital categories
- **Timetable view** — Week-by-week timeline of upcoming tasks
- **Subtask tracking** — Nested subtasks and items with individual due dates and progress bars
- **Owner assignment** — Assign tasks/subtasks to Abhijeet or Prajakta
- **Overdue detection** — Highlights overdue items based on subtask due dates
- **Dynamic summaries** — Each task card shows remaining subtasks at a glance

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Material UI, Vite |
| Backend | Express.js + serverless-http (AWS Lambda) |
| Database | Amazon DynamoDB (`tracker-tasks` table) |
| Hosting | CloudFront + S3 (frontend), API Gateway + Lambda (backend) |
| Region | us-east-1 |

## Local Development

```bash
# Install dependencies
npm install

# Run frontend + backend concurrently
npm run dev

# Or separately
npm run dev:server   # Express API on :3001
npm run dev:client   # Vite dev server on :5173
```

> **Note:** Local backend requires AWS credentials with DynamoDB access (uses `admin` profile from `~/.aws/credentials`).

## Deployment

```bash
# Full deploy (frontend + backend)
bash scripts/deploy.sh

# Frontend only (S3 + CloudFront invalidation)
bash scripts/deploy-frontend.sh

# Backend only (Lambda function update)
bash scripts/deploy-backend.sh
```

## Project Structure

```
├── server.js              # Express API (DynamoDB-backed)
├── lambda.js              # Lambda handler (serverless-http wrapper)
├── src/
│   ├── App.tsx            # Main app with tab navigation
│   ├── components/
│   │   ├── views/         # CategoryView, TimetableView
│   │   ├── tasks/         # TaskCard, SubtaskRow, NestedItemRow, DateBadge
│   │   └── layout/        # Header
│   ├── hooks/useTasks.ts  # Data fetching & mutations
│   ├── types/index.ts     # TypeScript interfaces
│   └── api/tasks.ts       # API client
├── scripts/
│   ├── deploy.sh          # Full deploy orchestrator
│   ├── deploy-frontend.sh # S3 sync + CloudFront invalidation
│   ├── deploy-backend.sh  # Lambda zip + update
│   ├── seed-dynamo.js     # Seed DynamoDB from initial data
│   └── setup-dynamodb.sh  # Create DynamoDB table + IAM policy
└── docs/
    └── architecture.md    # Architecture documentation
```
