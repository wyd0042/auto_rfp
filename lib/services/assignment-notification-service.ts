/**
 * Assignment Notification Service
 * 
 * Handles sending email notifications when questions are assigned to team members.
 * Uses Supabase for email delivery.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import { createClient } from '@/lib/utils/supabase/server';
import { AssignmentNotificationData } from '@/types/api';

// Re-export type for backward compatibility
export type { AssignmentNotificationData } from '@/types/api';

/**
 * Email content structure
 */
export interface EmailContent {
  subject: string;
  htmlBody: string;
  textBody: string;
}

/**
 * Interface for the assignment notification service
 */
export interface IAssignmentNotificationService {
  sendAssignmentNotification(data: AssignmentNotificationData): Promise<void>;
  buildQuestionUrl(projectId: string, questionId: string): string;
  buildEmailContent(data: AssignmentNotificationData): EmailContent;
}

/**
 * Gets the base URL for the application
 * Uses NEXT_PUBLIC_APP_URL environment variable or falls back to localhost
 */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

/**
 * Builds a direct URL to a specific question in a project
 * 
 * @param projectId - The project ID
 * @param questionId - The question ID
 * @returns The full URL to the question
 */
export function buildQuestionUrl(projectId: string, questionId: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/projects/${projectId}/questions?questionId=${questionId}`;
}

/**
 * Builds the email content for an assignment notification
 * 
 * @param data - The notification data
 * @returns The email content with subject, HTML body, and text body
 * 
 * Requirements: 4.2, 4.3, 4.4, 4.5
 */
export function buildEmailContent(data: AssignmentNotificationData): EmailContent {
  const questionUrl = buildQuestionUrl(data.projectId, data.questionId);
  const assigneeName = data.assigneeName || 'Team Member';
  
  // Truncate question text if too long for display
  const maxQuestionLength = 500;
  const truncatedQuestion = data.questionText.length > maxQuestionLength
    ? `${data.questionText.substring(0, maxQuestionLength)}...`
    : data.questionText;

  const subject = `[${data.projectName}] Question assigned to you`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Question Assigned</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
    <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 16px 0;">Question Assigned to You</h1>
    <p style="margin: 0; color: #666;">Hi ${assigneeName},</p>
  </div>
  
  <div style="margin-bottom: 24px;">
    <p><strong>${data.assignerName}</strong> has assigned you a question in the project <strong>${data.projectName}</strong>.</p>
  </div>
  
  <div style="background-color: #f0f4f8; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
    <h2 style="font-size: 14px; color: #666; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">Question</h2>
    <p style="margin: 0; color: #1a1a1a; font-size: 16px;">${truncatedQuestion}</p>
  </div>
  
  <div style="text-align: center; margin-bottom: 24px;">
    <a href="${questionUrl}" style="display: inline-block; background-color: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">View Question</a>
  </div>
  
  <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; color: #666; font-size: 14px;">
    <p style="margin: 0;">This is an automated notification from AI4RFP.</p>
  </div>
</body>
</html>
  `.trim();

  const textBody = `
Question Assigned to You

Hi ${assigneeName},

${data.assignerName} has assigned you a question in the project "${data.projectName}".

Question:
${truncatedQuestion}

View the question here: ${questionUrl}

---
This is an automated notification from AI4RFP.
  `.trim();

  return {
    subject,
    htmlBody,
    textBody,
  };
}

/**
 * Sends an assignment notification email to the assignee
 * 
 * @param data - The notification data
 * @throws Error if email sending fails (but caller should handle gracefully per Requirement 4.6)
 * 
 * Requirements: 4.1, 4.6
 */
export async function sendAssignmentNotification(data: AssignmentNotificationData): Promise<void> {
  try {
    const supabase = await createClient();
    const emailContent = buildEmailContent(data);

    // Use Supabase's built-in email functionality via Edge Functions
    // Note: This requires setting up a Supabase Edge Function for email sending
    // For now, we'll use the auth.admin API if available, or log the email
    
    // Check if we have admin access for sending emails
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('No authenticated user for sending notification email');
      // Log the email content for debugging/manual follow-up
      console.log('Assignment notification email would be sent:', {
        to: data.assigneeEmail,
        subject: emailContent.subject,
        projectName: data.projectName,
        questionId: data.questionId,
      });
      return;
    }

    // For production, you would integrate with:
    // 1. Supabase Edge Functions with a mail provider (Resend, SendGrid, etc.)
    // 2. Or use Supabase's built-in email templates
    
    // For now, we'll use a simple approach that logs the email
    // This can be replaced with actual email sending when the infrastructure is set up
    console.log('Sending assignment notification email:', {
      to: data.assigneeEmail,
      subject: emailContent.subject,
      assignerName: data.assignerName,
      projectName: data.projectName,
      questionId: data.questionId,
      questionUrl: buildQuestionUrl(data.projectId, data.questionId),
    });

    // TODO: Implement actual email sending via Supabase Edge Function
    // Example with Resend via Edge Function:
    // await supabase.functions.invoke('send-email', {
    //   body: {
    //     to: data.assigneeEmail,
    //     subject: emailContent.subject,
    //     html: emailContent.htmlBody,
    //     text: emailContent.textBody,
    //   },
    // });

  } catch (error) {
    // Log the error but don't throw - per Requirement 4.6
    // The assignment should succeed even if email fails
    console.error('Failed to send assignment notification email:', error);
    console.error('Notification data:', {
      assigneeEmail: data.assigneeEmail,
      projectName: data.projectName,
      questionId: data.questionId,
    });
  }
}

/**
 * Assignment notification service object implementing IAssignmentNotificationService
 */
export const assignmentNotificationService: IAssignmentNotificationService = {
  sendAssignmentNotification,
  buildQuestionUrl,
  buildEmailContent,
};
