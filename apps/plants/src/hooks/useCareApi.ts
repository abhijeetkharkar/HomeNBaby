import { useState, useEffect, useCallback } from 'react';

export interface CareLog {
  plantId: string;
  timestamp: string;
  logId: string;
  type: 'water' | 'fertilize' | 'fertilize-2';
  fertilizer?: string;
  notes?: string;
}

// In dev (no deployed Lambda), fall back to localStorage
const IS_DEV = import.meta.env.DEV;
const LS_KEY = 'plants-care-logs-dev';
const API_BASE = import.meta.env.VITE_API_URL || 'https://api.abhijeetkharkar.com';

function lsGetAll(): CareLog[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function lsSave(logs: CareLog[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(logs));
}

export function useCareApi() {
  // Map: `${plantId}__${type}` → latest log
  const [latestLogs, setLatestLogs] = useState<Record<string, CareLog>>({});
  const [loading, setLoading] = useState(true);

  const fetchLatest = useCallback(async () => {
    setLoading(true);
    try {
      if (IS_DEV) {
        const all = lsGetAll();
        const map: Record<string, CareLog> = {};
        for (const log of all) {
          const key = `${log.plantId}__${log.type}`;
          if (!map[key] || log.timestamp > map[key].timestamp) map[key] = log;
        }
        setLatestLogs(map);
      } else {
        const res = await fetch(`${API_BASE}/plants/logs`);
        if (res.ok) {
          const items: CareLog[] = await res.json();
          const map: Record<string, CareLog> = {};
          for (const item of items) {
            const key = `${item.plantId}__${item.type}`;
            map[key] = item;
          }
          setLatestLogs(map);
        }
      }
    } catch (e) {
      console.error('Failed to fetch care logs', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLatest(); }, [fetchLatest]);

  const logCare = useCallback(async (
    plantId: string,
    type: 'water' | 'fertilize' | 'fertilize-2',
    fertilizer?: string,
    notes?: string,
    customTimestamp?: string,
  ) => {
    const timestamp = customTimestamp || new Date().toISOString();
    const newLog: CareLog = {
      plantId,
      timestamp,
      logId: crypto.randomUUID(),
      type,
      ...(fertilizer ? { fertilizer } : {}),
      ...(notes ? { notes } : {}),
    };

    if (IS_DEV) {
      const all = lsGetAll();
      lsSave([...all, newLog]);
    } else {
      await fetch(`${API_BASE}/plants/logs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plantId, type, fertilizer, notes, timestamp }),
      });
    }
    await fetchLatest();
  }, [fetchLatest]);

  const deleteLog = useCallback(async (plantId: string, timestamp: string) => {
    if (IS_DEV) {
      const all = lsGetAll().filter(l => !(l.plantId === plantId && l.timestamp === timestamp));
      lsSave(all);
    } else {
      await fetch(`${API_BASE}/plants/logs/${encodeURIComponent(plantId)}/${encodeURIComponent(timestamp)}`, {
        method: 'DELETE',
      });
    }
    await fetchLatest();
  }, [fetchLatest]);

  const getLatest = useCallback((plantId: string, type: 'water' | 'fertilize') => {
    return latestLogs[`${plantId}__${type}`] || null;
  }, [latestLogs]);

  return { latestLogs, loading, logCare, deleteLog, getLatest, refresh: fetchLatest };
}

export interface PlantSettings {
  potTypeOverrides: Record<string, 'self-watering' | 'standard'>;
  deletedPlantIds: string[];
  permanentlyDeletedIds: string[];
  trackWateringOverrides: Record<string, boolean>;
}

const LS_SETTINGS_KEY = 'plants-settings-data';
const DEFAULT_SETTINGS: PlantSettings = {
  potTypeOverrides: {
    'money-tree': 'self-watering',
    'cream-allusion-arrowhead': 'self-watering',
    'prayer-plant': 'self-watering',
  },
  deletedPlantIds: [],
  permanentlyDeletedIds: [],
  trackWateringOverrides: {},
};

function lsGetSettings(): PlantSettings {
  try {
    const saved = localStorage.getItem(LS_SETTINGS_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function lsSaveSettings(settings: PlantSettings) {
  try {
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings to localStorage', e);
  }
}

export function usePlantSettings() {
  const [settings, setSettings] = useState<PlantSettings>(lsGetSettings);

  const fetchSettings = useCallback(async () => {
    try {
      if (!IS_DEV) {
        const res = await fetch(`${API_BASE}/plants/settings`);
        if (res.ok) {
          const cloudData: PlantSettings = await res.json();
          const merged: PlantSettings = {
            potTypeOverrides: {
              ...DEFAULT_SETTINGS.potTypeOverrides,
              ...(cloudData.potTypeOverrides || {}),
            },
            deletedPlantIds: cloudData.deletedPlantIds || [],
            permanentlyDeletedIds: cloudData.permanentlyDeletedIds || [],
            trackWateringOverrides: cloudData.trackWateringOverrides || {},
          };
          setSettings(merged);
          lsSaveSettings(merged);
        }
      }
    } catch (e) {
      console.error('Failed to fetch plant settings', e);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const persistSettings = useCallback(async (updated: PlantSettings) => {
    setSettings(updated);
    lsSaveSettings(updated);
    if (!IS_DEV) {
      try {
        await fetch(`${API_BASE}/plants/settings`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(updated),
        });
      } catch (e) {
        console.error('Failed to sync settings to API', e);
      }
    }
  }, []);

  const setPotType = useCallback(
    (plantId: string, potType: 'self-watering' | 'standard') => {
      const next: PlantSettings = {
        ...settings,
        potTypeOverrides: {
          ...settings.potTypeOverrides,
          [plantId]: potType,
        },
      };
      persistSettings(next);
    },
    [settings, persistSettings],
  );

  const softDeletePlant = useCallback(
    (plantId: string) => {
      if (settings.deletedPlantIds.includes(plantId)) return;
      const next: PlantSettings = {
        ...settings,
        deletedPlantIds: [...settings.deletedPlantIds, plantId],
      };
      persistSettings(next);
    },
    [settings, persistSettings],
  );

  const restorePlant = useCallback(
    (plantId: string) => {
      const next: PlantSettings = {
        ...settings,
        deletedPlantIds: settings.deletedPlantIds.filter(id => id !== plantId),
      };
      persistSettings(next);
    },
    [settings, persistSettings],
  );

  const permanentlyDeletePlant = useCallback(
    (plantId: string) => {
      const next: PlantSettings = {
        ...settings,
        deletedPlantIds: settings.deletedPlantIds.filter(id => id !== plantId),
        permanentlyDeletedIds: Array.from(new Set([...settings.permanentlyDeletedIds, plantId])),
      };
      persistSettings(next);
    },
    [settings, persistSettings],
  );

  const setTrackWatering = useCallback(
    (plantId: string, track: boolean) => {
      const next: PlantSettings = {
        ...settings,
        trackWateringOverrides: {
          ...settings.trackWateringOverrides,
          [plantId]: track,
        },
      };
      persistSettings(next);
    },
    [settings, persistSettings],
  );

  return {
    settings,
    setPotType,
    setTrackWatering,
    softDeletePlant,
    restorePlant,
    permanentlyDeletePlant,
    refreshSettings: fetchSettings,
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
