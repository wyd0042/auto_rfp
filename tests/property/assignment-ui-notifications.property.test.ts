/**
 * Property-based tests for Assignment UI and Email Notifications
 *
 * **Feature: assignment-ui-notifications**
 *
 * These tests verify the correctness properties for the assignment notification system
 * using fast-check for property-based testing.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  buildQuestionUrl,
  buildEmailContent,
  AssignmentNotificationData,
} from '@/lib/services/assignment-notification-service';
import {
  getAssigneeBadgeDisplayText,
  getAssigneeBadgeTooltipContent,
  AssigneeInfo,
} from '@/app/projects/[projectId]/questions/components/assignee-badge';
import {
  getMemberDisplayText,
  getAssignmentUserId,
  shouldShowUnassignOption,
  OrganizationMember,
} from '@/app/projects/[projectId]/questions/components/assignee-dropdown';
import {
  filterQuestionsByAssignee,
  AssigneeFilterType,
} from '@/app/projects/[projectId]/questions/components/assignee-filter';
import {
  computeAssignmentStats,
  validateAssignmentStats,
  QuestionForStats,
  MemberForStats,
} from '@/app/projects/components/question-navigator';

// ============================================================================
// Generators
// ============================================================================

/**
 * Generator for valid UUIDs (used for project and question IDs)
 */
const uuidArb = fc.uuid();

/**
 * Generator for valid email addresses
 */
const emailArb = fc.emailAddress();

/**
 * Generator for user names (optional, can be null)
 */
const nameArb = fc.option(
  fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  { nil: null }
);

/**
 * Generator for non-empty strings (for names that must exist)
 */
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

/**
 * Generator for question text (non-empty)
 */
const questionTextArb = fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0);

/**
 * Generator for project names (non-empty)
 */
const projectNameArb = fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0);

/**
 * Generator for AssigneeInfo (for badge testing)
 */
const assigneeInfoArb: fc.Arbitrary<AssigneeInfo> = fc.record({
  id: uuidArb,
  name: nameArb,
  email: emailArb,
});

/**
 * Generator for AssigneeInfo or null (for badge testing with unassigned state)
 */
const assigneeOrNullArb: fc.Arbitrary<AssigneeInfo | null> = fc.option(assigneeInfoArb, { nil: null });

/**
 * Generator for organization member roles
 */
const roleArb = fc.constantFrom('owner', 'admin', 'member');

/**
 * Generator for OrganizationMember (for dropdown testing)
 */
const organizationMemberArb: fc.Arbitrary<OrganizationMember> = fc.record({
  userId: uuidArb,
  name: nameArb,
  email: emailArb,
  role: roleArb,
});

/**
 * Generator for a list of organization members (non-empty)
 */
const organizationMembersListArb: fc.Arbitrary<OrganizationMember[]> = fc.array(
  organizationMemberArb,
  { minLength: 1, maxLength: 20 }
);

/**
 * Generator for AssigneeFilterType
 */
const assigneeFilterTypeArb: fc.Arbitrary<AssigneeFilterType> = fc.constantFrom('all', 'me', 'unassigned');

/**
 * Generator for a question with optional assignee
 */
interface QuestionWithAssignee {
  id: string;
  question: string;
  assignee: { id: string } | null;
}

const questionWithAssigneeArb: fc.Arbitrary<QuestionWithAssignee> = fc.record({
  id: uuidArb,
  question: questionTextArb,
  assignee: fc.option(fc.record({ id: uuidArb }), { nil: null }),
});

/**
 * Generator for a list of questions with assignees
 */
const questionsListArb: fc.Arbitrary<QuestionWithAssignee[]> = fc.array(
  questionWithAssigneeArb,
  { minLength: 0, maxLength: 50 }
);

/**
 * Generator for AssignmentNotificationData
 */
const notificationDataArb: fc.Arbitrary<AssignmentNotificationData> = fc.record({
  assigneeEmail: emailArb,
  assigneeName: nameArb,
  assignerName: nonEmptyStringArb,
  questionText: questionTextArb,
  questionId: uuidArb,
  projectId: uuidArb,
  projectName: projectNameArb,
});

// ============================================================================
// Property Tests
// ============================================================================

describe('Assignment UI and Email Notifications Property Tests', () => {
  /**
   * **Feature: assignment-ui-notifications, Property 4: Email content completeness**
   * **Validates: Requirements 4.2, 4.3, 4.4, 4.5**
   *
   * For any assignment notification, the email SHALL contain:
   * - The question text (Requirement 4.2)
   * - A direct link to the question (Requirement 4.3)
   * - The project name (Requirement 4.4)
   * - The assigner's name (Requirement 4.5)
   */
  describe('Property 4: Email content completeness', () => {
    it('should include question text in email body', () => {
      fc.assert(
        fc.property(notificationDataArb, (data) => {
          const emailContent = buildEmailContent(data);

          // For short questions, the full text should be present
          // For long questions (>500 chars), at least the first 500 chars should be present
          const expectedText = data.questionText.length > 500
            ? data.questionText.substring(0, 500)
            : data.questionText;

          // Check HTML body contains the question text
          expect(emailContent.htmlBody).toContain(expectedText);

          // Check text body contains the question text
          expect(emailContent.textBody).toContain(expectedText);
        }),
        { numRuns: 100 }
      );
    });

    it('should include a valid direct link to the question', () => {
      fc.assert(
        fc.property(notificationDataArb, (data) => {
          const emailContent = buildEmailContent(data);
          const expectedUrl = buildQuestionUrl(data.projectId, data.questionId);

          // Check HTML body contains the URL
          expect(emailContent.htmlBody).toContain(expectedUrl);

          // Check text body contains the URL
          expect(emailContent.textBody).toContain(expectedUrl);

          // Verify URL structure
          expect(expectedUrl).toContain(`/projects/${data.projectId}/questions`);
          expect(expectedUrl).toContain(`questionId=${data.questionId}`);
        }),
        { numRuns: 100 }
      );
    });

    it('should include project name in email', () => {
      fc.assert(
        fc.property(notificationDataArb, (data) => {
          const emailContent = buildEmailContent(data);

          // Check subject contains project name
          expect(emailContent.subject).toContain(data.projectName);

          // Check HTML body contains project name
          expect(emailContent.htmlBody).toContain(data.projectName);

          // Check text body contains project name
          expect(emailContent.textBody).toContain(data.projectName);
        }),
        { numRuns: 100 }
      );
    });

    it('should include assigner name in email body', () => {
      fc.assert(
        fc.property(notificationDataArb, (data) => {
          const emailContent = buildEmailContent(data);

          // Check HTML body contains assigner name
          expect(emailContent.htmlBody).toContain(data.assignerName);

          // Check text body contains assigner name
          expect(emailContent.textBody).toContain(data.assignerName);
        }),
        { numRuns: 100 }
      );
    });

    it('should produce valid email structure with all required fields', () => {
      fc.assert(
        fc.property(notificationDataArb, (data) => {
          const emailContent = buildEmailContent(data);

          // Verify email content structure
          expect(emailContent).toHaveProperty('subject');
          expect(emailContent).toHaveProperty('htmlBody');
          expect(emailContent).toHaveProperty('textBody');

          // Subject should be non-empty
          expect(emailContent.subject.length).toBeGreaterThan(0);

          // HTML body should be non-empty and contain HTML tags
          expect(emailContent.htmlBody.length).toBeGreaterThan(0);
          expect(emailContent.htmlBody).toContain('<html');
          expect(emailContent.htmlBody).toContain('</html>');

          // Text body should be non-empty
          expect(emailContent.textBody.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle assignee name being null gracefully', () => {
      fc.assert(
        fc.property(
          fc.record({
            assigneeEmail: emailArb,
            assigneeName: fc.constant(null),
            assignerName: nonEmptyStringArb,
            questionText: questionTextArb,
            questionId: uuidArb,
            projectId: uuidArb,
            projectName: projectNameArb,
          }),
          (data) => {
            const emailContent = buildEmailContent(data);

            // Should not throw and should produce valid content
            expect(emailContent.subject.length).toBeGreaterThan(0);
            expect(emailContent.htmlBody.length).toBeGreaterThan(0);
            expect(emailContent.textBody.length).toBeGreaterThan(0);

            // Should use a fallback name like "Team Member"
            expect(emailContent.htmlBody).toContain('Team Member');
            expect(emailContent.textBody).toContain('Team Member');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should truncate very long question text appropriately', () => {
      fc.assert(
        fc.property(
          fc.record({
            assigneeEmail: emailArb,
            assigneeName: nameArb,
            assignerName: nonEmptyStringArb,
            questionText: fc.string({ minLength: 600, maxLength: 2000 }).filter(s => s.trim().length >= 600),
            questionId: uuidArb,
            projectId: uuidArb,
            projectName: projectNameArb,
          }),
          (data) => {
            const emailContent = buildEmailContent(data);

            // Should contain truncation indicator
            expect(emailContent.htmlBody).toContain('...');
            expect(emailContent.textBody).toContain('...');

            // Should contain the first 500 characters
            const first500 = data.questionText.substring(0, 500);
            expect(emailContent.htmlBody).toContain(first500);
            expect(emailContent.textBody).toContain(first500);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: URL generation correctness
   * Ensures buildQuestionUrl produces valid, consistent URLs
   */
  describe('URL Generation', () => {
    it('should generate consistent URLs for the same inputs', () => {
      fc.assert(
        fc.property(uuidArb, uuidArb, (projectId, questionId) => {
          const url1 = buildQuestionUrl(projectId, questionId);
          const url2 = buildQuestionUrl(projectId, questionId);

          // Same inputs should produce same output
          expect(url1).toBe(url2);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate different URLs for different question IDs', () => {
      fc.assert(
        fc.property(
          uuidArb,
          fc.tuple(uuidArb, uuidArb).filter(([a, b]) => a !== b),
          (projectId, [questionId1, questionId2]) => {
            const url1 = buildQuestionUrl(projectId, questionId1);
            const url2 = buildQuestionUrl(projectId, questionId2);

            // Different question IDs should produce different URLs
            expect(url1).not.toBe(url2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate different URLs for different project IDs', () => {
      fc.assert(
        fc.property(
          uuidArb,
          fc.tuple(uuidArb, uuidArb).filter(([a, b]) => a !== b),
          (questionId, [projectId1, projectId2]) => {
            const url1 = buildQuestionUrl(projectId1, questionId);
            const url2 = buildQuestionUrl(projectId2, questionId);

            // Different project IDs should produce different URLs
            expect(url1).not.toBe(url2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: assignment-ui-notifications, Property 3: Assignee badge reflects assignment state**
   * **Validates: Requirements 2.1, 2.2**
   *
   * For any question, the assignee badge SHALL display:
   * - The assignee's name/email when assigned (Requirement 2.1)
   * - "Unassigned" when not assigned (Requirement 2.2)
   */
  describe('Property 3: Assignee badge reflects assignment state', () => {
    it('should display "Unassigned" when assignee is null', () => {
      fc.assert(
        fc.property(fc.constant(null), (assignee) => {
          const displayText = getAssigneeBadgeDisplayText(assignee);
          
          // When no assignee, should display "Unassigned"
          expect(displayText).toBe("Unassigned");
        }),
        { numRuns: 100 }
      );
    });

    it('should display assignee name when name is available', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: uuidArb,
            name: nonEmptyStringArb,
            email: emailArb,
          }),
          (assignee) => {
            const displayText = getAssigneeBadgeDisplayText(assignee);
            
            // When assignee has a name, should display the name
            expect(displayText).toBe(assignee.name);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should display assignee email when name is null', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: uuidArb,
            name: fc.constant(null),
            email: emailArb,
          }),
          (assignee) => {
            const displayText = getAssigneeBadgeDisplayText(assignee);
            
            // When assignee has no name, should display the email
            expect(displayText).toBe(assignee.email);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null tooltip content when assignee is null', () => {
      fc.assert(
        fc.property(fc.constant(null), (assignee) => {
          const tooltipContent = getAssigneeBadgeTooltipContent(assignee);
          
          // When no assignee, tooltip content should be null
          expect(tooltipContent).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('should return tooltip content with name and email when assigned', () => {
      fc.assert(
        fc.property(assigneeInfoArb, (assignee) => {
          const tooltipContent = getAssigneeBadgeTooltipContent(assignee);
          
          // Tooltip content should not be null
          expect(tooltipContent).not.toBeNull();
          
          // Should contain the email
          expect(tooltipContent?.email).toBe(assignee.email);
          
          // Should contain the name or "No name" fallback
          if (assignee.name) {
            expect(tooltipContent?.name).toBe(assignee.name);
          } else {
            expect(tooltipContent?.name).toBe("No name");
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should consistently reflect assignment state for any assignee', () => {
      fc.assert(
        fc.property(assigneeOrNullArb, (assignee) => {
          const displayText = getAssigneeBadgeDisplayText(assignee);
          const tooltipContent = getAssigneeBadgeTooltipContent(assignee);
          
          if (assignee === null) {
            // Unassigned state
            expect(displayText).toBe("Unassigned");
            expect(tooltipContent).toBeNull();
          } else {
            // Assigned state - display text should be name or email
            expect(displayText).toBe(assignee.name || assignee.email);
            expect(tooltipContent).not.toBeNull();
            expect(tooltipContent?.email).toBe(assignee.email);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: assignment-ui-notifications, Property 1: Member list displays all organization members with details**
   * **Validates: Requirements 1.2, 1.3**
   *
   * For any organization with members, the assignee dropdown SHALL display all members
   * with their name and email visible.
   */
  describe('Property 1: Member list displays all organization members with details', () => {
    it('should display name for each member', () => {
      fc.assert(
        fc.property(organizationMemberArb, (member) => {
          const displayInfo = getMemberDisplayText(member);
          
          // Should have a name property
          expect(displayInfo).toHaveProperty('name');
          
          // Name should be the member's name or "No name" fallback
          if (member.name) {
            expect(displayInfo.name).toBe(member.name);
          } else {
            expect(displayInfo.name).toBe("No name");
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should display email for each member', () => {
      fc.assert(
        fc.property(organizationMemberArb, (member) => {
          const displayInfo = getMemberDisplayText(member);
          
          // Should have an email property
          expect(displayInfo).toHaveProperty('email');
          
          // Email should match the member's email exactly
          expect(displayInfo.email).toBe(member.email);
        }),
        { numRuns: 100 }
      );
    });

    it('should display both name and email for all members in a list', () => {
      fc.assert(
        fc.property(organizationMembersListArb, (members) => {
          // For each member in the list, verify display info is complete
          members.forEach((member) => {
            const displayInfo = getMemberDisplayText(member);
            
            // Both name and email should be present
            expect(displayInfo).toHaveProperty('name');
            expect(displayInfo).toHaveProperty('email');
            
            // Email should always match
            expect(displayInfo.email).toBe(member.email);
            
            // Name should be member's name or fallback
            expect(displayInfo.name).toBe(member.name || "No name");
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should handle members with null names gracefully', () => {
      fc.assert(
        fc.property(
          fc.record({
            userId: uuidArb,
            name: fc.constant(null),
            email: emailArb,
            role: roleArb,
          }),
          (member) => {
            const displayInfo = getMemberDisplayText(member);
            
            // Should use "No name" fallback
            expect(displayInfo.name).toBe("No name");
            
            // Email should still be displayed
            expect(displayInfo.email).toBe(member.email);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: assignment-ui-notifications, Property 2: Assignment API called with correct user ID**
   * **Validates: Requirements 1.4**
   *
   * For any member selection in the dropdown, the assignment API SHALL be called
   * with the exact user ID of the selected member.
   */
  describe('Property 2: Assignment API called with correct user ID', () => {
    it('should return the exact userId for any member', () => {
      fc.assert(
        fc.property(organizationMemberArb, (member) => {
          const userId = getAssignmentUserId(member);
          
          // The returned userId should exactly match the member's userId
          expect(userId).toBe(member.userId);
        }),
        { numRuns: 100 }
      );
    });

    it('should return consistent userId for the same member', () => {
      fc.assert(
        fc.property(organizationMemberArb, (member) => {
          const userId1 = getAssignmentUserId(member);
          const userId2 = getAssignmentUserId(member);
          
          // Same member should always return the same userId
          expect(userId1).toBe(userId2);
        }),
        { numRuns: 100 }
      );
    });

    it('should return different userIds for different members', () => {
      fc.assert(
        fc.property(
          fc.tuple(organizationMemberArb, organizationMemberArb).filter(
            ([m1, m2]) => m1.userId !== m2.userId
          ),
          ([member1, member2]) => {
            const userId1 = getAssignmentUserId(member1);
            const userId2 = getAssignmentUserId(member2);
            
            // Different members should return different userIds
            expect(userId1).not.toBe(userId2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return userId as a string type', () => {
      fc.assert(
        fc.property(organizationMemberArb, (member) => {
          const userId = getAssignmentUserId(member);
          
          // userId should be a string
          expect(typeof userId).toBe('string');
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Unassign option visibility
   * Ensures shouldShowUnassignOption correctly determines when to show the unassign option
   */
  describe('Unassign option visibility', () => {
    it('should show unassign option when question is assigned', () => {
      fc.assert(
        fc.property(assigneeInfoArb, (assignee) => {
          const shouldShow = shouldShowUnassignOption(assignee);
          
          // When there is an assignee, unassign option should be shown
          expect(shouldShow).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should not show unassign option when question is unassigned', () => {
      fc.assert(
        fc.property(fc.constant(null), (assignee) => {
          const shouldShow = shouldShowUnassignOption(assignee);
          
          // When there is no assignee, unassign option should not be shown
          expect(shouldShow).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly reflect assignment state for any assignee', () => {
      fc.assert(
        fc.property(assigneeOrNullArb, (assignee) => {
          const shouldShow = shouldShowUnassignOption(assignee);
          
          // shouldShow should be true if and only if assignee is not null
          expect(shouldShow).toBe(assignee !== null);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: assignment-ui-notifications, Property 5: Assignment filter correctness**
   * **Validates: Requirements 5.2, 5.3, 5.4**
   *
   * For any set of questions:
   * - Filtering by "me" SHALL return only questions assigned to the current user (Requirement 5.2)
   * - Filtering by "all" SHALL return all questions regardless of assignee (Requirement 5.3)
   * - Filtering by "unassigned" SHALL return only questions with no assignee (Requirement 5.4)
   */
  describe('Property 5: Assignment filter correctness', () => {
    it('should return all questions when filter is "all"', () => {
      fc.assert(
        fc.property(questionsListArb, uuidArb, (questions, currentUserId) => {
          const filtered = filterQuestionsByAssignee(questions, 'all', currentUserId);
          
          // "all" filter should return all questions
          expect(filtered.length).toBe(questions.length);
          
          // All original questions should be in the result
          questions.forEach(q => {
            expect(filtered.some(f => f.id === q.id)).toBe(true);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should return only questions assigned to current user when filter is "me"', () => {
      fc.assert(
        fc.property(questionsListArb, uuidArb, (questions, currentUserId) => {
          const filtered = filterQuestionsByAssignee(questions, 'me', currentUserId);
          
          // All filtered questions should be assigned to the current user
          filtered.forEach(q => {
            expect(q.assignee?.id).toBe(currentUserId);
          });
          
          // Count of filtered should match count of questions assigned to current user
          const expectedCount = questions.filter(q => q.assignee?.id === currentUserId).length;
          expect(filtered.length).toBe(expectedCount);
        }),
        { numRuns: 100 }
      );
    });

    it('should return empty array when filter is "me" and currentUserId is null', () => {
      fc.assert(
        fc.property(questionsListArb, (questions) => {
          const filtered = filterQuestionsByAssignee(questions, 'me', null);
          
          // When currentUserId is null, "me" filter should return empty array
          expect(filtered.length).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should return only unassigned questions when filter is "unassigned"', () => {
      fc.assert(
        fc.property(questionsListArb, uuidArb, (questions, currentUserId) => {
          const filtered = filterQuestionsByAssignee(questions, 'unassigned', currentUserId);
          
          // All filtered questions should have no assignee
          filtered.forEach(q => {
            expect(q.assignee).toBeNull();
          });
          
          // Count of filtered should match count of unassigned questions
          const expectedCount = questions.filter(q => !q.assignee).length;
          expect(filtered.length).toBe(expectedCount);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve question data when filtering', () => {
      fc.assert(
        fc.property(questionsListArb, assigneeFilterTypeArb, uuidArb, (questions, filterType, currentUserId) => {
          const filtered = filterQuestionsByAssignee(questions, filterType, currentUserId);
          
          // Each filtered question should have the same data as the original
          filtered.forEach(filteredQ => {
            const original = questions.find(q => q.id === filteredQ.id);
            expect(original).toBeDefined();
            expect(filteredQ.question).toBe(original?.question);
            expect(filteredQ.assignee).toEqual(original?.assignee);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should be idempotent - filtering twice gives same result', () => {
      fc.assert(
        fc.property(questionsListArb, assigneeFilterTypeArb, uuidArb, (questions, filterType, currentUserId) => {
          const filtered1 = filterQuestionsByAssignee(questions, filterType, currentUserId);
          const filtered2 = filterQuestionsByAssignee(filtered1, filterType, currentUserId);
          
          // Filtering twice should give the same result
          expect(filtered2.length).toBe(filtered1.length);
          filtered1.forEach((q, i) => {
            expect(filtered2[i].id).toBe(q.id);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should partition questions correctly - all = me + unassigned + others', () => {
      fc.assert(
        fc.property(questionsListArb, uuidArb, (questions, currentUserId) => {
          const allFiltered = filterQuestionsByAssignee(questions, 'all', currentUserId);
          const meFiltered = filterQuestionsByAssignee(questions, 'me', currentUserId);
          const unassignedFiltered = filterQuestionsByAssignee(questions, 'unassigned', currentUserId);
          
          // "all" should contain all questions
          expect(allFiltered.length).toBe(questions.length);
          
          // "me" and "unassigned" should be subsets of "all"
          meFiltered.forEach(q => {
            expect(allFiltered.some(a => a.id === q.id)).toBe(true);
          });
          unassignedFiltered.forEach(q => {
            expect(allFiltered.some(a => a.id === q.id)).toBe(true);
          });
          
          // "me" and "unassigned" should not overlap
          meFiltered.forEach(q => {
            expect(unassignedFiltered.some(u => u.id === q.id)).toBe(false);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should handle empty questions array', () => {
      fc.assert(
        fc.property(assigneeFilterTypeArb, uuidArb, (filterType, currentUserId) => {
          const filtered = filterQuestionsByAssignee([], filterType, currentUserId);
          
          // Empty input should always return empty output
          expect(filtered.length).toBe(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: assignment-ui-notifications, Property 6: Statistics accuracy**
   * **Validates: Requirements 6.1, 6.2**
   *
   * For any project, the assignment statistics SHALL accurately reflect:
   * - The count of questions assigned to each team member (Requirement 6.1)
   * - The count of unassigned questions (Requirement 6.2)
   */
  describe('Property 6: Statistics accuracy', () => {
    /**
     * Generator for MemberForStats
     */
    const memberForStatsArb: fc.Arbitrary<MemberForStats> = fc.record({
      userId: uuidArb,
      userName: nameArb,
      userEmail: emailArb,
    });

    /**
     * Generator for a list of members for stats
     */
    const membersForStatsListArb: fc.Arbitrary<MemberForStats[]> = fc.array(
      memberForStatsArb,
      { minLength: 1, maxLength: 10 }
    ).map(members => {
      // Ensure unique userIds
      const seen = new Set<string>();
      return members.filter(m => {
        if (seen.has(m.userId)) return false;
        seen.add(m.userId);
        return true;
      });
    }).filter(members => members.length > 0);

    /**
     * Generator for QuestionForStats with assignee from a given set of members
     */
    const questionForStatsArb = (memberIds: string[]): fc.Arbitrary<QuestionForStats> => 
      fc.record({
        id: uuidArb,
        assignee: fc.option(
          fc.constantFrom(...memberIds).map(id => ({ id })),
          { nil: null }
        ),
      });

    /**
     * Generator for questions with assignees from a specific member list
     */
    const questionsWithMembersArb: fc.Arbitrary<{ questions: QuestionForStats[]; members: MemberForStats[] }> = 
      membersForStatsListArb.chain(members => {
        const memberIds = members.map(m => m.userId);
        return fc.array(questionForStatsArb(memberIds), { minLength: 0, maxLength: 30 })
          .map(questions => ({ questions, members }));
      });

    it('should compute correct total question count', () => {
      fc.assert(
        fc.property(questionsWithMembersArb, ({ questions, members }) => {
          const stats = computeAssignmentStats(questions, members);
          
          // Total should match the number of questions
          expect(stats.totalQuestions).toBe(questions.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should compute correct unassigned count', () => {
      fc.assert(
        fc.property(questionsWithMembersArb, ({ questions, members }) => {
          const stats = computeAssignmentStats(questions, members);
          
          // Unassigned count should match questions without assignee
          const expectedUnassigned = questions.filter(q => !q.assignee).length;
          expect(stats.unassignedCount).toBe(expectedUnassigned);
        }),
        { numRuns: 100 }
      );
    });

    it('should compute correct per-member assignment counts', () => {
      fc.assert(
        fc.property(questionsWithMembersArb, ({ questions, members }) => {
          const stats = computeAssignmentStats(questions, members);
          
          // Each member's count should match actual assignments
          for (const userStat of stats.assignmentsByUser) {
            const expectedCount = questions.filter(q => q.assignee?.id === userStat.userId).length;
            expect(userStat.count).toBe(expectedCount);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should include all organization members in stats', () => {
      fc.assert(
        fc.property(questionsWithMembersArb, ({ questions, members }) => {
          const stats = computeAssignmentStats(questions, members);
          
          // All members should be in the stats
          expect(stats.assignmentsByUser.length).toBe(members.length);
          
          // Each member should be represented
          for (const member of members) {
            const found = stats.assignmentsByUser.find(s => s.userId === member.userId);
            expect(found).toBeDefined();
            expect(found?.userEmail).toBe(member.userEmail);
            expect(found?.userName).toBe(member.userName);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should have sum of user counts + unassigned equal total', () => {
      fc.assert(
        fc.property(questionsWithMembersArb, ({ questions, members }) => {
          const stats = computeAssignmentStats(questions, members);
          
          // Sum of all user counts + unassigned should equal total
          const sumOfUserCounts = stats.assignmentsByUser.reduce((sum, user) => sum + user.count, 0);
          expect(sumOfUserCounts + stats.unassignedCount).toBe(stats.totalQuestions);
        }),
        { numRuns: 100 }
      );
    });

    it('should pass validation for any computed stats', () => {
      fc.assert(
        fc.property(questionsWithMembersArb, ({ questions, members }) => {
          const stats = computeAssignmentStats(questions, members);
          
          // Validation should pass for correctly computed stats
          expect(validateAssignmentStats(stats, questions)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle empty questions array', () => {
      fc.assert(
        fc.property(membersForStatsListArb, (members) => {
          const stats = computeAssignmentStats([], members);
          
          // Empty questions should result in zero counts
          expect(stats.totalQuestions).toBe(0);
          expect(stats.unassignedCount).toBe(0);
          
          // All members should have zero count
          stats.assignmentsByUser.forEach(userStat => {
            expect(userStat.count).toBe(0);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should handle all questions unassigned', () => {
      fc.assert(
        fc.property(
          membersForStatsListArb,
          fc.array(fc.record({ id: uuidArb, assignee: fc.constant(null) }), { minLength: 1, maxLength: 20 }),
          (members, questions) => {
            const stats = computeAssignmentStats(questions, members);
            
            // All questions should be unassigned
            expect(stats.unassignedCount).toBe(questions.length);
            
            // All members should have zero count
            stats.assignmentsByUser.forEach(userStat => {
              expect(userStat.count).toBe(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle members with zero assignments', () => {
      fc.assert(
        fc.property(questionsWithMembersArb, ({ questions, members }) => {
          const stats = computeAssignmentStats(questions, members);
          
          // Members with no assignments should have count of 0
          for (const userStat of stats.assignmentsByUser) {
            const actualCount = questions.filter(q => q.assignee?.id === userStat.userId).length;
            if (actualCount === 0) {
              expect(userStat.count).toBe(0);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should be deterministic - same input produces same output', () => {
      fc.assert(
        fc.property(questionsWithMembersArb, ({ questions, members }) => {
          const stats1 = computeAssignmentStats(questions, members);
          const stats2 = computeAssignmentStats(questions, members);
          
          // Same input should produce identical output
          expect(stats1.totalQuestions).toBe(stats2.totalQuestions);
          expect(stats1.unassignedCount).toBe(stats2.unassignedCount);
          expect(stats1.assignmentsByUser.length).toBe(stats2.assignmentsByUser.length);
          
          for (let i = 0; i < stats1.assignmentsByUser.length; i++) {
            expect(stats1.assignmentsByUser[i].userId).toBe(stats2.assignmentsByUser[i].userId);
            expect(stats1.assignmentsByUser[i].count).toBe(stats2.assignmentsByUser[i].count);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
