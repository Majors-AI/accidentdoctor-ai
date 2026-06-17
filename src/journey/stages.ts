// Single source of truth for the Patient Journey Framework.
// The bottom bar (JourneyBar) and the /journey route subtree both map over
// this array — so adding, removing, or reordering a stage is a one-line edit
// here, and the navigation and routes stay in sync automatically.
//
// Role categories: patient (future) / practice (front_desk, provider,
// billing_staff, practice_admin) / admin (platform_admin)
// — mirrors the lawyer app's client / firm / admin three-category model.

export type RoleCategory = 'patient' | 'practice' | 'admin';

export type JourneyStage = {
  id: number;
  label: string;
  path: string;
  icon: string;
  // Role categories permitted to view/open this stage. Empty = no owner yet.
  roles: RoleCategory[];
};

export const JOURNEY_STAGES: JourneyStage[] = [
  { id: 1,  label: 'Practice Registration',   path: '/journey/practice-registration', icon: '🏥', roles: ['admin'] },
  // placeholder — no patient login (product decision 2026-06-15)
  { id: 2,  label: 'Patient Registration · placeholder', path: '/journey/patient-registration',  icon: '📝', roles: [] },
  { id: 3,  label: 'Patient Intake',                     path: '/journey/patient-intake',        icon: '📥', roles: ['practice'] },
  // placeholder — no patient login (product decision 2026-06-15)
  { id: 4,  label: 'Patient Portal · placeholder',       path: '/journey/patient-portal',        icon: '👤', roles: [] },
  { id: 5,  label: 'Billing Portal',          path: '/journey/billing-portal',        icon: '💵', roles: ['practice'] },
  { id: 6,  label: 'Clinical Portal',         path: '/journey/clinical-portal',       icon: '🩺', roles: ['practice'] },
  { id: 7,  label: 'File Cabinet',            path: '/journey/file-cabinet',          icon: '🗄️', roles: ['practice'] },
  { id: 8,  label: 'Staff Training',          path: '/journey/staff-training',        icon: '🎓', roles: ['practice'] },
  { id: 9,  label: 'Practice Settings',       path: '/journey/practice-settings',     icon: '⚙️', roles: ['practice'] },
  { id: 10, label: 'AccidentDoctor.AI Admin', path: '/journey/admin',                 icon: '🛡️', roles: ['admin'] },
];

// Per-category home stage
const HOME_STAGE_ID: Record<RoleCategory, number> = {
  patient:  4, // Phase 2
  practice: 5, // Billing Portal
  admin:    1, // Practice Registration
};

export interface JourneyProfile {
  // Built-in platform field: 'admin' = platform admin, 'user' = everyone else.
  role: string;
  // Custom app field: determines practice-staff routing.
  // Edited via Dashboard → Users → Edit User → app_role.
  app_role?: string;
}

const PRACTICE_APP_ROLES = new Set([
  'front_desk', 'provider', 'billing_staff', 'practice_admin',
]);

// Single mapping from a profile to its role category.
// Platform admin (role='admin') → 'admin'.
// Practice staff (app_role in PRACTICE_APP_ROLES) → 'practice'.
// Anything else → null (renders PendingSetup).
export function roleCategory(profile: JourneyProfile | null): RoleCategory | null {
  if (!profile) return null;
  if (profile.role === 'admin') return 'admin';
  if (profile.app_role && PRACTICE_APP_ROLES.has(profile.app_role)) return 'practice';
  return null;
}

// Stages visible to this profile (empty-roles stages are hidden).
export function visibleStages(profile: JourneyProfile | null): JourneyStage[] {
  const cat = roleCategory(profile);
  if (!cat) return [];
  return JOURNEY_STAGES.filter((s) => s.roles.includes(cat));
}

// Where /journey redirects for this profile.
export function homeStage(profile: JourneyProfile | null): JourneyStage {
  const cat = roleCategory(profile) ?? 'practice';
  const id = HOME_STAGE_ID[cat];
  return JOURNEY_STAGES.find((s) => s.id === id)!;
}

// Whether a profile may access a specific stage.
export function canAccessStage(profile: JourneyProfile | null, stage: JourneyStage): boolean {
  const cat = roleCategory(profile);
  return cat != null && stage.roles.includes(cat);
}

// Admin-only stage IDs (Practice Registration = 1, Admin Console = 10).
export const ADMIN_ONLY_STAGE_IDS = new Set([1, 10]);