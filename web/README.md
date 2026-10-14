# Lume web

Next.js dashboards for customers, DisCo operations and regulators. Pages are server-rendered and call the platform API from the server, so the session token stays in an httpOnly cookie.

```bash
npm install
npm run dev        # http://localhost:3000, needs the API running (see ../README.md)
```

`API_URL` sets where the API lives (default `http://127.0.0.1:8000`).

## Deploy on Vercel

- Root Directory: `web`. Node 22.
- Environment variable `API_URL`: the dashboard API address from `terraform -chdir=infra/terraform output -raw api_url`, with no trailing slash. It is **not** the ingest address (that one ends in `/ingest`).
- Redeploy after changing it: environment variables only reach new deployments.
- If the site says the platform API is not reachable, the message shows the address in use. `http://127.0.0.1:8000` means the variable was not picked up.
- CI runs `npx next typegen` before `tsc`, because Next 16 generates the `PageProps` and `LayoutProps` types.

The API contract, roles and data-source labels are in [../docs/FRONTEND.md](../docs/FRONTEND.md).
