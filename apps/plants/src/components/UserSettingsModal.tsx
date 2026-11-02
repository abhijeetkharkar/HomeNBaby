import React, { useState } from 'react';
import type { UserAccountProfile } from '../hooks/useHomeProfile';

interface Props {
  userEmail: string;
  userProfile: UserAccountProfile;
  onSaveProfile: (next: Omit<UserAccountProfile, 'updatedAt'>) => Promise<UserAccountProfile>;
  onClose: () => void;
}

export function UserSettingsModal({
  userEmail,
  userProfile,
  onSaveProfile,
  onClose,
}: Props) {
  const [firstName, setFirstName] = useState(userProfile.firstName || '');
  const [lastName, setLastName] = useState(userProfile.lastName || '');
  const [phoneNumber, setPhoneNumber] = useState(userProfile.phoneNumber || '');
  const [careReminders, setCareReminders] = useState(
    userProfile.notifications?.careReminders ?? true,
  );
  const [emailNotif, setEmailNotif] = useState(
    userProfile.notifications?.email ?? true,
  );
  const [smsNotif, setSmsNotif] = useState(
    userProfile.notifications?.sms ?? false,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const initialLetter = (
    firstName.trim()[0] ||
    userEmail.trim()[0] ||
    'U'
  ).toUpperCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await onSaveProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim(),
        notifications: {
          careReminders,
          email: emailNotif,
          sms: smsNotif,
        },
      });
      setMessage('Account settings saved!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card home-modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="user-avatar-circle user-avatar-lg">{initialLetter}</div>
          <div>
            <div className="modal-title">Account Settings</div>
            <div className="modal-subtitle">{userEmail}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
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

          <div className="user-settings-grid">
            <div className="auth-field">
              <label className="auth-label" htmlFor="acct-first-name">
                First Name
              </label>
              <input
                id="acct-first-name"
                type="text"
                className="auth-input"
                placeholder="e.g. Abhijeet"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                maxLength={60}
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="acct-last-name">
                Last Name
              </label>
              <input
                id="acct-last-name"
                type="text"
                className="auth-input"
                placeholder="e.g. Kharkar"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                maxLength={60}
              />
            </div>
          </div>

          <div className="auth-field" style={{ marginTop: '0.85rem' }}>
            <label className="auth-label" htmlFor="acct-phone">
              Phone Number
            </label>
            <input
              id="acct-phone"
              type="tel"
              className="auth-input"
              placeholder="e.g. +1 (555) 123-4567"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              maxLength={30}
            />
          </div>

          <div className="user-settings-section">
            <div className="user-settings-section-title">🔔 Notifications</div>

            <label className="user-toggle-row">
              <div>
                <div className="user-toggle-label">Plant Care Reminders</div>
                <div className="user-toggle-sub">
                  Receive alerts when watering or fertilizing is due
                </div>
              </div>
              <input
                type="checkbox"
                className="user-toggle-checkbox"
                checked={careReminders}
                onChange={e => setCareReminders(e.target.checked)}
              />
            </label>

            <label className="user-toggle-row">
              <div>
                <div className="user-toggle-label">Email Notifications</div>
                <div className="user-toggle-sub">
                  Send care digests and home invitations to {userEmail}
                </div>
              </div>
              <input
                type="checkbox"
                className="user-toggle-checkbox"
                checked={emailNotif}
                onChange={e => setEmailNotif(e.target.checked)}
              />
            </label>

            <label className="user-toggle-row">
              <div>
                <div className="user-toggle-label">SMS Notifications</div>
                <div className="user-toggle-sub">
                  Send text alerts to your phone number when plants are overdue
                </div>
              </div>
              <input
                type="checkbox"
                className="user-toggle-checkbox"
                checked={smsNotif}
                onChange={e => setSmsNotif(e.target.checked)}
              />
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
