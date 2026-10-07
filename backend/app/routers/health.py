from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.db import SessionDep

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health() -> dict[str, str]:
    """Liveness: the process is up. Doesn't touch the database."""
    return {"status": "ok"}


@router.get("/db")
async def health_db(session: SessionDep) -> dict[str, str]:
    """Readiness: the database is reachable."""
    try:
        await session.execute(text("SELECT 1"))
    except Exception as exc:  # any failure means "not ready"
        raise HTTPException(status_code=503, detail="database unavailable") from exc
    return {"status": "ok"}
