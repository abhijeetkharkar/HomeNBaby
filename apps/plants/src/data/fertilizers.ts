export interface Fertilizer {
  id: string;
  name: string;
  npk: string;
  type: 'liquid' | 'granular' | 'powder' | 'supplement';
  dosage: string;
  applicationMethod: string;
  description: string;
  warning?: string;
}

export const FERTILIZERS: Fertilizer[] = [
  {
    id: 'schultz',
    name: 'Schultz All Purpose 10-15-10',
    npk: '10-15-10',
    type: 'liquid',
    dosage: '7 drops per quart of water (or ½ dropper every 2 weeks)',
    applicationMethod: 'Dilute in water and apply directly to base soil during regular watering. Avoid splashing on foliage.',
    description: 'Balanced liquid fertilizer. Good general-purpose for houseplants & ornamentals. High P supports root systems & blooming.',
  },
  {
    id: 'agrothrive',
    name: 'AgroThrive Organic Liquid Fertilizer',
    npk: '3-3-2 (GP) / 3-3-5 (F&F)',
    type: 'liquid',
    dosage: '2 tbsp (1 oz) per gallon of water',
    applicationMethod: 'Mix thoroughly with water and drench the root zone. Safe for organic vegetables and edible crops.',
    description: 'Cold-fermented organic liquid concentrate. Fast-absorbing biological nutrition that feeds soil microbes.',
  },
  {
    id: 'espoma-garden-tone',
    name: 'Espoma Garden-tone',
    npk: '3-4-4',
    type: 'granular',
    dosage: '1–2 tbsp for 6–8" pots; ¼ to ½ cup for 12"+ containers or garden beds',
    applicationMethod: 'Sprinkle evenly around the drip line, gently scratch 1–2" into topsoil, then water thoroughly.',
    description: 'Slow-release organic granular enriched with Bio-tone microbes. Long-lasting, gentle, non-burning base nutrition.',
  },
  {
    id: 'espoma-indoor',
    name: 'Espoma Indoor! Liquid Plant Food',
    npk: '2-2-2',
    type: 'liquid',
    dosage: '½ cap (2 tsp) per quart of water',
    applicationMethod: 'Dilute with room-temperature water and apply to moist potting mix every 2–4 weeks during active growth.',
    description: '100% organic liquid houseplant food derived from natural proteins. Safe for sensitive indoor plants like prayer plants.',
  },
  {
    id: 'bone-meal',
    name: 'Bone Meal',
    npk: '~3-15-0',
    type: 'powder',
    dosage: '1 tbsp per pot (or 1–2 lbs per 100 sq ft)',
    applicationMethod: 'Mix into soil near the root zone at planting/transplanting, or lightly scratch into surface for tuber & root crops.',
    description: 'Rich organic phosphorus and calcium source. Essential for strong root establishment, bulbs, tubers, and flowering.',
  },
  {
    id: 'blood-meal',
    name: 'Blood Meal',
    npk: '~12-0-0',
    type: 'powder',
    dosage: '1 tsp to 1 tbsp scratched into topsoil',
    applicationMethod: 'Scratch lightly into topsoil around heavy foliage feeders (like curry leaf) and water in immediately.',
    description: 'Fast-acting organic nitrogen powerhouse. Quickly reverses yellowing leaves and promotes deep green leafy growth.',
  },
  {
    id: 'epsom-salt',
    name: 'Epsom Salt',
    npk: 'Mg + S (supplement)',
    type: 'supplement',
    dosage: '1 tbsp dissolved per gallon of water',
    applicationMethod: 'Dissolve in water and drench soil monthly, or use as a light foliar spray for nightshades (tomatoes, peppers), hibiscus, & ginger.',
    description: 'Magnesium sulfate mineral supplement. Enhances chlorophyll production, magnesium uptake, and prevents blossom end rot symptoms.',
  },
];

export const FERTILIZER_IDS = FERTILIZERS.map(f => f.id);
