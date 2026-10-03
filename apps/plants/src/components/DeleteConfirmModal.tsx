import { useEffect } from 'react';
import type { PlantDef } from '../data/plants';

interface Props {
  plant: PlantDef;
  mode: 'soft' | 'permanent';
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteConfirmModal({ plant, mode, onConfirm, onClose }: Props) {
  // Listen for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isPermanent = mode === 'permanent';

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
            <div className="modal-title">
              {isPermanent ? 'Permanent Delete' : 'Move to Deleted'}
            </div>
            <div className="modal-subtitle">{plant.name}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>

        <div className="modal-body confirm-dialog-body">
          {isPermanent ? (
            <>
              <p className="confirm-text">
                Are you sure you want to <strong>permanently delete</strong> {plant.name}?
              </p>
              <div className="confirm-dialog-warning">
                ⚠️ <strong>This action cannot be undone.</strong> This plant will be completely removed from your inventory and care history.
              </div>
            </>
          ) : (
            <>
              <p className="confirm-text">
                Are you sure you want to move <strong>{plant.name}</strong> to your deleted plants?
              </p>
              <div className="confirm-dialog-tip">
                💡 <strong>Don't worry:</strong> You can restore it at any time by selecting the <strong>🗑️ Deleted</strong> option in the Status filter at the top.
              </div>
            </>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={isPermanent ? 'btn-danger' : 'btn-warning-delete'}
              onClick={onConfirm}
              autoFocus
            >
              {isPermanent ? '❌ Delete Forever' : '🗑️ Move to Deleted'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
