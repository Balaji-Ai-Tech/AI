# Render preview deployment

This repository includes a Render Blueprint in `render.yaml` for the Next.js frontend, FastAPI API, and PostgreSQL database. It is configured for Render's free tier as a preview.

## Deploy

1. Push the project to a Git repository you control and connect that repository to Render.
2. In Render, create a Blueprint from the repository and select `render.yaml`.
3. When Render asks for `GEMINI_API_KEY`, provide the key from Google AI Studio. The key is declared as a secret input and is never included in this file or sent to the frontend.
4. Review the services and database in Render, then create the Blueprint. The API and frontend URLs are wired through Render service references.
5. After the first deploy, open the frontend service URL and create an account or use a private guest workspace.

For a local live-model setup, put `GEMINI_API_KEY=...`, `LLM_PROVIDER=gemini`, and `GENERATION_PROVIDER=gemini` in `backend/.env`, then restart the API. Never add the key to `frontend/.env.local` or commit it.

## Free-tier limits

Render free web services can sleep after inactivity; the free Postgres database expires after 30 days. The free API filesystem is ephemeral, so original uploaded files are not durable across restarts (extracted text and generated records are stored in Postgres). Use paid persistent storage and backups before relying on the hosted app for long-term or confidential work.

The app supports creating accounts and isolating data by user. Before using it as a public production service, add rate limits and abuse controls for public account and guest creation, configure a durable database and file store, and review production security settings.
