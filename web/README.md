# Lume web

Next.js dashboards for customers, DisCo operations and regulators. Pages are server-rendered and call the platform API from the server, so the session token stays in an httpOnly cookie.

```bash
npm install
npm run dev        # http://localhost:3000, needs the API running (see ../README.md)
```

`API_URL` sets where the API lives (default `http://127.0.0.1:8000`).
