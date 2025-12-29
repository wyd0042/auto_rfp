# Quick Start Guide

Get AutoRFP running locally in 5 minutes.

## Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL database
- Supabase account
- Gemini API key

## Setup Steps

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create `.env` file

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/auto_rfp"
DIRECT_URL="postgresql://username:password@localhost:5432/auto_rfp"

# Supabase (get from supabase.com > Settings > API)
NEXT_PUBLIC_SUPABASE_URL="your-supabase-project-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"

# Gemini (get from aistudio.google.com)
GEMINI_API_KEY="your-gemini-api-key"

# LlamaCloud (optional - get from cloud.llamaindex.ai)
LLAMACLOUD_API_KEY="your-llamacloud-api-key"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Set up database

```bash
# Create database (if needed)
createdb auto_rfp

# Generate Prisma client & run migrations
pnpm prisma generate
pnpm prisma migrate deploy
```

### 4. Start the dev server

```bash
pnpm dev
```

Open http://localhost:3000

## Common Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run linter |
| `pnpm prisma studio` | Open database GUI |
| `pnpm prisma migrate dev` | Create new migration |

## Troubleshooting

**Database connection failed?**
- Check `DATABASE_URL` format
- Ensure PostgreSQL is running
- Run `pnpm prisma db pull` to test connection

**Auth not working?**
- Verify Supabase URL and anon key
- Check redirect URLs in Supabase dashboard

**AI responses failing?**
- Confirm Gemini API key is valid
- Check API rate limits at Google AI Studio

For detailed setup, see [README.md](./README.md).
