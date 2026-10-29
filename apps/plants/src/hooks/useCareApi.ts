import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import type { PlantDef } from '../data/plants';

export interface CareLog {
  plantId: string;
  timestamp: string;
  logId: string;
  type: 'water' | 'fertilize' | 'fertilize-2';
  fertilizer?: string;
  notes?: string;
  loggedBy?: string;
}

export interface HomePlantDef extends PlantDef {
  homePlantId: string;
  catalogId: string;
  nickname?: string;
  displayName?: string;
  potType?: 'self-watering' | 'standard';
  trackWatering?: boolean;
  groupOverride?: 'indoor' | 'outdoor-potted';
  deleted?: boolean;
}

const PLANTS_API_BASE =
  import.meta.env.VITE_PLANTS_API_URL || 'https://plantsapi.abhijeetkharkar.com';

export function useCareApi(activeHomeId: string | null) {
  const { getIdToken } = useAuth();
  const [latestLogs, setLatestLogs] = useState<Record<string, CareLog>>({});
  const [loading, setLoading] = useState(true);

  const fetchLatest = useCallback(async () => {
    if (!activeHomeId) {
      setLatestLogs({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) {
        setLatestLogs({});
        return;
      }
      const res = await fetch(`${PLANTS_API_BASE}/plants/v2/logs`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Home-Id': activeHomeId,
        },
      });
      if (res.ok) {
        const items: CareLog[] = await res.json();
        const map: Record<string, CareLog> = {};
        for (const item of items) {
          const key = `${item.plantId}__${item.type}`;
          if (!map[key] || item.timestamp > map[key].timestamp) {
            map[key] = item;
          }
        }
        setLatestLogs(map);
      }
    } catch (e) {
      console.error('Failed to fetch care logs', e);
    } finally {
      setLoading(false);
    }
  }, [activeHomeId, getIdToken]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  const logCare = useCallback(
    async (
      plantId: string,
      type: 'water' | 'fertilize' | 'fertilize-2',
      fertilizer?: string,
      notes?: string,
      customTimestamp?: string,
    ) => {
      if (!activeHomeId) return;
      const token = await getIdToken();
      if (!token) return;

      const timestamp = customTimestamp || new Date().toISOString();
      const optimistic: CareLog = {
        plantId,
        timestamp,
        logId: crypto.randomUUID(),
        type,
        ...(fertilizer ? { fertilizer } : {}),
        ...(notes ? { notes } : {}),
      };

      // Optimistic update so consecutive logCare calls (e.g. liquid fert + auto-water) both appear immediately
      setLatestLogs(prev => {
        const key = `${plantId}__${type}`;
        const existing = prev[key];
        if (!existing || timestamp >= existing.timestamp) {
          return { ...prev, [key]: optimistic };
        }
        return prev;
      });

      await fetch(`${PLANTS_API_BASE}/plants/v2/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Home-Id': activeHomeId,
        },
        body: JSON.stringify({ plantId, type, fertilizer, notes, timestamp }),
      });

      await fetchLatest();
    },
    [activeHomeId, getIdToken, fetchLatest],
  );

  const deleteLog = useCallback(
    async (plantId: string, timestamp: string, type?: string) => {
      if (!activeHomeId) return;
      const token = await getIdToken();
      if (!token) return;

      const path = type
        ? `${PLANTS_API_BASE}/plants/v2/logs/${encodeURIComponent(plantId)}/${encodeURIComponent(timestamp)}/${encodeURIComponent(type)}`
        : `${PLANTS_API_BASE}/plants/v2/logs/${encodeURIComponent(plantId)}/${encodeURIComponent(timestamp)}`;

      await fetch(path, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Home-Id': activeHomeId,
        },
      });
      await fetchLatest();
    },
    [activeHomeId, getIdToken, fetchLatest],
  );

  const getLatest = useCallback(
    (plantId: string, type: 'water' | 'fertilize') => {
      return latestLogs[`${plantId}__${type}`] || null;
    },
    [latestLogs],
  );

  return { latestLogs, loading, logCare, deleteLog, getLatest, refresh: fetchLatest };
}

export interface PlantSettings {
  potTypeOverrides: Record<string, 'self-watering' | 'standard'>;
  deletedPlantIds: string[];
  permanentlyDeletedIds: string[];
  trackWateringOverrides: Record<string, boolean>;
  groupOverrides?: Record<string, 'indoor' | 'outdoor-potted'>;
}

export function usePlantSettings(activeHomeId: string | null) {
  const { getIdToken } = useAuth();
  const [homePlants, setHomePlants] = useState<HomePlantDef[]>([]);
  const [plantsLoading, setPlantsLoading] = useState(true);

  const fetchHomePlants = useCallback(async () => {
    if (!activeHomeId) {
      setHomePlants([]);
      setPlantsLoading(false);
      return;
    }

    setPlantsLoading(true);
    try {
      const token = await getIdToken();
      if (!token) {
        setHomePlants([]);
        return;
      }
      const res = await fetch(`${PLANTS_API_BASE}/plants/my-plants`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Home-Id': activeHomeId,
        },
      });
      if (res.ok) {
        const data: { homeId: string; plants: HomePlantDef[] } = await res.json();
        setHomePlants(
          (data.plants || []).map(p => ({
            ...p,
            name: p.displayName || p.name,
          })),
        );
      }
    } catch (e) {
      console.error('Failed to fetch home plants', e);
    } finally {
      setPlantsLoading(false);
    }
  }, [activeHomeId, getIdToken]);

  useEffect(() => {
    fetchHomePlants();
  }, [fetchHomePlants]);

  const settings = useMemo<PlantSettings>(() => {
    const potTypeOverrides: Record<string, 'self-watering' | 'standard'> = {};
    const deletedPlantIds: string[] = [];
    const trackWateringOverrides: Record<string, boolean> = {};
    const groupOverrides: Record<string, 'indoor' | 'outdoor-potted'> = {};

    for (const p of homePlants) {
      if (p.potType) potTypeOverrides[p.id] = p.potType;
      if (p.deleted) deletedPlantIds.push(p.id);
      if (typeof p.trackWatering === 'boolean') trackWateringOverrides[p.id] = p.trackWatering;
      if (p.groupOverride) groupOverrides[p.id] = p.groupOverride;
    }

    return {
      potTypeOverrides,
      deletedPlantIds,
      permanentlyDeletedIds: [],
      trackWateringOverrides,
      groupOverrides,
    };
  }, [homePlants]);

  const patchHomePlant = useCallback(
    async (
      plantId: string,
      patch: Partial<Pick<HomePlantDef, 'potType' | 'trackWatering' | 'groupOverride' | 'deleted' | 'nickname'>>,
    ) => {
      if (!activeHomeId) return;
      setHomePlants(prev =>
        prev.map(p => (p.id === plantId ? { ...p, ...patch } : p)),
      );
      try {
        const token = await getIdToken();
        if (!token) return;
        await fetch(`${PLANTS_API_BASE}/plants/my-plants/${encodeURIComponent(plantId)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Home-Id': activeHomeId,
          },
          body: JSON.stringify(patch),
        });
      } catch (e) {
        console.error('Failed to update plant in home', e);
      }
    },
    [activeHomeId, getIdToken],
  );

  const setPotType = useCallback(
    (plantId: string, potType: 'self-watering' | 'standard') => {
      patchHomePlant(plantId, { potType });
    },
    [patchHomePlant],
  );

  const softDeletePlant = useCallback(
    (plantId: string) => {
      patchHomePlant(plantId, { deleted: true });
    },
    [patchHomePlant],
  );

  const restorePlant = useCallback(
    (plantId: string) => {
      patchHomePlant(plantId, { deleted: false });
    },
    [patchHomePlant],
  );

  const permanentlyDeletePlant = useCallback(
    async (plantId: string) => {
      if (!activeHomeId) return;
      setHomePlants(prev => prev.filter(p => p.id !== plantId));
      try {
        const token = await getIdToken();
        if (!token) return;
        await fetch(`${PLANTS_API_BASE}/plants/my-plants/${encodeURIComponent(plantId)}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Home-Id': activeHomeId,
          },
        });
      } catch (e) {
        console.error('Failed to permanently delete plant from home', e);
      }
    },
    [activeHomeId, getIdToken],
  );

  const setTrackWatering = useCallback(
    (plantId: string, track: boolean) => {
      patchHomePlant(plantId, { trackWatering: track });
    },
    [patchHomePlant],
  );

  const setPlantGroup = useCallback(
    (plantId: string, group: 'indoor' | 'outdoor-potted') => {
      patchHomePlant(plantId, { groupOverride: group });
    },
    [patchHomePlant],
  );

  const addPlantsToHome = useCallback(
    async (
      items: Array<{
        catalogId: string;
        nickname?: string;
        potType?: 'self-watering' | 'standard';
        trackWatering?: boolean;
        groupOverride?: 'indoor' | 'outdoor-potted';
      }>,
    ) => {
      if (!activeHomeId || items.length === 0) return [];
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${PLANTS_API_BASE}/plants/my-plants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Home-Id': activeHomeId,
        },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add plants to home');
      }
      await fetchHomePlants();
      return data.added || [];
    },
    [activeHomeId, getIdToken, fetchHomePlants],
  );

  return {
    homePlants,
    plantsLoading,
    settings,
    setPotType,
    setTrackWatering,
    setPlantGroup,
    softDeletePlant,
    restorePlant,
    permanentlyDeletePlant,
    addPlantsToHome,
    refreshSettings: fetchHomePlants,
  };
}

// Given last care date and [min, max] frequency, compute urgency
export function computeUrgency(lastDate: string | null, freqDays: [number, number]): {
  daysUntil: number;
  status: 'overdue' | 'due-today' | 'due-soon' | 'ok' | 'never';
} {
  if (!lastDate) return { daysUntil: -999, status: 'never' };
  const last = new Date(lastDate);
  const now = new Date();
  const daysSince = Math.floor((now.getTime() - last.getTime()) / 86400000);
  const target = freqDays[1]; // use max frequency as "due by" target
  const daysUntil = target - daysSince;

  let status: 'overdue' | 'due-today' | 'due-soon' | 'ok';
  if (daysUntil < 0) status = 'overdue';
  else if (daysUntil === 0) status = 'due-today';
  else if (daysUntil <= 2) status = 'due-soon';
  else status = 'ok';

  return { daysUntil, status };
}
