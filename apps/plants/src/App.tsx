import { useState, useMemo, useCallback } from 'react';
import { useCareApi, computeUrgency } from './hooks/useCareApi';
import { PLANTS, PLANT_GROUPS } from './data/plants';

import type { PlantGroup, PlantDef } from './data/plants';
import { PlantCard } from './components/PlantCard';
import { LogCareModal } from './components/LogCareModal';

type ExtendedGroup = PlantGroup | 'all';
type FilterType = 'all' | 'water-due' | 'fert-due' | 'agrothrive' | 'schultz' | 'espoma';

function App() {
  const { latestLogs, logCare, loading } = useCareApi();
  const [activeGroup, setActiveGroup] = useState<ExtendedGroup>('all');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPlant, setModalPlant] = useState<PlantDef | null>(null);
  const [modalType, setModalType] = useState<'water' | 'fertilize' | 'fertilize-2'>('water');

  const visiblePlants = useMemo(() => {
    let list = PLANTS;

    // 1. Group Filtering
    if (activeGroup !== 'all') {
      list = list.filter(p => p.group === activeGroup);
    }

    // 2. Quick Filtering
    if (activeFilter !== 'all') {
      if (activeFilter === 'water-due') {
        list = list.filter(p => {
          if (!p.waterFreqDays) return false;
          const last = latestLogs[`${p.id}__water`]?.timestamp;
          const urgency = computeUrgency(last || null, p.waterFreqDays);
          return urgency.status === 'overdue' || urgency.status === 'due-today' || urgency.status === 'due-soon' || urgency.status === 'never';
        });
      } else if (activeFilter === 'fert-due') {
        list = list.filter(p => {
          const last = latestLogs[`${p.id}__fertilize`]?.timestamp;
          const urgency = computeUrgency(last || null, p.fertFreqDays);
          return urgency.status === 'overdue' || urgency.status === 'due-today' || urgency.status === 'due-soon' || urgency.status === 'never';
        });
      } else if (activeFilter === 'agrothrive') {
        list = list.filter(p =>
          p.fertRecommendation.toLowerCase().includes('agrothrive') ||
          p.fertRecommendation2?.toLowerCase().includes('agrothrive') ||
          p.altFertilizers?.some(a => a.toLowerCase().includes('agrothrive'))
        );
      } else if (activeFilter === 'schultz') {
        list = list.filter(p =>
          p.fertRecommendation.toLowerCase().includes('schultz') ||
          p.fertRecommendation2?.toLowerCase().includes('schultz') ||
          p.altFertilizers?.some(a => a.toLowerCase().includes('schultz'))
        );
      } else if (activeFilter === 'espoma') {
        list = list.filter(p =>
          p.fertRecommendation.toLowerCase().includes('espoma') ||
          p.fertRecommendation2?.toLowerCase().includes('espoma') ||
          p.altFertilizers?.some(a => a.toLowerCase().includes('espoma'))
        );
      }
    }

    return list;
  }, [activeGroup, activeFilter, latestLogs]);

  const handleOpenModal = useCallback((plant: PlantDef, defaultType: 'water' | 'fertilize' | 'fertilize-2') => {
    setModalPlant(plant);
    setModalType(defaultType);
    setModalOpen(true);
  }, []);

  const handleConfirmLog = useCallback(async (plantId: string, type: 'water' | 'fertilize' | 'fertilize-2', fertilizer?: string, notes?: string) => {
    await logCare(plantId, type, fertilizer, notes);

    // Auto-log watering if they fertilize with a liquid fertilizer (since it is water-based)
    if (type.includes('fertilize') && fertilizer) {
      const liquidKeywords = ['schultz', 'agrothrive', 'liquid'];
      const isLiquid = liquidKeywords.some(k => fertilizer.toLowerCase().includes(k));
      if (isLiquid) {
        await logCare(plantId, 'water', undefined, `Auto-logged from ${fertilizer}`);
      }
    }
    setModalOpen(false);
  }, [logCare]);

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="title">Plants Tracker <span style={{ fontSize: '2rem' }}>🌱</span></h1>
      </header>

      <div className="tracker-filters">
        <div className="filter-row">
          <span className="filter-label">Group:</span>
          <button className={`filter-btn ${activeGroup === 'all' ? 'active' : ''}`} onClick={() => setActiveGroup('all')}>
            🌎 All
          </button>
          {PLANT_GROUPS.map(g => (
            <button
              key={g.key}
              className={`filter-btn ${activeGroup === g.key ? 'active' : ''}`}
              onClick={() => setActiveGroup(g.key)}
            >
              {g.emoji} {g.label}
            </button>
          ))}
        </div>
        
        <div className="filter-row">
          <span className="filter-label">Quick:</span>
          <button className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>
            All Tasks
          </button>
          <button className={`filter-btn ${activeFilter === 'water-due' ? 'active' : ''}`} onClick={() => setActiveFilter('water-due')}>
            💧 Water Due
          </button>
          <button className={`filter-btn ${activeFilter === 'fert-due' ? 'active' : ''}`} onClick={() => setActiveFilter('fert-due')}>
            🧪 Fertilizer Due
          </button>
          <button className={`filter-btn ${activeFilter === 'agrothrive' ? 'active' : ''}`} onClick={() => setActiveFilter('agrothrive')}>
            🧪 AgroThrive
          </button>
          <button className={`filter-btn ${activeFilter === 'schultz' ? 'active' : ''}`} onClick={() => setActiveFilter('schultz')}>
            🧪 Schultz
          </button>
          <button className={`filter-btn ${activeFilter === 'espoma' ? 'active' : ''}`} onClick={() => setActiveFilter('espoma')}>
            🧪 Espoma
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading your tracker... 🌿
        </div>
      ) : (
        <div className="plant-list">
          <div className="results-count">
            {visiblePlants.length} plant{visiblePlants.length !== 1 ? 's' : ''} match your filters
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
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
              No plants need attention here! 🎉
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
