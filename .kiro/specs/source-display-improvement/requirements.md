# Requirements Document

## Introduction

This feature improves the source display functionality in the AutoRFP application to provide users with better visibility and control over AI-generated response sources. Currently, users cannot easily see or select between different sources when multiple are found, and there is no clear indication when no sources are available (which could lead to hallucinated responses). The goal is to make sources selectable, display relevance information, and clearly warn users when no sources are found to avoid AI hallucination.

## Glossary

- **Source_Display_System**: The component responsible for showing source documents used to generate AI responses
- **Source_Panel**: A collapsible sidebar panel that displays all available sources for a question's answer
- **Source_Card**: An individual card component displaying source details including file name, relevance score, and text content
- **No_Source_Warning**: A visual alert displayed when AI generates a response without any supporting source documents
- **Relevance_Score**: A percentage indicating how relevant a source document is to the question being answered
- **Source_Selection**: The ability for users to click on a source to view its full details and optionally use its content

## Requirements

### Requirement 1

**User Story:** As a user, I want to see all available sources for an AI-generated answer in a dedicated panel, so that I can understand what documents informed the response.

#### Acceptance Criteria

1. WHEN an AI response is generated with sources THEN the Source_Display_System SHALL display a collapsible Source_Panel showing all available sources
2. WHEN the Source_Panel is displayed THEN the Source_Display_System SHALL show the total count of sources found
3. WHEN sources are available THEN the Source_Display_System SHALL display each source as a Source_Card with file name, relevance score, and text preview
4. WHEN a user clicks the toggle button THEN the Source_Display_System SHALL expand or collapse the Source_Panel

### Requirement 2

**User Story:** As a user, I want to select and view individual sources in detail, so that I can verify the information used in the AI response.

#### Acceptance Criteria

1. WHEN a user clicks on a Source_Card THEN the Source_Display_System SHALL highlight the selected source visually
2. WHEN a source is selected THEN the Source_Display_System SHALL display the full source details in a dialog or expanded view
3. WHEN viewing source details THEN the Source_Display_System SHALL show file name, page number, relevance score, and full text content
4. WHEN multiple sources exist THEN the Source_Display_System SHALL allow users to navigate between sources

### Requirement 3

**User Story:** As a user, I want to be clearly warned when no sources are found, so that I can identify potentially hallucinated responses.

#### Acceptance Criteria

1. WHEN an AI response is generated with zero sources THEN the Source_Display_System SHALL display a prominent No_Source_Warning alert
2. WHEN the No_Source_Warning is displayed THEN the Source_Display_System SHALL use a distinct visual style with amber or red coloring
3. WHEN no sources are found THEN the Source_Display_System SHALL display a message explaining the response may not be grounded in documents
4. WHEN no sources are found THEN the Source_Display_System SHALL suggest actions such as adding more documents or refining the question

### Requirement 4

**User Story:** As a user, I want to see relevance scores for each source, so that I can prioritize reviewing the most relevant documents.

#### Acceptance Criteria

1. WHEN sources are displayed THEN the Source_Display_System SHALL show a visual relevance indicator for each source
2. WHEN displaying relevance THEN the Source_Display_System SHALL use a progress bar or percentage display
3. WHEN sources have varying relevance THEN the Source_Display_System SHALL sort sources by relevance score in descending order
4. WHEN a source has high relevance above 70 percent THEN the Source_Display_System SHALL display a green indicator
5. WHEN a source has medium relevance between 40 and 70 percent THEN the Source_Display_System SHALL display an amber indicator
6. WHEN a source has low relevance below 40 percent THEN the Source_Display_System SHALL display a red indicator

### Requirement 5

**User Story:** As a user, I want to use content from a source directly in my answer, so that I can incorporate verified information efficiently.

#### Acceptance Criteria

1. WHEN viewing a source in the Source_Panel THEN the Source_Display_System SHALL display a Use button for each source
2. WHEN a user clicks the Use button THEN the Source_Display_System SHALL append the source text content to the current answer
3. WHEN content is added from a source THEN the Source_Display_System SHALL display a confirmation notification
4. WHEN a source has no text content THEN the Source_Display_System SHALL disable the Use button and display a tooltip explaining why

### Requirement 6

**User Story:** As a user, I want the source panel to persist my preference for expanded or collapsed state, so that I do not have to toggle it repeatedly.

#### Acceptance Criteria

1. WHEN a user expands or collapses the Source_Panel THEN the Source_Display_System SHALL store the preference in browser local storage
2. WHEN the questions page loads THEN the Source_Display_System SHALL restore the previously saved Source_Panel state
3. WHEN no preference exists THEN the Source_Display_System SHALL default to collapsed state
