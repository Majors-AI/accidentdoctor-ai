// Single source of truth for the practice working-nav (day-to-day pages,
// distinct from the journey stages). Shared by PracticeShell and Layout.

export type PracticeNavItem = { to: string; label: string; end?: boolean; adminOnly?: boolean };

export const PRACTICE_NAV_GROUPS: { group: string; items: PracticeNavItem[] }[] = [
  { group: 'Overview', items: [{ to: '/', label: 'Dashboard', end: true }] },
  { group: 'Patients', items: [
    { to: '/patients', label: 'All patients' },
    { to: '/referrals', label: 'Referrals' },
    { to: '/schedule', label: 'Schedule' },
  ]},
  { group: 'Practice', items: [
    { to: '/billing', label: 'Billing' },
    { to: '/account', label: 'Account' },
  ]},
  { group: 'Admin', items: [
    { to: '/reporting',      label: 'Reporting',      adminOnly: true },
    { to: '/staff-training', label: 'Staff Training', adminOnly: false },
  ]},
];

// Flattened — what the bottom bar renders as pills.
export const PRACTICE_NAV: PracticeNavItem[] = PRACTICE_NAV_GROUPS.flatMap((g) => g.items);