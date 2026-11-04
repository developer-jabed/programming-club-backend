# Programming Club Backend (v1.1 – Improved)

Modern, secure backend for college Programming Clubs featuring **Sectors**, **Project Rooms**, **Tasks**, **MCQ Tests**, **Real-time Chat**, **Notifications** and **Analytics**.

## ✨ Improvements in this version

- **Socket.io JWT authentication** – no more forged user IDs
- **Strict rate limiting** on login / refresh (8 attempts / 15 min)
- **Global rate limit** reduced to 300 req / 15 min
- **Zod-validated environment** – server refuses to start with missing/invalid env
- **Swagger UI** available at `/docs`
- **Response compression** enabled
- **Request ID** (`x-request-id`) on every request/response
- **Standardized on `bcrypt`** (removed bcryptjs)
- **Admin seed** no longer logs the password
- **Clean `.env.example`** – real `.env` is never shipped
- Better CORS & cookie secret handling

## Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Runtime      | Node.js + TypeScript (ESM)          |
| Framework    | Fastify 5                           |
| ORM          | Prisma 7 + PostgreSQL               |
| Auth         | JWT (access + refresh) + Cookies    |
| Real-time    | Socket.io (JWT protected)           |
| Queue        | BullMQ + Redis                      |
| Storage      | Cloudinary                          |
| Validation   | Zod                                 |
| Docs         | Swagger / OpenAPI                   |

## Quick Start

```bash
# 1. Clone / extract
cd programming-club

# 2. Install
pnpm install

# 3. Environment
cp .env.example .env
# Edit .env with your real values (especially DATABASE_URL, JWT secrets, Redis)

# 4. Database
pnpm db:generate
pnpm db:migrate
pnpm db:seed          # creates the first admin

# 5. Run
pnpm dev
```

- API base: `http://localhost:5000/api/v1`
- Health: `http://localhost:5000/health`
- Swagger: `http://localhost:5000/docs`
- Socket.io: connect with `{ auth: { token: "<accessToken>" } }`

## Project Structure

```
src/
├── app.ts                 # Fastify app (plugins, swagger, rate-limit…)
├── server.ts              # HTTP + Socket.io bootstrap
├── app/
│   ├── config/            # Zod-validated config
│   ├── middlewares/       # auth, rateLimiter, validate, error
│   ├── helper/            # jwt, pagination, seed, fileUploader
│   ├── modules/           # auth, user, project, task, test, sector…
│   ├── routes/index.ts
│   └── shared/            # prisma, queue, sendResponse
└── types/
```

## Authentication

1. `POST /api/v1/auth/login` → `{ accessToken, refreshToken, user }`
2. Send `Authorization: Bearer <accessToken>` or cookie
3. Socket.io: `io(url, { auth: { token: accessToken } })`
4. Refresh: `POST /api/v1/auth/refresh-token`

## Security Notes

- All Socket.io connections require a valid JWT.
- Login is rate-limited.
- Never commit `.env`. Use `.env.example` only.
- JWT secrets must be ≥ 32 characters.
- In production set `NODE_ENV=production` and a strong `COOKIE_SECRET`.

## License

MIT
