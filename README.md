# TransformHub AI — Next.js + FastAPI

A source-to-output content transformation workspace with account sign-in, registration, and private guest workspaces. The backend provides source ingestion, canonical content/indexing, RAG-grounded generation, human review, export and audit APIs.

## Technology

- **Frontend:** Next.js 16 App Router + TypeScript + React + Tailwind CSS v4.
- **Backend:** FastAPI + Python 3.11.
- **Database/vector search:** SQLite for local development; PostgreSQL 16 + pgvector for Compose.
- **File storage:** local backend filesystem; Docker uses a named volume.
- **Background jobs:** Redis + Celery worker service.
- **Extraction:** PyMuPDF, python-docx, python-pptx, Tesseract OCR; faster-whisper + FFmpeg for audio/video transcription.
- **AI:** configurable offline demo, Ollama, Gemini, or LiteLLM/OpenAI-compatible gateway.
- **Access model:** password accounts and isolated guest accounts; API data access requires an account token.
- **Deployment:** Docker Compose.

## Start locally (no Docker required)

The local MVP uses SQLite and offline demo generation by default. Start the API and frontend in separate PowerShell terminals:

```powershell
# Terminal 1
Set-Location .\backend
python -m pip install -r .\requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001

# Terminal 2
Set-Location .\frontend
if (-not (Test-Path .env.local)) { Copy-Item .env.local.example .env.local }
npm ci
npm run dev
```

Open **http://localhost:3000**. The API docs are at **http://localhost:8001/docs**. For a production build, set `NEXT_PUBLIC_API_URL=http://localhost:8001` before `npm run build`, then run `./start-standalone.ps1` from `frontend`.

## Optional containerized deployment (Docker Desktop required)

1. Install and start Docker Desktop with its Linux engine enabled.
2. From PowerShell at the project root, create environment files if they do not exist:

   ```powershell
   if (-not (Test-Path .env)) { Copy-Item .env.example .env }
   if (-not (Test-Path backend\.env)) { Copy-Item backend\.env.example backend\.env }
   ```

   Keep existing environment files if already configured. The supplied values are for local demonstration only. Compose uses `POSTGRES_PASSWORD` from the root `.env` for both PostgreSQL and the backend/worker connection URL; set it to match an existing database volume, and replace the demo value before deployment.
3. Validate and run the production containers:

   ```powershell
   docker --version
   docker compose version
   docker compose config
   docker compose build
   docker compose up -d
   docker compose ps
   ```

4. Open the frontend at **http://localhost:3000**. Backend API docs are at **http://localhost:8000/docs**; liveness and database readiness are at `/health` and `/health/ready`.

The browser calls the backend directly using the build-time `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`); it does not use `localhost` inside the frontend container. The backend CORS allowlist follows the configured frontend port and includes the equivalent `localhost`/`127.0.0.1` loopback origin. PostgreSQL is reachable from other containers at `postgres:5432` and from the host at port **5433** to avoid clashing with a local PostgreSQL installation. Redis is internal-only. The `backend_uploads` and `postgres_data` named volumes persist uploaded files and database records. If port 3000 is already in use, set `FRONTEND_PORT=3001` in the root `.env` and open the frontend on that port.

Compose ports bind to loopback by default. Accounts and per-user data isolation are enabled; for public hosting, use HTTPS, production secrets, a durable database, and a production frontend/API URL.

To inspect logs: `docker compose logs --tail=100`. To stop the stack without deleting data: `docker compose down`. `docker compose down -v` deletes the database and uploaded-file volumes and should not be used for routine shutdown.

Node.js 20.9 or newer is required by current Next.js 16.

## Run backend without Docker

The backend defaults to a persistent local SQLite database (`backend/transformhub.db`) and deterministic offline demo AI, so the core workflow runs without Docker, PostgreSQL, Redis, or model credentials. File uploads are stored locally. To use PostgreSQL instead, set `DATABASE_URL` to a PostgreSQL URL with pgvector installed. Run:

```powershell
Set-Location .\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r .\requirements.txt
uvicorn app.main:app --reload --port 8001
```

Open the frontend at `http://localhost:3000`; API docs are at `http://localhost:8001/docs`. The frontend `.env.local.example` points the browser to port 8001. For the PostgreSQL, Redis, and Celery stack, configure the environment and use Docker Compose.

## Accounts and workspace privacy

The app supports account registration, sign-in, and private guest sessions. Every transformation and related upload/output is scoped to its owning account; API requests without a valid bearer token receive HTTP 401. Guest mode creates a distinct account for each new browser session and guest data cannot be recovered after its token is cleared. Passwords are hashed in the backend. The browser stores the short-lived access token in local storage for this lightweight MVP, so always serve the app over HTTPS when hosted publicly.

## Architecture and data flow

```text
Browser (Next.js UI :3000)
  └─ direct HTTP/JSON + multipart requests to FastAPI (:8001 local / :8000 Compose)
       ├─ SQLite by default or PostgreSQL + pgvector when configured
       ├─ local backend/uploads storage
       ├─ Ollama, Gemini, or a LiteLLM/OpenAI-compatible endpoint (optional live model)
       └─ Redis → Celery worker (worker foundation; the main transformation APIs currently run synchronously)
```

The source wizard creates a transformation, accepts files/pasted text/public URLs/RSS, extracts and normalizes text, stores the source, builds canonical content and indexes chunks. Generation retrieves evidence, creates review drafts, and records reviewer decisions; approved outputs can be exported. The sidebar/dashboard/preferences are React components; user settings and some display history persist in browser storage, while transformation records and generated results live in SQLite for local MVP use or PostgreSQL when configured.

The browser preview reports only text it can read locally; it does not estimate content, citations, or summaries for URLs and binary files. Those sources are extracted by the backend after upload. The dashboard batch suite sends each queued source through the same backend create → upload → generate flow, reports per-item failures, and saves successful outputs as **In Review** drafts. A reviewer must open and approve a draft before using the normal export workflow.

The FastAPI routers mounted in `backend/app/main.py` are transformations, uploads, RAG and generation/review/export. Account endpoints are mounted alongside the transformation APIs. The storage implementation is local filesystem storage; despite legacy MinIO settings/dependency, no MinIO client or service is currently used.

## AI mode

Default `LLM_PROVIDER=demo` and `EMBEDDING_PROVIDER=demo` allow an offline end-to-end MVP check without downloading a model. Demo embeddings are deterministic hash vectors, not a production semantic embedding model. Demo generation creates source-derived draft templates; it is **not a substitute for a live LLM** and supports English only. Select Gemini, Ollama, or a compatible live provider for multilingual generation; provider failures and malformed model responses should be surfaced instead of silently replaced with demo output.

Generated-content language is configured independently from the platform/interface language. The transformation selector includes English, Telugu, Tamil, Hindi, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Urdu and Odia, with each shown in its native script; previously available Spanish, French, German, Japanese, Chinese, Korean, Arabic and Portuguese remain available. The generation API sends ISO 639-1 codes and creates a separately labeled review draft for each selected language. Older clients sending language names remain accepted. Ollama prompts require language-specific content and preserve source facts and technical meaning. For languages written in a non-Latin script, a response without enough characters from the requested script is rejected instead of being presented as a successful translation; this check cannot prove grammatical quality or reliably detect language mixing.

Choose more than one language to create a separate output for each language (for example, Telugu and French). The executive-summary path keeps DOCX tables in reading order and selects evidence throughout the report, including later implementation, results, and limitations sections. The studio includes executive/business reports, LinkedIn/Instagram/Facebook/X, carousel and video scripts, emails, newsletters, blog posts, proposals, product descriptions, technical explanations, and documentation. Live multilingual content requires a configured Ollama, Gemini, or OpenAI-compatible provider; offline demo mode supports English only.

Live output was tested with the configured `qwen3.5:latest` model for English, Telugu, Tamil and Hindi. The model returned each requested script, but the sample still mistranslated a software “request” as “demand” in Telugu and “TLS encryption” as a different concept in Tamil. Treat those languages as unverified for production-quality translation with this model; keep human review enabled. The other listed languages were not live-tested.

For Gemini, set `LLM_PROVIDER=gemini` (or `GENERATION_PROVIDER=gemini`) and `GEMINI_API_KEY` in `backend/.env` or the hosting provider environment. Keep the key backend-only; do not put it in `frontend/.env.local` or commit it. `GEMINI_MODEL` defaults to `gemini-3.8-flash`. For Ollama, set `LLM_PROVIDER=ollama` and `GENERATION_PROVIDER=ollama`, set `OLLAMA_BASE_URL` to a reachable Ollama server, and choose an installed model. For LiteLLM/vLLM, configure its API base and secret in the backend environment. For semantic retrieval, configure an embedding provider that emits exactly `EMBEDDING_DIMENSIONS` values (currently 768). Generation and embeddings can use separate providers.

For Render's free preview setup and secret entry, see [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md). Add the Gemini key in the API service's `GEMINI_API_KEY` environment variable, never in the public frontend service.

## Supported ingestion sources

- Batch file upload: up to 10 files per batch, up to 50 MB per file.
- PDF, DOCX, PPTX, text/Markdown, CSV, JSON, XML, HTML, logs, RTF, common image formats, audio and video.
- Public HTTP(S) URL: HTML, plain text, PDF or DOCX, with private/local URL targets rejected.
- Public RSS/Atom feeds (up to 50 recent entries).
- Pasted text.

Scanned PDFs/images require Tesseract and the relevant Python libraries. Audio/video transcription requires FFmpeg and faster-whisper; the first transcription can take time while the model is downloaded. A file with no extractable text fails with a visible API error rather than pretending extraction succeeded.

## End-to-end testing

The script checks liveness/readiness, guest authentication and account-scoped transformation creation, text ingestion/indexing, output generation, approval and Markdown export. Install the backend requirements in a host Python environment, start the stack, and run from the project root:

```powershell
python -m pip install -r backend/requirements.txt
python scripts\smoke_test.py
```

For a manual test: create a transformation → upload sources → select outputs and languages → generate → review/edit/approve → export → inspect the audit log and history.

## Important scope and deployment notes

- PostgreSQL tables are created on app startup for this MVP. Add Alembic migrations before production schema changes.
- Redis and Celery worker run in Compose; some ingestion/generation APIs currently execute synchronously. The included worker currently provides a health/task foundation, not a claim that every pipeline operation is already queued.
- Local workspace UI preferences and the display history are still partly browser-side; transformation records, uploads, generated outputs, reviewer decisions and export audit records are stored by the backend.
- Email-based password reset is not implemented yet.
- Before public deployment: configure HTTPS and production CORS, rotate JWT/session/database secrets, use a durable database with backups and migrations, add upload retention/access controls and rate limiting, and configure monitoring. This MVP has basic authentication and per-user authorization; email verification, password recovery, and guest-account abuse controls are not implemented yet.

See `OAUTH_LOGIN_SETUP.md` and `END_TO_END_SETUP_AND_TESTING.md` for more detail.
