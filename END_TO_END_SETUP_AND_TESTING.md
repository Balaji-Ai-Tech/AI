# End-to-end setup and test checklist

## Start the local Docker stack

1. Install Docker Desktop and start its Linux engine.
2. From PowerShell at the project root, create only missing env files:

   ```powershell
   if (-not (Test-Path .env)) { Copy-Item .env.example .env }
   if (-not (Test-Path backend\.env)) { Copy-Item backend\.env.example backend\.env }
   ```

3. Validate, build and start:

   ```powershell
   docker compose config
   docker compose build
   docker compose up -d
   docker compose ps
   ```

4. Open `http://localhost:3000`; inspect the API at `http://localhost:8000/docs`. The API health routes are `/health` and `/health/ready`.
5. Run `python scripts\smoke_test.py` from the host with a Python environment that has `backend\requirements.txt` installed.

## Manual transformation flow

1. Open the dashboard without signing in.
2. Start a transformation and upload files, paste text, enter a public HTTP(S) URL, or ingest RSS/Atom.
3. Wait for extraction and indexing. Source files are stored in the `backend_uploads` Docker volume, records and chunks in PostgreSQL/pgvector, and the app builds canonical content.
4. Configure output types, audience, tone, language, objective and detail.
5. Generate drafts, inspect evidence, then edit/save, reject or approve.
6. Export an approved output and inspect review status and audit history.

## What the smoke test covers

`python scripts\smoke_test.py` checks liveness/readiness, unauthenticated transformation creation, text ingestion/indexing, generation, approval and Markdown export. With the default demo provider it runs without a model download. The demo provider is an explicitly selected offline source-derived mode; it is not a live LLM or production semantic embedding model.

## Integration boundaries and troubleshooting

- The browser calls `NEXT_PUBLIC_API_URL` directly. Its default is `http://localhost:8000`; set it to a browser-reachable address and rebuild the frontend if it changes.
- Docker Compose publishes frontend/API ports on loopback and PostgreSQL on `127.0.0.1:5433`; internal connections use service names and ports (`postgres:5432`, `redis:6379`).
- For Ollama from the backend container, use `http://host.docker.internal:11434`, ensure the configured model is installed, and permit local Docker traffic through the host firewall.
- `docker compose logs --tail=100 backend` shows backend errors; use `docker compose logs --tail=100 frontend postgres redis celery-worker` for the other services.
- The current access model is one shared unauthenticated workspace. Do not expose the app to a public or untrusted network.
- Files are stored locally; MinIO configuration/dependency is legacy and no MinIO service is present.
- Celery/Redis are included, but the transformation endpoints currently execute extraction and generation synchronously.
- OCR requires Tesseract. Audio/video transcription requires FFmpeg and faster-whisper; the first transcription may download its small model at runtime.
- Live provider errors should be fixed at the provider/network/model configuration. The app must not treat a demo fallback as successful live-model output.
