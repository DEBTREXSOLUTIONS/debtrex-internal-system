import 'server-only';
import { supabaseAdmin } from './supabase';

// All permission keys — kept in sync with database/migration-003.sql seed list.
// When adding a new permission, add the key here AND seed it in the migration.
export const PERMISSION_KEYS = [
  // Sections (controls sidebar + page access)
  'section.dashboard',
  'section.tasks',
  'section.calendar',
  'section.files',
  'section.budget',
  'section.team',
  'section.performance',
  'section.calculators',
  'section.pipeline_management',
  'section.pipeline_sales',
  // Tasks
  'task.create',
  'task.edit_any',
  'task.delete',
  'task.assign_to_anyone',
  'task.view_all',
  // Calendar / events
  'event.create',
  'event.edit_any',
  'event.delete',
  'event.invite_anyone',
  // Budget
  'budget.view',
  'budget.edit_allocations',
  'expense.submit',
  'expense.approve',
  'income.record',
  // Team
  'team.invite',
  'team.change_roles',
  'team.deactivate',
  'team.delete',
  // Performance
  'performance.view_all',
  'performance.view_team',
  'performance.assign_managers',
  // Pipeline
  'pipeline.create',
  'pipeline.edit_any',
  'pipeline.delete',
  'pipeline.view_all',
  'pipeline.assign_to_anyone',
  'pipeline.export',
  // Calls
  'call.log',
  'call.make',
  'call.view_all',
  // Permissions admin
  'permissions.manage',
] as const;

export type PermissionKey = typeof PERMISSION_KEYS[number];

// Permissions grouped for the UI
export const PERMISSION_GROUPS: { label: string; keys: PermissionKey[] }[] = [
  {
    label: 'Section Visibility',
    keys: [
      'section.dashboard', 'section.tasks', 'section.calendar', 'section.files',
      'section.budget', 'section.team', 'section.performance',
      'section.calculators', 'section.pipeline_management', 'section.pipeline_sales',
    ],
  },
  {
    label: 'Tasks',
    keys: ['task.create', 'task.edit_any', 'task.delete', 'task.assign_to_anyone', 'task.view_all'],
  },
  {
    label: 'Calendar / Events',
    keys: ['event.create', 'event.edit_any', 'event.delete', 'event.invite_anyone'],
  },
  {
    label: 'Budget',
    keys: ['budget.view', 'budget.edit_allocations', 'expense.submit', 'expense.approve', 'income.record'],
  },
  {
    label: 'Team Management',
    keys: ['team.invite', 'team.change_roles', 'team.deactivate', 'team.delete'],
  },
  {
    label: 'Performance Tracking',
    keys: ['performance.view_all', 'performance.view_team', 'performance.assign_managers'],
  },
  {
    label: 'Pipeline (Management + Sales)',
    keys: [
      'pipeline.create', 'pipeline.edit_any', 'pipeline.delete',
      'pipeline.view_all', 'pipeline.assign_to_anyone', 'pipeline.export',
    ],
  },
  {
    label: 'Calls',
    keys: ['call.log', 'call.make', 'call.view_all'],
  },
  {
    label: 'Permissions Admin',
    keys: ['permissions.manage'],
  },
];

// Friendly labels for each permission key
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'section.dashboard': 'See Dashboard',
  'section.tasks': 'See Tasks section',
  'section.calendar': 'See Calendar section',
  'section.files': 'See Files section',
  'section.budget': 'See Budget section',
  'section.team': 'See Team section',
  'section.performance': 'See Performance section',
  'section.calculators': 'See Calculators section',
  'section.pipeline_management': 'See Pipeline → Management',
  'section.pipeline_sales': 'See Pipeline → Sales',

  'task.create': 'Create new tasks',
  'task.edit_any': 'Edit any task (not just own)',
  'task.delete': 'Delete tasks',
  'task.assign_to_anyone': 'Assign tasks to any user',
  'task.view_all': 'View all tasks (not just own)',

  'event.create': 'Create calendar events',
  'event.edit_any': 'Edit any event (not just own)',
  'event.delete': 'Delete events',
  'event.invite_anyone': 'Invite anyone to events',

  'budget.view': 'View budget data',
  'budget.edit_allocations': 'Set monthly budget allocations',
  'expense.submit': 'Submit expenses',
  'expense.approve': 'Approve / reject expenses',
  'income.record': 'Record income',

  'team.invite': 'Invite new team members',
  'team.change_roles': 'Change team member roles',
  'team.deactivate': 'Deactivate team members',
  'team.delete': 'Delete team members',

  'performance.view_all': "View everyone's performance",
  'performance.view_team': "View assigned team's performance",
  'performance.assign_managers': 'Assign agents to managers',

  'pipeline.create': 'Add new contacts',
  'pipeline.edit_any': 'Edit any contact (not just own)',
  'pipeline.delete': 'Delete contacts',
  'pipeline.view_all': 'View all contacts (not just assigned)',
  'pipeline.assign_to_anyone': 'Reassign contacts to others',
  'pipeline.export': 'Export contact lists',

  'call.log': 'Log calls manually',
  'call.make': 'Make calls (Twilio)',
  'call.view_all': "View everyone's call logs",

  'permissions.manage': 'Manage role permissions (THIS PAGE)',
};

// In-memory cache to avoid hitting DB on every check
let permissionCache: Map<string, Map<string, boolean>> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 300_000; // 5 minutes

async function loadPermissions(): Promise<Map<string, Map<string, boolean>>> {
  if (permissionCache && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return permissionCache;
  }
  const { data } = await supabaseAdmin
    .from('role_permissions')
    .select('role, permission_key, enabled');
  const map = new Map<string, Map<string, boolean>>();
  (data || []).forEach((row: any) => {
    if (!map.has(row.role)) map.set(row.role, new Map());
    map.get(row.role)!.set(row.permission_key, row.enabled);
  });
  permissionCache = map;
  cacheLoadedAt = Date.now();
  return map;
}

// Force-invalidate the cache (call after any permission change)
export function invalidatePermissionCache() {
  permissionCache = null;
  cacheLoadedAt = 0;
}

/**
 * Check if a single role has a specific permission.
 * Returns false if no row exists (deny by default).
 */
export async function hasPermission(role: string, key: PermissionKey): Promise<boolean> {
  const map = await loadPermissions();
  return map.get(role)?.get(key) ?? false;
}

/**
 * Get all permissions for a role as a flat object — efficient for checking many at once.
 */
export async function getPermissions(role: string): Promise<Record<string, boolean>> {
  const map = await loadPermissions();
  const roleMap = map.get(role);
  if (!roleMap) return {};
  const result: Record<string, boolean> = {};
  for (const [k, v] of roleMap.entries()) result[k] = v;
  return result;
}

/**
 * Get the FULL permissions matrix — for the admin UI.
 * Returns: { [role]: { [permission_key]: boolean } }
 */
export async function getAllPermissions(): Promise<Record<string, Record<string, boolean>>> {
  // Bypass cache to always show fresh data on the admin page
  const { data } = await supabaseAdmin
    .from('role_permissions')
    .select('role, permission_key, enabled');
  const result: Record<string, Record<string, boolean>> = {};
  (data || []).forEach((row: any) => {
    if (!result[row.role]) result[row.role] = {};
    result[row.role][row.permission_key] = row.enabled;
  });
  return result;
}
