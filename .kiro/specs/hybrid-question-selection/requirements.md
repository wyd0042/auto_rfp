# Requirements Document

## Introduction

This feature adds a hybrid question selection system to the AutoRFP application, combining the existing AI-powered automatic extraction with new manual selection and AI-assisted suggestion modes. The goal is to give users flexibility and control over how questions are identified from RFP documents while maintaining the speed benefits of AI extraction. Users can choose between fully automatic extraction (current behavior), manual text selection from a PDF viewer, or AI-assisted suggestions that users can accept/reject before saving.

## Glossary

- **Question_Selection_System**: The component responsible for identifying and extracting questions from uploaded RFP documents
- **PDF_Viewer**: An in-browser component that renders PDF documents with an interactive text layer for selection
- **Annotation**: A user-created or AI-suggested marking on the document identifying a section or question
- **Extraction_Mode**: The method used to identify questions - Auto (AI), Manual (user selection), or Hybrid (AI suggestions with user validation)
- **Text_Selection**: The act of highlighting text in the PDF viewer using mouse interaction
- **AI_Suggestion**: A question or section automatically detected by the AI that requires user validation before becoming permanent
- **Annotation_State**: The collection of all sections and questions marked in the current document session

## Requirements

### Requirement 1

**User Story:** As a user, I want to choose how questions are extracted from my RFP documents, so that I can balance speed and accuracy based on my needs.

#### Acceptance Criteria

1. WHEN a user opens the upload dialog THEN the Question_Selection_System SHALL display three extraction mode options: Auto Extract, Manual Selection, and AI-Assisted
2. WHEN a user selects Auto Extract mode THEN the Question_Selection_System SHALL process the document using the existing Gemini AI extraction without additional user input
3. WHEN a user selects Manual Selection mode THEN the Question_Selection_System SHALL display the PDF_Viewer after document upload for manual text selection
4. WHEN a user selects AI-Assisted mode THEN the Question_Selection_System SHALL display AI_Suggestions on the PDF_Viewer for user validation

### Requirement 2

**User Story:** As a user, I want to view my uploaded PDF documents in the browser, so that I can see the original content while selecting questions.

#### Acceptance Criteria

1. WHEN a PDF document is uploaded in Manual Selection or AI-Assisted mode THEN the PDF_Viewer SHALL render the document with a selectable text layer
2. WHEN the PDF_Viewer renders a document THEN the Question_Selection_System SHALL display page navigation controls for multi-page documents
3. WHEN the PDF_Viewer renders a document THEN the Question_Selection_System SHALL support zoom controls for readability
4. IF the PDF_Viewer fails to render a document THEN the Question_Selection_System SHALL display an error message and offer to retry or switch to Auto Extract mode

### Requirement 3

**User Story:** As a user, I want to manually select text from the PDF to mark as questions or sections, so that I have full control over what gets extracted.

#### Acceptance Criteria

1. WHEN a user selects text in the PDF_Viewer THEN the Question_Selection_System SHALL highlight the selected text visually
2. WHEN text is selected THEN the Question_Selection_System SHALL display a context menu with options to tag as Section or Question
3. WHEN a user tags selected text as a Section THEN the Question_Selection_System SHALL add the Annotation to the Annotation_State with a blue highlight
4. WHEN a user tags selected text as a Question THEN the Question_Selection_System SHALL add the Annotation to the Annotation_State with a yellow highlight
5. WHEN an Annotation is created THEN the Question_Selection_System SHALL display the Annotation in a sidebar list

### Requirement 4

**User Story:** As a user, I want to manage my annotations before saving, so that I can correct mistakes and refine my selections.

#### Acceptance Criteria

1. WHEN annotations exist in the Annotation_State THEN the Question_Selection_System SHALL display a sidebar showing all sections and questions
2. WHEN a user clicks delete on an Annotation THEN the Question_Selection_System SHALL remove the Annotation from the Annotation_State and remove the highlight from the PDF_Viewer
3. WHEN a user clicks on an Annotation in the sidebar THEN the PDF_Viewer SHALL scroll to and highlight the corresponding text location
4. WHEN the Annotation_State is empty THEN the Question_Selection_System SHALL display a message prompting the user to select text or use AI suggestions

### Requirement 5

**User Story:** As a user, I want AI to suggest potential questions that I can accept or reject, so that I can work faster while maintaining control.

#### Acceptance Criteria

1. WHEN a user clicks the AI Suggest button in AI-Assisted mode THEN the Question_Selection_System SHALL analyze the document and generate AI_Suggestions
2. WHEN AI_Suggestions are generated THEN the Question_Selection_System SHALL display them as pulsing highlights on the PDF_Viewer distinct from permanent annotations
3. WHEN a user clicks on an AI_Suggestion THEN the Question_Selection_System SHALL convert the AI_Suggestion to a permanent Annotation
4. WHEN a user clicks Accept All THEN the Question_Selection_System SHALL convert all AI_Suggestions to permanent Annotations
5. WHEN a user clicks Clear Suggestions THEN the Question_Selection_System SHALL remove all AI_Suggestions without affecting permanent Annotations

### Requirement 6

**User Story:** As a user, I want to save my selected questions to the project, so that I can proceed with answering them.

#### Acceptance Criteria

1. WHEN a user clicks Save and Continue with annotations in the Annotation_State THEN the Question_Selection_System SHALL save all Annotations to the database as project questions
2. WHEN saving annotations THEN the Question_Selection_System SHALL organize questions under their associated sections
3. WHEN saving is complete THEN the Question_Selection_System SHALL navigate the user to the questions page showing the saved questions
4. IF saving fails THEN the Question_Selection_System SHALL display an error message and preserve the Annotation_State for retry

### Requirement 7

**User Story:** As a user, I want the system to remember my preferred extraction mode, so that I do not have to select it every time.

#### Acceptance Criteria

1. WHEN a user selects an Extraction_Mode THEN the Question_Selection_System SHALL store the preference in browser local storage
2. WHEN the upload dialog opens THEN the Question_Selection_System SHALL pre-select the previously used Extraction_Mode
3. WHEN no preference exists THEN the Question_Selection_System SHALL default to Auto Extract mode

