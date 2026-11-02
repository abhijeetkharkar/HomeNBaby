const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { createLegacyLogsRouter } = require('../routes/legacy-logs');

// In-memory fake DocumentClient; scans return one item per page to exercise pagination.
function fakeDdb(initial = []) {
    const items = [...initial];
    const puts = [];
    return {
        items,
        puts,
        async send(command) {
            const name = command.constructor.name;
            const input = command.input;
            if (name === 'ScanCommand') {
                const start = input.ExclusiveStartKey?.i ?? 0;
                return {
                    Items: items[start] ? [items[start]] : [],
                    LastEvaluatedKey: start + 1 < items.length ? { i: start + 1 } : undefined,
                };
            }
            if (name === 'PutCommand') {
                puts.push(input.Item);
                items.push(input.Item);
                return {};
            }
            if (name === 'DeleteCommand') {
                const { plantId, timestamp } = input.Key;
                const i = items.findIndex(x => x.plantId === plantId && x.timestamp === timestamp);
                if (i >= 0) items.splice(i, 1);
                return {};
            }
            if (name === 'GetCommand') {
                return { Item: items.find(x => x.plantId === input.Key.plantId && x.timestamp === input.Key.timestamp) };
            }
            throw new Error(`Unexpected command ${name}`);
        },
    };
}

async function withServer(ddb, fn) {
    const app = express();
    app.use(express.json());
    app.use(createLegacyLogsRouter(ddb));
    const server = await new Promise(resolve => { const s = app.listen(0, () => resolve(s)); });
    try {
        await fn(`http://127.0.0.1:${server.address().port}`);
    } finally {
        server.close();
    }
}

const post = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('POST /plants/logs creates a log (201) and validates input', async () => {
    const ddb = fakeDdb();
    await withServer(ddb, async base => {
        assert.strictEqual((await post(`${base}/plants/logs`, { type: 'water' })).status, 400);
        const res = await post(`${base}/plants/logs`, { plantId: 'p1', type: 'fertilize', fertilizer: 'Schultz', timestamp: '2026-10-15T22:08:00Z' });
        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.timestamp, '2026-10-15T22:08:00.000Z');
        assert.strictEqual(body.fertilizer, 'Schultz');
        assert.ok(body.logId);
    });
});

test('GET /plants/logs returns latest per plant+type, across scan pages, skipping __CONFIG__', async () => {
    const ddb = fakeDdb([
        { plantId: 'p1', type: 'water', timestamp: '2026-01-01T00:00:00.000Z' },
        { plantId: '__CONFIG__', type: undefined, timestamp: 'settings' },
        { plantId: 'p1', type: 'water', timestamp: '2026-03-01T00:00:00.000Z' },
        { plantId: 'p1', type: 'fertilize', timestamp: '2026-02-01T00:00:00.000Z' },
    ]);
    await withServer(ddb, async base => {
        const body = await (await fetch(`${base}/plants/logs`)).json();
        const byKey = Object.fromEntries(body.map(l => [`${l.plantId}__${l.type}`, l.timestamp]));
        assert.deepStrictEqual(byKey, {
            p1__water: '2026-03-01T00:00:00.000Z',
            p1__fertilize: '2026-02-01T00:00:00.000Z',
        });
    });
});

test('settings: defaults when missing, then round-trips what was saved', async () => {
    const ddb = fakeDdb();
    await withServer(ddb, async base => {
        const defaults = await (await fetch(`${base}/plants/settings`)).json();
        assert.strictEqual(defaults.potTypeOverrides['money-tree'], 'self-watering');

        const settings = { potTypeOverrides: {}, deletedPlantIds: ['x'], permanentlyDeletedIds: [] };
        await post(`${base}/plants/settings`, settings);
        assert.deepStrictEqual(await (await fetch(`${base}/plants/settings`)).json(), settings);
    });
});

test('DELETE /plants/logs/:plantId/:timestamp removes the log', async () => {
    const ddb = fakeDdb([{ plantId: 'p1', type: 'water', timestamp: '2026-01-01T00:00:00.000Z' }]);
    await withServer(ddb, async base => {
        const res = await fetch(`${base}/plants/logs/p1/${encodeURIComponent('2026-01-01T00:00:00.000Z')}`, { method: 'DELETE' });
        assert.deepStrictEqual(await res.json(), { deleted: true });
        assert.strictEqual(ddb.items.length, 0);
    });
});
