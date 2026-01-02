/**
 * RBAC Role Utilities
 * Functions for role checking and permission management
 */

import { db } from '@/lib/db';
import type { OrganizationRole, UserRole, UserWithRole, RoleCheckResult } from './types';

/**
 * Role hierarchy - higher index = more permissions
 * user (0) < collaborator (1) < admin (2)
 */
export const ROLE_HIERARCHY: UserRole[] = ['user', 'collaborator', 'admin'];

/**
 * Maps existing OrganizationUser.role values to simplified UserRole
 * - owner -> admin
 * - admin -> admin
 * - member -> collaborator
 * - null/undefined -> user (default)
 */
export function mapOrgRoleToUserRole(orgRole: OrganizationRole | null | undefined): UserRole {
  if (!orgRole) {
    return 'user';
  }
  
  switch (orgRole) {
    case 'owner':
    case 'admin':
      return 'admin';
    case 'member':
      return 'collaborator';
    default:
      return 'user';
  }
}

/**
 * Gets the hierarchy level of a role (higher = more permissions)
 */
function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

/**
 * Checks if a user has the required role or higher
 * Returns true if userRole >= requiredRole in the hierarchy
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const userLevel = getRoleLevel(userRole);
  const requiredLevel = getRoleLevel(requiredRole);
  return userLevel >= requiredLevel;
}

/**
 * Checks if a user has any of the allowed roles
 * Returns true if userRole matches at least one role in allowedRoles
 */
export function hasAnyRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.some(allowedRole => userRole === allowedRole);
}

/**
 * Gets a user with their resolved role from the database
 * If organizationId is provided, gets the role for that specific organization
 * Otherwise, returns the default 'user' role
 */
export async function getUserWithRole(
  userId: string,
  organizationId?: string
): Promise<UserWithRole | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      organizationUsers: organizationId
        ? {
            where: { organizationId },
            take: 1,
          }
        : false,
    },
  });

  if (!user) {
    return null;
  }

  // Determine role based on organization membership
  let role: UserRole = 'user';
  let resolvedOrgId: string | undefined;

  if (organizationId && user.organizationUsers && user.organizationUsers.length > 0) {
    const orgUser = user.organizationUsers[0];
    role = mapOrgRoleToUserRole(orgUser.role as OrganizationRole);
    resolvedOrgId = orgUser.organizationId;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role,
    organizationId: resolvedOrgId,
  };
}

/**
 * Serializes a RoleCheckResult to JSON string
 */
export function serializeRoleCheckResult(result: RoleCheckResult): string {
  return JSON.stringify(result);
}

/**
 * Deserializes a JSON string to RoleCheckResult
 */
export function deserializeRoleCheckResult(json: string): RoleCheckResult {
  return JSON.parse(json) as RoleCheckResult;
}

/**
 * Resource access context for determining access permissions
 */
export interface ResourceAccessContext {
  /** The user's role */
  userRole: UserRole;
  /** The ID of the user requesting access */
  userId: string;
  /** Whether the resource is shared (accessible to collaborators) */
  isShared?: boolean;
  /** The ID of the resource owner (if applicable) */
  ownerId?: string;
}

/**
 * Determines if a user can access a resource based on their role and ownership
 * 
 * Access rules:
 * - Admin: Can access any resource in the organization
 * - Collaborator: Can access shared resources
 * - User: Can only access resources they own
 * 
 * @param context - The resource access context containing user role, userId, and resource info
 * @returns true if access is granted, false otherwise
 */
export function canAccessResource(context: ResourceAccessContext): boolean {
  const { userRole, userId, isShared = false, ownerId } = context;

  // Admin can access any resource
  if (userRole === 'admin') {
    return true;
  }

  // Collaborator can access shared resources
  if (userRole === 'collaborator' && isShared) {
    return true;
  }

  // User can only access resources they own
  if (ownerId && userId === ownerId) {
    return true;
  }

  return false;
}
