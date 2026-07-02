from __future__ import annotations

from collections.abc import Callable
import json
from pathlib import Path
import secrets
import time
from typing import Any
from urllib import request as urllib_request
from urllib.parse import urlsplit, urlunsplit

from utils.log import logger

DEFAULT_NEWAPI_URL = "https://gateway.happy-token.cn"
DEFAULT_IMAGE_GROUP = "image"
DEFAULT_IMAGE_MODELS = ["gpt-image-2", "codex-gpt-image-2"]
DEFAULT_IMAGE_MODEL_PRICES = {
    "gpt-image-2": 0.007,
    "codex-gpt-image-2": 0.0139,
}
DEFAULT_IMAGE_MODEL_BILLING_TYPES = {
    "gpt-image-2": "per_request",
    "codex-gpt-image-2": "per_request",
}


def _clean(value: object) -> str:
    return str(value or "").strip()


def _normalize_url(value: object, *, default: str = "") -> str:
    return (_clean(value) or default).rstrip("/")


def _normalize_management_url(value: object) -> str:
    return _normalize_url(value).removesuffix("/v1")


def _configured_image_group(settings: dict[str, object]) -> str:
    return _clean(settings.get("image_group")) or DEFAULT_IMAGE_GROUP


def _configured_image_models(settings: dict[str, object]) -> list[str]:
    raw_models = settings.get("image_models")
    source = raw_models if isinstance(raw_models, list) else DEFAULT_IMAGE_MODELS
    models: list[str] = []
    seen: set[str] = set()
    for raw_model in source:
        model = _clean(raw_model)
        if model and model not in seen:
            models.append(model)
            seen.add(model)
    return models or list(DEFAULT_IMAGE_MODELS)


def _configured_price_map(
    settings: dict[str, object], models: list[str]
) -> dict[str, float]:
    raw_prices = settings.get("image_model_prices")
    source = raw_prices if isinstance(raw_prices, dict) else {}
    prices: dict[str, float] = {}
    for model in models:
        try:
            price = float(source.get(model, DEFAULT_IMAGE_MODEL_PRICES.get(model, 0)))
        except (TypeError, ValueError):
            price = float(DEFAULT_IMAGE_MODEL_PRICES.get(model, 0))
        prices[model] = max(0.0, price)
    return prices


def _configured_billing_type_map(
    settings: dict[str, object], models: list[str]
) -> dict[str, str]:
    raw_types = settings.get("image_model_billing_types")
    source = raw_types if isinstance(raw_types, dict) else {}
    billing_types: dict[str, str] = {}
    for model in models:
        billing_type = _clean(
            source.get(model, DEFAULT_IMAGE_MODEL_BILLING_TYPES.get(model, "usage"))
        )
        billing_types[model] = (
            billing_type if billing_type in {"usage", "per_request"} else "usage"
        )
    return billing_types


def _model_settings(settings: dict[str, object]) -> tuple[str, list[str], dict[str, float], dict[str, str]]:
    models = _configured_image_models(settings)
    return (
        _configured_image_group(settings),
        models,
        _configured_price_map(settings, models),
        _configured_billing_type_map(settings, models),
    )


class NewAPIBindingService:
    def __init__(
        self,
        *,
        settings: dict[str, object] | None = None,
        session_factory: Callable[[], Any] | None = None,
        sql_connect_factory: Callable[[str], Any] | None = None,
    ) -> None:
        self._settings = settings
        self._session_factory = session_factory
        self._sql_connect_factory = sql_connect_factory

    def ensure_default_token(
        self,
        provider: str,
        subject: str,
        email: str,
        name: str,
    ) -> dict[str, object]:
        settings = self._settings or self._load_settings()
        provision_url = _clean(settings.get("provision_url"))
        provision_secret = _clean(settings.get("provision_secret"))
        base_url = _normalize_url(
            settings.get("gateway_api_base_url") or settings.get("base_url"),
            default=DEFAULT_NEWAPI_URL,
        )
        model_base_url = self._normalize_model_base_url(base_url)
        management_url = _normalize_management_url(
            settings.get("gateway_management_url") or settings.get("management_url")
        )
        if not management_url:
            management_url = _normalize_management_url(base_url)
        image_group, image_models, image_prices, image_billing_types = _model_settings(settings)
        if (
            not bool(settings.get("enabled"))
            or (not provision_url and not _clean(settings.get("sql_dsn")))
        ):
            return {
                "ok": False,
                "status": "pending",
                "message": "NewAPI provisioning endpoint is not configured",
                "base_url": model_base_url,
                "management_url": management_url,
                "group": image_group,
                "models": image_models,
                "model_prices": image_prices,
                "model_billing_types": image_billing_types,
            }
        if not provision_url:
            return self._ensure_default_token_via_sql(
                settings=settings,
                provider=provider,
                subject=subject,
                email=email,
                name=name,
                base_url=model_base_url,
                management_url=management_url,
                image_group=image_group,
                image_models=image_models,
                image_prices=image_prices,
                image_billing_types=image_billing_types,
            )
        if not provision_secret:
            return {
                "ok": False,
                "status": "pending",
                "message": "NewAPI provisioning endpoint is not configured",
                "base_url": model_base_url,
                "management_url": management_url,
                "group": image_group,
                "models": image_models,
                "model_prices": image_prices,
                "model_billing_types": image_billing_types,
            }

        session = None
        try:
            session = self._make_session()
            response = session.post(
                provision_url,
                headers={
                    "Authorization": f"Bearer {provision_secret}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json={
                    "provider": _clean(provider),
                    "subject": _clean(subject),
                    "email": _clean(email),
                    "name": _clean(name),
                    "token_name": _clean(settings.get("token_name"))
                    or "HappyImage Default",
                    "group": image_group,
                    "models": image_models,
                    "model_prices": image_prices,
                    "model_billing_types": image_billing_types,
                },
                timeout=20,
            )
            status_code = int(getattr(response, "status_code", 0) or 0)
            if status_code != 200:
                return self._failed(status_code)
            data = self._response_json(response)
            if (
                not isinstance(data, dict)
                or data.get("ok") is not True
                or not _clean(data.get("token"))
            ):
                return self._failed(
                    message="NewAPI provisioning returned an invalid response"
                )
            return {
                "ok": True,
                "status": "configured",
                "user_id": _clean(data.get("user_id")),
                "token_id": _clean(data.get("token_id")),
                "token": _clean(data.get("token")),
                "group": _clean(data.get("group")) or image_group,
                "models": image_models,
                "model_prices": image_prices,
                "model_billing_types": image_billing_types,
                "base_url": _normalize_url(
                    self._normalize_model_base_url(data.get("base_url") or model_base_url),
                    default=self._normalize_model_base_url(DEFAULT_NEWAPI_URL),
                ),
                "management_url": _normalize_management_url(
                    data.get("management_url")
                    or management_url
                    or data.get("base_url")
                    or base_url,
                )
                or DEFAULT_NEWAPI_URL,
            }
        except Exception:
            return self._failed(message="NewAPI provisioning request failed")
        finally:
            if session is not None:
                try:
                    session.close()
                except Exception:
                    pass

    def get_image_model_details(
        self, settings: dict[str, object] | None = None
    ) -> list[dict[str, object]]:
        settings = settings or self._settings or self._load_settings()
        image_group, image_models, image_prices, image_billing_types = _model_settings(settings)
        details_by_model = {
            model: {
                "model": model,
                "group": image_group,
                "billing_type": image_billing_types.get(model, "usage"),
                "quota_type": 1
                if image_billing_types.get(model) == "per_request"
                else 0,
                "price": image_prices.get(model, 0.0),
                "source": "settings",
            }
            for model in image_models
        }
        pricing_items = self._fetch_newapi_pricing(settings)
        for item in pricing_items:
            model = _clean(item.get("model_name") or item.get("model"))
            if model not in details_by_model:
                continue
            enabled_groups = item.get("enable_group")
            if (
                image_group
                and isinstance(enabled_groups, list)
                and image_group not in [_clean(group) for group in enabled_groups]
            ):
                continue
            quota_type = item.get("quota_type")
            try:
                normalized_quota_type = int(quota_type)
            except (TypeError, ValueError):
                normalized_quota_type = int(details_by_model[model]["quota_type"])
            try:
                price = float(item.get("model_price"))
            except (TypeError, ValueError):
                price = float(details_by_model[model]["price"])
            details_by_model[model] = {
                **details_by_model[model],
                "billing_type": "per_request"
                if normalized_quota_type == 1
                else "usage",
                "quota_type": normalized_quota_type,
                "price": max(0.0, price),
                "source": "newapi",
            }
        return [details_by_model[model] for model in image_models]

    def _fetch_newapi_pricing(
        self, settings: dict[str, object]
    ) -> list[dict[str, object]]:
        management_url = _normalize_management_url(
            settings.get("gateway_management_url")
            or settings.get("management_url")
            or settings.get("gateway_api_base_url")
            or settings.get("base_url")
        )
        if not management_url:
            return []
        try:
            req = urllib_request.Request(
                f"{management_url}/api/pricing",
                headers={"Accept": "application/json"},
                method="GET",
            )
            with urllib_request.urlopen(req, timeout=10) as response:
                raw_body = response.read(1024 * 1024)
            payload = json.loads(raw_body.decode("utf-8", "ignore"))
        except Exception:
            return []
        if not isinstance(payload, dict) or payload.get("success") is False:
            return []
        data = payload.get("data")
        return [item for item in data if isinstance(item, dict)] if isinstance(data, list) else []

    def _make_session(self) -> Any:
        if self._session_factory is not None:
            return self._session_factory()

        from curl_cffi import requests
        from services.proxy_service import proxy_settings

        kwargs = proxy_settings.build_session_kwargs(impersonate="chrome", verify=True)
        return requests.Session(**kwargs)

    def _make_sql_connection(self, dsn: str) -> Any:
        if self._sql_connect_factory is not None:
            return self._sql_connect_factory(dsn)

        import psycopg2

        return psycopg2.connect(dsn)

    def _ensure_default_token_via_sql(
        self,
        *,
        settings: dict[str, object],
        provider: str,
        subject: str,
        email: str,
        name: str,
        base_url: str,
        management_url: str,
        image_group: str,
        image_models: list[str],
        image_prices: dict[str, float],
        image_billing_types: dict[str, str],
    ) -> dict[str, object]:
        dsn = _clean(settings.get("sql_dsn"))
        if not dsn:
            return self._failed(message="NewAPI SQL DSN is not configured")

        connection = None
        try:
            connection = self._make_sql_connection(dsn)
            with connection:
                with connection.cursor() as cursor:
                    user_id = self._find_or_create_newapi_user(
                        cursor,
                        provider=provider,
                        subject=subject,
                        email=email,
                        name=name,
                        user_group=image_group,
                    )
                    token_id, token = self._find_or_create_newapi_token(
                        cursor,
                        user_id=user_id,
                        token_name=_clean(settings.get("token_name"))
                        or "HappyImage Default",
                        token_group=image_group,
                    )
                    access_token = self._ensure_newapi_access_token(cursor, user_id)
                    tokens = self._list_newapi_tokens(cursor, user_id)
                    user_quota = self._get_newapi_user_quota(cursor, user_id)
                    usage_by_model = self._list_newapi_model_usage(
                        cursor,
                        user_id=user_id,
                        models=image_models,
                        group=image_group,
                    )
            return {
                "ok": True,
                "status": "configured",
                "user_id": str(user_id),
                "token_id": str(token_id),
                "token": f"sk-{token}",
                "access_token": access_token,
                "tokens": tokens,
                "quota": user_quota,
                "usage_by_model": usage_by_model,
                "group": image_group,
                "models": image_models,
                "model_prices": image_prices,
                "model_billing_types": image_billing_types,
                "base_url": base_url,
                "management_url": management_url,
            }
        except Exception as exc:
            message = self._sql_failure_message(dsn, exc)
            logger.warning(
                {
                    "event": "newapi_sql_provisioning_failed",
                    "error_type": type(exc).__name__,
                    "error": str(exc),
                    "dsn": self._redact_dsn(dsn),
                }
            )
            return self._failed(message=message)
        finally:
            if connection is not None:
                try:
                    connection.close()
                except Exception:
                    pass

    @staticmethod
    def _find_or_create_newapi_user(
        cursor: Any,
        *,
        provider: str,
        subject: str,
        email: str,
        name: str,
        user_group: str,
    ) -> int:
        provider_column = NewAPIBindingService._provider_column(provider)
        cleaned_subject = _clean(subject)
        cleaned_email = _clean(email)
        cleaned_name = _clean(name)
        if provider_column and cleaned_subject:
            cursor.execute(
                f"SELECT id FROM users WHERE {provider_column} = %s AND deleted_at IS NULL ORDER BY id LIMIT 1",
                (cleaned_subject,),
            )
            row = cursor.fetchone()
            if row:
                user_id = int(row[0])
                NewAPIBindingService._set_newapi_user_group(cursor, user_id, user_group)
                return user_id
        if cleaned_email:
            cursor.execute(
                "SELECT id FROM users WHERE email = %s AND deleted_at IS NULL ORDER BY id LIMIT 1",
                (cleaned_email,),
            )
            row = cursor.fetchone()
            if row:
                user_id = int(row[0])
                if provider_column and cleaned_subject:
                    cursor.execute(
                        f"UPDATE users SET {provider_column} = COALESCE(NULLIF({provider_column}, ''), %s) WHERE id = %s",
                        (cleaned_subject, user_id),
                    )
                NewAPIBindingService._set_newapi_user_group(cursor, user_id, user_group)
                return user_id

        username = NewAPIBindingService._newapi_username(cleaned_email, cleaned_subject)
        display_name = cleaned_name or username
        now = int(time.time())
        password = secrets.token_urlsafe(32)
        access_token = secrets.token_hex(16)
        columns = [
            "username",
            "password",
            "display_name",
            "role",
            "status",
            "email",
            "access_token",
            "quota",
            "used_quota",
            "request_count",
            '"group"',
            "created_at",
            "last_login_at",
        ]
        values: list[object] = [
            username,
            password,
            display_name,
            1,
            1,
            cleaned_email,
            access_token,
            0,
            0,
            0,
            _clean(user_group) or "default",
            now,
            now,
        ]
        if provider_column and cleaned_subject:
            columns.append(provider_column)
            values.append(cleaned_subject)
        placeholders = ", ".join(["%s"] * len(values))
        cursor.execute(
            f"INSERT INTO users ({', '.join(columns)}) VALUES ({placeholders}) RETURNING id",
            values,
        )
        row = cursor.fetchone()
        return int(row[0])

    @staticmethod
    def _set_newapi_user_group(cursor: Any, user_id: int, user_group: str) -> None:
        cleaned_group = _clean(user_group)
        if not cleaned_group:
            return
        cursor.execute(
            'UPDATE users SET "group" = %s WHERE id = %s',
            (cleaned_group, user_id),
        )

    @staticmethod
    def _find_or_create_newapi_token(
        cursor: Any,
        *,
        user_id: int,
        token_name: str,
        token_group: str,
    ) -> tuple[int, str]:
        cursor.execute(
            """
            SELECT id, key FROM tokens
            WHERE user_id = %s AND name = %s AND status = 1 AND deleted_at IS NULL
            ORDER BY id
            LIMIT 1
            """,
            (user_id, token_name),
        )
        row = cursor.fetchone()
        if row:
            token_id = int(row[0])
            if token_group:
                cursor.execute(
                    'UPDATE tokens SET "group" = %s WHERE id = %s',
                    (token_group, token_id),
                )
            return token_id, _clean(row[1])

        now = int(time.time())
        token = secrets.token_urlsafe(36)
        cursor.execute(
            """
            INSERT INTO tokens (
                user_id, key, status, name, created_time, accessed_time,
                expired_time, remain_quota, unlimited_quota,
                model_limits_enabled, model_limits, allow_ips, used_quota,
                "group", cross_group_retry
            )
            VALUES (%s, %s, 1, %s, %s, %s, -1, 0, true, false, '', '', 0, %s, false)
            RETURNING id
            """,
            (user_id, token, token_name, now, now, token_group),
        )
        row = cursor.fetchone()
        return int(row[0]), token

    @staticmethod
    def _ensure_newapi_access_token(cursor: Any, user_id: int) -> str:
        cursor.execute("SELECT access_token FROM users WHERE id = %s", (user_id,))
        row = cursor.fetchone()
        access_token = _clean(row[0] if row else "")
        if access_token:
            return access_token
        access_token = secrets.token_hex(16)
        cursor.execute(
            "UPDATE users SET access_token = %s WHERE id = %s",
            (access_token, user_id),
        )
        return access_token

    @staticmethod
    def _list_newapi_tokens(cursor: Any, user_id: int) -> list[dict[str, object]]:
        cursor.execute(
            """
            SELECT id, key, status, name, created_time, accessed_time,
                   expired_time, remain_quota, unlimited_quota, used_quota,
                   "group"
            FROM tokens
            WHERE user_id = %s AND deleted_at IS NULL
            ORDER BY id
            """,
            (user_id,),
        )
        tokens = []
        for row in cursor.fetchall():
            key = _clean(row[1])
            tokens.append(
                {
                    "id": int(row[0]),
                    "key": f"sk-{key}" if key and not key.startswith("sk-") else key,
                    "status": int(row[2] or 0),
                    "name": _clean(row[3]),
                    "created_time": int(row[4] or 0),
                    "accessed_time": int(row[5] or 0),
                    "expired_time": int(row[6] or 0),
                    "remain_quota": int(row[7] or 0),
                    "unlimited_quota": bool(row[8]),
                    "used_quota": int(row[9] or 0),
                    "group": _clean(row[10] if len(row) > 10 else ""),
                }
            )
        return tokens

    @staticmethod
    def _get_newapi_user_quota(cursor: Any, user_id: int) -> dict[str, object]:
        try:
            cursor.execute(
                """
                SELECT quota, used_quota, request_count, "group"
                FROM users
                WHERE id = %s
                """,
                (user_id,),
            )
            row = cursor.fetchone()
        except Exception:
            return {}
        if not row:
            return {}
        quota = int(row[0] or 0)
        used_quota = int(row[1] or 0)
        return {
            "quota": quota,
            "used_quota": used_quota,
            "remaining_quota": max(0, quota - used_quota) if quota > 0 else 0,
            "request_count": int(row[2] or 0),
            "group": _clean(row[3] if len(row) > 3 else ""),
        }

    @staticmethod
    def _list_newapi_model_usage(
        cursor: Any,
        *,
        user_id: int,
        models: list[str],
        group: str,
    ) -> list[dict[str, object]]:
        if not models:
            return []
        params: list[object] = [user_id, models]
        group_filter = ""
        if group:
            group_filter = ' AND COALESCE("group", \'\') = %s'
            params.append(group)
        try:
            cursor.execute(
                f"""
                SELECT model_name,
                       COUNT(*) AS request_count,
                       COALESCE(SUM(quota), 0) AS quota,
                       COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
                       COALESCE(SUM(completion_tokens), 0) AS completion_tokens
                FROM logs
                WHERE user_id = %s
                  AND type = 2
                  AND model_name = ANY(%s)
                  {group_filter}
                GROUP BY model_name
                ORDER BY request_count DESC, model_name ASC
                """,
                tuple(params),
            )
            rows = cursor.fetchall()
        except Exception:
            return []
        usage = []
        for row in rows:
            try:
                usage.append(
                    {
                        "model": _clean(row[0]),
                        "requests": int(row[1] or 0),
                        "quota": int(row[2] or 0),
                        "prompt_tokens": int(row[3] or 0),
                        "completion_tokens": int(row[4] or 0),
                    }
                )
            except (IndexError, TypeError, ValueError):
                continue
        return usage

    @staticmethod
    def _provider_column(provider: str) -> str:
        normalized = _clean(provider).lower()
        return {
            "casdoor": "oidc_id",
            "oidc": "oidc_id",
            "github": "github_id",
            "discord": "discord_id",
            "telegram": "telegram_id",
            "wechat": "wechat_id",
            "linuxdo": "linux_do_id",
            "linux_do": "linux_do_id",
        }.get(normalized, "")

    @staticmethod
    def _newapi_username(email: str, subject: str) -> str:
        base = email.split("@", 1)[0] if email else subject
        normalized = "".join(
            char.lower() if char.isalnum() else "-"
            for char in (base or "happyimage-user")
        ).strip("-")
        suffix = secrets.token_hex(4)
        return f"{(normalized or 'happyimage-user')[:40]}-{suffix}"[:64]

    @staticmethod
    def _load_settings() -> dict[str, object]:
        from services.config import config

        return config.get_newapi_binding_settings()

    @staticmethod
    def _normalize_model_base_url(value: object) -> str:
        base_url = _clean(value).rstrip("/")
        if not base_url:
            return ""
        if base_url.endswith("/v1"):
            return base_url
        return f"{base_url}/v1"

    @staticmethod
    def _response_json(response: object) -> object:
        try:
            text = getattr(response, "text", "")
            if text == "":
                return {}
            return response.json()
        except Exception:
            return {}

    @staticmethod
    def _redact_dsn(dsn: str) -> str:
        try:
            parsed = urlsplit(dsn)
            netloc = parsed.hostname or ""
            if parsed.port:
                netloc = f"{netloc}:{parsed.port}"
            if parsed.username:
                netloc = f"{parsed.username}:***@{netloc}"
            return urlunsplit(
                (parsed.scheme, netloc, parsed.path, parsed.query, parsed.fragment)
            )
        except Exception:
            return "<redacted>"

    @staticmethod
    def _sql_failure_message(dsn: str, exc: Exception) -> str:
        text = str(exc).lower()
        host = ""
        port = ""
        try:
            parsed = urlsplit(dsn)
            host = parsed.hostname or ""
            port = str(parsed.port or "")
        except Exception:
            pass
        if host == "host.docker.internal":
            target = f"{host}:{port}" if port else host
            if not NewAPIBindingService._running_in_container():
                return (
                    "NewAPI SQL 连接失败：当前 HappyImage API 看起来是在本地直接运行，"
                    f"但 DSN 指向 {target}。host.docker.internal 主要用于容器访问宿主机；"
                    "本地直连测试请把 DSN 改为 jp-v2 的数据库地址，或改为本机 SSH 隧道地址。"
                )
            return (
                "NewAPI SQL 连接失败：HappyImage API 容器无法连接宿主机 "
                f"{target}。请确认 NewAPI Postgres 已把端口映射到宿主机、"
                "监听 0.0.0.0，并且 DSN 端口是 Postgres 端口。"
            )
        if "connection refused" in text or "server closed the connection" in text:
            return "NewAPI SQL 连接失败，请检查 DSN 主机、端口和 NewAPI Postgres 是否正在运行。"
        return "NewAPI SQL provisioning request failed"

    @staticmethod
    def _running_in_container() -> bool:
        if Path("/.dockerenv").exists():
            return True
        try:
            cgroup = Path("/proc/self/cgroup").read_text(encoding="utf-8")
        except Exception:
            return False
        return any(marker in cgroup for marker in ("docker", "containerd", "kubepods"))

    @staticmethod
    def _failed(
        http_status: int | None = None, *, message: str | None = None
    ) -> dict[str, object]:
        result: dict[str, object] = {
            "ok": False,
            "status": "failed",
            "message": message or "NewAPI provisioning failed",
        }
        if http_status is not None:
            result["http_status"] = http_status
        return result


newapi_binding_service = NewAPIBindingService()
