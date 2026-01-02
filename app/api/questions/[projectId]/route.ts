import { NextRequest, NextResponse } from 'next/server';
import { projectService } from '@/lib/project-service';
import { createClient } from '@/lib/utils/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const projectId = (await params).projectId;
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }
    
    // Parse assignee query parameter
    const searchParams = request.nextUrl.searchParams;
    const assigneeParam = searchParams.get('assignee');
    
    // Build filter options
    let filterOptions: { assignee?: string | null } | undefined;
    
    if (assigneeParam !== null) {
      if (assigneeParam === 'me') {
        // Get current user ID from Supabase auth
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          return NextResponse.json(
            { error: 'Authentication required for "me" filter' },
            { status: 401 }
          );
        }
        
        filterOptions = { assignee: user.id };
      } else if (assigneeParam === 'unassigned') {
        // Filter for unassigned questions
        filterOptions = { assignee: null };
      } else {
        // Filter by specific user ID
        filterOptions = { assignee: assigneeParam };
      }
    }
    
    // Get questions from the database with optional filter
    const rfpDocument = await projectService.getQuestions(projectId, filterOptions);
    
    if (!rfpDocument) {
      console.log(`No RFP document found for projectId: ${projectId}`);
      return NextResponse.json(
        { error: 'No questions found for this project' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(rfpDocument);
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    );
  }
} 