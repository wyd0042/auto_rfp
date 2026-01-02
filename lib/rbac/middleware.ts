/**
 * RBAC Middleware
 * Route protection helpers for API endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/utils/supabase/server';
import { db } from '@/lib/db';
import type { UserRole, RoleCheckResult, OrganizationRole } from './types';
import { mapOrgRoleToUserRole, hasAnyRole } from './role-utils';

/**
 * Gets the current user's role from the request
 * Extracts organization ID from request URL or body if available
 * Returns 'user' role if no organization context is found
 */
export async function getCurrentUserRole(
  request: NextRequest,
  organizationId?: string
): Promise<{ userId: string; role: UserRole } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // If no organization ID provided, return default 'user' role
  if (!organizationId) {
    return { userId: user.id, role: 'user' };
  }

  // Get user's role in the organization
  const orgUser = await db.organizationUser.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId,
      },
    },
  });

  const role = mapOrgRoleToUserRole(orgUser?.role as OrganizationRole | null);
  return { userId: user.id, role };
}

/**
 * Type for API route handler function
 */
type ApiRouteHandler = (
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) => Promise<NextResponse>;

/**
 * Type for API route handler with role context
 */
type ApiRouteHandlerWithRole = (
  request: NextRequest,
  context: { 
    params?: Promise<Record<string, string>>;
    userRole: UserRole;
    userId: string;
  }
) => Promise<NextResponse>;

/**
 * Options for the withRoleCheck wrapper
 */
interface WithRoleCheckOptions {
  /** Allowed roles for this route */
  allowedRoles: UserRole[];
  /** 
   * Function to extract organization ID from request
   * If not provided, will try to extract from URL params
   */
  getOrganizationId?: (
    request: NextRequest,
    params?: Record<string, string>
  ) => string | undefined;
}

/**
 * Wrapper function for protected API routes
 * Checks if the current user has one of the allowed roles
 * Returns 401 for unauthenticated requests
 * Returns 403 for unauthorized requests (insufficient role)
 */
export function withRoleCheck(
  handler: ApiRouteHandlerWithRole,
  options: WithRoleCheckOptions
): ApiRouteHandler {
  return async (
    request: NextRequest,
    context?: { params?: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    try {
      // Resolve params if they exist
      const resolvedParams = context?.params ? await context.params : undefined;

      // Get organization ID from options or try to extract from URL params
      let organizationId: string | undefined;
      
      if (options.getOrganizationId) {
        organizationId = options.getOrganizationId(request, resolvedParams);
      } else if (resolvedParams) {
        // Try common param names for organization ID
        organizationId = resolvedParams.orgId || 
                        resolvedParams.organizationId || 
                        resolvedParams.id;
      }

      // Get current user and their role
      const userInfo = await getCurrentUserRole(request, organizationId);

      // Check authentication
      if (!userInfo) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      // Check authorization
      const hasPermission = hasAnyRole(userInfo.role, options.allowedRoles);

      if (!hasPermission) {
        const result: RoleCheckResult = {
          allowed: false,
          userRole: userInfo.role,
          requiredRole: options.allowedRoles,
        };

        return NextResponse.json(
          { 
            error: 'Forbidden',
            requiredRole: options.allowedRoles,
            userRole: userInfo.role,
          },
          { status: 403 }
        );
      }

      // User is authorized, call the handler with role context
      return await handler(request, {
        params: context?.params,
        userRole: userInfo.role,
        userId: userInfo.userId,
      });
    } catch (error) {
      console.error('RBAC Middleware Error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Helper to create a role check result
 */
export function createRoleCheckResult(
  allowed: boolean,
  userRole: UserRole,
  requiredRole: UserRole | UserRole[]
): RoleCheckResult {
  return { allowed, userRole, requiredRole };
}
