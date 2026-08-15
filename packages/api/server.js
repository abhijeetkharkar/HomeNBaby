const express = require('express');
const cors = require('cors');
const path = require('path');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  DeleteCommand,
  BatchWriteCommand
} = require('@aws-sdk/lib-dynamodb');

const app = express();
const port = 3000;
const TRACKER_TABLE = process.env.TRACKER_TABLE_NAME || 'tracker-baby-logs';
const PLANTS_TABLE = process.env.PLANTS_TABLE_NAME || 'plants-care-logs';
const REGION = 'us-east-1';

app.use(express.json());
app.use(cors({
    origin: [/abhijeetkharkar\.com$/, /localhost/]
}));// Static files + SPA fallback — local only (CloudFront + S3 handles this in prod)
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    app.use(express.static('public'));
}

// DynamoDB client — locally uses 'admin' profile; on Lambda uses IAM role
const clientConfig = { region: REGION };
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const { fromIni } = require('@aws-sdk/credential-provider-ini');
    clientConfig.credentials = fromIni({ profile: 'admin' });
}
const client = new DynamoDBClient(clientConfig);
const ddb = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
});

// Helper function to get dates between two dates
function getDatesInRange(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

// ─── GET /api/logs?from=YYYY-MM-DD&to=YYYY-MM-DD ─────────────────────────────
app.get('/tracker/logs', async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) return res.status(400).json({ error: 'from and to dates are required' });

        const dates = getDatesInRange(from, to);
        const promises = dates.map(date => 
            ddb.send(new QueryCommand({
                TableName: TRACKER_TABLE,
                KeyConditionExpression: '#d = :date',
                ExpressionAttributeNames: { '#d': 'date' },
                ExpressionAttributeValues: { ':date': date }
            }))
        );

        const results = await Promise.all(promises);
        const logs = results.flatMap(r => r.Items || []);
        
        // Sort by date then logId
        logs.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.logId.localeCompare(b.logId);
        });

        res.json(logs);
    } catch (err) {
        console.error('GET /api/logs error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/logs/:date ─────────────────────────────────────────────────────
app.get('/tracker/logs/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const result = await ddb.send(new QueryCommand({
            TableName: TRACKER_TABLE,
            KeyConditionExpression: '#d = :date',
            ExpressionAttributeNames: { '#d': 'date' },
            ExpressionAttributeValues: { ':date': date }
        }));
        res.json(result.Items || []);
    } catch (err) {
        console.error('GET /api/logs/:date error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/logs ──────────────────────────────────────────────────────────
app.post('/tracker/logs', async (req, res) => {
    try {
        const { date, category, ...rest } = req.body;
        if (!date || !category) return res.status(400).json({ error: 'date and category are required' });

        const logId = `${category}#${new Date().toISOString()}`;
        const item = { date, logId, category, ...rest };

        await ddb.send(new PutCommand({ TableName: TRACKER_TABLE, Item: item }));
        res.status(201).json(item);
    } catch (err) {
        console.error('POST /api/logs error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── PUT /api/logs/:date/:logId ──────────────────────────────────────────────────
app.put('/tracker/logs/:date/:logId', async (req, res) => {
    try {
        const { date, logId } = req.params;
        const body = req.body;
        
        // Construct the item based on the existing date and logId
        const item = { ...body, date, logId };

        await ddb.send(new PutCommand({ TableName: TRACKER_TABLE, Item: item }));
        res.status(200).json(item);
    } catch (err) {
        console.error('PUT /api/logs error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── DELETE /api/logs/:date/:logId ───────────────────────────────────────────
app.delete('/tracker/logs/:date/:logId', async (req, res) => {
    try {
        const { date, logId } = req.params;
        await ddb.send(new DeleteCommand({
            TableName: TRACKER_TABLE,
            Key: { date, logId }
        }));
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/logs error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/logs/bulk ─────────────────────────────────────────────────────
app.post('/tracker/logs/bulk', async (req, res) => {
    try {
        const items = req.body;
        if (!Array.isArray(items)) return res.status(400).json({ error: 'Body must be an array' });

        // Process in batches of 25
        for (let i = 0; i < items.length; i += 25) {
            const batch = items.slice(i, i + 25);
            const putRequests = batch.map(item => {
                if (!item.logId) {
                    item.logId = `${item.category}#${new Date().toISOString()}`;
                }
                return {
                    PutRequest: { Item: item }
                };
            });

            await ddb.send(new BatchWriteCommand({
                RequestItems: {
                    [TRACKER_TABLE]: putRequests
                }
            }));
        }
        res.json({ success: true, count: items.length });
    } catch (err) {
        console.error('POST /api/logs/bulk error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/summary?from=YYYY-MM-DD&to=YYYY-MM-DD ──────────────────────────
app.get('/tracker/summary', async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) return res.status(400).json({ error: 'from and to dates are required' });

        // Include from - 1 to catch bleeding logs
        const queryStartDate = new Date(from);
        queryStartDate.setDate(queryStartDate.getDate() - 1);
        const fromMinusOne = queryStartDate.toISOString().split('T')[0];

        const queryDates = getDatesInRange(fromMinusOne, to);
        const reportDates = getDatesInRange(from, to);

        const promises = queryDates.map(date => 
            ddb.send(new QueryCommand({
                TableName: TRACKER_TABLE,
                KeyConditionExpression: '#d = :date',
                ExpressionAttributeNames: { '#d': 'date' },
                ExpressionAttributeValues: { ':date': date }
            }))
        );

        const results = await Promise.all(promises);
        const logs = results.flatMap(r => r.Items || []);
        
        const summaryByDate = {};
        for (const date of reportDates) {
            summaryByDate[date] = {
                date,
                diaperCount: { wet: 0, dirty: 0 },
                feedCount: 0,
                feedTotalMinutes: 0,
                sleepTotalHours: 0,
                tummyTimeCount: 0,
                vitaminD: false,
                massage: false,
                bath: false
            };
        }

        const getMinutes = (start, end) => {
            if (!start || !end) return 0;
            const [sh, sm] = start.split(':').map(Number);
            const [eh, em] = end.split(':').map(Number);
            return (eh * 60 + em) - (sh * 60 + sm);
        };

        // Recalculate duration from startTime/endTime — never trust stored durationMin
        const calcDuration = (startStr, endStr) => {
            if (!startStr || !endStr) return null; // missing times = skip
            const crossesMidnight = endStr < startStr;
            if (crossesMidnight) {
                const part1 = getMinutes(startStr, '23:59') + 1; // start → midnight
                const part2 = getMinutes('00:00', endStr);        // midnight → end
                return { part1, part2, crossesMidnight: true };
            }
            const mins = getMinutes(startStr, endStr);
            return { part1: mins, part2: 0, crossesMidnight: false };
        };

        for (const log of logs) {
            const startStr = log.startTime || log.time;
            const endStr = log.endTime;

            // Skip sleep/feed records with no endTime — corrupted entries
            if ((log.category === 'sleep' || log.category === 'feed') && !endStr) {
                console.warn(`Skipping corrupted ${log.category} record: date=${log.date} logId=${log.logId} startTime=${startStr} endTime=${endStr}`);
                continue;
            }

            const dur = calcDuration(startStr, endStr);
            const crossesMidnight = dur ? dur.crossesMidnight : false;

            // Date 1 handling (log.date)
            const sum1 = summaryByDate[log.date];
            if (sum1) {
                if (log.category === 'diaper') {
                    if (log.type === 'wet' || log.type === 'both') sum1.diaperCount.wet++;
                    if (log.type === 'dirty' || log.type === 'both') sum1.diaperCount.dirty++;
                } else if (log.category === 'feed') {
                    sum1.feedCount++;
                    let min1 = dur ? dur.part1 : 0;
                    if (min1 > 20) min1 = 15;
                    sum1.feedTotalMinutes += min1;
                } else if (log.category === 'sleep') {
                    let min1 = dur ? dur.part1 : 0;
                    sum1.sleepTotalHours += (min1 / 60);
                } else if (log.category === 'tummyTime') {
                    sum1.tummyTimeCount++;
                } else if (log.category === 'vitaminD') {
                    sum1.vitaminD = true;
                } else if (log.category === 'massage') {
                    sum1.massage = true;
                } else if (log.category === 'bath') {
                    sum1.bath = true;
                }
            }

            // Date 2 handling (log.date + 1)
            if (crossesMidnight) {
                const nextDate = new Date(log.date);
                nextDate.setDate(nextDate.getDate() + 1);
                const nextDateStr = nextDate.toISOString().split('T')[0];
                const sum2 = summaryByDate[nextDateStr];
                
                if (sum2) {
                    if (log.category === 'feed') {
                        let min2 = dur ? dur.part2 : 0;
                        if (min2 > 20) min2 = 15;
                        sum2.feedTotalMinutes += min2;
                    } else if (log.category === 'sleep') {
                        let min2 = dur ? dur.part2 : 0;
                        sum2.sleepTotalHours += (min2 / 60);
                    }
                }
            }
        }

        res.json(Object.values(summaryByDate));
    } catch (err) {
        console.error('GET /api/summary error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ═════════════════════════════════════════════════════════════════════════════
// ─── PLANTS API ─────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

// ─── GET /plants/logs ────────────────────────────────────────────────────────
app.get('/plants/logs', async (req, res) => {
    try {
        const { plantId } = req.query;
        if (plantId) {
            const r = await ddb.send(new QueryCommand({
                TableName: PLANTS_TABLE,
                KeyConditionExpression: 'plantId = :pid',
                ExpressionAttributeValues: { ':pid': plantId },
                ScanIndexForward: false,
                Limit: 100,
            }));
            return res.json(r.Items || []);
        }
        // Scan all -> latest per plant per type
        const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
        const r = await ddb.send(new ScanCommand({ TableName: PLANTS_TABLE }));
        const items = r.Items || [];
        const latest = {};
        for (const item of items) {
            const key = `${item.plantId}__${item.type}`;
            if (!latest[key] || item.timestamp > latest[key].timestamp) latest[key] = item;
        }
        res.json(Object.values(latest));
    } catch (err) {
        console.error('GET /plants/logs error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /plants/logs ───────────────────────────────────────────────────────
app.post('/plants/logs', async (req, res) => {
    try {
        const { plantId, type, fertilizer, notes } = req.body;
        if (!plantId || !type) return res.status(400).json({ error: 'plantId and type are required' });
        
        const { randomUUID } = require('crypto');
        const item = {
            plantId,
            timestamp: new Date().toISOString(),
            logId: randomUUID(),
            type,
            ...(fertilizer ? { fertilizer } : {}),
            ...(notes ? { notes } : {}),
        };
        await ddb.send(new PutCommand({ TableName: PLANTS_TABLE, Item: item }));
        res.status(201).json(item);
    } catch (err) {
        console.error('POST /plants/logs error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── DELETE /plants/logs/:plantId/:timestamp ─────────────────────────────────
app.delete('/plants/logs/:plantId/:timestamp', async (req, res) => {
    try {
        const { plantId, timestamp } = req.params;
        await ddb.send(new DeleteCommand({
            TableName: PLANTS_TABLE,
            Key: { plantId, timestamp }
        }));
        res.json({ deleted: true });
    } catch (err) {
        console.error('DELETE /plants/logs error:', err);
        res.status(500).json({ error: err.message });
    }
});


// SPA fallback — local only
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
}

// Start server locally; export app for Lambda
if (require.main === module) {
    app.listen(port, () => console.log(`Server at http://localhost:${port}`));
}

module.exports = app;
