const { QueryCommand } = require('@aws-sdk/lib-dynamodb');

const USER_HOMES_TABLE = process.env.USER_HOMES_TABLE_NAME || 'plants-user-homes';

/**
 * Verifies Cognito ID token from `Authorization: Bearer <token>` and attaches
 * `req.user = { email, sub }`.
 */
function createAuthMiddleware(verifier) {
    return async (req, res, next) => {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (!token) {
            return res.status(401).json({ error: 'Missing Authorization header' });
        }

        try {
            const payload = await verifier.verify(token);
            const email = String(payload.email || '').trim().toLowerCase();
            if (!email) {
                return res.status(401).json({ error: 'Token does not contain an email claim' });
            }
            req.user = { email, sub: payload.sub };
            next();
        } catch (err) {
            console.error('Token invalid:', err.message || err);
            return res.status(401).json({ error: 'Invalid token' });
        }
    };
}

/**
 * Resolves `req.homeId` and `req.homeRole` for the authenticated user.
 * Honors `X-Home-Id` header if provided (and verifies membership);
 * otherwise falls back to the user's default or first home.
 */
function createRequireHomeMiddleware(ddb) {
    return async (req, res, next) => {
        if (!req.user?.email) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        try {
            const r = await ddb.send(new QueryCommand({
                TableName: USER_HOMES_TABLE,
                KeyConditionExpression: 'email = :email',
                ExpressionAttributeValues: { ':email': req.user.email },
            }));
            const memberships = r.Items || [];
            if (memberships.length === 0) {
                return res.status(403).json({ error: 'No home found for this user.' });
            }

            const requestedHomeId = req.headers['x-home-id'];
            let chosen;
            if (requestedHomeId) {
                chosen = memberships.find(m => m.homeId === requestedHomeId);
                if (!chosen) {
                    return res.status(403).json({ error: 'You are not a member of the requested home.' });
                }
            } else {
                chosen = memberships.find(m => m.isDefault) || memberships[0];
            }

            req.homeId = chosen.homeId;
            req.homeRole = chosen.role || 'member';
            next();
        } catch (err) {
            console.error('requireHome error:', err);
            return res.status(500).json({ error: err.message });
        }
    };
}

module.exports = {
    createAuthMiddleware,
    createRequireHomeMiddleware,
};
