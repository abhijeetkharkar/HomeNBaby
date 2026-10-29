/**
 * One-time CLI script to migrate legacy single-user plants, settings, and care logs
 * from `plants-care-logs` into a specific user's Home in `plants-home-plants` and `plants-care-logs-v2`.
 *
 * Usage (from apps/plants-api):
 *   npx tsx scripts/migrate-legacy-to-home.ts --email abhijeetkharkar@gmail.com [--home-id <uuid>] [--dry-run]
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    QueryCommand,
    ScanCommand,
    GetCommand,
    PutCommand,
    BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { PLANTS } from '../../plants/src/data/plants';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string, fallback: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const dryRun = flag('dry-run');
const profile = option('profile', 'admin');
const email = option('email', 'abhijeetkharkar@gmail.com').toLowerCase();
const explicitHomeId = option('home-id', '');
const REGION = 'us-east-1';

const LEGACY_TABLE = 'plants-care-logs';
const HOMES_TABLE = 'plants-homes';
const USER_HOMES_TABLE = 'plants-user-homes';
const HOME_PLANTS_TABLE = 'plants-home-plants';
const CARE_LOGS_V2_TABLE = 'plants-care-logs-v2';

async function batchWrite(ddb: DynamoDBDocumentClient, tableName: string, items: Record<string, unknown>[]) {
    for (let i = 0; i < items.length; i += 25) {
        let requests: any[] = items.slice(i, i + 25).map(Item => ({ PutRequest: { Item } }));
        for (let attempt = 0; requests.length > 0; attempt++) {
            if (attempt > 5) throw new Error(`Too many unprocessed items for ${tableName}`);
            const r = await ddb.send(new BatchWriteCommand({ RequestItems: { [tableName]: requests } }));
            requests = r.UnprocessedItems?.[tableName] || [];
            if (requests.length) await new Promise(res => setTimeout(res, 200 * 2 ** attempt));
        }
    }
}

async function main() {
    const client = new DynamoDBClient({
        region: REGION,
        ...(profile !== 'none' ? { credentials: fromIni({ profile }) } : {}),
    });
    const ddb = DynamoDBDocumentClient.from(client, {
        marshallOptions: { removeUndefinedValues: true },
    });

    // 1. Resolve target homeId
    let homeId = explicitHomeId;
    if (!homeId) {
        const userRes = await ddb.send(new QueryCommand({
            TableName: USER_HOMES_TABLE,
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: { ':email': email },
        }));
        const memberships = (userRes.Items || []).filter(m => m.homeId !== 'PROFILE');
        if (memberships.length === 0) {
            throw new Error(`No home found for ${email} in ${USER_HOMES_TABLE}`);
        }
        const chosen = memberships.find(m => m.isDefault) || memberships[0];
        homeId = chosen.homeId;
    }

    const homeRes = await ddb.send(new GetCommand({
        TableName: HOMES_TABLE,
        Key: { homeId },
    }));
    if (!homeRes.Item) {
        throw new Error(`Home ${homeId} not found in ${HOMES_TABLE}`);
    }
    console.log(`Target Home: "${homeRes.Item.name}" (${homeId}) for ${email}`);

    // 2. Load legacy settings & care logs
    const legacyItems: any[] = [];
    let ExclusiveStartKey: Record<string, any> | undefined;
    do {
        const r = await ddb.send(new ScanCommand({
            TableName: LEGACY_TABLE,
            ExclusiveStartKey,
        }));
        legacyItems.push(...(r.Items || []));
        ExclusiveStartKey = r.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    const configItem = legacyItems.find(i => i.plantId === '__CONFIG__' && i.timestamp === 'settings');
    const settings = configItem?.settings || {
        potTypeOverrides: {
            'money-tree': 'self-watering',
            'cream-allusion-arrowhead': 'self-watering',
            'prayer-plant': 'self-watering',
        },
        deletedPlantIds: [],
        permanentlyDeletedIds: [],
        trackWateringOverrides: {},
        groupOverrides: {},
    };

    const permDeleted = new Set<string>(settings.permanentlyDeletedIds || []);
    const softDeleted = new Set<string>(settings.deletedPlantIds || []);
    const potOverrides: Record<string, string> = settings.potTypeOverrides || {};
    const trackOverrides: Record<string, boolean> = settings.trackWateringOverrides || {};
    const groupOverrides: Record<string, string> = settings.groupOverrides || {};

    const now = new Date().toISOString();
    const homePlantItems = PLANTS.filter(p => !permDeleted.has(p.id)).map(p => ({
        homeId,
        homePlantId: p.id,
        catalogId: p.id,
        potType: potOverrides[p.id] === 'self-watering' ? 'self-watering' : 'standard',
        ...(typeof trackOverrides[p.id] === 'boolean' ? { trackWatering: trackOverrides[p.id] } : {}),
        ...(groupOverrides[p.id] === 'indoor' || groupOverrides[p.id] === 'outdoor-potted'
            ? { groupOverride: groupOverrides[p.id] }
            : {}),
        deleted: softDeleted.has(p.id),
        createdAt: now,
        updatedAt: now,
    }));

    const logItemsMap = new Map<string, Record<string, unknown>>();
    for (const item of legacyItems) {
        if (item.plantId === '__CONFIG__') continue;
        if (!item.plantId || !item.timestamp || !item.type) continue;
        const logKey = `${item.plantId}#${item.timestamp}#${item.type}`;
        logItemsMap.set(logKey, {
            homeId,
            logKey,
            plantId: item.plantId,
            timestamp: item.timestamp,
            logId: item.logId || logKey,
            type: item.type,
            loggedBy: email,
            ...(item.fertilizer ? { fertilizer: item.fertilizer } : {}),
            ...(item.notes ? { notes: item.notes } : {}),
        });
    }
    const logItems = Array.from(logItemsMap.values());

    console.log(`Prepared ${homePlantItems.length} home plants and ${logItems.length} care logs.`);
    if (dryRun) {
        console.log('--dry-run: no writes performed.');
        return;
    }

    await batchWrite(ddb, HOME_PLANTS_TABLE, homePlantItems);
    console.log(`Wrote ${homePlantItems.length} items to ${HOME_PLANTS_TABLE}.`);

    await batchWrite(ddb, CARE_LOGS_V2_TABLE, logItems);
    console.log(`Wrote ${logItems.length} items to ${CARE_LOGS_V2_TABLE}.`);

    await ddb.send(new PutCommand({
        TableName: HOMES_TABLE,
        Item: {
            ...homeRes.Item,
            onboardingComplete: true,
        },
    }));
    console.log(`Marked onboardingComplete=true on "${homeRes.Item.name}" (${homeId}).`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
