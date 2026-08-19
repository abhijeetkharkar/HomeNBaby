import { useState } from 'react';
import type { PlantDef } from '../data/plants';
import type { CareLog } from '../hooks/useCareApi';
import { computeUrgency } from '../hooks/useCareApi';

interface Props {
  plant: PlantDef;
  lastWater: CareLog | null;
  lastFert: CareLog | null;
  onLog: (plant: PlantDef, type: 'water' | 'fertilize') => void;
}

function getShortFertName(rec: string): string {
  const lower = rec.toLowerCase();
  if (lower.includes('agrothrive')) return 'AgroThrive';
  if (lower.includes('schultz')) return 'Schultz';
  if (lower.includes('espoma')) return 'Espoma';
  if (lower.includes('bone meal')) return 'Bone Meal';
  if (lower.includes('blood meal')) return 'Blood Meal';
  if (lower.includes('epsom salt')) return 'Epsom Salt';
  return 'Fertilizer';
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

export function PlantCard({ plant, lastWater, lastFert, onLog }: Props) {
  const [flipped, setFlipped] = useState(false);

  const waterUrgency = plant.waterFreqDays
    ? computeUrgency(lastWater?.timestamp || null, plant.waterFreqDays)
    : null;
  const fertUrgency = computeUrgency(lastFert?.timestamp || null, plant.fertFreqDays);
  
  const shortFertName = getShortFertName(plant.fertRecommendation);

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
                  const defaultTab = waterUrgency?.status.includes('overdue') || waterUrgency?.status.includes('today') ? 'water' : 'fertilize';
                  onLog(plant, defaultTab); 
                }}
              >
                Log
              </button>
            </div>
            
            <div className="panel-grid">
              {plant.waterFreqDays ? (
                <div className="panel-col">
                  <div className="panel-label">
                    <span>💧 Water</span>
                    <span className="panel-freq">{plant.waterFreqDays[0]}-{plant.waterFreqDays[1]}d</span>
                  </div>
                  <div className={`panel-status ${getStatusColorClass(waterUrgency!.status)}`}>
                    {getStatusText(waterUrgency!.daysUntil, waterUrgency!.status)}
                  </div>
                </div>
              ) : (
                <div className="panel-col" style={{ justifyContent: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>No water tracking</span>
                </div>
              )}

              <div className="panel-col">
                <div className="panel-label">
                  <span>🌿 {shortFertName}</span>
                  <span className="panel-freq">{plant.fertFreqDays[0]}-{plant.fertFreqDays[1]}d</span>
                </div>
                <div className={`panel-status ${getStatusColorClass(fertUrgency.status)}`}>
                  {getStatusText(fertUrgency.daysUntil, fertUrgency.status)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BACK OF CARD */}
        <div className="flip-card-back" onClick={() => setFlipped(false)}>
          <div className="back-scroll-area">
            <div className="fert-rec">
              <span className="fert-label">Mix:</span> {plant.fertRecommendation}
            </div>

            {plant.notes.length > 0 ? (
              <ul className="plant-notes back-notes">
                {plant.notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No special notes for this plant.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
