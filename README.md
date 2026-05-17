# ethi AI Assistant

A production-grade AI desktop assistant with multi-provider AI support, real-time transcription, and workspace collaboration.

## Tech Stack

| Layer        | Technology                                                                     |
| ------------ | ------------------------------------------------------------------------------ |
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, Radix UI, Zustand, TanStack Query     |
| **Desktop**  | Tauri v1                                                                       |
| **Backend**  | Node.js, Fastify, TypeScript, Prisma ORM                                       |
| **Database** | PostgreSQL                                                                     |
| **Cache**    | Redis (ioredis)                                                                |
| **Queues**   | BullMQ                                                                         |
| **AI**       | OpenAI, Anthropic, Gemini, Groq, OpenRouter, Ollama                            |
| **Speech**   | Deepgram, AssemblyAI, Whisper                                                  |
| **Payments** | Stripe                                                                         |
| **Email**    | Nodemailer                                                                     |
| **Auth**     | JWT (access + refresh tokens), bcrypt, session management                      |

## Architecture

```
ethi-ai-assistant/
├── apps/
│   ├── backend/          # Fastify API server
│   │   ├── src/
│   │   │   ├── config/       # App configuration & env validation
│   │   │   ├── common/       # Shared middleware, guards, pipes
│   │   │   ├── database/     # Prisma client & schema
│   │   │   ├── modules/      # Feature modules (auth, ai, workspace, etc.)
│   │   │   ├── providers/    # External service integrations
│   │   │   ├── services/     # Shared business logic
│   │   │   ├── websocket/    # WebSocket handler for streaming
│   │   │   └── workers/      # BullMQ background workers
│   │   └── tests/
│   │       ├── unit/         # Unit tests
│   │       └── integration/  # Integration tests
│   └── desktop/          # Tauri desktop app
│       ├── src/              # React app source
│       └── src-tauri/        # Tauri Rust backend
├── packages/
│   ├── shared/           # Shared types, validators, constants
│   ├── eslint-config/    # Shared ESLint configuration
│   └── tsconfig/         # Shared TypeScript configuration
├── docker/               # Docker Compose files
├── infra/                # Infrastructure as code
└── docs/                 # Documentation
```

## Getting Started

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **Docker** & **Docker Compose** (for local services)
- **Rust** toolchain (for Tauri desktop builds)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd natively-ai-assistant

# Install dependencies
pnpm install

# Set up environment
cp .env.example apps/backend/.env
# Edit apps/backend/.env with your configuration

# Start infrastructure services
pnpm docker:up

# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# Seed the database (optional)
pnpm db:seed
```

### Development

```bash
# Start all apps in development mode
pnpm dev

# Start only the backend
cd apps/backend && pnpm dev

# Start only the desktop app
cd apps/desktop && pnpm dev
```

## Development Commands

| Command               | Description                                   |
| --------------------- | --------------------------------------------- |
| `pnpm dev`            | Start all apps in development mode            |
| `pnpm build`          | Build all apps                                |
| `pnpm test`           | Run all tests                                 |
| `pnpm lint`           | Lint all apps                                 |
| `pnpm typecheck`      | Type-check all apps                           |
| `pnpm format`         | Format code with Prettier                     |
| `pnpm clean`          | Clean build artifacts                         |
| `pnpm db:generate`    | Generate Prisma client                        |
| `pnpm db:push`        | Push schema to database                       |
| `pnpm db:migrate`     | Run database migrations                       |
| `pnpm db:seed`        | Seed the database                             |
| `pnpm db:studio`      | Open Prisma Studio                            |
| `pnpm docker:up`      | Start Docker services                         |
| `pnpm docker:down`    | Stop Docker services                          |

## Environment Setup

Create `apps/backend/.env` from the template:

```env
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/natively
JWT_SECRET=<random-32-char-string>
JWT_REFRESH_SECRET=<another-random-32-char-string>

# Optional - AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
GROQ_API_KEY=gsk_...
OPENROUTER_API_KEY=...

# Optional - Transcription
DEEPGRAM_API_KEY=...
ASSEMBLYAI_API_KEY=...
```

## Testing

```bash
# Run all tests
pnpm test

# Backend tests
cd apps/backend
pnpm test              # Run once
pnpm test:watch        # Watch mode
pnpm test:e2e          # E2E tests

# Desktop tests
cd apps/desktop
pnpm test
```

## Deployment

### Docker

```bash
# Build and start all services
docker compose -f docker/docker-compose.yml up -d

# Build specific service
docker compose -f docker/docker-compose.yml build backend
```

### Manual

```bash
# Build backend
cd apps/backend
pnpm build
pnpm start

# Build desktop
cd apps/desktop
pnpm build
```

## Project Structure

```
apps/
├── backend/                   # Fastify API
│   ├── src/
│   │   ├── config/            # Env validation, plugins, modules
│   │   ├── common/            # Guards, interceptors, filters
│   │   ├── database/          # Prisma schema & client
│   │   ├── modules/           # Feature modules
│   │   │   ├── auth/          # Authentication & sessions
│   │   │   ├── ai/            # AI chat completions
│   │   │   ├── workspace/     # Workspace management
│   │   │   ├── transcription/ # Speech-to-text
│   │   │   ├── subscriptions/ # Subscription plans
│   │   │   ├── payments/      # Stripe integration
│   │   │   ├── users/         # User management
│   │   │   ├── analytics/     # Usage analytics
│   │   │   ├── notifications/ # In-app notifications
│   │   │   └── webhooks/      # Stripe webhooks
│   │   ├── providers/         # AI, transcription, email, payment
│   │   ├── services/          # Shared services (cache, etc.)
│   │   ├── websocket/         # WebSocket handling
│   │   └── workers/           # Background job processors
│   └── tests/
│       ├── unit/              # Unit tests (vitest)
│       └── integration/       # Integration tests (vitest)
└── desktop/                   # Tauri + React SPA
    ├── src/
    │   ├── components/        # UI components (Radix-based)
    │   ├── lib/               # API client, auth, utils
    │   ├── providers/         # React context providers
    │   ├── stores/            # Zustand state stores
    │   └── styles/            # Global CSS with Tailwind
    ├── src-tauri/             # Tauri Rust source
    └── tests/
        └── components/        # Component tests (vitest + RTL)
```

## API Overview

| Method | Endpoint                  | Auth     | Description                |
| ------ | ------------------------- | -------- | -------------------------- |
| GET    | `/health`                 | No       | Health check               |
| POST   | `/api/auth/register`      | No       | Register new user          |
| POST   | `/api/auth/login`         | No       | Login                      |
| POST   | `/api/auth/refresh`       | No       | Refresh access token       |
| POST   | `/api/auth/logout`        | Yes      | Logout                     |
| GET    | `/api/auth/me`            | Yes      | Current user profile       |
| GET    | `/api/auth/sessions`      | Yes      | List active sessions       |
| DELETE | `/api/auth/sessions/:id`  | Yes      | Revoke a session           |
| POST   | `/api/ai/complete`        | Yes      | AI chat completion         |
| GET    | `/api/ai/providers`       | No       | List available providers   |
| ...    | ...                       | ...      | ...                        |

## Contributing

1. Create a feature branch from `main`
2. Make your changes with appropriate tests
3. Run `pnpm lint` and `pnpm typecheck`
4. Run `pnpm test` to ensure all tests pass
5. Submit a pull request

### Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - New feature
- `fix:` - Bug fix
- `chore:` - Maintenance
- `docs:` - Documentation
- `test:` - Tests
- `refactor:` - Code refactoring

## License

MIT
