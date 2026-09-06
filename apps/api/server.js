const express = require('express');
const cors = require('cors');
const path = require('path');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  DeleteCommand,
  GetCommand,
  BatchWriteCommand
} = require('@aws-sdk/lib-dynamodb');
const { JwtRsaVerifier } = require('aws-jwt-verify');
const { randomUUID } = require('crypto');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { CognitoIdentityProviderClient, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');

const app = express();
const port = 3000;

// Read from Env
const BABY_PROFILES_TABLE = process.env.BABY_PROFILES_TABLE_NAME || 'baby-profiles';
const BABIES_TABLE = process.env.BABIES_TABLE_NAME || 'babies';
const TRACKER_TABLE = process.env.BABY_LOGS_TABLE_NAME || 'baby-tracker-logs';
const PLANTS_TABLE = process.env.PLANTS_TABLE_NAME || 'plants-care-logs';
const REGION = 'us-east-1';

app.use(express.json());
app.use(cors({
    origin: [/abhijeetkharkar\.com$/, /localhost/]
}));

if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    app.use(express.static('public'));
}

const clientConfig = { region: REGION };
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const { fromIni } = require('@aws-sdk/credential-provider-ini');
    clientConfig.credentials = fromIni({ profile: 'admin' });
}
const client = new DynamoDBClient(clientConfig);
const ddb = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
});

const sesClient = new SESClient(clientConfig);
const cognitoClient = new CognitoIdentityProviderClient(clientConfig);

const USER_POOL_ID = process.env.USER_POOL_ID || 'us-east-1_SFrRMOVHi';
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID || '6ci895vprgja3c4ts2kit1urvl';

const verifier = JwtRsaVerifier.create({
  issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
  audience: USER_POOL_CLIENT_ID, // ID token
});

const sendEmail = async (to, subject, body) => {
    try {
        await sesClient.send(new SendEmailCommand({
            Source: 'babytracker@abhijeetkharkar.com',
            Destination: { ToAddresses: [to] },
            Message: {
                Subject: { Data: subject },
                Body: { Text: { Data: body } }
            }
        }));
    } catch (e) {
        console.error("Failed to send email to " + to, e);
    }
};

const isUserInCognito = async (email) => {
    try {
        await cognitoClient.send(new AdminGetUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: email
        }));
        return true;
    } catch (err) {
        if (err.name === 'UserNotFoundException') return false;
        throw err;
    }
};

// Middleware for authentication
const authMiddleware = async (req, res, next) => {
    // Only protect /tracker routes
    if (!req.path.startsWith('/tracker')) return next();
    
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Missing Authorization header" });
    
    try {
        const payload = await verifier.verify(token);
        req.user = { email: payload.email, sub: payload.sub };
        next();
    } catch (err) {
        console.error("Token invalid", err);
        return res.status(401).json({ error: "Invalid token" });
    }
};

app.use(authMiddleware);

// Middleware to resolve babyId for a user
const requireBaby = async (req, res, next) => {
    // Only protect /tracker routes that need a baby profile
    if (!req.path.startsWith('/tracker')) return next();
    if (req.path === '/tracker/profile' || req.path.startsWith('/tracker/profile/')) return next();
    
    try {
        const profileRes = await ddb.send(new GetCommand({
            TableName: BABY_PROFILES_TABLE,
            Key: { email: req.user.email }
        }));
        if (!profileRes.Item || !profileRes.Item.babyId) {
            return res.status(403).json({ error: "No baby profile found for this user." });
        }
        req.babyId = profileRes.Item.babyId;
        next();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

app.use(requireBaby);

function getDatesInRange(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

// ─── PROFILE ENDPOINTS ───────────────────────────────────────────────────────

app.get('/tracker/profile', async (req, res) => {
    try {
        const profileRes = await ddb.send(new GetCommand({
            TableName: BABY_PROFILES_TABLE,
            Key: { email: req.user.email }
        }));
        if (!profileRes.Item) return res.status(404).json({ error: "Profile not found" });
        
        const babyRes = await ddb.send(new GetCommand({
            TableName: BABIES_TABLE,
            Key: { babyId: profileRes.Item.babyId }
        }));
        
        res.json({ email: req.user.email, baby: babyRes.Item });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/tracker/profile', async (req, res) => {
    try {
        const email = req.user.email;
        const { name, gender, dob } = req.body;
        
        const existing = await ddb.send(new GetCommand({
            TableName: BABY_PROFILES_TABLE,
            Key: { email }
        }));
        if (existing.Item) return res.status(400).json({ error: "Profile already exists" });

        const babyId = randomUUID();
        const babyItem = { babyId, name, gender, dob, parents: [email] };
        
        await ddb.send(new PutCommand({ TableName: BABIES_TABLE, Item: babyItem }));
        await ddb.send(new PutCommand({ TableName: BABY_PROFILES_TABLE, Item: { email, babyId } }));
        
        res.json({ email, baby: babyItem });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/tracker/profile/invite', async (req, res) => {
    try {
        const email = req.user.email;
        const { inviteEmail } = req.body;
        if (!inviteEmail) return res.status(400).json({ error: "inviteEmail required" });
        
        // 1. Check if the invited email already has a baby profile linked
        const invitedProfileRes = await ddb.send(new GetCommand({ TableName: BABY_PROFILES_TABLE, Key: { email: inviteEmail } }));
        if (invitedProfileRes.Item) {
            return res.status(400).json({ error: "This email address is already linked to a baby profile." });
        }
        
        // 2. Ensure inviter actually has a profile
        const profileRes = await ddb.send(new GetCommand({ TableName: BABY_PROFILES_TABLE, Key: { email } }));
        if (!profileRes.Item) return res.status(404).json({ error: "Profile not found" });
        
        const babyId = profileRes.Item.babyId;
        const babyRes = await ddb.send(new GetCommand({ TableName: BABIES_TABLE, Key: { babyId } }));
        const babyName = babyRes.Item.name || 'your baby';
        
        // 3. Link them to the baby profile
        await ddb.send(new PutCommand({ TableName: BABY_PROFILES_TABLE, Item: { email: inviteEmail, babyId } }));
        
        const parents = babyRes.Item.parents || [];
        if (!parents.includes(inviteEmail)) {
            parents.push(inviteEmail);
            await ddb.send(new PutCommand({ TableName: BABIES_TABLE, Item: { ...babyRes.Item, parents } }));
        }
        
        // 4. Send the appropriate email
        const userInSystem = await isUserInCognito(inviteEmail);
        
        if (userInSystem) {
            await sendEmail(
                inviteEmail, 
                `You have been linked to ${babyName}'s Tracker!`, 
                `Hello!\n\n${email} has successfully linked your account to ${babyName}'s profile.\n\nYou can now log in at https://babytracker.abhijeetkharkar.com to view and add logs.`
            );
        } else {
            await sendEmail(
                inviteEmail, 
                `Invitation to join ${babyName}'s Tracker!`, 
                `Hello!\n\n${email} has invited you to join ${babyName}'s tracker.\n\nPlease go to https://babytracker.abhijeetkharkar.com and create an account with this email address to automatically see the shared dashboard!`
            );
        }
        
        res.json({ success: true, userInSystem });
    } catch (err) {
        console.error("Invite error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ─── LOGS ENDPOINTS ──────────────────────────────────────────────────────────

app.get('/tracker/logs', async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) return res.status(400).json({ error: 'from and to required' });

        const dates = getDatesInRange(from, to);
        const promises = dates.map(date => 
            ddb.send(new QueryCommand({
                TableName: TRACKER_TABLE,
                KeyConditionExpression: '#pk = :pk',
                ExpressionAttributeNames: { '#pk': 'babyId#date' },
                ExpressionAttributeValues: { ':pk': `${req.babyId}#${date}` }
            }))
        );

        const results = await Promise.all(promises);
        const logs = results.flatMap(r => r.Items || []);
        
        logs.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.logId.localeCompare(b.logId);
        });

        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/tracker/logs/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const result = await ddb.send(new QueryCommand({
            TableName: TRACKER_TABLE,
            KeyConditionExpression: '#pk = :pk',
            ExpressionAttributeNames: { '#pk': 'babyId#date' },
            ExpressionAttributeValues: { ':pk': `${req.babyId}#${date}` }
        }));
        res.json(result.Items || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/tracker/logs', async (req, res) => {
    try {
        const { date, category, ...rest } = req.body;
        if (!date || !category) return res.status(400).json({ error: 'date and category required' });

        const logId = `${category}#${new Date().toISOString()}`;
        const item = { 
            'babyId#date': `${req.babyId}#${date}`,
            date, 
            logId, 
            category, 
            ...rest 
        };

        await ddb.send(new PutCommand({ TableName: TRACKER_TABLE, Item: item }));
        res.status(201).json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/tracker/logs/:date/:logId', async (req, res) => {
    try {
        const { date, logId } = req.params;
        const item = { 
            ...req.body, 
            'babyId#date': `${req.babyId}#${date}`,
            date, 
            logId 
        };
        await ddb.send(new PutCommand({ TableName: TRACKER_TABLE, Item: item }));
        res.status(200).json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/tracker/logs/:date/:logId', async (req, res) => {
    try {
        const { date, logId } = req.params;
        await ddb.send(new DeleteCommand({
            TableName: TRACKER_TABLE,
            Key: { 'babyId#date': `${req.babyId}#${date}`, logId }
        }));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/tracker/logs/bulk', async (req, res) => {
    try {
        const items = req.body;
        if (!Array.isArray(items)) return res.status(400).json({ error: 'Body must be an array' });

        for (let i = 0; i < items.length; i += 25) {
            const batch = items.slice(i, i + 25);
            const putRequests = batch.map(item => {
                if (!item.logId) item.logId = `${item.category}#${new Date().toISOString()}`;
                item['babyId#date'] = `${req.babyId}#${item.date}`;
                return { PutRequest: { Item: item } };
            });

            await ddb.send(new BatchWriteCommand({
                RequestItems: { [TRACKER_TABLE]: putRequests }
            }));
        }
        res.json({ success: true, count: items.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── SUMMARY ENDPOINT ────────────────────────────────────────────────────────

app.get('/tracker/summary', async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) return res.status(400).json({ error: 'from and to required' });

        const queryStartDate = new Date(from);
        queryStartDate.setDate(queryStartDate.getDate() - 1);
        const fromMinusOne = queryStartDate.toISOString().split('T')[0];

        const queryDates = getDatesInRange(fromMinusOne, to);
        const reportDates = getDatesInRange(from, to);

        const promises = queryDates.map(date => 
            ddb.send(new QueryCommand({
                TableName: TRACKER_TABLE,
                KeyConditionExpression: '#pk = :pk',
                ExpressionAttributeNames: { '#pk': 'babyId#date' },
                ExpressionAttributeValues: { ':pk': `${req.babyId}#${date}` }
            }))
        );

        const results = await Promise.all(promises);
        const logs = results.flatMap(r => r.Items || []);
        
        const summaryByDate = {};
        for (const date of reportDates) {
            summaryByDate[date] = {
                date,
                diaperCount: { wet: 0, dirty: 0 },
                feedCount: 0,
                feedTotalMinutes: 0,
                sleepTotalHours: 0,
                tummyTimeCount: 0,
                vitaminD: false,
                massage: false,
                bath: false
            };
        }

        const getMinutes = (start, end) => {
            if (!start || !end) return 0;
            const [sh, sm] = start.split(':').map(Number);
            const [eh, em] = end.split(':').map(Number);
            return (eh * 60 + em) - (sh * 60 + sm);
        };

        const calcDuration = (startStr, endStr) => {
            if (!startStr || !endStr) return null;
            const crossesMidnight = endStr < startStr;
            if (crossesMidnight) {
                const part1 = getMinutes(startStr, '23:59') + 1;
                const part2 = getMinutes('00:00', endStr);
                return { part1, part2, crossesMidnight: true };
            }
            const mins = getMinutes(startStr, endStr);
            return { part1: mins, part2: 0, crossesMidnight: false };
        };

        for (const log of logs) {
            const startStr = log.startTime || log.time;
            const endStr = log.endTime;

            if ((log.category === 'sleep' || log.category === 'feed') && !endStr) continue;

            const dur = calcDuration(startStr, endStr);
            const crossesMidnight = dur ? dur.crossesMidnight : false;

            const sum1 = summaryByDate[log.date];
            if (sum1) {
                if (log.category === 'diaper') {
                    if (log.type === 'wet' || log.type === 'both') sum1.diaperCount.wet++;
                    if (log.type === 'dirty' || log.type === 'both') sum1.diaperCount.dirty++;
                } else if (log.category === 'feed') {
                    sum1.feedCount++;
                    let min1 = dur ? dur.part1 : 0;
                    if (min1 > 20) min1 = 15;
                    sum1.feedTotalMinutes += min1;
                } else if (log.category === 'sleep') {
                    let min1 = dur ? dur.part1 : 0;
                    sum1.sleepTotalHours += (min1 / 60);
                } else if (log.category === 'tummyTime') {
                    sum1.tummyTimeCount++;
                } else if (log.category === 'vitaminD') {
                    sum1.vitaminD = true;
                } else if (log.category === 'massage') {
                    sum1.massage = true;
                } else if (log.category === 'bath') {
                    sum1.bath = true;
                }
            }

            if (crossesMidnight) {
                const nextDate = new Date(log.date);
                nextDate.setDate(nextDate.getDate() + 1);
                const nextDateStr = nextDate.toISOString().split('T')[0];
                const sum2 = summaryByDate[nextDateStr];
                
                if (sum2) {
                    if (log.category === 'feed') {
                        let min2 = dur ? dur.part2 : 0;
                        if (min2 > 20) min2 = 15;
                        sum2.feedTotalMinutes += min2;
                    } else if (log.category === 'sleep') {
                        let min2 = dur ? dur.part2 : 0;
                        sum2.sleepTotalHours += (min2 / 60);
                    }
                }
            }
        }

        res.json(Object.values(summaryByDate));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});





// ═════════════════════════════════════════════════════════════════════════════
// ─── PLANTS API ─────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

// ─── GET /plants/logs ────────────────────────────────────────────────────────
app.get('/plants/logs', async (req, res) => {
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
        const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
        const r = await ddb.send(new ScanCommand({ TableName: PLANTS_TABLE }));
        const items = r.Items || [];
        const latest = {};
        for (const item of items) {
            const key = `${item.plantId}__${item.type}`;
            if (!latest[key] || item.timestamp > latest[key].timestamp) latest[key] = item;
        }
        res.json(Object.values(latest));
    } catch (err) {
        console.error('GET /plants/logs error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /plants/logs ───────────────────────────────────────────────────────
app.post('/plants/logs', async (req, res) => {
    try {
        const { plantId, type, fertilizer, notes } = req.body;
        if (!plantId || !type) return res.status(400).json({ error: 'plantId and type are required' });
        
        const { randomUUID } = require('crypto');
        const item = {
            plantId,
            timestamp: new Date().toISOString(),
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

// ─── DELETE /plants/logs/:plantId/:timestamp ─────────────────────────────────
app.delete('/plants/logs/:plantId/:timestamp', async (req, res) => {
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


// SPA fallback — local only
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
}

// Start server locally; export app for Lambda
if (require.main === module) {
    app.listen(port, () => console.log(`Server at http://localhost:${port}`));
}

module.exports = app;
