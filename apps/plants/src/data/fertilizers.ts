export interface Fertilizer {
  id: string;
  name: string;
  npk: string;
  type: 'liquid' | 'granular' | 'powder' | 'supplement';
  description: string;
  warning?: string;
}

export const FERTILIZERS: Fertilizer[] = [
  {
    id: 'schultz',
    name: 'Schultz All Purpose 10-15-10',
    npk: '10-15-10',
    type: 'liquid',
    description: 'Balanced liquid fertilizer. Good general-purpose for houseplants & ornamentals. High P supports blooming.',
  },
  {
    id: 'agrothrive',
    name: 'AgroThrive Organic Liquid Fertilizer',
    npk: '3-3-2 (GP) / 3-3-5 (F&F)',
    type: 'liquid',
    description: 'Organic liquid concentrate. General Purpose for foliage; Fruit & Flower formula for fruiting crops & ornamentals.',
  },
  {
    id: 'espoma-garden-tone',
    name: 'Espoma Garden-tone',
    npk: '3-4-4',
    type: 'granular',
    description: 'Slow-release organic granular. Great base for vegetable beds and containers. Gentle and long-lasting.',
  },
  {
    id: 'bone-meal',
    name: 'Bone Meal',
    npk: '~3-15-0',
    type: 'powder',
    description: 'High phosphorus amendment. Promotes root and tuber development. Work into soil at planting for root crops.',
  },
  {
    id: 'blood-meal',
    name: 'Blood Meal',
    npk: '~12-0-0',
    type: 'powder',
    description: 'High nitrogen, fast-acting. Use as a quick boost for N-deficient plants or nitrogen-loving foliage plants.',
  },
  {
    id: 'epsom-salt',
    name: 'Epsom Salt',
    npk: 'Mg + S (supplement)',
    type: 'supplement',
    description: 'Magnesium & sulfur supplement. 1 tbsp per gallon of water. Great for tomatoes, peppers, hibiscus, ginger.',
  },
  {
    id: 'espoma-indoor',
    name: 'Espoma Indoor! Liquid Plant Food',
    npk: '2-2-2',
    type: 'liquid',
    description: 'Natural & organic liquid for houseplants. Mix ½ cap (2 tsp) per quart of water.',
  },
];

export const FERTILIZER_IDS = FERTILIZERS.map(f => f.id);
