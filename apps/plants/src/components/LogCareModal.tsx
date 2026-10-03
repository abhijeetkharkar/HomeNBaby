import React, { useState } from 'react';
import type { PlantDef } from '../data/plants';


interface Props {
  plant: PlantDef;
  defaultType: 'water' | 'fertilize' | 'fertilize-2';
  isWaterTrackingActive?: boolean;
  onConfirm: (
    plantId: string,
    type: 'water' | 'fertilize' | 'fertilize-2',
    fertilizer?: string,
    notes?: string,
    timestamp?: string,
  ) => void;
  onClose: () => void;
}

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function LogCareModal({ plant, defaultType, isWaterTrackingActive = true, onConfirm, onClose }: Props) {
  const canWater = Boolean(plant.waterFreqDays && isWaterTrackingActive);
  const initialType = (!canWater && defaultType === 'water') ? 'fertilize' : defaultType;
  const [type, setType] = useState<'water' | 'fertilize' | 'fertilize-2'>(initialType);
  const [selectedFert, setSelectedFert] = useState<string>(plant.fertRecommendation);
  const [careDate, setCareDate] = useState<string>(() => toLocalDatetimeString(new Date()));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fertOptions = [plant.fertRecommendation, ...(plant.altFertilizers || [])];

  const setDatePreset = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setCareDate(toLocalDatetimeString(d));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    let fertStr = undefined;
    if (type === 'fertilize') fertStr = selectedFert;
    if (type === 'fertilize-2') fertStr = plant.fertRecommendation2;
    const isoTimestamp = careDate ? new Date(careDate).toISOString() : new Date().toISOString();
    await onConfirm(plant.id, type, fertStr, notes || undefined, isoTimestamp);
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          {plant.imageUrl ? (
            <img src={plant.imageUrl} alt={plant.name} className="modal-image" loading="lazy" />
          ) : (
            <span className="modal-emoji">{plant.emoji}</span>
          )}
          <div>
            <div className="modal-title">Log Care</div>
            <div className="modal-subtitle">{plant.name}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="field-group">
            <label className="field-label">Type</label>
            <div className="type-toggle">
              {canWater && (
                <button
                  type="button"
                  className={`toggle-btn ${type === 'water' ? 'active' : ''}`}
                  onClick={() => setType('water')}
                >
                  💧 Watered
                </button>
              )}
              <button
                type="button"
                className={`toggle-btn ${type === 'fertilize' ? 'active' : ''}`}
                onClick={() => setType('fertilize')}
                title={plant.fertRecommendation}
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                🌿 {plant.fertRecommendation}
              </button>
              {plant.fertFreqDays2 && plant.fertRecommendation2 && (
                <button
                  type="button"
                  className={`toggle-btn ${type === 'fertilize-2' ? 'active' : ''}`}
                  onClick={() => setType('fertilize-2')}
                  title={plant.fertRecommendation2}
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  🌿 {plant.fertRecommendation2}
                </button>
              )}
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Date & Time (Retro-logging)</label>
            <div className="date-preset-buttons">
              <button
                type="button"
                className="date-preset-btn"
                onClick={() => setDatePreset(0)}
              >
                Today
              </button>
              <button
                type="button"
                className="date-preset-btn"
                onClick={() => setDatePreset(1)}
              >
                Yesterday
              </button>
              <button
                type="button"
                className="date-preset-btn"
                onClick={() => setDatePreset(2)}
              >
                2 Days Ago
              </button>
            </div>
            <input
              type="datetime-local"
              className="field-datetime"
              value={careDate}
              onChange={e => setCareDate(e.target.value)}
              required
            />
          </div>

          {type === 'fertilize' && fertOptions.length > 1 && (
            <div className="field-group">
              <label className="field-label">Fertilizer</label>
              <select
                className="field-select"
                value={selectedFert}
                onChange={e => setSelectedFert(e.target.value)}
              >
                {fertOptions.map(opt => (
                  <option key={opt} value={opt}>
                    🧪 {opt}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="field-group">
            <label className="field-label">Notes (optional)</label>
            <textarea
              className="field-textarea"
              rows={2}
              placeholder="Any observations..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : '✓ Log it'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
