import { db } from '../db';

/**
 * Question with assignee details
 */
export interface QuestionWithAssignee {
  id: string;
  text: string;
  topic: string;
  referenceId?: string | null;
  projectId: string;
  assignedTo: string | null;
  assignee: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Assignment request for a single question
 */
export interface AssignQuestionRequest {
  questionId: string;
  assigneeId: string | null; // null to unassign
}

/**
 * Bulk assignment request
 */
export interface BulkAssignRequest {
  assignments: AssignQuestionRequest[];
}

/**
 * Assignment statistics per user
 */
export interface UserAssignmentCount {
  userId: string;
  userName: string | null;
  userEmail: string;
  count: number;
}

/**
 * Assignment statistics for a project
 */
export interface AssignmentStats {
  totalQuestions: number;
  unassignedCount: number;
  assignmentsByUser: UserAssignmentCount[];
}

export const questionAssignmentService = {
  /**
   * Validates that a user is a member of the specified organization
   * @param assigneeId - The user ID to validate
   * @param organizationId - The organization ID to check membership against
   * @returns true if the user is a member, false otherwise
   */
  async validateAssignee(assigneeId: string, organizationId: string): Promise<boolean> {
    const membership = await db.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId: assigneeId,
          organizationId,
        },
      },
    });

    return !!membership;
  },

  /**
   * Assigns a question to a user or unassigns it
   * @param questionId - The question ID to assign
   * @param assigneeId - The user ID to assign to, or null to unassign
   * @param organizationId - The organization ID for membership validation
   * @returns The updated question with assignee details
   */
  async assignQuestion(
    questionId: string,
    assigneeId: string | null,
    organizationId: string
  ): Promise<QuestionWithAssignee> {
    // Validate assignee is a member of the organization (if assigning)
    if (assigneeId !== null) {
      const isValidAssignee = await this.validateAssignee(assigneeId, organizationId);
      if (!isValidAssignee) {
        throw new Error('User is not a member of this organization');
      }
    }

    // Update the question assignment
    const updatedQuestion = await db.question.update({
      where: { id: questionId },
      data: {
        assignedTo: assigneeId,
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      id: updatedQuestion.id,
      text: updatedQuestion.text,
      topic: updatedQuestion.topic,
      referenceId: updatedQuestion.referenceId,
      projectId: updatedQuestion.projectId,
      assignedTo: updatedQuestion.assignedTo,
      assignee: updatedQuestion.assignee,
      createdAt: updatedQuestion.createdAt,
      updatedAt: updatedQuestion.updatedAt,
    };
  },

  /**
   * Bulk assigns multiple questions in a single transaction
   * @param assignments - Array of assignment requests
   * @param organizationId - The organization ID for membership validation
   * @returns Array of updated questions with assignee details
   */
  async bulkAssign(
    assignments: AssignQuestionRequest[],
    organizationId: string
  ): Promise<QuestionWithAssignee[]> {
    // Collect unique assignee IDs (excluding null)
    const uniqueAssigneeIds = [...new Set(
      assignments
        .map(a => a.assigneeId)
        .filter((id): id is string => id !== null)
    )];

    // Validate all assignees are members of the organization
    for (const assigneeId of uniqueAssigneeIds) {
      const isValidAssignee = await this.validateAssignee(assigneeId, organizationId);
      if (!isValidAssignee) {
        throw new Error(`User ${assigneeId} is not a member of this organization`);
      }
    }

    // Perform all assignments in a transaction
    const updatedQuestions = await db.$transaction(async (tx) => {
      const results: QuestionWithAssignee[] = [];

      for (const assignment of assignments) {
        const updatedQuestion = await tx.question.update({
          where: { id: assignment.questionId },
          data: {
            assignedTo: assignment.assigneeId,
          },
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        results.push({
          id: updatedQuestion.id,
          text: updatedQuestion.text,
          topic: updatedQuestion.topic,
          referenceId: updatedQuestion.referenceId,
          projectId: updatedQuestion.projectId,
          assignedTo: updatedQuestion.assignedTo,
          assignee: updatedQuestion.assignee,
          createdAt: updatedQuestion.createdAt,
          updatedAt: updatedQuestion.updatedAt,
        });
      }

      return results;
    });

    return updatedQuestions;
  },

  /**
   * Gets assignment statistics for a project
   * @param projectId - The project ID to get statistics for
   * @returns Assignment statistics including counts per user
   */
  async getAssignmentStats(projectId: string): Promise<AssignmentStats> {
    // Get the project to find its organization
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Get all questions for the project
    const questions = await db.question.findMany({
      where: { projectId },
      select: { assignedTo: true },
    });

    const totalQuestions = questions.length;
    const unassignedCount = questions.filter(q => q.assignedTo === null).length;

    // Get all organization members
    const orgMembers = await db.organizationUser.findMany({
      where: { organizationId: project.organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Count assignments per user
    const assignmentCounts = new Map<string, number>();
    for (const question of questions) {
      if (question.assignedTo) {
        const currentCount = assignmentCounts.get(question.assignedTo) || 0;
        assignmentCounts.set(question.assignedTo, currentCount + 1);
      }
    }

    // Build the assignments by user array (including members with zero assignments)
    const assignmentsByUser: UserAssignmentCount[] = orgMembers.map(member => ({
      userId: member.user.id,
      userName: member.user.name,
      userEmail: member.user.email,
      count: assignmentCounts.get(member.user.id) || 0,
    }));

    return {
      totalQuestions,
      unassignedCount,
      assignmentsByUser,
    };
  },
};
