# SmartOps API (Node + Express + MongoDB)

Standalone backend for the SmartOps frontend. **This service does not run inside the Lovable preview** — run it locally or deploy to Render/Railway/Fly, then point the frontend at it via `VITE_API_URL`.

## Stack
- Node.js + Express
- MongoDB Atlas + Mongoose
- JWT auth, bcrypt password hashing
- Zod input validation, rate limiting, CORS, morgan logs

## Setup

```bash
cd server
cp .env.example .env        # fill in MONGO_URI + JWT_SECRET
npm install
npm run dev                 # http://localhost:5000
```

### MongoDB Atlas
1. Create a free cluster at https://cloud.mongodb.com
2. Database Access → add a user with read/write
3. Network Access → allow your IP (or 0.0.0.0/0 for dev)
4. Connect → "Drivers" → copy the connection string into `MONGO_URI`

## Endpoints

### Auth (`/api/auth`)
| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/register` | – | `{ name, email, password, company?, role? }` |
| POST | `/login` | – | `{ email, password }` |
| POST | `/forgot-password` | – | `{ email }` → returns `devCode` outside prod |
| POST | `/reset-password` | – | `{ email, code, newPassword }` |
| GET  | `/profile` | Bearer | – |
| PUT  | `/profile` | Bearer | `{ name?, company?, phone?, avatar? }` |
| PUT  | `/change-password` | Bearer | `{ currentPassword, newPassword }` |
| POST | `/logout` | Bearer | – |

### Modules (all require `Authorization: Bearer <token>`, scoped to the user)
- `/api/inventory`  GET / POST, PUT `/:id`, DELETE `/:id`
- `/api/payroll`    GET / POST, PUT `/:id`, DELETE `/:id`
- `/api/fleet`      GET / POST, PUT `/:id`, DELETE `/:id`
- `/api/production` GET / POST, PUT `/:id`, DELETE `/:id`
- `/api/reports/summary` GET — KPIs across all modules

## Deploy to Render
The included `render.yaml` is a blueprint. Push this repo to GitHub, "New Blueprint Instance" in Render, then set `MONGO_URI`, `JWT_SECRET`, and `CLIENT_ORIGIN` in the dashboard.

## Wiring the frontend
In the React app:

```ts
// src/lib/api.ts
const API = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
export async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json()).message || res.statusText);
  return res.json();
}
```

Then replace the `useLocalStore` calls in inventory/payroll/fleet/production pages with `api("/inventory")` etc., and swap `src/lib/auth.tsx` to call `/api/auth/*` instead of localStorage.
