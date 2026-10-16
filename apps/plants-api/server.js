const express = require('express');
const cors = require('cors');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { createLegacyLogsRouter } = require('./routes/legacy-logs');
const { createCatalogRouter } = require('./routes/plants-catalog');

const app = express();
const port = process.env.PORT || 3001;
const REGION = 'us-east-1';

app.use(express.json());
app.use(cors({
    origin: [/abhijeetkharkar\.com$/, /localhost/]
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

app.get('/health', (req, res) => res.json({ ok: true }));

// Care logs + settings, copied from the shared API (same contract, same tables)
app.use(createLegacyLogsRouter(ddb));

// Master plants catalog (read-only)
app.use(createCatalogRouter(ddb));

// Start server locally; export app for Lambda
if (require.main === module) {
    app.listen(port, () => console.log(`Plants API at http://localhost:${port}`));
}

module.exports = app;
