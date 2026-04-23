# TaskFlow

A **Kanban-style task board** app: projects, boards, columns, and draggable tasks. Built as a **single-user / demo** experience with **no backend**—all data lives in the browser.

## Stack

- **Next.js** (App Router) · **React** · **TypeScript**
- **Tailwind CSS** for styling
- **@dnd-kit** for drag and drop
- **lucide-react** for icons

## Features

- **Auth (mock):** register on first use, then sign in with the same email/password on that device. A short-lived `taskflow_auth` cookie is used for route protection; user and app data are stored in **`localStorage`**.
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

Unauthenticated users are redirected to `/login` via `middleware.ts` (except when the login route is used).

## Deploy

Standard **Next.js** deploy (e.g. [Vercel](https://vercel.com)): connect the repo, use the default build (`next build`) and start (`next start`) settings. Data remains **client-only**; each visitor has their own isolated storage.

## Project layout (high level)

- `app/` — App Router pages (`page.tsx`, `login`, `boards`)
- `middleware.ts` — auth cookie check for protected routes
- `next.config.ts` — Next.js config

---

TaskFlow is a local-first prototype. For production sharing, accounts across devices, or team permissions, you would add a database and a real API.
