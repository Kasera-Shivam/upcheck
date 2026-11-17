# UpCheck frontend (React + Vite + TypeScript)

1. Backend `.env`: set `FRONTEND_URL=http://localhost:5173` and `PORT=5000`, then start it (`bun dev`).
   Also run the plan seed once: `bun src/scripts/plan.script.ts`
2. Here: `npm install` (or `bun install`), then `npm run dev` and open http://localhost:5173

`/api` calls are proxied to http://localhost:5000 (see vite.config.ts), so the session cookie works without extra CORS setup.
For production, serve this build and the API from the same domain, or adjust the proxy and cookie settings.

Routes: /login /signup /forgot-password /account/reset-password (matches the email link) /  /monitors/:id /plans /settings /status/:id (public)
