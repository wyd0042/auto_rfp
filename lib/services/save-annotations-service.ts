/**
 * Save Annotations Service
 * 
 * Transforms annotation state to save request format and organizes
 * questions under their associated sections.
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 6.1, 6.2**
 */

import type { 
  Annotation, 
  AnnotationState, 
  SaveAnnotationsRequest, 
  SaveAnnotationSection 
} from '@/types/annotation';
import type { RfpSection, RfpQuestion } from '@/types/api';

/**
 * Result of organizing annotations into sections
 */
export interface OrganizedAnnotations {
  sections: SaveAnnotationSection[];
  orphanedQuestions: Annotation[];
}

/**
 * Organizes questions under their associated sections based on page order.
 * Questions are assigned to the most recent section that appears before them.
 * Questions that appear before any section are grouped under a default section.
 * 
 * **Property 7: Save Organizes Questions Under Sections**
 * **Validates: Requirements 6.1, 6.2**
 * 
 * @param annotationState - The current annotation state with sections and questions
 * @returns Organized sections with their associated questions
 */
export function organizeAnnotationsIntoSections(
  annotationState: AnnotationState
): OrganizedAnnotations {
  const { sections, questions } = annotationState;
  
  // Sort sections by page number, then by creation time for same page
  const sortedSections = [...sections].sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) {
      return a.pageNumber - b.pageNumber;
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  
  // Sort questions by page number, then by creation time for same page
  const sortedQuestions = [...questions].sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) {
      return a.pageNumber - b.pageNumber;
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  
  // If no sections exist, all questions are orphaned
  if (sortedSections.length === 0) {
    return {
      sections: [],
      orphanedQuestions: sortedQuestions,
    };
  }
  
  // Create section buckets
  const sectionBuckets: Map<string, Annotation[]> = new Map();
  sortedSections.forEach(section => {
    sectionBuckets.set(section.id, []);
  });
  
  // Track orphaned questions (before first section)
  const orphanedQuestions: Annotation[] = [];
  
  // Assign each question to the appropriate section
  for (const question of sortedQuestions) {
    // Find the section that this question belongs to
    // (the last section that appears before or on the same page as the question)
    let assignedSection: Annotation | null = null;
    
    for (const section of sortedSections) {
      // Section must be on same page or earlier page
      if (section.pageNumber <= question.pageNumber) {
        // If on same page, section must have been created before the question
        if (section.pageNumber < question.pageNumber) {
          assignedSection = section;
        } else {
          // Same page - check creation time
          if (new Date(section.createdAt).getTime() <= new Date(question.createdAt).getTime()) {
            assignedSection = section;
          }
        }
      }
    }
    
    if (assignedSection) {
      sectionBuckets.get(assignedSection.id)?.push(question);
    } else {
      orphanedQuestions.push(question);
    }
  }
  
  // Convert to SaveAnnotationSection format
  const organizedSections: SaveAnnotationSection[] = sortedSections.map(section => ({
    title: section.text,
    questions: (sectionBuckets.get(section.id) || []).map(q => ({
      text: q.text,
      referenceId: q.id,
    })),
  }));
  
  return {
    sections: organizedSections,
    orphanedQuestions,
  };
}

/**
 * Transforms annotation state to the format expected by the save questions API.
 * Handles orphaned questions by creating a default section for them.
 * 
 * @param annotationState - The current annotation state
 * @param projectId - The project ID to save to
 * @param documentName - The name of the document being annotated
 * @returns SaveAnnotationsRequest ready for API call
 */
export function transformAnnotationsToSaveRequest(
  annotationState: AnnotationState,
  projectId: string,
  documentName: string
): SaveAnnotationsRequest {
  const { sections, orphanedQuestions } = organizeAnnotationsIntoSections(annotationState);
  
  // If there are orphaned questions, create a default section for them
  const finalSections = [...sections];
  if (orphanedQuestions.length > 0) {
    finalSections.unshift({
      title: 'General Questions',
      questions: orphanedQuestions.map(q => ({
        text: q.text,
        referenceId: q.id,
      })),
    });
  }
  
  return {
    projectId,
    documentName,
    sections: finalSections,
  };
}

/**
 * Transforms SaveAnnotationsRequest to RfpSection format for the existing API.
 * The existing API expects RfpSection[] with id, title, and questions array.
 * 
 * @param request - The save annotations request
 * @returns Array of RfpSection for the existing save questions API
 */
export function transformToRfpSections(request: SaveAnnotationsRequest): RfpSection[] {
  return request.sections.map((section, index) => ({
    id: `section_${index + 1}`,
    title: section.title,
    questions: section.questions.map((q, qIndex) => ({
      id: q.referenceId || `q_${Date.now()}_${index}_${qIndex}`,
      question: q.text,
    })),
  }));
}

/**
 * Saves annotations to the database via the existing questions API.
 * 
 * @param projectId - The project ID to save to
 * @param annotationState - The current annotation state
 * @param documentName - The name of the document being annotated
 * @returns Promise resolving to success status
 * @throws Error if save fails
 */
export async function saveAnnotations(
  projectId: string,
  annotationState: AnnotationState,
  documentName: string
): Promise<{ success: boolean; message: string }> {
  // Transform annotations to save request format
  const saveRequest = transformAnnotationsToSaveRequest(
    annotationState,
    projectId,
    documentName
  );
  
  // Transform to RfpSection format for existing API
  const rfpSections = transformToRfpSections(saveRequest);
  
  // Call the existing save questions API
  const response = await fetch(`/api/questions/${projectId}/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sections: rfpSections }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `Failed to save questions: ${response.status}`);
  }
  
  const result = await response.json();
  return {
    success: true,
    message: result.message || 'Questions saved successfully',
  };
}
