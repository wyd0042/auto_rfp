# Implementation Plan

- [x] 1. Create utility functions and types





  - [x] 1.1 Create relevance color utility function


    - Create `lib/utils/source-utils.ts` with `getRelevanceColor` function
    - Implement color mapping: green (≥70), amber (40-70), red (<40 or null)
    - Export type `RelevanceColor = 'green' | 'amber' | 'red'`
    - _Requirements: 4.4, 4.5, 4.6_

  - [x] 1.2 Write property test for relevance color mapping


    - **Property 3: Relevance Color Mapping**
    - **Validates: Requirements 4.4, 4.5, 4.6**

  - [x] 1.3 Create source sorting utility function

    - Add `sortSourcesByRelevance` function to `lib/utils/source-utils.ts`
    - Sort sources by relevance in descending order
    - Handle null/undefined relevance values (treat as 0)
    - _Requirements: 4.3_

  - [x] 1.4 Write property test for source sorting

    - **Property 2: Source Sorting by Relevance**
    - **Validates: Requirements 4.3**

- [x] 2. Create useSourcePanel hook





  - [x] 2.1 Implement useSourcePanel hook


    - Create `hooks/use-source-panel.ts`
    - Manage expanded/collapsed state
    - Persist state to localStorage with key `autorpf_source_panel_expanded`
    - Default to collapsed when no preference exists
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 2.2 Write property test for panel state round-trip


    - **Property 6: Panel State Round-Trip**
    - **Validates: Requirements 6.1, 6.2**

- [x] 3. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create NoSourceWarning component






  - [x] 4.1 Implement NoSourceWarning component

    - Create `components/ui/no-source-warning.tsx`
    - Display prominent amber/red alert with warning icon
    - Show message about potential hallucination
    - Include action suggestions (add documents, refine question)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 5. Create SourceCard component






  - [x] 5.1 Implement SourceCard component

    - Create `components/ui/source-card.tsx`
    - Display file name, relevance score with color indicator, text preview
    - Include "Use" button to append content
    - Disable "Use" button when textContent is empty/null
    - Handle click to select source
    - _Requirements: 1.3, 2.1, 4.1, 5.1, 5.4_


  - [x] 5.2 Write property test for Use button disabled state

    - **Property 4: Use Button Disabled State**
    - **Validates: Requirements 5.4**

- [x] 6. Create SourcePanel component





  - [x] 6.1 Implement SourcePanel component


    - Create `components/ui/source-panel.tsx`
    - Collapsible panel with toggle button
    - Display source count in header
    - Render SourceCard for each source (sorted by relevance)
    - Show NoSourceWarning when sources array is empty
    - _Requirements: 1.1, 1.2, 1.4, 3.1_

  - [x] 6.2 Write property test for source count accuracy


    - **Property 1: Source Count Accuracy**
    - **Validates: Requirements 1.2**

  - [x] 6.3 Write property test for no source warning display


    - **Property 7: No Source Warning Display**
    - **Validates: Requirements 3.1**

- [x] 7. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Integrate with QuestionEditor






  - [x] 8.1 Update QuestionEditor to use SourcePanel

    - Import and integrate SourcePanel component
    - Connect useSourcePanel hook for state management
    - Implement onUseContent handler to append source text to answer
    - Wire up source selection to existing SourceDetailsDialog
    - _Requirements: 1.1, 2.2, 5.2, 5.3_


  - [x] 8.2 Write property test for content append behavior

    - **Property 5: Content Append Behavior**
    - **Validates: Requirements 5.2**

- [x] 9. Update QuestionsProvider for source navigation






  - [x] 9.1 Add source navigation state to QuestionsProvider

    - Add selectedSourceIndex state
    - Implement navigation between sources (next/previous)
    - _Requirements: 2.4_

- [ ] 10. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
