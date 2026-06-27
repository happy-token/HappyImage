#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit


ROOT_DIR = Path(__file__).resolve().parents[1]
ROOT_ENV_FILE = ROOT_DIR / ".env"
DEV_ENV_FILE = ROOT_DIR / "scripts" / "dev-local.env"
CONFIG_FILE = ROOT_DIR / "api" / "config.json"


DEFAULTS = {
    "HAPPYIMAGE_PUBLIC_APP_URL": "http://localhost:3000",
    "HAPPYIMAGE_API_PUBLIC_URL": "http://localhost:8000",
    "HAPPYIMAGE_OIDC_ALLOWED_EMAIL_DOMAINS": "",
    "HAPPYIMAGE_GATEWAY_PROVISION_URL": "",
    "HAPPYIMAGE_GATEWAY_PROVISION_SECRET": "",
    "HAPPYIMAGE_IMAGE_RETENTION_DAYS": "15",
    "HAPPYIMAGE_IMAGE_POLL_TIMEOUT_SECS": "120",
    "HAPPYIMAGE_IMAGE_CHECK_BEFORE_HIT_ENABLED": "true",
    "HAPPYIMAGE_IMAGE_SETTLE_SECS": "2",
}


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip("'").strip('"')
    return values


def env_bool(value: str, default: bool = False) -> bool:
    if value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on", "开启"}


def env_int(value: str, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def normalize_url(value: str) -> str:
    return str(value or "").strip().rstrip("/")


def rewrite_dsn_for_mode(dsn: str, mode: str) -> str:
    dsn = dsn.strip()
    if not dsn:
        return ""
    parsed = urlsplit(dsn)
    host = parsed.hostname or ""
    if mode == "local" and host == "host.docker.internal":
        next_host = "127.0.0.1"
    elif mode == "container" and host in {"127.0.0.1", "localhost"}:
        next_host = "host.docker.internal"
    else:
        return dsn
    netloc = next_host
    if parsed.username:
        userinfo = parsed.username
        if parsed.password is not None:
            userinfo = f"{userinfo}:{parsed.password}"
        netloc = f"{userinfo}@{netloc}"
    if parsed.port:
        netloc = f"{netloc}:{parsed.port}"
    return urlunsplit((parsed.scheme, netloc, parsed.path, parsed.query, parsed.fragment))


def build_config(values: dict[str, str], mode: str) -> dict[str, object]:
    gateway_api = normalize_url(values.get("HAPPYIMAGE_GATEWAY_API_BASE_URL", ""))
    if gateway_api and not gateway_api.endswith("/v1"):
        gateway_api = f"{gateway_api}/v1"
    public_app_url = normalize_url(values.get("HAPPYIMAGE_PUBLIC_APP_URL", ""))
    api_public_url = normalize_url(values.get("HAPPYIMAGE_API_PUBLIC_URL", ""))
    if mode == "local" and public_app_url.startswith("http://localhost:"):
        # The local Web server proxies /api/* to the API. Use the browser-visible
        # origin for OIDC callbacks so it matches the Casdoor local redirect URI.
        api_public_url = public_app_url
    return {
        "registration_enabled": False,
        "image_retention_days": env_int(values.get("HAPPYIMAGE_IMAGE_RETENTION_DAYS", ""), 15),
        "image_access_token_ttl_seconds": 86400,
        "image_poll_timeout_secs": env_int(values.get("HAPPYIMAGE_IMAGE_POLL_TIMEOUT_SECS", ""), 120),
        "log_levels": ["debug", "error", "info", "warning"],
        "public_app_url": public_app_url,
        "api_public_url": api_public_url,
        "cors_origins": [],
        "session_secret": values.get("HAPPYIMAGE_SESSION_SECRET", ""),
        "session_cookie_name": "happytoken_session",
        "session_cookie_domain": "",
        "session_max_age_seconds": 86400,
        "sensitive_words": [],
        "global_system_prompt": "",
        "ai_review": {
            "enabled": False,
            "base_url": "",
            "api_key": "",
            "model": "",
            "prompt": "",
        },
        "oidc": {
            "enabled": env_bool(values.get("HAPPYIMAGE_OIDC_ENABLED", ""), False),
            "issuer": normalize_url(values.get("HAPPYIMAGE_OIDC_ISSUER", "")),
            "client_id": values.get("HAPPYIMAGE_OIDC_CLIENT_ID", ""),
            "client_secret": values.get("HAPPYIMAGE_OIDC_CLIENT_SECRET", ""),
            "scopes": values.get("HAPPYIMAGE_OIDC_SCOPES", "openid profile email"),
            "allowed_email_domains": values.get("HAPPYIMAGE_OIDC_ALLOWED_EMAIL_DOMAINS", ""),
        },
        "model_gateway": {
            "gateway_api_base_url": gateway_api or "https://gateway.happy-token.cn/v1",
            "gateway_management_url": normalize_url(
                values.get("HAPPYIMAGE_GATEWAY_MANAGEMENT_URL", "")
            )
            or "https://gateway.happy-token.cn",
            "provision_url": normalize_url(values.get("HAPPYIMAGE_GATEWAY_PROVISION_URL", "")),
            "provision_secret": values.get("HAPPYIMAGE_GATEWAY_PROVISION_SECRET", ""),
            "sql_dsn": rewrite_dsn_for_mode(values.get("HAPPYIMAGE_NEWAPI_SQL_DSN", ""), mode),
            "token_name": values.get("HAPPYIMAGE_NEWAPI_TOKEN_NAME", "HappyImage Default"),
        },
        "image_parallel_generation": True,
        "image_poll_interval_secs": 10,
        "image_poll_initial_wait_secs": 10,
        "image_storage": {
            "enabled": False,
            "mode": "local",
            "webdav_url": "",
            "webdav_username": "",
            "webdav_password": "",
            "webdav_root_path": "happytoken/images",
            "public_base_url": "",
        },
        "image_min_free_mb": 500,
        "image_settle_enabled": env_bool(values.get("HAPPYIMAGE_IMAGE_CHECK_BEFORE_HIT_ENABLED", ""), True),
        "image_check_before_hit_enabled": env_bool(
            values.get("HAPPYIMAGE_IMAGE_CHECK_BEFORE_HIT_ENABLED", ""), True
        ),
        "image_settle_secs": env_int(values.get("HAPPYIMAGE_IMAGE_SETTLE_SECS", ""), 2),
    }


def sync_runtime_config(config: dict[str, object], database_url: str) -> None:
    from sqlalchemy import create_engine, text

    engine = create_engine(database_url, pool_pre_ping=True)
    payload = json.dumps(config, ensure_ascii=False)
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                insert into runtime_config (key, data)
                values (:key, :data)
                on conflict (key) do update set data = excluded.data
                """
            ),
            {"key": "default", "data": payload},
        )


def redacted_summary(config: dict[str, object]) -> dict[str, object]:
    summary = json.loads(json.dumps(config, ensure_ascii=False))
    summary["session_secret"] = "<configured>" if summary.get("session_secret") else ""
    oidc = summary.get("oidc", {})
    if isinstance(oidc, dict):
        oidc["client_secret"] = "<configured>" if oidc.get("client_secret") else ""
    gateway = summary.get("model_gateway", {})
    if isinstance(gateway, dict):
        gateway["provision_secret"] = "<configured>" if gateway.get("provision_secret") else ""
        dsn = str(gateway.get("sql_dsn") or "")
        gateway["sql_dsn"] = dsn.split("@")[-1] if "@" in dsn else ("<configured>" if dsn else "")
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate HappyImage config.json from .env.")
    parser.add_argument("--mode", choices=["local", "container"], default="local")
    parser.add_argument("--env-file", type=Path, default=ROOT_ENV_FILE)
    parser.add_argument("--output", type=Path, default=CONFIG_FILE)
    parser.add_argument("--no-sync-runtime", action="store_true", help="Do not sync postgres runtime_config.")
    args = parser.parse_args()

    values = dict(DEFAULTS)
    existing_root_env = load_env_file(args.env_file)
    dev_env = load_env_file(DEV_ENV_FILE)
    values.update(
        {key: value for key, value in existing_root_env.items() if key.startswith("HAPPYIMAGE_")}
    )

    config = build_config(values, args.mode)
    args.output.write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    database_url = os.environ.get("DATABASE_URL") or dev_env.get("DATABASE_URL", "")
    storage_backend = (os.environ.get("STORAGE_BACKEND") or dev_env.get("STORAGE_BACKEND", "")).lower()
    synced = False
    if not args.no_sync_runtime and database_url and storage_backend in {"postgres", "postgresql", "database"}:
        sync_runtime_config(config, database_url)
        synced = True

    print("Read env:", args.env_file)
    print("Generated:", args.output)
    print("Synced runtime_config:", "yes" if synced else "no")
    print(json.dumps(redacted_summary(config), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
