const express = require('express');
const { randomUUID } = require('crypto');
const {
    QueryCommand,
    ScanCommand,
    GetCommand,
    PutCommand,
    DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');
const { normalizePlantName } = require('../lib/plant-names');

const HOME_PLANTS_TABLE = process.env.HOME_PLANTS_TABLE_NAME || 'plants-home-plants';
const CATALOG_TABLE = process.env.CATALOG_TABLE_NAME || 'plants-catalog';
const STAGING_TABLE = process.env.STAGING_TABLE_NAME || 'plants-staging';
const CARE_LOGS_V2_TABLE = process.env.CARE_LOGS_V2_TABLE_NAME || 'plants-care-logs-v2';

const INTERNAL_CATALOG_FIELDS = ['normalizedName', 'normalizedScientificName', 'status', 'updatedAt'];
const VALID_GROUPS = new Set(['indoor', 'outdoor-potted', 'outdoor-garden']);

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
        comingSoon: false,
        addedAt: homeRow.createdAt,
        updatedAt: homeRow.updatedAt,
    };
}

function buildComingSoonPlant(homeRow) {
    const baseName = homeRow.customName || 'Requested Plant';
    const nickname = homeRow.nickname ? String(homeRow.nickname).trim() : '';
    const group = VALID_GROUPS.has(homeRow.group) ? homeRow.group : 'indoor';
    return {
        id: homeRow.homePlantId,
        homePlantId: homeRow.homePlantId,
        catalogId: homeRow.catalogId,
        name: baseName,
        displayName: nickname ? `${baseName} (${nickname})` : baseName,
        scientificName: 'Care profile & photography coming soon',
        emoji: '🌱',
        group,
        waterFreqDays: group === 'outdoor-garden' ? null : [7, 10],
        selfWaterFreqDays: group === 'outdoor-garden' ? undefined : [10, 14],
        fertFreqDays: [28, 30],
        fertRecommendation: 'Schultz (10-15-10)',
        selfWatering: group === 'outdoor-garden' ? 'no' : 'caution',
        selfWateringNote: 'Botanical care guide is currently being curated for this plant.',
        notes: [
            'This plant has been added to our botanical staging queue.',
            'Full watering, fertilizing, and photography details will appear automatically once curated.',
        ],
        nickname: nickname || undefined,
        potType: homeRow.potType || 'standard',
        trackWatering: homeRow.trackWatering,
        groupOverride: homeRow.groupOverride,
        deleted: Boolean(homeRow.deleted),
        comingSoon: true,
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
                if (cat) {
                    plants.push(mergeHomePlantWithCatalog(row, cat));
                } else if (row.comingSoon || String(row.catalogId || '').startsWith('staging:')) {
                    // Check if a catalog plant now matches by normalizedName + group
                    const norm = normalizePlantName(row.customName || '');
                    let promoted = null;
                    for (const candidate of catalogMap.values()) {
                        if (
                            normalizePlantName(candidate.name) === norm &&
                            (!row.group || candidate.group === row.group)
                        ) {
                            promoted = candidate;
                            break;
                        }
                    }
                    if (promoted) {
                        plants.push(mergeHomePlantWithCatalog(row, promoted));
                    } else {
                        plants.push(buildComingSoonPlant(row));
                    }
                }
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
                if (existingIds.has(homePlantId)) {
                    homePlantId = `${catalogId}__${randomUUID().slice(0, 8)}`;
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

    // ─── POST /plants/my-plants/request (staging fallback for unknown plants) ─
    router.post('/plants/my-plants/request', async (req, res) => {
        try {
            const homeId = req.homeId;
            const email = req.user?.email || 'unknown';
            const customName = String(req.body?.name || '').trim().slice(0, 80);
            const group = VALID_GROUPS.has(req.body?.group) ? req.body.group : 'indoor';
            const nickname = req.body?.nickname ? String(req.body.nickname).trim().slice(0, 60) : undefined;
            const potType = req.body?.potType === 'self-watering' ? 'self-watering' : 'standard';

            if (!customName) {
                return res.status(400).json({ error: 'Plant name is required.' });
            }

            const normalizedName = normalizePlantName(customName);
            if (!normalizedName) {
                return res.status(400).json({ error: 'Plant name is invalid.' });
            }

            const now = new Date().toISOString();

            // 1. Upsert into plants-staging
            const existingStage = await ddb.send(new GetCommand({
                TableName: STAGING_TABLE,
                Key: { normalizedName },
            }));
            const prevStage = existingStage.Item || {};
            const requestedBy = Array.from(new Set([...(prevStage.requestedBy || []), email]));
            const requestedHomes = Array.from(new Set([...(prevStage.requestedHomes || []), homeId]));

            await ddb.send(new PutCommand({
                TableName: STAGING_TABLE,
                Item: {
                    normalizedName,
                    requestedName: prevStage.requestedName || customName,
                    group: prevStage.group || group,
                    status: prevStage.status || 'pending',
                    requestedBy,
                    requestedHomes,
                    createdAt: prevStage.createdAt || now,
                    updatedAt: now,
                },
            }));

            // 2. Create "Coming Soon" instance in plants-home-plants
            const existingRows = await listHomePlantRows(ddb, homeId);
            const existingIds = new Set(existingRows.map(r => r.homePlantId));
            const slug = normalizedName.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plant';
            let homePlantId = `staging-${slug}`;
            if (existingIds.has(homePlantId)) {
                homePlantId = `staging-${slug}__${randomUUID().slice(0, 8)}`;
            }

            const homeItem = {
                homeId,
                homePlantId,
                catalogId: `staging:${normalizedName}`,
                customName,
                group,
                comingSoon: true,
                ...(nickname ? { nickname } : {}),
                potType,
                deleted: false,
                createdAt: now,
                updatedAt: now,
            };

            await ddb.send(new PutCommand({
                TableName: HOME_PLANTS_TABLE,
                Item: homeItem,
            }));

            res.status(201).json({
                homeId,
                plant: buildComingSoonPlant(homeItem),
            });
        } catch (err) {
            console.error('POST /plants/my-plants/request error:', err);
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

            if (next.comingSoon || String(next.catalogId || '').startsWith('staging:')) {
                return res.json({ plant: buildComingSoonPlant(next) });
            }

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
