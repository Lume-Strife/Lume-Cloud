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

## Data source labels and the official feeder register
Every feeder row from `GET /ops/feeders` and `GET /regulator/compliance` (and the CSV export) now carries:
- `feeder_telemetry_source` and `meter_telemetry_source`: one of `simulated`, `authorized_external`, `lume_hardware`, `none`, `unknown`.
- `official`: the NERC register data (`source_feeder_name`, `disco`, `state`, `business_unit`, `monthly_energy_cap_kwh`, `data_type`, `source_url`), or `null`.

Please show these on every feeder view, so nobody has to guess real from simulated. `unknown` means nobody has labelled the feeder yet: show it as unverified, never as real. The regulator CSV banner now lists the sources present (it still says `SIMULATED DATA` when everything is simulated).

**Official feeders without readings.** The 21 NERC register feeders have no telemetry (source `none`). By default both endpoints leave them out, so today's screens do not change. Add `?include_untracked=true` to include them; they come back with `status: "no_data"`.

**New status `no_data`** means nothing could be judged (no usable readings). It can also appear for a normal feeder whose data stopped arriving. Three small front-end changes are needed:
1. Add `"no_data"` to `FeederStatus` in `lib/types.ts`, to the tone map in `components/StatusMark.tsx`, and to the labels in `lib/format.ts`.
2. In `app/(app)/regulator/page.tsx`, the breach count is `status !== "compliant"`. Change it to count only `at_risk` and `downgrade`, or `no_data` feeders will be counted as breached.
3. Never show `no_data` as green. It is unknown, not compliant.

**The energy cap** (`monthly_energy_cap_kwh`) is NERC regulatory information. It is not delivered energy and not supply hours. Never plot it as either.

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
