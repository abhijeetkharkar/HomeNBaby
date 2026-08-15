import React, { useState } from 'react';
import type { PlantDef } from '../data/plants';
import type { CareLog } from '../hooks/useCareApi';
import { computeUrgency } from '../hooks/useCareApi';

interface Props {
  plant: PlantDef;
  lastWater: CareLog | null;
  lastFert: CareLog | null;
  onLog: (plant: PlantDef, type: 'water' | 'fertilize') => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function UrgencyPill({ daysUntil, status, label }: { daysUntil: number; status: string; label: string }) {
  const config: Record<string, { cls: string; text: string }> = {
    overdue: { cls: 'pill-overdue', text: `${Math.abs(daysUntil)}d overdue` },
    'due-today': { cls: 'pill-today', text: 'Due today' },
    'due-soon': { cls: 'pill-soon', text: `${daysUntil}d left` },
    ok: { cls: 'pill-ok', text: `${daysUntil}d left` },
    never: { cls: 'pill-never', text: 'No record' },
  };
  const c = config[status] || config.never;
  return (
    <span className={`urgency-pill ${c.cls}`} title={label}>
      {c.text}
    </span>
  );
}

export function PlantCard({ plant, lastWater, lastFert, onLog }: Props) {
  const [expanded, setExpanded] = useState(false);

  const waterUrgency = plant.waterFreqDays
    ? computeUrgency(lastWater?.timestamp || null, plant.waterFreqDays)
    : null;
  const fertUrgency = computeUrgency(lastFert?.timestamp || null, plant.fertFreqDays);

  const worstStatus = [waterUrgency?.status, fertUrgency.status]
    .filter(Boolean)
    .includes('overdue') ? 'overdue'
    : [waterUrgency?.status, fertUrgency.status].filter(Boolean).includes('never') ? 'never'
    : [waterUrgency?.status, fertUrgency.status].filter(Boolean).includes('due-today') ? 'due-today'
    : [waterUrgency?.status, fertUrgency.status].filter(Boolean).includes('due-soon') ? 'due-soon'
    : 'ok';

  return (
    <div className={`plant-card card-${worstStatus}`}>
      {plant.warning && <div className="plant-warning">⚠️ {plant.warning}</div>}

      <div className="plant-card-header" onClick={() => setExpanded(e => !e)}>
        <span className="plant-emoji">{plant.emoji}</span>
        <div className="plant-name-block">
          <span className="plant-name">{plant.name}</span>
          <div className="plant-pills">
            {waterUrgency && (
              <UrgencyPill daysUntil={waterUrgency.daysUntil} status={waterUrgency.status} label="Watering" />
            )}
            <UrgencyPill daysUntil={fertUrgency.daysUntil} status={fertUrgency.status} label="Fertilizing" />
          </div>
        </div>
        <span className={`chevron ${expanded ? 'open' : ''}`}>›</span>
      </div>

      <div className={`plant-card-body ${expanded ? 'expanded' : ''}`}>
        <div className="care-row-grid">
          {plant.waterFreqDays && (
            <div className="care-stat">
              <span className="care-icon">💧</span>
              <div>
                <div className="care-label">Last Watered</div>
                <div className="care-value">{formatDate(lastWater?.timestamp || null)}</div>
                <div className="care-freq">Every {plant.waterFreqDays[0]}–{plant.waterFreqDays[1]}d</div>
              </div>
              <button className="log-btn water-btn" onClick={() => onLog(plant, 'water')}>Log 💧</button>
            </div>
          )}
          <div className="care-stat">
            <span className="care-icon">🌿</span>
            <div>
              <div className="care-label">Last Fertilized</div>
              <div className="care-value">{formatDate(lastFert?.timestamp || null)}</div>
              <div className="care-freq">Every {plant.fertFreqDays[0]}–{plant.fertFreqDays[1]}d</div>
            </div>
            <button className="log-btn fert-btn" onClick={() => onLog(plant, 'fertilize')}>Log 🌿</button>
          </div>
        </div>

        <div className="fert-rec">
          <span className="fert-label">Fertilizer:</span> {plant.fertRecommendation}
        </div>

        {plant.notes.length > 0 && (
          <ul className="plant-notes">
            {plant.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
