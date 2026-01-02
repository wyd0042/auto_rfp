# AI4RFP - Complete Project Overview

## What This Application Does

**AI4RFP** is an AI-powered RFP (Request for Proposal) response platform. It helps organizations respond to RFPs 80% faster by:

1. **Automatically extracting questions** from uploaded RFP documents
2. **Generating contextual AI responses** based on your organization's knowledge base
3. **Multi-step AI reasoning** that analyzes, searches, extracts, and synthesizes professional responses

---

## Supported File Types

The application currently supports:

| File Type | Extension | Processing |
|-----------|-----------|------------|
| PDF | `.pdf` | LlamaParse → Gemini extraction |
| Excel | `.xlsx`, `.xls` | LlamaParse → Gemini extraction |
| CSV | `.csv` | LlamaParse → Gemini extraction |

**How it works:**
1. User uploads a file (PDF, Excel, or CSV)
2. **LlamaParse** converts the document to text/markdown
3. **Gemini AI** extracts structured questions from the content
4. Questions are stored in the database for response generation

> Note: Word (.docx) and PowerPoint (.pptx) are mentioned in the README but not currently implemented in the FileUploader component.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS, Radix UI (shadcn/ui) |
| Auth | Supabase Auth (Magic Link + Email/Password) |
| Database | PostgreSQL + Prisma ORM |
| AI/ML | Google Gemini, LlamaIndex, LlamaCloud |
| Testing | Vitest |
| Package Manager | pnpm |

---

## How the Application Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER WORKFLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. LOGIN → 2. CREATE ORG → 3. CREATE PROJECT → 4. UPLOAD RFP  │
│                                                                 │
│                           ↓                                     │
│                                                                 │
│  5. AI EXTRACTS QUESTIONS → 6. AI GENERATES RESPONSES          │
│                                                                 │
│                           ↓                                     │
│                                                                 │
│  7. REVIEW/EDIT RESPONSES → 8. EXPORT                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### AI Processing Pipeline

1. User uploads RFP document
2. **Gemini** extracts structured questions from the document
3. **LlamaCloud** indexes your organization's documents for search
4. **Multi-step AI** generates responses (analyze → search → extract → synthesize)
5. Responses include source citations from your knowledge base

---

## Project Structure

```
ai4rfp/
├── app/                    # Next.js App Router
│   ├── api/               # Backend API routes
│   │   ├── extract-questions/    # Question extraction
│   │   ├── generate-response/    # AI response generation
│   │   ├── llamacloud/          # Document indexing
│   │   ├── organizations/       # Org management
│   │   └── projects/            # Project management
│   ├── login/             # Authentication pages
│   ├── organizations/     # Org dashboard pages
│   └── projects/          # Project pages
├── components/            # React components
├── lib/                   # Core business logic
│   ├── services/         # AI services, auth, etc.
│   └── validators/       # Zod schemas
├── prisma/               # Database schema
└── .kiro/specs/          # Feature specifications
```

---

## Database Models

The application uses a multi-tenant architecture:

- **User** - Authenticated users
- **Organization** - Tenant organizations
- **OrganizationUser** - User-organization relationships with roles (owner, admin, member)
- **Project** - RFP projects within organizations
- **Question** - Extracted RFP questions
- **Answer** - AI-generated responses with sources
- **ProjectIndex** - LlamaCloud document indexes

---

## Authentication Flow

1. **Magic Link Authentication** - Users sign in via email magic links
2. **Email/Password Authentication** - Alternative login with credentials (in development)
3. **Organization Creation** - New users can create organizations
4. **Team Invitations** - Organization owners can invite team members
5. **Role-based Access** - Support for owner, admin, and member roles

---

## Existing Feature Specs

| Spec | Status | Purpose |
|------|--------|---------|
| `gemini-integration` | ✅ Complete | Replaced OpenAI with Google Gemini |
| `email-password-auth` | 📝 In Progress | Adding email/password login option |

---

## How Specs Work

Specs are a structured way to develop features through three phases:

1. **Requirements** (`requirements.md`) - EARS-formatted user stories and acceptance criteria
2. **Design** (`design.md`) - Architecture, components, data models, correctness properties
3. **Tasks** (`tasks.md`) - Actionable implementation checklist

Each phase requires explicit approval before moving to the next.

---

## API Endpoints

### Core APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/organizations` | POST | Create organization |
| `/api/organizations/{id}` | GET | Get organization details |
| `/api/projects` | POST | Create project |
| `/api/extract-questions` | POST | Extract questions from documents |
| `/api/generate-response` | POST | Generate AI responses |
| `/api/generate-response-multistep` | POST | Multi-step response generation |

### LlamaCloud Integration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/llamacloud/projects` | GET | Get available LlamaCloud projects |
| `/api/llamacloud/connect` | POST | Connect organization to LlamaCloud |
| `/api/llamacloud/disconnect` | POST | Disconnect from LlamaCloud |
| `/api/llamacloud/documents` | GET | Get organization documents |

---

## Getting Started

```bash
# 1. Install dependencies
pnpm install

# 2. Set up .env file with required variables:
#    - DATABASE_URL
#    - NEXT_PUBLIC_SUPABASE_URL
#    - NEXT_PUBLIC_SUPABASE_ANON_KEY
#    - GEMINI_API_KEY
#    - LLAMACLOUD_API_KEY (optional)

# 3. Set up database
pnpm prisma generate
pnpm prisma migrate deploy

# 4. Run dev server
pnpm dev
```

---

## Common Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run linter |
| `pnpm test` | Run tests |
| `pnpm prisma studio` | Open database GUI |
| `pnpm prisma migrate dev` | Create new migration |

---

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/ai4rfp"
DIRECT_URL="postgresql://username:password@localhost:5432/ai4rfp"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="your-supabase-project-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"

# AI Services
GEMINI_API_KEY="your-gemini-api-key"
LLAMACLOUD_API_KEY="your-llamacloud-api-key"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

Built with Next.js, LlamaIndex, and Google Gemini
