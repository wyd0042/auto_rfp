/**
 * User Profile API Endpoint
 * Returns current user info with their role
 * 
 * GET /api/me - Returns authenticated user's profile with role
 * Query params:
 *   - organizationId (optional): Get role for specific organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/utils/supabase/server';
import { getUserWithRole, mapOrgRoleToUserRole } from '@/lib/rbac/role-utils';
import { db } from '@/lib/db';
import type { OrganizationRole, UserWithRole } from '@/lib/rbac/types';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from Supabase
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Handle unauthenticated requests with 401
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get optional organization ID from query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId') || undefined;

    // Get user with role from database
    const userWithRole = await getUserWithRole(user.id, organizationId);

    // If user not found in database, create them and return with default role
    if (!userWithRole) {
      // Ensure user exists in our database
      const dbUser = await db.user.upsert({
        where: { id: user.id },
        update: {},
        create: {
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.name || null,
        },
      });

      // If organization ID provided, check membership
      let role: UserWithRole['role'] = 'user';
      let resolvedOrgId: string | undefined;

      if (organizationId) {
        const orgUser = await db.organizationUser.findUnique({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId,
            },
          },
        });

        if (orgUser) {
          role = mapOrgRoleToUserRole(orgUser.role as OrganizationRole);
          resolvedOrgId = organizationId;
        }
      }

      const response: UserWithRole = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role,
        organizationId: resolvedOrgId,
      };

      return NextResponse.json(response);
    }

    // Return user with role
    return NextResponse.json(userWithRole);
  } catch (error) {
    console.error('Error getting user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
