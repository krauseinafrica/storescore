import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { updateProfile, uploadAvatar, removeAvatar, changePassword } from '../api/members';
import { getCalendarToken, regenerateCalendarToken } from '../api/walks';
import { getOrgId } from '../utils/org';

export default function Account() {
  const { user } = useAuth();

  // Profile form state
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Password form
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

  // Calendar feed
  const orgId = getOrgId();
  const [calendarToken, setCalendarToken] = useState('');
  const [calendarCopied, setCalendarCopied] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    getCalendarToken(orgId).then(data => setCalendarToken(data.token)).catch(() => {});
  }, [orgId]);

  const calendarUrl = calendarToken
    ? `${window.location.origin}/api/walks/calendar-feed/${calendarToken}/`
    : '';

  const handleCopyCalendar = () => {
    navigator.clipboard.writeText(calendarUrl);
    setCalendarCopied(true);
    setTimeout(() => setCalendarCopied(false), 2000);
  };

  const handleRegenerateToken = async () => {
    if (!orgId) return;
    if (!confirm('Regenerate calendar token? Existing calendar subscriptions will stop working.')) return;
    try {
      const data = await regenerateCalendarToken(orgId);
      setCalendarToken(data.token);
    } catch { /* ignore */ }
  };

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileError('');
    setProfileSaving(true);
    try {
      const updated = await updateProfile({ first_name: firstName, last_name: lastName, email });
      setFirstName(updated.first_name);
      setLastName(updated.last_name);
      setEmail(updated.email);
      // Update localStorage so sidebar reflects changes
      const raw = localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw);
        localStorage.setItem('user', JSON.stringify({ ...parsed, first_name: updated.first_name, last_name: updated.last_name, email: updated.email }));
      }
      setProfileMsg('Profile updated successfully.');
    } catch (err: any) {
      const data = err.response?.data;
      const msg = typeof data === 'object' ? Object.values(data).flat().join(' ') : 'Failed to update profile.';
      setProfileError(msg);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const updated = await uploadAvatar(file);
      setAvatarUrl(updated.avatar_url || null);
      // Update localStorage
      const raw = localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw);
        localStorage.setItem('user', JSON.stringify({ ...parsed, avatar_url: updated.avatar_url }));
      }
    } catch {
      setProfileError('Failed to upload photo.');
    } finally {
      setAvatarUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarUploading(true);
    try {
      await removeAvatar();
      setAvatarUrl(null);
      const raw = localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw);
        localStorage.setItem('user', JSON.stringify({ ...parsed, avatar_url: null }));
      }
    } catch {
      setProfileError('Failed to remove photo.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setPwMsg('');
    setPwError('');

    if (newPw !== confirmPw) {
      setPwError('New passwords do not match.');
      return;
    }
    if (newPw.length < 8) {
      setPwError('Password must be at least 8 characters.');
      return;
    }

    setPwSaving(true);
    try {
      await changePassword(currentPw, newPw);
      setPwMsg('Password changed successfully.');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err: any) {
      const data = err.response?.data;
      const msg = data?.current_password?.[0] || data?.new_password?.[0] || data?.detail || 'Failed to change password.';
      setPwError(msg);
    } finally {
      setPwSaving(false);
    }
  };

  const initials = `${user?.first_name?.charAt(0) || ''}${user?.last_name?.charAt(0) || ''}`.toUpperCase() || 'U';

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Account Settings</h1>

      {/* Avatar Section */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Profile Photo</h2>
        <div className="flex items-center gap-5">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover ring-2 ring-gray-100"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary-600 text-white flex items-center justify-center text-2xl font-semibold">
                {initials}
              </div>
            )}
            {avatarUploading && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={avatarUploading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {avatarUrl ? 'Change photo' : 'Upload photo'}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={handleAvatarRemove}
                disabled={avatarUploading}
                className="text-sm text-red-600 hover:text-red-700 text-left disabled:opacity-50"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Profile Info Section */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Profile Information</h2>

        {profileMsg && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            {profileMsg}
          </div>
        )}
        {profileError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {profileError}
          </div>
        )}

        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                First name
              </label>
              <input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-colors sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                Last name
              </label>
              <input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-colors sm:text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-colors sm:text-sm"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={profileSaving}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {profileSaving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Calendar Feed Section */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Calendar Feed</h2>
        <p className="text-xs text-gray-500 mb-4">Subscribe to your scheduled walks in Google Calendar, Outlook, or Apple Calendar.</p>
        {calendarToken ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={calendarUrl}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-600 bg-gray-50"
                onClick={e => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={handleCopyCalendar}
                className="flex-shrink-0 rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
              >
                {calendarCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button
              onClick={handleRegenerateToken}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Regenerate token
            </button>
          </div>
        ) : (
          <button
            onClick={handleRegenerateToken}
            className="rounded-lg bg-primary-50 px-3 py-2 text-xs font-medium text-primary-700 hover:bg-primary-100"
          >
            Generate Calendar Link
          </button>
        )}
      </div>

      {/* Change Password Section */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Change Password</h2>

        {pwMsg && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            {pwMsg}
          </div>
        )}
        {pwError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {pwError}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label htmlFor="currentPw" className="block text-sm font-medium text-gray-700 mb-1">
              Current password
            </label>
            <input
              id="currentPw"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              required
              className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-colors sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="newPw" className="block text-sm font-medium text-gray-700 mb-1">
              New password
            </label>
            <input
              id="newPw"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              minLength={8}
              className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-colors sm:text-sm"
              placeholder="Minimum 8 characters"
            />
          </div>
          <div>
            <label htmlFor="confirmPw" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm new password
            </label>
            <input
              id="confirmPw"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              required
              className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-colors sm:text-sm"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pwSaving}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {pwSaving ? 'Changing...' : 'Change password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
