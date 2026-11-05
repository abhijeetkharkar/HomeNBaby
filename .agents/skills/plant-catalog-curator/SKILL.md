---
name: plant-catalog-curator
description: >-
  Curate, validate, and publish new plant botanical profiles directly into the Plants Tracker
  DynamoDB plants-catalog table, or promote user-requested plants from the plants-staging table.
  Use this skill whenever the user asks to add a new plant to the master database, curate plant
  care data, or promote pending plants from staging.
---

# Plant Catalog Curator (`plants-catalog`)

Use this skill whenever adding new plants to the Plants Tracker master catalog (`plants-catalog` DynamoDB table) or promoting user-requested plants from the `plants-staging` DynamoDB table.

---

## 1. Core Workflow (Advisor First)

1. **Gather Input / Check Existing Catalog & Staging:**
   - Query the live `plants-catalog` DynamoDB table to check existing `plantId`s and `normalizedName`s so there are no duplicates:
     ```powershell
     aws dynamodb scan --table-name plants-catalog --projection-expression "plantId, #n, #g, scientificName" --expression-attribute-names '{"#n":"name","#g":"group"}' --region us-east-1 --profile admin
     ```
   - If the user asks to review requested/staged plants, scan `plants-staging` first:
     ```powershell
     aws dynamodb scan --table-name plants-staging --region us-east-1 --profile admin
     ```
   - Otherwise, start from the plant name(s) and group(s) specified by the user.
2. **Draft Complete `PlantDef` Entries:**
   - Construct the complete botanical profile matching every schema rule in **Section 2** below.
   - Present the proposed `PlantDef` entry (or entries) to the user for review and wait for explicit approval before writing to DynamoDB.
3. **Validate & Publish Directly to DynamoDB (`plants-catalog`):**
   - Do **not** add new plants to static TypeScript files (`plants.ts` or `catalog-seed.ts`); `plants-catalog` in DynamoDB is the single source of truth at runtime.
   - Write the approved `PlantDef` array (or single object) to a temporary JSON file (e.g., `<scratchDir>/new-plants.json`) and run the bundled zero-dependency curator script [`scripts/upsert-catalog.cjs`](scripts/upsert-catalog.cjs):
     ```powershell
     # 1. Dry-run (validates schema, canonical fertilizers, and checks live DynamoDB for ID or group+name collisions)
     node .agents/skills/plant-catalog-curator/scripts/upsert-catalog.cjs "<scratchDir>/new-plants.json" --dry-run

     # 2. Live upsert into DynamoDB plants-catalog (supports batches of any size)
     node .agents/skills/plant-catalog-curator/scripts/upsert-catalog.cjs "<scratchDir>/new-plants.json" --profile admin
     ```
     *(Pass `--allow-overwrite` if intentionally updating an existing plant in `plants-catalog`.)*
   - **If the plant was promoted from `plants-staging`:**
     - As long as the new catalog item's `normalizedName` (or `plantId`) matches the staged request, [`apps/plants-api/routes/home-plants.js`](../../../apps/plants-api/routes/home-plants.js) automatically upgrades any `"Coming Soon"` card (`comingSoon: true`) in `plants-home-plants` to the full published catalog profile on the next load.
     - Update the corresponding item in `plants-staging` to `status = "promoted"` and set `promotedCatalogId = "<id>"`.
4. **Pair with Botanical Image Generation:**
   - Activate the `plant-image-generator` skill ([`../plant-image-generator/SKILL.md`](../plant-image-generator/SKILL.md)) to generate and upload `/plants/<id>.jpg` if the photograph does not exist yet.

---

## 2. Master Plant Schema & Field Rules (`PlantDef`)

Every plant in `plants-catalog` (matching [`PlantDef` in `apps/plants/src/data/plants.ts`](../../../apps/plants/src/data/plants.ts)) must conform to the following structure and domain constraints (tailored for **USDA Hardiness Zone 8b/9a — Austin, TX** for outdoor plants):

### A. Identity & Naming Standards
| Field | Type | Required | Rules & Examples |
| :--- | :--- | :--- | :--- |
| `id` / `plantId` | `string` | **Yes** | Lowercase kebab-case slug (`'monstera-deliciosa'`, `'ficus-burgundy'`). Stored as `plantId` PK in `plants-catalog`. |
| `name` | `string` | **Yes** | **Clean real common name ONLY** (`'Monstera'`, `'Orange'`, `'Curry Leaf'`, `'Frankie Fittonia'`). **Never** include parenthetical ages (`Moringa (2yr)` ❌), pot sizes (`Orange (9in)` ❌), or colloquial brackets. |
| `scientificName` | `string` | **Yes** | Accurate Latin binomial with cultivar in single quotes if applicable (`'Monstera deliciosa'`, `"Ficus elastica 'Burgundy'"`, `"Pilea spruceana 'Silver Tree'"`). |
| `emoji` | `string` | **Yes** | Single representative botanical emoji (`'🌿'`, `'🪴'`, `'🌺'`, `'🍅'`, `'🍋'`). |
| `imageUrl` | `string` | **Yes** | Always `'/plants/<id>.jpg'` (matching `plantId`). |
| `group` | `PlantGroup` | **Yes** | Exactly one of: `'indoor'`, `'outdoor-potted'`, or `'outdoor-garden'`. |

### B. Light & Seasonal Lifecycle Metadata
| Field | Type | Required | Rules & Examples |
| :--- | :--- | :--- | :--- |
| `lightRequirements` | `string` | **Yes** | Include both descriptive light level and Lux range:<br>• Low to Medium Indirect: `'Low to Medium Indirect (250–2,500 Lux)'`<br>• Medium to Bright Indirect: `'Medium to Bright Indirect (1,000–10,000 Lux)'`<br>• Bright Indirect: `'Bright Indirect (2,500–10,000 Lux)'`<br>• Partial Shade to Full Sun: `'Full Sun to Partial Shade (15,000–50,000+ Lux)'`<br>• Full Sun: `'Full Sun (30,000–100,000+ Lux)'` |
| `bestTimeToPlantSeed` | `string` | When applicable | Austin/Zone 8b–9a sowing window (`'Feb-Apr, Aug-Sep'`, `'Mar-May'`, `'Spring'`). |
| `bestTimeToTransplant` | `string` | Recommended | Best repotting/transplanting window (`'Mar-May'` for indoor houseplants; `'Mar-Apr, Sep-Oct'` for outdoor crops). |
| `seedToFruitTime` | `string` | Crops/Fruits | Days or years to harvest (`'60-80 days'`, `'90-110 days'`). |
| `bloomingSeason` | `string` | Flowering/Crops | e.g., `'Spring-Summer'`, `'Year-round (warm months)'`, `'Rare (indoors)'`. |
| `fruitingSeason` | `string` | Crops/Fruits | e.g., `'Summer-Fall'`, `'Late Fall-Winter'`. |

### C. Watering & Self-Watering Pot Rules
| Field | Type | Group Applicability | Rules & Examples |
| :--- | :--- | :--- | :--- |
| `waterFreqDays` | `[number, number]` | **Required** for `indoor` & `outdoor-potted`. **Omit** for `outdoor-garden`. | `[min, max]` days between standard top waterings (e.g., `[5, 8]`, `[7, 14]` for indoor; `[2, 4]`, `[3, 5]` for outdoor-potted). |
| `selfWatering` | `'ideal' \| 'caution' \| 'never'` | **Required** for `indoor` & `outdoor-potted`. **Omit** for `outdoor-garden`. | • `'ideal'`: Moisture-loving tropicals/herbs (Prayer Plant, Peace Lily, Pothos, Mint).<br>• `'caution'`: Plants needing airy bark/perlite mix and brief dry reservoir intervals (Ficus, Monstera, Begonia).<br>• `'never'`: Succulents, cacti, bulbs, taproots, or rot-prone species (Snake Plant, ZZ, Citrus, Peperomia, Dracaena). |
| `selfWaterFreqDays` | `[number, number]` | **Required** if `selfWatering` is `'ideal'` or `'caution'`. **Omit** if `'never'`. | `[min, max]` days between reservoir refills (typically `~2x` the standard watering interval, e.g., `[12, 18]`, `[14, 21]`). |
| `selfWateringNote` | `string` | **Required** for `indoor` & `outdoor-potted`. **Omit** for `outdoor-garden`. | 1–2 sentences explaining why the plant is `ideal`, `caution`, or `never` for self-watering and any reservoir/substrate precautions. |

### D. Fertilizer Schedule & Inventory Constraints
All fertilizer recommendations **must** use the exact canonical names from the app's fertilizer inventory so the dashboard fertilizer filter works properly:

- **Canonical Fertilizer Names:**
  1. `'Schultz (10-15-10)'` *(liquid all-purpose indoor/patio drops)*
  2. `'Espoma Indoor! Liquid Plant Food'` *(gentle organic indoor liquid)*
  3. `'AgroThrive General'` *(organic liquid general purpose)*
  4. `'Espoma Garden-tone'` *(granular organic vegetable & herb food)*
  5. `'Bone meal'` *(phosphorus/calcium for bulbs, root crops, fruiting/blooming)*
  6. `'Blood meal'` *(high-nitrogen for leafy greens, curry leaf, heavy vegetative feeders)*
  7. `'Epsom salt'` *(magnesium sulfate supplement for tomatoes, peppers, roses, hibiscus)*

| Field | Type | Required | Rules & Examples |
| :--- | :--- | :--- | :--- |
| `fertFreqDays` | `[number, number]` | **Yes** | Primary fertilizer interval in days (e.g., `[14, 28]` or `[28, 30]`). |
| `fertRecommendation` | `string` | **Yes** | Must be one of the 7 canonical fertilizer names above. |
| `fertFreqDays2` | `[number, number]` | Optional | Secondary supplement interval (e.g., `[28, 30]` for `'Epsom salt'` or `'Bone meal'`). |
| `fertRecommendation2` | `string` | Optional | Secondary canonical fertilizer name (paired with `fertFreqDays2`). |
| `altFertilizers` | `string[]` | Recommended | Array of 1–2 alternative canonical fertilizers (e.g., `['Espoma Indoor! Liquid Plant Food']`). |

### E. Substrate, Top-Dressing & Care Notes
| Field | Type | Required | Rules & Examples |
| :--- | :--- | :--- | :--- |
| `soilType` | `string` | **Yes** | Specific soil recipe with ratios/amendments (e.g., `'Airy aroid blend: 50% potting soil, 30% perlite, 20% orchid bark'`). |
| `pebbleRule` | `string` | **Required** for `indoor` & `outdoor-potted`. | Guidance on surface pebbles/mulch (e.g., `'Bare soil is best; decorative stones trap moisture and risk stem rot.'`). |
| `warning` | `string` | Optional | Short alert banner shown on card front for delicate/special cases (do not prefix with `⚠️`, as `PlantCard` adds the icon). |
| `notes` | `string[]` | **Yes** (3–4 items) | Concise, high-signal care bullets covering:<br>1. Key watering/light/humidity tip.<br>2. Seasonal dormancy or Austin heat/cold threshold.<br>3. Pet toxicity (`'Pet safe 🐾 (non-toxic to cats & dogs)'` or `'Toxic to cats & dogs (calcium oxalate crystals) 🐾'`). |

---

## 3. Complete Reference Examples by Group

```ts
// 1. INDOOR HOUSEPLANT EXAMPLE
{
  id: 'golden-pothos',
  name: 'Golden Pothos',
  scientificName: 'Epipremnum aureum',
  lightRequirements: 'Low to Bright Indirect (500–10,000 Lux)',
  bestTimeToTransplant: 'Mar-May',
  emoji: '🪴',
  imageUrl: '/plants/golden-pothos.jpg',
  group: 'indoor',
  waterFreqDays: [7, 10],
  fertFreqDays: [14, 28],
  fertRecommendation: 'Schultz (10-15-10)',
  altFertilizers: ['Espoma Indoor! Liquid Plant Food'],
  notes: [
    'Hardy trailing vine with heart-shaped leaves marbled in rich golden-yellow and jade green',
    'Tolerates lower light, but brighter indirect light enhances golden variegation',
    'Toxic to cats and dogs (calcium oxalate crystals) 🐾',
  ],
  selfWatering: 'ideal',
  selfWaterFreqDays: [14, 21],
  selfWateringNote: 'Extremely adaptable to self-watering. Ensure mix has generous perlite and bark so roots stay aerated.',
  soilType: 'Airy, well-draining aroid blend: 50% potting soil, 30% perlite, 20% orchid bark',
  pebbleRule: 'Bare soil is best. Decorative surface stones trap moisture and promote stem rot.',
}

// 2. OUTDOOR POTTED EXAMPLE
{
  id: 'mint',
  name: 'Mint',
  scientificName: 'Mentha spicata',
  lightRequirements: 'Full Sun to Partial Shade (15,000–50,000+ Lux)',
  bestTimeToTransplant: 'Mar-Apr, Sep-Oct',
  emoji: '🌿',
  imageUrl: '/plants/mint.jpg',
  group: 'outdoor-potted',
  waterFreqDays: [2, 4],
  fertFreqDays: [28, 30],
  fertRecommendation: 'AgroThrive General',
  notes: [
    'Keep in container to prevent invasive runner spread',
    'Harvest pinched tips frequently to prevent bolting',
    'Give afternoon shade during peak Austin August heat',
  ],
  selfWatering: 'ideal',
  selfWaterFreqDays: [10, 14],
  selfWateringNote: 'Loves steady moisture! Self-watering prevents severe mid-day wilt during hot Texas summers.',
  soilType: 'Standard moisture-retaining potting mix rich in organic compost',
  pebbleRule: 'Bare soil or light compost mulch; mint spreads via runners so pebbles hinder growth.',
}

// 3. OUTDOOR GARDEN BED EXAMPLE (No waterFreqDays / selfWatering / pebbleRule)
{
  id: 'carrots',
  name: 'Carrots',
  scientificName: 'Daucus carota',
  lightRequirements: 'Full Sun (30,000–100,000+ Lux)',
  bestTimeToPlantSeed: 'Jan-Feb, Aug-Oct',
  seedToFruitTime: '70-80 days',
  fruitingSeason: 'Spring, Late Fall-Winter',
  emoji: '🥕',
  imageUrl: '/plants/carrots.jpg',
  group: 'outdoor-garden',
  fertFreqDays: [21, 28],
  fertRecommendation: 'Bone meal',
  altFertilizers: ['Espoma Garden-tone'],
  notes: [
    'Cool-season root crop — sow in late August–October for sweet Austin fall/winter harvest',
    'Avoid high-nitrogen fertilizers (causes forked, hairy roots and excessive leafy tops)',
    'Thin seedlings to 2–3 inches apart once true leaves emerge',
  ],
  soilType: 'Deep, stone-free loose sandy loam or raised bed mix (pH 6.0–6.8)',
}
```
