"""HTTP API for the dashboards and meter ingestion. Entry point: src/api/main.py."""
from __future__ import annotations

import asyncio
import csv
import hmac
import io
from datetime import date, timedelta
from typing import Literal, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from src.detection.run import default_period, run_detection
from src.ingest.handler import MAX_BATCH, ingest
from src.store import SQLiteStore

from . import auth, services

MAX_PERIOD_DAYS = 92


class LoginBody(BaseModel):
    username: str = Field(max_length=64)
    password: str = Field(max_length=256)


class DecisionBody(BaseModel):
    status: Literal["investigating", "confirmed", "dismissed"]
    note: str = Field(default="", max_length=1000)


class DetectionBody(BaseModel):
    start: Optional[date] = None
    end: Optional[date] = None


class IngestBody(BaseModel):
    kind: Literal["meter", "feeder"]
    readings: list[dict] = Field(min_length=1, max_length=MAX_BATCH)


def create_app(store: SQLiteStore, ingest_api_key: Optional[str] = None) -> FastAPI:
    app = FastAPI(title="NESI PowerTech API", version="0.1.0")
    db_lock = asyncio.Lock()

    @app.middleware("http")
    async def one_request_at_a_time(request: Request, call_next):
        # Handlers run in worker threads but share one SQLite connection. Serialising is
        # fine for a local demo; the DynamoDB store will not need it.
        async with db_lock:
            return await call_next(request)

    def current_user(authorization: str = Header(default="")) -> dict:
        scheme, _, token = authorization.partition(" ")
        user = auth.user_for_token(store, token) if scheme.lower() == "bearer" and token else None
        if user is None:
            raise HTTPException(401, "Not signed in")
        return user

    def require(*roles: str):
        def check(user: dict = Depends(current_user)) -> dict:
            if user["role"] not in roles:
                raise HTTPException(403, "Not allowed for this role")
            return user

        return check

    def period(start: Optional[date] = Query(None, alias="from"), end: Optional[date] = Query(None, alias="to")) -> tuple[date, date]:
        if start is None or end is None:
            default = default_period(store)
            if default is None:
                raise HTTPException(404, "No readings yet")
            start, end = start or default[0], end or default[1]
        if end <= start:
            raise HTTPException(422, "'to' must be after 'from'")
        if end - start > timedelta(days=MAX_PERIOD_DAYS):
            raise HTTPException(422, f"Period is limited to {MAX_PERIOD_DAYS} days")
        return start, end

    @app.get("/health")
    def health():
        return {"ok": True}

    # Auth

    @app.post("/auth/login")
    def login(body: LoginBody, request: Request):
        result = auth.login(store, body.username, body.password)
        client = request.client.host if request.client else "unknown"
        if result is None:
            store.audit(body.username[:64], "auth.login_failed", "session", {"ip": client})
            raise HTTPException(401, "Wrong username or password")
        token, user = result
        store.audit(user["username"], "auth.login", "session", {"ip": client})
        return {"token": token, "user": auth.public_user(user)}

    @app.post("/auth/logout")
    def logout(authorization: str = Header(default=""), user: dict = Depends(current_user)):
        auth.logout(store, authorization.partition(" ")[2])
        store.audit(user["username"], "auth.logout", "session")
        return {"ok": True}

    @app.get("/me")
    def me(user: dict = Depends(current_user)):
        return auth.public_user(user)

    @app.get("/period")
    def data_period(user: dict = Depends(current_user)):
        p = default_period(store)
        return {"start": p[0].isoformat(), "end": p[1].isoformat()} if p else None

    # Customer: only ever their own meter, taken from the account, never from the request.

    @app.get("/customer/summary")
    def customer_summary(user: dict = Depends(require("customer")), p: tuple = Depends(period)):
        if not user["meter_id"]:
            raise HTTPException(404, "No meter linked to this account")
        return services.customer_summary(store, user["meter_id"], *p)

    # DisCo operations

    @app.get("/ops/feeders")
    def ops_feeders(user: dict = Depends(require("operations")), p: tuple = Depends(period)):
        return services.feeders_overview(store, *p)

    @app.get("/ops/cases")
    def ops_cases(
        status: Optional[str] = None,
        feeder: Optional[str] = None,
        user: dict = Depends(require("operations")),
    ):
        return services.cases(store, status=status, feeder_id=feeder)

    @app.get("/ops/cases/{subject_type}/{subject_id}")
    def ops_case(subject_type: Literal["meter", "feeder"], subject_id: str, user: dict = Depends(require("operations"))):
        found = services.case(store, subject_type, subject_id)
        if found is None:
            raise HTTPException(404, "No flags for this meter or feeder")
        if subject_type == "meter":
            store.audit(user["username"], "meter.view", f"meter:{subject_id}", {"from": found["period_start"], "to": found["period_end"]})
        return found

    @app.post("/ops/cases/{subject_type}/{subject_id}/decision")
    def ops_decide(
        subject_type: Literal["meter", "feeder"], subject_id: str, body: DecisionBody, user: dict = Depends(require("operations"))
    ):
        found = services.case(store, subject_type, subject_id)
        if found is None:
            raise HTTPException(404, "No flags for this meter or feeder")
        note = body.note.strip()
        if body.status in ("confirmed", "dismissed") and len(note) < 3:
            raise HTTPException(422, "Add a note saying what you found before confirming or dismissing")
        flag_ids = [f["flag_id"] for f in found["flags"]]
        store.decide_flags(flag_ids, body.status, user["username"], note)
        store.audit(
            user["username"], "case.decide", f"{subject_type}:{subject_id}",
            {"from": found["status"], "to": body.status, "note": note, "flag_ids": flag_ids},
        )
        return services.case(store, subject_type, subject_id)

    @app.get("/ops/meters/{meter_id}")
    def ops_meter(meter_id: str, user: dict = Depends(require("operations")), p: tuple = Depends(period)):
        if store.meter_feeder(meter_id) is None:
            raise HTTPException(404, "Meter not found")
        store.audit(user["username"], "meter.view", f"meter:{meter_id}", {"from": p[0].isoformat(), "to": p[1].isoformat()})
        return services.meter_detail(store, meter_id, *p)

    @app.post("/ops/detection/run")
    def ops_run_detection(body: DetectionBody, user: dict = Depends(require("operations"))):
        start, end = period(body.start, body.end)
        found = run_detection(store, start, end, actor=user["username"])
        return {"flags_found": len(found)}

    # Regulator

    @app.get("/regulator/compliance")
    def compliance(user: dict = Depends(require("regulator")), p: tuple = Depends(period)):
        return services.all_compliance(store, *p)

    @app.get("/regulator/compliance.csv")
    def compliance_csv(user: dict = Depends(require("regulator")), p: tuple = Depends(period)):
        rows = services.all_compliance(store, *p)
        buf = io.StringIO()
        cols = [
            "feeder_id", "band", "committed_hours", "average_hours", "days_met", "days_failed",
            "days_insufficient_data", "compliance_rate", "status", "downgrade_date", "recommended_band",
            "compensation_flag", "special_compensation_days",
        ]
        w = csv.writer(buf)
        w.writerow(["# SIMULATED DATA", f"period {p[0]} to {p[1]} (end exclusive)"])
        w.writerow(cols + ["explanation_dates"])
        for r in rows:
            w.writerow([r[c] for c in cols] + [" ".join(r["explanation_dates"])])
        store.audit(user["username"], "report.export", "compliance.csv", {"from": p[0].isoformat(), "to": p[1].isoformat()})
        filename = f"feeder-compliance-{p[0]}-{p[1]}.csv"
        return Response(buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"'})

    # Audit trail: operations and regulator can read it, nobody can change it.

    @app.get("/audit")
    def audit(limit: int = Query(200, ge=1, le=1000), user: dict = Depends(require("operations", "regulator"))):
        broken = store.verify_audit_chain()
        return {"chain_intact": broken is None, "first_broken_seq": broken, "entries": store.audit_entries(limit)}

    # Device ingestion, authenticated by API key rather than user session.

    @app.post("/ingest")
    def ingest_readings(body: IngestBody, x_api_key: str = Header(default="")):
        if not ingest_api_key:
            raise HTTPException(503, "Ingestion is disabled: set INGEST_API_KEY")
        if not hmac.compare_digest(x_api_key, ingest_api_key):
            raise HTTPException(401, "Invalid API key")
        result = ingest(body.kind, body.readings, store)
        return result.as_dict()

    return app

