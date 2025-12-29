# Implementation Plan

- [x] 1. Update dependencies and configuration
  - [x] 1.1 Update package.json to replace OpenAI with Gemini SDK
    - Remove `openai` and `@ai-sdk/openai` from dependencies
    - Add `@google/generative-ai` package
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 1.2 Update constants file with Gemini model name
    - Change `DEFAULT_LANGUAGE_MODEL` from `gpt-4o-mini` to `gemini-2.5-flash`
    - _Requirements: 5.3_

- [x] 2. Implement Gemini Question Extractor











  - [x] 2.1 Create GeminiQuestionExtractor service




    - Rename `openai-question-extractor.ts` to `gemini-question-extractor.ts`
    - Replace OpenAI client with GoogleGenerativeAI client
    - Update all API calls to use Gemini's `generateContent` method
    - Add API key validation that throws error when `GEMINI_API_KEY` is not set
    - Maintain the same interface (IAIQuestionExtractor)
    - Update any files that import from `openai-question-extractor` to use the new file
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 2.2 Write property test for Question Extractor output validity






    - **Property 2: Question Extractor Output Validity**
    - **Validates: Requirements 2.2, 2.3, 2.4**

- [x] 3. Update Multi-Step Response Service
















  - [x] 3.1 Replace OpenAI with Gemini in MultiStepResponseService



    - Update imports to use `@google/generative-ai`
    - Replace OpenAI client initialization with Gemini client
    - Add API key validation that throws error when `GEMINI_API_KEY` is not set
    - Update `analyzeQuestionWithAI` to use Gemini's `generateContent` method
    - Update `extractInformationWithAI` to use Gemini's `generateContent` method
    - Update `synthesizeResponseWithAI` to use Gemini's `generateContent` method
    - Update `validateResponseWithAI` to use Gemini's `generateContent` method
    - Update metadata `modelUsed` to reference Gemini model instead of `gpt-4o`
    - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 3.2 Write property test for Multi-Step Service step output validity












    - **Property 3: Multi-Step Service Step Output Validity**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [x] 3.3 Write property test for JSON parsing from markdown code blocks





    - **Property 4: JSON Parsing from Markdown Code Blocks**
    - **Validates: Requirements 3.5**



- [x] 4. Checkpoint - Ensure all tests pass






  - Ensure all tests pass, ask the user if questions arise.


- [x] 5. Update documentation




  - [x] 5.1 Update README.md with Gemini setup instructions







    - Replace OpenAI references with Gemini in Tech Stack section
    - Update Prerequisites to reference Google AI Studio instead of OpenAI
    - Update environment variable examples to use `GEMINI_API_KEY`
    - Update OpenAI Setup section to Gemini Setup with Google AI Studio instructions
    - Update AI Processing Pipeline description
    - Update Troubleshooting section
    - _Requirements: 5.1_


  - [x] 5.2 Update GETTING_STARTED.md with Gemini configuration





    - Replace `OPENAI_API_KEY` with `GEMINI_API_KEY` in Prerequisites and .env example
    - Update troubleshooting section to reference Gemini
    - _Requirements: 5.2_



- [x] 6. Final Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
