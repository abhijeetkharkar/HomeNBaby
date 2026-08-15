export interface BabyLog {
  date: string;
  logId: string;
  category: 'feed' | 'diaper' | 'sleep' | 'vitaminD' | 'massage' | 'bath' | 'tummyTime' | 'weight' | 'milestone';
  // Feed fields
  startTime?: string;
  endTime?: string;
  durationMin?: number;
  side?: 'L' | 'R' | 'Both';
  latch?: 'Good' | 'Fair' | 'Poor';
  feedType?: 'breast' | 'bottle' | 'formula' | 'pumped';
  bottleMl?: number;
  // Diaper fields
  time?: string;
  type?: 'wet' | 'dirty' | 'both';
  color?: string;
  rash?: boolean;
  // Sleep fields
  quality?: 'Deep' | 'Light' | 'Fussy';
  // Health fields
  done?: boolean;
  oil?: string;
  bathType?: 'sponge' | 'full';
  notes?: string;
}

export interface DailySummary {
  date: string;
  diaperCount: { wet: number; dirty: number };
  feedCount: number;
  feedTotalMinutes: number;
  sleepTotalHours: number;
  tummyTimeCount: number;
  vitaminD: boolean;
  massage: boolean;
  bath: boolean;
}
