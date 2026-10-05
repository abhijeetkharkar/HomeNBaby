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
  isSelfWatering?: boolean;
  onTogglePotType?: (plantId: string, type: 'self-watering' | 'standard') => void;
  isWaterTrackingActive?: boolean;
  onToggleWaterTracking?: (plantId: string, track: boolean) => void;
  effectiveGroup?: 'indoor' | 'outdoor-potted' | 'outdoor-garden';
  onToggleGroup?: (plantId: string, group: 'indoor' | 'outdoor-potted') => void;
  onDelete?: (plant: PlantDef) => void;
  onRestore?: (plant: PlantDef) => void;
  onPermanentDelete?: (plant: PlantDef) => void;
  isDeleted?: boolean;
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

export function PlantCard({
  plant,
  lastWater,
  lastFert,
  lastFert2,
  onLog,
  isSelfWatering = false,
  onTogglePotType,
  isWaterTrackingActive = false,
  onToggleWaterTracking,
  effectiveGroup,
  onToggleGroup,
  onDelete,
  onRestore,
  onPermanentDelete,
  isDeleted = false,
}: Props) {
  const [flipped, setFlipped] = useState(false);

  const currentGroup = effectiveGroup || plant.group;

  const effectiveWaterTracking =
    currentGroup === 'indoor'
      ? true
      : currentGroup === 'outdoor-garden'
      ? false
      : Boolean(isWaterTrackingActive);

  const canSelfWater =
    currentGroup !== 'outdoor-garden' &&
    (plant.selfWatering === 'ideal' || plant.selfWatering === 'caution');
  const isSelfWateringActive = canSelfWater && Boolean(isSelfWatering);

  const effectiveWaterFreq =
    isSelfWateringActive && plant.selfWaterFreqDays
      ? plant.selfWaterFreqDays
      : plant.waterFreqDays;

  const waterUrgency = effectiveWaterTracking && effectiveWaterFreq
    ? computeUrgency(lastWater?.timestamp || null, effectiveWaterFreq)
    : null;
  const fertUrgency = computeUrgency(lastFert?.timestamp || null, plant.fertFreqDays);
  
  const fert2Urgency = plant.fertFreqDays2 
    ? computeUrgency(lastFert2?.timestamp || null, plant.fertFreqDays2) 
    : null;

  let defaultTab: 'water' | 'fertilize' | 'fertilize-2' = effectiveWaterTracking ? 'water' : 'fertilize';
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
          
          {(plant.warning || (currentGroup !== 'outdoor-garden' && plant.selfWatering === 'never') || isSelfWateringActive) && (
            <div className="front-badges-container">
              {plant.warning && (
                <div className="front-warning-top">⚠️ {plant.warning.replace(/^⚠️\s*/, '')}</div>
              )}
              {currentGroup !== 'outdoor-garden' && plant.selfWatering === 'never' && (
                <div className="front-warning-top front-no-self-water-top">⚠️ No Self-Watering</div>
              )}
              {isSelfWateringActive && (
                <div className="front-self-water-active">💧 Self-Watering Pot Active</div>
              )}
            </div>
          )}
          
          <div className="front-info-panel">
            <div className="panel-header">
              <div className="panel-title-group">
                <h3 className="panel-title">{plant.name}</h3>
                {plant.scientificName && (
                  <span className="panel-scientific-name">{plant.scientificName}</span>
                )}
              </div>
              {isDeleted ? (
                <span className="panel-badge-deleted">🗑️ Deleted</span>
              ) : (
                <button 
                  className="panel-btn-inline"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onLog(plant, defaultTab); 
                  }}
                >
                  Log
                </button>
              )}
            </div>
            
            <div className="panel-rows">
              {effectiveWaterTracking && effectiveWaterFreq && (
                <div className="panel-row">
                  <div className="panel-row-header">
                    <div className="panel-row-left">
                      <span>{isSelfWateringActive ? '💧 Refill Reservoir' : '💧 Water'}</span>
                      <span className="panel-row-freq">{effectiveWaterFreq[0]}-{effectiveWaterFreq[1]}d</span>
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
          {/* Top-Right Action Icons on Backside */}
          <div className="back-top-actions" onClick={e => e.stopPropagation()}>
            {isDeleted ? (
              <>
                <button
                  type="button"
                  className="back-icon-btn btn-restore-icon"
                  title="Restore Plant"
                  onClick={() => onRestore?.(plant)}
                >
                  ♻️
                </button>
                <button
                  type="button"
                  className="back-icon-btn btn-perm-delete-icon"
                  title="Delete Permanently"
                  onClick={() => onPermanentDelete?.(plant)}
                >
                  ❌
                </button>
              </>
            ) : (
              onDelete && (
                <button
                  type="button"
                  className="back-icon-btn btn-delete-icon"
                  title="Delete Plant"
                  onClick={() => onDelete(plant)}
                >
                  🗑️
                </button>
              )
            )}
          </div>

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

              {plant.group !== 'outdoor-garden' && onToggleGroup && (
                <div className="meta-item full-width">
                  <span className="meta-label">📍 Environment & Location</span>
                  <div className="meta-val-block">
                    <div className="pot-type-selector" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`pot-selector-btn ${currentGroup === 'indoor' ? 'active' : ''}`}
                        onClick={() => onToggleGroup(plant.id, 'indoor')}
                      >
                        🏠 Indoor
                      </button>
                      <button
                        type="button"
                        className={`pot-selector-btn ${currentGroup === 'outdoor-potted' ? 'active' : ''}`}
                        onClick={() => onToggleGroup(plant.id, 'outdoor-potted')}
                      >
                        🪴 Outdoor Potted
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {currentGroup !== 'outdoor-garden' && plant.selfWatering && (
                <div className="meta-item full-width">
                  <span className="meta-label">🪴 Pot Type & Selection</span>
                  <div className="meta-val-block">
                    <span className={`meta-pill meta-pill-${plant.selfWatering}`}>
                      {plant.selfWatering === 'never' && '⛔ Standard Pot Only (No Self-Water)'}
                      {plant.selfWatering === 'caution' && '⚠️ Caution with Self-Watering'}
                      {plant.selfWatering === 'ideal' && '✅ Great for Self-Watering'}
                    </span>
                    {plant.selfWateringNote && (
                      <span className="meta-subtext">{plant.selfWateringNote}</span>
                    )}
                    {canSelfWater && onTogglePotType && (
                      <div className="pot-type-selector" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          className={`pot-selector-btn ${!isSelfWateringActive ? 'active' : ''}`}
                          onClick={() => onTogglePotType(plant.id, 'standard')}
                        >
                          🪴 Standard Pot
                        </button>
                        <button
                          type="button"
                          className={`pot-selector-btn ${isSelfWateringActive ? 'active' : ''}`}
                          onClick={() => onTogglePotType(plant.id, 'self-watering')}
                        >
                          💧 Self-Watering Pot
                        </button>
                      </div>
                    )}
                    {isSelfWateringActive && plant.selfWaterFreqDays && (
                      <span className="meta-subtext self-water-freq-note">
                        💧 Reservoir refill interval: every {plant.selfWaterFreqDays[0]}-{plant.selfWaterFreqDays[1]} days.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {currentGroup === 'outdoor-potted' && (
                <div className="meta-item full-width">
                  <span className="meta-label">💧 Outdoor Water Tracking</span>
                  <div className="meta-val-block">
                    <span className="meta-subtext">
                      {effectiveWaterTracking
                        ? `Tracking schedule: water every ${plant.waterFreqDays ? `${plant.waterFreqDays[0]}-${plant.waterFreqDays[1]}` : ''} days.`
                        : 'Water tracking is off (weather/rain-fed).'}
                    </span>
                    {onToggleWaterTracking && (
                      <div className="pot-type-selector" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          className={`pot-selector-btn ${!effectiveWaterTracking ? 'active' : ''}`}
                          onClick={() => onToggleWaterTracking(plant.id, false)}
                        >
                          ⏸️ Off (Untracked)
                        </button>
                        <button
                          type="button"
                          className={`pot-selector-btn ${effectiveWaterTracking ? 'active' : ''}`}
                          onClick={() => onToggleWaterTracking(plant.id, true)}
                        >
                          💧 On (Track Schedule)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {plant.soilType && (
                <div className="meta-item full-width">
                  <span className="meta-label">🌱 Soil Mix</span>
                  <span className="meta-val">{plant.soilType}</span>
                </div>
              )}

              {currentGroup !== 'outdoor-garden' && plant.pebbleRule && (
                <div className="meta-item full-width">
                  <span className="meta-label">🪨 Pebbles / Top Dressing</span>
                  <span className="meta-val">{plant.pebbleRule}</span>
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
