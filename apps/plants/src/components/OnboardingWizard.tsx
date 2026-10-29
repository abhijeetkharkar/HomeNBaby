import { useState, useMemo } from 'react';
import type { CatalogPlantItem } from '../hooks/useCareApi';
import type { PlantGroup } from '../data/plants';

interface SelectedEntry {
  catalogId: string;
  nickname: string;
  potType: 'standard' | 'self-watering';
}

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
  onCompleteOnboarding: () => Promise<void>;
}

const STEPS: Array<{
  group: PlantGroup;
  title: string;
  emoji: string;
  subtitle: string;
}> = [
  {
    group: 'indoor',
    title: 'Indoor Houseplants',
    emoji: '🏠',
    subtitle: 'Select the indoor houseplants you grow inside your home (or skip this step).',
  },
  {
    group: 'outdoor-potted',
    title: 'Outdoor Potted Plants',
    emoji: '🪴',
    subtitle: 'Select container plants on your porch, patio, or balcony (or skip this step).',
  },
  {
    group: 'outdoor-garden',
    title: 'Garden Beds & Crops',
    emoji: '🌾',
    subtitle: 'Select vegetables, herbs, fruit trees, and in-ground garden plants.',
  },
];

export function OnboardingWizard({
  homeName,
  catalog,
  catalogLoading,
  onAddPlants,
  onRequestUnknownPlant,
  onCompleteOnboarding,
}: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, SelectedEntry>>({});
  const [customRequested, setCustomRequested] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentStep = STEPS[stepIdx];

  const groupPlants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog
      .filter(p => p.group === currentStep.group)
      .filter(
        p =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.scientificName && p.scientificName.toLowerCase().includes(q)),
      );
  }, [catalog, currentStep.group, search]);

  const togglePlant = (plant: CatalogPlantItem) => {
    const id = plant.plantId || plant.id;
    setSelected(prev => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = {
          catalogId: id,
          nickname: '',
          potType: 'standard',
        };
      }
      return next;
    });
  };

  const updateSelected = (catalogId: string, patch: Partial<SelectedEntry>) => {
    setSelected(prev => {
      if (!prev[catalogId]) return prev;
      return {
        ...prev,
        [catalogId]: { ...prev[catalogId], ...patch },
      };
    });
  };

  const handleRequestCustom = async () => {
    const trimmed = search.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await onRequestUnknownPlant({
        name: trimmed,
        group: currentStep.group,
      });
      setCustomRequested(prev => [...prev, `${trimmed} (${currentStep.title})`]);
      setSearch('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to request plant');
    } finally {
      setBusy(false);
    }
  };

  const handleFinish = async () => {
    setBusy(true);
    setError(null);
    try {
      const items = Object.values(selected).map(s => ({
        catalogId: s.catalogId,
        ...(s.nickname.trim() ? { nickname: s.nickname.trim() } : {}),
        potType: s.potType,
      }));
      if (items.length > 0) {
        await onAddPlants(items);
      }
      await onCompleteOnboarding();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to finish setup');
      setBusy(false);
    }
  };

  const totalSelectedCount = Object.keys(selected).length + customRequested.length;

  return (
    <section className="onboarding-wizard-card">
      <div className="onboarding-header">
        <div>
          <div className="onboarding-step-pill">
            Step {stepIdx + 1} of {STEPS.length} • Setting up {homeName}
          </div>
          <h2 className="onboarding-title">
            {currentStep.emoji} {currentStep.title}
          </h2>
          <p className="onboarding-subtitle">{currentStep.subtitle}</p>
        </div>

        <div className="onboarding-step-dots">
          {STEPS.map((s, idx) => (
            <button
              key={s.group}
              type="button"
              className={`onboarding-dot ${idx === stepIdx ? 'active' : idx < stepIdx ? 'done' : ''}`}
              onClick={() => {
                setStepIdx(idx);
                setSearch('');
              }}
            >
              {s.emoji} {s.title}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="auth-alert auth-alert-error" role="alert">
          <span>{error}</span>
        </div>
      )}

      <div className="onboarding-search-row">
        <input
          type="text"
          className="auth-input"
          placeholder={`Search ${currentStep.title.toLowerCase()} by common or scientific name...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search.trim() && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setSearch('')}
          >
            Clear
          </button>
        )}
      </div>

      {customRequested.length > 0 && (
        <div className="onboarding-custom-banner">
          🌱 Added to Coming Soon queue: <strong>{customRequested.join(', ')}</strong>
        </div>
      )}

      {catalogLoading ? (
        <div className="onboarding-empty">Loading plant catalog... 🌿</div>
      ) : (
        <>
          <div className="onboarding-grid">
            {groupPlants.map(plant => {
              const id = plant.plantId || plant.id;
              const entry = selected[id];
              const isSelected = Boolean(entry);
              const canSelfWater =
                currentStep.group !== 'outdoor-garden' &&
                (plant.selfWatering === 'ideal' || plant.selfWatering === 'caution');

              return (
                <div
                  key={id}
                  className={`onboarding-plant-tile ${isSelected ? 'selected' : ''}`}
                  onClick={() => togglePlant(plant)}
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
                    <span className={`onboarding-check ${isSelected ? 'checked' : ''}`}>
                      {isSelected ? '✓' : '+'}
                    </span>
                  </div>

                  {isSelected && (
                    <div
                      className="onboarding-tile-options"
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        className="onboarding-mini-input"
                        placeholder="Optional nickname (e.g. Living Room)"
                        value={entry.nickname}
                        onChange={e => updateSelected(id, { nickname: e.target.value })}
                        maxLength={40}
                      />
                      {canSelfWater && (
                        <label className="onboarding-sw-toggle">
                          <input
                            type="checkbox"
                            checked={entry.potType === 'self-watering'}
                            onChange={e =>
                              updateSelected(id, {
                                potType: e.target.checked ? 'self-watering' : 'standard',
                              })
                            }
                          />
                          <span>💧 Self-watering pot</span>
                        </label>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {search.trim().length >= 2 && (
            <div className="onboarding-missing-box">
              <div>
                <strong>Don&rsquo;t see &ldquo;{search.trim()}&rdquo; in our catalog?</strong>
                <div className="onboarding-missing-sub">
                  Add it anyway — we&rsquo;ll place a &ldquo;Coming Soon&rdquo; card in your home and curate its care profile.
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleRequestCustom}
                disabled={busy}
              >
                ➕ Request &ldquo;{search.trim()}&rdquo;
              </button>
            </div>
          )}
        </>
      )}

      <div className="onboarding-footer">
        <div className="onboarding-footer-left">
          {stepIdx > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setStepIdx(i => i - 1);
                setSearch('');
              }}
              disabled={busy}
            >
              ← Back
            </button>
          )}
          <button
            type="button"
            className="onboarding-skip-btn"
            onClick={handleFinish}
            disabled={busy}
          >
            {totalSelectedCount > 0 ? 'Save & Skip Remaining Steps' : 'Skip Setup for Now'}
          </button>
        </div>

        <div className="onboarding-footer-right">
          {stepIdx < STEPS.length - 1 ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setStepIdx(i => i + 1);
                setSearch('');
              }}
              disabled={busy}
            >
              Next: {STEPS[stepIdx + 1].emoji} {STEPS[stepIdx + 1].title} →
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={handleFinish}
              disabled={busy}
            >
              {busy
                ? 'Saving Garden...'
                : totalSelectedCount > 0
                ? `🌱 Finish Setup (${totalSelectedCount} selected)`
                : '✓ Finish Setup'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
