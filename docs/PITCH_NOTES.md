# Pitch notes: what is real, what is simulated, what to say

## Claims you can back up
| Claim | Evidence |
|---|---|
| It is deployed on AWS, not just designed | Everything is in `infra/terraform/`. `scripts/smoke_dynamodb.py` and `scripts/smoke_ingest.py` pass against the real tables and endpoint |
| A database problem does not lose readings | Readings go through SQS with a dead-letter queue, and writes are idempotent. The smoke test replays readings and nothing changes |
| Sending a reading twice cannot change what is stored | Contract tests on both stores, plus the live replay check |
| Every decision is audited and tamper-evident | Hash-chained audit log, verified through `GET /audit`. Say "tamper-evident", never "tamper-proof" |
| Missing data is never treated as an outage | A day with too little data is reported as insufficient, not judged against the 7-Day Rule |
| Detection works on the demo data | 9 of 9 injected theft cases caught, 0 false positives. Always add: simulated, scored against the simulator's own ground truth |
| There are no always-on costs | Serverless only, with a $10 budget alert. Do not quote a monthly figure you have not measured |

## Claims to avoid
- **"Real-time."** A reading took about 24 s from request to DynamoDB in one smoke run (cold starts plus a 5 s batching window).
- **"Accurate in the field."** Detection has only been scored on simulated theft.
- **"Production-ready" or just "secure."** The demo logins are public, the deployer has broad permissions, there is no load test and no firewall.
- **Any bill as real money.** The tariffs are placeholders.
- **"NERC compliant."** The rules come from public orders and press reports. Check them against the current order first.
- **"Handles N meters."** It has not been load tested. The demo has 90.

## Likely questions, honest answers
- **Is the data real?** No, it is simulated. The route to real data: DisCos publish Band A feeder hours, NERC publishes quarterly reports, and a pilot would use one real feeder and sample meter data from a DisCo.
- **How do you know detection works?** On the simulator's injected theft it scored 9 of 9 with no false positives. That is self-generated, so the next step is blind validation against cases a DisCo has already confirmed.
- **What if the cloud region is down?** Devices retry and the store ignores duplicates. It is a single region today, which is a known limit.
- **How does it scale?** DynamoDB on-demand, SQS and Lambda all scale. Known weak spots: a full detection run grows with the period (12.5 s on 14 days), and nothing has been load tested.
- **How is it secured?** The ingest key is in SSM, each function has its own narrow role, queues and tables are encrypted, demo passwords are random, the API is rate-limited. Gaps: no per-user login throttling, no firewall, a broad deployer account, and the API role can overwrite an audit entry (the chain would show it).
- **Who benefits?** Customers can check hours received against hours billed, DisCos get revenue-protection leads, and the regulator gets evidence for the 7-Day Rule.

## Numbers measured, and what each one is
| Number | What it is |
|---|---|
| 263 tests | Automated tests run in CI, including both stores and the Lambda handlers |
| 9 of 9 caught, 0 false positives | Detection on simulated data with injected theft |
| about 1.1 s | `GET /ops/feeders` from Nigeria to eu-west-1, one measurement |
| about 12.5 s | Full detection run on 14 days of data, one measurement |
| about 24 s | One reading from request to DynamoDB, one smoke run |
