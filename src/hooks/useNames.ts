import { useState, useEffect, useCallback } from 'react';
import type { BabyName } from '../types';
import { fetchNames, toggleFavourite as apiToggleFavourite } from '../api/names';

export function useNames() {
  const [names, setNames] = useState<BabyName[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNames()
      .then(setNames)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleFavourite = useCallback(async (id: string, currentFav: boolean) => {
    const next = !currentFav;
    // Optimistic update
    setNames((prev) => prev.map((n) => (n.id === id ? { ...n, favourite: next } : n)));
    try {
      await apiToggleFavourite(id, next);
    } catch {
      // Revert on error
      setNames((prev) => prev.map((n) => (n.id === id ? { ...n, favourite: currentFav } : n)));
    }
  }, []);

  return { names, loading, error, toggleFavourite };
}
