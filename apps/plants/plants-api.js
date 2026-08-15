import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME;

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.requestContext?.http?.path || event.path || '/';
  const parts = path.replace(/^\/api/, '').split('/').filter(Boolean);

  try {
    // GET /api/logs?plantId=xxx  — get logs for a specific plant (latest first)
    // GET /api/logs              — get latest log per plant (for dashboard)
    if (method === 'GET' && parts[0] === 'logs') {
      const plantId = event.queryStringParameters?.plantId;

      if (plantId) {
        const result = await client.send(new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: 'plantId = :pid',
          ExpressionAttributeValues: { ':pid': plantId },
          ScanIndexForward: false,  // newest first
          Limit: 50,
        }));
        return response(200, result.Items || []);
      } else {
        // Scan all and return latest per plant
        const result = await client.send(new ScanCommand({ TableName: TABLE }));
        const items = result.Items || [];
        // Group by plantId, keep latest
        const latestByPlant = {};
        for (const item of items) {
          if (!latestByPlant[item.plantId] || item.timestamp > latestByPlant[item.plantId].timestamp) {
            latestByPlant[item.plantId] = item;
          }
        }
        return response(200, Object.values(latestByPlant));
      }
    }

    // POST /api/logs — create a care log
    if (method === 'POST' && parts[0] === 'logs') {
      const body = JSON.parse(event.body || '{}');
      const { plantId, type, fertilizer, notes } = body;

      if (!plantId || !type) {
        return response(400, { error: 'plantId and type are required' });
      }

      const timestamp = new Date().toISOString();
      const logId = randomUUID();

      const item = {
        plantId,
        timestamp,
        logId,
        type,
        ...(fertilizer && { fertilizer }),
        ...(notes && { notes }),
      };

      await client.send(new PutCommand({ TableName: TABLE, Item: item }));
      return response(201, item);
    }

    // DELETE /api/logs/:plantId/:timestamp
    if (method === 'DELETE' && parts[0] === 'logs' && parts[1] && parts[2]) {
      const plantId = decodeURIComponent(parts[1]);
      const timestamp = decodeURIComponent(parts[2]);

      await client.send(new DeleteCommand({
        TableName: TABLE,
        Key: { plantId, timestamp },
      }));
      return response(200, { deleted: true });
    }

    return response(404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    return response(500, { error: err.message });
  }
}
