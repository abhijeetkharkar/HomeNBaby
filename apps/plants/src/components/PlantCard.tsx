import { useState } from 'react';
import type { PlantDef } from '../data/plants';
import type { CareLog } from '../hooks/useCareApi';
import { computeUrgency } from '../hooks/useCareApi';

interface Props {
  plant: PlantDef;
  lastWater: CareLog | null;
  lastFert: CareLog | null;
  lastFert2?: CareLog | null;
  onLog: (plant: PlantDef, type: 'water' | 'fertilize' | 'fertilize-2') => void;
}



function getStatusColorClass(status: string): string {
  switch (status) {
    case 'overdue': return 'text-overdue';
    case 'due-today': return 'text-today';
    case 'due-soon': return 'text-soon';
    case 'ok': return 'text-ok';
    default: return 'text-never';
  }
}

function getStatusText(daysUntil: number, status: string): string {
  switch (status) {
    case 'overdue': return `${Math.abs(daysUntil)}d overdue`;
    case 'due-today': return `Due today`;
    case 'due-soon': return `${daysUntil}d left`;
    case 'ok': return `${daysUntil}d left`;
    default: return `No record`;
  }
}

export function PlantCard({ plant, lastWater, lastFert, lastFert2, onLog }: Props) {
  const [flipped, setFlipped] = useState(false);

  const waterUrgency = plant.waterFreqDays
    ? computeUrgency(lastWater?.timestamp || null, plant.waterFreqDays)
    : null;
  const fertUrgency = computeUrgency(lastFert?.timestamp || null, plant.fertFreqDays);
  
  const fert2Urgency = plant.fertFreqDays2 
    ? computeUrgency(lastFert2?.timestamp || null, plant.fertFreqDays2) 
    : null;

  let defaultTab: 'water' | 'fertilize' | 'fertilize-2' = 'water';
  if (waterUrgency?.status === 'overdue') defaultTab = 'water';
  else if (fertUrgency.status === 'overdue') defaultTab = 'fertilize';
  else if (fert2Urgency?.status === 'overdue') defaultTab = 'fertilize-2';
  else if (waterUrgency?.status === 'due-today') defaultTab = 'water';
  else if (fertUrgency.status === 'due-today') defaultTab = 'fertilize';
  else if (fert2Urgency?.status === 'due-today') defaultTab = 'fertilize-2';
  


  return (
    <div className={`flip-card-container ${flipped ? 'flipped' : ''}`}>
      <div className="flip-card-inner">
        
        {/* FRONT OF CARD */}
        <div 
          className="flip-card-front" 
          onClick={() => setFlipped(true)}
          style={{ backgroundImage: plant.imageUrl ? `url(${plant.imageUrl})` : 'none' }}
        >
          {!plant.imageUrl && (
            <div className="front-no-image-bg">
              <span className="front-emoji-large">{plant.emoji}</span>
            </div>
          )}
          
          {plant.warning && (
            <div className="front-warning-top">⚠️ Toxic to pets</div>
          )}
          
          <div className="front-info-panel">
            <div className="panel-header">
              <h3 className="panel-title">{plant.name}</h3>
              <button 
                className="panel-btn-inline"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onLog(plant, defaultTab); 
                }}
              >
                Log
              </button>
            </div>
            
            <div className="panel-rows">
              {plant.waterFreqDays && (
                <div className="panel-row">
                  <div className="panel-row-header">
                    <div className="panel-row-left">
                      <span>💧 Water</span>
                      <span className="panel-row-freq">{plant.waterFreqDays[0]}-{plant.waterFreqDays[1]}d</span>
                    </div>
                    <div className={`panel-row-status ${getStatusColorClass(waterUrgency!.status)}`}>
                      {getStatusText(waterUrgency!.daysUntil, waterUrgency!.status)}
                    </div>
                  </div>
                </div>
              )}

              <div className="panel-row">
                <div className="panel-row-header">
                  <div className="panel-row-left">
                    <span className="panel-fert-name" title={plant.fertRecommendation}>🧪 {plant.fertRecommendation}</span>
                    <span className="panel-row-freq">{plant.fertFreqDays[0]}-{plant.fertFreqDays[1]}d</span>
                  </div>
                  <div className={`panel-row-status ${getStatusColorClass(fertUrgency.status)}`}>
                    {getStatusText(fertUrgency.daysUntil, fertUrgency.status)}
                  </div>
                </div>
              </div>

              {plant.fertFreqDays2 && (
                <div className="panel-row">
                  <div className="panel-row-header">
                    <div className="panel-row-left">
                      <span className="panel-fert-name" title={plant.fertRecommendation2}>🧪 {plant.fertRecommendation2}</span>
                      <span className="panel-row-freq">{plant.fertFreqDays2[0]}-{plant.fertFreqDays2[1]}d</span>
                    </div>
                    <div className={`panel-row-status ${getStatusColorClass(fert2Urgency!.status)}`}>
                      {getStatusText(fert2Urgency!.daysUntil, fert2Urgency!.status)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BACK OF CARD */}
        <div className="flip-card-back" onClick={() => setFlipped(false)}>
          <div className="back-scroll-area">
            
            <div className="back-metadata-grid">
              {plant.lightRequirements && (
                <div className="meta-item full-width">
                  <span className="meta-label">☀️ Light</span>
                  <span className="meta-val">{plant.lightRequirements}</span>
                </div>
              )}
              
              {plant.bestTimeToPlantSeed && (
                <div className="meta-item">
                  <span className="meta-label">🌱 Seed</span>
                  <span className="meta-val">{plant.bestTimeToPlantSeed}</span>
                </div>
              )}
              {plant.bestTimeToTransplant && (
                <div className="meta-item">
                  <span className="meta-label">🪴 Transplant</span>
                  <span className="meta-val">{plant.bestTimeToTransplant}</span>
                </div>
              )}
              {plant.bloomingSeason && (
                <div className="meta-item">
                  <span className="meta-label">🌺 Blooms</span>
                  <span className="meta-val">{plant.bloomingSeason}</span>
                </div>
              )}
              {plant.fruitingSeason && (
                <div className="meta-item">
                  <span className="meta-label">🍅 Fruits</span>
                  <span className="meta-val">{plant.fruitingSeason}</span>
                </div>
              )}
              {plant.seedToFruitTime && (
                <div className="meta-item full-width">
                  <span className="meta-label">⏱️ Seed to Harvest</span>
                  <span className="meta-val">{plant.seedToFruitTime}</span>
                </div>
              )}

              <div className="meta-item full-width">
                <span className="meta-label">🧪 {plant.fertRecommendation}</span>
                <span className="meta-val">Every {plant.fertFreqDays[0]}-{plant.fertFreqDays[1]} days</span>
              </div>
              
              {plant.fertFreqDays2 && plant.fertRecommendation2 && (
                <div className="meta-item full-width">
                  <span className="meta-label">🧪 {plant.fertRecommendation2}</span>
                  <span className="meta-val">Every {plant.fertFreqDays2[0]}-{plant.fertFreqDays2[1]} days</span>
                </div>
              )}

              {plant.altFertilizers && plant.altFertilizers.length > 0 && (
                <div className="meta-item full-width">
                  <span className="meta-label">🧪 Also Good</span>
                  <span className="meta-val">{plant.altFertilizers.join(', ')}</span>
                </div>
              )}
            </div>

            <div className="back-notes-container">
              <span className="meta-label" style={{ marginBottom: '0.4rem', display: 'block' }}>📝 Care Notes</span>
              {plant.notes.length > 0 ? (
                <ul className="back-notes-clean">
                  {plant.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              ) : (
                <span className="meta-val" style={{ color: 'var(--text-muted)' }}>No special notes.</span>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
