from __future__ import annotations

from unittest.mock import patch

from services.database_engine import create_database_engine


def test_postgres_engine_uses_default_connect_timeout(monkeypatch):
    monkeypatch.delenv("DATABASE_CONNECT_TIMEOUT", raising=False)

    with patch("services.database_engine.create_engine") as create_engine:
        create_database_engine("postgresql://user:pass@example.test/db", pool_pre_ping=True)

    create_engine.assert_called_once_with(
        "postgresql://user:pass@example.test/db",
        connect_args={"connect_timeout": 5},
        pool_pre_ping=True,
    )


def test_postgres_engine_allows_connect_timeout_override(monkeypatch):
    monkeypatch.setenv("DATABASE_CONNECT_TIMEOUT", "2")

    with patch("services.database_engine.create_engine") as create_engine:
        create_database_engine("postgresql://user:pass@example.test/db")

    create_engine.assert_called_once_with(
        "postgresql://user:pass@example.test/db",
        connect_args={"connect_timeout": 2},
    )


def test_sqlite_engine_does_not_receive_postgres_connect_timeout(monkeypatch):
    monkeypatch.setenv("DATABASE_CONNECT_TIMEOUT", "2")

    with patch("services.database_engine.create_engine") as create_engine:
        create_database_engine("sqlite:////tmp/happyimage-test.db")

    create_engine.assert_called_once_with(
        "sqlite:////tmp/happyimage-test.db",
        connect_args={},
    )
