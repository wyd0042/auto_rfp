import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizationService } from '@/lib/organization-service';
import { questionAssignmentService } from '@/lib/services/question-assignment-service';

/**
 * GET /api/projects/[projectId]/assignment-stats
 * Returns assignment statistics for a project
 * 
 * Response:
 * - totalQuestions: number - Total questions in the project
 * - unassignedCount: number - Count of unassigned questions
 * - assignmentsByUser: array - Per-user assignment counts (includes all org members)
 * 
 * Requirements: 5.1, 5.2, 5.3
 */
export async function GET(
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

    // Get project to find organization
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if user is a member of the organization
    const isMember = await organizationService.isUserOrganizationMember(
      currentUser.id,
      project.organizationId
    );

    if (!isMember) {
      return NextResponse.json(
        { error: 'You do not have access to this project' },
        { status: 403 }
      );
    }

    // Get assignment statistics
    const stats = await questionAssignmentService.getAssignmentStats(projectId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching assignment stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignment statistics' },
      { status: 500 }
    );
  }
}
