const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { createCatalogRouter } = require('../routes/plants-catalog');
const { normalizePlantName } = require('../lib/plant-names');

const ITEMS = [
    { plantId: 'pothos', name: 'Golden Pothos', group: 'indoor', status: 'published', normalizedName: 'golden pothos', normalizedScientificName: 'epipremnum aureum', aliases: ['Devil\'s Ivy'], updatedAt: 'x' },
    { plantId: 'okra', name: 'Okra', group: 'outdoor-garden', status: 'published', normalizedName: 'okra', normalizedScientificName: 'abelmoschus esculentus', updatedAt: 'x' },
    { plantId: 'draft', name: 'Draft Plant', group: 'indoor', status: 'draft', normalizedName: 'draft plant', updatedAt: 'x' },
];

// Minimal fake DocumentClient: dispatches on command type, paginates scans in pages of 1.
function fakeDdb() {
    return {
        async send(command) {
            const name = command.constructor.name;
            if (name === 'ScanCommand') {
                const start = command.input.ExclusiveStartKey?.i ?? 0;
                const item = ITEMS[start];
                const matches = item && item.status === command.input.ExpressionAttributeValues[':published'];
                return {
                    Items: matches ? [item] : [],
                    LastEvaluatedKey: start + 1 < ITEMS.length ? { i: start + 1 } : undefined,
                };
            }
            if (name === 'GetCommand') {
                return { Item: ITEMS.find(i => i.plantId === command.input.Key.plantId) };
            }
            throw new Error(`Unexpected command ${name}`);
        },
    };
}

async function withServer(fn) {
    const app = express();
    app.use(createCatalogRouter(fakeDdb()));
    const server = await new Promise(resolve => { const s = app.listen(0, () => resolve(s)); });
    try {
        await fn(`http://127.0.0.1:${server.address().port}`);
    } finally {
        server.close();
    }
}

test('normalizePlantName trims, collapses whitespace and lowercases', () => {
    assert.strictEqual(normalizePlantName('  Golden   POTHOS '), 'golden pothos');
    assert.strictEqual(normalizePlantName(undefined), '');
});

test('lists only published plants, sorted, without internal fields', async () => {
    await withServer(async base => {
        const body = await (await fetch(`${base}/plants/catalog`)).json();
        assert.deepStrictEqual(body.map(p => p.plantId), ['pothos', 'okra']);
        assert.ok(!('normalizedName' in body[0]) && !('status' in body[0]) && !('updatedAt' in body[0]));
    });
});

test('filters by case-insensitive query on name, scientific name and aliases', async () => {
    await withServer(async base => {
        const get = async q => (await (await fetch(`${base}/plants/catalog?q=${encodeURIComponent(q)}`)).json()).map(p => p.plantId);
        assert.deepStrictEqual(await get('POTHOS'), ['pothos']);
        assert.deepStrictEqual(await get('abelmoschus'), ['okra']);
        assert.deepStrictEqual(await get("devil's"), ['pothos']);
        assert.deepStrictEqual(await get('nothing'), []);
    });
});

test('filters by group', async () => {
    await withServer(async base => {
        const body = await (await fetch(`${base}/plants/catalog?group=outdoor-garden`)).json();
        assert.deepStrictEqual(body.map(p => p.plantId), ['okra']);
    });
});

test('single plant: 200 when published, 404 when draft or missing', async () => {
    await withServer(async base => {
        assert.strictEqual((await fetch(`${base}/plants/catalog/okra`)).status, 200);
        assert.strictEqual((await fetch(`${base}/plants/catalog/draft`)).status, 404);
        assert.strictEqual((await fetch(`${base}/plants/catalog/nope`)).status, 404);
    });
});
