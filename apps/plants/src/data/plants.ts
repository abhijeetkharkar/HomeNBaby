export type PlantGroup = 'indoor' | 'outdoor-garden' | 'outdoor-potted';

export interface PlantDef {
  id: string;
  name: string;
  nickname?: string;
  scientificName?: string;
  emoji: string;
  imageUrl?: string;
  comingSoon?: boolean;
  group: PlantGroup;
  /** Indoor & outdoor-potted — [min, max] days between watering */
  waterFreqDays?: [number, number];
  /** All plants — [min, max] days between fertilizing */
  fertFreqDays: [number, number];
  fertFreqDays2?: [number, number];
  fertRecommendation2?: string;
  altFertilizers?: string[];
  /** Which fertilizer(s) from inventory to use */
  fertRecommendation: string;
  /** Special care notes */
  notes: string[];
  bestTimeToPlantSeed?: string;
  bestTimeToTransplant?: string;
  seedToFruitTime?: string;
  bloomingSeason?: string;
  fruitingSeason?: string;
  lightRequirements?: string;
  /** Flag potentially problematic items */
  warning?: string;
  /** Self-watering pot compatibility (for indoor & outdoor-potted plants) */
  selfWatering?: 'ideal' | 'caution' | 'never';
  /** Water reservoir refill frequency when potted in a self-watering pot [min, max] days */
  selfWaterFreqDays?: [number, number];
  /** Practical guidance or precautions for self-watering pots */
  selfWateringNote?: string;
  /** Required soil mix composition */
  soilType?: string;
  /** Guidance on decorative pebbles / top dressing */
  pebbleRule?: string;
}

export const PLANT_GROUPS: { key: PlantGroup; label: string; emoji: string }[] = [
  { key: 'indoor', label: 'Indoor', emoji: '🏠' },
  { key: 'outdoor-garden', label: 'Garden', emoji: '🥕' },
  { key: 'outdoor-potted', label: 'Potted', emoji: '🪴' },
];
