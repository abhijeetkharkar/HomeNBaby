import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export interface HomeProfile {
  homeId: string;
  name: string;
  createdBy: string;
  members: string[];
  role: 'owner' | 'member';
  isDefault: boolean;
  onboardingComplete?: boolean;
  createdAt: string;
  joinedAt?: string;
}

const PLANTS_API_BASE =
  import.meta.env.VITE_PLANTS_API_URL || 'https://plantsapi.abhijeetkharkar.com';
const ACTIVE_HOME_LS_KEY = 'plants-active-home-id';

export function useHomeProfile() {
  const { user, getIdToken } = useAuth();
  const [homes, setHomes] = useState<HomeProfile[]>([]);
  const [activeHomeId, setActiveHomeIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_HOME_LS_KEY);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setActiveHomeId = useCallback((id: string | null) => {
    setActiveHomeIdState(id);
    try {
      if (id) localStorage.setItem(ACTIVE_HOME_LS_KEY, id);
      else localStorage.removeItem(ACTIVE_HOME_LS_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = await getIdToken();
    if (!token) {
      setHomes([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${PLANTS_API_BASE}/plants/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to load home profile');
      }
      const data: { email: string; homes: HomeProfile[]; defaultHomeId: string | null } =
        await res.json();
      setHomes(data.homes || []);
      setError(null);

      // Keep saved activeHomeId if still valid; otherwise fall back to defaultHomeId
      const saved = localStorage.getItem(ACTIVE_HOME_LS_KEY);
      const validSaved = data.homes.some(h => h.homeId === saved);
      const resolved = validSaved
        ? saved
        : data.defaultHomeId || data.homes[0]?.homeId || null;
      setActiveHomeId(resolved);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load profile';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, setActiveHomeId]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const token = await getIdToken();
      if (!token || cancelled) return;
      try {
        const res = await fetch(`${PLANTS_API_BASE}/plants/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data: { email: string; homes: HomeProfile[]; defaultHomeId: string | null } =
          await res.json();
        if (cancelled) return;
        setHomes(data.homes || []);
        const saved = localStorage.getItem(ACTIVE_HOME_LS_KEY);
        const validSaved = data.homes.some(h => h.homeId === saved);
        const resolved = validSaved
          ? saved
          : data.defaultHomeId || data.homes[0]?.homeId || null;
        setActiveHomeId(resolved);
      } catch {
        // handled silently on initial load
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, getIdToken, setActiveHomeId]);

  const createHome = useCallback(
    async (name: string): Promise<HomeProfile> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${PLANTS_API_BASE}/plants/homes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create home');
      }
      await refreshProfile();
      setActiveHomeId(data.home.homeId);
      return data.home;
    },
    [getIdToken, refreshProfile, setActiveHomeId],
  );

  const inviteMember = useCallback(
    async (
      homeId: string,
      inviteEmail: string,
    ): Promise<{ success: boolean; userInSystem: boolean; members: string[] }> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${PLANTS_API_BASE}/plants/homes/${encodeURIComponent(homeId)}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ inviteEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to invite family member');
      }
      await refreshProfile();
      return data;
    },
    [getIdToken, refreshProfile],
  );

  const deleteHome = useCallback(
    async (homeId: string): Promise<void> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${PLANTS_API_BASE}/plants/homes/${encodeURIComponent(homeId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete home');
      }
      await refreshProfile();
    },
    [getIdToken, refreshProfile],
  );

  const activeHome = homes.find(h => h.homeId === activeHomeId) || homes[0] || null;

  return {
    homes,
    activeHome,
    activeHomeId: activeHome?.homeId || null,
    setActiveHomeId,
    loading,
    error,
    createHome,
    inviteMember,
    deleteHome,
    refreshProfile,
  };
}
