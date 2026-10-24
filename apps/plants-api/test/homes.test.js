const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { createAuthMiddleware, createRequireHomeMiddleware } = require('../middleware/auth');
const { createHomesRouter } = require('../routes/homes');

function createFakeDdb() {
    const homes = new Map(); // homeId -> item
    const userHomes = []; // array of { email, homeId, role, isDefault, joinedAt }

    return {
        homes,
        userHomes,
        async send(command) {
            const name = command.constructor.name;
            const input = command.input;

            if (name === 'QueryCommand' && input.TableName === 'plants-user-homes') {
                const email = input.ExpressionAttributeValues[':email'];
                return {
                    Items: userHomes.filter(u => u.email === email).map(u => ({ ...u })),
                };
            }

            if (name === 'GetCommand' && input.TableName === 'plants-homes') {
                const item = homes.get(input.Key.homeId);
                return { Item: item ? { ...item } : undefined };
            }

            if (name === 'PutCommand' && input.TableName === 'plants-homes') {
                homes.set(input.Item.homeId, { ...input.Item });
                return {};
            }

            if (name === 'PutCommand' && input.TableName === 'plants-user-homes') {
                const idx = userHomes.findIndex(
                    u => u.email === input.Item.email && u.homeId === input.Item.homeId
                );
                if (idx >= 0) userHomes[idx] = { ...input.Item };
                else userHomes.push({ ...input.Item });
                return {};
            }

            if (name === 'DeleteCommand' && input.TableName === 'plants-user-homes') {
                const idx = userHomes.findIndex(
                    u => u.email === input.Key.email && u.homeId === input.Key.homeId
                );
                if (idx >= 0) userHomes.splice(idx, 1);
                return {};
            }

            if (name === 'DeleteCommand' && input.TableName === 'plants-homes') {
                homes.delete(input.Key.homeId);
                return {};
            }

            throw new Error(`Unexpected command ${name} on ${input.TableName}`);
        },
    };
}

function createFakeVerifier() {
    return {
        async verify(token) {
            if (!token.startsWith('valid:')) {
                throw new Error('Bad token');
            }
            const email = token.slice('valid:'.length);
            return { email, sub: `sub-${email}` };
        },
    };
}

async function withServer(ddb, opts, fn) {
    const app = express();
    app.use(express.json());
    const auth = createAuthMiddleware(createFakeVerifier());
    const requireHome = createRequireHomeMiddleware(ddb);

    app.use('/plants', auth);
    app.use(createHomesRouter(ddb, opts));
    app.get('/plants/active-home', requireHome, (req, res) => {
        res.json({ homeId: req.homeId, role: req.homeRole });
    });

    const server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
    });
    try {
        await fn(`http://127.0.0.1:${server.address().port}`);
    } finally {
        server.close();
    }
}

function req(base, path, { method = 'GET', user = 'alice@example.com', body, headers = {} } = {}) {
    const h = { ...headers };
    if (user) h.authorization = `Bearer valid:${user}`;
    if (body !== undefined) h['content-type'] = 'application/json';
    return fetch(`${base}${path}`, {
        method,
        headers: h,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
}

test('auth middleware rejects missing or invalid tokens and normalizes email', async () => {
    const ddb = createFakeDdb();
    await withServer(ddb, {}, async base => {
        const noToken = await req(base, '/plants/profile', { user: null });
        assert.strictEqual(noToken.status, 401);

        const badToken = await fetch(`${base}/plants/profile`, {
            headers: { authorization: 'Bearer invalid' },
        });
        assert.strictEqual(badToken.status, 401);

        const ok = await req(base, '/plants/profile', { user: 'Alice@Example.com' });
        assert.strictEqual(ok.status, 200);
        const profile = await ok.json();
        assert.strictEqual(profile.email, 'alice@example.com');
        assert.deepStrictEqual(profile.homes, []);
        assert.strictEqual(profile.defaultHomeId, null);
    });
});

test('user can create up to 3 homes; 4th home is rejected; X-Home-Id switches active home', async () => {
    const ddb = createFakeDdb();
    await withServer(ddb, {}, async base => {
        const h1 = await (await req(base, '/plants/homes', { method: 'POST', body: { name: 'Home 1' } })).json();
        const h2 = await (await req(base, '/plants/homes', { method: 'POST', body: { name: 'Home 2' } })).json();
        const h3 = await (await req(base, '/plants/homes', { method: 'POST', body: { name: 'Home 3' } })).json();

        assert.strictEqual(h1.home.isDefault, true);
        assert.strictEqual(h2.home.isDefault, false);
        assert.strictEqual(h3.home.isDefault, false);

        const fourth = await req(base, '/plants/homes', { method: 'POST', body: { name: 'Home 4' } });
        assert.strictEqual(fourth.status, 400);
        assert.match((await fourth.json()).error, /at most 3 homes/);

        // Default home resolution
        const defActive = await (await req(base, '/plants/active-home')).json();
        assert.strictEqual(defActive.homeId, h1.home.homeId);

        // Explicit X-Home-Id resolution
        const switched = await (await req(base, '/plants/active-home', {
            headers: { 'x-home-id': h2.home.homeId },
        })).json();
        assert.strictEqual(switched.homeId, h2.home.homeId);

        // Non-member X-Home-Id is rejected with 403
        const forbidden = await req(base, '/plants/active-home', {
            headers: { 'x-home-id': 'not-my-home' },
        });
        assert.strictEqual(forbidden.status, 403);
    });
});

test('invite enforces 4-member home cap and 3-home invitee cap, and sends SES email', async () => {
    const ddb = createFakeDdb();
    const sentEmails = [];
    const opts = {
        isUserInCognito: async email => email === 'bob@example.com',
        sendEmail: async (to, subject, body) => sentEmails.push({ to, subject, body }),
    };

    await withServer(ddb, opts, async base => {
        const { home } = await (await req(base, '/plants/homes', {
            method: 'POST',
            user: 'owner@example.com',
            body: { name: 'Kharkar Garden' },
        })).json();

        // Invite 3 members (total 4 including owner)
        for (const member of ['bob@example.com', 'carol@example.com', 'dave@example.com']) {
            const r = await req(base, `/plants/homes/${home.homeId}/invite`, {
                method: 'POST',
                user: 'owner@example.com',
                body: { inviteEmail: member },
            });
            assert.strictEqual(r.status, 200);
        }

        assert.strictEqual(sentEmails.length, 3);
        assert.match(sentEmails[0].subject, /added to Kharkar Garden/); // Bob in Cognito
        assert.match(sentEmails[1].subject, /Invitation to join Kharkar Garden/); // Carol not in Cognito

        // 5th member rejected
        const fifth = await req(base, `/plants/homes/${home.homeId}/invite`, {
            method: 'POST',
            user: 'owner@example.com',
            body: { inviteEmail: 'eve@example.com' },
        });
        assert.strictEqual(fifth.status, 400);
        assert.match((await fifth.json()).error, /at most 4 members/);

        // If an invitee already has 3 homes, inviting them to another home fails
        for (let i = 1; i <= 3; i++) {
            await req(base, '/plants/homes', {
                method: 'POST',
                user: 'busy@example.com',
                body: { name: `Busy Home ${i}` },
            });
        }
        const { home: secondHome } = await (await req(base, '/plants/homes', {
            method: 'POST',
            user: 'owner@example.com',
            body: { name: 'Second Garden' },
        })).json();

        const busyInvite = await req(base, `/plants/homes/${secondHome.homeId}/invite`, {
            method: 'POST',
            user: 'owner@example.com',
            body: { inviteEmail: 'busy@example.com' },
        });
        assert.strictEqual(busyInvite.status, 400);
        assert.match((await busyInvite.json()).error, /maximum of 3 homes/);
    });
});

test('only the home creator can delete a home, and deletion cleans up all members', async () => {
    const ddb = createFakeDdb();
    await withServer(ddb, {}, async base => {
        const { home } = await (await req(base, '/plants/homes', {
            method: 'POST',
            user: 'owner@example.com',
            body: { name: 'Shared Home' },
        })).json();

        await req(base, `/plants/homes/${home.homeId}/invite`, {
            method: 'POST',
            user: 'owner@example.com',
            body: { inviteEmail: 'member@example.com' },
        });

        // Invited member cannot delete the home
        const memberDel = await req(base, `/plants/homes/${home.homeId}`, {
            method: 'DELETE',
            user: 'member@example.com',
        });
        assert.strictEqual(memberDel.status, 403);

        // Creator can delete the home
        const ownerDel = await req(base, `/plants/homes/${home.homeId}`, {
            method: 'DELETE',
            user: 'owner@example.com',
        });
        assert.strictEqual(ownerDel.status, 200);

        // Both owner and member now have 0 homes
        const ownerProfile = await (await req(base, '/plants/profile', { user: 'owner@example.com' })).json();
        const memberProfile = await (await req(base, '/plants/profile', { user: 'member@example.com' })).json();
        assert.strictEqual(ownerProfile.homes.length, 0);
        assert.strictEqual(memberProfile.homes.length, 0);
    });
});
