// Shared role constants and permission helpers.
// SAFE to import from both client and server.
// Never import server-only modules here.

export const ROLES = [
  { value: 'ceo', label: 'CEO' },
  { value: 'owner', label: 'Owner' },
  { value: 'co-owner', label: 'Co-Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'employee', label: 'Employee' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'viewer', label: 'Viewer' },
] as const;

export type RoleValue = typeof ROLES[number]['value'];

export function canManageUsers(role: string): boolean {
  return ['ceo', 'owner', 'co-owner'].includes(role);
}
export function canEditBudget(role: string): boolean {
  return ['ceo', 'owner', 'co-owner', 'accountant'].includes(role);
}
export function canApproveExpenses(role: string): boolean {
  return ['ceo', 'owner', 'co-owner', 'accountant'].includes(role);
}
export function canViewAllTasks(role: string): boolean {
  return ['ceo', 'owner', 'co-owner', 'manager'].includes(role);
}
export function canCreateEvents(role: string): boolean {
  return ['ceo', 'owner', 'co-owner', 'manager', 'employee'].includes(role);
}
export function canDeleteUsers(role: string): boolean {
  return ['ceo', 'owner'].includes(role);
}
export function isLeadership(role: string): boolean {
  return ['ceo', 'owner', 'co-owner'].includes(role);
}

// ─── NEW PERMISSION HELPERS ───

// Only top leadership can see EVERYONE'S performance
export function canViewAllPerformance(role: string): boolean {
  return ['ceo', 'owner', 'co-owner'].includes(role);
}

// Only top leadership can ASSIGN agents to managers
export function canAssignAgentsToManagers(role: string): boolean {
  return ['ceo', 'owner', 'co-owner'].includes(role);
}

// Managers see ONLY their assigned agents' performance
export function canViewTeamPerformance(role: string): boolean {
  return ['ceo', 'owner', 'co-owner', 'manager'].includes(role);
}

// Calculators are open to everyone except viewers
export function canUseCalculators(role: string): boolean {
  return ['ceo', 'owner', 'co-owner', 'manager', 'employee', 'accountant'].includes(role);
}
