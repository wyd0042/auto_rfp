# Design Document: Hybrid Question Selection

## Overview

This design document describes the architecture and implementation of a hybrid question selection system for the AutoRFP application. The system extends the current automatic AI extraction with two additional modes: Manual Selection and AI-Assisted. Users can choose their preferred extraction method based on their needs for speed versus control.

The implementation leverages the existing LlamaParse integration for PDF text extraction and adds a new PDF viewer component using react-pdf for in-browser document rendering. The annotation system manages user selections and AI suggestions through a unified state model.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Upload Dialog (Enhanced)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐                                                        │
│  │  Mode Selector  │  [Auto Extract] [Manual Selection] [AI-Assisted]       │
│  └────────┬────────┘                                                        │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     File Upload Component                            │   │
│  │                     (Existing FileUploader)                          │   │
│  └────────┬────────────────────────────────────────────────────────────┘   │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Mode Router                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │ Auto Extract │  │   Manual     │  │ AI-Assisted  │               │   │
│  │  │   (Current)  │  │  Selection   │  │    Mode      │               │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │   │
│  └─────────┼─────────────────┼─────────────────┼───────────────────────┘   │
│            │                 │                 │                            │
│            ▼                 ▼                 ▼                            │
│  ┌─────────────────┐  ┌─────────────────────────────────────────────┐      │
│  │ Gemini Extract  │  │           PDF Annotator View                 │      │
│  │   (Existing)    │  │  ┌─────────────────┐  ┌─────────────────┐   │      │
│  └────────┬────────┘  │  │   PDF Viewer    │  │ Annotation      │   │      │
│           │           │  │   (react-pdf)   │  │ Sidebar         │   │      │
│           │           │  └─────────────────┘  └─────────────────┘   │      │
│           │           └─────────────────────────────────────────────┘      │
│           │                          │                                      │
│           ▼                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Save Questions API                                │   │
│  │                    (Existing endpoint)                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. ExtractionModeSelector Component

A radio button group for selecting the extraction mode.

```typescript
interface ExtractionModeSelectorProps {
  selectedMode: ExtractionMode;
  onModeChange: (mode: ExtractionMode) => void;
}

type ExtractionMode = 'auto' | 'manual' | 'ai-assisted';
```

### 2. PDFAnnotator Component

The main container for manual and AI-assisted modes, combining the PDF viewer with annotation management.

```typescript
interface PDFAnnotatorProps {
  pdfUrl: string;
  pdfData: ArrayBuffer;
  documentName: string;
  mode: 'manual' | 'ai-assisted';
  onSave: (annotations: AnnotationState) => void;
  onCancel: () => void;
}
```

### 3. PDFViewer Component

Renders the PDF document with text selection capabilities using react-pdf.

```typescript
interface PDFViewerProps {
  pdfData: ArrayBuffer;
  currentPage: number;
  zoom: number;
  annotations: Annotation[];
  suggestions: Annotation[];
  onTextSelect: (selection: TextSelection) => void;
  onAnnotationClick: (annotation: Annotation) => void;
  onSuggestionClick: (suggestion: Annotation) => void;
}

interface TextSelection {
  text: string;
  pageNumber: number;
  boundingRect: DOMRect;
  startOffset: number;
  endOffset: number;
}
```

### 4. AnnotationSidebar Component

Displays and manages the list of annotations.

```typescript
interface AnnotationSidebarProps {
  annotations: Annotation[];
  onDelete: (id: string) => void;
  onNavigate: (id: string) => void;
  onAcceptAll?: () => void;
  onClearSuggestions?: () => void;
  suggestions?: Annotation[];
  mode: 'manual' | 'ai-assisted';
}
```

### 5. SelectionContextMenu Component

Popup menu for tagging selected text.

```typescript
interface SelectionContextMenuProps {
  position: { x: number; y: number };
  onTagAsSection: () => void;
  onTagAsQuestion: () => void;
  onClose: () => void;
}
```

### 6. useAnnotationState Hook

Custom hook for managing annotation state.

```typescript
interface UseAnnotationStateReturn {
  annotations: Annotation[];
  suggestions: Annotation[];
  addAnnotation: (annotation: Omit<Annotation, 'id'>) => void;
  removeAnnotation: (id: string) => void;
  setSuggestions: (suggestions: Annotation[]) => void;
  acceptSuggestion: (id: string) => void;
  acceptAllSuggestions: () => void;
  clearSuggestions: () => void;
  getAnnotationState: () => AnnotationState;
}
```

### 7. AI Suggestion Service

Backend service for generating question suggestions.

```typescript
interface AISuggestionService {
  generateSuggestions(content: string, documentName: string): Promise<SuggestedAnnotation[]>;
}

interface SuggestedAnnotation {
  text: string;
  type: 'section' | 'question';
  confidence: number;
  pageNumber?: number;
}
```

## Data Models

### Annotation

```typescript
interface Annotation {
  id: string;
  type: 'section' | 'question';
  text: string;
  pageNumber: number;
  boundingRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  createdAt: Date;
  source: 'manual' | 'ai-suggestion';
}
```

### AnnotationState

```typescript
interface AnnotationState {
  sections: Annotation[];
  questions: Annotation[];
}
```

### ExtractionPreference

```typescript
interface ExtractionPreference {
  mode: ExtractionMode;
  lastUsed: Date;
}
```

### SaveAnnotationsRequest

```typescript
interface SaveAnnotationsRequest {
  projectId: string;
  documentName: string;
  sections: {
    title: string;
    questions: {
      text: string;
      referenceId?: string;
    }[];
  }[];
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following properties have been identified for property-based testing:

### Property 1: Annotation Addition Preserves Type

*For any* text selection and tag type (section or question), when the selection is tagged, the resulting annotation in the Annotation_State SHALL have the correct type and contain the selected text.

**Validates: Requirements 3.3, 3.4**

### Property 2: Annotation State Completeness

*For any* set of annotations in the Annotation_State, the sidebar SHALL display exactly all annotations - no more, no less.

**Validates: Requirements 3.5, 4.1**

### Property 3: Annotation Deletion Consistency

*For any* annotation in the Annotation_State, deleting it SHALL result in the annotation being removed from the state, and the state length SHALL decrease by exactly one.

**Validates: Requirements 4.2**

### Property 4: Suggestion Acceptance Transfers State

*For any* AI suggestion, accepting it SHALL remove it from the suggestions list and add it to the annotations list with the same text and type.

**Validates: Requirements 5.3**

### Property 5: Accept All Transfers All Suggestions

*For any* set of AI suggestions, accepting all SHALL result in an empty suggestions list and all suggestions being added to annotations.

**Validates: Requirements 5.4**

### Property 6: Clear Suggestions Preserves Annotations

*For any* annotation state with both annotations and suggestions, clearing suggestions SHALL remove all suggestions while leaving all annotations unchanged.

**Validates: Requirements 5.5**

### Property 7: Save Organizes Questions Under Sections

*For any* annotation state with sections and questions, saving SHALL produce a data structure where each question is associated with a section, and no questions are orphaned.

**Validates: Requirements 6.1, 6.2**

### Property 8: Preference Round-Trip Consistency

*For any* extraction mode preference, storing it and then loading it SHALL return the same mode value.

**Validates: Requirements 7.1, 7.2**

## Error Handling

### PDF Loading Errors

- If PDF fails to load, display error message with options to retry or switch to Auto Extract mode
- Log error details for debugging
- Preserve any user selections made before error

### AI Suggestion Errors

- If AI suggestion generation fails, display error toast and allow manual selection to continue
- Implement timeout handling for long-running AI requests
- Provide fallback to manual mode if AI service is unavailable

### Save Errors

- If save fails, preserve annotation state in memory and local storage
- Display error message with retry option
- Log error details for debugging

### Text Selection Errors

- Handle edge cases where text layer is not available
- Gracefully handle selections that span multiple pages
- Validate selection bounds before creating annotation

## Testing Strategy

### Property-Based Testing

The project will use **fast-check** as the property-based testing library for TypeScript/JavaScript.

Each correctness property will be implemented as a property-based test with the following requirements:
- Minimum 100 iterations per property test
- Each test tagged with format: `**Feature: hybrid-question-selection, Property {number}: {property_text}**`
- Smart generators that constrain to valid input space

### Unit Tests

Unit tests will cover:
- Component rendering for each mode
- State transitions in useAnnotationState hook
- PDF viewer controls (zoom, page navigation)
- Context menu positioning and actions
- Local storage preference persistence

### Integration Tests

Integration tests will verify:
- End-to-end flow for each extraction mode
- PDF upload and rendering pipeline
- Save annotations to database flow
- Mode switching behavior

### Test File Structure

```
tests/
├── unit/
│   ├── components/
│   │   ├── extraction-mode-selector.test.tsx
│   │   ├── pdf-annotator.test.tsx
│   │   ├── annotation-sidebar.test.tsx
│   │   └── selection-context-menu.test.tsx
│   └── hooks/
│       └── use-annotation-state.test.ts
├── property/
│   └── annotation-state.property.test.ts
└── integration/
    └── question-selection-flow.test.ts
```

## Implementation Notes

### Dependencies to Add

```json
{
  "react-pdf": "^9.1.0",
  "pdfjs-dist": "^4.0.0",
  "fast-check": "^3.15.0"
}
```

### File Structure

```
app/projects/[projectId]/questions/components/
├── upload-dialog.tsx (enhanced)
├── extraction-mode-selector.tsx (new)
├── pdf-annotator/
│   ├── index.tsx
│   ├── pdf-viewer.tsx
│   ├── annotation-sidebar.tsx
│   ├── selection-context-menu.tsx
│   └── annotation-highlight.tsx
└── hooks/
    └── use-annotation-state.ts

lib/services/
└── ai-suggestion-service.ts (new)
```

### State Management

The annotation state will be managed using React's useState and useReducer hooks within the PDFAnnotator component. The state will be lifted to the upload dialog for coordination with the save flow.

### Local Storage Keys

- `rfp-extraction-mode-preference`: Stores the user's preferred extraction mode

