# Agent Instructions

## Monorepo Structure

```
apps/
├── backend/          # Fastify API (@ethi-ai/backend)
│   └── src/
│       ├── config/       # Env validation, plugins, modules
│       ├── common/       # Guards, middleware, filters
│       ├── database/     # Prisma schema & client
│       ├── modules/      # Feature modules (auth, ai, users, etc.)
│       ├── providers/    # AI, transcription, email integrations
│       ├── services/     # Shared business logic
│       ├── websocket/    # WebSocket handling
│       └── workers/      # BullMQ background jobs
│
└── desktop/          # Electron + React (ethi-ai-desktop)
    ├── electron/       # Electron main/preload scripts
    └── src/            # React app source
        ├── components/
        │   ├── ui/           # Reusable UI components
        │   ├── features/     # Feature-specific components
        │   └── layout/       # Layout components
        ├── hooks/            # Custom React hooks
        ├── lib/              # Utilities
        ├── pages/             # Route pages
        ├── services/
        │   └── api/          # API services
        ├── store/            # Zustand stores
        └── types/            # TypeScript types
```

## Key Commands

### Root (pnpm workspace)
```bash
pnpm dev              # Start all apps (turbo)
pnpm build            # Build all apps
pnpm test             # Run all tests (requires Postgres + Redis)
pnpm lint             # Lint all apps
pnpm typecheck        # Type-check all (run after build)
pnpm format           # Format with Prettier

# Database
pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema to DB
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed data

# Docker
pnpm docker:up        # Start Postgres + Redis
pnpm docker:down      # Stop services
```

### Backend (apps/backend)
```bash
cd apps/backend && pnpm dev          # Start Fastify dev server
cd apps/backend && pnpm db:studio    # Open Prisma Studio
```

### Desktop (apps/desktop)
```bash
cd apps/desktop && pnpm dev           # Start Vite + Electron
cd apps/desktop && pnpm build         # Build Vite bundle
cd apps/desktop && pnpm build:electron  # Build Electron main
cd apps/desktop && pnpm dist          # Package for distribution
```

## Desktop App Architecture

The desktop app uses **Electron** (not Tauri):
- **Routes**: `/`, `/chat`, `/settings`, `/login`, `/register`
- **State**: Zustand stores for auth, chat, settings, activity
- **API**: Services in `src/services/api/` for auth, chat, RAG
- **Components**: UI library in `src/components/ui/`
- **Features**: Auth forms, chat area, settings panel in `src/components/features/`

### Desktop TypeScript Notes
- Use `.tsx` extension for files with JSX
- Import types from `../../types` (relative path)
- Electron main script: `electron-dist/main.mjs` (generated)
- Entry point: `src/main.tsx`

## CI Pipeline (GitHub Actions)

Order: `lint` → `typecheck` → `test` → `build`

Tests require Postgres 16 + Redis 7 services.

## Conventional Commits

- `feat:` - New feature
- `fix:` - Bug fix
- `chore:` - Maintenance
- `docs:` - Documentation
- `test:` - Tests
- `refactor:` - Code refactoring

## Environment Setup

```bash
cp .env.example apps/backend/.env
# Required vars:
# DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
# Optional: OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.
```

## Important Conventions

- **ESLint in monorepo**: May show path resolution errors in IDE but CI uses correct config
- **TypeScript**: Always run `pnpm typecheck` before committing
- **Desktop imports**: Use relative paths (`../../hooks`, `../ui`) not workspace aliases
- **Electron entry**: `electron-dist/main.mjs` (generated, not committed)
- **Build artifacts**: Vite output in `dist/`, Electron in `electron-dist/`

## Testing Notes

- Backend: Vitest with Prisma test client
- Desktop: Vitest with React Testing Library
- E2E: Separate vitest config (`vitest.e2e.config.ts`)

## Development Quirks

- Desktop uses `concurrently` to run Vite + Electron together
- Vite dev server at `http://localhost:1420`
- Electron waits for Vite before starting
- `wait-on` ensures proper startup order