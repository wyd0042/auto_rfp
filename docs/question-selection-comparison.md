# Question Selection Comparison

## Overview

This document compares two approaches for extracting questions from RFP documents.

---

## Temp-RFP Project (2 Modes)

### Mode 1: Manual PDF Selection

**File:** `frontend/src/pages/PDFAnnotator.jsx`

**How it works:**
1. User uploads PDF → PDF renders in browser using `react-pdf`
2. User selects text by highlighting with mouse
3. User clicks button to tag selection as:
   - **Section** (blue highlight) - e.g., "1. BACKGROUND"
   - **Subsection** (green highlight) - e.g., "1.1 Requirements"
   - **Question** (yellow highlight) - actual RFP questions
4. Tagged items appear in sidebar with delete/undo options
5. User clicks "Extract & Create Project" to save

**Key Features:**
- In-browser PDF viewer with text layer
- Mouse text selection with visual feedback
- Persistent color-coded highlights
- Undo/delete individual tags
- Full user control over what becomes a question

### Mode 2: Auto-Detect with Suggestions

**File:** `frontend/src/pages/PDFAnnotator.jsx` (same file)

**How it works:**
1. User clicks "Auto-Detect" button
2. System scans PDF text layer using regex patterns:
   - Section: `^(\d{1,2})\.?\s+(\S.*)$` (e.g., "1.", "2.")
   - Subsection: `^(\d{1,2}(?:\.\d{1,3})+)\.?\s*(.*)$` (e.g., "1.1", "2.1.3")
3. Detected items appear as pulsing suggestions on PDF
4. User can:
   - Accept individual suggestions (click)
   - Accept all suggestions (button)
   - Clear all suggestions (button)
5. Accepted items become permanent annotations

**Key Features:**
- Regex-based pattern matching
- Visual suggestions with accept/reject
- Combines with manual selection
- User validates AI suggestions

---

## Current Project (1 Mode)

### Mode: Fully Automated LLM Extraction

**Files:**
- `app/projects/[projectId]/questions/components/upload-dialog.tsx`
- `lib/services/question-extraction-service.ts`
- `lib/services/gemini-question-extractor.ts`

**How it works:**
1. User uploads document via FileUploader component
2. Document parsed by LlamaParse (converts PDF to text)
3. Full text content sent to Gemini AI
4. Gemini extracts:
   - Sections with titles
   - Questions within each section
   - Document summary
   - Eligibility requirements
5. All extracted data saved to database automatically
6. Questions appear in UI immediately

**Key Features:**
- Zero manual work required
- AI determines what's a question
- Parallel extraction (questions + summary + eligibility)
- Fast processing

---

## Comparison Table

| Feature | Temp-RFP Manual | Temp-RFP Auto-Detect | Current Project |
|---------|-----------------|---------------------|-----------------|
| PDF Viewer | ✅ Yes | ✅ Yes | ❌ No |
| Manual Selection | ✅ Yes | ✅ Combined | ❌ No |
| AI/Pattern Detection | ❌ No | ✅ Regex | ✅ LLM (Gemini) |
| User Validation | ✅ Full control | ✅ Accept/Reject | ❌ None |
| Speed | Slow | Medium | Fast |
| Accuracy | High (human) | Medium (regex) | Variable (AI) |
| Effort Required | High | Low-Medium | None |

---

## Architecture Diagram

```
TEMP-RFP PROJECT:
┌─────────────────────────────────────────────────────────┐
│                    PDFAnnotator.jsx                      │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │  PDF Viewer │    │   Manual    │    │ Auto-Detect │ │
│  │  (react-pdf)│───▶│  Selection  │◀──▶│   (Regex)   │ │
│  └─────────────┘    └──────┬──────┘    └──────┬──────┘ │
│                            │                   │        │
│                            ▼                   ▼        │
│                    ┌───────────────────────────┐        │
│                    │   Annotations State       │        │
│                    │   (sections, questions)   │        │
│                    └───────────┬───────────────┘        │
│                                │                        │
│                                ▼                        │
│                    ┌───────────────────────────┐        │
│                    │   Create Project + Save   │        │
│                    └───────────────────────────┘        │
└─────────────────────────────────────────────────────────┘

CURRENT PROJECT:
┌─────────────────────────────────────────────────────────┐
│                    Upload Dialog                         │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │   Upload    │    │ LlamaParse  │    │   Gemini    │ │
│  │    File     │───▶│  (PDF→Text) │───▶│     AI      │ │
│  └─────────────┘    └─────────────┘    └──────┬──────┘ │
│                                               │        │
│                                               ▼        │
│                    ┌───────────────────────────┐        │
│                    │   Auto-extracted Data     │        │
│                    │   (sections, questions,   │        │
│                    │    summary, eligibility)  │        │
│                    └───────────┬───────────────┘        │
│                                │                        │
│                                ▼                        │
│                    ┌───────────────────────────┐        │
│                    │   Save to Database        │        │
│                    └───────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

---

## Recommendation

Consider adding a **hybrid approach** to current project:
1. Keep LLM extraction as default (fast)
2. Add PDF viewer for review
3. Allow users to edit/delete/add questions after extraction
4. Optional: Add manual selection mode for precision work
