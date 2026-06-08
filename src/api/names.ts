import type { BabyName } from '../types';

export async function fetchNames(): Promise<BabyName[]> {
  const res = await fetch('/api/names');
  if (!res.ok) throw new Error(`Failed to fetch names: ${res.status}`);
  return res.json();
}

export async function toggleFavourite(id: string, favourite: boolean): Promise<void> {
  const res = await fetch('/api/names/favourite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, favourite }),
  });
  if (!res.ok) throw new Error(`Failed to update favourite: ${res.status}`);
}
