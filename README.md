# HireBlind

Bias-free resume screening SaaS (demo) with **React (Vite) + Tailwind** frontend and **Node/Express + Supabase** backend.

## 1) Database (Supabase)

- Create a Supabase project
- Open SQL editor and run:
  - `supabase/schema.sql`

## 2) Backend

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

**Login:** With a valid Supabase connection, the API seeds **`admin@hireblind.local` / `admin12345`** automatically on startup when the `users` table is **empty** (see `SEED_DEMO_USER` in `server/.env.example`). You can also create the first admin manually with `POST /api/auth/register` when there are no users yet.

## 3) Frontend

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.

### Troubleshooting “Failed to fetch” / server exits immediately

- **Backend `.env` path**: `dotenv` loads from `server/.env` (next to `package.json`), not from your shell’s current directory. Run `npm run dev` from the `server/` folder, or keep `.env` in `server/`.
- **Port mismatch**: Set `PORT` in `server/.env` (default **4000**) and set `VITE_API_URL` in `client/.env` to the same origin, e.g. `http://localhost:4000`. If you change the API port, update the client env too.
- **Smoke test**: With the API running, open `http://localhost:4000/` — you should see plain text **`Server running`**.

## Hard constraints enforced (API-level)

- No PII stored (only `resumes.anonymised_text`)
- No real candidate names on shortlist/rankings (candidate codes only)
- Ranking explainability tags required (stored in `rankings.explainability_tags`)
- Human overrides recorded (reversible) and audited
- All actions timestamped (`audit_logs.logged_at`)

