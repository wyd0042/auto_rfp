// LlamaParse API Types
export interface LlamaParseResult {
  success: boolean;
  documentId: string;
  documentName: string;
  status: string;
  content: string;
  projectId?: string;
  metadata: {
    mode: 'fast' | 'balanced' | 'premium' | 'complexTables';
    wordCount: number;
    pageCount?: number;
    summary?: string;
  };
}

// Source information
export interface AnswerSource {
  id: number;
  fileName: string;
  filePath?: string;
  pageNumber?: string | number;
  documentId?: string;
  relevance?: number | null;
  textContent?: string | null;
}

// Response Generation API Types
export interface GenerateResponseResult {
  success: boolean;
  response: string;
  sources: AnswerSource[];
  metadata: {
    confidence: number;
    generatedAt: string;
  };
}

// Common Error Response
export interface ApiErrorResponse {
  error: string;
}

// Assignee information for questions
export interface QuestionAssignee {
  id: string;
  name: string | null;
  email: string;
}

// RFP Question structure
export interface RfpQuestion {
  id: string; // Database primary key (CUID)
  question: string;
  answer?: string;
  sources?: AnswerSource[];
  referenceId?: string; // AI-generated reference ID for document structure (e.g., "q_1234567890_1_1")
  assignee?: QuestionAssignee | null; // Assigned user details
}

export interface RfpSection {
  id: string;
  title: string;
  description?: string;
  questions: RfpQuestion[];
}

export interface RfpDocument {
  documentId: string;
  documentName: string;
  sections: RfpSection[];
  extractedAt: string;
}

// Question Assignment Types

// Assignment request body for single question
export interface AssignQuestionRequest {
  questionId: string;
  assigneeId: string | null; // null to unassign
}

// Bulk assignment request
export interface BulkAssignRequest {
  assignments: AssignQuestionRequest[];
}

// Question with full assignee details (used in API responses)
export interface QuestionWithAssignee {
  id: string;
  text: string;
  topic: string;
  referenceId?: string;
  assignee: QuestionAssignee | null;
  answer?: {
    id: string;
    text: string;
    sources?: AnswerSource[];
  };
}

// Assignment response
export interface AssignmentResponse {
  success: boolean;
  question: QuestionWithAssignee;
}

// User assignment count for statistics
export interface UserAssignmentCount {
  userId: string;
  userName: string | null;
  userEmail: string;
  count: number;
}

// Assignment statistics
export interface AssignmentStats {
  totalQuestions: number;
  unassignedCount: number;
  assignmentsByUser: UserAssignmentCount[];
}

// ============================================
// Assignment UI Types
// ============================================

/**
 * Assignee information for display in UI components
 * Used by AssigneeBadge and AssigneeDropdown components
 * Requirements: 1.2, 1.3, 2.1
 */
export interface AssigneeInfo {
  id: string;
  name: string | null;
  email: string;
}

/**
 * Organization member information for assignment dropdown
 * Requirements: 1.2, 1.3
 */
export interface OrganizationMember {
  userId: string;
  name: string | null;
  email: string;
  role: string;
}

/**
 * Filter type for filtering questions by assignee
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export type AssigneeFilterType = 'all' | 'me' | 'unassigned';

/**
 * Data required to send an assignment notification email
 * Requirements: 4.2, 4.3, 4.4, 4.5
 */
export interface AssignmentNotificationData {
  assigneeEmail: string;
  assigneeName: string | null;
  assignerName: string;
  questionText: string;
  questionId: string;
  projectId: string;
  projectName: string;
} 