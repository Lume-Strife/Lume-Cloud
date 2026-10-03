# Lume: NESI PowerTech Platform

Smart metering, billing, and **service accountability** for Nigeria's electricity sector, built for the NESI Innovation Challenge 2026 (PowerTech Track 1).

The differentiator: instead of only billing kWh consumed, verify the supply hours a feeder actually delivered against its NERC Band A-E commitment, and apply the 7-Day Rule from data.

- Full requirements: [docs/PRD.md](docs/PRD.md)
- Data is **simulated** at meter level. Feeder-level data should come from published DisCo/NERC sources where available. Always label simulated data as simulated.

## Layout

| Path | Purpose |
|---|---|
| `src/accountability/` | Engine: delivered hours, data coverage, Band classification, 7-Day Rule, compensation and exemption rules |
| `src/ingest/` | Reading validation, API Gateway-shaped handler, bulk loader |
| `src/billing/` | Itemised bills per meter per cycle, supply-backed estimation, downgrade credit recommendations |
| `src/detection/` | Theft and tamper flags with reason, confidence and evidence |
| `src/store.py` | SQLite store: readings, flags, users, sessions, hash-chained audit log |
| `src/api/` | FastAPI backend: auth, role-scoped endpoints, CSV export, device ingestion |
| `src/demo/seed.py` | Builds a fresh demo database with one account per role |
| `web/` | Next.js dashboards for customers, DisCo operations and regulators |
| `config/` | Band rules, tariffs (**placeholder rates**), detection thresholds |
| `simulator/` | Simulated feeders, meters, readings and injected theft (with ground truth) |
| `infra/terraform/` | AWS skeleton: DynamoDB, S3, budget alarm (unvalidated) |
| `tests/` | Engine, ingestion, billing, detection and API tests |

## Run the demo

Three terminals from the repo root.

```bash
# 1. Python setup and demo data (rebuilds data/platform.db)
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m src.demo.seed                              # prints the demo accounts

# 2. API on http://127.0.0.1:8000 (docs at /docs)
uvicorn src.api.main:app --reload

# 3. Dashboards on http://localhost:3000
cd web && npm install && npm run dev
```

Sign in as `customer`, `ops` or `regulator`. The password is `demo-password` unless you set `DEMO_PASSWORD` before seeding. The web app reads `API_URL` (default `http://127.0.0.1:8000`).

To accept readings from devices, set `INGEST_API_KEY` before starting the API and `POST /ingest` with an `X-Api-Key` header.

## Command-line tools

```bash
python -m src.ingest.load data/                      # safe to re-run: replays are deduplicated
python -m src.accountability.cli data/feeder_readings.csv --feeder F001 --band A
python -m src.billing.cli M0001 --from 2026-09-01 --to 2026-10-01   # add --json for machine output
python -m src.detection.run --truth data/injected_anomalies.csv     # scores flags against injected theft
pytest
```

## Rules worth knowing

- **Missing data is not an outage.** A day with less than `min_day_coverage` of its samples is reported as insufficient data, is not judged, and breaks any failure streak.
- **Estimation needs proof of supply.** A missing meter reading is estimated only if feeder data shows supply in that slot. If supply is unknown, the slot is not billed.
- **Recommendations are never applied.** Downgrade credits and compensation flags appear on the bill for a human to act on.
- **Flags are leads, not findings.** All flags on one meter or feeder form a single case, ranked by its strongest signal. Confirming or dismissing a case needs a note, covers every flag in it, and lands in the audit log. A new flag reopens a decided case.
- **The audit log is append-only.** Each entry hashes the previous one; `GET /audit` reports whether the chain is intact.

## Roadmap

1. [x] Accountability engine and simulator
2. [x] Ingestion: validation, dedup, local store, API handler
   - [ ] DynamoDB store, Lambda + API Gateway in Terraform, SQS buffer
3. [x] Billing engine (rates are placeholders)
4. [x] Dashboards: customer, operations, regulator, audit trail
5. [x] Theft detection (rules-based)
6. [x] Auth, roles, audit log
7. [ ] Deploy to AWS
8. [ ] Customer disputes (P2)
