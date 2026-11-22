# Nếp Học LMS

A learning management system for schools and training teams, with three roles: **student**, **lecturer** and **admin**.

| Part | Stack |
| --- | --- |
| `client/` | React 19, Vite 6, Tailwind CSS 4, TanStack Query, wouter |
| `server/` | Node.js 22, Express 5, Drizzle ORM, PostgreSQL (Supabase in production, PGlite locally) |
| `docs/api-spec.yaml` | OpenAPI contract. `pnpm codegen` generates the client hooks and the server's Zod validation from it |

Data lives in PostgreSQL. Uploaded files go to Cloudflare R2 when it's configured, otherwise to the server's `uploads/` folder.

---

## Contents

1. [Run locally](#1-run-locally)
2. [Choosing a hosting setup](#2-choosing-a-hosting-setup)
3. [Deploy to Render (recommended)](#3-deploy-to-render-recommended)
4. [Alternative: frontend on Vercel, API on Render](#4-alternative-frontend-on-vercel-api-on-render)
5. [Environment variables](#5-environment-variables)
6. [Operations: accounts, backups, updates](#6-operations-accounts-backups-updates)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Run locally

**Requirements:** Node.js 22+, and pnpm through Corepack (the pnpm version is pinned in `package.json`).

```powershell
corepack enable
pnpm install
```

Create `server/.env` from `server/.env.example`. For local work, turn on the one-click demo accounts:

```dotenv
PORT=5000
ENABLE_DEMO_LOGIN=true
```

Leave `DATABASE_URL` **unset** for local work. The server then uses [PGlite](https://pglite.dev), a full PostgreSQL that runs inside Node and keeps its data in `server/.pglite`. Nothing to install, and no native modules to compile. To work against Supabase instead, set `DATABASE_URL` (see [section 5](#5-environment-variables)).

Start the API and the web app together:

```powershell
pnpm dev
```

- Web app: http://localhost:3000 (Vite forwards `/api` and `/uploads` to port 5000)
- API: http://localhost:5000/api/healthz

On first start the server creates the tables (it runs the migrations in `server/drizzle/`) and fills them with **demo data**: sample courses, students, materials, assignments and certificates. That happens because demo data is on by default outside production (`SEED_DEMO_DATA`). Every demo account uses the password `123456`, or `SEED_DEFAULT_PASSWORD` if you set it:

| Role | Email |
| --- | --- |
| Admin | `ngan.bui@boom.vn` |
| Lecturer | `bui.ngan@boom.vn` |
| Student | `ngann@boom.vn` |

There is no public sign-up. Admins manage accounts on the **Người dùng & Phân quyền** page (`/accounts`): create, edit, change role, reset password, lock or unlock, and delete.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Runs the API and the web app with live reload |
| `pnpm codegen` | Regenerates the API client and server schemas after editing `docs/api-spec.yaml` |
| `pnpm --filter server test` | Runs the permission and seeding tests (each uses a temporary database) |
| `pnpm --filter server typecheck` | Type-checks the server |
| `pnpm build` | Builds the web app into `client/dist` and type-checks the server |
| `pnpm --filter server set-password <email> <password>` | Resets a user's password from the command line and signs them out everywhere (useful if no admin can log in) |
| `pnpm db:generate` | After changing `server/src/db/schema`, writes a new SQL migration to `server/drizzle/`. Commit it; the server applies it on its next start |

To reset local data, stop the server and delete the `server/.pglite` folder.

---

## 2. Choosing a hosting setup

The backend is a long-running Node server (Express), so serverless platforms such as Vercel Functions can't host it. Its data lives in **Supabase (PostgreSQL)** and uploaded files in **Cloudflare R2**, so the server itself keeps nothing it can't lose: no disk is needed.

| Setup | When to use it |
| --- | --- |
| **A. Render only, one service** (recommended) | Express serves the API *and* the built web app from one URL. No CORS settings, upload links just work, and there's one bill and one log. |
| **B. Vercel (frontend) + Render (API)** | You want Vercel's preview deployments or CDN for the frontend. It's more configuration, see [section 4](#4-alternative-frontend-on-vercel-api-on-render). |

> **Render's Free plan works**, with two caveats. A free service sleeps after about 15 minutes without traffic, so the next visit waits about a minute for it to wake up; choose **Starter** if that matters. And without R2, uploaded files are kept on the server's own disk, which Render wipes on every deploy and restart, so **configure R2** for real use.

---

## 3. Deploy to Render (recommended)

The repository includes a Render Blueprint (`render.yaml`) that sets up everything below.

| Setting | Value |
| --- | --- |
| Service | One Node web service, **Free** plan (change to Starter to avoid sleeping), Singapore region |
| Build | Installs dependencies with the pinned pnpm, then builds `client/dist` |
| Start | `pnpm --filter server start`, which serves `/api`, `/uploads` and the web app |
| Database | Supabase PostgreSQL via `DATABASE_URL`. Tables are created and updated automatically on start (migrations) |
| Files | Cloudflare R2 (`R2_*`) |
| Health check | `/api/healthz` |

### Steps

1. **Get the Supabase connection string.** In Supabase open your project, then **Connect**, and copy the **Session pooler** string. It looks like `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`; put your database password in place of `[YOUR-PASSWORD]`.

   Don't use the "Direct connection" string (`db.<project-ref>.supabase.co`). That host only has an IPv6 address, and Render can't reach it (*getaddrinfo ENOTFOUND*).
2. **Push the code to GitHub**, including `render.yaml`. Render must use the same repository you push to.
3. In the Render dashboard, choose **New → Blueprint** and select this repository. Render reads `render.yaml`.
4. Render asks for the variables marked `sync: false`:
   - **`DATABASE_URL`** (required): the Session pooler string from step 1.
   - **`SEED_ADMIN_EMAIL`** (required): the email of the first administrator.
   - **`SEED_DEFAULT_PASSWORD`** (required): at least 8 characters, the first administrator's starting password.

     In production the database starts **empty except for this one admin**, with no demo courses or students. Without these two values the server refuses to start on an empty database. Both are only read once, when the database is created; changing them later has no effect.
   - **`CORS_ORIGIN`**: leave empty for this setup, because the browser and the API share one origin.
   - **`R2_*`**: fill all of them, including `R2_PUBLIC_URL` (the bucket's public `r2.dev` address or your own domain). Without a public URL, file links stop working after 7 days.
5. Click **Apply**. The first start creates all tables in Supabase.
6. Open `https://<service-name>.onrender.com` and sign in with `SEED_ADMIN_EMAIL` and `SEED_DEFAULT_PASSWORD`. Then **change that password** and create the real accounts (see [Operations](#6-operations-accounts-backups-updates)).

   To try the app with sample data on a throwaway instance, set `SEED_DEMO_DATA=true` *before the first start*. Never do this on the instance that holds real data.
7. Optional: add your own domain under **Settings → Custom Domains**. Render provides HTTPS automatically.

### Setting it up by hand instead of with the Blueprint

Create a **Web Service** from the repository with these settings:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Build command | `npm install -g corepack@latest && corepack enable && NODE_ENV=development pnpm install --frozen-lockfile && pnpm --filter client build` |
| Start command | `pnpm --filter server start` |
| Health check path | `/api/healthz` |
| Instance type | Free, or Starter to avoid sleeping |
| Environment | `NODE_ENV=production`, `NODE_VERSION=22`, `DATABASE_URL=<Supabase Session pooler>`, `SEED_ADMIN_EMAIL=<your email>`, `SEED_DEFAULT_PASSWORD=<secret>`, `R2_*` |

The install step uses `NODE_ENV=development` because pnpm skips devDependencies when `NODE_ENV=production`, and the web app build needs `vite`.

### Database changes

Tables are managed with Drizzle migrations in `server/drizzle/`. The server applies any new ones on start, so a deploy that changes the schema needs nothing extra. Supabase keeps a record of applied migrations in the `drizzle.__drizzle_migrations` table.

---

## 4. Alternative: frontend on Vercel, API on Render

Use this only if you need Vercel for the frontend.

### 4.1 API on Render

Follow [section 3](#3-deploy-to-render-recommended). Then set:

```dotenv
CORS_ORIGIN=https://<your-project>.vercel.app
```

To allow more than one origin, separate them with commas, for example to add your own domain. Vercel *preview* deployments get a different URL each time, so the API blocks them unless you list those URLs too.

Optionally, change the Render build command to skip the web app build: drop `&& pnpm --filter client build`.

### 4.2 Frontend on Vercel

1. In Vercel, choose **Add New → Project** and import the repository.
2. Configure it:

   | Setting | Value |
   | --- | --- |
   | Root Directory | `client` |
   | Framework preset | Vite |
   | Build command | `pnpm build` |
   | Output directory | `dist` |
   | Environment variable | `VITE_API_URL=https://<service-name>.onrender.com` |

3. Create `client/vercel.json` with your Render URL. It sends uploaded-file links (`/uploads/...`) to the API server, and sends every app route to `index.html`:

   ```json
   {
     "rewrites": [
       { "source": "/uploads/:path*", "destination": "https://<service-name>.onrender.com/uploads/:path*" },
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```

4. Deploy. API calls go straight from the browser to Render, which is why `CORS_ORIGIN` must contain the Vercel URL.

`VITE_API_URL` is read **at build time**. After changing it, redeploy the Vercel project.

---

## 5. Environment variables

### Server (`server/.env` locally, Render environment in production)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | no | `5000` | HTTP port (Render sets `10000`) |
| `NODE_ENV` | prod | – | `production` turns on JSON logs and the seed-password check |
| `DATABASE_URL` | prod | – | PostgreSQL connection string. For Supabase use the **Session pooler** (IPv4). Unset = local PGlite. Production refuses to start without it |
| `DATABASE_POOL_MAX` | no | `10` | Maximum database connections. Keep it low on Supabase's free tier |
| `PGLITE_DIR` | no | `./.pglite` | Where local PGlite stores its data. `memory://` keeps it in memory (used by the tests) |
| `UPLOADS_DIR` | no | `./uploads` | Folder for uploaded files when R2 isn't configured. Not persistent on Render |
| `SEED_DEMO_DATA` | no | `true` in dev, `false` in production | `true` fills an empty database with sample courses, students and demo accounts. When `false`, only the first admin is created, and demo content is never added later |
| `SEED_ADMIN_EMAIL` | prod | – | Email of the first admin, created only when the database has no accounts and demo data is off |
| `SEED_ADMIN_NAME` | no | `Quản trị viên` | Display name of the first admin |
| `SEED_DEFAULT_PASSWORD` | prod | `123456` (dev only) | Starting password of the first admin, or of all demo accounts when demo data is on. At least 8 characters |
| `CORS_ORIGIN` | setup B | localhost only | Comma-separated list of frontend origins allowed to call the API |
| `ENABLE_DEMO_LOGIN` | no | off | `true` turns on one-click demo accounts. **Never in production**: anyone could sign in as admin |
| `CLIENT_DIST` | no | `../client/dist` | Built web app that Express should serve |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | prod | – | Store uploads in Cloudflare R2 instead of on disk. Set all of them, with `R2_PUBLIC_URL` being the bucket's public `r2.dev` or custom domain |
| `LOG_LEVEL` | no | `info` | Pino log level |

### Client (Vercel only)

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API base URL, for example `https://<service-name>.onrender.com`. Leave unset when the API serves the web app (setup A, or local dev) |

---

## 6. Operations: accounts, backups, updates

### First steps after the first deploy

1. Sign in with `SEED_ADMIN_EMAIL` and `SEED_DEFAULT_PASSWORD`.
2. Open **Người dùng & Phân quyền** (`/accounts`). In your own row choose **Đặt lại mật khẩu** to replace the starting password. You stay signed in; any other sessions are signed out.
3. Choose **Cấp tài khoản mới** to create the lecturer and student accounts. A second admin is a good idea, so someone can still unlock or reset the first one.
4. Optionally, remove `SEED_DEFAULT_PASSWORD` from the Render environment. It is only read when the database is created.

From the same page an admin can **Sửa thông tin** (edit name, email, class), change the role, **Khóa tài khoản** (lock, which also signs the user out everywhere), unlock, reset a password, and **Xóa tài khoản** (permanent: it also deletes that user's enrollments, submissions and badges). The app always keeps at least one active admin.

**If no admin can sign in** (forgotten password or locked out), reset the password from the server shell. On Render, open the service, then **Shell**:

```bash
pnpm --filter server set-password admin@your-school.edu.vn '<new password>'
```

### Backups

- **Database:** Supabase backs up the database daily (how long backups are kept depends on your Supabase plan; see **Database → Backups**). For your own copy, run `pg_dump "<DATABASE_URL>" > backup.sql` from any machine with the PostgreSQL client tools.
- **Uploaded files:** they live in your R2 bucket. Copy it with any S3-compatible tool (for example `rclone`) if you want an off-site copy.

### Updating

Push to the branch Render deploys from (usually `main`). Render rebuilds and restarts automatically. New migrations are applied on startup, and existing data is kept.

---

## 7. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Deploy fails with *"Cơ sở dữ liệu chưa có tài khoản nào: hãy đặt SEED_ADMIN_EMAIL…"* or *"Hãy đặt SEED_DEFAULT_PASSWORD…"* | Set `SEED_ADMIN_EMAIL` and an 8+ character `SEED_DEFAULT_PASSWORD` in the Render environment, then redeploy |
| Sample courses or students appear in production | The database was created with `SEED_DEMO_DATA=true`. Delete the demo accounts and courses on the Accounts and Courses pages, or start over with an empty database |
| Start fails with *getaddrinfo ENOTFOUND db.….supabase.co* | You used Supabase's direct connection (IPv6 only). Use the **Session pooler** string instead |
| Start fails with *Thiếu DATABASE_URL* | Set `DATABASE_URL` in the Render environment |
| *password authentication failed* | Check the password in `DATABASE_URL`. For the pooler the user name is `postgres.<project-ref>`, not just `postgres` |
| Build fails with `vite: not found` | The install step ran with `NODE_ENV=production`. Keep `NODE_ENV=development` in front of `pnpm install` in the build command |
| Build fails on `corepack` or on the pnpm version | Make sure the build command starts with `npm install -g corepack@latest && corepack enable`, and that `package.json` keeps its `packageManager` field |
| Uploaded files disappear after a deploy | R2 isn't configured, so files were kept on the server's disk, which Render resets. Set the `R2_*` variables |
| File links stop working after a week | `R2_PUBLIC_URL` is missing, so links were signed URLs that expire after 7 days. Make the bucket public (or add a domain) and set `R2_PUBLIC_URL` |
| Browser console shows a CORS error (setup B) | Add the exact frontend origin, with `https://` and without a trailing slash, to `CORS_ORIGIN` |
| Uploaded files return 404 on Vercel (setup B) | Add the `/uploads` rewrite from [4.2](#42-frontend-on-vercel), or configure R2 |
| Too many failed logins | The login form locks for 15 minutes after 10 failed attempts from the same IP and email. Wait, or restart the service |
