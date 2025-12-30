# Implementation Plan

- [x] 1. Set up project dependencies and base structure





  - [x] 1.1 Install required dependencies (react-pdf, pdfjs-dist, fast-check)


    - Add react-pdf and pdfjs-dist for PDF rendering
    - Add fast-check for property-based testing
    - Configure pdfjs worker for Next.js
    - _Requirements: 2.1_

  - [x] 1.2 Create base type definitions and interfaces


    - Create Annotation, AnnotationState, ExtractionMode types
    - Create TextSelection, SaveAnnotationsRequest interfaces
    - Add to existing types folder
    - _Requirements: 3.3, 3.4, 6.1_

- [x] 2. Implement annotation state management





  - [x] 2.1 Create useAnnotationState hook
    - Implement addAnnotation, removeAnnotation functions
    - Implement setSuggestions, acceptSuggestion, acceptAllSuggestions, clearSuggestions
    - Implement getAnnotationState for save preparation
    - _Requirements: 3.3, 3.4, 4.2, 5.3, 5.4, 5.5_

  - [x] 2.2 Write property test for annotation addition


    - **Property 1: Annotation Addition Preserves Type**
    - **Validates: Requirements 3.3, 3.4**

  - [x] 2.3 Write property test for annotation deletion

    - **Property 3: Annotation Deletion Consistency**
    - **Validates: Requirements 4.2**

  - [x] 2.4 Write property test for suggestion acceptance

    - **Property 4: Suggestion Acceptance Transfers State**
    - **Validates: Requirements 5.3**


  - [x] 2.5 Write property test for accept all suggestions
    - **Property 5: Accept All Transfers All Suggestions**
    - **Validates: Requirements 5.4**


  - [x] 2.6 Write property test for clear suggestions

    - **Property 6: Clear Suggestions Preserves Annotations**
    - **Validates: Requirements 5.5**

- [x] 3. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement extraction mode selector





  - [x] 4.1 Create ExtractionModeSelector component


    - Create radio button group with Auto, Manual, AI-Assisted options
    - Add icons and descriptions for each mode
    - Handle mode change callback
    - _Requirements: 1.1_

  - [x] 4.2 Implement preference persistence


    - Create useExtractionPreference hook
    - Store preference in localStorage
    - Load preference on component mount
    - Default to 'auto' when no preference exists
    - _Requirements: 7.1, 7.2, 7.3_


  - [x] 4.3 Write property test for preference round-trip

    - **Property 8: Preference Round-Trip Consistency**
    - **Validates: Requirements 7.1, 7.2**

- [x] 5. Implement PDF viewer component





  - [x] 5.1 Create PDFViewer component with react-pdf


    - Set up Document and Page components from react-pdf
    - Configure text layer for selection
    - Handle PDF loading states and errors
    - _Requirements: 2.1, 2.4_


  - [x] 5.2 Add page navigation controls

    - Implement previous/next page buttons
    - Add page number display and input
    - Handle multi-page document navigation
    - _Requirements: 2.2_


  - [x] 5.3 Add zoom controls

    - Implement zoom in/out buttons
    - Add zoom level display
    - Support fit-to-width option
    - _Requirements: 2.3_


  - [x] 5.4 Implement text selection handling

















    - Capture text selection events from PDF text layer
    - Extract selection text, page number, and bounding rect
    - Trigger onTextSelect callback with selection data
    - _Requirements: 3.1_

- [x] 6. Implement selection context menu





  - [x] 6.1 Create SelectionContextMenu component


    - Create popup menu with Section and Question options
    - Position menu near selection
    - Handle click outside to close
    - _Requirements: 3.2_

  - [x] 6.2 Integrate context menu with PDF viewer


    - Show context menu on text selection
    - Pass selection data to tag handlers
    - Close menu after selection
    - _Requirements: 3.2, 3.3, 3.4_

- [x] 7. Implement annotation highlights





  - [x] 7.1 Create AnnotationHighlight component


    - Render colored overlay on PDF for annotations
    - Use blue for sections, yellow for questions
    - Support pulsing animation for AI suggestions
    - _Requirements: 3.3, 3.4, 5.2_

  - [x] 7.2 Integrate highlights with PDF viewer


    - Overlay highlights on PDF pages
    - Update highlights when annotations change
    - Handle click events on highlights
    - _Requirements: 3.3, 3.4, 5.3_

- [x] 8. Implement annotation sidebar











  - [x] 8.1 Create AnnotationSidebar component


    - Display list of sections and questions
    - Show annotation text and type with color coding
    - Add delete button for each annotation
    - _Requirements: 3.5, 4.1_

  - [x] 8.2 Write property test for annotation state completeness




    - **Property 2: Annotation State Completeness**
    - **Validates: Requirements 3.5, 4.1**

  - [x] 8.3 Add navigation functionality


    - Implement click-to-navigate to annotation location
    - Scroll PDF viewer to annotation page
    - Highlight selected annotation
    - _Requirements: 4.3_

  - [x] 8.4 Add AI suggestion controls (for AI-Assisted mode)


    - Add Accept All button
    - Add Clear Suggestions button
    - Show suggestion count
    - _Requirements: 5.4, 5.5_

  - [x] 8.5 Handle empty state


    - Display message when no annotations exist
    - Prompt user to select text or use AI suggestions
    - _Requirements: 4.4_

- [x] 9. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.


- [x] 10. Implement PDF annotator container




  - [x] 10.1 Create PDFAnnotator component


    - Combine PDFViewer, AnnotationSidebar, and context menu
    - Manage annotation state with useAnnotationState hook
    - Handle mode-specific behavior (manual vs AI-assisted)
    - _Requirements: 1.3, 1.4_


  - [x] 10.2 Add toolbar with action buttons

    - Add AI Suggest button (AI-Assisted mode only)
    - Add Save and Continue button
    - Add Cancel button
    - _Requirements: 5.1, 6.1_

- [x] 11. Implement AI suggestion service





  - [x] 11.1 Create AI suggestion service


    - Create generateSuggestions function using Gemini
    - Return suggested annotations with text, type, and confidence
    - Handle errors gracefully
    - _Requirements: 5.1_

  - [x] 11.2 Create API endpoint for AI suggestions


    - Create /api/ai-suggestions endpoint
    - Accept document content and return suggestions
    - Integrate with existing Gemini service
    - _Requirements: 5.1_

  - [x] 11.3 Integrate AI suggestions with PDFAnnotator


    - Call AI suggestion service on button click
    - Display suggestions as pulsing highlights
    - Allow accepting individual or all suggestions
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 12. Implement save functionality





  - [x] 12.1 Create save annotations function


    - Transform annotation state to save request format
    - Organize questions under sections
    - Call existing save questions API
    - _Requirements: 6.1, 6.2_


  - [x] 12.2 Write property test for save organization

    - **Property 7: Save Organizes Questions Under Sections**
    - **Validates: Requirements 6.1, 6.2**

  - [x] 12.3 Handle save completion and errors


    - Navigate to questions page on success
    - Display error message on failure
    - Preserve annotation state for retry
    - _Requirements: 6.3, 6.4_

- [ ] 13. Enhance upload dialog





  - [x] 13.1 Integrate ExtractionModeSelector into upload dialog


    - Add mode selector above file upload
    - Store selected mode in component state
    - _Requirements: 1.1_

  - [x] 13.2 Implement mode routing logic


    - Route to existing flow for Auto Extract mode
    - Show PDFAnnotator for Manual and AI-Assisted modes
    - Pass PDF data to annotator after upload
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 13.3 Handle PDF data for annotator modes


    - Store PDF ArrayBuffer after LlamaParse processing
    - Pass PDF data and text content to PDFAnnotator
    - Handle mode switching during upload
    - _Requirements: 2.1_


- [x] 14. Checkpoint - Ensure all tests pass







  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Final integration and polish






  - [x] 15.1 Add loading states and transitions

    - Add loading spinner during PDF load
    - Add loading state during AI suggestion generation
    - Add saving indicator during save
    - _Requirements: 2.1, 5.1, 6.1_


  - [x] 15.2 Add keyboard shortcuts

    - Add Escape to close context menu
    - Add keyboard navigation for sidebar
    - _Requirements: 3.2, 4.3_


  - [x] 15.3 Write integration tests for complete flows

    - Test Auto Extract mode end-to-end
    - Test Manual Selection mode end-to-end
    - Test AI-Assisted mode end-to-end
    - _Requirements: 1.2, 1.3, 1.4_



- [x] 16. Final Checkpoint - Ensure all tests pass








  - Ensure all tests pass, ask the user if questions arise.

