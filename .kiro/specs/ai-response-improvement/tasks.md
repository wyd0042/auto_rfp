# Implementation Plan

- [x] 1. Create Text Improvement Service






  - [x] 1.1 Create TextImprovementService class

    - Create `lib/services/text-improvement-service.ts`
    - Initialize Gemini client with API key validation
    - Implement `improve(text: string, action: ImprovementAction)` method
    - Create action-specific prompts for proofread, make_professional, make_concise, convert_to_bullets
    - Return TextImprovementResult with improved text and metadata
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 7.1, 7.3_

  - [x] 1.2 Write property test for action-specific prompts


    - **Property 7: Action-Specific Prompts**
    - **Validates: Requirements 7.3**

- [x] 2. Create API Route









  - [x] 2.1 Create improve-text API endpoint


    - Create `app/api/improve-text/route.ts`
    - Validate request body (text and action required)
    - Validate text length (min 10, max 10000 characters)
    - Call TextImprovementService
    - Return ImproveTextResponse with improved text
    - Handle errors with appropriate status codes
    - _Requirements: 1.1, 1.4, 2.1, 2.4, 3.1, 3.4, 4.1, 4.4, 7.2_

- [x] 3. Create useTextImprovement Hook








  - [x] 3.1 Implement useTextImprovement hook

    - Create `hooks/use-text-improvement.ts`
    - Manage loading state during API calls
    - Manage error state for failed requests
    - Implement undo state storage (previousText, action, timestamp)
    - Implement `improve(text, action)` function that calls API
    - Implement `undo()` function that returns stored previous text
    - Implement `canUndo` computed property
    - _Requirements: 1.2, 1.3, 1.4, 6.1, 6.2, 6.3, 6.4_

  - [x] 3.2 Write property test for undo round-trip




    - **Property 6: Undo Round-Trip**
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [x] 3.3 Write property test for error preserves original text


    - **Property 3: Error Preserves Original Text**
    - **Validates: Requirements 1.4, 2.4, 3.4, 4.4**

- [x] 4. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create ImprovementToolbar Component










  - [x] 5.1 Implement ImprovementToolbar component



    - Create `components/ui/improvement-toolbar.tsx`
    - Display four action buttons with icons (SpellCheck, Briefcase, Minimize2, List)
    - Show loading spinner on active button during improvement
    - Disable all buttons when text is empty or loading
    - Show undo button when canUndo is true
    - Call onImprove callback with improved text on success
    - Display toast notifications for success and error states
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 5.2 Write property test for empty text disables actions




    - **Property 4: Empty Text Disables Actions**
    - **Validates: Requirements 5.2**

  - [x] 5.3 Write property test for loading state disables actions


    - **Property 5: Loading State Disables Actions**
    - **Validates: Requirements 1.3, 5.3**

- [x] 6. Integrate with Question Editor





  - [x] 6.1 Add ImprovementToolbar to QuestionEditor


    - Import ImprovementToolbar and useTextImprovement in `question-editor.tsx`
    - Add toolbar below the textarea, above the preview
    - Connect toolbar to answer state via onImprove callback
    - Pass current answer text to toolbar
    - Mark answer as unsaved when improvement is applied
    - _Requirements: 1.2, 2.2, 3.2, 4.2, 5.1_

  - [x] 6.2 Write property test for successful response updates answer


    - **Property 2: Successful Response Updates Answer**
    - **Validates: Requirements 1.2, 2.2, 3.2, 4.2**

- [x] 7. Final Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
