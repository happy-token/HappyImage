from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url


def create_database_engine(database_url: str, **kwargs):
    connect_args = dict(kwargs.pop("connect_args", {}) or {})
    try:
        drivername = make_url(database_url).drivername
    except Exception:
        drivername = ""

    if drivername.startswith(("postgresql", "postgres")):
        timeout = os.getenv("DATABASE_CONNECT_TIMEOUT", "5").strip()
        if timeout:
            connect_args.setdefault("connect_timeout", int(timeout))

    return create_engine(database_url, connect_args=connect_args, **kwargs)
