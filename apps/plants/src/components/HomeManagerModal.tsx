import React, { useState } from 'react';
import type { HomeProfile } from '../hooks/useHomeProfile';

interface Props {
  userEmail: string;
  homes: HomeProfile[];
  activeHome: HomeProfile | null;
  onSelectHome: (homeId: string) => void;
  onCreateHome: (name: string) => Promise<HomeProfile>;
  onInviteMember: (
    homeId: string,
    inviteEmail: string,
  ) => Promise<{ success: boolean; userInSystem: boolean; members: string[] }>;
  onDeleteHome: (homeId: string) => Promise<void>;
  onClose: () => void;
}

const MAX_HOMES_PER_USER = 3;
const MAX_MEMBERS_PER_HOME = 4;

export function HomeManagerModal({
  userEmail,
  homes,
  activeHome,
  onSelectHome,
  onCreateHome,
  onInviteMember,
  onDeleteHome,
  onClose,
}: Props) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [newHomeName, setNewHomeName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(homes.length === 0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canCreateMoreHomes = homes.length < MAX_HOMES_PER_USER;
  const isOwner = activeHome ? activeHome.createdBy === userEmail : false;
  const memberCount = activeHome?.members?.length || 0;
  const canInviteMore = memberCount < MAX_MEMBERS_PER_HOME;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHomeName.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const created = await onCreateHome(newHomeName.trim());
      setNewHomeName('');
      setShowCreateForm(false);
      setMessage(`Created "${created.name}"!`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create home');
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHome || !inviteEmail.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await onInviteMember(activeHome.homeId, inviteEmail.trim());
      setInviteEmail('');
      setMessage(
        res.userInSystem
          ? 'Added to your home & notified by email!'
          : 'Invitation email sent! They will see this home as soon as they sign up.',
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to invite member');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (homeId: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await onDeleteHome(homeId);
      setConfirmDeleteId(null);
      setMessage('Home deleted.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete home');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card home-modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-emoji">🏡</span>
          <div>
            <div className="modal-title">Home &amp; Family Settings</div>
            <div className="modal-subtitle">
              {homes.length} of {MAX_HOMES_PER_USER} homes • Signed in as {userEmail}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="auth-alert auth-alert-error" role="alert">
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="auth-alert auth-alert-success" role="status">
              <span>{message}</span>
            </div>
          )}

          {/* Switch Active Home */}
          {homes.length > 0 && (
            <div className="field-group">
              <label className="field-label">
                Your Homes ({homes.length}/{MAX_HOMES_PER_USER})
              </label>
              <div className="home-switcher-list">
                {homes.map(h => {
                  const active = activeHome?.homeId === h.homeId;
                  return (
                    <button
                      key={h.homeId}
                      type="button"
                      className={`home-pill-btn ${active ? 'active' : ''}`}
                      onClick={() => onSelectHome(h.homeId)}
                    >
                      <span>🏡 {h.name}</span>
                      <span className="home-pill-meta">
                        {h.createdBy === userEmail ? 'Owner' : 'Member'} • {h.members.length}/{MAX_MEMBERS_PER_HOME}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Home Members & Invite */}
          {activeHome && (
            <div className="home-section-box">
              <div className="home-section-header">
                <h4>👥 Members of &ldquo;{activeHome.name}&rdquo;</h4>
                <span className="home-count-badge">
                  {memberCount} / {MAX_MEMBERS_PER_HOME} members
                </span>
              </div>

              <ul className="home-member-list">
                {activeHome.members.map(m => (
                  <li key={m} className="home-member-item">
                    <span>{m}</span>
                    <span className="home-role-tag">
                      {m === activeHome.createdBy ? '👑 Creator' : '🌿 Family'}
                    </span>
                  </li>
                ))}
              </ul>

              {canInviteMore ? (
                <form onSubmit={handleInvite} className="home-inline-form">
                  <input
                    type="email"
                    className="auth-input"
                    placeholder="Family member's email address..."
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={busy || !inviteEmail.trim()}
                  >
                    {busy ? 'Sending...' : '✉️ Invite'}
                  </button>
                </form>
              ) : (
                <p className="home-limit-note">
                  This home has reached the maximum of {MAX_MEMBERS_PER_HOME} members.
                </p>
              )}

              {/* Owner-only Delete Home */}
              {isOwner && (
                <div className="home-danger-zone">
                  {confirmDeleteId === activeHome.homeId ? (
                    <div className="home-delete-confirm">
                      <span>
                        Delete <strong>{activeHome.name}</strong> for all {memberCount} member(s)?
                      </span>
                      <div className="home-delete-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={busy}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => handleDelete(activeHome.homeId)}
                          disabled={busy}
                        >
                          {busy ? 'Deleting...' : 'Confirm Delete'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="home-delete-trigger"
                      onClick={() => setConfirmDeleteId(activeHome.homeId)}
                    >
                      🗑️ Delete &ldquo;{activeHome.name}&rdquo;
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Create Another Home (up to 3) */}
          <div className="home-create-section">
            {canCreateMoreHomes ? (
              showCreateForm ? (
                <form onSubmit={handleCreate} className="home-inline-form">
                  <input
                    type="text"
                    className="auth-input"
                    placeholder="e.g. Kharkar Home, Parents' Garden..."
                    value={newHomeName}
                    onChange={e => setNewHomeName(e.target.value)}
                    maxLength={60}
                    required
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={busy || !newHomeName.trim()}
                  >
                    {busy ? 'Creating...' : '✓ Create'}
                  </button>
                  {homes.length > 0 && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowCreateForm(false)}
                    >
                      Cancel
                    </button>
                  )}
                </form>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ width: '100%' }}
                  onClick={() => setShowCreateForm(true)}
                >
                  ➕ Add Another Home ({homes.length}/{MAX_HOMES_PER_USER})
                </button>
              )
            ) : (
              <p className="home-limit-note">
                You belong to the maximum of {MAX_HOMES_PER_USER} homes.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
