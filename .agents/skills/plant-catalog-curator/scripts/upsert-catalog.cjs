#!/usr/bin/env node
/**
 * Curate, validate, and upsert PlantDef entries directly into the DynamoDB `plants-catalog` table.
 * Zero external npm dependencies (uses Node.js built-ins + AWS CLI) so it works in any git worktree.
 *
 * Usage:
 *   node .agents/skills/plant-catalog-curator/scripts/upsert-catalog.cjs <path-to-plants.json> [--dry-run] [--allow-overwrite] [--profile admin] [--region us-east-1] [--table plants-catalog]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const CANONICAL_FERTILIZERS = new Set([
  'Schultz (10-15-10)',
  'Espoma Indoor! Liquid Plant Food',
  'AgroThrive General',
  'Espoma Garden-tone',
  'Bone meal',
  'Blood meal',
  'Epsom salt',
]);

const VALID_GROUPS = new Set(['indoor', 'outdoor-potted', 'outdoor-garden']);
const VALID_SELF_WATERING = new Set(['ideal', 'caution', 'never']);

function normalizePlantName(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function toDynamoAttr(val) {
  if (typeof val === 'string') return { S: val };
  if (typeof val === 'number') return { N: String(val) };
  if (typeof val === 'boolean') return { BOOL: val };
  if (Array.isArray(val)) return { L: val.map(toDynamoAttr) };
  if (val && typeof val === 'object') {
    const m = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) m[k] = toDynamoAttr(v);
    }
    return { M: m };
  }
  throw new Error(`Unsupported value type: ${typeof val}`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const positional = [];
  const flags = new Set();
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        options[key] = next;
        i++;
      } else {
        flags.add(key);
      }
    } else {
      positional.push(arg);
    }
  }
  return {
    inputFile: positional[0],
    dryRun: flags.has('dry-run'),
    allowOverwrite: flags.has('allow-overwrite'),
    promoteStaging: flags.has('promote-staging'),
    profile: options.profile || 'admin',
    region: options.region || 'us-east-1',
    table: options.table || process.env.CATALOG_TABLE_NAME || 'plants-catalog',
    stagingTable: options['staging-table'] || 'plants-staging',
    homePlantsTable: options['home-plants-table'] || 'plants-home-plants',
  };
}

function validatePlantSchema(plant, index) {
  const errors = [];
  const label = `Item[${index}] (${plant.id || plant.name || 'unknown'})`;

  if (!plant.id || !/^[a-z0-9-]+$/.test(plant.id)) {
    errors.push(`${label}: "id" must be a lowercase kebab-case slug`);
  }
  if (!plant.name || /[()]/.test(plant.name)) {
    errors.push(`${label}: "name" must be a clean common name without parentheses`);
  }
  if (!plant.scientificName) {
    errors.push(`${label}: "scientificName" is required`);
  }
  if (!plant.emoji) {
    errors.push(`${label}: "emoji" is required`);
  }
  if (plant.imageUrl !== `/plants/${plant.id}.jpg`) {
    errors.push(`${label}: "imageUrl" must be "/plants/${plant.id}.jpg" (got "${plant.imageUrl}")`);
  }
  if (!VALID_GROUPS.has(plant.group)) {
    errors.push(`${label}: "group" must be indoor, outdoor-potted, or outdoor-garden`);
  }
  if (!plant.lightRequirements) {
    errors.push(`${label}: "lightRequirements" is required`);
  }
  if (!Array.isArray(plant.fertFreqDays) || plant.fertFreqDays.length !== 2) {
    errors.push(`${label}: "fertFreqDays" must be a [min, max] number tuple`);
  }
  if (!CANONICAL_FERTILIZERS.has(plant.fertRecommendation)) {
    errors.push(`${label}: "fertRecommendation" ("${plant.fertRecommendation}") must be one of: ${Array.from(CANONICAL_FERTILIZERS).join(', ')}`);
  }
  if (plant.fertRecommendation2 && !CANONICAL_FERTILIZERS.has(plant.fertRecommendation2)) {
    errors.push(`${label}: "fertRecommendation2" ("${plant.fertRecommendation2}") must be a canonical fertilizer`);
  }
  if (Array.isArray(plant.altFertilizers)) {
    for (const alt of plant.altFertilizers) {
      if (!CANONICAL_FERTILIZERS.has(alt)) {
        errors.push(`${label}: altFertilizer "${alt}" must be a canonical fertilizer`);
      }
    }
  }
  if (!plant.soilType) {
    errors.push(`${label}: "soilType" is required`);
  }
  if (!Array.isArray(plant.notes) || plant.notes.length < 2) {
    errors.push(`${label}: "notes" must be an array of at least 2 care tips`);
  }

  if (plant.group === 'indoor' || plant.group === 'outdoor-potted') {
    if (!Array.isArray(plant.waterFreqDays) || plant.waterFreqDays.length !== 2) {
      errors.push(`${label}: "waterFreqDays" is required for ${plant.group}`);
    }
    if (!VALID_SELF_WATERING.has(plant.selfWatering)) {
      errors.push(`${label}: "selfWatering" must be ideal, caution, or never for ${plant.group}`);
    }
    if ((plant.selfWatering === 'ideal' || plant.selfWatering === 'caution') && (!Array.isArray(plant.selfWaterFreqDays) || plant.selfWaterFreqDays.length !== 2)) {
      errors.push(`${label}: "selfWaterFreqDays" is required when selfWatering is "${plant.selfWatering}"`);
    }
    if (!plant.selfWateringNote) {
      errors.push(`${label}: "selfWateringNote" is required for ${plant.group}`);
    }
    if (!plant.pebbleRule) {
      errors.push(`${label}: "pebbleRule" is required for ${plant.group}`);
    }
  }

  return errors;
}

function runAwsJson(args, profile, region) {
  const fullArgs = [...args, '--region', region, '--output', 'json'];
  if (profile && profile !== 'none') {
    fullArgs.push('--profile', profile);
  }
  const stdout = execFileSync('aws', fullArgs, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  return stdout.trim() ? JSON.parse(stdout) : {};
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.inputFile) {
    console.error('Usage: node .agents/skills/plant-catalog-curator/scripts/upsert-catalog.cjs <plants.json> [--dry-run] [--allow-overwrite]');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(path.resolve(opts.inputFile), 'utf8'));
  const plants = Array.isArray(raw) ? raw : [raw];

  // 1. Local schema & batch-internal duplicate validation
  const schemaErrors = [];
  const seenIds = new Set();
  const seenGroupNames = new Set();

  for (let i = 0; i < plants.length; i++) {
    const p = plants[i];
    schemaErrors.push(...validatePlantSchema(p, i));
    if (seenIds.has(p.id)) {
      schemaErrors.push(`Duplicate id "${p.id}" within input batch`);
    }
    seenIds.add(p.id);

    const gnKey = `${p.group}|${normalizePlantName(p.name)}`;
    if (seenGroupNames.has(gnKey)) {
      schemaErrors.push(`Duplicate group+name "${gnKey}" within input batch`);
    }
    seenGroupNames.add(gnKey);
  }

  if (schemaErrors.length > 0) {
    console.error('Schema validation failed:\n  - ' + schemaErrors.join('\n  - '));
    process.exit(1);
  }
  console.log(`Schema validation passed for ${plants.length} plant(s).`);

  // 2. Scan existing DynamoDB table to check for collisions
  const scanRes = runAwsJson(
    [
      'dynamodb',
      'scan',
      '--table-name',
      opts.table,
      '--projection-expression',
      'plantId, #n, #g, normalizedName',
      '--expression-attribute-names',
      JSON.stringify({ '#n': 'name', '#g': 'group' }),
    ],
    opts.profile,
    opts.region
  );

  const existingItems = scanRes.Items || [];
  const existingIds = new Set(existingItems.map(i => i.plantId?.S).filter(Boolean));
  const existingGroupNames = new Map(
    existingItems.map(i => [
      `${i.group?.S}|${i.normalizedName?.S || normalizePlantName(i.name?.S)}`,
      i.plantId?.S,
    ])
  );

  console.log(`Scanned ${existingItems.length} existing items in DynamoDB table "${opts.table}".`);

  if (!opts.allowOverwrite) {
    const collisions = [];
    for (const p of plants) {
      if (existingIds.has(p.id)) {
        collisions.push(`plantId "${p.id}" already exists in ${opts.table} (use --allow-overwrite to update)`);
      }
      const gnKey = `${p.group}|${normalizePlantName(p.name)}`;
      const existingId = existingGroupNames.get(gnKey);
      if (existingId && existingId !== p.id) {
        collisions.push(`"${p.name}" in group "${p.group}" already exists as "${existingId}"`);
      }
    }
    if (collisions.length > 0) {
      console.error('Collision check failed:\n  - ' + collisions.join('\n  - '));
      process.exit(1);
    }
  }
  console.log('Collision check passed against live DynamoDB catalog.');

  if (opts.dryRun) {
    console.log('--dry-run complete: no items written to DynamoDB.');
    return;
  }

  // 3. Build PutRequests & write in batches of 25
  const now = new Date().toISOString();
  const putRequests = plants.map(({ id, ...rest }) => {
    const item = {
      ...rest,
      plantId: id,
      status: 'published',
      normalizedName: normalizePlantName(rest.name),
      normalizedScientificName: normalizePlantName(rest.scientificName),
      updatedAt: now,
    };
    return { PutRequest: { Item: toDynamoAttr(item).M } };
  });

  for (let i = 0; i < putRequests.length; i += 25) {
    const chunk = putRequests.slice(i, i + 25);
    const tmpFile = path.join(os.tmpdir(), `plants-catalog-batch-${Date.now()}-${i}.json`);
    try {
      // Escape non-ASCII characters (emojis, en-dashes) as \uXXXX so Windows AWS CLI (cp1252) decodes UTF-8 cleanly
      const asciiSafeJson = JSON.stringify({ [opts.table]: chunk }, null, 2).replace(
        /[\u007F-\uFFFF]/g,
        ch => '\\u' + ('0000' + ch.charCodeAt(0).toString(16)).slice(-4)
      );
      fs.writeFileSync(tmpFile, asciiSafeJson, 'ascii');
      runAwsJson(
        ['dynamodb', 'batch-write-item', '--request-items', `file://${tmpFile}`],
        opts.profile,
        opts.region
      );
      console.log(`Upserted batch ${Math.floor(i / 25) + 1} (${chunk.length} items) into "${opts.table}".`);
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  }

  console.log(`Successfully published ${plants.length} plant(s) to "${opts.table}".`);

  if (opts.promoteStaging) {
    promoteStagingEntries(opts, plants, existingItems, now);
  }
}

function promoteStagingEntries(opts, newPlants, existingCatalogItems, now) {
  // Build map of normalizedName -> plantId across existing catalog + newly added plants
  const nameToCatalogId = new Map();
  for (const item of existingCatalogItems) {
    const pid = item.plantId?.S;
    const nName = item.normalizedName?.S || normalizePlantName(item.name?.S);
    if (pid && nName) nameToCatalogId.set(nName, pid);
  }
  for (const p of newPlants) {
    nameToCatalogId.set(normalizePlantName(p.name), p.id);
    if (Array.isArray(p.aliases)) {
      for (const alias of p.aliases) {
        nameToCatalogId.set(normalizePlantName(alias), p.id);
      }
    }
  }
  // Common typo mappings
  if (nameToCatalogId.has('monstera deliciosa')) {
    nameToCatalogId.set('monstera delisiosa', nameToCatalogId.get('monstera deliciosa'));
  }

  const stagingScan = runAwsJson(
    ['dynamodb', 'scan', '--table-name', opts.stagingTable],
    opts.profile,
    opts.region
  );
  const stagingItems = stagingScan.Items || [];
  let promotedCount = 0;

  for (const st of stagingItems) {
    const normName = st.normalizedName?.S;
    const status = st.status?.S;
    const catalogId = nameToCatalogId.get(normName);
    if (!normName || !catalogId || status === 'promoted') continue;

    runAwsJson(
      [
        'dynamodb',
        'update-item',
        '--table-name',
        opts.stagingTable,
        '--key',
        JSON.stringify({ normalizedName: { S: normName } }),
        '--update-expression',
        'SET #st = :promoted, promotedCatalogId = :cid, updatedAt = :now',
        '--expression-attribute-names',
        JSON.stringify({ '#st': 'status' }),
        '--expression-attribute-values',
        JSON.stringify({
          ':promoted': { S: 'promoted' },
          ':cid': { S: catalogId },
          ':now': { S: now },
        }),
      ],
      opts.profile,
      opts.region
    );
    console.log(`Promoted staging entry "${normName}" -> catalogId "${catalogId}".`);
    promotedCount++;
  }

  // Also upgrade any Coming Soon rows in plants-home-plants whose customName or staging catalogId matches
  const homeScan = runAwsJson(
    ['dynamodb', 'scan', '--table-name', opts.homePlantsTable],
    opts.profile,
    opts.region
  );
  for (const row of homeScan.Items || []) {
    const catId = row.catalogId?.S || '';
    const isStaging = row.comingSoon?.BOOL === true || catId.startsWith('staging:');
    if (!isStaging) continue;
    const normCustom = normalizePlantName(row.customName?.S || catId.replace(/^staging:/, ''));
    const targetCatalogId = nameToCatalogId.get(normCustom);
    if (!targetCatalogId) continue;

    const homeId = row.homeId?.S;
    const homePlantId = row.homePlantId?.S;
    runAwsJson(
      [
        'dynamodb',
        'update-item',
        '--table-name',
        opts.homePlantsTable,
        '--key',
        JSON.stringify({ homeId: { S: homeId }, homePlantId: { S: homePlantId } }),
        '--update-expression',
        'SET catalogId = :cid, comingSoon = :f, updatedAt = :now',
        '--expression-attribute-values',
        JSON.stringify({
          ':cid': { S: targetCatalogId },
          ':f': { BOOL: false },
          ':now': { S: now },
        }),
      ],
      opts.profile,
      opts.region
    );
    console.log(`Upgraded home plant "${homePlantId}" in home "${homeId}" -> catalogId "${targetCatalogId}".`);
  }
  console.log(`Staging promotion complete (${promotedCount} staging row(s) marked promoted).`);
}

main();
