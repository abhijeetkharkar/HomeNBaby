const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { fromIni } = require('@aws-sdk/credential-provider-ini');

const client = new DynamoDBClient({
  region: 'us-east-1',
  credentials: fromIni({ profile: 'admin' }),
});
const ddb = DynamoDBDocumentClient.from(client);
const TABLE = 'tracker-baby-logs';

async function checkDate(date) {
  const result = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: '#d = :date',
    ExpressionAttributeNames: { '#d': 'date' },
    ExpressionAttributeValues: { ':date': date },
  }));

  const sleepLogs = (result.Items || []).filter(l => l.category === 'sleep');
  console.log(`\n=== Sleep logs for ${date} (${sleepLogs.length} entries) ===`);
  let total = 0;
  for (const log of sleepLogs) {
    const crossesMidnight = log.startTime && log.endTime && log.endTime < log.startTime;
    console.log(`  startTime=${log.startTime} endTime=${log.endTime} durationMin=${log.durationMin} crossesMidnight=${crossesMidnight} logId=${log.logId}`);
    total += (log.durationMin || 0);
  }
  console.log(`  TOTAL durationMin in DB: ${total} (${(total/60).toFixed(1)}h)`);
}

async function main() {
  // Usage: node check-sleep.js 2026-07-31
  // Without args: checks yesterday, today, tomorrow
  const args = process.argv.slice(2);
  if (args.length > 0) {
    // Check the given date ± 1 day for context
    const center = new Date(args[0] + 'T12:00:00');
    const prev = new Date(center); prev.setDate(prev.getDate() - 1);
    const next = new Date(center); next.setDate(next.getDate() + 1);
    await checkDate(prev.toISOString().split('T')[0]);
    await checkDate(center.toISOString().split('T')[0]);
    await checkDate(next.toISOString().split('T')[0]);
  } else {
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    await checkDate(yesterday.toISOString().split('T')[0]);
    await checkDate(today.toISOString().split('T')[0]);
    await checkDate(tomorrow.toISOString().split('T')[0]);
  }
}

main().catch(console.error);
