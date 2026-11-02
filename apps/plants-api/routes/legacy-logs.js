const express = require('express');
const { randomUUID } = require('crypto');
const {
    QueryCommand,
    ScanCommand,
    PutCommand,
    DeleteCommand,
    GetCommand,
} = require('@aws-sdk/lib-dynamodb');

const PLANTS_TABLE = process.env.PLANTS_TABLE_NAME || 'plants-care-logs';

/**
 * Plants care-log and settings endpoints copied from the shared API (apps/api/server.js)
 * so the existing frontend works unchanged after the cutover. These run against the
 * original single-user table and are replaced by the user-scoped routes later.
 */
function createLegacyLogsRouter(ddb) {
    const router = express.Router();

    // ─── GET /plants/logs ────────────────────────────────────────────────────
    router.get('/plants/logs', async (req, res) => {
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
            const items = [];
            let ExclusiveStartKey;
            do {
                const r = await ddb.send(new ScanCommand({ TableName: PLANTS_TABLE, ExclusiveStartKey }));
                items.push(...(r.Items || []));
                ExclusiveStartKey = r.LastEvaluatedKey;
            } while (ExclusiveStartKey);

            const latest = {};
            for (const item of items) {
                if (item.plantId === '__CONFIG__') continue;
                const key = `${item.plantId}__${item.type}`;
                if (!latest[key] || item.timestamp > latest[key].timestamp) latest[key] = item;
            }
            res.json(Object.values(latest));
        } catch (err) {
            console.error('GET /plants/logs error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─── POST /plants/logs ───────────────────────────────────────────────────
    router.post('/plants/logs', async (req, res) => {
        try {
            const { plantId, type, fertilizer, notes, timestamp: reqTimestamp } = req.body;
            if (!plantId || !type) return res.status(400).json({ error: 'plantId and type are required' });

            const timestamp = reqTimestamp && !isNaN(new Date(reqTimestamp).getTime())
                ? new Date(reqTimestamp).toISOString()
                : new Date().toISOString();

            const item = {
                plantId,
                timestamp,
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

    // ─── GET /plants/settings ────────────────────────────────────────────────
    router.get('/plants/settings', async (req, res) => {
        try {
            const r = await ddb.send(new GetCommand({
                TableName: PLANTS_TABLE,
                Key: { plantId: '__CONFIG__', timestamp: 'settings' }
            }));
            const data = r.Item?.settings || {
                potTypeOverrides: {
                    'money-tree': 'self-watering',
                    'cream-allusion-arrowhead': 'self-watering',
                    'prayer-plant': 'self-watering',
                },
                deletedPlantIds: [],
                permanentlyDeletedIds: []
            };
            res.json(data);
        } catch (err) {
            console.error('GET /plants/settings error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─── POST /plants/settings ───────────────────────────────────────────────
    router.post('/plants/settings', async (req, res) => {
        try {
            const settings = req.body;
            const item = {
                plantId: '__CONFIG__',
                timestamp: 'settings',
                updatedAt: new Date().toISOString(),
                settings
            };
            await ddb.send(new PutCommand({ TableName: PLANTS_TABLE, Item: item }));
            res.json({ success: true, settings });
        } catch (err) {
            console.error('POST /plants/settings error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─── DELETE /plants/logs/:plantId/:timestamp ─────────────────────────────
    router.delete('/plants/logs/:plantId/:timestamp', async (req, res) => {
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

    return router;
}

module.exports = { createLegacyLogsRouter };
