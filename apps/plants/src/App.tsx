import { useState, useMemo, useCallback } from 'react';
import { useCareApi, computeUrgency } from './hooks/useCareApi';
import { PLANTS, PLANT_GROUPS } from './data/plants';
import { FERTILIZERS } from './data/fertilizers';

import type { PlantGroup, PlantDef } from './data/plants';
import { PlantCard } from './components/PlantCard';
import { LogCareModal } from './components/LogCareModal';

type ExtendedGroup = PlantGroup | 'all';
type TaskFilter = 'all' | 'water-due' | 'fert-due';
type FertFilter =
  | 'all'
  | 'schultz'
  | 'agrothrive'
  | 'espoma-garden-tone'
  | 'espoma-indoor'
  | 'bone-meal'
  | 'blood-meal'
  | 'epsom-salt';

function rankUrgency(u: { status: 'overdue' | 'due-today' | 'due-soon' | 'never' | 'ok'; daysUntil: number }): number {
  switch (u.status) {
    case 'overdue': return 1;
    case 'due-today': return 2;
    case 'due-soon': return 3;
    case 'never': return 4;
    case 'ok': return 5;
    default: return 6;
  }
}

function getPlantUrgency(
  plant: PlantDef,
  latestLogs: Record<string, { timestamp: string } | undefined>,
  taskFilter: TaskFilter,
) {
  const waterUrgency = plant.waterFreqDays
    ? computeUrgency(latestLogs[`${plant.id}__water`]?.timestamp || null, plant.waterFreqDays)
    : null;
  const fertUrgency = computeUrgency(
    latestLogs[`${plant.id}__fertilize`]?.timestamp || null,
    plant.fertFreqDays,
  );
  const fert2Urgency = plant.fertFreqDays2
    ? computeUrgency(latestLogs[`${plant.id}__fertilize-2`]?.timestamp || null, plant.fertFreqDays2)
    : null;

  if (taskFilter === 'water-due') {
    return waterUrgency || { status: 'ok' as const, daysUntil: 999 };
  }

  if (taskFilter === 'fert-due') {
    const urgencies = [fertUrgency, ...(fert2Urgency ? [fert2Urgency] : [])];
    return urgencies.reduce(
      (prev, curr) => (rankUrgency(curr) < rankUrgency(prev) ? curr : prev),
      fertUrgency,
    );
  }

  const allUrgencies = [
    ...(waterUrgency ? [waterUrgency] : []),
    fertUrgency,
    ...(fert2Urgency ? [fert2Urgency] : []),
  ];

  return allUrgencies.reduce(
    (prev, curr) => (rankUrgency(curr) < rankUrgency(prev) ? curr : prev),
    fertUrgency,
  );
}

function App() {
  const { latestLogs, logCare, loading } = useCareApi();
  const [activeGroup, setActiveGroup] = useState<ExtendedGroup>('all');
  const [activeTaskFilter, setActiveTaskFilter] = useState<TaskFilter>('all');
  const [activeFertFilter, setActiveFertFilter] = useState<FertFilter>('all');
  const [showFertGuide, setShowFertGuide] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPlant, setModalPlant] = useState<PlantDef | null>(null);
  const [modalType, setModalType] = useState<'water' | 'fertilize' | 'fertilize-2'>('water');

  const visiblePlants = useMemo(() => {
    let list = [...PLANTS];

    // 1. Group Filtering
    if (activeGroup !== 'all') {
      list = list.filter(p => p.group === activeGroup);
    }

    // 2. Task / Urgency Filtering
    if (activeTaskFilter === 'water-due') {
      list = list.filter(p => {
        if (!p.waterFreqDays) return false;
        const last = latestLogs[`${p.id}__water`]?.timestamp;
        const urgency = computeUrgency(last || null, p.waterFreqDays);
        return (
          urgency.status === 'overdue' ||
          urgency.status === 'due-today' ||
          urgency.status === 'due-soon' ||
          urgency.status === 'never'
        );
      });
    } else if (activeTaskFilter === 'fert-due') {
      list = list.filter(p => {
        const last = latestLogs[`${p.id}__fertilize`]?.timestamp;
        const urgency = computeUrgency(last || null, p.fertFreqDays);
        return (
          urgency.status === 'overdue' ||
          urgency.status === 'due-today' ||
          urgency.status === 'due-soon' ||
          urgency.status === 'never'
        );
      });
    }

    // 3. Fertilizer Filtering
    if (activeFertFilter !== 'all') {
      if (activeFertFilter === 'schultz') {
        list = list.filter(
          p =>
            p.fertRecommendation.toLowerCase().includes('schultz') ||
            p.fertRecommendation2?.toLowerCase().includes('schultz') ||
            p.altFertilizers?.some(a => a.toLowerCase().includes('schultz')),
        );
      } else if (activeFertFilter === 'agrothrive') {
        list = list.filter(
          p =>
            p.fertRecommendation.toLowerCase().includes('agrothrive') ||
            p.fertRecommendation2?.toLowerCase().includes('agrothrive') ||
            p.altFertilizers?.some(a => a.toLowerCase().includes('agrothrive')),
        );
      } else if (activeFertFilter === 'espoma-garden-tone') {
        list = list.filter(
          p =>
            p.fertRecommendation.toLowerCase().includes('garden-tone') ||
            p.fertRecommendation2?.toLowerCase().includes('garden-tone') ||
            p.altFertilizers?.some(a => a.toLowerCase().includes('garden-tone')),
        );
      } else if (activeFertFilter === 'espoma-indoor') {
        list = list.filter(
          p =>
            p.fertRecommendation.toLowerCase().includes('indoor') ||
            p.fertRecommendation2?.toLowerCase().includes('indoor') ||
            p.altFertilizers?.some(a => a.toLowerCase().includes('indoor')),
        );
      } else if (activeFertFilter === 'bone-meal') {
        list = list.filter(
          p =>
            p.fertRecommendation.toLowerCase().includes('bone meal') ||
            p.fertRecommendation2?.toLowerCase().includes('bone meal') ||
            p.altFertilizers?.some(a => a.toLowerCase().includes('bone meal')),
        );
      } else if (activeFertFilter === 'blood-meal') {
        list = list.filter(
          p =>
            p.fertRecommendation.toLowerCase().includes('blood meal') ||
            p.fertRecommendation2?.toLowerCase().includes('blood meal') ||
            p.altFertilizers?.some(a => a.toLowerCase().includes('blood meal')),
        );
      } else if (activeFertFilter === 'epsom-salt') {
        list = list.filter(
          p =>
            p.fertRecommendation.toLowerCase().includes('epsom') ||
            p.fertRecommendation2?.toLowerCase().includes('epsom') ||
            p.altFertilizers?.some(a => a.toLowerCase().includes('epsom')) ||
            p.notes.some(n => n.toLowerCase().includes('epsom salt')),
        );
      }
    }

    // 4. 5-Tier Urgency Sorting: Overdue -> Due Today -> Due Soon -> No Record -> OK
    list.sort((a, b) => {
      const uA = getPlantUrgency(a, latestLogs, activeTaskFilter);
      const uB = getPlantUrgency(b, latestLogs, activeTaskFilter);
      const rankA = rankUrgency(uA);
      const rankB = rankUrgency(uB);

      if (rankA !== rankB) {
        return rankA - rankB;
      }
      // Both overdue: most overdue first (-10 before -1)
      if (uA.status === 'overdue') {
        return uA.daysUntil - uB.daysUntil;
      }
      // Both due-soon or OK: closest due date first (1 before 5)
      if (uA.status === 'due-soon' || uA.status === 'ok') {
        return uA.daysUntil - uB.daysUntil;
      }
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [activeGroup, activeTaskFilter, activeFertFilter, latestLogs]);

  const handleOpenModal = useCallback(
    (plant: PlantDef, defaultType: 'water' | 'fertilize' | 'fertilize-2') => {
      setModalPlant(plant);
      setModalType(defaultType);
      setModalOpen(true);
    },
    [],
  );

  const handleConfirmLog = useCallback(
    async (
      plantId: string,
      type: 'water' | 'fertilize' | 'fertilize-2',
      fertilizer?: string,
      notes?: string,
    ) => {
      await logCare(plantId, type, fertilizer, notes);

      // Auto-log watering if fertilizing with a liquid fertilizer
      if (type.includes('fertilize') && fertilizer) {
        const liquidKeywords = ['schultz', 'agrothrive', 'liquid'];
        const isLiquid = liquidKeywords.some(k => fertilizer.toLowerCase().includes(k));
        if (isLiquid) {
          await logCare(plantId, 'water', undefined, `Auto-logged from ${fertilizer}`);
        }
      }
      setModalOpen(false);
    },
    [logCare],
  );

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="title">
          Plants Tracker <span style={{ fontSize: '2rem' }}>🌱</span>
        </h1>
        <button
          className={`fert-guide-toggle-btn ${showFertGuide ? 'active' : ''}`}
          onClick={() => setShowFertGuide(!showFertGuide)}
          title="Toggle Fertilizer Application & Dosage Guide"
        >
          <span>🧪 Fertilizer Application Guide</span>
          <span className="toggle-chevron">{showFertGuide ? '▲' : '▼'}</span>
        </button>
      </header>

      {/* Collapsible Fertilizer Application Guide */}
      {showFertGuide && (
        <section className="fert-guide-container">
          <div className="fert-guide-header">
            <h3>🧪 Fertilizer & Dosage Reference Guide</h3>
            <p>Application rates, mixing ratios, and best practices for your plant inventory</p>
          </div>
          <div className="fert-guide-grid">
            {FERTILIZERS.map(f => (
              <div key={f.id} className="fert-guide-card">
                <div className="fert-card-top">
                  <h4 className="fert-card-name">{f.name}</h4>
                  <div className="fert-badges">
                    <span className="fert-npk-badge">NPK {f.npk}</span>
                    <span className={`fert-type-badge fert-type-${f.type}`}>{f.type}</span>
                  </div>
                </div>
                <div className="fert-card-row">
                  <span className="fert-card-label">🥣 Dosage:</span>
                  <span className="fert-card-val">{f.dosage}</span>
                </div>
                <div className="fert-card-row">
                  <span className="fert-card-label">💧 Method:</span>
                  <span className="fert-card-val">{f.applicationMethod}</span>
                </div>
                <p className="fert-card-desc">{f.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filter Control Bar */}
      <div className="tracker-filters">
        <div className="filter-grid">
          {/* Group Dropdown */}
          <div className="filter-control">
            <label htmlFor="filter-group" className="filter-control-label">Group</label>
            <select
              id="filter-group"
              className="filter-select"
              value={activeGroup}
              onChange={e => setActiveGroup(e.target.value as ExtendedGroup)}
            >
              <option value="all">🌎 All Groups</option>
              {PLANT_GROUPS.map(g => (
                <option key={g.key} value={g.key}>
                  {g.emoji} {g.label}
                </option>
              ))}
            </select>
          </div>

          {/* Task / Urgency Dropdown */}
          <div className="filter-control">
            <label htmlFor="filter-task" className="filter-control-label">Task / Urgency</label>
            <select
              id="filter-task"
              className="filter-select"
              value={activeTaskFilter}
              onChange={e => setActiveTaskFilter(e.target.value as TaskFilter)}
            >
              <option value="all">⚡ All Tasks</option>
              <option value="water-due">💧 Water Due</option>
              <option value="fert-due">🧪 Fertilizer Due</option>
            </select>
          </div>

          {/* Fertilizer Dropdown */}
          <div className="filter-control">
            <label htmlFor="filter-fert" className="filter-control-label">Fertilizer</label>
            <select
              id="filter-fert"
              className="filter-select"
              value={activeFertFilter}
              onChange={e => setActiveFertFilter(e.target.value as FertFilter)}
            >
              <option value="all">🧪 All Fertilizers</option>
              <option value="schultz">🧪 Schultz (10-15-10)</option>
              <option value="agrothrive">🌿 AgroThrive Liquid</option>
              <option value="espoma-garden-tone">🌱 Espoma Garden-tone (3-4-4)</option>
              <option value="espoma-indoor">🌱 Espoma Indoor! Liquid (2-2-2)</option>
              <option value="bone-meal">🦴 Bone Meal</option>
              <option value="blood-meal">🩸 Blood Meal</option>
              <option value="epsom-salt">🧂 Epsom Salt</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading your tracker... 🌿
        </div>
      ) : (
        <div className="plant-list">
          <div className="results-count">
            Showing {visiblePlants.length} plant{visiblePlants.length !== 1 ? 's' : ''} (sorted by due status)
          </div>
          {visiblePlants.map(plant => (
            <PlantCard
              key={plant.id}
              plant={plant}
              lastWater={latestLogs[`${plant.id}__water`] || null}
              lastFert={latestLogs[`${plant.id}__fertilize`] || null}
              lastFert2={latestLogs[`${plant.id}__fertilize-2`] || null}
              onLog={handleOpenModal}
            />
          ))}
          {visiblePlants.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem',
                color: 'var(--text-muted)',
                gridColumn: '1 / -1',
              }}
            >
              No plants need attention under this filter! 🎉
            </div>
          )}
        </div>
      )}

      {modalOpen && modalPlant && (
        <LogCareModal
          plant={modalPlant}
          defaultType={modalType}
          onConfirm={handleConfirmLog}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
