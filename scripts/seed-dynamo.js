/**
 * scripts/seed-dynamo.js — Seed DynamoDB table with all task data.
 *
 * Extracts the initialTasks array from server.js (the sqlite version)
 * and writes them into the DynamoDB tracker-tasks table.
 *
 * Usage: node scripts/seed-dynamo.js [--clear]
 *   --clear   Delete all existing items before seeding
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');
const fs = require('fs');
const path = require('path');

const TABLE_NAME = 'tracker-tasks';
const REGION = 'us-east-1';

// Use admin profile credentials
const client = new DynamoDBClient({
  region: REGION,
  // AWS SDK picks up ~/.aws/credentials — profile selection via AWS_PROFILE env var
});
const ddb = DynamoDBDocumentClient.from(client);

// ─── Extract seed data from server.js ────────────────────────────────────────
function extractSeedData() {
  const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

  // Find the initialTasks array — it starts after "const initialTasks = [" and ends before "];"
  const startMarker = 'const initialTasks = [';
  const startIdx = serverSrc.indexOf(startMarker);
  if (startIdx === -1) throw new Error('Could not find initialTasks in server.js');

  // Find the matching closing bracket — count nesting
  let depth = 0;
  let endIdx = -1;
  for (let i = startIdx + startMarker.length - 1; i < serverSrc.length; i++) {
    if (serverSrc[i] === '[') depth++;
    if (serverSrc[i] === ']') {
      depth--;
      if (depth === 0) { endIdx = i; break; }
    }
  }
  if (endIdx === -1) throw new Error('Could not find end of initialTasks array');

  const arrayStr = serverSrc.substring(startIdx + startMarker.length - 1, endIdx + 1);

  // The array contains JSON.stringify(...) calls for subtasks.
  // We need to remove JSON.stringify() wrappers so eval gives us parsed objects.
  // Find each JSON.stringify( and its matching ) by counting parens.
  let evalStr = arrayStr;
  while (true) {
    const marker = 'JSON.stringify(';
    const pos = evalStr.indexOf(marker);
    if (pos === -1) break;
    // Find matching closing paren
    let depth = 0;
    let end = -1;
    for (let i = pos + marker.length - 1; i < evalStr.length; i++) {
      if (evalStr[i] === '(') depth++;
      if (evalStr[i] === ')') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) throw new Error('Unmatched JSON.stringify paren');
    // Remove "JSON.stringify(" and the matching ")"
    evalStr = evalStr.substring(0, pos) + evalStr.substring(pos + marker.length, end) + evalStr.substring(end + 1);
  }

  const fn = new Function('return ' + evalStr + ';');
  const tasks = fn();
  return tasks;
}

// ─── Clear table ─────────────────────────────────────────────────────────────
async function clearTable() {
  console.log('  Clearing existing items...');
  let lastKey;
  let deleted = 0;
  do {
    const scan = await ddb.send(new ScanCommand({
      TableName: TABLE_NAME,
      ProjectionExpression: 'id',
      ExclusiveStartKey: lastKey,
    }));
    if (scan.Items && scan.Items.length > 0) {
      for (const item of scan.Items) {
        await ddb.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { id: item.id } }));
        deleted++;
      }
    }
    lastKey = scan.LastEvaluatedKey;
  } while (lastKey);
  console.log(`  Deleted ${deleted} items`);
}

// ─── Seed table ──────────────────────────────────────────────────────────────
async function seedTable(tasks) {
  console.log(`  Writing ${tasks.length} tasks...`);

  // BatchWriteItem supports max 25 items per call
  const batches = [];
  for (let i = 0; i < tasks.length; i += 25) {
    batches.push(tasks.slice(i, i + 25));
  }

  for (const batch of batches) {
    const putRequests = batch.map((t, idx) => ({
      PutRequest: {
        Item: {
          id: tasks.indexOf(t) + 1, // 1-based like SQLite autoincrement
          category: t.category,
          section: t.section,
          task: t.task,
          description: t.description,
          subtasks: t.subtasks, // stored as native list/map — no JSON.stringify needed
          target_date: t.target_date,
          target_month: t.target_month,
          completed: 0,
          completed_at: null,
          owner: t.owner || null,
        },
      },
    }));

    await ddb.send(new BatchWriteCommand({
      RequestItems: { [TABLE_NAME]: putRequests },
    }));
  }
  console.log(`  ✓ ${tasks.length} tasks seeded`);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const doClear = process.argv.includes('--clear');

  console.log('');
  console.log('=== Seeding DynamoDB table: ' + TABLE_NAME + ' ===');
  console.log('');

  if (doClear) {
    await clearTable();
  }

  const tasks = extractSeedData();
  console.log(`  Extracted ${tasks.length} tasks from server.js`);

  await seedTable(tasks);

  console.log('');
  console.log('✅ Seed complete!');
  console.log('');
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
