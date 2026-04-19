const express = require('express');
const path = require('path');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');

const app = express();
const port = 3000;
const TABLE_NAME = 'tracker-tasks';
const REGION = 'us-east-1';

app.use(express.json());

// Static files + SPA fallback — local only (CloudFront + S3 handles this in prod)
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    app.use(express.static('public'));
}

// DynamoDB client — locally uses 'admin' profile; on Lambda uses IAM role
const clientConfig = { region: REGION };
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const { fromIni } = require('@aws-sdk/credential-provider-ini');
    clientConfig.credentials = fromIni({ profile: 'admin' });
}
const client = new DynamoDBClient(clientConfig);
const ddb = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
});

// ─── GET /api/tasks ──────────────────────────────────────────────────────────
app.get('/api/tasks', async (req, res) => {
    try {
        const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
        const tasks = (result.Items || [])
            .sort((a, b) => (a.target_date || '').localeCompare(b.target_date || ''));
        res.json(tasks);
    } catch (err) {
        console.error('GET /api/tasks error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/tasks/toggle ──────────────────────────────────────────────────
app.post('/api/tasks/toggle', async (req, res) => {
    try {
        const { id, completed, subtasks } = req.body;
        const completed_at = completed ? new Date().toLocaleString() : null;

        await ddb.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { id },
            UpdateExpression: 'SET completed = :c, completed_at = :ca, subtasks = :s',
            ExpressionAttributeValues: {
                ':c': completed ? 1 : 0,
                ':ca': completed_at,
                ':s': subtasks,
            },
        }));
        res.json({ success: true, completed_at });
    } catch (err) {
        console.error('POST /api/tasks/toggle error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/tasks/owner ───────────────────────────────────────────────────
app.post('/api/tasks/owner', async (req, res) => {
    try {
        const { id, owner, subtasks } = req.body;

        await ddb.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { id },
            UpdateExpression: 'SET #o = :o, subtasks = :s',
            ExpressionAttributeNames: { '#o': 'owner' },
            ExpressionAttributeValues: {
                ':o': owner || null,
                ':s': subtasks,
            },
        }));
        res.json({ success: true });
    } catch (err) {
        console.error('POST /api/tasks/owner error:', err);
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
