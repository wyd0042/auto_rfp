/**
 * RBAC Types and Interfaces
 * Defines role types and interfaces for the Role-Based Access Control system
 */

/**
 * Maps to existing OrganizationUser.role values in the database
 */
export type OrganizationRole = 'owner' | 'admin' | 'member';

/**
 * Simplified role for permission checks
 * - admin: Full access (maps from owner/admin)
 * - collaborator: Team member access (maps from member)
 * - user: Default role for users without organization membership
 */
export type UserRole = 'admin' | 'collaborator' | 'user';

/**
 * Result of a role permission check
 */
export interface RoleCheckResult {
  allowed: boolean;
  userRole: UserRole;
  requiredRole: UserRole | UserRole[];
}

/**
 * User information with their resolved role
 */
export interface UserWithRole {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  organizationId?: string;
}
