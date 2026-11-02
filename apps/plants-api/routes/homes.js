const express = require('express');
const { randomUUID } = require('crypto');
const {
    QueryCommand,
    GetCommand,
    PutCommand,
    DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');

const HOMES_TABLE = process.env.HOMES_TABLE_NAME || 'plants-homes';
const USER_HOMES_TABLE = process.env.USER_HOMES_TABLE_NAME || 'plants-user-homes';

const MAX_HOMES_PER_USER = 3;
const MAX_MEMBERS_PER_HOME = 4;
const PROFILE_SK = 'PROFILE';

async function getUserRows(ddb, email) {
    const r = await ddb.send(new QueryCommand({
        TableName: USER_HOMES_TABLE,
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email },
    }));
    return r.Items || [];
}

async function getUserMemberships(ddb, email) {
    const rows = await getUserRows(ddb, email);
    return rows.filter(item => item.homeId !== PROFILE_SK);
}

function normalizeUserProfile(profileRow) {
    return {
        firstName: profileRow?.firstName || '',
        lastName: profileRow?.lastName || '',
        phoneNumber: profileRow?.phoneNumber || '',
        notifications: {
            careReminders: profileRow?.notifications?.careReminders ?? true,
            email: profileRow?.notifications?.email ?? true,
            sms: profileRow?.notifications?.sms ?? false,
        },
        updatedAt: profileRow?.updatedAt || null,
    };
}

async function listEnrichedUserHomes(ddb, email) {
    const memberships = await getUserMemberships(ddb, email);
    const homes = [];
    for (const m of memberships) {
        const homeRes = await ddb.send(new GetCommand({
            TableName: HOMES_TABLE,
            Key: { homeId: m.homeId },
        }));
        if (!homeRes.Item) continue;
        homes.push({
            ...homeRes.Item,
            role: m.role || (homeRes.Item.createdBy === email ? 'owner' : 'member'),
            isDefault: Boolean(m.isDefault),
            joinedAt: m.joinedAt,
        });
    }
    homes.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    return homes;
}

/**
 * Home profile, creation, family member invitation, and owner-only home deletion.
 * Quotas:
 *  - Max 3 homes per user (MAX_HOMES_PER_USER = 3)
 *  - Max 4 members per home (MAX_MEMBERS_PER_HOME = 4)
 */
function createHomesRouter(ddb, { isUserInCognito, sendEmail } = {}) {
    const router = express.Router();

    // ─── GET /plants/profile ─────────────────────────────────────────────────
    router.get('/plants/profile', async (req, res) => {
        try {
            const email = req.user.email;
            const rows = await getUserRows(ddb, email);
            const profileRow = rows.find(r => r.homeId === PROFILE_SK);
            const homes = await listEnrichedUserHomes(ddb, email);
            const defaultHome = homes.find(h => h.isDefault) || homes[0] || null;
            res.json({
                email,
                userProfile: normalizeUserProfile(profileRow),
                homes,
                defaultHomeId: defaultHome ? defaultHome.homeId : null,
            });
        } catch (err) {
            console.error('GET /plants/profile error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─── PUT /plants/profile ─────────────────────────────────────────────────
    router.put('/plants/profile', async (req, res) => {
        try {
            const email = req.user.email;
            const firstName = String(req.body?.firstName ?? '').trim().slice(0, 60);
            const lastName = String(req.body?.lastName ?? '').trim().slice(0, 60);
            const phoneNumber = String(req.body?.phoneNumber ?? '').trim().slice(0, 30);
            const rawNotif = req.body?.notifications || {};
            const notifications = {
                careReminders: Boolean(rawNotif.careReminders ?? true),
                email: Boolean(rawNotif.email ?? true),
                sms: Boolean(rawNotif.sms ?? false),
            };
            const now = new Date().toISOString();

            const item = {
                email,
                homeId: PROFILE_SK,
                firstName,
                lastName,
                phoneNumber,
                notifications,
                updatedAt: now,
            };

            await ddb.send(new PutCommand({
                TableName: USER_HOMES_TABLE,
                Item: item,
            }));

            res.json({
                userProfile: normalizeUserProfile(item),
            });
        } catch (err) {
            console.error('PUT /plants/profile error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─── POST /plants/homes ──────────────────────────────────────────────────
    router.post('/plants/homes', async (req, res) => {
        try {
            const email = req.user.email;
            const rawName = String(req.body?.name || '').trim();
            if (!rawName) {
                return res.status(400).json({ error: 'Home name is required.' });
            }
            if (rawName.length > 60) {
                return res.status(400).json({ error: 'Home name must be 60 characters or fewer.' });
            }

            const existingMemberships = await getUserMemberships(ddb, email);
            if (existingMemberships.length >= MAX_HOMES_PER_USER) {
                return res.status(400).json({
                    error: `You can belong to at most ${MAX_HOMES_PER_USER} homes.`,
                });
            }

            const now = new Date().toISOString();
            const homeId = randomUUID();
            const isDefault = existingMemberships.length === 0;

            const homeItem = {
                homeId,
                name: rawName,
                createdBy: email,
                members: [email],
                onboardingComplete: false,
                createdAt: now,
            };

            const membershipItem = {
                email,
                homeId,
                role: 'owner',
                isDefault,
                joinedAt: now,
            };

            await ddb.send(new PutCommand({ TableName: HOMES_TABLE, Item: homeItem }));
            await ddb.send(new PutCommand({ TableName: USER_HOMES_TABLE, Item: membershipItem }));

            res.status(201).json({
                home: {
                    ...homeItem,
                    role: 'owner',
                    isDefault,
                    joinedAt: now,
                },
            });
        } catch (err) {
            console.error('POST /plants/homes error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─── PATCH /plants/homes/:homeId ─────────────────────────────────────────
    router.patch('/plants/homes/:homeId', async (req, res) => {
        try {
            const email = req.user.email;
            const { homeId } = req.params;

            const memberships = await getUserMemberships(ddb, email);
            const membership = memberships.find(m => m.homeId === homeId);
            if (!membership) {
                return res.status(403).json({ error: 'You are not a member of this home.' });
            }

            const homeRes = await ddb.send(new GetCommand({
                TableName: HOMES_TABLE,
                Key: { homeId },
            }));
            if (!homeRes.Item) {
                return res.status(404).json({ error: 'Home not found.' });
            }

            const next = { ...homeRes.Item };
            if (typeof req.body?.onboardingComplete === 'boolean') {
                next.onboardingComplete = req.body.onboardingComplete;
            }
            if (typeof req.body?.name === 'string' && req.body.name.trim()) {
                next.name = req.body.name.trim().slice(0, 60);
            }

            await ddb.send(new PutCommand({
                TableName: HOMES_TABLE,
                Item: next,
            }));

            res.json({
                home: {
                    ...next,
                    role: membership.role || (next.createdBy === email ? 'owner' : 'member'),
                    isDefault: Boolean(membership.isDefault),
                    joinedAt: membership.joinedAt,
                },
            });
        } catch (err) {
            console.error('PATCH /plants/homes/:homeId error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─── POST /plants/homes/:homeId/invite ───────────────────────────────────
    router.post('/plants/homes/:homeId/invite', async (req, res) => {
        try {
            const email = req.user.email;
            const { homeId } = req.params;
            const inviteEmail = String(req.body?.inviteEmail || '').trim().toLowerCase();

            if (!inviteEmail || !inviteEmail.includes('@')) {
                return res.status(400).json({ error: 'A valid inviteEmail is required.' });
            }

            // 1. Ensure requester is a member of this home
            const requesterMemberships = await getUserMemberships(ddb, email);
            if (!requesterMemberships.some(m => m.homeId === homeId)) {
                return res.status(403).json({ error: 'You are not a member of this home.' });
            }

            // 2. Load the home
            const homeRes = await ddb.send(new GetCommand({
                TableName: HOMES_TABLE,
                Key: { homeId },
            }));
            if (!homeRes.Item) {
                return res.status(404).json({ error: 'Home not found.' });
            }
            const home = homeRes.Item;
            const members = home.members || [];

            if (members.includes(inviteEmail)) {
                return res.status(400).json({ error: 'This user is already a member of this home.' });
            }

            // 3. Enforce max 4 members per home
            if (members.length >= MAX_MEMBERS_PER_HOME) {
                return res.status(400).json({
                    error: `A home can have at most ${MAX_MEMBERS_PER_HOME} members.`,
                });
            }

            // 4. Enforce max 3 homes for the invited user
            const inviteeMemberships = await getUserMemberships(ddb, inviteEmail);
            if (inviteeMemberships.length >= MAX_HOMES_PER_USER) {
                return res.status(400).json({
                    error: `This user already belongs to the maximum of ${MAX_HOMES_PER_USER} homes.`,
                });
            }

            const now = new Date().toISOString();
            const updatedMembers = [...members, inviteEmail];

            await ddb.send(new PutCommand({
                TableName: USER_HOMES_TABLE,
                Item: {
                    email: inviteEmail,
                    homeId,
                    role: 'member',
                    isDefault: inviteeMemberships.length === 0,
                    joinedAt: now,
                },
            }));

            await ddb.send(new PutCommand({
                TableName: HOMES_TABLE,
                Item: {
                    ...home,
                    members: updatedMembers,
                },
            }));

            // 5. Send notification email via SES if configured
            let userInSystem = false;
            if (typeof isUserInCognito === 'function') {
                userInSystem = await isUserInCognito(inviteEmail);
            }
            if (typeof sendEmail === 'function') {
                const homeName = home.name || 'a shared home';
                if (userInSystem) {
                    await sendEmail(
                        inviteEmail,
                        `You have been added to ${homeName} on Plants Tracker!`,
                        `Hello!\n\n${email} has added your account to "${homeName}" on Plants Tracker.\n\nSign in at https://plants.abhijeetkharkar.com to view and care for the plants together!`
                    );
                } else {
                    await sendEmail(
                        inviteEmail,
                        `Invitation to join ${homeName} on Plants Tracker!`,
                        `Hello!\n\n${email} has invited you to join "${homeName}" on Plants Tracker.\n\nGo to https://plants.abhijeetkharkar.com and create an account with this email address (${inviteEmail}) to automatically see the shared home & garden!`
                    );
                }
            }

            res.json({
                success: true,
                userInSystem,
                members: updatedMembers,
            });
        } catch (err) {
            console.error('POST /plants/homes/:homeId/invite error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─── DELETE /plants/homes/:homeId (owner only) ───────────────────────────
    router.delete('/plants/homes/:homeId', async (req, res) => {
        try {
            const email = req.user.email;
            const { homeId } = req.params;

            const homeRes = await ddb.send(new GetCommand({
                TableName: HOMES_TABLE,
                Key: { homeId },
            }));
            if (!homeRes.Item) {
                return res.status(404).json({ error: 'Home not found.' });
            }
            const home = homeRes.Item;

            if (home.createdBy !== email) {
                return res.status(403).json({
                    error: 'Only the home creator can delete this home.',
                });
            }

            // Remove membership links for all members of this home
            const members = home.members || [email];
            for (const memberEmail of members) {
                await ddb.send(new DeleteCommand({
                    TableName: USER_HOMES_TABLE,
                    Key: { email: memberEmail, homeId },
                }));
            }

            // Delete the home record itself
            await ddb.send(new DeleteCommand({
                TableName: HOMES_TABLE,
                Key: { homeId },
            }));

            res.json({ deleted: true, homeId });
        } catch (err) {
            console.error('DELETE /plants/homes/:homeId error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}

module.exports = {
    createHomesRouter,
    MAX_HOMES_PER_USER,
    MAX_MEMBERS_PER_HOME,
};
