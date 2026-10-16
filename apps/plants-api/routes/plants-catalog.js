const express = require('express');
const { ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { normalizePlantName } = require('../lib/plant-names');

const CATALOG_TABLE = process.env.CATALOG_TABLE_NAME || 'plants-catalog';

// Fields that exist only for lookups/bookkeeping and are not part of the plant metadata.
const INTERNAL_FIELDS = ['normalizedName', 'normalizedScientificName', 'status', 'updatedAt'];

function toPublic(item) {
    const plant = { ...item };
    for (const field of INTERNAL_FIELDS) delete plant[field];
    return plant;
}

async function scanPublished(ddb) {
    const items = [];
    let ExclusiveStartKey;
    do {
        const r = await ddb.send(new ScanCommand({
            TableName: CATALOG_TABLE,
            FilterExpression: '#status = :published',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':published': 'published' },
            ExclusiveStartKey,
        }));
        items.push(...(r.Items || []));
        ExclusiveStartKey = r.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return items;
}

function matchesQuery(item, q) {
    if (item.normalizedName?.includes(q)) return true;
    if (item.normalizedScientificName?.includes(q)) return true;
    return (item.aliases || []).some(alias => normalizePlantName(alias).includes(q));
}

/**
 * Read-only plant catalog (master plants table) endpoints.
 *  GET /plants/catalog?q=&group=   -> published plants, optionally filtered
 *  GET /plants/catalog/:plantId    -> a single published plant
 */
function createCatalogRouter(ddb) {
    const router = express.Router();

    router.get('/plants/catalog', async (req, res) => {
        try {
            const q = normalizePlantName(req.query.q);
            const { group } = req.query;

            let items = await scanPublished(ddb);
            if (group) items = items.filter(item => item.group === group);
            if (q) items = items.filter(item => matchesQuery(item, q));

            items.sort((a, b) => a.name.localeCompare(b.name));
            res.set('Cache-Control', 'private, max-age=300');
            res.json(items.map(toPublic));
        } catch (err) {
            console.error('GET /plants/catalog error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/plants/catalog/:plantId', async (req, res) => {
        try {
            const r = await ddb.send(new GetCommand({
                TableName: CATALOG_TABLE,
                Key: { plantId: req.params.plantId },
            }));
            if (!r.Item || r.Item.status !== 'published') {
                return res.status(404).json({ error: 'Plant not found' });
            }
            res.set('Cache-Control', 'private, max-age=300');
            res.json(toPublic(r.Item));
        } catch (err) {
            console.error('GET /plants/catalog/:plantId error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}

module.exports = { createCatalogRouter };
