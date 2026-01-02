/**
 * User List API Endpoint
 * Returns all organization users for admin/collaborator roles
 * 
 * GET /api/users - Returns all users in the organization
 * Query params:
 *   - organizationId (required): The organization to list users from
 * 
 * Access Control:
 *   - admin: Full access to user list
 *   - collaborator: Full access to user list
 *   - user: Access denied (403)
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRoleCheck } from '@/lib/rbac/middleware';
import { db } from '@/lib/db';
import { mapOrgRoleToUserRole } from '@/lib/rbac/role-utils';
import type { UserRole, OrganizationRole, UserWithRole } from '@/lib/rbac/types';

/**
 * Handler for GET /api/users
 * Returns all users in the specified organization
 */
async function getUsersHandler(
  request: NextRequest,
  context: {
    params?: Promise<Record<string, string>>;
    userRole: UserRole;
    userId: string;
  }
): Promise<NextResponse> {
  try {
    // Get organization ID from query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId query parameter is required' },
        { status: 400 }
      );
    }

    // Fetch all organization users with their user data
    const organizationUsers = await db.organizationUser.findMany({
      where: {
        organizationId,
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Map to UserWithRole format
    const users: UserWithRole[] = organizationUsers.map((orgUser) => ({
      id: orgUser.user.id,
      email: orgUser.user.email,
      name: orgUser.user.name,
      role: mapOrgRoleToUserRole(orgUser.role as OrganizationRole),
      organizationId: orgUser.organizationId,
    }));

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/users
 * Protected route - only admin and collaborator roles can access
 */
export const GET = withRoleCheck(getUsersHandler, {
  allowedRoles: ['admin', 'collaborator'],
  getOrganizationId: (request) => {
    const { searchParams } = new URL(request.url);
    return searchParams.get('organizationId') || undefined;
  },
});
