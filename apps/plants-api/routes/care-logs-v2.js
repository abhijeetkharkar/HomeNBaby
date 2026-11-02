const express = require('express');
const { randomUUID } = require('crypto');
const {
    QueryCommand,
    PutCommand,
    DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');

const CARE_LOGS_V2_TABLE = process.env.CARE_LOGS_V2_TABLE_NAME || 'plants-care-logs-v2';
const VALID_LOG_TYPES = new Set(['water', 'fertilize', 'fertilize-2']);

function buildLogKey(plantId, timestamp, type) {
    return `${plantId}#${timestamp}#${type}`;
}

async function queryHomeLogs(ddb, homeId, prefix) {
    const items = [];
    let ExclusiveStartKey;
    do {
        const params = {
            TableName: CARE_LOGS_V2_TABLE,
            KeyConditionExpression: prefix
                ? 'homeId = :hid AND begins_with(logKey, :prefix)'
                : 'homeId = :hid',
            ExpressionAttributeValues: prefix
                ? { ':hid': homeId, ':prefix': prefix }
                : { ':hid': homeId },
            ExclusiveStartKey,
        };
        const r = await ddb.send(new QueryCommand(params));
        items.push(...(r.Items || []));
        ExclusiveStartKey = r.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return items;
}

/**
 * Multi-tenant care logs router (`plants-care-logs-v2`).
 * Primary key: `homeId` (HASH) + `logKey` (`${homePlantId}#${timestamp}#${type}`, RANGE).
 * Including `#${type}` in the sort key guarantees water and liquid-fertilizer logs
 * at the same timestamp never collide or overwrite one another.
 */
function createCareLogsV2Router(ddb) {
    const router = express.Router();

    // ─── GET /plants/v2/logs ─────────────────────────────────────────────────
    router.get('/plants/v2/logs', async (req, res) => {
        try {
            const homeId = req.homeId;
            const { plantId } = req.query;

            if (plantId) {
                const items = await queryHomeLogs(ddb, homeId, `${plantId}#`);
                items.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
                return res.json(items.slice(0, 100));
            }

            const items = await queryHomeLogs(ddb, homeId);
            const latest = {};
            for (const item of items) {
                const key = `${item.plantId}__${item.type}`;
                if (!latest[key] || item.timestamp > latest[key].timestamp) {
                    latest[key] = item;
                }
            }
            res.json(Object.values(latest));
        } catch (err) {
            console.error('GET /plants/v2/logs error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─── POST /plants/v2/logs ────────────────────────────────────────────────
    router.post('/plants/v2/logs', async (req, res) => {
        try {
            const homeId = req.homeId;
            const { plantId, type, fertilizer, notes, timestamp: reqTimestamp } = req.body || {};

            if (!plantId || !type) {
                return res.status(400).json({ error: 'plantId and type are required' });
            }
            if (!VALID_LOG_TYPES.has(type)) {
                return res.status(400).json({ error: 'Invalid care log type' });
            }

            const timestamp =
                reqTimestamp && !isNaN(new Date(reqTimestamp).getTime())
                    ? new Date(reqTimestamp).toISOString()
                    : new Date().toISOString();

            const logKey = buildLogKey(plantId, timestamp, type);
            const item = {
                homeId,
                logKey,
                plantId,
                timestamp,
                logId: randomUUID(),
                type,
                loggedBy: req.user?.email,
                ...(fertilizer ? { fertilizer } : {}),
                ...(notes ? { notes } : {}),
            };

            await ddb.send(new PutCommand({
                TableName: CARE_LOGS_V2_TABLE,
                Item: item,
            }));

            res.status(201).json(item);
        } catch (err) {
            console.error('POST /plants/v2/logs error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─── DELETE /plants/v2/logs/:plantId/:timestamp/:type ────────────────────
    router.delete('/plants/v2/logs/:plantId/:timestamp/:type', async (req, res) => {
        try {
            const homeId = req.homeId;
            const { plantId, timestamp, type } = req.params;
            const logKey = buildLogKey(plantId, timestamp, type);

            await ddb.send(new DeleteCommand({
                TableName: CARE_LOGS_V2_TABLE,
                Key: { homeId, logKey },
            }));
            res.json({ deleted: true });
        } catch (err) {
            console.error('DELETE /plants/v2/logs/:plantId/:timestamp/:type error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─── DELETE /plants/v2/logs/:plantId/:timestamp ──────────────────────────
    router.delete('/plants/v2/logs/:plantId/:timestamp', async (req, res) => {
        try {
            const homeId = req.homeId;
            const { plantId, timestamp } = req.params;
            const matching = await queryHomeLogs(ddb, homeId, `${plantId}#${timestamp}#`);
            for (const item of matching) {
                await ddb.send(new DeleteCommand({
                    TableName: CARE_LOGS_V2_TABLE,
                    Key: { homeId, logKey: item.logKey },
                }));
            }
            res.json({ deleted: true, count: matching.length });
        } catch (err) {
            console.error('DELETE /plants/v2/logs/:plantId/:timestamp error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}

module.exports = { createCareLogsV2Router, buildLogKey };
