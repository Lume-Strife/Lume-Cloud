# Product Requirements Document
## Smart Metering, Billing & Service Accountability Platform
**NESI Innovation Challenge 2026 · PowerTech Track 1 (Advanced Metering & Billing)**
**Team category:** University/Polytechnic Student Team
**Owner:** Abdulmujeeb Usman
**Status:** Draft v0.2 (Band rules verified, data strategy added)

> Items marked **[Assumption]** are proposals, not confirmed decisions. The project is **software-only**. Hardware is an optional extra, never a dependency.

---

## 1. Overview

A cloud platform that does three things on one data pipeline:

1. **Smart metering and billing**: ingest meter readings and bill customers accurately.
2. **Energy theft and fraud detection**: flag tampering, bypass, and billing anomalies.
3. **Service accountability**: verify the supply hours a feeder actually delivered against the NERC Band A-E promises, so customers are billed fairly and regulators can enforce the 7-Day Rule.

**Differentiator:** most metering products bill for kWh consumed. This one also proves what was *delivered* versus what was *promised*.

## 2. Problem Statement

- Customers are often billed without evidence that they received the supply hours their Band guarantees.
- Distribution companies lose revenue to theft, bypass, and estimated billing disputes.
- Regulators have limited, verifiable feeder-level data to enforce service standards.

## 3. Goals and Non-Goals

**Goals**
- Ingest meter and feeder data reliably and store it securely.
- Compute accurate bills and compare actual vs. promised supply hours per feeder.
- Surface suspected theft and anomalies with explainable flags.
- Give three audiences a clear dashboard: customer, DisCo operations, regulator.
- Deliver a working, demonstrable prototype for the NESI submission and NESI Week.

**Non-Goals (for MVP)**
- Manufacturing or certifying physical meters.
- Live integration with a real DisCo billing system.
- Automated disconnection or punitive action. Flags go to a human reviewer.
- Payment processing.

## 4. Users and Personas

| Persona | Need |
|---|---|
| **Customer** | See consumption, bill, and hours of supply received vs. Band promise. Raise a dispute. |
| **DisCo operations / revenue protection** | Review theft flags, prioritize field visits, view feeder health. |
| **Regulator / oversight** | See feeder-level compliance against Band A-E and 7-Day Rule evidence. |

## 5. Core Features

### 5.1 Meter Data Ingestion (P0)
- Accept readings (energy, voltage, timestamp, meter ID, tamper flag) via API/MQTT.
- Validate, deduplicate, and timestamp readings; tolerate late or out-of-order data.
- Meter-level readings come from a **simulator** (see Section 8, Data Strategy). Feeder-level supply hours use real published data wherever available.

### 5.2 Billing Engine (P0)
- Tariff configuration per Band.
- Generate a bill per customer per cycle from validated readings.
- Show a line-by-line breakdown and flag estimated vs. actual readings.

### 5.3 Service Accountability Engine (P0, core differentiator)
- Compute delivered supply hours per feeder per day/month from voltage/presence data.
- Compare against the minimum hours of the assigned Band (A-E).
- Output a compliance status per feeder and an evidence report usable for 7-Day Rule enforcement.
- Bill adjustment or credit recommendation when delivered hours fall short. Recommendation only in MVP.
- **Rules to encode (verified from NERC orders and press, re-check the source order before coding):**
  - Band hours: A 20+, B 16-19, C 12-15, D 8-11, E 4-7 per day (press-reported, confirm in the order).
  - **7-Day Rule:** a feeder below its committed hours for 7 consecutive days is automatically downgraded to its recorded level of supply. Two consecutive failed days require a published explanation.
  - **Compensation:** Band A feeders averaging 18-20 hours fall under the existing compensation framework.
  - **Special case:** for Feb-Mar 2026, Band A feeders under 18 hours were *not* downgraded and received special compensation instead.
- **All thresholds and rules must be configurable**, not hardcoded, because NERC directives change.

### 5.4 Theft and Fraud Detection (P1)
- Detect anomalies such as sudden consumption drops, feeder-vs-sum-of-meters energy imbalance, tamper events, and reverse or zero readings with load present.
- Start with rules plus statistical baselines. Add an ML model if time allows.
- Every flag carries a reason and a confidence score. Reuse pipeline and detection patterns from CS-01.

### 5.5 Dashboards and Alerts (P0/P1)
- Customer view: usage, bill, supply-hours-received vs. promised, dispute button.
- Operations view: flag queue, feeder map/list, case status.
- Regulator view: compliance table by feeder and Band, exportable report.
- Notifications for outages, flags, and new bills (P2).

### 5.6 Access Control and Audit (P0)
- Role-based access for the three personas.
- Immutable audit log for billing changes and flag decisions.

## 6. Functional Requirements (summary)

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | System ingests and validates meter readings | P0 |
| FR-2 | System generates itemized bills per tariff/Band | P0 |
| FR-3 | System computes delivered vs. promised supply hours per feeder | P0 |
| FR-4 | System flags suspected theft with reason and score | P1 |
| FR-5 | Role-based dashboards for customer, DisCo, regulator | P0 |
| FR-6 | Exportable compliance/evidence report | P1 |
| FR-7 | Audit trail for sensitive actions | P0 |
| FR-8 | Customer dispute submission and tracking | P2 |

## 7. Non-Functional Requirements

- **Security:** encryption in transit and at rest, least-privilege IAM, no secrets in code.
- **Privacy:** consumption data is personal data. Minimize and protect it (NDPA-aligned handling).
- **Reliability:** ingestion must buffer during downstream outages, with no silent data loss.
- **Scalability:** design for many meters per feeder. The prototype only needs to prove the pattern.
- **Auditability:** every bill and flag traceable to source readings.
- **Cost:** stay within free tier or a small budget for the prototype.

## 8. Data Strategy

| Layer | Source | Notes |
|---|---|---|
| Feeder supply hours | DisCo websites publish rolling 7-day averages for Band A feeders daily. NERC also publishes approved Band A feeder lists per DisCo. | Real data. Check each site's terms before scraping. |
| System context | NERC quarterly reports (free PDFs): offtake, voltage, complaints | Use to make simulator distributions realistic |
| Meter-level readings | **Simulator** built from real feeder patterns | Clearly labeled as simulated in the demo and pitch |
| Optional real data | Contacts via TEC/UNILORIN, mentors, NESI Week | Ask for a sample feeder dataset |
| Optional hardware | ESP32 mains-presence logger on a real feeder | Bonus only, skip if time is short |

## 9. Proposed Architecture **[Assumption]**

- **Ingestion:** device/simulator → API or IoT endpoint → queue/stream.
- **Processing:** serverless functions for validation, billing, and accountability calculations.
- **Storage:** time-series/readings store, relational store for customers, tariffs, and bills, object storage for reports.
- **Detection:** scheduled jobs applying rules and anomaly logic, adapted from CS-01.
- **Serving:** API layer plus a web dashboard with role-based auth.
- **Ops:** infrastructure as code, logging, and monitoring from day one.

## 10. Success Metrics

- End-to-end demo: simulated readings → bill → feeder compliance result → theft flag, working live.
- Accountability engine correctly classifies feeders against Band thresholds on test data (target: 100% on defined scenarios).
- Theft detection catches injected anomalies in the simulator with an acceptable false-positive rate (set the target once baseline data exists).
- Clear, one-page evidence report a regulator could act on.

## 11. Risks and Honest Flags

| Risk | Impact | Mitigation |
|---|---|---|
| **No real meter-level data** | High: judges may question realism | Hybrid plan: real published feeder data plus a labeled simulator (Section 8). State the limitation openly. |
| Scope too broad | High: nothing finished well | **P0 locked:** ingestion, billing, accountability engine. Theft detection is a stretch goal with simple rules. Customer dispute flow is cut from the build and kept as a pitch slide. |
| Band rules change or are misread | Medium | Rules verified against NERC orders (Section 5.3). Keep thresholds configurable and re-check before the demo. |
| Theft flags create false accusations | Medium | Human-in-the-loop only, with explainable reasons. |
| Time before NESI Week | Medium | Milestone plan below with a demo-ready cut line. |

## 12. Milestones **[Assumption, adjust to your calendar]**

1. **Foundation:** requirements locked, Band thresholds verified, data model, simulator.
2. **Core pipeline:** ingestion, storage, billing engine.
3. **Differentiator:** service accountability engine and compliance report.
4. **Detection:** rules-based theft flags, ported and retargeted from CS-01.
5. **Dashboards and hardening:** role-based views, audit log, security pass.
6. **Demo prep:** scripted demo scenario, pitch narrative, documentation.

## 13. Open Questions

1. Which exact NERC order will be the cited source for Band thresholds and compensation rules?
2. Can any real feeder or meter sample data be obtained through mentors, TEC, or the school?
3. Which cloud services and budget will you commit to for the prototype?
4. Will you add the optional ESP32 logger, or stay fully software-only?
5. How much of the customer dispute flow belongs in the MVP versus the pitch story?
