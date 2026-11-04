# Changelog

## [1.1.0] – 2026-10-29

### Security
- Socket.io connections now require a valid JWT (handshake auth)
- Client-sent `tokenUserId` is no longer trusted
- Per-user message rate limiting on chat
- Auth endpoints (login / refresh) limited to 8 attempts / 15 min
- Global rate limit tightened to 300 requests / 15 min
- Environment variables validated with Zod at startup
- Admin seed no longer prints the password
- Real `.env` removed from distribution; only `.env.example` is shipped

### Features & DX
- Swagger UI available at `/docs`
- Response compression enabled
- Request ID (`x-request-id`) on every request/response
- Standardized on `bcrypt` (removed `bcryptjs`)
- Improved README and project documentation

### Internal
- Config module rewritten with type-safe env parsing
- Cleaner rate-limiter module
- Better graceful shutdown logging
