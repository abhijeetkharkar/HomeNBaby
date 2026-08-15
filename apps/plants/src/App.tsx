import { useState, useMemo } from 'react';
import { useCareApi } from './hooks/useCareApi';
import { PLANTS, PLANT_GROUPS } from './data/plants';
import { FERTILIZERS } from './data/fertilizers';
import type { PlantGroup, PlantDef } from './data/plants';
import { PlantCard } from './components/PlantCard';
import { LogCareModal } from './components/LogCareModal';

function App() {
  const { latestLogs, logCare, loading } = useCareApi();
  const [activeGroup, setActiveGroup] = useState<PlantGroup>('indoor');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPlant, setModalPlant] = useState<PlantDef | null>(null);
  const [modalType, setModalType] = useState<'water' | 'fertilize'>('water');

  const visiblePlants = useMemo(() => {
    return PLANTS.filter(p => p.group === activeGroup);
  }, [activeGroup]);

  const handleOpenModal = (plant: PlantDef, type: 'water' | 'fertilize') => {
    setModalPlant(plant);
    setModalType(type);
    setModalOpen(true);
  };

  const handleConfirmLog = async (plantId: string, type: 'water' | 'fertilize', fertilizer?: string, notes?: string) => {
    await logCare(plantId, type, fertilizer, notes);

    // Auto-log watering if they fertilize with a liquid fertilizer (since it is water-based)
    if (type === 'fertilize' && fertilizer) {
      const fert = FERTILIZERS.find(f => f.id === fertilizer);
      if (fert && fert.type === 'liquid') {
        await logCare(plantId, 'water', undefined, `Auto-logged from fertilizing with ${fert.name}`);
      }
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="title">Plants <span style={{ fontSize: '2rem' }}>🌱</span></h1>
      </header>

      <div className="group-tabs">
        {PLANT_GROUPS.map(g => (
          <button
            key={g.key}
            className={`tab-btn ${activeGroup === g.key ? 'active' : ''}`}
            onClick={() => setActiveGroup(g.key)}
          >
            {g.emoji} {g.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading your garden... 🌿
        </div>
      ) : (
        <div className="plant-list">
          {visiblePlants.map(plant => (
            <PlantCard
              key={plant.id}
              plant={plant}
              lastWater={latestLogs[`${plant.id}__water`] || null}
              lastFert={latestLogs[`${plant.id}__fertilize`] || null}
              onLog={handleOpenModal}
            />
          ))}
          {visiblePlants.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No plants in this category yet.
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
