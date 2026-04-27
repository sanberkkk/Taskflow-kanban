# TaskFlow

A **Kanban-style task board** app: projects, boards, columns, and draggable tasks. Built as a **single-user / demo** experience with **no backend**—all data lives in the browser.

## Quick Vercel Setup (Important)

Yes, others can run this on Vercel, but they must use the correct project root:

- **Root Directory must be `taskflow`** (not repository root)
- **Framework Preset:** Next.js
- **Output Directory:** leave empty (default)

If Root Directory is wrong, deployment may show `404: NOT_FOUND` even when build logs look successful.

## Stack

- **Next.js** (App Router) · **React** · **TypeScript**
- **Tailwind CSS** for styling
- **@dnd-kit** for drag and drop
- **lucide-react** for icons

## Features

- **Auth (mock):** register on first use, then sign in with the same email/password on that device. A `taskflow_auth` cookie is set on successful login (optional consistency); **access control** is enforced on the **client** by checking `localStorage` and redirecting to `/login` if there is no session. User and app data are stored in **`localStorage`**.
- **Projects:** create and list projects (scoped to the signed-in “user”).
- **Boards / Kanban:** columns, tasks, drag-and-drop, deadlines, and a “Done” column with sensible move rules.
- **No server API** in this repo: there are no `app/api` routes; nothing is sent to a remote database.

## Data & limitations

- Data is **per browser / per device**. Clearing site data, another browser, or **another phone** will not see the same projects unless you add a real backend later.
- This is **not** multi-user sync or e-mail–based board sharing. That would require server storage and identity.

## Scripts

```bash
npm install
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000) in development.

```bash
npm run build
npm start
```

```bash
npm run lint
```

## Routes (overview)

| Path | Purpose |
|------|---------|
| `/login` | Register / sign in (mock) |
| `/` | Project grid (after auth) |
| `/boards/[boardId]` | Kanban board |

Unauthenticated users are **redirected to `/login` in the browser** (see `app/page.tsx` and `app/boards/.../page.tsx`); there is no Edge `middleware` in this project (avoids serverless middleware issues on hosts like Vercel for this mock-auth setup).

## Deploy

Standard **Next.js** deploy (e.g. [Vercel](https://vercel.com)). Data remains **client-only**; each visitor has their own isolated storage.

### Vercel (this repository layout)

The Next.js app lives under **`taskflow/`**, not at the git repository root. In the Vercel project:

1. **Settings → General → Root Directory** → set to **`taskflow`** (important). If this is wrong, Vercel may build the wrong tree or serve a stale layout.
2. After changing it, open **Deployments → … → Redeploy** and **disable “Use existing Build Cache”** once so old Edge artifacts (e.g. from an old `middleware`) are dropped.
3. Confirm the deployment’s **commit** matches `main` where `taskflow/middleware.ts` is **absent** (this app does not use Edge middleware).

If you still see **`500` / `MIDDLEWARE_INVOCATION_FAILED`**, it is almost always **cache** or **wrong root directory**—there is no `middleware` in source anymore.

**`404: NOT_FOUND` (Vercel):** almost always **Root Directory** is not set to **`taskflow`**, so the deploy has no real Next app. Fix: **Settings → General → Root Directory → `taskflow`**, then **Redeploy** (turn off “Use existing Build Cache” once). Open the **production URL** from the latest **Ready** deployment (e.g. your team URL like `https://taskflow-xxx.vercel.app/`, then try `/` and `/login`). Do not use a deleted or old **Preview** URL.

**Which URL to open:** the **Visit** link on a deployment (e.g. `https://<name>-<id>-<team>.vercel.app`) is the correct URL for **that** deploy. A shorter `https://<project>.vercel.app` domain is only correct if it appears under **Settings → Domains** for *this* project; otherwise it may be another app or unassigned. After each new deploy, use **Visit** again or the domain listed in **Domains**.

**404 on a just-built deployment:** in **Project → Settings → General**, ensure **Output Directory** is **empty** (default for Next.js), **Framework Preset** is **Next.js**, and **Root Directory** is `taskflow` (if the repo is a monorepo). Redeploy after changing config.

## Project layout (high level)

- `app/` — App Router pages (`page.tsx`, `login`, `boards`)
- `next.config.ts` — Next.js config
- `vercel.json` — Vercel framework hint (Next.js)
- `package.json` — scripts and dependencies

---

TaskFlow is a local-first prototype. For production sharing, accounts across devices, or team permissions, you would add a database and a real API.
