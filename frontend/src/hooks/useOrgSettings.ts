import { useState, useEffect } from 'react';
import { getOrgSettings, type OrgSettingsData } from '../api/walks';
import { getOrgId } from '../utils/org';

/**
 * Lightweight hook to fetch and cache org settings.
 * Used by Sidebar and Dashboard to check gamification visibility.
 */
export function useOrgSettings() {
  const [settings, setSettings] = useState<OrgSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const orgId = getOrgId();

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getOrgSettings(orgId)
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [orgId]);

  return { settings, loading };
}

/**
 * Check if the user's role is allowed to see gamification features.
 */
export function isGamificationVisibleForRole(
  settings: OrgSettingsData | null,
  role: string | undefined
): boolean {
  if (!settings) return true;
  if (!settings.gamification_enabled) return false;
  const visibleRoles = settings.gamification_visible_roles;
  if (!visibleRoles || visibleRoles.length === 0) return true;
  if (!role) return false;
  return visibleRoles.includes(role);
}
