/**
 * Property-based tests for Question Assignment Service
 *
 * **Feature: question-assignment**
 *
 * These tests verify the correctness properties for the question assignment system
 * using fast-check for property-based testing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Mock Types (matching Prisma schema)
// ============================================================================

interface MockUser {
  id: string;
  email: string;
  name: string | null;
}

interface MockOrganizationUser {
  userId: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member';
}

interface MockQuestion {
  id: string;
  text: string;
  topic: string;
  referenceId: string | null;
  projectId: string;
  assignedTo: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockProject {
  id: string;
  organizationId: string;
}

// ============================================================================
// In-Memory Database Simulation
// ============================================================================

class MockDatabase {
  users: Map<string, MockUser> = new Map();
  organizationUsers: Map<string, MockOrganizationUser> = new Map();
  questions: Map<string, MockQuestion> = new Map();
  projects: Map<string, MockProject> = new Map();

  clear() {
    this.users.clear();
    this.organizationUsers.clear();
    this.questions.clear();
    this.projects.clear();
  }

  addUser(user: MockUser) {
    this.users.set(user.id, user);
  }

  addOrganizationUser(orgUser: MockOrganizationUser) {
    const key = `${orgUser.userId}_${orgUser.organizationId}`;
    this.organizationUsers.set(key, orgUser);
  }

  addQuestion(question: MockQuestion) {
    this.questions.set(question.id, question);
  }

  addProject(project: MockProject) {
    this.projects.set(project.id, project);
  }

  isUserInOrganization(userId: string, organizationId: string): boolean {
    const key = `${userId}_${organizationId}`;
    return this.organizationUsers.has(key);
  }

  getQuestion(questionId: string): MockQuestion | undefined {
    return this.questions.get(questionId);
  }

  getUser(userId: string): MockUser | undefined {
    return this.users.get(userId);
  }

  getProject(projectId: string): MockProject | undefined {
    return this.projects.get(projectId);
  }
}

// ============================================================================
// Service Implementation (Pure Functions for Testing)
// ============================================================================

/**
 * Validates that a user is a member of the specified organization
 */
function validateAssignee(
  db: MockDatabase,
  assigneeId: string,
  organizationId: string
): boolean {
  return db.isUserInOrganization(assigneeId, organizationId);
}

/**
 * Assigns a question to a user or unassigns it
 * Returns the updated question or throws an error
 */
function assignQuestion(
  db: MockDatabase,
  questionId: string,
  assigneeId: string | null,
  organizationId: string
): MockQuestion {
  const question = db.getQuestion(questionId);
  if (!question) {
    throw new Error('Question not found');
  }

  // Validate assignee is a member of the organization (if assigning)
  if (assigneeId !== null) {
    const isValidAssignee = validateAssignee(db, assigneeId, organizationId);
    if (!isValidAssignee) {
      throw new Error('User is not a member of this organization');
    }
  }

  // Update the question
  const updatedQuestion: MockQuestion = {
    ...question,
    assignedTo: assigneeId,
    updatedAt: new Date(),
  };
  db.questions.set(questionId, updatedQuestion);

  return updatedQuestion;
}

/**
 * Unassigns a question (sets assignedTo to null)
 */
function unassignQuestion(
  db: MockDatabase,
  questionId: string
): MockQuestion {
  const question = db.getQuestion(questionId);
  if (!question) {
    throw new Error('Question not found');
  }

  const updatedQuestion: MockQuestion = {
    ...question,
    assignedTo: null,
    updatedAt: new Date(),
  };
  db.questions.set(questionId, updatedQuestion);

  return updatedQuestion;
}

/**
 * Reassigns a question to a different user
 */
function reassignQuestion(
  db: MockDatabase,
  questionId: string,
  newAssigneeId: string,
  organizationId: string
): MockQuestion {
  return assignQuestion(db, questionId, newAssigneeId, organizationId);
}

// ============================================================================
// Generators
// ============================================================================

/**
 * Generator for valid user IDs (UUIDs)
 */
const userIdArb = fc.uuid();

/**
 * Generator for valid organization IDs (UUIDs)
 */
const organizationIdArb = fc.uuid();

/**
 * Generator for valid question IDs (CUIDs - simplified as UUIDs for testing)
 */
const questionIdArb = fc.uuid();

/**
 * Generator for valid project IDs (CUIDs - simplified as UUIDs for testing)
 */
const projectIdArb = fc.uuid();

/**
 * Generator for user email addresses
 */
const emailArb = fc.emailAddress();

/**
 * Generator for user names (optional)
 */
const nameArb = fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null });

/**
 * Generator for question text
 */
const questionTextArb = fc.string({ minLength: 1, maxLength: 500 });

/**
 * Generator for question topic
 */
const topicArb = fc.string({ minLength: 1, maxLength: 100 });

/**
 * Generator for organization roles
 */
const orgRoleArb = fc.constantFrom('owner', 'admin', 'member') as fc.Arbitrary<'owner' | 'admin' | 'member'>;

/**
 * Generator for a mock user
 */
const mockUserArb: fc.Arbitrary<MockUser> = fc.record({
  id: userIdArb,
  email: emailArb,
  name: nameArb,
});

/**
 * Generator for a mock question
 */
const mockQuestionArb: fc.Arbitrary<MockQuestion> = fc.record({
  id: questionIdArb,
  text: questionTextArb,
  topic: topicArb,
  referenceId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  projectId: projectIdArb,
  assignedTo: fc.constant(null) as fc.Arbitrary<string | null>,
  createdAt: fc.date(),
  updatedAt: fc.date(),
});

/**
 * Generator for two different organization IDs (guaranteed to be different)
 */
const differentOrgIdsArb: fc.Arbitrary<[string, string]> = fc
  .tuple(organizationIdArb, organizationIdArb)
  .filter(([a, b]) => a !== b);

/**
 * Generator for two different user IDs (guaranteed to be different)
 */
const differentUserIdsArb: fc.Arbitrary<[string, string]> = fc
  .tuple(userIdArb, userIdArb)
  .filter(([a, b]) => a !== b);

// ============================================================================
// Property Tests
// ============================================================================

describe('Question Assignment Property Tests', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  /**
   * **Feature: question-assignment, Property 1: Assignment stores correct user ID**
   * **Validates: Requirements 1.1**
   *
   * For any valid question and organization member, when an admin assigns the question
   * to that member, the question's assignedTo field SHALL equal the member's user ID.
   */
  describe('Property 1: Assignment stores correct user ID', () => {
    it('should store the exact user ID when assigning a question', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          mockUserArb,
          mockQuestionArb,
          projectIdArb,
          orgRoleArb,
          (orgId, user, question, projectId, role) => {
            db.clear();

            // Setup: User is in the organization
            db.addUser(user);
            db.addOrganizationUser({
              userId: user.id,
              organizationId: orgId,
              role,
            });

            // Setup: Question belongs to a project in the organization
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            const questionInOrg: MockQuestion = {
              ...question,
              projectId: project.id,
              assignedTo: null, // Initially unassigned
            };
            db.addQuestion(questionInOrg);

            // Act: Assign the question to the user
            const result = assignQuestion(db, questionInOrg.id, user.id, orgId);

            // Assert: The assignedTo field should exactly equal the user's ID
            expect(result.assignedTo).toBe(user.id);
            expect(result.assignedTo).toStrictEqual(user.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve user ID across multiple assignments to same user', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          mockUserArb,
          mockQuestionArb,
          projectIdArb,
          orgRoleArb,
          fc.integer({ min: 2, max: 5 }),
          (orgId, user, question, projectId, role, assignmentCount) => {
            db.clear();

            // Setup: User is in the organization
            db.addUser(user);
            db.addOrganizationUser({
              userId: user.id,
              organizationId: orgId,
              role,
            });

            // Setup: Question belongs to a project in the organization
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            const questionInOrg: MockQuestion = {
              ...question,
              projectId: project.id,
              assignedTo: null,
            };
            db.addQuestion(questionInOrg);

            // Act: Assign the question multiple times to the same user
            let result: MockQuestion = questionInOrg;
            for (let i = 0; i < assignmentCount; i++) {
              result = assignQuestion(db, questionInOrg.id, user.id, orgId);
            }

            // Assert: The assignedTo field should still exactly equal the user's ID
            expect(result.assignedTo).toBe(user.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should store correct user ID when assigning to different users sequentially', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          fc.array(mockUserArb, { minLength: 2, maxLength: 5 }),
          mockQuestionArb,
          projectIdArb,
          (orgId, users, question, projectId) => {
            db.clear();

            // Ensure unique user IDs
            const uniqueUsers = users.filter(
              (user, index, self) => self.findIndex(u => u.id === user.id) === index
            );
            if (uniqueUsers.length < 2) return; // Skip if not enough unique users

            // Setup: All users are in the organization
            for (const user of uniqueUsers) {
              db.addUser(user);
              db.addOrganizationUser({
                userId: user.id,
                organizationId: orgId,
                role: 'member',
              });
            }

            // Setup: Question belongs to a project in the organization
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            const questionInOrg: MockQuestion = {
              ...question,
              projectId: project.id,
              assignedTo: null,
            };
            db.addQuestion(questionInOrg);

            // Act & Assert: Assign to each user and verify the ID is stored correctly
            for (const user of uniqueUsers) {
              const result = assignQuestion(db, questionInOrg.id, user.id, orgId);
              expect(result.assignedTo).toBe(user.id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: question-assignment, Property 3: Assignment updates timestamp**
   * **Validates: Requirements 1.3**
   *
   * For any question assignment operation, the question's updatedAt timestamp
   * after assignment SHALL be greater than or equal to the timestamp before assignment.
   */
  describe('Property 3: Assignment updates timestamp', () => {
    it('should update timestamp when assigning a question', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          mockUserArb,
          mockQuestionArb,
          projectIdArb,
          orgRoleArb,
          (orgId, user, question, projectId, role) => {
            db.clear();

            // Setup: User in organization
            db.addUser(user);
            db.addOrganizationUser({
              userId: user.id,
              organizationId: orgId,
              role,
            });

            // Setup: Project and question with a known old timestamp
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            const oldTimestamp = new Date('2020-01-01T00:00:00Z');
            const questionWithOldTimestamp: MockQuestion = {
              ...question,
              projectId: project.id,
              assignedTo: null,
              updatedAt: oldTimestamp,
            };
            db.addQuestion(questionWithOldTimestamp);

            // Act: Assign the question
            const result = assignQuestion(db, questionWithOldTimestamp.id, user.id, orgId);

            // Assert: updatedAt should be greater than or equal to the old timestamp
            expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(oldTimestamp.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should update timestamp when unassigning a question', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          mockUserArb,
          mockQuestionArb,
          projectIdArb,
          orgRoleArb,
          (orgId, user, question, projectId, role) => {
            db.clear();

            // Setup: User in organization
            db.addUser(user);
            db.addOrganizationUser({
              userId: user.id,
              organizationId: orgId,
              role,
            });

            // Setup: Project and question assigned to user with old timestamp
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            const oldTimestamp = new Date('2020-01-01T00:00:00Z');
            const assignedQuestion: MockQuestion = {
              ...question,
              projectId: project.id,
              assignedTo: user.id,
              updatedAt: oldTimestamp,
            };
            db.addQuestion(assignedQuestion);

            // Act: Unassign the question
            const result = unassignQuestion(db, assignedQuestion.id);

            // Assert: updatedAt should be greater than or equal to the old timestamp
            expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(oldTimestamp.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should update timestamp when reassigning a question', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          differentUserIdsArb,
          mockQuestionArb,
          projectIdArb,
          (orgId, [userId1, userId2], question, projectId) => {
            db.clear();

            // Setup: Two users in the same organization
            const user1: MockUser = {
              id: userId1,
              email: `user1-${userId1.slice(0, 8)}@test.com`,
              name: 'User 1',
            };
            const user2: MockUser = {
              id: userId2,
              email: `user2-${userId2.slice(0, 8)}@test.com`,
              name: 'User 2',
            };

            db.addUser(user1);
            db.addUser(user2);
            db.addOrganizationUser({
              userId: user1.id,
              organizationId: orgId,
              role: 'member',
            });
            db.addOrganizationUser({
              userId: user2.id,
              organizationId: orgId,
              role: 'member',
            });

            // Setup: Project and question assigned to user1 with old timestamp
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            const oldTimestamp = new Date('2020-01-01T00:00:00Z');
            const questionAssignedToUser1: MockQuestion = {
              ...question,
              projectId: project.id,
              assignedTo: user1.id,
              updatedAt: oldTimestamp,
            };
            db.addQuestion(questionAssignedToUser1);

            // Act: Reassign to user2
            const result = reassignQuestion(db, questionAssignedToUser1.id, user2.id, orgId);

            // Assert: updatedAt should be greater than or equal to the old timestamp
            expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(oldTimestamp.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have monotonically increasing timestamps across multiple assignments', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          fc.array(mockUserArb, { minLength: 2, maxLength: 4 }),
          mockQuestionArb,
          projectIdArb,
          (orgId, users, question, projectId) => {
            db.clear();

            // Ensure unique user IDs
            const uniqueUsers = users.filter(
              (user, index, self) => self.findIndex(u => u.id === user.id) === index
            );
            if (uniqueUsers.length < 2) return; // Skip if not enough unique users

            // Setup: All users are in the organization
            for (const user of uniqueUsers) {
              db.addUser(user);
              db.addOrganizationUser({
                userId: user.id,
                organizationId: orgId,
                role: 'member',
              });
            }

            // Setup: Project and question
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            const initialTimestamp = new Date('2020-01-01T00:00:00Z');
            const questionInOrg: MockQuestion = {
              ...question,
              projectId: project.id,
              assignedTo: null,
              updatedAt: initialTimestamp,
            };
            db.addQuestion(questionInOrg);

            // Act & Assert: Assign to each user and verify timestamps are monotonically increasing
            let previousTimestamp = initialTimestamp;
            for (const user of uniqueUsers) {
              const result = assignQuestion(db, questionInOrg.id, user.id, orgId);
              expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(previousTimestamp.getTime());
              previousTimestamp = result.updatedAt;
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: question-assignment, Property 2: Cross-organization assignment rejection**
   * **Validates: Requirements 1.2**
   *
   * For any question in organization A and user in organization B (where A ≠ B),
   * attempting to assign the question to that user SHALL be rejected.
   */
  describe('Property 2: Cross-organization assignment rejection', () => {
    it('should reject assignment when user is in a different organization', () => {
      fc.assert(
        fc.property(
          differentOrgIdsArb,
          mockUserArb,
          mockQuestionArb,
          projectIdArb,
          orgRoleArb,
          ([orgA, orgB], user, question, projectId, role) => {
            db.clear();

            // Setup: User is in organization B
            db.addUser(user);
            db.addOrganizationUser({
              userId: user.id,
              organizationId: orgB,
              role,
            });

            // Setup: Question belongs to a project in organization A
            const project: MockProject = {
              id: projectId,
              organizationId: orgA,
            };
            db.addProject(project);

            const questionInOrgA: MockQuestion = {
              ...question,
              projectId: project.id,
            };
            db.addQuestion(questionInOrgA);

            // Act & Assert: Attempting to assign should throw
            expect(() => {
              assignQuestion(db, questionInOrgA.id, user.id, orgA);
            }).toThrow('User is not a member of this organization');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept assignment when user is in the same organization', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          mockUserArb,
          mockQuestionArb,
          projectIdArb,
          orgRoleArb,
          (orgId, user, question, projectId, role) => {
            db.clear();

            // Setup: User is in the same organization as the question
            db.addUser(user);
            db.addOrganizationUser({
              userId: user.id,
              organizationId: orgId,
              role,
            });

            // Setup: Question belongs to a project in the same organization
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            const questionInOrg: MockQuestion = {
              ...question,
              projectId: project.id,
            };
            db.addQuestion(questionInOrg);

            // Act: Assign the question
            const result = assignQuestion(db, questionInOrg.id, user.id, orgId);

            // Assert: Assignment should succeed
            expect(result.assignedTo).toBe(user.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject assignment for user not in any organization', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          mockUserArb,
          mockQuestionArb,
          projectIdArb,
          (orgId, user, question, projectId) => {
            db.clear();

            // Setup: User exists but is NOT in any organization
            db.addUser(user);
            // Note: NOT adding organizationUser entry

            // Setup: Question belongs to a project in an organization
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            const questionInOrg: MockQuestion = {
              ...question,
              projectId: project.id,
            };
            db.addQuestion(questionInOrg);

            // Act & Assert: Attempting to assign should throw
            expect(() => {
              assignQuestion(db, questionInOrg.id, user.id, orgId);
            }).toThrow('User is not a member of this organization');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: question-assignment, Property 5: Assignment modification correctness**
   * **Validates: Requirements 3.1, 3.2**
   *
   * For any assigned question:
   * - Unassigning SHALL set assignedTo to null
   * - Reassigning SHALL replace the previous assignee with the new one
   */
  describe('Property 5: Assignment modification correctness', () => {
    it('should set assignedTo to null when unassigning', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          mockUserArb,
          mockQuestionArb,
          projectIdArb,
          orgRoleArb,
          (orgId, user, question, projectId, role) => {
            db.clear();

            // Setup: User in organization
            db.addUser(user);
            db.addOrganizationUser({
              userId: user.id,
              organizationId: orgId,
              role,
            });

            // Setup: Project and question
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            const questionWithAssignment: MockQuestion = {
              ...question,
              projectId: project.id,
              assignedTo: user.id, // Initially assigned
            };
            db.addQuestion(questionWithAssignment);

            // Act: Unassign the question
            const result = unassignQuestion(db, questionWithAssignment.id);

            // Assert: assignedTo should be null
            expect(result.assignedTo).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should replace previous assignee when reassigning', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          differentUserIdsArb,
          mockQuestionArb,
          projectIdArb,
          orgRoleArb,
          orgRoleArb,
          (orgId, [userId1, userId2], question, projectId, role1, role2) => {
            db.clear();

            // Setup: Two users in the same organization
            const user1: MockUser = {
              id: userId1,
              email: `user1-${userId1.slice(0, 8)}@test.com`,
              name: 'User 1',
            };
            const user2: MockUser = {
              id: userId2,
              email: `user2-${userId2.slice(0, 8)}@test.com`,
              name: 'User 2',
            };

            db.addUser(user1);
            db.addUser(user2);
            db.addOrganizationUser({
              userId: user1.id,
              organizationId: orgId,
              role: role1,
            });
            db.addOrganizationUser({
              userId: user2.id,
              organizationId: orgId,
              role: role2,
            });

            // Setup: Project and question assigned to user1
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            const questionAssignedToUser1: MockQuestion = {
              ...question,
              projectId: project.id,
              assignedTo: user1.id,
            };
            db.addQuestion(questionAssignedToUser1);

            // Act: Reassign to user2
            const result = reassignQuestion(db, questionAssignedToUser1.id, user2.id, orgId);

            // Assert: assignedTo should be user2.id
            expect(result.assignedTo).toBe(user2.id);
            expect(result.assignedTo).not.toBe(user1.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow reassigning to the same user (idempotent)', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          mockUserArb,
          mockQuestionArb,
          projectIdArb,
          orgRoleArb,
          (orgId, user, question, projectId, role) => {
            db.clear();

            // Setup: User in organization
            db.addUser(user);
            db.addOrganizationUser({
              userId: user.id,
              organizationId: orgId,
              role,
            });

            // Setup: Project and question already assigned to user
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            const questionAssigned: MockQuestion = {
              ...question,
              projectId: project.id,
              assignedTo: user.id,
            };
            db.addQuestion(questionAssigned);

            // Act: Reassign to the same user
            const result = reassignQuestion(db, questionAssigned.id, user.id, orgId);

            // Assert: assignedTo should still be the same user
            expect(result.assignedTo).toBe(user.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow unassigning an already unassigned question (idempotent)', () => {
      fc.assert(
        fc.property(
          mockQuestionArb,
          projectIdArb,
          organizationIdArb,
          (question, projectId, orgId) => {
            db.clear();

            // Setup: Project and unassigned question
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            const unassignedQuestion: MockQuestion = {
              ...question,
              projectId: project.id,
              assignedTo: null,
            };
            db.addQuestion(unassignedQuestion);

            // Act: Unassign the already unassigned question
            const result = unassignQuestion(db, unassignedQuestion.id);

            // Assert: assignedTo should still be null
            expect(result.assignedTo).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should update timestamp when modifying assignment', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          mockUserArb,
          mockQuestionArb,
          projectIdArb,
          orgRoleArb,
          (orgId, user, question, projectId, role) => {
            db.clear();

            // Setup: User in organization
            db.addUser(user);
            db.addOrganizationUser({
              userId: user.id,
              organizationId: orgId,
              role,
            });

            // Setup: Project and question with old timestamp
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            const oldDate = new Date('2020-01-01');
            const questionWithOldTimestamp: MockQuestion = {
              ...question,
              projectId: project.id,
              assignedTo: null,
              updatedAt: oldDate,
            };
            db.addQuestion(questionWithOldTimestamp);

            // Act: Assign the question
            const result = assignQuestion(db, questionWithOldTimestamp.id, user.id, orgId);

            // Assert: updatedAt should be updated (greater than or equal to old date)
            expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(oldDate.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: question-assignment, Property 4: Assignee filtering correctness**
   * **Validates: Requirements 2.1, 2.2, 2.3**
   *
   * For any set of questions with various assignees:
   * - Filtering by a specific assignee SHALL return exactly the questions assigned to that user
   * - Filtering by "me" SHALL return questions assigned to the current user
   * - No filter SHALL return all questions
   */
  describe('Property 4: Assignee filtering correctness', () => {
    /**
     * Filter questions by assignee (simulates projectService.getQuestions with filter)
     */
    function filterQuestionsByAssignee(
      db: MockDatabase,
      projectId: string,
      assigneeFilter?: string | null
    ): MockQuestion[] {
      const allQuestions = Array.from(db.questions.values()).filter(
        q => q.projectId === projectId
      );

      if (assigneeFilter === undefined) {
        // No filter - return all questions
        return allQuestions;
      }

      // Filter by specific assignee (null means unassigned)
      return allQuestions.filter(q => q.assignedTo === assigneeFilter);
    }

    it('should return only questions assigned to specific user when filtering by user ID', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          fc.array(mockUserArb, { minLength: 2, maxLength: 5 }),
          fc.array(mockQuestionArb, { minLength: 3, maxLength: 10 }),
          projectIdArb,
          (orgId, users, questions, projectId) => {
            db.clear();

            // Ensure unique user IDs
            const uniqueUsers = users.filter(
              (user, index, self) => self.findIndex(u => u.id === user.id) === index
            );
            if (uniqueUsers.length < 2) return;

            // Setup: Add users to organization
            for (const user of uniqueUsers) {
              db.addUser(user);
              db.addOrganizationUser({
                userId: user.id,
                organizationId: orgId,
                role: 'member',
              });
            }

            // Setup: Add project
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            // Setup: Add questions with various assignees
            const questionsWithAssignees = questions.map((q, index) => {
              // Assign some questions to different users, leave some unassigned
              const assigneeIndex = index % (uniqueUsers.length + 1);
              const assignedTo = assigneeIndex < uniqueUsers.length 
                ? uniqueUsers[assigneeIndex].id 
                : null;
              
              return {
                ...q,
                id: `${q.id}_${index}`, // Ensure unique IDs
                projectId: project.id,
                assignedTo,
              };
            });

            for (const q of questionsWithAssignees) {
              db.addQuestion(q);
            }

            // Act & Assert: Filter by each user and verify results
            for (const user of uniqueUsers) {
              const filtered = filterQuestionsByAssignee(db, projectId, user.id);
              const expectedQuestions = questionsWithAssignees.filter(
                q => q.assignedTo === user.id
              );

              // All returned questions should be assigned to the filtered user
              expect(filtered.every(q => q.assignedTo === user.id)).toBe(true);
              // Count should match expected
              expect(filtered.length).toBe(expectedQuestions.length);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all questions when no filter is provided', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          fc.array(mockUserArb, { minLength: 1, maxLength: 3 }),
          fc.array(mockQuestionArb, { minLength: 2, maxLength: 8 }),
          projectIdArb,
          (orgId, users, questions, projectId) => {
            db.clear();

            // Ensure unique user IDs
            const uniqueUsers = users.filter(
              (user, index, self) => self.findIndex(u => u.id === user.id) === index
            );

            // Setup: Add users to organization
            for (const user of uniqueUsers) {
              db.addUser(user);
              db.addOrganizationUser({
                userId: user.id,
                organizationId: orgId,
                role: 'member',
              });
            }

            // Setup: Add project
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            // Setup: Add questions with various assignees
            const questionsWithAssignees = questions.map((q, index) => {
              const assigneeIndex = index % (uniqueUsers.length + 1);
              const assignedTo = assigneeIndex < uniqueUsers.length 
                ? uniqueUsers[assigneeIndex].id 
                : null;
              
              return {
                ...q,
                id: `${q.id}_${index}`,
                projectId: project.id,
                assignedTo,
              };
            });

            for (const q of questionsWithAssignees) {
              db.addQuestion(q);
            }

            // Act: Get all questions without filter
            const allFiltered = filterQuestionsByAssignee(db, projectId, undefined);

            // Assert: Should return all questions for the project
            expect(allFiltered.length).toBe(questionsWithAssignees.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return only unassigned questions when filtering by null', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          fc.array(mockUserArb, { minLength: 1, maxLength: 3 }),
          fc.array(mockQuestionArb, { minLength: 3, maxLength: 10 }),
          projectIdArb,
          (orgId, users, questions, projectId) => {
            db.clear();

            // Ensure unique user IDs
            const uniqueUsers = users.filter(
              (user, index, self) => self.findIndex(u => u.id === user.id) === index
            );

            // Setup: Add users to organization
            for (const user of uniqueUsers) {
              db.addUser(user);
              db.addOrganizationUser({
                userId: user.id,
                organizationId: orgId,
                role: 'member',
              });
            }

            // Setup: Add project
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            // Setup: Add questions - ensure some are unassigned
            const questionsWithAssignees = questions.map((q, index) => {
              // Make every third question unassigned
              const assignedTo = index % 3 === 0 
                ? null 
                : uniqueUsers[index % uniqueUsers.length].id;
              
              return {
                ...q,
                id: `${q.id}_${index}`,
                projectId: project.id,
                assignedTo,
              };
            });

            for (const q of questionsWithAssignees) {
              db.addQuestion(q);
            }

            // Act: Filter for unassigned questions
            const unassignedFiltered = filterQuestionsByAssignee(db, projectId, null);
            const expectedUnassigned = questionsWithAssignees.filter(
              q => q.assignedTo === null
            );

            // Assert: All returned questions should be unassigned
            expect(unassignedFiltered.every(q => q.assignedTo === null)).toBe(true);
            expect(unassignedFiltered.length).toBe(expectedUnassigned.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array when filtering by user with no assignments', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          differentUserIdsArb,
          fc.array(mockQuestionArb, { minLength: 1, maxLength: 5 }),
          projectIdArb,
          (orgId, [userId1, userId2], questions, projectId) => {
            db.clear();

            // Setup: Two users in organization
            const user1: MockUser = {
              id: userId1,
              email: `user1-${userId1.slice(0, 8)}@test.com`,
              name: 'User 1',
            };
            const user2: MockUser = {
              id: userId2,
              email: `user2-${userId2.slice(0, 8)}@test.com`,
              name: 'User 2',
            };

            db.addUser(user1);
            db.addUser(user2);
            db.addOrganizationUser({
              userId: user1.id,
              organizationId: orgId,
              role: 'member',
            });
            db.addOrganizationUser({
              userId: user2.id,
              organizationId: orgId,
              role: 'member',
            });

            // Setup: Add project
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            // Setup: All questions assigned to user1 only
            const questionsAssignedToUser1 = questions.map((q, index) => ({
              ...q,
              id: `${q.id}_${index}`,
              projectId: project.id,
              assignedTo: user1.id,
            }));

            for (const q of questionsAssignedToUser1) {
              db.addQuestion(q);
            }

            // Act: Filter by user2 (who has no assignments)
            const user2Filtered = filterQuestionsByAssignee(db, projectId, user2.id);

            // Assert: Should return empty array
            expect(user2Filtered.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: question-assignment, Property 7: Question serialization includes assignee**
   * **Validates: Requirements 4.1, 4.2, 4.3**
   *
   * For any question:
   * - The serialized JSON SHALL include assignee details (id, name, email) when assigned
   * - The serialized JSON SHALL indicate unassigned status when not assigned
   */
  describe('Property 7: Question serialization includes assignee', () => {
    /**
     * Serialize a question with assignee details (simulates API response format)
     */
    interface SerializedQuestion {
      id: string;
      question: string;
      assignee: {
        id: string;
        name: string | null;
        email: string;
      } | null;
    }

    function serializeQuestion(
      db: MockDatabase,
      question: MockQuestion
    ): SerializedQuestion {
      const assignee = question.assignedTo 
        ? db.getUser(question.assignedTo) 
        : null;

      return {
        id: question.id,
        question: question.text,
        assignee: assignee ? {
          id: assignee.id,
          name: assignee.name,
          email: assignee.email,
        } : null,
      };
    }

    it('should include assignee details when question is assigned', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          mockUserArb,
          mockQuestionArb,
          projectIdArb,
          orgRoleArb,
          (orgId, user, question, projectId, role) => {
            db.clear();

            // Setup: User in organization
            db.addUser(user);
            db.addOrganizationUser({
              userId: user.id,
              organizationId: orgId,
              role,
            });

            // Setup: Project and assigned question
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            const assignedQuestion: MockQuestion = {
              ...question,
              projectId: project.id,
              assignedTo: user.id,
            };
            db.addQuestion(assignedQuestion);

            // Act: Serialize the question
            const serialized = serializeQuestion(db, assignedQuestion);

            // Assert: Assignee details should be present
            expect(serialized.assignee).not.toBeNull();
            expect(serialized.assignee?.id).toBe(user.id);
            expect(serialized.assignee?.name).toBe(user.name);
            expect(serialized.assignee?.email).toBe(user.email);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have null assignee when question is unassigned', () => {
      fc.assert(
        fc.property(
          mockQuestionArb,
          projectIdArb,
          organizationIdArb,
          (question, projectId, orgId) => {
            db.clear();

            // Setup: Project and unassigned question
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            const unassignedQuestion: MockQuestion = {
              ...question,
              projectId: project.id,
              assignedTo: null,
            };
            db.addQuestion(unassignedQuestion);

            // Act: Serialize the question
            const serialized = serializeQuestion(db, unassignedQuestion);

            // Assert: Assignee should be null
            expect(serialized.assignee).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve assignee details through serialization round-trip', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          mockUserArb,
          mockQuestionArb,
          projectIdArb,
          orgRoleArb,
          (orgId, user, question, projectId, role) => {
            db.clear();

            // Setup: User in organization
            db.addUser(user);
            db.addOrganizationUser({
              userId: user.id,
              organizationId: orgId,
              role,
            });

            // Setup: Project and assigned question
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            const assignedQuestion: MockQuestion = {
              ...question,
              projectId: project.id,
              assignedTo: user.id,
            };
            db.addQuestion(assignedQuestion);

            // Act: Serialize to JSON and parse back
            const serialized = serializeQuestion(db, assignedQuestion);
            const jsonString = JSON.stringify(serialized);
            const parsed = JSON.parse(jsonString) as SerializedQuestion;

            // Assert: Assignee details should be preserved
            expect(parsed.assignee).not.toBeNull();
            expect(parsed.assignee?.id).toBe(user.id);
            expect(parsed.assignee?.name).toBe(user.name);
            expect(parsed.assignee?.email).toBe(user.email);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all required assignee fields in serialized output', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          mockUserArb,
          mockQuestionArb,
          projectIdArb,
          orgRoleArb,
          (orgId, user, question, projectId, role) => {
            db.clear();

            // Setup: User in organization
            db.addUser(user);
            db.addOrganizationUser({
              userId: user.id,
              organizationId: orgId,
              role,
            });

            // Setup: Project and assigned question
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            const assignedQuestion: MockQuestion = {
              ...question,
              projectId: project.id,
              assignedTo: user.id,
            };
            db.addQuestion(assignedQuestion);

            // Act: Serialize the question
            const serialized = serializeQuestion(db, assignedQuestion);

            // Assert: All required fields should be present
            expect(serialized).toHaveProperty('id');
            expect(serialized).toHaveProperty('question');
            expect(serialized).toHaveProperty('assignee');
            
            if (serialized.assignee) {
              expect(serialized.assignee).toHaveProperty('id');
              expect(serialized.assignee).toHaveProperty('name');
              expect(serialized.assignee).toHaveProperty('email');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: question-assignment, Property 8: Assignment statistics accuracy**
   * **Validates: Requirements 5.1, 5.2, 5.3**
   *
   * For any project:
   * - The assignment statistics SHALL accurately reflect the count of questions per assignee
   * - The statistics SHALL include unassigned questions count
   * - The statistics SHALL show zero counts for members with no assignments
   */
  describe('Property 8: Assignment statistics accuracy', () => {
    /**
     * Calculate assignment statistics for a project (simulates getAssignmentStats)
     */
    interface AssignmentStats {
      totalQuestions: number;
      unassignedCount: number;
      assignmentsByUser: {
        userId: string;
        userName: string | null;
        userEmail: string;
        count: number;
      }[];
    }

    function getAssignmentStats(
      db: MockDatabase,
      projectId: string
    ): AssignmentStats {
      const project = db.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Get all questions for the project
      const questions = Array.from(db.questions.values()).filter(
        q => q.projectId === projectId
      );

      const totalQuestions = questions.length;
      const unassignedCount = questions.filter(q => q.assignedTo === null).length;

      // Get all organization members
      const orgMembers = Array.from(db.organizationUsers.values())
        .filter(ou => ou.organizationId === project.organizationId)
        .map(ou => {
          const user = db.getUser(ou.userId);
          return user ? { ...user, orgUserId: ou.userId } : null;
        })
        .filter((u): u is MockUser & { orgUserId: string } => u !== null);

      // Count assignments per user
      const assignmentCounts = new Map<string, number>();
      for (const question of questions) {
        if (question.assignedTo) {
          const currentCount = assignmentCounts.get(question.assignedTo) || 0;
          assignmentCounts.set(question.assignedTo, currentCount + 1);
        }
      }

      // Build the assignments by user array (including members with zero assignments)
      const assignmentsByUser = orgMembers.map(member => ({
        userId: member.id,
        userName: member.name,
        userEmail: member.email,
        count: assignmentCounts.get(member.id) || 0,
      }));

      return {
        totalQuestions,
        unassignedCount,
        assignmentsByUser,
      };
    }

    it('should accurately count total questions in project', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          fc.array(mockQuestionArb, { minLength: 0, maxLength: 20 }),
          projectIdArb,
          (orgId, questions, projectId) => {
            db.clear();

            // Setup: Add project
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            // Setup: Add questions to project
            const projectQuestions = questions.map((q, index) => ({
              ...q,
              id: `${q.id}_${index}`,
              projectId: project.id,
              assignedTo: null,
            }));

            for (const q of projectQuestions) {
              db.addQuestion(q);
            }

            // Act: Get stats
            const stats = getAssignmentStats(db, projectId);

            // Assert: Total should match number of questions added
            expect(stats.totalQuestions).toBe(projectQuestions.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accurately count unassigned questions', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          fc.array(mockUserArb, { minLength: 1, maxLength: 3 }),
          fc.array(mockQuestionArb, { minLength: 3, maxLength: 15 }),
          projectIdArb,
          (orgId, users, questions, projectId) => {
            db.clear();

            // Ensure unique user IDs
            const uniqueUsers = users.filter(
              (user, index, self) => self.findIndex(u => u.id === user.id) === index
            );

            // Setup: Add users to organization
            for (const user of uniqueUsers) {
              db.addUser(user);
              db.addOrganizationUser({
                userId: user.id,
                organizationId: orgId,
                role: 'member',
              });
            }

            // Setup: Add project
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            // Setup: Add questions - some assigned, some not
            const projectQuestions = questions.map((q, index) => {
              // Make every third question unassigned
              const assignedTo = index % 3 === 0 
                ? null 
                : uniqueUsers[index % uniqueUsers.length].id;
              
              return {
                ...q,
                id: `${q.id}_${index}`,
                projectId: project.id,
                assignedTo,
              };
            });

            for (const q of projectQuestions) {
              db.addQuestion(q);
            }

            // Calculate expected unassigned count
            const expectedUnassigned = projectQuestions.filter(q => q.assignedTo === null).length;

            // Act: Get stats
            const stats = getAssignmentStats(db, projectId);

            // Assert: Unassigned count should match
            expect(stats.unassignedCount).toBe(expectedUnassigned);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accurately count assignments per user', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          fc.array(mockUserArb, { minLength: 2, maxLength: 5 }),
          fc.array(mockQuestionArb, { minLength: 5, maxLength: 20 }),
          projectIdArb,
          (orgId, users, questions, projectId) => {
            db.clear();

            // Ensure unique user IDs
            const uniqueUsers = users.filter(
              (user, index, self) => self.findIndex(u => u.id === user.id) === index
            );
            if (uniqueUsers.length < 2) return;

            // Setup: Add users to organization
            for (const user of uniqueUsers) {
              db.addUser(user);
              db.addOrganizationUser({
                userId: user.id,
                organizationId: orgId,
                role: 'member',
              });
            }

            // Setup: Add project
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            // Setup: Add questions with various assignees
            const projectQuestions = questions.map((q, index) => {
              const assigneeIndex = index % (uniqueUsers.length + 1);
              const assignedTo = assigneeIndex < uniqueUsers.length 
                ? uniqueUsers[assigneeIndex].id 
                : null;
              
              return {
                ...q,
                id: `${q.id}_${index}`,
                projectId: project.id,
                assignedTo,
              };
            });

            for (const q of projectQuestions) {
              db.addQuestion(q);
            }

            // Calculate expected counts per user
            const expectedCounts = new Map<string, number>();
            for (const user of uniqueUsers) {
              expectedCounts.set(user.id, 0);
            }
            for (const q of projectQuestions) {
              if (q.assignedTo && expectedCounts.has(q.assignedTo)) {
                expectedCounts.set(q.assignedTo, expectedCounts.get(q.assignedTo)! + 1);
              }
            }

            // Act: Get stats
            const stats = getAssignmentStats(db, projectId);

            // Assert: Each user's count should match expected
            for (const userStat of stats.assignmentsByUser) {
              const expectedCount = expectedCounts.get(userStat.userId) || 0;
              expect(userStat.count).toBe(expectedCount);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all organization members even with zero assignments', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          fc.array(mockUserArb, { minLength: 2, maxLength: 5 }),
          fc.array(mockQuestionArb, { minLength: 1, maxLength: 5 }),
          projectIdArb,
          (orgId, users, questions, projectId) => {
            db.clear();

            // Ensure unique user IDs
            const uniqueUsers = users.filter(
              (user, index, self) => self.findIndex(u => u.id === user.id) === index
            );
            if (uniqueUsers.length < 2) return;

            // Setup: Add users to organization
            for (const user of uniqueUsers) {
              db.addUser(user);
              db.addOrganizationUser({
                userId: user.id,
                organizationId: orgId,
                role: 'member',
              });
            }

            // Setup: Add project
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            // Setup: Assign ALL questions to ONLY the first user
            const projectQuestions = questions.map((q, index) => ({
              ...q,
              id: `${q.id}_${index}`,
              projectId: project.id,
              assignedTo: uniqueUsers[0].id, // All to first user
            }));

            for (const q of projectQuestions) {
              db.addQuestion(q);
            }

            // Act: Get stats
            const stats = getAssignmentStats(db, projectId);

            // Assert: All organization members should be in the stats
            const statUserIds = stats.assignmentsByUser.map(s => s.userId);
            for (const user of uniqueUsers) {
              expect(statUserIds).toContain(user.id);
            }

            // Assert: Users without assignments should have count of 0
            for (const userStat of stats.assignmentsByUser) {
              if (userStat.userId !== uniqueUsers[0].id) {
                expect(userStat.count).toBe(0);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should show zero for member with no assigned questions (Requirement 5.3)', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          differentUserIdsArb,
          fc.array(mockQuestionArb, { minLength: 1, maxLength: 10 }),
          projectIdArb,
          (orgId, [userId1, userId2], questions, projectId) => {
            db.clear();

            // Setup: Two users in organization
            const user1: MockUser = {
              id: userId1,
              email: `user1-${userId1.slice(0, 8)}@test.com`,
              name: 'User 1',
            };
            const user2: MockUser = {
              id: userId2,
              email: `user2-${userId2.slice(0, 8)}@test.com`,
              name: 'User 2',
            };

            db.addUser(user1);
            db.addUser(user2);
            db.addOrganizationUser({
              userId: user1.id,
              organizationId: orgId,
              role: 'member',
            });
            db.addOrganizationUser({
              userId: user2.id,
              organizationId: orgId,
              role: 'member',
            });

            // Setup: Add project
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            // Setup: All questions assigned to user1 only
            const projectQuestions = questions.map((q, index) => ({
              ...q,
              id: `${q.id}_${index}`,
              projectId: project.id,
              assignedTo: user1.id,
            }));

            for (const q of projectQuestions) {
              db.addQuestion(q);
            }

            // Act: Get stats
            const stats = getAssignmentStats(db, projectId);

            // Assert: User2 should have count of 0
            const user2Stat = stats.assignmentsByUser.find(s => s.userId === user2.id);
            expect(user2Stat).toBeDefined();
            expect(user2Stat?.count).toBe(0);

            // Assert: User1 should have all questions
            const user1Stat = stats.assignmentsByUser.find(s => s.userId === user1.id);
            expect(user1Stat).toBeDefined();
            expect(user1Stat?.count).toBe(projectQuestions.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have totalQuestions equal to unassignedCount plus sum of all user counts', () => {
      fc.assert(
        fc.property(
          organizationIdArb,
          fc.array(mockUserArb, { minLength: 1, maxLength: 4 }),
          fc.array(mockQuestionArb, { minLength: 1, maxLength: 15 }),
          projectIdArb,
          (orgId, users, questions, projectId) => {
            db.clear();

            // Ensure unique user IDs
            const uniqueUsers = users.filter(
              (user, index, self) => self.findIndex(u => u.id === user.id) === index
            );

            // Setup: Add users to organization
            for (const user of uniqueUsers) {
              db.addUser(user);
              db.addOrganizationUser({
                userId: user.id,
                organizationId: orgId,
                role: 'member',
              });
            }

            // Setup: Add project
            const project: MockProject = {
              id: projectId,
              organizationId: orgId,
            };
            db.addProject(project);

            // Setup: Add questions with various assignees
            const projectQuestions = questions.map((q, index) => {
              const assigneeIndex = index % (uniqueUsers.length + 1);
              const assignedTo = assigneeIndex < uniqueUsers.length 
                ? uniqueUsers[assigneeIndex].id 
                : null;
              
              return {
                ...q,
                id: `${q.id}_${index}`,
                projectId: project.id,
                assignedTo,
              };
            });

            for (const q of projectQuestions) {
              db.addQuestion(q);
            }

            // Act: Get stats
            const stats = getAssignmentStats(db, projectId);

            // Assert: totalQuestions = unassignedCount + sum of all user counts
            const sumOfUserCounts = stats.assignmentsByUser.reduce(
              (sum, userStat) => sum + userStat.count, 
              0
            );
            expect(stats.totalQuestions).toBe(stats.unassignedCount + sumOfUserCounts);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
