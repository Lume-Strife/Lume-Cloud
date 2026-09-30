# NESI PowerTech Platform

Smart metering, billing, and **service accountability** for Nigeria's electricity sector, built for the NESI Innovation Challenge 2026 (PowerTech Track 1).

The differentiator: instead of only billing kWh consumed, verify the supply hours a feeder actually delivered against its NERC Band A-E commitment, and apply the 7-Day Rule from data.

- Full requirements: [docs/PRD.md](docs/PRD.md)
- Data is **simulated** at meter level. Feeder-level data should come from published DisCo/NERC sources where available. Always label simulated data as simulated.

## Layout

| Path | Purpose |
|---|---|
| `src/accountability/` | Engine: delivered hours, Band classification, 7-Day Rule, compensation flag |
| `config/bands.json` | Band thresholds and rule parameters (verify against the current NERC order) |
| `simulator/` | Generates simulated feeder voltage and meter readings |
| `infra/terraform/` | AWS skeleton: DynamoDB, S3, budget alarm (unvalidated) |
| `tests/` | Engine tests |

## Quick start

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python simulator/simulate.py --days 10 --target-hours 18
python -m src.accountability.cli data/feeder_readings.csv --band A
pytest
```

## Roadmap

1. [x] Accountability engine and simulator (first slice)
2. [ ] Ingest API (API Gateway + Lambda) and storage
3. [ ] Billing engine
4. [ ] Dashboard (feeder card, bill breakdown)
5. [ ] Theft detection (stretch)
6. [ ] Auth, roles, audit log
