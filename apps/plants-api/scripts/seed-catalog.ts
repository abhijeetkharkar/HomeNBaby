/**
 * Seeds the plants-catalog (master plants) table from apps/plants/src/data/plants.ts.
 *
 * Usage (from apps/api):
 *   npx tsx scripts/seed-catalog.ts --dry-run
 *   npx tsx scripts/seed-catalog.ts [--profile admin|none] [--table plants-catalog]
 *
 * Idempotent: items are upserted by plantId. Plants removed from plants.ts are NOT deleted.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { PLANTS } from '../../plants/src/data/plants';
import { normalizePlantName } from '../lib/plant-names';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string, fallback: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const dryRun = flag('dry-run');
const profile = option('profile', 'admin');
const table = option('table', process.env.CATALOG_TABLE_NAME || 'plants-catalog');
const REGION = 'us-east-1';

function buildItems() {
    const now = new Date().toISOString();
    return PLANTS.map(plant => {
        const { id, ...rest } = plant;
        return {
            ...rest,
            plantId: id,
            status: 'published',
            normalizedName: normalizePlantName(plant.name),
            ...(plant.scientificName
                ? { normalizedScientificName: normalizePlantName(plant.scientificName) }
                : {}),
            updatedAt: now,
        };
    });
}

function validate(items: ReturnType<typeof buildItems>) {
    const problems: string[] = [];
    const ids = new Map<string, number>();
    const names = new Map<string, string>();
    for (const item of items) {
        ids.set(item.plantId, (ids.get(item.plantId) || 0) + 1);
        // Same species may appear once per group (indoor / outdoor-potted / outdoor-garden)
        // because care differs, but never twice within a group.
        const nameKey = `${item.group}|${item.normalizedName}`;
        const clash = names.get(nameKey);
        if (clash) problems.push(`Duplicate name "${item.name}" in group ${item.group} (${item.plantId} and ${clash})`);
        names.set(nameKey, item.plantId);
    }
    for (const [id, count] of ids) {
        if (count > 1) problems.push(`Duplicate plantId "${id}" x${count}`);
    }
    return problems;
}

async function batchWrite(ddb: DynamoDBDocumentClient, items: Record<string, unknown>[]) {
    for (let i = 0; i < items.length; i += 25) {
        let requests: any[] = items.slice(i, i + 25).map(Item => ({ PutRequest: { Item } }));
        for (let attempt = 0; requests.length > 0; attempt++) {
            if (attempt > 5) throw new Error('Too many unprocessed items, aborting');
            const r = await ddb.send(new BatchWriteCommand({ RequestItems: { [table]: requests } }));
            requests = r.UnprocessedItems?.[table] || [];
            if (requests.length) await new Promise(res => setTimeout(res, 200 * 2 ** attempt));
        }
    }
}

async function main() {
    const items = buildItems();
    const problems = validate(items);
    if (problems.length) {
        console.error('Validation failed:\n - ' + problems.join('\n - '));
        process.exit(1);
    }

    const byGroup: Record<string, number> = {};
    for (const item of items) byGroup[item.group] = (byGroup[item.group] || 0) + 1;
    console.log(`Prepared ${items.length} catalog items for table "${table}":`, byGroup);

    if (dryRun) {
        console.log('--dry-run: no writes performed.');
        return;
    }

    const config: Record<string, unknown> = { region: REGION };
    if (profile !== 'none') {
        const { fromIni } = await import('@aws-sdk/credential-provider-ini');
        config.credentials = fromIni({ profile });
    }
    const ddb = DynamoDBDocumentClient.from(new DynamoDBClient(config), {
        marshallOptions: { removeUndefinedValues: true },
    });

    await batchWrite(ddb, items);
    console.log(`Seeded ${items.length} items into "${table}".`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
