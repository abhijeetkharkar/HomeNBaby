import React, { useState, useMemo } from 'react';
import type { CatalogPlantItem } from '../hooks/useCareApi';
import type { PlantGroup } from '../data/plants';

interface Props {
  homeName: string;
  catalog: CatalogPlantItem[];
  catalogLoading: boolean;
  onAddPlants: (
    items: Array<{
      catalogId: string;
      nickname?: string;
      potType?: 'self-watering' | 'standard';
    }>,
  ) => Promise<unknown>;
  onRequestUnknownPlant: (req: {
    name: string;
    group: PlantGroup;
    nickname?: string;
    potType?: 'self-watering' | 'standard';
  }) => Promise<unknown>;
  onClose: () => void;
}

export function AddPlantModal({
  homeName,
  catalog,
  catalogLoading,
  onAddPlants,
  onRequestUnknownPlant,
  onClose,
}: Props) {
  const [groupFilter, setGroupFilter] = useState<'all' | PlantGroup>('all');
  const [search, setSearch] = useState('');
  const [pickedPlant, setPickedPlant] = useState<CatalogPlantItem | null>(null);
  const [nickname, setNickname] = useState('');
  const [potType, setPotType] = useState<'standard' | 'self-watering'>('standard');
  const [requestGroup, setRequestGroup] = useState<PlantGroup>('indoor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog
      .filter(p => groupFilter === 'all' || p.group === groupFilter)
      .filter(
        p =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.scientificName && p.scientificName.toLowerCase().includes(q)),
      );
  }, [catalog, groupFilter, search]);

  const handleAddPicked = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickedPlant) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const catalogId = pickedPlant.plantId || pickedPlant.id;
      await onAddPlants([
        {
          catalogId,
          ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
          potType,
        },
      ]);
      setMessage(
        `Added ${pickedPlant.name}${nickname.trim() ? ` (${nickname.trim()})` : ''} to ${homeName}!`,
      );
      setPickedPlant(null);
      setNickname('');
      setPotType('standard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add plant');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestCustom = async () => {
    const trimmed = search.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const targetGroup = groupFilter === 'all' ? requestGroup : groupFilter;
      await onRequestUnknownPlant({
        name: trimmed,
        group: targetGroup,
        ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
      });
      setMessage(
        `Added "${trimmed}" as a Coming Soon card in ${homeName} and queued it for curation!`,
      );
      setSearch('');
      setNickname('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to request plant');
    } finally {
      setBusy(false);
    }
  };

  const canSelfWaterPicked =
    pickedPlant &&
    pickedPlant.group !== 'outdoor-garden' &&
    (pickedPlant.selfWatering === 'ideal' || pickedPlant.selfWatering === 'caution');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card add-plant-modal-card"
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-emoji">🌿</span>
          <div>
            <div className="modal-title">Add Plant to {homeName}</div>
            <div className="modal-subtitle">
              Choose from the master catalog or request a new plant
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="auth-alert auth-alert-error" role="alert">
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="auth-alert auth-alert-success" role="status">
              <span>{message}</span>
            </div>
          )}

          {pickedPlant ? (
            <form onSubmit={handleAddPicked} className="add-plant-confirm-box">
              <div className="onboarding-tile-top">
                {pickedPlant.imageUrl ? (
                  <img
                    src={pickedPlant.imageUrl}
                    alt={pickedPlant.name}
                    className="onboarding-tile-img"
                  />
                ) : (
                  <div className="onboarding-tile-emoji">{pickedPlant.emoji}</div>
                )}
                <div className="onboarding-tile-meta">
                  <div className="onboarding-tile-name">{pickedPlant.name}</div>
                  {pickedPlant.scientificName && (
                    <div className="onboarding-tile-sci">{pickedPlant.scientificName}</div>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPickedPlant(null)}
                >
                  Change
                </button>
              </div>

              <div className="auth-field" style={{ marginTop: '0.85rem' }}>
                <label className="auth-label" htmlFor="add-plant-nickname">
                  Nickname / Location (Optional)
                </label>
                <input
                  id="add-plant-nickname"
                  type="text"
                  className="auth-input"
                  placeholder="e.g. Living Room, Kitchen Window, Front Porch..."
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  maxLength={50}
                />
                <span className="auth-helper">
                  Helpful when you have more than one {pickedPlant.name} in your home.
                </span>
              </div>

              {canSelfWaterPicked && (
                <label className="user-toggle-row" style={{ marginTop: '0.75rem' }}>
                  <div>
                    <div className="user-toggle-label">💧 Self-Watering Pot</div>
                    <div className="user-toggle-sub">
                      Uses reservoir refill intervals ({pickedPlant.selfWaterFreqDays?.join('-')}d)
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="user-toggle-checkbox"
                    checked={potType === 'self-watering'}
                    onChange={e =>
                      setPotType(e.target.checked ? 'self-watering' : 'standard')
                    }
                  />
                </label>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPickedPlant(null)}
                  disabled={busy}
                >
                  Back to Catalog
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? 'Adding...' : `➕ Add ${pickedPlant.name}`}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="add-plant-filter-tabs">
                {(
                  [
                    { key: 'all', label: '🌎 All' },
                    { key: 'indoor', label: '🏠 Indoor' },
                    { key: 'outdoor-potted', label: '🪴 Outdoor Potted' },
                    { key: 'outdoor-garden', label: '🌾 Garden Beds' },
                  ] as const
                ).map(t => (
                  <button
                    key={t.key}
                    type="button"
                    className={`home-pill-btn ${groupFilter === t.key ? 'active' : ''}`}
                    onClick={() => setGroupFilter(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="onboarding-search-row" style={{ marginTop: '0.75rem' }}>
                <input
                  type="text"
                  className="auth-input"
                  placeholder="Search catalog by plant name or scientific name..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              {catalogLoading ? (
                <div className="onboarding-empty">Loading catalog... 🌿</div>
              ) : (
                <div className="add-plant-catalog-list">
                  {filteredCatalog.map(plant => {
                    const id = plant.plantId || plant.id;
                    return (
                      <button
                        key={id}
                        type="button"
                        className="add-plant-catalog-row"
                        onClick={() => {
                          setPickedPlant(plant);
                          setNickname('');
                          setPotType('standard');
                        }}
                      >
                        <div className="onboarding-tile-top">
                          {plant.imageUrl ? (
                            <img
                              src={plant.imageUrl}
                              alt={plant.name}
                              className="onboarding-tile-img"
                              loading="lazy"
                            />
                          ) : (
                            <div className="onboarding-tile-emoji">{plant.emoji}</div>
                          )}
                          <div className="onboarding-tile-meta">
                            <div className="onboarding-tile-name">{plant.name}</div>
                            {plant.scientificName && (
                              <div className="onboarding-tile-sci">{plant.scientificName}</div>
                            )}
                          </div>
                          <span className="add-plant-select-pill">Select →</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {search.trim().length >= 2 && (
                <div className="onboarding-missing-box" style={{ marginTop: '0.85rem' }}>
                  <div style={{ flex: 1 }}>
                    <strong>Can&rsquo;t find &ldquo;{search.trim()}&rdquo;?</strong>
                    <div className="onboarding-missing-sub">
                      Add it as a &ldquo;Coming Soon&rdquo; plant card and our catalog will curate its care guide.
                    </div>
                    {groupFilter === 'all' && (
                      <div style={{ marginTop: '0.45rem' }}>
                        <select
                          className="filter-select"
                          value={requestGroup}
                          onChange={e => setRequestGroup(e.target.value as PlantGroup)}
                        >
                          <option value="indoor">🏠 Indoor Houseplant</option>
                          <option value="outdoor-potted">🪴 Outdoor Potted</option>
                          <option value="outdoor-garden">🌾 Garden Bed / Crop</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleRequestCustom}
                    disabled={busy}
                  >
                    {busy ? 'Adding...' : `➕ Request "${search.trim()}"`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
