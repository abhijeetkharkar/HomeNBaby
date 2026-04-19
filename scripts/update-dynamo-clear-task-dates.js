/**
 * scripts/update-dynamo-clear-task-dates.js
 * 
 * For tasks whose subtasks have `due` dates, clear the task-level target_date.
 * This is a non-destructive update — only touches target_date, preserves everything else.
 *
 * Usage: node scripts/update-dynamo-clear-task-dates.js [--dry-run]
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { fromIni } = require('@aws-sdk/credential-provider-ini');

const TABLE_NAME = 'tracker-tasks';
const REGION = 'us-east-1';

const client = new DynamoDBClient({
  region: REGION,
  credentials: fromIni({ profile: 'admin' }),
});
const ddb = DynamoDBDocumentClient.from(client);

const dryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(dryRun ? '\n=== DRY RUN ===' : '\n=== Updating DynamoDB ===');
  console.log('Clearing target_date for tasks whose subtasks have due dates\n');

  const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
  const tasks = result.Items || [];

  let updated = 0;
  for (const task of tasks) {
    const subtasks = task.subtasks || [];
    const subtasksHaveDates = subtasks.some(
      (s) => s.due || (s.items && s.items.some((i) => i.due))
    );

    if (subtasksHaveDates && task.target_date) {
      if (dryRun) {
        console.log(`  [DRY] Would clear target_date for: "${task.task}" (was ${task.target_date})`);
      } else {
        await ddb.send(new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { id: task.id },
          UpdateExpression: 'REMOVE target_date',
        }));
        console.log(`  ✓ Cleared target_date for: "${task.task}" (was ${task.target_date})`);
      }
      updated++;
    }
  }

  console.log(`\n${dryRun ? 'Would update' : 'Updated'} ${updated} of ${tasks.length} tasks\n`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
