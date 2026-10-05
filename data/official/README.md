# Official NERC data

This directory contains source-attributed public NERC datasets used by Lume.

## Starter dataset

`nerc/ibedc_2026-09_kwara_challenge_feeders.csv` is a manually transcribed starter slice from NERC's **Ibadan Electricity Distribution Plc - Monthly Energy Cap (September 2026)** publication, covering the 21 feeder records under **KWARA / CHALLENGE** on PDF page 2.

The source publication is dated September 1, 2026 and states **Energy Consumed in August 2026**. Its columns are State, Business Unit, Feeder Name, Non-MD Service Band, and Cap (kWh).

### Important data semantics

`service_band` is feeder/service-band metadata from the NERC publication.

`monthly_energy_cap_kwh` is the NERC monthly energy cap associated with the non-MD service-band record. **It is not feeder-delivered energy and must not be fed into Lume's supply-hours/voltage telemetry engine.**

`energy_reference_month` records the source document's "Energy Consumed in ..." month; it is metadata, not a measured value in this CSV.

`data_type=official` means the row was transcribed from a public NERC publication. It does not mean Lume collected live telemetry from the feeder.

## Next datasets

1. Expand from this 21-feeder Kwara/Challenge slice to the remaining IBEDC feeder rows in the September 2026 publication.
2. Add 2026 NERC feeder-performance outcomes from MYTO/supplementary orders, especially appendices that list Band A feeders and their compliance action.
3. Add real DisCo telemetry only after obtaining a permitted anonymized sample.

## Source

NERC, *Ibadan Electricity Distribution Plc - Monthly Energy Cap (September 2026); Energy Consumed in August 2026*.

https://nerc.gov.ng/wp-content/uploads/2026/09/IBEDC-Monthly-Energy-Cap-September-2026.pdf
