# Nếp Học LMS

A learning management system for schools and training teams, with three roles: **student**, **lecturer** and **admin**.

| Part | Stack |
| --- | --- |
| `client/` | React 19, Vite 6, Tailwind CSS 4, TanStack Query, wouter |
| `server/` | Node.js 22, Express 5, Drizzle ORM, SQLite (`better-sqlite3`) |
| `docs/api-spec.yaml` | OpenAPI contract. `pnpm codegen` generates the client hooks and the server's Zod validation from it |

Uploaded files are stored on the server's disk, or in Cloudflare R2 if you configure it.

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
DATABASE_PATH=lms.db
ENABLE_DEMO_LOGIN=true
```

Start the API and the web app together:

```powershell
pnpm dev
```

- Web app: http://localhost:3000 (Vite forwards `/api` and `/uploads` to port 5000)
- API: http://localhost:5000/api/healthz

On first start the server creates `server/lms.db` and fills it with **demo data**: sample courses, students, materials, assignments and certificates. That happens because demo data is on by default outside production (`SEED_DEMO_DATA`). Every demo account uses the password `123456`, or `SEED_DEFAULT_PASSWORD` if you set it:

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

To reset local data, stop the server and delete `server/lms.db*`.

---

## 2. Choosing a hosting setup

The backend keeps its data in a **SQLite file on disk**. That has two consequences:

- It needs a **long-running server with a persistent disk**. Serverless platforms such as Vercel Functions or Netlify Functions can't host the API.
- It runs as **a single instance**. That is plenty for one school, but it can't scale out horizontally.

| Setup | When to use it |
| --- | --- |
| **A. Render only, one service** (recommended) | Express serves the API *and* the built web app from one URL. No CORS settings, upload links just work, and there's one bill and one log. |
| **B. Vercel (frontend) + Render (API)** | You want Vercel's preview deployments or CDN for the frontend. It's more configuration, see [section 4](#4-alternative-frontend-on-vercel-api-on-render). |

> **Don't use Render's Free plan for real data.** Free web services can't have a persistent disk, so the database and uploaded files are wiped on every deploy and restart. The Free plan also sleeps when idle.

---

## 3. Deploy to Render (recommended)

The repository includes a Render Blueprint (`render.yaml`) that sets up everything below.

| Setting | Value |
| --- | --- |
| Service | One Node web service, **Starter** plan, Singapore region |
| Build | Installs dependencies with the pinned pnpm, then builds `client/dist` |
| Start | `pnpm --filter server start`, which serves `/api`, `/uploads` and the web app |
| Disk | 1 GB persistent disk at `/var/data`, holding `lms.db` and `uploads/` |
| Health check | `/api/healthz` |

### Steps

1. **Push the code to GitHub**, including `render.yaml`.
2. In the Render dashboard, choose **New → Blueprint** and select this repository. Render reads `render.yaml`.
3. Render asks for the variables marked `sync: false`:
   - **`SEED_ADMIN_EMAIL`** (required): the email of the first administrator.
   - **`SEED_DEFAULT_PASSWORD`** (required): at least 8 characters, the first administrator's starting password.

     In production the database starts **empty except for this one admin**, with no demo courses or students. Without these two values the server refuses to start on an empty database. Both are only read once, when the database is created; changing them later has no effect.
   - **`CORS_ORIGIN`**: leave empty for this setup, because the browser and the API share one origin.
   - **`R2_*`**: leave empty to store uploads on the disk, or fill all of them to use Cloudflare R2.
4. Click **Apply**. The first build takes a few minutes, mostly compiling `better-sqlite3`.
5. Open `https://<service-name>.onrender.com` and sign in with `SEED_ADMIN_EMAIL` and `SEED_DEFAULT_PASSWORD`. Then **change that password** and create the real accounts (see [Operations](#6-operations-accounts-backups-updates)).

   To try the app with sample data on a throwaway instance, set `SEED_DEMO_DATA=true` *before the first start*. Never do this on the instance that holds real data.
6. Optional: add your own domain under **Settings → Custom Domains**. Render provides HTTPS automatically.

### Setting it up by hand instead of with the Blueprint

Create a **Web Service** from the repository with these settings:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Build command | `npm install -g corepack@latest && corepack enable && NODE_ENV=development pnpm install --frozen-lockfile && pnpm --filter client build` |
| Start command | `pnpm --filter server start` |
| Health check path | `/api/healthz` |
| Instance type | Starter or higher |
| Disk | Mount path `/var/data`, 1 GB |
| Environment | `NODE_ENV=production`, `NODE_VERSION=22`, `DATABASE_PATH=/var/data/lms.db`, `UPLOADS_DIR=/var/data/uploads`, `SEED_ADMIN_EMAIL=<your email>`, `SEED_DEFAULT_PASSWORD=<secret>` |

The install step uses `NODE_ENV=development` because pnpm skips devDependencies when `NODE_ENV=production`, and the web app build needs `vite`.

### Things to know about a service with a disk

- A service with an attached disk **runs as a single instance**, and each deploy causes a short downtime while the old instance stops.
- Only files under `/var/data` survive a deploy. That's why `DATABASE_PATH` and `UPLOADS_DIR` both point there.

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
| `DATABASE_PATH` | prod | `./lms.db` | SQLite file. On Render: `/var/data/lms.db` |
| `UPLOADS_DIR` | prod | `./uploads` | Folder for uploaded files when R2 isn't configured. On Render: `/var/data/uploads` |
| `SEED_DEMO_DATA` | no | `true` in dev, `false` in production | `true` fills an empty database with sample courses, students and demo accounts. When `false`, only the first admin is created, and demo content is never added later |
| `SEED_ADMIN_EMAIL` | prod | – | Email of the first admin, created only when the database has no accounts and demo data is off |
| `SEED_ADMIN_NAME` | no | `Quản trị viên` | Display name of the first admin |
| `SEED_DEFAULT_PASSWORD` | prod | `123456` (dev only) | Starting password of the first admin, or of all demo accounts when demo data is on. At least 8 characters |
| `CORS_ORIGIN` | setup B | localhost only | Comma-separated list of frontend origins allowed to call the API |
| `ENABLE_DEMO_LOGIN` | no | off | `true` turns on one-click demo accounts. **Never in production**: anyone could sign in as admin |
| `CLIENT_DIST` | no | `../client/dist` | Built web app that Express should serve |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | no | – | Store uploads in Cloudflare R2 instead of on disk. Set all of them, with `R2_PUBLIC_URL` being the bucket's public `r2.dev` or custom domain |
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

Everything lives in `/var/data`: the `lms.db` file and the `uploads/` folder. You have two options:

- Use Render's disk snapshots. Check the **Disks** section of the service for snapshot and restore options.
- Make your own copy from the Shell, then download it:

  ```bash
  cd server && node -e "new (require('better-sqlite3'))(process.env.DATABASE_PATH).backup('/var/data/backup-' + new Date().toISOString().slice(0,10) + '.db').then(() => console.log('backup done'))"
  ```

### Updating

Push to the branch Render deploys from (usually `main`). Render rebuilds and restarts automatically. New database columns are added on startup, and existing data is kept.

---

## 7. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Deploy fails with *"Cơ sở dữ liệu chưa có tài khoản nào: hãy đặt SEED_ADMIN_EMAIL…"* or *"Hãy đặt SEED_DEFAULT_PASSWORD…"* | Set `SEED_ADMIN_EMAIL` and an 8+ character `SEED_DEFAULT_PASSWORD` in the Render environment, then redeploy |
| Sample courses or students appear in production | The database was created with `SEED_DEMO_DATA=true`. Delete the demo accounts and courses on the Accounts and Courses pages, or start over with an empty disk |
| Build fails with `vite: not found` | The install step ran with `NODE_ENV=production`. Keep `NODE_ENV=development` in front of `pnpm install` in the build command |
| Build fails on `corepack` or on the pnpm version | Make sure the build command starts with `npm install -g corepack@latest && corepack enable`, and that `package.json` keeps its `packageManager` field |
| `better-sqlite3` error at startup (*"Could not locate the bindings file"*) | The native module wasn't built. Check that `pnpm-workspace.yaml` still allows the `better-sqlite3` build, and clear the build cache (**Manual Deploy → Clear build cache & deploy**) |
| Data or uploads disappear after a deploy | The service has no disk, or `DATABASE_PATH`/`UPLOADS_DIR` don't point inside the disk's mount path |
| Browser console shows a CORS error (setup B) | Add the exact frontend origin, with `https://` and without a trailing slash, to `CORS_ORIGIN` |
| Uploaded files return 404 on Vercel (setup B) | Add the `/uploads` rewrite from [4.2](#42-frontend-on-vercel), or configure R2 |
| Too many failed logins | The login form locks for 15 minutes after 10 failed attempts from the same IP and email. Wait, or restart the service |
