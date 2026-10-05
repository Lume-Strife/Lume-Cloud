# Front-end handoff: Lume Cloud

## What is live
- The backend runs on AWS (eu-west-1): an API on Lambda, DynamoDB storage, and an ingest path for meter data.
- API address: `<API_URL>` (ask Abdulmujeeb for the real one, it is not stored in the repo).
- **All data is simulated.** Ask `GET /period` for the window the data covers.
- Four demo accounts exist: `customer`, `customer2`, `ops`, `regulator`. Passwords are random and were shown once. Get them from Abdulmujeeb privately. Never commit them.

## Run `web/` against the live API (PowerShell)
```powershell
cd web
npm ci
$env:API_URL = "<API_URL>"     # no trailing slash
npm run dev                    # http://localhost:3000
```
`web/` calls the API from the server only (`lib/api.ts`) and keeps the login token in an httpOnly cookie. The browser never talks to the API directly, so there is no CORS to configure.

## Endpoints (all JSON unless noted; send `Authorization: Bearer <token>`)
| Route | Who | Notes |
|---|---|---|
| `POST /auth/login`, `POST /auth/logout`, `GET /me` | anyone / signed in | login returns a token valid for 12 hours |
| `GET /health` | anyone | no login |
| `GET /period` | signed in | the default window; most routes also take `?from=YYYY-MM-DD&to=YYYY-MM-DD` (to > from, at most 92 days, else 422) |
| `GET /customer/summary` | customer | their own meter only |
| `GET /ops/feeders`, `GET /ops/cases`, `GET /ops/cases/{meter\|feeder}/{id}`, `GET /ops/meters/{id}` | operations | |
| `POST /ops/cases/{type}/{id}/decision` | operations | body `{status: investigating\|confirmed\|dismissed, note}` |
| `POST /ops/detection/run` | operations | slow, see below |
| `GET /regulator/compliance`, `GET /regulator/compliance.csv` | regulator | the CSV is `text/csv` |
| `GET /audit` | operations, regulator | newest first, `?limit=` up to 1000 |

Response shapes are typed in `web/lib/types.ts`. Wrong role gives 403, no or expired token gives 401.

## What the UI has to cope with
- **Detection run is slow.** About 12 seconds on 14 days of data, and it grows with the period. Show a loading state, disable the button, and do not set a short timeout. API Gateway cuts requests off at 30 seconds, so show a clear message on 503 or 504.
- **First request after idle can be slow** (Lambda cold start, a few seconds). The ingest function's first request measured 5 seconds. The API's has not been measured.
- **Rate limit:** about 20 requests per second across the whole API. Do not fan out dozens of requests from one page. Handle 429.
- **Sessions last 12 hours.** On 401, send the user to the login page.
- **`flag_id` is an opaque string.** On DynamoDB it is a 32-character hash, not a number. Never do arithmetic on it. (`types.ts` should say `string | number`.)
- **Error text:** the 503 message in `lib/api.ts` says to start `uvicorn`, which is wrong for a deployed API. Reword it.

## Hosting later
Planned: Vercel. Root Directory `web`, one environment variable `API_URL`. The session cookie is already `secure` in production. CI runs `npx next typegen` before `tsc`, because Next 16 generates the `PageProps` and `LayoutProps` types.

## Ground rules
- Do not change an API response shape without telling Abdulmujeeb. The backend tests pin the shapes.
- Never commit passwords, tokens, or API keys.
