/**
 * scripts/seed-names.js
 * Seeds the tracker-baby-names DynamoDB table with all 500 Sanskrit names.
 * Run: node scripts/seed-names.js
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { fromIni } = require('@aws-sdk/credential-provider-ini');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TABLE_NAME = 'tracker-baby-names';
const REGION = 'us-east-1';

// Load names by evaluating the TypeScript source as JS (values are plain JS literals)
const tsSource = fs.readFileSync(
  path.join(__dirname, '../src/data/sanskritNames.ts'), 'utf8'
);

// Strip TypeScript-specific syntax so Node's eval can handle it
const jsSource = tsSource
  .replace(/import type[^\n]+\n/g, '')           // remove type imports
  .replace(/export const /, 'const ')             // remove export keyword
  .replace(/:\s*Omit<[^>]+>\[\]/, '')             // remove Omit<...>[] type
  .replace(/:\s*BabyName\[\]/, '')                // fallback: remove BabyName[] type
  .replace(/ as const/g, '');                     // remove inline as const

// Evaluate in a sandbox, extract the array
const sandbox = { result: null };
try {
  vm.runInNewContext(jsSource + '\nresult = SANSKRIT_NAMES;', sandbox);
} catch (e) {
  console.error('Eval failed:', e.message.substring(0, 300));
  process.exit(1);
}

const names = sandbox.result;
console.log(`Loaded ${names.length} names from source file`);

// Add favourite: false to every name (initial state)
const items = names.map((n) => ({ ...n, favourite: false }));

const client = new DynamoDBClient({
  region: REGION,
  credentials: fromIni({ profile: 'admin' }),
});
const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

async function seedNames() {
  const existing = await ddb.send(new ScanCommand({ TableName: TABLE_NAME, Select: 'COUNT' }));
  if ((existing.Count || 0) > 0) {
    console.log(`Table already has ${existing.Count} items. Skipping seed.`);
    console.log('To re-seed, delete all items first.');
    return;
  }

  // BatchWrite in chunks of 25 (DynamoDB limit)
  const chunks = [];
  for (let i = 0; i < items.length; i += 25) chunks.push(items.slice(i, i + 25));

  let written = 0;
  for (const chunk of chunks) {
    await ddb.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: chunk.map((item) => ({ PutRequest: { Item: item } })),
      },
    }));
    written += chunk.length;
    process.stdout.write(`\rWritten: ${written}/${items.length}`);
  }
  console.log('\nSeed complete!');
}

seedNames().catch((err) => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});
