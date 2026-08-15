import React, { useState } from 'react';
import type { PlantDef } from '../data/plants';
import { FERTILIZERS } from '../data/fertilizers';

interface Props {
  plant: PlantDef;
  defaultType: 'water' | 'fertilize';
  onConfirm: (plantId: string, type: 'water' | 'fertilize', fertilizer?: string, notes?: string) => void;
  onClose: () => void;
}

export function LogCareModal({ plant, defaultType, onConfirm, onClose }: Props) {
  const [type, setType] = useState<'water' | 'fertilize'>(defaultType);
  const [fertilizer, setFertilizer] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onConfirm(plant.id, type, type === 'fertilize' ? fertilizer || undefined : undefined, notes || undefined);
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-emoji">{plant.emoji}</span>
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
              >
                🌿 Fertilized
              </button>
            </div>
          </div>

          {type === 'fertilize' && (
            <div className="field-group">
              <label className="field-label">Fertilizer Used</label>
              <div className="fert-rec-hint">💡 Recommended: {plant.fertRecommendation}</div>
              <select
                className="field-select"
                value={fertilizer}
                onChange={e => setFertilizer(e.target.value)}
              >
                <option value="">— Select fertilizer —</option>
                {FERTILIZERS.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} {f.warning ? '⚠️' : ''}
                  </option>
                ))}
              </select>
              {fertilizer === 'bio-fertilizer' && (
                <div className="field-warning">
                  ⚠️ This fertilizer is ~9 years old and may have degraded. Verify before use.
                </div>
              )}
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
