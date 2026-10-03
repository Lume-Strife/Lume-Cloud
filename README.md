# NESI PowerTech Platform

Smart metering, billing, and **service accountability** for Nigeria's electricity sector, built for the NESI Innovation Challenge 2026 (PowerTech Track 1).

The differentiator: instead of only billing kWh consumed, verify the supply hours a feeder actually delivered against its NERC Band A-E commitment, and apply the 7-Day Rule from data.

- Full requirements: [docs/PRD.md](docs/PRD.md)
- Data is **simulated** at meter level. Feeder-level data should come from published DisCo/NERC sources where available. Always label simulated data as simulated.

## Layout

| Path | Purpose |
|---|---|
| `src/accountability/` | Engine: delivered hours, data coverage, Band classification, 7-Day Rule, compensation and exemption rules |
| `src/ingest/` | Reading validation, idempotent storage (SQLite locally), API Gateway-shaped handler, bulk loader |
| `src/billing/` | Itemised bills per meter per cycle, supply-backed estimation, downgrade credit recommendations |
| `config/bands.json` | Band thresholds and rule parameters (verify against the current NERC order) |
| `config/tariffs.json` | Tariff per Band and VAT. **Placeholder rates**, replace with the DisCo's current NERC-approved tariff |
| `simulator/` | Generates simulated feeder voltage and meter readings |
| `infra/terraform/` | AWS skeleton: DynamoDB, S3, budget alarm (unvalidated) |
| `tests/` | Engine tests |

## Quick start

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python simulator/simulate.py --days 30 --target-hours 18.5 --drop-rate 0.03
python -m src.ingest.load data/                      # safe to re-run: replays are deduplicated
python -m src.accountability.cli data/feeder_readings.csv --band A
python -m src.billing.cli M001 --from 2026-09-01 --to 2026-10-01   # add --json for machine output
pytest
```

## Rules worth knowing

- **Missing data is not an outage.** A day with less than `min_day_coverage` of its samples is reported as insufficient data, is not judged, and breaks any failure streak.
- **Estimation needs proof of supply.** A missing meter reading is estimated only if feeder data shows supply in that slot. If supply is unknown, the slot is not billed.
- **Recommendations are never applied.** Downgrade credits and compensation flags appear on the bill for a human to act on.

## Roadmap

1. [x] Accountability engine and simulator (first slice)
2. [x] Ingestion: validation, dedup, local store, API handler
   - [ ] DynamoDB store, Lambda + API Gateway in Terraform, SQS buffer
3. [x] Billing engine (rates are placeholders)
4. [ ] Dashboard (feeder card, bill breakdown)
5. [ ] Theft detection (stretch)
6. [ ] Auth, roles, audit log
