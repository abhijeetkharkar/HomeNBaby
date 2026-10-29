const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { createHomePlantsRouter } = require('../routes/home-plants');
const { createCareLogsV2Router } = require('../routes/care-logs-v2');

function createFakeDdb() {
    const catalog = new Map([
        ['aloe-vera', {
            plantId: 'aloe-vera',
            name: 'Aloe Vera',
            scientificName: 'Aloe barbadensis miller',
            group: 'indoor',
            waterFreqDays: [14, 21],
            fertFreqDays: [28, 30],
            fertRecommendation: 'Schultz (10-15-10)',
            selfWatering: 'no',
            notes: ['Let soil dry completely'],
            status: 'published',
        }],
        ['snake-plant', {
            plantId: 'snake-plant',
            name: 'Snake Plant',
            scientificName: 'Dracaena trifasciata',
            group: 'indoor',
            waterFreqDays: [14, 21],
            selfWaterFreqDays: [21, 28],
            fertFreqDays: [28, 30],
            fertRecommendation: 'Schultz (10-15-10)',
            selfWatering: 'caution',
            notes: ['Low light tolerant'],
            status: 'published',
        }],
    ]);
    const homePlants = []; // { homeId, homePlantId, ... }
    const careLogs = []; // { homeId, logKey, ... }
    const staging = new Map(); // normalizedName -> item

    return {
        catalog,
        homePlants,
        careLogs,
        staging,
        async send(command) {
            const name = command.constructor.name;
            const input = command.input;

            if (name === 'ScanCommand' && input.TableName === 'plants-catalog') {
                return {
                    Items: Array.from(catalog.values())
                        .filter(c => c.status === 'published')
                        .map(c => ({ ...c })),
                };
            }

            if (name === 'GetCommand' && input.TableName === 'plants-catalog') {
                const c = catalog.get(input.Key.plantId);
                return { Item: c ? { ...c } : undefined };
            }

            if (name === 'QueryCommand' && input.TableName === 'plants-home-plants') {
                const hid = input.ExpressionAttributeValues[':hid'];
                return {
                    Items: homePlants.filter(p => p.homeId === hid).map(p => ({ ...p })),
                };
            }

            if (name === 'GetCommand' && input.TableName === 'plants-home-plants') {
                const found = homePlants.find(
                    p => p.homeId === input.Key.homeId && p.homePlantId === input.Key.homePlantId
                );
                return { Item: found ? { ...found } : undefined };
            }

            if (name === 'PutCommand' && input.TableName === 'plants-home-plants') {
                const idx = homePlants.findIndex(
                    p => p.homeId === input.Item.homeId && p.homePlantId === input.Item.homePlantId
                );
                if (idx >= 0) homePlants[idx] = { ...input.Item };
                else homePlants.push({ ...input.Item });
                return {};
            }

            if (name === 'DeleteCommand' && input.TableName === 'plants-home-plants') {
                const idx = homePlants.findIndex(
                    p => p.homeId === input.Key.homeId && p.homePlantId === input.Key.homePlantId
                );
                if (idx >= 0) homePlants.splice(idx, 1);
                return {};
            }

            if (name === 'QueryCommand' && input.TableName === 'plants-care-logs-v2') {
                const hid = input.ExpressionAttributeValues[':hid'];
                const prefix = input.ExpressionAttributeValues[':prefix'];
                return {
                    Items: careLogs
                        .filter(l => l.homeId === hid && (!prefix || l.logKey.startsWith(prefix)))
                        .map(l => ({ ...l })),
                };
            }

            if (name === 'PutCommand' && input.TableName === 'plants-care-logs-v2') {
                const idx = careLogs.findIndex(
                    l => l.homeId === input.Item.homeId && l.logKey === input.Item.logKey
                );
                if (idx >= 0) careLogs[idx] = { ...input.Item };
                else careLogs.push({ ...input.Item });
                return {};
            }

            if (name === 'DeleteCommand' && input.TableName === 'plants-care-logs-v2') {
                const idx = careLogs.findIndex(
                    l => l.homeId === input.Key.homeId && l.logKey === input.Key.logKey
                );
                if (idx >= 0) careLogs.splice(idx, 1);
                return {};
            }

            if (name === 'GetCommand' && input.TableName === 'plants-staging') {
                const s = staging.get(input.Key.normalizedName);
                return { Item: s ? { ...s } : undefined };
            }

            if (name === 'PutCommand' && input.TableName === 'plants-staging') {
                staging.set(input.Item.normalizedName, { ...input.Item });
                return {};
            }

            throw new Error(`Unexpected command ${name} on ${input.TableName}`);
        },
    };
}

async function withServer(ddb, fn) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user = { email: req.headers['x-user'] || 'alice@example.com' };
        req.homeId = req.headers['x-home-id'] || 'home-1';
        next();
    });
    app.use(createHomePlantsRouter(ddb));
    app.use(createCareLogsV2Router(ddb));

    const server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
    });
    try {
        await fn(`http://127.0.0.1:${server.address().port}`);
    } finally {
        server.close();
    }
}

test('home-plants: add single & duplicate instances with nicknames, patch overrides, and isolate by homeId', async () => {
    const ddb = createFakeDdb();
    await withServer(ddb, async base => {
        // Add first Aloe Vera and two Snake Plants to home-1
        const addRes = await fetch(`${base}/plants/my-plants`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-home-id': 'home-1' },
            body: JSON.stringify({
                items: [
                    { catalogId: 'aloe-vera' },
                    { catalogId: 'snake-plant', nickname: 'Living Room' },
                    { catalogId: 'snake-plant', nickname: 'Bedroom', potType: 'self-watering' },
                ],
            }),
        });
        assert.strictEqual(addRes.status, 201);
        const { added } = await addRes.json();
        assert.strictEqual(added.length, 3);
        assert.strictEqual(added[0].homePlantId, 'aloe-vera');
        assert.strictEqual(added[1].homePlantId, 'snake-plant');
        assert.match(added[2].homePlantId, /^snake-plant__[a-f0-9]{8}$/);
        assert.strictEqual(added[2].displayName, 'Snake Plant (Bedroom)');
        assert.strictEqual(added[2].potType, 'self-watering');

        // home-2 sees 0 plants
        const home2Res = await (await fetch(`${base}/plants/my-plants`, {
            headers: { 'x-home-id': 'home-2' },
        })).json();
        assert.strictEqual(home2Res.plants.length, 0);

        // PATCH aloe-vera to soft-delete and update groupOverride
        const patchRes = await fetch(`${base}/plants/my-plants/aloe-vera`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json', 'x-home-id': 'home-1' },
            body: JSON.stringify({ deleted: true, groupOverride: 'outdoor-potted' }),
        });
        assert.strictEqual(patchRes.status, 200);
        const patched = (await patchRes.json()).plant;
        assert.strictEqual(patched.deleted, true);
        assert.strictEqual(patched.groupOverride, 'outdoor-potted');
    });
});

test('care-logs-v2: water and fertilize at the exact same timestamp do not overwrite each other', async () => {
    const ddb = createFakeDdb();
    await withServer(ddb, async base => {
        await fetch(`${base}/plants/my-plants`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-home-id': 'home-1' },
            body: JSON.stringify({ catalogId: 'aloe-vera' }),
        });

        const sameTimestamp = '2026-10-28T15:00:00.000Z';

        // Log fertilize and water at the exact same millisecond
        const fertRes = await fetch(`${base}/plants/v2/logs`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-home-id': 'home-1' },
            body: JSON.stringify({
                plantId: 'aloe-vera',
                type: 'fertilize',
                fertilizer: 'Schultz (10-15-10)',
                timestamp: sameTimestamp,
            }),
        });
        assert.strictEqual(fertRes.status, 201);

        const waterRes = await fetch(`${base}/plants/v2/logs`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-home-id': 'home-1' },
            body: JSON.stringify({
                plantId: 'aloe-vera',
                type: 'water',
                notes: 'Auto-logged with liquid fertilizer',
                timestamp: sameTimestamp,
            }),
        });
        assert.strictEqual(waterRes.status, 201);

        // GET /plants/v2/logs returns BOTH water and fertilize latest logs!
        const latest = await (await fetch(`${base}/plants/v2/logs`, {
            headers: { 'x-home-id': 'home-1' },
        })).json();
        assert.strictEqual(latest.length, 2);
        const types = latest.map(l => l.type).sort();
        assert.deepStrictEqual(types, ['fertilize', 'water']);

        // Deleting the plant cleans up its logs
        const delRes = await fetch(`${base}/plants/my-plants/aloe-vera`, {
            method: 'DELETE',
            headers: { 'x-home-id': 'home-1' },
        });
        assert.strictEqual(delRes.status, 200);

        const afterDelLogs = await (await fetch(`${base}/plants/v2/logs`, {
            headers: { 'x-home-id': 'home-1' },
        })).json();
        assert.strictEqual(afterDelLogs.length, 0);
    });
});

test('POST /plants/my-plants/request stages unknown plant in plants-staging and creates Coming Soon card', async () => {
    const ddb = createFakeDdb();
    await withServer(ddb, async base => {
        const reqRes = await fetch(`${base}/plants/my-plants/request`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-home-id': 'home-1' },
            body: JSON.stringify({
                name: 'Monstera Thai Constellation',
                group: 'indoor',
                nickname: 'Corner Window',
            }),
        });
        assert.strictEqual(reqRes.status, 201);
        const { plant } = await reqRes.json();
        assert.strictEqual(plant.comingSoon, true);
        assert.strictEqual(plant.displayName, 'Monstera Thai Constellation (Corner Window)');
        assert.strictEqual(ddb.staging.has('monstera thai constellation'), true);

        const listRes = await (await fetch(`${base}/plants/my-plants`, {
            headers: { 'x-home-id': 'home-1' },
        })).json();
        assert.strictEqual(listRes.plants.length, 1);
        assert.strictEqual(listRes.plants[0].comingSoon, true);
    });
});
