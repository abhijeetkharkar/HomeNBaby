import React, { useState } from 'react';
import type { PlantDef } from '../data/plants';


interface Props {
  plant: PlantDef;
  defaultType: 'water' | 'fertilize' | 'fertilize-2';
  onConfirm: (plantId: string, type: 'water' | 'fertilize' | 'fertilize-2', fertilizer?: string, notes?: string) => void;
  onClose: () => void;
}

export function LogCareModal({ plant, defaultType, onConfirm, onClose }: Props) {
  const [type, setType] = useState<'water' | 'fertilize' | 'fertilize-2'>(defaultType);
  const [selectedFert, setSelectedFert] = useState<string>(plant.fertRecommendation);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fertOptions = [plant.fertRecommendation, ...(plant.altFertilizers || [])];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    let fertStr = undefined;
    if (type === 'fertilize') fertStr = selectedFert;
    if (type === 'fertilize-2') fertStr = plant.fertRecommendation2;
    await onConfirm(plant.id, type, fertStr, notes || undefined);
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
              {plant.waterFreqDays && (
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
