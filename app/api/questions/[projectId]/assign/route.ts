import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizationService } from '@/lib/organization-service';
import { 
  questionAssignmentService, 
  AssignQuestionRequest
} from '@/lib/services/question-assignment-service';
import { 
  sendAssignmentNotification,
  AssignmentNotificationData 
} from '@/lib/services/assignment-notification-service';

/**
 * POST /api/questions/[projectId]/assign
 * Assigns one or more questions to team members
 * 
 * Request body:
 * - Single assignment: { questionId: string, assigneeId: string | null }
 * - Bulk assignment: { assignments: [{ questionId: string, assigneeId: string | null }, ...] }
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3, 4.1, 4.6
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    // Get current user
    const currentUser = await organizationService.getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get project to find organization and project name for notifications
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true, name: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if user is admin or owner of the organization
    const userRole = await organizationService.getUserOrganizationRole(
      currentUser.id,
      project.organizationId
    );

    if (!userRole || !['admin', 'owner'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Only admins can assign questions' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Determine if this is a single or bulk assignment
    const isBulkAssignment = Array.isArray(body.assignments);

    if (isBulkAssignment) {
      // Bulk assignment
      const { assignments } = body as { assignments: AssignQuestionRequest[] };

      if (!assignments || assignments.length === 0) {
        return NextResponse.json(
          { error: 'Assignments array is required and must not be empty' },
          { status: 400 }
        );
      }

      // Validate all question IDs
      for (const assignment of assignments) {
        if (!assignment.questionId) {
          return NextResponse.json(
            { error: 'Each assignment must have a questionId' },
            { status: 400 }
          );
        }

        // Validate assigneeId format if provided (not null)
        if (assignment.assigneeId !== null && typeof assignment.assigneeId !== 'string') {
          return NextResponse.json(
            { error: 'Invalid user ID' },
            { status: 400 }
          );
        }
      }

      // Verify all questions belong to this project
      const questionIds = assignments.map(a => a.questionId);
      const questions = await db.question.findMany({
        where: {
          id: { in: questionIds },
          projectId,
        },
        select: { id: true },
      });

      if (questions.length !== questionIds.length) {
        return NextResponse.json(
          { error: 'One or more questions not found in this project' },
          { status: 404 }
        );
      }

      try {
        const updatedQuestions = await questionAssignmentService.bulkAssign(
          assignments,
          project.organizationId
        );

        // Send email notifications for each assignment (not unassignments)
        // Requirements: 4.1, 4.6 - Send notifications, handle failures gracefully
        const assignerName = currentUser.name || currentUser.email;
        
        for (const updatedQuestion of updatedQuestions) {
          // Only send notification if there's an assignee (not unassignment)
          if (updatedQuestion.assignee) {
            try {
              const notificationData: AssignmentNotificationData = {
                assigneeEmail: updatedQuestion.assignee.email,
                assigneeName: updatedQuestion.assignee.name,
                assignerName,
                questionText: updatedQuestion.text,
                questionId: updatedQuestion.id,
                projectId,
                projectName: project.name,
              };
              
              // Fire and forget - don't await to avoid blocking the response
              sendAssignmentNotification(notificationData).catch((error) => {
                console.error('Failed to send assignment notification:', error);
              });
            } catch (notificationError) {
              // Log but don't fail the assignment - per Requirement 4.6
              console.error('Error preparing assignment notification:', notificationError);
            }
          }
        }

        return NextResponse.json({
          success: true,
          questions: updatedQuestions,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not a member')) {
          return NextResponse.json(
            { error: 'User is not a member of this organization' },
            { status: 403 }
          );
        }
        throw error;
      }
    } else {
      // Single assignment
      const { questionId, assigneeId } = body as AssignQuestionRequest;

      if (!questionId) {
        return NextResponse.json(
          { error: 'questionId is required' },
          { status: 400 }
        );
      }

      // Validate assigneeId format if provided (not null)
      if (assigneeId !== null && assigneeId !== undefined && typeof assigneeId !== 'string') {
        return NextResponse.json(
          { error: 'Invalid user ID' },
          { status: 400 }
        );
      }

      // Verify question belongs to this project
      const question = await db.question.findFirst({
        where: {
          id: questionId,
          projectId,
        },
      });

      if (!question) {
        return NextResponse.json(
          { error: 'Question not found' },
          { status: 404 }
        );
      }

      try {
        const updatedQuestion = await questionAssignmentService.assignQuestion(
          questionId,
          assigneeId ?? null,
          project.organizationId
        );

        // Send email notification if assigning (not unassigning)
        // Requirements: 4.1, 4.6 - Send notification, handle failures gracefully
        if (updatedQuestion.assignee) {
          try {
            const assignerName = currentUser.name || currentUser.email;
            const notificationData: AssignmentNotificationData = {
              assigneeEmail: updatedQuestion.assignee.email,
              assigneeName: updatedQuestion.assignee.name,
              assignerName,
              questionText: updatedQuestion.text,
              questionId: updatedQuestion.id,
              projectId,
              projectName: project.name,
            };
            
            // Fire and forget - don't await to avoid blocking the response
            sendAssignmentNotification(notificationData).catch((error) => {
              console.error('Failed to send assignment notification:', error);
            });
          } catch (notificationError) {
            // Log but don't fail the assignment - per Requirement 4.6
            console.error('Error preparing assignment notification:', notificationError);
          }
        }

        return NextResponse.json({
          success: true,
          question: updatedQuestion,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not a member')) {
          return NextResponse.json(
            { error: 'User is not a member of this organization' },
            { status: 403 }
          );
        }
        throw error;
      }
    }
  } catch (error) {
    console.error('Error assigning question:', error);
    return NextResponse.json(
      { error: 'Failed to update assignment' },
      { status: 500 }
    );
  }
}
