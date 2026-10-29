const express = require('express');
const { randomUUID } = require('crypto');
const {
    QueryCommand,
    ScanCommand,
    GetCommand,
    PutCommand,
    DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');

const HOME_PLANTS_TABLE = process.env.HOME_PLANTS_TABLE_NAME || 'plants-home-plants';
const CATALOG_TABLE = process.env.CATALOG_TABLE_NAME || 'plants-catalog';
const CARE_LOGS_V2_TABLE = process.env.CARE_LOGS_V2_TABLE_NAME || 'plants-care-logs-v2';

const INTERNAL_CATALOG_FIELDS = ['normalizedName', 'normalizedScientificName', 'status', 'updatedAt'];

function cleanCatalogItem(item) {
    const copy = { ...item };
    for (const f of INTERNAL_CATALOG_FIELDS) delete copy[f];
    return copy;
}

async function loadCatalogMap(ddb) {
    const map = new Map();
    let ExclusiveStartKey;
    do {
        const r = await ddb.send(new ScanCommand({
            TableName: CATALOG_TABLE,
            FilterExpression: '#status = :published',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':published': 'published' },
            ExclusiveStartKey,
        }));
        for (const item of r.Items || []) {
            map.set(item.plantId, cleanCatalogItem(item));
        }
        ExclusiveStartKey = r.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return map;
}

async function listHomePlantRows(ddb, homeId) {
    const items = [];
    let ExclusiveStartKey;
    do {
        const r = await ddb.send(new QueryCommand({
            TableName: HOME_PLANTS_TABLE,
            KeyConditionExpression: 'homeId = :hid',
            ExpressionAttributeValues: { ':hid': homeId },
            ExclusiveStartKey,
        }));
        items.push(...(r.Items || []));
        ExclusiveStartKey = r.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return items;
}

function mergeHomePlantWithCatalog(homeRow, catalogItem) {
    const nickname = homeRow.nickname ? String(homeRow.nickname).trim() : '';
    return {
        ...catalogItem,
        id: homeRow.homePlantId,
        homePlantId: homeRow.homePlantId,
        catalogId: homeRow.catalogId,
        nickname: nickname || undefined,
        displayName: nickname ? `${catalogItem.name} (${nickname})` : catalogItem.name,
        potType: homeRow.potType || 'standard',
        trackWatering: homeRow.trackWatering,
        groupOverride: homeRow.groupOverride,
        deleted: Boolean(homeRow.deleted),
        addedAt: homeRow.createdAt,
        updatedAt: homeRow.updatedAt,
    };
}

/**
 * Home-scoped plant instances router.
 * Requires `req.homeId` from `requireHomeMiddleware`.
 */
function createHomePlantsRouter(ddb) {
    const router = express.Router();

    // ─── GET /plants/my-plants ───────────────────────────────────────────────
    router.get('/plants/my-plants', async (req, res) => {
        try {
            const homeId = req.homeId;
            const [homeRows, catalogMap] = await Promise.all([
                listHomePlantRows(ddb, homeId),
                loadCatalogMap(ddb),
            ]);

            const plants = [];
            for (const row of homeRows) {
                const cat = catalogMap.get(row.catalogId);
                if (!cat) continue;
                plants.push(mergeHomePlantWithCatalog(row, cat));
            }

            plants.sort((a, b) => a.name.localeCompare(b.name));
            res.json({ homeId, plants });
        } catch (err) {
            console.error('GET /plants/my-plants error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─── POST /plants/my-plants ──────────────────────────────────────────────
    router.post('/plants/my-plants', async (req, res) => {
        try {
            const homeId = req.homeId;
            const rawItems = Array.isArray(req.body?.items)
                ? req.body.items
                : req.body?.catalogId
                ? [req.body]
                : [];

            if (rawItems.length === 0) {
                return res.status(400).json({ error: 'At least one plant item with catalogId is required.' });
            }

            const [existingRows, catalogMap] = await Promise.all([
                listHomePlantRows(ddb, homeId),
                loadCatalogMap(ddb),
            ]);
            const existingIds = new Set(existingRows.map(r => r.homePlantId));
            const now = new Date().toISOString();
            const added = [];

            for (const entry of rawItems) {
                const catalogId = String(entry?.catalogId || '').trim();
                const cat = catalogMap.get(catalogId);
                if (!cat) {
                    return res.status(400).json({ error: `Unknown or unpublished catalogId: ${catalogId}` });
                }

                const nickname = entry.nickname ? String(entry.nickname).trim().slice(0, 60) : undefined;
                let homePlantId = catalogId;
                if (existingIds.has(homePlantId) || nickname) {
                    if (existingIds.has(homePlantId)) {
                        homePlantId = `${catalogId}__${randomUUID().slice(0, 8)}`;
                    }
                }
                existingIds.add(homePlantId);

                const item = {
                    homeId,
                    homePlantId,
                    catalogId,
                    ...(nickname ? { nickname } : {}),
                    potType: entry.potType === 'self-watering' ? 'self-watering' : 'standard',
                    ...(typeof entry.trackWatering === 'boolean' ? { trackWatering: entry.trackWatering } : {}),
                    ...(entry.groupOverride === 'indoor' || entry.groupOverride === 'outdoor-potted'
                        ? { groupOverride: entry.groupOverride }
                        : {}),
                    deleted: false,
                    createdAt: now,
                    updatedAt: now,
                };

                await ddb.send(new PutCommand({
                    TableName: HOME_PLANTS_TABLE,
                    Item: item,
                }));

                added.push(mergeHomePlantWithCatalog(item, cat));
            }

            res.status(201).json({ homeId, added });
        } catch (err) {
            console.error('POST /plants/my-plants error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─── PATCH /plants/my-plants/:homePlantId ────────────────────────────────
    router.patch('/plants/my-plants/:homePlantId', async (req, res) => {
        try {
            const homeId = req.homeId;
            const { homePlantId } = req.params;

            const existingRes = await ddb.send(new GetCommand({
                TableName: HOME_PLANTS_TABLE,
                Key: { homeId, homePlantId },
            }));
            if (!existingRes.Item) {
                return res.status(404).json({ error: 'Plant not found in this home.' });
            }

            const prev = existingRes.Item;
            const updates = req.body || {};
            const next = {
                ...prev,
                updatedAt: new Date().toISOString(),
            };

            if ('nickname' in updates) {
                const nick = String(updates.nickname ?? '').trim().slice(0, 60);
                if (nick) next.nickname = nick;
                else delete next.nickname;
            }
            if (updates.potType === 'self-watering' || updates.potType === 'standard') {
                next.potType = updates.potType;
            }
            if (typeof updates.trackWatering === 'boolean') {
                next.trackWatering = updates.trackWatering;
            }
            if (updates.groupOverride === 'indoor' || updates.groupOverride === 'outdoor-potted') {
                next.groupOverride = updates.groupOverride;
            }
            if (typeof updates.deleted === 'boolean') {
                next.deleted = updates.deleted;
            }

            await ddb.send(new PutCommand({
                TableName: HOME_PLANTS_TABLE,
                Item: next,
            }));

            const catRes = await ddb.send(new GetCommand({
                TableName: CATALOG_TABLE,
                Key: { plantId: next.catalogId },
            }));
            const merged = catRes.Item
                ? mergeHomePlantWithCatalog(next, cleanCatalogItem(catRes.Item))
                : next;

            res.json({ plant: merged });
        } catch (err) {
            console.error('PATCH /plants/my-plants/:homePlantId error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─── DELETE /plants/my-plants/:homePlantId ───────────────────────────────
    router.delete('/plants/my-plants/:homePlantId', async (req, res) => {
        try {
            const homeId = req.homeId;
            const { homePlantId } = req.params;

            await ddb.send(new DeleteCommand({
                TableName: HOME_PLANTS_TABLE,
                Key: { homeId, homePlantId },
            }));

            // Also delete any care logs for this homePlantId in this home
            const logsRes = await ddb.send(new QueryCommand({
                TableName: CARE_LOGS_V2_TABLE,
                KeyConditionExpression: 'homeId = :hid AND begins_with(logKey, :prefix)',
                ExpressionAttributeValues: {
                    ':hid': homeId,
                    ':prefix': `${homePlantId}#`,
                },
            }));
            for (const log of logsRes.Items || []) {
                await ddb.send(new DeleteCommand({
                    TableName: CARE_LOGS_V2_TABLE,
                    Key: { homeId, logKey: log.logKey },
                }));
            }

            res.json({ deleted: true, homePlantId });
        } catch (err) {
            console.error('DELETE /plants/my-plants/:homePlantId error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}

module.exports = { createHomePlantsRouter };
