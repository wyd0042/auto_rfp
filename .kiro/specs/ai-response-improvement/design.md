# Design Document: AI Response Improvement

## Overview

This feature adds AI-powered text improvement capabilities to the AutoRFP question editor, allowing users to enhance AI-generated RFP responses with four actions: proofread, make professional, make concise, and convert to bullet points. The implementation adds an improvement toolbar to the existing question editor component, a new API route for text improvement, and a service that uses Gemini to process text transformations.

## Architecture

The feature follows the existing Next.js architecture with a React hook for state management, an API route for server-side processing, and a service layer for AI interactions.

```mermaid
graph TB
    subgraph "Question Editor"
        QE[QuestionEditor]
        IT[ImprovementToolbar]
    end
    
    subgraph "Hooks"
        UTI[useTextImprovement]
    end
    
    subgraph "API Layer"
        AR[/api/improve-text]
    end
    
    subgraph "Services"
        TIS[TextImprovementService]
        GEM[Gemini API]
    end
    
    QE --> IT
    IT --> UTI
    UTI --> AR
    AR --> TIS
    TIS --> GEM
```

## Components and Interfaces

### ImprovementToolbar Component

```typescript
interface ImprovementToolbarProps {
  text: string;
  onImprove: (improvedText: string) => void;
  disabled?: boolean;
}

type ImprovementAction = 'proofread' | 'make_professional' | 'make_concise' | 'convert_to_bullets';
```

The ImprovementToolbar displays four action buttons with icons and handles the improvement workflow including loading states and undo functionality.

### useTextImprovement Hook

```typescript
interface UseTextImprovementReturn {
  improve: (text: string, action: ImprovementAction) => Promise<string>;
  isLoading: boolean;
  error: string | null;
  canUndo: boolean;
  undo: () => string | null;
}

function useTextImprovement(): UseTextImprovementReturn
```

This hook manages the text improvement state, API calls, and undo history.

### TextImprovementService

```typescript
interface TextImprovementResult {
  improvedText: string;
  action: ImprovementAction;
  originalLength: number;
  improvedLength: number;
}

class TextImprovementService {
  improve(text: string, action: ImprovementAction): Promise<TextImprovementResult>;
}
```

Server-side service that calls Gemini with action-specific prompts.

### API Route

```typescript
// POST /api/improve-text
interface ImproveTextRequest {
  text: string;
  action: ImprovementAction;
}

interface ImproveTextResponse {
  improvedText: string;
  action: string;
  originalLength: number;
  improvedLength: number;
}
```

## Data Models

### Improvement Action Configuration

```typescript
const IMPROVEMENT_ACTIONS = {
  proofread: {
    id: 'proofread',
    label: 'Proofread',
    icon: 'SpellCheck',
    description: 'Fix grammar, spelling, and clarity'
  },
  make_professional: {
    id: 'make_professional',
    label: 'Professional',
    icon: 'Briefcase',
    description: 'Make formal and business-appropriate'
  },
  make_concise: {
    id: 'make_concise',
    label: 'Concise',
    icon: 'Minimize2',
    description: 'Reduce length, keep key info'
  },
  convert_to_bullets: {
    id: 'convert_to_bullets',
    label: 'Bullets',
    icon: 'List',
    description: 'Convert to bullet points'
  }
} as const;
```

### Undo State

```typescript
interface UndoState {
  previousText: string;
  action: ImprovementAction;
  timestamp: number;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Action Dispatch Correctness
*For any* improvement action type and non-empty text, calling the improve function SHALL send the text and action type to the API endpoint.
**Validates: Requirements 1.1, 2.1, 3.1, 4.1**

### Property 2: Successful Response Updates Answer
*For any* successful API response with improved text, the answer state SHALL be updated to contain the improved text.
**Validates: Requirements 1.2, 2.2, 3.2, 4.2**

### Property 3: Error Preserves Original Text
*For any* failed improvement action, the answer state SHALL remain unchanged from the original text.
**Validates: Requirements 1.4, 2.4, 3.4, 4.4**

### Property 4: Empty Text Disables Actions
*For any* empty or whitespace-only text, all improvement action buttons SHALL be disabled.
**Validates: Requirements 5.2**

### Property 5: Loading State Disables Actions
*For any* improvement action in progress (loading state true), all improvement action buttons SHALL be disabled.
**Validates: Requirements 1.3, 5.3**

### Property 6: Undo Round-Trip
*For any* successful improvement action, storing the original text and then calling undo SHALL restore the exact original text.
**Validates: Requirements 6.1, 6.2, 6.3**

### Property 7: Action-Specific Prompts
*For any* improvement action type, the service SHALL use a distinct prompt template corresponding to that action type.
**Validates: Requirements 7.3**

## Error Handling

1. **Empty Text**: Disable all action buttons when text is empty or whitespace-only
2. **API Failure**: Display toast error message, preserve original text, reset loading state
3. **Missing API Key**: Return 500 error with descriptive message about missing GEMINI_API_KEY
4. **Network Timeout**: Handle with appropriate error message after 30 second timeout
5. **Invalid Action**: Return 400 error for unrecognized action types

## Testing Strategy

### Property-Based Testing

The implementation will use fast-check for property-based testing to verify:
- Action dispatch sends correct parameters for all action types
- State management correctly handles success/error/loading states
- Undo functionality preserves and restores text correctly
- Button disabled states respond correctly to text and loading conditions

Each property-based test will be configured to run a minimum of 100 iterations.

### Unit Testing

Unit tests will cover:
- Service prompt generation for each action type
- API route request validation
- Hook state transitions
- Component rendering with various props

### Integration Testing

Integration tests will verify:
- End-to-end flow from button click to answer update
- Error handling displays correct UI feedback
- Undo functionality works across multiple improvements
