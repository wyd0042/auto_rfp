/**
 * Property-based tests for RBAC utilities
 *
 * **Feature: rbac-integration**
 *
 * These tests verify the correctness properties for the RBAC system
 * using fast-check for property-based testing.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  mapOrgRoleToUserRole,
  hasRole,
  hasAnyRole,
  ROLE_HIERARCHY,
  serializeRoleCheckResult,
  deserializeRoleCheckResult,
  canAccessResource,
  type ResourceAccessContext,
} from '@/lib/rbac/role-utils';
import type { OrganizationRole, UserRole, RoleCheckResult } from '@/lib/rbac/types';

// ============================================================================
// Generators
// ============================================================================

/**
 * Generator for valid OrganizationRole values
 */
const organizationRoleArb: fc.Arbitrary<OrganizationRole> = fc.constantFrom(
  'owner',
  'admin',
  'member'
);

/**
 * Generator for null or undefined values (no organization membership)
 */
const nullOrUndefinedArb: fc.Arbitrary<null | undefined> = fc.constantFrom(null, undefined);

/**
 * Generator for UserRole values
 */
const userRoleArb: fc.Arbitrary<UserRole> = fc.constantFrom('admin', 'collaborator', 'user');

/**
 * Generator for pairs of different UserRole values
 */
const differentRolePairArb: fc.Arbitrary<[UserRole, UserRole]> = fc
  .tuple(userRoleArb, userRoleArb)
  .filter(([a, b]) => a !== b);

/**
 * Generator for non-empty arrays of UserRole values
 */
const userRoleArrayArb: fc.Arbitrary<UserRole[]> = fc.array(userRoleArb, { minLength: 1, maxLength: 3 });

/**
 * Generator for RoleCheckResult objects
 */
const roleCheckResultArb: fc.Arbitrary<RoleCheckResult> = fc.record({
  allowed: fc.boolean(),
  userRole: userRoleArb,
  requiredRole: fc.oneof(userRoleArb, userRoleArrayArb),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('RBAC Property Tests', () => {
  /**
   * **Feature: rbac-integration, Property 1: Default role assignment**
   * **Validates: Requirements 1.2**
   *
   * For any user without organization membership (null/undefined role),
   * the role resolution function SHALL return the 'user' role.
   */
  describe('Property 1: Default role assignment', () => {
    it('should return "user" role for null organization role', () => {
      fc.assert(
        fc.property(fc.constant(null), (orgRole) => {
          const result = mapOrgRoleToUserRole(orgRole);
          expect(result).toBe('user');
        }),
        { numRuns: 100 }
      );
    });

    it('should return "user" role for undefined organization role', () => {
      fc.assert(
        fc.property(fc.constant(undefined), (orgRole) => {
          const result = mapOrgRoleToUserRole(orgRole);
          expect(result).toBe('user');
        }),
        { numRuns: 100 }
      );
    });

    it('should return "user" role for any null or undefined value', () => {
      fc.assert(
        fc.property(nullOrUndefinedArb, (orgRole) => {
          const result = mapOrgRoleToUserRole(orgRole);
          expect(result).toBe('user');
        }),
        { numRuns: 100 }
      );
    });

    it('should map "owner" to "admin"', () => {
      fc.assert(
        fc.property(fc.constant('owner' as OrganizationRole), (orgRole) => {
          const result = mapOrgRoleToUserRole(orgRole);
          expect(result).toBe('admin');
        }),
        { numRuns: 100 }
      );
    });

    it('should map "admin" to "admin"', () => {
      fc.assert(
        fc.property(fc.constant('admin' as OrganizationRole), (orgRole) => {
          const result = mapOrgRoleToUserRole(orgRole);
          expect(result).toBe('admin');
        }),
        { numRuns: 100 }
      );
    });

    it('should map "member" to "collaborator"', () => {
      fc.assert(
        fc.property(fc.constant('member' as OrganizationRole), (orgRole) => {
          const result = mapOrgRoleToUserRole(orgRole);
          expect(result).toBe('collaborator');
        }),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: rbac-integration, Property 2: Role hierarchy consistency**
   * **Validates: Requirements 1.3, 2.1**
   *
   * For any two roles A and B, if A > B in the hierarchy, then hasRole(A, B)
   * SHALL return true and hasRole(B, A) SHALL return false.
   */
  describe('Property 2: Role hierarchy consistency', () => {
    it('should have correct hierarchy order: user < collaborator < admin', () => {
      expect(ROLE_HIERARCHY).toEqual(['user', 'collaborator', 'admin']);
    });

    it('should return true when user role is higher than required role', () => {
      fc.assert(
        fc.property(differentRolePairArb, ([roleA, roleB]) => {
          const indexA = ROLE_HIERARCHY.indexOf(roleA);
          const indexB = ROLE_HIERARCHY.indexOf(roleB);

          if (indexA > indexB) {
            // roleA is higher than roleB
            expect(hasRole(roleA, roleB)).toBe(true);
            expect(hasRole(roleB, roleA)).toBe(false);
          } else {
            // roleB is higher than roleA
            expect(hasRole(roleB, roleA)).toBe(true);
            expect(hasRole(roleA, roleB)).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should return true when user role equals required role', () => {
      fc.assert(
        fc.property(userRoleArb, (role) => {
          expect(hasRole(role, role)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('admin should have access to all roles', () => {
      fc.assert(
        fc.property(userRoleArb, (requiredRole) => {
          expect(hasRole('admin', requiredRole)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('user should only have access to user role', () => {
      expect(hasRole('user', 'user')).toBe(true);
      expect(hasRole('user', 'collaborator')).toBe(false);
      expect(hasRole('user', 'admin')).toBe(false);
    });

    it('collaborator should have access to user and collaborator roles', () => {
      expect(hasRole('collaborator', 'user')).toBe(true);
      expect(hasRole('collaborator', 'collaborator')).toBe(true);
      expect(hasRole('collaborator', 'admin')).toBe(false);
    });
  });

  /**
   * **Feature: rbac-integration, Property 3: Role check boolean correctness**
   * **Validates: Requirements 2.1**
   *
   * For any user role and required role, hasRole SHALL return true if and only if
   * the user role is greater than or equal to the required role in the hierarchy.
   */
  describe('Property 3: Role check boolean correctness', () => {
    it('should return correct boolean based on hierarchy comparison', () => {
      fc.assert(
        fc.property(userRoleArb, userRoleArb, (userRole, requiredRole) => {
          const userIndex = ROLE_HIERARCHY.indexOf(userRole);
          const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole);
          const expected = userIndex >= requiredIndex;

          expect(hasRole(userRole, requiredRole)).toBe(expected);
        }),
        { numRuns: 100 }
      );
    });

    it('should be reflexive (role always has itself)', () => {
      fc.assert(
        fc.property(userRoleArb, (role) => {
          expect(hasRole(role, role)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should be transitive', () => {
      // If admin >= collaborator and collaborator >= user, then admin >= user
      expect(hasRole('admin', 'collaborator')).toBe(true);
      expect(hasRole('collaborator', 'user')).toBe(true);
      expect(hasRole('admin', 'user')).toBe(true);
    });
  });

  /**
   * **Feature: rbac-integration, Property 4: Multi-role check correctness**
   * **Validates: Requirements 2.2**
   *
   * For any user role and array of allowed roles, hasAnyRole SHALL return true
   * if and only if the user role matches at least one role in the array.
   */
  describe('Property 4: Multi-role check correctness', () => {
    it('should return true when user role is in allowed roles array', () => {
      fc.assert(
        fc.property(userRoleArb, (userRole) => {
          // Create an array that includes the user's role
          const allowedRoles: UserRole[] = [userRole];
          expect(hasAnyRole(userRole, allowedRoles)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should return false when user role is not in allowed roles array', () => {
      // user role should not match ['admin', 'collaborator']
      expect(hasAnyRole('user', ['admin', 'collaborator'])).toBe(false);
      // collaborator role should not match ['admin']
      expect(hasAnyRole('collaborator', ['admin'])).toBe(false);
      // admin role should not match ['user']
      expect(hasAnyRole('admin', ['user'])).toBe(false);
    });

    it('should return true when user role matches any role in array', () => {
      fc.assert(
        fc.property(userRoleArb, userRoleArrayArb, (userRole, allowedRoles) => {
          const expected = allowedRoles.includes(userRole);
          expect(hasAnyRole(userRole, allowedRoles)).toBe(expected);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle single-element arrays correctly', () => {
      fc.assert(
        fc.property(userRoleArb, userRoleArb, (userRole, allowedRole) => {
          const expected = userRole === allowedRole;
          expect(hasAnyRole(userRole, [allowedRole])).toBe(expected);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle arrays with all roles', () => {
      fc.assert(
        fc.property(userRoleArb, (userRole) => {
          const allRoles: UserRole[] = ['admin', 'collaborator', 'user'];
          expect(hasAnyRole(userRole, allRoles)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: rbac-integration, Property 5: Role check result serialization round-trip**
   * **Validates: Requirements 2.3**
   *
   * For any RoleCheckResult object, serializing to JSON and deserializing
   * SHALL produce an equivalent object.
   */
  describe('Property 5: Role check result serialization round-trip', () => {
    it('should produce equivalent object after serialize/deserialize', () => {
      fc.assert(
        fc.property(roleCheckResultArb, (result) => {
          const serialized = serializeRoleCheckResult(result);
          const deserialized = deserializeRoleCheckResult(serialized);

          expect(deserialized.allowed).toBe(result.allowed);
          expect(deserialized.userRole).toBe(result.userRole);
          expect(deserialized.requiredRole).toEqual(result.requiredRole);
        }),
        { numRuns: 100 }
      );
    });

    it('should produce valid JSON string', () => {
      fc.assert(
        fc.property(roleCheckResultArb, (result) => {
          const serialized = serializeRoleCheckResult(result);

          // Should be a valid JSON string
          expect(() => JSON.parse(serialized)).not.toThrow();
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve all fields through round-trip', () => {
      fc.assert(
        fc.property(roleCheckResultArb, (result) => {
          const serialized = serializeRoleCheckResult(result);
          const deserialized = deserializeRoleCheckResult(serialized);

          // Deep equality check
          expect(deserialized).toEqual(result);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle single role in requiredRole', () => {
      fc.assert(
        fc.property(fc.boolean(), userRoleArb, userRoleArb, (allowed, userRole, requiredRole) => {
          const result: RoleCheckResult = { allowed, userRole, requiredRole };
          const serialized = serializeRoleCheckResult(result);
          const deserialized = deserializeRoleCheckResult(serialized);

          expect(deserialized).toEqual(result);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle array of roles in requiredRole', () => {
      fc.assert(
        fc.property(fc.boolean(), userRoleArb, userRoleArrayArb, (allowed, userRole, requiredRoles) => {
          const result: RoleCheckResult = { allowed, userRole, requiredRole: requiredRoles };
          const serialized = serializeRoleCheckResult(result);
          const deserialized = deserializeRoleCheckResult(serialized);

          expect(deserialized).toEqual(result);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: rbac-integration, Property 8: Profile access with role**
   * **Validates: Requirements 4.1**
   *
   * For any authenticated user requesting their profile, the response SHALL include
   * their correct role based on organization membership.
   *
   * This property tests the role resolution logic that the /api/me endpoint uses:
   * - Users with 'owner' or 'admin' org role get 'admin' UserRole
   * - Users with 'member' org role get 'collaborator' UserRole
   * - Users without organization membership get 'user' UserRole
   */
  describe('Property 8: Profile access with role', () => {
    /**
     * Generator for user profile data with organization membership
     */
    const userProfileWithOrgArb = fc.record({
      userId: fc.uuid(),
      email: fc.emailAddress(),
      name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
      organizationId: fc.uuid(),
      orgRole: organizationRoleArb,
    });

    /**
     * Generator for user profile data without organization membership
     */
    const userProfileWithoutOrgArb = fc.record({
      userId: fc.uuid(),
      email: fc.emailAddress(),
      name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
    });

    it('should resolve correct role for users with organization membership', () => {
      fc.assert(
        fc.property(userProfileWithOrgArb, (profile) => {
          // Simulate the role resolution that /api/me performs
          const resolvedRole = mapOrgRoleToUserRole(profile.orgRole);

          // Verify the role mapping is correct based on org role
          if (profile.orgRole === 'owner' || profile.orgRole === 'admin') {
            expect(resolvedRole).toBe('admin');
          } else if (profile.orgRole === 'member') {
            expect(resolvedRole).toBe('collaborator');
          }

          // The resolved role should always be a valid UserRole
          expect(['admin', 'collaborator', 'user']).toContain(resolvedRole);
        }),
        { numRuns: 100 }
      );
    });

    it('should resolve "user" role for users without organization membership', () => {
      fc.assert(
        fc.property(userProfileWithoutOrgArb, () => {
          // When no organization membership exists, role should be 'user'
          const resolvedRole = mapOrgRoleToUserRole(null);
          expect(resolvedRole).toBe('user');

          const resolvedRoleUndefined = mapOrgRoleToUserRole(undefined);
          expect(resolvedRoleUndefined).toBe('user');
        }),
        { numRuns: 100 }
      );
    });

    it('should include all required profile fields in response structure', () => {
      fc.assert(
        fc.property(userProfileWithOrgArb, (profile) => {
          // Simulate the UserWithRole response structure from /api/me
          const response = {
            id: profile.userId,
            email: profile.email,
            name: profile.name,
            role: mapOrgRoleToUserRole(profile.orgRole),
            organizationId: profile.organizationId,
          };

          // Verify all required fields are present
          expect(response).toHaveProperty('id');
          expect(response).toHaveProperty('email');
          expect(response).toHaveProperty('name');
          expect(response).toHaveProperty('role');
          expect(response).toHaveProperty('organizationId');

          // Verify types
          expect(typeof response.id).toBe('string');
          expect(typeof response.email).toBe('string');
          expect(response.name === null || typeof response.name === 'string').toBe(true);
          expect(['admin', 'collaborator', 'user']).toContain(response.role);
          expect(typeof response.organizationId).toBe('string');
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly map all organization roles to user roles for profile', () => {
      fc.assert(
        fc.property(
          fc.oneof(organizationRoleArb, nullOrUndefinedArb),
          (orgRole) => {
            const resolvedRole = mapOrgRoleToUserRole(orgRole);

            // Verify the mapping is deterministic and correct
            if (orgRole === 'owner') {
              expect(resolvedRole).toBe('admin');
            } else if (orgRole === 'admin') {
              expect(resolvedRole).toBe('admin');
            } else if (orgRole === 'member') {
              expect(resolvedRole).toBe('collaborator');
            } else {
              // null or undefined
              expect(resolvedRole).toBe('user');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain role consistency across multiple profile requests', () => {
      fc.assert(
        fc.property(userProfileWithOrgArb, fc.integer({ min: 1, max: 10 }), (profile, iterations) => {
          // Simulate multiple profile requests for the same user
          const roles: string[] = [];

          for (let i = 0; i < iterations; i++) {
            const resolvedRole = mapOrgRoleToUserRole(profile.orgRole);
            roles.push(resolvedRole);
          }

          // All resolved roles should be identical (deterministic)
          const firstRole = roles[0];
          expect(roles.every((role) => role === firstRole)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: rbac-integration, Property 6: Admin/collaborator user list access**
   * **Validates: Requirements 3.1, 3.2**
   *
   * For any user with 'admin' or 'collaborator' role requesting the user list,
   * the system SHALL return all users in the organization.
   */
  describe('Property 6: Admin/collaborator user list access', () => {
    /**
     * Generator for roles that should have access to user list
     */
    const allowedRolesArb: fc.Arbitrary<UserRole> = fc.constantFrom('admin', 'collaborator');

    /**
     * Generator for organization user data
     */
    const organizationUserArb = fc.record({
      userId: fc.uuid(),
      email: fc.emailAddress(),
      name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
      orgRole: organizationRoleArb,
      organizationId: fc.uuid(),
    });

    /**
     * Generator for a list of organization users
     */
    const organizationUsersListArb = fc.array(organizationUserArb, { minLength: 0, maxLength: 10 });

    it('should allow admin role to access user list', () => {
      fc.assert(
        fc.property(organizationUsersListArb, (orgUsers) => {
          const requestingUserRole: UserRole = 'admin';
          
          // Admin should have access
          const hasAccess = hasAnyRole(requestingUserRole, ['admin', 'collaborator']);
          expect(hasAccess).toBe(true);

          // Simulate mapping org users to UserWithRole format
          const mappedUsers = orgUsers.map((user) => ({
            id: user.userId,
            email: user.email,
            name: user.name,
            role: mapOrgRoleToUserRole(user.orgRole),
            organizationId: user.organizationId,
          }));

          // All users should be returned (length preserved)
          expect(mappedUsers.length).toBe(orgUsers.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should allow collaborator role to access user list', () => {
      fc.assert(
        fc.property(organizationUsersListArb, (orgUsers) => {
          const requestingUserRole: UserRole = 'collaborator';
          
          // Collaborator should have access
          const hasAccess = hasAnyRole(requestingUserRole, ['admin', 'collaborator']);
          expect(hasAccess).toBe(true);

          // Simulate mapping org users to UserWithRole format
          const mappedUsers = orgUsers.map((user) => ({
            id: user.userId,
            email: user.email,
            name: user.name,
            role: mapOrgRoleToUserRole(user.orgRole),
            organizationId: user.organizationId,
          }));

          // All users should be returned (length preserved)
          expect(mappedUsers.length).toBe(orgUsers.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should return all users for any allowed role', () => {
      fc.assert(
        fc.property(allowedRolesArb, organizationUsersListArb, (requestingRole, orgUsers) => {
          // Both admin and collaborator should have access
          const hasAccess = hasAnyRole(requestingRole, ['admin', 'collaborator']);
          expect(hasAccess).toBe(true);

          // Simulate the user list response
          const mappedUsers = orgUsers.map((user) => ({
            id: user.userId,
            email: user.email,
            name: user.name,
            role: mapOrgRoleToUserRole(user.orgRole),
            organizationId: user.organizationId,
          }));

          // All users should be returned
          expect(mappedUsers.length).toBe(orgUsers.length);

          // Each user should have valid role mapping
          mappedUsers.forEach((user) => {
            expect(['admin', 'collaborator', 'user']).toContain(user.role);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly map all organization roles in user list', () => {
      fc.assert(
        fc.property(organizationUsersListArb, (orgUsers) => {
          const mappedUsers = orgUsers.map((user) => ({
            id: user.userId,
            email: user.email,
            name: user.name,
            role: mapOrgRoleToUserRole(user.orgRole),
            organizationId: user.organizationId,
          }));

          // Verify role mapping for each user
          orgUsers.forEach((orgUser, index) => {
            const mappedUser = mappedUsers[index];
            
            if (orgUser.orgRole === 'owner' || orgUser.orgRole === 'admin') {
              expect(mappedUser.role).toBe('admin');
            } else if (orgUser.orgRole === 'member') {
              expect(mappedUser.role).toBe('collaborator');
            }
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve user data integrity in response', () => {
      fc.assert(
        fc.property(organizationUsersListArb, (orgUsers) => {
          const mappedUsers = orgUsers.map((user) => ({
            id: user.userId,
            email: user.email,
            name: user.name,
            role: mapOrgRoleToUserRole(user.orgRole),
            organizationId: user.organizationId,
          }));

          // Verify data integrity
          orgUsers.forEach((orgUser, index) => {
            const mappedUser = mappedUsers[index];
            expect(mappedUser.id).toBe(orgUser.userId);
            expect(mappedUser.email).toBe(orgUser.email);
            expect(mappedUser.name).toBe(orgUser.name);
            expect(mappedUser.organizationId).toBe(orgUser.organizationId);
          });
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: rbac-integration, Property 7: Regular user list denial**
   * **Validates: Requirements 3.3, 3.4**
   *
   * For any user with 'user' role requesting the user list,
   * the system SHALL deny access with a 403 status.
   */
  describe('Property 7: Regular user list denial', () => {
    it('should deny user role access to user list', () => {
      fc.assert(
        fc.property(fc.constant('user' as UserRole), (requestingRole) => {
          // User role should NOT have access
          const hasAccess = hasAnyRole(requestingRole, ['admin', 'collaborator']);
          expect(hasAccess).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should only allow admin and collaborator, not user', () => {
      fc.assert(
        fc.property(userRoleArb, (role) => {
          const hasAccess = hasAnyRole(role, ['admin', 'collaborator']);
          
          if (role === 'admin' || role === 'collaborator') {
            expect(hasAccess).toBe(true);
          } else {
            // 'user' role should be denied
            expect(hasAccess).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should return 403 status for user role (simulated response)', () => {
      fc.assert(
        fc.property(fc.constant('user' as UserRole), (requestingRole) => {
          const allowedRoles: UserRole[] = ['admin', 'collaborator'];
          const hasAccess = hasAnyRole(requestingRole, allowedRoles);
          
          // Simulate the middleware response
          const responseStatus = hasAccess ? 200 : 403;
          expect(responseStatus).toBe(403);
        }),
        { numRuns: 100 }
      );
    });

    it('should include correct error information in denial response', () => {
      fc.assert(
        fc.property(fc.constant('user' as UserRole), (requestingRole) => {
          const allowedRoles: UserRole[] = ['admin', 'collaborator'];
          const hasAccess = hasAnyRole(requestingRole, allowedRoles);
          
          if (!hasAccess) {
            // Simulate the error response structure
            const errorResponse = {
              error: 'Forbidden',
              requiredRole: allowedRoles,
              userRole: requestingRole,
            };

            expect(errorResponse.error).toBe('Forbidden');
            expect(errorResponse.requiredRole).toEqual(['admin', 'collaborator']);
            expect(errorResponse.userRole).toBe('user');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should consistently deny user role across multiple requests', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), (iterations) => {
          const requestingRole: UserRole = 'user';
          const allowedRoles: UserRole[] = ['admin', 'collaborator'];
          
          // Simulate multiple access attempts
          const results: boolean[] = [];
          for (let i = 0; i < iterations; i++) {
            results.push(hasAnyRole(requestingRole, allowedRoles));
          }

          // All attempts should be denied
          expect(results.every((result) => result === false)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should differentiate between allowed and denied roles correctly', () => {
      fc.assert(
        fc.property(userRoleArb, (role) => {
          const allowedRoles: UserRole[] = ['admin', 'collaborator'];
          const hasAccess = hasAnyRole(role, allowedRoles);
          
          // Verify the access decision matches the role
          const shouldHaveAccess = role === 'admin' || role === 'collaborator';
          expect(hasAccess).toBe(shouldHaveAccess);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: rbac-integration, Property 9: Resource access by role**
   * **Validates: Requirements 5.1, 5.2, 5.3**
   *
   * For any resource and user, access SHALL be granted if:
   * (a) user is admin, OR
   * (b) user is collaborator and resource is shared, OR
   * (c) user owns the resource.
   */
  describe('Property 9: Resource access by role', () => {
    /**
     * Generator for resource access context
     */
    const resourceAccessContextArb: fc.Arbitrary<ResourceAccessContext> = fc.record({
      userRole: userRoleArb,
      userId: fc.uuid(),
      isShared: fc.boolean(),
      ownerId: fc.option(fc.uuid(), { nil: undefined }),
    });

    /**
     * Generator for context where user is the owner
     */
    const ownerContextArb: fc.Arbitrary<ResourceAccessContext> = fc.uuid().chain((userId) =>
      fc.record({
        userRole: userRoleArb,
        userId: fc.constant(userId),
        isShared: fc.boolean(),
        ownerId: fc.constant(userId),
      })
    );

    /**
     * Generator for context where user is NOT the owner
     */
    const nonOwnerContextArb: fc.Arbitrary<ResourceAccessContext> = fc
      .tuple(fc.uuid(), fc.uuid())
      .filter(([userId, ownerId]) => userId !== ownerId)
      .chain(([userId, ownerId]) =>
        fc.record({
          userRole: userRoleArb,
          userId: fc.constant(userId),
          isShared: fc.boolean(),
          ownerId: fc.constant(ownerId),
        })
      );

    it('should grant admin access to any resource', () => {
      fc.assert(
        fc.property(resourceAccessContextArb, (context) => {
          const adminContext: ResourceAccessContext = {
            ...context,
            userRole: 'admin',
          };
          expect(canAccessResource(adminContext)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should grant collaborator access to shared resources', () => {
      fc.assert(
        fc.property(resourceAccessContextArb, (context) => {
          const collaboratorSharedContext: ResourceAccessContext = {
            ...context,
            userRole: 'collaborator',
            isShared: true,
          };
          expect(canAccessResource(collaboratorSharedContext)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should deny collaborator access to non-shared resources they do not own', () => {
      fc.assert(
        fc.property(nonOwnerContextArb, (context) => {
          const collaboratorNonSharedContext: ResourceAccessContext = {
            ...context,
            userRole: 'collaborator',
            isShared: false,
          };
          expect(canAccessResource(collaboratorNonSharedContext)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should grant access to resource owner regardless of role', () => {
      fc.assert(
        fc.property(ownerContextArb, (context) => {
          // Owner should always have access to their own resource
          expect(canAccessResource(context)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should deny user role access to non-owned resources', () => {
      fc.assert(
        fc.property(nonOwnerContextArb, (context) => {
          const userNonOwnerContext: ResourceAccessContext = {
            ...context,
            userRole: 'user',
            isShared: false,
          };
          expect(canAccessResource(userNonOwnerContext)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should deny user role access to shared resources they do not own', () => {
      fc.assert(
        fc.property(nonOwnerContextArb, (context) => {
          const userSharedContext: ResourceAccessContext = {
            ...context,
            userRole: 'user',
            isShared: true,
          };
          // User role cannot access shared resources unless they own them
          expect(canAccessResource(userSharedContext)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly implement access rules for all role combinations', () => {
      fc.assert(
        fc.property(resourceAccessContextArb, (context) => {
          const result = canAccessResource(context);
          const { userRole, userId, isShared, ownerId } = context;

          // Calculate expected result based on access rules
          const isAdmin = userRole === 'admin';
          const isCollaboratorWithShared = userRole === 'collaborator' && isShared;
          const isOwner = ownerId !== undefined && userId === ownerId;

          const expected = isAdmin || isCollaboratorWithShared || isOwner;
          expect(result).toBe(expected);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle undefined ownerId correctly', () => {
      fc.assert(
        fc.property(userRoleArb, fc.uuid(), fc.boolean(), (userRole, userId, isShared) => {
          const context: ResourceAccessContext = {
            userRole,
            userId,
            isShared,
            ownerId: undefined,
          };

          const result = canAccessResource(context);

          // Without an owner, only admin or collaborator+shared can access
          if (userRole === 'admin') {
            expect(result).toBe(true);
          } else if (userRole === 'collaborator' && isShared) {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should handle default isShared value (false) correctly', () => {
      fc.assert(
        fc.property(userRoleArb, fc.uuid(), fc.option(fc.uuid(), { nil: undefined }), (userRole, userId, ownerId) => {
          const context: ResourceAccessContext = {
            userRole,
            userId,
            // isShared defaults to false when not provided
            ownerId,
          };

          const result = canAccessResource(context);

          // With isShared defaulting to false
          const isAdmin = userRole === 'admin';
          const isOwner = ownerId !== undefined && userId === ownerId;

          // Collaborator without shared access should be denied (unless owner)
          const expected = isAdmin || isOwner;
          expect(result).toBe(expected);
        }),
        { numRuns: 100 }
      );
    });

    it('should be deterministic for the same input', () => {
      fc.assert(
        fc.property(resourceAccessContextArb, fc.integer({ min: 1, max: 10 }), (context, iterations) => {
          const results: boolean[] = [];

          for (let i = 0; i < iterations; i++) {
            results.push(canAccessResource(context));
          }

          // All results should be identical
          const firstResult = results[0];
          expect(results.every((r) => r === firstResult)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });
});
