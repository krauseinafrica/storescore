export function getOrgId(): string {
  const stored = localStorage.getItem('selectedOrgId');
  if (stored) return stored;
  const userRaw = localStorage.getItem('user');
  if (userRaw) {
    try {
      const parsed = JSON.parse(userRaw);
      if (parsed.memberships?.[0]?.organization?.id) {
        const orgId = parsed.memberships[0].organization.id;
        localStorage.setItem('selectedOrgId', orgId);
        return orgId;
      }
    } catch {
      // ignore
    }
  }
  return '';
}
