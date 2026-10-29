const express = require('express');
const cors = require('cors');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { JwtRsaVerifier } = require('aws-jwt-verify');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const {
    CognitoIdentityProviderClient,
    AdminGetUserCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { createLegacyLogsRouter } = require('./routes/legacy-logs');
const { createCatalogRouter } = require('./routes/plants-catalog');
const { createHomesRouter } = require('./routes/homes');
const { createHomePlantsRouter } = require('./routes/home-plants');
const { createCareLogsV2Router } = require('./routes/care-logs-v2');
const { createAuthMiddleware, createRequireHomeMiddleware } = require('./middleware/auth');

const app = express();
const port = process.env.PORT || 3001;
const REGION = 'us-east-1';

app.use(express.json());
app.use(cors({
    origin: [/abhijeetkharkar\.com$/, /localhost/],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Home-Id'],
}));

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

const USER_POOL_ID = process.env.USER_POOL_ID || 'us-east-1_placeholder';
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID || 'placeholder_client_id';

const verifier = JwtRsaVerifier.create({
    issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
    audience: USER_POOL_CLIENT_ID,
});

const sendEmail = async (to, subject, body) => {
    try {
        await sesClient.send(new SendEmailCommand({
            Source: 'plants@abhijeetkharkar.com',
            Destination: { ToAddresses: [to] },
            Message: {
                Subject: { Data: subject },
                Body: { Text: { Data: body } },
            },
        }));
    } catch (e) {
        console.error('Failed to send email to ' + to, e);
    }
};

const isUserInCognito = async (email) => {
    try {
        await cognitoClient.send(new AdminGetUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
        }));
        return true;
    } catch (err) {
        if (err.name === 'UserNotFoundException') return false;
        throw err;
    }
};

const authMiddleware = createAuthMiddleware(verifier);
const requireHomeMiddleware = createRequireHomeMiddleware(ddb);

app.get('/health', (req, res) => res.json({ ok: true }));

// Care logs + settings, copied from the shared API (same contract, same tables)
app.use(createLegacyLogsRouter(ddb));

// Authenticated routes: catalog, home profile, home creation/invite/delete, home plants, v2 logs
app.use('/plants/catalog', authMiddleware);
app.use('/plants/profile', authMiddleware);
app.use('/plants/homes', authMiddleware);
app.use('/plants/my-plants', authMiddleware, requireHomeMiddleware);
app.use('/plants/v2/logs', authMiddleware, requireHomeMiddleware);

app.use(createCatalogRouter(ddb));
app.use(createHomesRouter(ddb, { isUserInCognito, sendEmail }));
app.use(createHomePlantsRouter(ddb));
app.use(createCareLogsV2Router(ddb));

// Start server locally; export app for Lambda
if (require.main === module) {
    app.listen(port, () => console.log(`Plants API at http://localhost:${port}`));
}

module.exports = app;
