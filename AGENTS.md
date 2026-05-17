# AGENTS.md

## Monorepo (pnpm + Turbo)

Workspaces: `apps/*`, `packages/*`. Root package: `ethi-ai`.

| Path | Tech | Entry |
|---|---|---|
| `apps/backend` | Fastify + Prisma + BullMQ | `src/main.ts` (dev via `tsx watch`) |
| `apps/desktop` | Electron + React + Vite | `electron/main/main.ts` (main), `src/main.tsx` (renderer) |
| `packages/shared` | Zod schemas, types | `src/index.ts` → builds with `tsup` |
| `packages/eslint-config` | Shared ESLint rules | — |
| `packages/tsconfig` | Shared TS configs | `base.json`, `react.json`, `node.json` |

**Desktop is Electron, NOT Tauri.** The README is outdated on this point.

## Key Commands

```bash
# Root – all via turbo
pnpm dev              # everything in parallel
pnpm build            # dependsOn ^build
pnpm lint             # eslint across workspace
pnpm typecheck        # dependsOn ^build (run build first!)
pnpm test             # dependsOn build (turbo enforces order)
pnpm format           # prettier --write "**/*.{ts,tsx,js,json,css,md}"
pnpm clean            # turbo run clean
pnpm docker:up        # docker compose -f docker/docker-compose.yml up -d

# Database (backend)
pnpm db:generate      # prisma generate
pnpm db:push          # push schema
pnpm db:migrate       # migrate dev
pnpm db:seed          # tsx src/database/seed.ts

# Desktop specific
cd apps/desktop && pnpm build         # vite build only
cd apps/desktop && pnpm build:electron # tsc electron/ → electron-dist/ + rename to .mjs
cd apps/desktop && pnpm build:all     # build + build:electron
cd apps/desktop && pnpm dist          # build:all + electron-builder --win --x64
cd apps/desktop && pnpm dev           # concurrently vite + electron (wait-on)
```

**`pnpm typecheck` requires `pnpm build` first** (turbo `dependsOn: ["^build"]`).
**`pnpm test` requires `pnpm build` first**, plus Postgres + Redis running.

## Testing

- **Backend**: Vitest, `globals: true`, 30s timeout. Needs `DATABASE_URL` pointing to a real test DB.
- **Desktop**: Vitest + jsdom + `@testing-library/react`. No external services needed.
- Both read `vitest.config.ts` at workspace root via `vitest.workspace.ts`.
- No E2E config file on disk despite `pnpm test:e2e` script in backend `package.json`.

## CI / CD (GitHub Actions)

Pipeline order (parallel jobs): `lint` → `typecheck` → `test` → `build`.
- `test` job starts Postgres 16 + Redis 7 services and runs `pnpm db:generate` first.
- `build` job on ubuntu-latest builds everything.
- CD pushes backend Docker image to `ghcr.io`, deploys to staging/production via SSH on `main`/`staging` push.

## Desktop Conventions

- **Imports**: Relative paths only (`../../hooks`, `../ui`). No workspace aliases in source.
- **Electron**: `tsconfig.electron.json` compiles `electron/` → `electron-dist/`. A rename script copies `.js` → `.mjs` for ESM compliance.
- **Native module**: `electron/native-module/` (C++ addon for system audio capture + stealth window).
- **RAG service**: `electron/lib/rag/service.cjs` — standalone Express server on port 3001 (started separately).
- Vite dev server at `localhost:1420`. Electron waits for Vite via `wait-on`.
- Build artifacts: Vite → `dist/`, Electron → `electron-dist/`, packaged → `exe-output-v3/`.

## Backend Conventions

- Dev: `tsx watch src/main.ts` (no compile step).
- Build: `tsc && tsc-alias` (resolves `@/` path aliases).
- Prisma schema: `src/database/prisma/schema.prisma`.
- Env validation via Zod in `src/config/env.ts`. Required: `DATABASE_URL`, `JWT_SECRET` (≥32 chars), `JWT_REFRESH_SECRET` (≥32 chars).
- CORS origin defaults to `http://localhost:1420` (desktop).
- Backend aliases used in tests: `@/`, `@modules/`, `@common/`, `@config/`, `@providers/`, `@services/`, `@database/`, `@shared/`.

## Important Gotchas

- **`packages/ui` does not exist** on disk (mentioned in docs but never created).
- **`vitest.e2e.config.ts` does not exist** on disk (script in `package.json` will fail).
- ESLint root config uses separate overrides for `apps/backend/` and `apps/desktop/` — IDE path resolution errors are normal; CI uses correct config.
- Root `.prettierrc`: single quotes, trailing commas, 120 print width, LF line endings. Run `pnpm format` after editing.
- Conventional commits expected: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- `.env` goes in `apps/backend/.env` (copied from root `.env.example`).
