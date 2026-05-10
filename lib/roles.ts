// Shared role constants — safe to import from both client and server.
// This file must NEVER import server-only modules (next/headers, supabase, etc.)

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
