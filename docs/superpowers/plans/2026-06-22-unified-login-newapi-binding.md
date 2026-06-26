# Unified Login and NewAPI Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make HappyImage use Casdoor-only login, automatically bind each logged-in user to a per-user NewAPI default token, and expose an embedded NewAPI management entry.

**Architecture:** HappyImage remains the product app and delegates identity to Casdoor and token/quota management to NewAPI. The backend adds an idempotent NewAPI binding service that calls a protected internal provisioning endpoint when configured and marks binding pending when it is not configured. The frontend removes local login/register UI and adds a same-site NewAPI management container that embeds `https://gateway.happy-token.cn`.

**Tech Stack:** FastAPI, pytest, Next.js 16, React 19, TypeScript, Vitest, Caddy/NewAPI/Casdoor deployment docs.

---

## Scope Check

This plan covers one deliverable: HappyImage integration with the existing HappyServices identity and NewAPI gateway platform. It intentionally does not modify NewAPI source code. NewAPI provisioning is represented as a small internal HTTP contract that HappyImage can call once the platform exposes it.

## File Structure

- Modify `api/services/config.py`: add NewAPI binding settings from env/config.
- Create `api/services/newapi_binding_service.py`: own NewAPI binding/provisioning logic and redacted error handling.
- Modify `api/services/auth_service.py`: add a focused helper for applying the default NewAPI provider to a user.
- Modify `api/api/auth_oidc.py`: run binding after OIDC user creation and include binding status in session/profile payloads.
- Modify `api/api/system.py`: disable public password login/registration unless explicitly enabled for emergency use.
- Add `api/test/test_newapi_binding_service.py`: unit tests for binding service behavior.
- Modify `api/test/test_oidc_login.py`: tests for OIDC callback triggering binding and reporting pending/success.
- Modify `api/test/test_cookie_session_auth.py`: tests for disabled local login/register behavior.
- Modify `web/src/lib/api.ts`: add NewAPI binding/status fields to response types.
- Modify `web/src/store/auth.ts`: persist binding status and management URL.
- Modify `web/src/app/login/page.tsx`: remove local login/register UI; leave one Casdoor login action.
- Modify `web/src/components/account-menu.tsx`: add NewAPI management section/entry for user sessions.
- Create `web/src/app/settings/newapi/page.tsx`: same-site NewAPI management container.
- Modify `README.md`: document server architecture and request boundaries.
- Modify `api/README.md`: document backend env settings.
- Modify `web/README.md`: document management route and verification.

## Internal NewAPI Provisioning Contract

HappyImage will call this internal endpoint when configured:

```http
POST {HAPPYTOKEN_NEWAPI_PROVISION_URL}
Authorization: Bearer {HAPPYTOKEN_NEWAPI_PROVISION_SECRET}
Content-Type: application/json
```

Request body:

```json
{
  "provider": "casdoor",
  "subject": "casdoor-sub",
  "email": "creator@example.com",
  "name": "Creator",
  "token_name": "HappyImage Default"
}
```

Success response:

```json
{
  "ok": true,
  "user_id": "newapi-user-id",
  "token_id": "newapi-token-id",
  "token": "sk-user-token",
  "base_url": "https://gateway.happy-token.cn"
}
```

Pending/unavailable response is represented inside HappyImage as:

```json
{
  "ok": false,
  "status": "pending",
  "message": "NewAPI provisioning endpoint is not configured"
}
```

---

### Task 1: Backend NewAPI Binding Configuration

**Files:**
- Modify: `api/services/config.py`
- Test: `api/test/test_newapi_binding_service.py`

- [ ] **Step 1: Write failing config tests**

Add this file:

```python
from __future__ import annotations

from unittest import mock

from services.config import ConfigStore, CONFIG_FILE


def test_newapi_binding_settings_from_env():
    with mock.patch.dict(
        "os.environ",
        {
            "HAPPYTOKEN_NEWAPI_BASE_URL": "https://gateway.happy-token.cn/",
            "HAPPYTOKEN_NEWAPI_MANAGEMENT_URL": "https://gateway.happy-token.cn",
            "HAPPYTOKEN_NEWAPI_PROVISION_URL": "http://newapi:3000/api/internal/happyimage/bind-token",
            "HAPPYTOKEN_NEWAPI_PROVISION_SECRET": "secret",
            "HAPPYTOKEN_NEWAPI_TOKEN_NAME": "HappyImage Default",
        },
        clear=False,
    ):
        store = ConfigStore(CONFIG_FILE)
        settings = store.get_newapi_binding_settings()

    assert settings == {
        "base_url": "https://gateway.happy-token.cn",
        "management_url": "https://gateway.happy-token.cn",
        "provision_url": "http://newapi:3000/api/internal/happyimage/bind-token",
        "provision_secret_configured": True,
        "provision_secret": "secret",
        "token_name": "HappyImage Default",
        "enabled": True,
    }


def test_newapi_binding_defaults_to_pending_safe_values():
    with mock.patch.dict("os.environ", {}, clear=True):
        store = ConfigStore(CONFIG_FILE)
        settings = store.get_newapi_binding_settings()

    assert settings["base_url"] == "https://gateway.happy-token.cn"
    assert settings["management_url"] == "https://gateway.happy-token.cn"
    assert settings["token_name"] == "HappyImage Default"
    assert settings["enabled"] is False
    assert settings["provision_secret"] == ""
    assert settings["provision_secret_configured"] is False
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
uv run python -m pytest test/test_newapi_binding_service.py -q
```

Expected: failure containing `AttributeError: 'ConfigStore' object has no attribute 'get_newapi_binding_settings'`.

- [ ] **Step 3: Add config method**

In `api/services/config.py`, add this method inside `ConfigStore`:

```python
    def get_newapi_binding_settings(self) -> dict[str, object]:
        source = self.data.get("newapi_binding") if isinstance(self.data.get("newapi_binding"), dict) else {}
        base_url = (
            _getenv("HAPPYTOKEN_NEWAPI_BASE_URL")
            or str(source.get("base_url") or "")
            or "https://gateway.happy-token.cn"
        ).strip().rstrip("/")
        management_url = (
            _getenv("HAPPYTOKEN_NEWAPI_MANAGEMENT_URL")
            or str(source.get("management_url") or "")
            or base_url
        ).strip().rstrip("/")
        provision_url = (
            _getenv("HAPPYTOKEN_NEWAPI_PROVISION_URL")
            or str(source.get("provision_url") or "")
        ).strip()
        provision_secret = (
            _getenv("HAPPYTOKEN_NEWAPI_PROVISION_SECRET")
            or str(source.get("provision_secret") or "")
        ).strip()
        token_name = (
            _getenv("HAPPYTOKEN_NEWAPI_TOKEN_NAME")
            or str(source.get("token_name") or "")
            or "HappyImage Default"
        ).strip()[:80] or "HappyImage Default"
        return {
            "base_url": base_url,
            "management_url": management_url,
            "provision_url": provision_url,
            "provision_secret": provision_secret,
            "provision_secret_configured": bool(provision_secret),
            "token_name": token_name,
            "enabled": bool(provision_url and provision_secret),
        }
```

- [ ] **Step 4: Run config tests**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
uv run python -m pytest test/test_newapi_binding_service.py -q
```

Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
git add services/config.py test/test_newapi_binding_service.py
git commit -m "feat: add newapi binding configuration"
```

---

### Task 2: AuthService Helper For Default NewAPI Provider

**Files:**
- Modify: `api/services/auth_service.py`
- Modify: `api/test/test_newapi_binding_service.py`

- [ ] **Step 1: Add failing AuthService helper test**

Append to `api/test/test_newapi_binding_service.py`:

```python
from services.auth_service import AuthService
from services.storage.json_storage import JsonStorageBackend


def test_apply_newapi_default_provider_sets_selected_provider(tmp_path):
    storage = JsonStorageBackend(tmp_path)
    service = AuthService(storage)
    user, _raw_key = service.create_key(role="user", name="Creator")

    updated = service.apply_newapi_default_provider(
        str(user["id"]),
        base_url="https://gateway.happy-token.cn",
        api_key="sk-user-token",
    )

    assert updated is not None
    assert updated["model_provider"] == "newapi"
    assert updated["model_base_url"] == "https://gateway.happy-token.cn"
    assert updated["model_api_key_configured"] is True
    assert updated["model_providers"] == [
        {
            "id": "newapi-default",
            "type": "newapi",
            "base_url": "https://gateway.happy-token.cn",
            "api_key_configured": True,
            "selected": True,
        }
    ]


def test_apply_newapi_default_provider_preserves_other_providers(tmp_path):
    storage = JsonStorageBackend(tmp_path)
    service = AuthService(storage)
    user, _raw_key = service.create_key(role="user", name="Creator Two")
    service.update_key(
        str(user["id"]),
        {
            "model_providers": [
                {
                    "id": "manual-provider",
                    "type": "newapi",
                    "base_url": "https://manual.example.com",
                    "api_key": "sk-manual",
                    "selected": True,
                }
            ]
        },
        role="user",
    )

    updated = service.apply_newapi_default_provider(
        str(user["id"]),
        base_url="https://gateway.happy-token.cn",
        api_key="sk-user-token",
    )

    assert updated is not None
    providers = updated["model_providers"]
    assert [item["id"] for item in providers] == ["manual-provider", "newapi-default"]
    assert [item["selected"] for item in providers] == [False, True]
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
uv run python -m pytest test/test_newapi_binding_service.py -q
```

Expected: failure containing `AttributeError: 'AuthService' object has no attribute 'apply_newapi_default_provider'`.

- [ ] **Step 3: Add AuthService helper**

In `api/services/auth_service.py`, add this method inside `AuthService` before `authenticate`:

```python
    def apply_newapi_default_provider(
        self,
        key_id: str,
        *,
        base_url: str,
        api_key: str,
    ) -> dict[str, object] | None:
        normalized_id = self._clean(key_id)
        normalized_base_url = self._clean(base_url).rstrip("/")
        normalized_api_key = self._clean(api_key)
        if not normalized_id:
            return None
        if not normalized_base_url or not normalized_api_key:
            raise ValueError("NewAPI 默认供应商配置不完整")
        provider = {
            "id": "newapi-default",
            "type": "newapi",
            "base_url": normalized_base_url[:512],
            "api_key": normalized_api_key,
            "selected": True,
        }
        with self._lock:
            self._reload_locked()
            for index, item in enumerate(self._items):
                if item.get("id") != normalized_id:
                    continue
                providers = self._normalize_model_providers(item.get("model_providers"))
                next_providers = [
                    {**existing, "selected": False}
                    for existing in providers
                    if self._clean(existing.get("id")) != "newapi-default"
                ]
                next_providers.append(provider)
                next_item = dict(item)
                next_item["model_providers"] = next_providers
                next_item = self._sync_legacy_model_provider_fields(next_item)
                self._items[index] = next_item
                self._save()
                return self._public_item(next_item)
        return None
```

- [ ] **Step 4: Run tests**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
uv run python -m pytest test/test_newapi_binding_service.py -q
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
git add services/auth_service.py test/test_newapi_binding_service.py
git commit -m "feat: apply newapi default provider to users"
```

---

### Task 3: NewAPI Binding Service

**Files:**
- Create: `api/services/newapi_binding_service.py`
- Modify: `api/test/test_newapi_binding_service.py`

- [ ] **Step 1: Add failing binding service tests**

Append to `api/test/test_newapi_binding_service.py`:

```python
import json

import pytest

from services.newapi_binding_service import NewAPIBindingService


class FakeResponse:
    def __init__(self, status_code: int, payload: dict[str, object]):
        self.status_code = status_code
        self._payload = payload
        self.text = json.dumps(payload)

    def json(self):
        return self._payload


class FakeSession:
    def __init__(self, response: FakeResponse):
        self.response = response
        self.closed = False
        self.last_url = ""
        self.last_headers = {}
        self.last_json = {}

    def post(self, url, *, headers, json, timeout):
        self.last_url = url
        self.last_headers = headers
        self.last_json = json
        assert timeout == 20
        return self.response

    def close(self):
        self.closed = True


def test_binding_service_returns_pending_when_disabled():
    service = NewAPIBindingService(
        settings={
            "enabled": False,
            "base_url": "https://gateway.happy-token.cn",
            "management_url": "https://gateway.happy-token.cn",
            "provision_url": "",
            "provision_secret": "",
            "token_name": "HappyImage Default",
        }
    )

    result = service.ensure_default_token(
        provider="casdoor",
        subject="sub-1",
        email="creator@example.com",
        name="Creator",
    )

    assert result == {
        "ok": False,
        "status": "pending",
        "message": "NewAPI provisioning endpoint is not configured",
        "base_url": "https://gateway.happy-token.cn",
        "management_url": "https://gateway.happy-token.cn",
    }


def test_binding_service_calls_internal_provisioning_endpoint():
    fake = FakeSession(
        FakeResponse(
            200,
            {
                "ok": True,
                "user_id": "newapi-user",
                "token_id": "token-1",
                "token": "sk-user-token",
                "base_url": "https://gateway.happy-token.cn",
            },
        )
    )
    service = NewAPIBindingService(
        settings={
            "enabled": True,
            "base_url": "https://gateway.happy-token.cn",
            "management_url": "https://gateway.happy-token.cn",
            "provision_url": "http://newapi:3000/api/internal/happyimage/bind-token",
            "provision_secret": "secret",
            "token_name": "HappyImage Default",
        },
        session_factory=lambda: fake,
    )

    result = service.ensure_default_token(
        provider="casdoor",
        subject="sub-1",
        email="creator@example.com",
        name="Creator",
    )

    assert fake.closed is True
    assert fake.last_url == "http://newapi:3000/api/internal/happyimage/bind-token"
    assert fake.last_headers == {"Authorization": "Bearer secret"}
    assert fake.last_json == {
        "provider": "casdoor",
        "subject": "sub-1",
        "email": "creator@example.com",
        "name": "Creator",
        "token_name": "HappyImage Default",
    }
    assert result["ok"] is True
    assert result["token"] == "sk-user-token"
    assert result["base_url"] == "https://gateway.happy-token.cn"


def test_binding_service_redacts_failure_details():
    fake = FakeSession(FakeResponse(500, {"error": "secret sk-leaked"}))
    service = NewAPIBindingService(
        settings={
            "enabled": True,
            "base_url": "https://gateway.happy-token.cn",
            "management_url": "https://gateway.happy-token.cn",
            "provision_url": "http://newapi:3000/api/internal/happyimage/bind-token",
            "provision_secret": "secret",
            "token_name": "HappyImage Default",
        },
        session_factory=lambda: fake,
    )

    result = service.ensure_default_token(
        provider="casdoor",
        subject="sub-1",
        email="creator@example.com",
        name="Creator",
    )

    assert result["ok"] is False
    assert result["status"] == "failed"
    assert result["message"] == "NewAPI provisioning failed with HTTP 500"
    assert "secret" not in json.dumps(result)
    assert "sk-leaked" not in json.dumps(result)
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
uv run python -m pytest test/test_newapi_binding_service.py -q
```

Expected: failure containing `ModuleNotFoundError: No module named 'services.newapi_binding_service'`.

- [ ] **Step 3: Create binding service**

Create `api/services/newapi_binding_service.py`:

```python
from __future__ import annotations

from collections.abc import Callable
from typing import Any

from curl_cffi import requests

from services.config import config
from services.proxy_service import proxy_settings


def _clean(value: object) -> str:
    return str(value or "").strip()


class NewAPIBindingService:
    def __init__(
        self,
        settings: dict[str, object] | None = None,
        session_factory: Callable[[], Any] | None = None,
    ) -> None:
        self._settings = settings
        self._session_factory = session_factory

    def _get_settings(self) -> dict[str, object]:
        return self._settings or config.get_newapi_binding_settings()

    def _make_session(self):
        if self._session_factory is not None:
            return self._session_factory()
        kwargs = proxy_settings.build_session_kwargs(impersonate="chrome", verify=True)
        return requests.Session(**kwargs)

    def ensure_default_token(
        self,
        *,
        provider: str,
        subject: str,
        email: str,
        name: str,
    ) -> dict[str, object]:
        settings = self._get_settings()
        base_url = _clean(settings.get("base_url")).rstrip("/") or "https://gateway.happy-token.cn"
        management_url = _clean(settings.get("management_url")).rstrip("/") or base_url
        provision_url = _clean(settings.get("provision_url"))
        provision_secret = _clean(settings.get("provision_secret"))
        token_name = _clean(settings.get("token_name")) or "HappyImage Default"
        if not bool(settings.get("enabled")) or not provision_url or not provision_secret:
            return {
                "ok": False,
                "status": "pending",
                "message": "NewAPI provisioning endpoint is not configured",
                "base_url": base_url,
                "management_url": management_url,
            }

        payload = {
            "provider": _clean(provider) or "casdoor",
            "subject": _clean(subject),
            "email": _clean(email),
            "name": _clean(name),
            "token_name": token_name,
        }
        session = self._make_session()
        try:
            response = session.post(
                provision_url,
                headers={"Authorization": f"Bearer {provision_secret}"},
                json=payload,
                timeout=20,
            )
            if response.status_code != 200:
                return {
                    "ok": False,
                    "status": "failed",
                    "message": f"NewAPI provisioning failed with HTTP {response.status_code}",
                    "base_url": base_url,
                    "management_url": management_url,
                }
            data = response.json()
        except Exception as exc:
            return {
                "ok": False,
                "status": "failed",
                "message": f"NewAPI provisioning request failed: {exc.__class__.__name__}",
                "base_url": base_url,
                "management_url": management_url,
            }
        finally:
            try:
                session.close()
            except Exception:
                pass

        token = _clean(data.get("token") if isinstance(data, dict) else "")
        resolved_base_url = _clean(data.get("base_url") if isinstance(data, dict) else "").rstrip("/") or base_url
        if not token:
            return {
                "ok": False,
                "status": "failed",
                "message": "NewAPI provisioning response did not include a token",
                "base_url": resolved_base_url,
                "management_url": management_url,
            }
        return {
            "ok": True,
            "status": "configured",
            "message": "",
            "base_url": resolved_base_url,
            "management_url": management_url,
            "token": token,
            "token_id": _clean(data.get("token_id") if isinstance(data, dict) else ""),
            "user_id": _clean(data.get("user_id") if isinstance(data, dict) else ""),
        }


newapi_binding_service = NewAPIBindingService()
```

- [ ] **Step 4: Run binding service tests**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
uv run python -m pytest test/test_newapi_binding_service.py -q
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
git add services/newapi_binding_service.py test/test_newapi_binding_service.py
git commit -m "feat: add newapi binding service"
```

---

### Task 4: Run Binding During OIDC Login And Session Refresh

**Files:**
- Modify: `api/api/auth_oidc.py`
- Modify: `api/test/test_oidc_login.py`

- [ ] **Step 1: Add failing OIDC binding tests**

Append to `api/test/test_oidc_login.py`:

```python
def test_oidc_callback_applies_newapi_default_provider_when_binding_succeeds():
    app = FastAPI()
    app.include_router(auth_oidc_api.create_router())

    user_item = {
        "id": "user-oidc",
        "name": "Creator",
        "role": "user",
        "enabled": True,
        "auth_provider": "casdoor",
        "auth_subject": "subject-1",
        "email": "creator@example.com",
    }
    updated_item = {
        **user_item,
        "model_provider": "newapi",
        "model_base_url": "https://gateway.happy-token.cn",
        "model_api_key_configured": True,
        "model_providers": [
            {
                "id": "newapi-default",
                "type": "newapi",
                "base_url": "https://gateway.happy-token.cn",
                "api_key_configured": True,
                "selected": True,
            }
        ],
    }

    with mock.patch.dict(
        os.environ,
        {
            "HAPPYTOKEN_SESSION_SECRET": "oidc-session-secret",
            "HAPPYTOKEN_OIDC_ENABLED": "true",
            "HAPPYTOKEN_FRONTEND_BASE_URL": "https://web.example.com",
        },
        clear=False,
    ), mock.patch.object(
        auth_oidc_api.oidc_service,
        "handle_callback",
        return_value={"sub": "subject-1", "email": "creator@example.com", "name": "Creator", "next_path": "/image"},
    ), mock.patch.object(
        auth_oidc_api.auth_service,
        "find_or_create_oidc_user",
        return_value=user_item,
    ), mock.patch.object(
        auth_oidc_api.newapi_binding_service,
        "ensure_default_token",
        return_value={
            "ok": True,
            "status": "configured",
            "base_url": "https://gateway.happy-token.cn",
            "management_url": "https://gateway.happy-token.cn",
            "token": "sk-user-token",
        },
    ), mock.patch.object(
        auth_oidc_api.auth_service,
        "apply_newapi_default_provider",
        return_value=updated_item,
    ):
        response = TestClient(app).get("/api/auth/oidc/callback?code=code&state=state", follow_redirects=False)

    assert response.status_code == 302, response.text
    cookie = response.headers["set-cookie"]
    token = cookie.split("happytoken_session=", 1)[1].split(";", 1)[0]
    payload = web_session_service.verify_session(token)
    assert payload["model_base_url"] == "https://gateway.happy-token.cn"
    assert payload["model_api_key_configured"] is True
    assert payload["newapi_binding_status"] == "configured"
    assert payload["newapi_management_url"] == "https://gateway.happy-token.cn"


def test_oidc_callback_allows_login_when_newapi_binding_is_pending():
    app = FastAPI()
    app.include_router(auth_oidc_api.create_router())

    user_item = {
        "id": "user-oidc-pending",
        "name": "Creator",
        "role": "user",
        "enabled": True,
        "auth_provider": "casdoor",
        "auth_subject": "subject-2",
        "email": "creator2@example.com",
    }

    with mock.patch.dict(
        os.environ,
        {
            "HAPPYTOKEN_SESSION_SECRET": "oidc-session-secret",
            "HAPPYTOKEN_OIDC_ENABLED": "true",
            "HAPPYTOKEN_FRONTEND_BASE_URL": "https://web.example.com",
        },
        clear=False,
    ), mock.patch.object(
        auth_oidc_api.oidc_service,
        "handle_callback",
        return_value={"sub": "subject-2", "email": "creator2@example.com", "name": "Creator", "next_path": "/image"},
    ), mock.patch.object(
        auth_oidc_api.auth_service,
        "find_or_create_oidc_user",
        return_value=user_item,
    ), mock.patch.object(
        auth_oidc_api.newapi_binding_service,
        "ensure_default_token",
        return_value={
            "ok": False,
            "status": "pending",
            "message": "NewAPI provisioning endpoint is not configured",
            "base_url": "https://gateway.happy-token.cn",
            "management_url": "https://gateway.happy-token.cn",
        },
    ), mock.patch.object(
        auth_oidc_api.auth_service,
        "apply_newapi_default_provider",
    ) as apply_provider:
        response = TestClient(app).get("/api/auth/oidc/callback?code=code&state=state", follow_redirects=False)

    assert response.status_code == 302, response.text
    apply_provider.assert_not_called()
    cookie = response.headers["set-cookie"]
    token = cookie.split("happytoken_session=", 1)[1].split(";", 1)[0]
    payload = web_session_service.verify_session(token)
    assert payload["newapi_binding_status"] == "pending"
    assert payload["newapi_binding_message"] == "NewAPI provisioning endpoint is not configured"
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
uv run python -m pytest test/test_oidc_login.py -q
```

Expected: failure containing `AttributeError` for missing `newapi_binding_service` on `api.auth_oidc`.

- [ ] **Step 3: Wire binding service into OIDC callback**

In `api/api/auth_oidc.py`, add import:

```python
from services.newapi_binding_service import newapi_binding_service
```

Add helper near `_request_external_base_url`:

```python
def _with_newapi_binding_status(identity: dict[str, object], binding: dict[str, object]) -> dict[str, object]:
    next_identity = dict(identity)
    next_identity["newapi_binding_status"] = str(binding.get("status") or ("configured" if binding.get("ok") else "pending"))
    next_identity["newapi_management_url"] = str(binding.get("management_url") or "").strip()
    message = str(binding.get("message") or "").strip()
    if message:
        next_identity["newapi_binding_message"] = message
    return next_identity
```

In `oidc_callback`, immediately after `find_or_create_oidc_user`, add:

```python
        binding = await run_in_threadpool(
            newapi_binding_service.ensure_default_token,
            provider="casdoor",
            subject=str(oidc_claims.get("sub") or ""),
            email=str(oidc_claims.get("email") or ""),
            name=str(oidc_claims.get("name") or ""),
        )
        if binding.get("ok"):
            try:
                updated_user = await run_in_threadpool(
                    auth_service.apply_newapi_default_provider,
                    str(user_item.get("id") or ""),
                    base_url=str(binding.get("base_url") or ""),
                    api_key=str(binding.get("token") or ""),
                )
                if updated_user is not None:
                    user_item = updated_user
            except ValueError:
                binding = {
                    **binding,
                    "ok": False,
                    "status": "failed",
                    "message": "NewAPI 默认供应商配置不完整",
                }
```

Then before creating the session, after the `identity` dict is built and enriched, add:

```python
        identity = _with_newapi_binding_status(identity, binding)
```

In `get_session`, include persisted or session binding fields in `external_identity` by changing the tuple to:

```python
            for key in ("auth_provider", "auth_subject", "email", "newapi_binding_status", "newapi_binding_message", "newapi_management_url")
```

Apply that tuple in both places in `auth_oidc.py`.

- [ ] **Step 4: Run OIDC tests**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
uv run python -m pytest test/test_oidc_login.py -q
```

Expected: all OIDC tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
git add api/auth_oidc.py test/test_oidc_login.py
git commit -m "feat: bind newapi during oidc login"
```

---

### Task 5: Disable Public Local Login And Registration

**Files:**
- Modify: `api/api/system.py`
- Modify: `api/test/test_cookie_session_auth.py`

- [ ] **Step 1: Add failing tests for disabled local auth**

Append to `api/test/test_cookie_session_auth.py`:

```python
def test_password_login_disabled_by_default_for_public_users():
    with mock.patch.dict(
        os.environ,
        {
            "HAPPYTOKEN_SESSION_SECRET": "cookie-test-session-secret",
            "HAPPYTOKEN_FRONTEND_BASE_URL": "http://localhost:3000",
        },
        clear=False,
    ):
        with TestClient(create_app()) as client:
            response = client.post("/api/auth/login", json={"email": "someone", "password": "secret"})

    assert response.status_code == 403, response.text
    assert response.json()["detail"]["error"] == "请使用统一登录入口"


def test_password_login_can_be_enabled_for_emergency_operations():
    with mock.patch.dict(
        os.environ,
        {
            "HAPPYTOKEN_SESSION_SECRET": "cookie-test-session-secret",
            "HAPPYTOKEN_FRONTEND_BASE_URL": "http://localhost:3000",
            "HAPPYTOKEN_LOCAL_PASSWORD_LOGIN_ENABLED": "true",
        },
        clear=False,
    ):
        with TestClient(create_app()) as client:
            name, password = _create_password_account(role="admin", prefix="emergency-admin")
            response = client.post("/api/auth/login", json={"email": name, "password": password})

    assert response.status_code == 200, response.text


def test_register_disabled_even_when_legacy_registration_flag_is_true():
    with mock.patch.dict(
        os.environ,
        {
            "HAPPYTOKEN_SESSION_SECRET": "cookie-test-session-secret",
            "HAPPYTOKEN_FRONTEND_BASE_URL": "http://localhost:3000",
            "HAPPYTOKEN_REGISTRATION_ENABLED": "true",
        },
        clear=False,
    ):
        with TestClient(create_app()) as client:
            response = client.post(
                "/api/auth/register",
                json={"name": "creator", "password": "secret123", "confirm_password": "secret123"},
            )

    assert response.status_code == 403, response.text
    assert response.json()["detail"]["error"] == "注册请使用统一登录入口"
```

- [ ] **Step 2: Run targeted tests to verify failure**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
uv run python -m pytest test/test_cookie_session_auth.py::test_password_login_disabled_by_default_for_public_users test/test_cookie_session_auth.py::test_register_disabled_even_when_legacy_registration_flag_is_true -q
```

Expected: first test returns 401 instead of 403 or registration succeeds/returns old message.

- [ ] **Step 3: Add local auth gates**

In `api/api/system.py`, add helper after `_registration_enabled`:

```python
def _local_password_login_enabled() -> bool:
    enabled = str(
        os.getenv("HAPPYTOKEN_LOCAL_PASSWORD_LOGIN_ENABLED")
        or config.data.get("local_password_login_enabled", "false")
    ).strip().lower()
    return enabled in {"1", "true", "yes", "on"}
```

At the top of `password_login`, before reading email/password, add:

```python
        if not _local_password_login_enabled():
            raise HTTPException(status_code=403, detail={"error": "请使用统一登录入口"})
```

At the top of `register_user`, before rate limit, add:

```python
        raise HTTPException(status_code=403, detail={"error": "注册请使用统一登录入口"})
```

- [ ] **Step 4: Update old tests that expect password login by setting emergency env**

In `api/test/test_cookie_session_auth.py`, update `_login_password`:

```python
def _login_password(client: TestClient, role: str = "admin", prefix: str = "account"):
    name, password = _create_password_account(role=role, prefix=prefix)
    response = client.post("/api/auth/login", json={"email": name, "password": password})
    assert response.status_code == 200, response.text
    return name, password, response
```

For every test in this file that uses `_login_password` or directly posts `/api/auth/login` and expects success, add `"HAPPYTOKEN_LOCAL_PASSWORD_LOGIN_ENABLED": "true"` to that test's `mock.patch.dict` env. Use the exact key/value:

```python
"HAPPYTOKEN_LOCAL_PASSWORD_LOGIN_ENABLED": "true",
```

- [ ] **Step 5: Run cookie/session auth tests**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
uv run python -m pytest test/test_cookie_session_auth.py -q
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
git add api/system.py test/test_cookie_session_auth.py
git commit -m "feat: disable local public auth"
```

---

### Task 6: Frontend Session Types For NewAPI Binding

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/store/auth.ts`
- Modify: `web/src/lib/auth-session.ts`
- Modify: `web/src/app/login/page.tsx`
- Modify: `web/src/components/account-menu.tsx`

- [ ] **Step 1: Add session fields to API types**

In `web/src/lib/api.ts`, add these optional fields to `LoginResponse`, `SessionResponse`, and nested `user` shapes where model provider fields already live:

```ts
  newapi_binding_status?: "configured" | "pending" | "failed";
  newapi_binding_message?: string;
  newapi_management_url?: string;
```

- [ ] **Step 2: Add stored session fields**

In `web/src/store/auth.ts`, add to `StoredAuthSession`:

```ts
  newapiBindingStatus?: "configured" | "pending" | "failed";
  newapiBindingMessage?: string;
  newapiManagementUrl?: string;
```

In `normalizeSession`, add:

```ts
    newapiBindingStatus:
      candidate.newapiBindingStatus === "configured" || candidate.newapiBindingStatus === "pending" || candidate.newapiBindingStatus === "failed"
        ? candidate.newapiBindingStatus
        : undefined,
    newapiBindingMessage: String(candidate.newapiBindingMessage || "").trim(),
    newapiManagementUrl: String(candidate.newapiManagementUrl || "").trim(),
```

- [ ] **Step 3: Map backend fields into stored sessions**

In `web/src/lib/auth-session.ts`, when constructing `nextSession` in both branches, add:

```ts
        newapiBindingStatus: data.user?.newapi_binding_status ?? data.newapi_binding_status,
        newapiBindingMessage: data.user?.newapi_binding_message ?? data.newapi_binding_message ?? "",
        newapiManagementUrl: data.user?.newapi_management_url ?? data.newapi_management_url ?? "",
```

In `web/src/app/login/page.tsx` inside `buildStoredSession`, add:

```ts
    newapiBindingStatus: response.user?.newapi_binding_status ?? response.newapi_binding_status,
    newapiBindingMessage: response.user?.newapi_binding_message ?? response.newapi_binding_message ?? "",
    newapiManagementUrl: response.user?.newapi_management_url ?? response.newapi_management_url ?? "",
```

In `web/src/components/account-menu.tsx` inside `buildSessionFromProfileResponse`, add:

```ts
    newapiBindingStatus: data.user?.newapi_binding_status ?? data.newapi_binding_status ?? session.newapiBindingStatus,
    newapiBindingMessage: data.user?.newapi_binding_message ?? data.newapi_binding_message ?? session.newapiBindingMessage ?? "",
    newapiManagementUrl: data.user?.newapi_management_url ?? data.newapi_management_url ?? session.newapiManagementUrl ?? "",
```

- [ ] **Step 4: Run TypeScript check**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-web
pnpm exec tsc --noEmit
```

Expected: TypeScript passes.

- [ ] **Step 5: Commit**

```bash
cd /Users/forever/workspace/HappyImage/happyimage-web
git add src/lib/api.ts src/store/auth.ts src/lib/auth-session.ts src/app/login/page.tsx src/components/account-menu.tsx
git commit -m "feat: persist newapi binding session state"
```

---

### Task 7: Casdoor-Only Login Page

**Files:**
- Modify: `web/src/app/login/page.tsx`

- [ ] **Step 1: Replace local login/register state and UI**

In `web/src/app/login/page.tsx`, remove imports `Eye`, `EyeOff`, `Mail`, `UserPlus`, `Input`, `loginWithPassword`, and `registerWithPassword`.

Keep imports:

```ts
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LoaderCircle, LockKeyhole, LogIn } from "lucide-react";
import { toast } from "sonner";

import { HeaderActions } from "@/components/header-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { startOIDCLogin, type LoginResponse } from "@/lib/api";
```

Remove `LoginMode`, password/register state, `LoginFieldIcon`, `handlePasswordLogin`, `handleRegister`, and `handleSubmit`.

Use this title/description:

```ts
  const title = useMemo(() => "登录 Happy Token", []);
  const description = useMemo(() => "使用统一账户进入 HappyImage，继续创作、管理图库和历史会话。", []);
```

Replace the `<form>` content with:

```tsx
          <div className="space-y-4">
            <Button
              type="button"
              className="h-12 w-full rounded-lg bg-stone-950 text-white hover:bg-stone-800"
              disabled={isSubmitting}
              onClick={() => void handleOIDCLogin()}
            >
              {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : <LogIn className="size-4" />}
              使用 Happy Token 登录
            </Button>
          </div>
```

- [ ] **Step 2: Run lint/type check**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-web
pnpm exec tsc --noEmit
```

Expected: TypeScript passes with no unused imports.

- [ ] **Step 3: Commit**

```bash
cd /Users/forever/workspace/HappyImage/happyimage-web
git add src/app/login/page.tsx
git commit -m "feat: use casdoor-only login page"
```

---

### Task 8: NewAPI Management Page And Account Menu Entry

**Files:**
- Create: `web/src/app/settings/newapi/page.tsx`
- Modify: `web/src/components/account-menu.tsx`

- [ ] **Step 1: Create NewAPI management page**

Create `web/src/app/settings/newapi/page.tsx`:

```tsx
"use client";

import { ExternalLink, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getValidatedAuthSession } from "@/lib/auth-session";

const DEFAULT_NEWAPI_URL = "https://gateway.happy-token.cn";

export default function NewAPISettingsPage() {
  const [managementUrl, setManagementUrl] = useState(DEFAULT_NEWAPI_URL);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getValidatedAuthSession()
      .then((session) => {
        if (cancelled) return;
        setManagementUrl(session?.newapiManagementUrl || DEFAULT_NEWAPI_URL);
      })
      .finally(() => {
        if (!cancelled) setIsChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isChecking) {
    return (
      <div className="grid min-h-[calc(100vh-1rem)] place-items-center">
        <LoaderCircle className="size-5 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <main className="h-[calc(100vh-1rem)] min-h-[640px] w-full overflow-hidden bg-stone-50 dark:bg-[#171717]">
      <div className="flex h-12 items-center justify-between border-b border-stone-200 bg-white px-4 dark:border-white/10 dark:bg-[#1f1f1f]">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-stone-950 dark:text-stone-50">NewAPI 管理</h1>
        </div>
        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
          <a href={managementUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" />
            新窗口打开
          </a>
        </Button>
      </div>
      <iframe
        title="NewAPI 管理"
        src={managementUrl}
        className="h-[calc(100%-3rem)] w-full border-0 bg-white"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </main>
  );
}
```

- [ ] **Step 2: Add account menu copy and nav item**

In `web/src/components/account-menu.tsx`, add `KeyRound` to lucide imports.

Extend `SettingsSection`:

```ts
type SettingsSection = "account" | "appearance" | "provider" | "newapi" | "watermark" | "contact" | "about";
```

Add Chinese copy under `nav`:

```ts
      newapi: "NewAPI",
```

Add Chinese `newapi` copy:

```ts
    newapi: {
      title: "NewAPI 管理",
      status: "绑定状态",
      configured: "已自动绑定",
      pending: "等待绑定",
      failed: "绑定失败",
      open: "打开 NewAPI 管理",
      hint: "令牌、额度和用量由 NewAPI 管理。",
    },
```

Add equivalent English copy under `nav` and root:

```ts
      newapi: "NewAPI",
```

```ts
    newapi: {
      title: "NewAPI Management",
      status: "Binding status",
      configured: "Configured",
      pending: "Pending",
      failed: "Failed",
      open: "Open NewAPI management",
      hint: "Tokens, quota, and usage are managed by NewAPI.",
    },
```

Add nav item after provider:

```tsx
    ...(session.role === "user" ? [{ id: "newapi" as const, label: copy.nav.newapi, icon: KeyRound }] : []),
```

- [ ] **Step 3: Add NewAPI panel**

Inside `renderPanel`, before `if (activeSection === "watermark")`, add:

```tsx
    if (activeSection === "newapi") {
      const status = session.newapiBindingStatus || (session.modelApiKeyConfigured ? "configured" : "pending");
      const statusLabel =
        status === "configured" ? copy.newapi.configured : status === "failed" ? copy.newapi.failed : copy.newapi.pending;
      return (
        <section>
          <div className={sectionTitleClass}>{copy.newapi.title}</div>
          <div className="rounded-2xl border border-stone-200/80 bg-stone-50/70 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-stone-500 dark:text-stone-400">{copy.newapi.status}</span>
              <span className="font-medium text-stone-900 dark:text-stone-100">{statusLabel}</span>
            </div>
            {session.newapiBindingMessage ? (
              <p className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{session.newapiBindingMessage}</p>
            ) : null}
            <p className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{copy.newapi.hint}</p>
            <a
              href="/settings/newapi"
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-3 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              <KeyRound className="size-4" />
              {copy.newapi.open}
            </a>
          </div>
        </section>
      );
    }
```

- [ ] **Step 4: Run TypeScript check**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-web
pnpm exec tsc --noEmit
```

Expected: TypeScript passes.

- [ ] **Step 5: Commit**

```bash
cd /Users/forever/workspace/HappyImage/happyimage-web
git add src/app/settings/newapi/page.tsx src/components/account-menu.tsx
git commit -m "feat: add embedded newapi management entry"
```

---

### Task 9: Documentation

**Files:**
- Modify: `README.md`
- Modify: `api/README.md`
- Modify: `web/README.md`

- [ ] **Step 1: Update workspace README architecture**

In `/Users/forever/workspace/HappyImage/README.md`, add this section after "请求边界":

```markdown
统一登录与 NewAPI 绑定：

```text
auth.happy-token.cn             -> Casdoor 统一登录
image.happy-token.cn            -> HappyImage 产品入口
image.happy-token.cn/settings/newapi -> HappyImage 内嵌 NewAPI 管理容器
gateway.happy-token.cn          -> NewAPI 管理 UI 与模型网关
gateway.happy-token.cn/v1/*     -> NewAPI OpenAI-compatible 模型接口
```

HappyImage 普通用户登录只走 Casdoor OIDC。用户登录后，后端用 Casdoor `sub` 作为稳定身份，调用受控的 NewAPI provisioning endpoint 创建或复用 `HappyImage Default` 用户令牌，并写入当前用户的默认模型供应商配置。额度、计费、令牌管理和用量审计由 NewAPI 负责，HappyImage 不做本地账本。

线上 `/data/HappyServices` 由顶层 `docker-compose.yml` include 子服务，Caddy 是统一入口。当前服务边界：

| 服务 | 公网入口 | 内部职责 |
|:--|:--|:--|
| Caddy | 80/443 | TLS、反代、跨域策略 |
| Casdoor | `auth.happy-token.cn` | 统一用户登录和 OIDC issuer |
| NewAPI | `gateway.happy-token.cn` | 模型网关、用户 token、额度和审计 |
| HappyImage Web | `image.happy-token.cn` | 图片产品前端 |
| HappyImage API | `image.happy-token.cn/api/*` | 图片任务、历史、用户资料 |
| PostgreSQL | 内网 Docker 网络 | 平台基础数据库 |
| Redis | 内网 Docker 网络 | NewAPI/sub2api 缓存 |
| sub2api/chatgpt2api | 子域名入口 | 基础模型服务层 |
| Umami | 子域名入口 | 访问统计 |
| Mihomo | 内网 Docker 网络 | 出站代理 |
```

- [ ] **Step 2: Update backend README**

Append to `api/README.md`:

```markdown
## Unified Login / NewAPI Binding

Normal users should authenticate through Casdoor OIDC. Public password login is disabled unless `HAPPYTOKEN_LOCAL_PASSWORD_LOGIN_ENABLED=true` is set for emergency operations.

NewAPI binding environment:

```bash
HAPPYTOKEN_NEWAPI_BASE_URL=https://gateway.happy-token.cn
HAPPYTOKEN_NEWAPI_MANAGEMENT_URL=https://gateway.happy-token.cn
HAPPYTOKEN_NEWAPI_PROVISION_URL=http://newapi:3000/api/internal/happyimage/bind-token
HAPPYTOKEN_NEWAPI_PROVISION_SECRET=replace-with-internal-secret
HAPPYTOKEN_NEWAPI_TOKEN_NAME="HappyImage Default"
```

If `HAPPYTOKEN_NEWAPI_PROVISION_URL` or `HAPPYTOKEN_NEWAPI_PROVISION_SECRET` is missing, OIDC login still succeeds and the user session reports `newapi_binding_status=pending`.
```

- [ ] **Step 3: Update frontend README**

Append to `web/README.md`:

```markdown
## NewAPI Management

HappyImage exposes `/settings/newapi` as the product entry for NewAPI management. The page embeds `newapi_management_url` from the authenticated session, defaulting to `https://gateway.happy-token.cn`.

Browser verification must confirm that the embedded NewAPI page can use Casdoor/NewAPI session cookies in Chrome and Safari. If iframe loading is blocked, users can open NewAPI in a new window from the same page.
```

- [ ] **Step 4: Commit docs**

```bash
cd /Users/forever/workspace/HappyImage
git -C happyimage-api add README.md
git -C happyimage-api commit -m "docs: document newapi binding backend config"
git -C happyimage-web add README.md
git -C happyimage-web commit -m "docs: document newapi management page"
```

Top-level `README.md` is outside a Git repository in this workspace. Edit it but do not commit unless a top-level repository is created.

---

### Task 10: Final Verification

**Files:**
- Read-only verification across `api/`, `web/`, and `README.md`

- [ ] **Step 1: Run backend tests**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
uv run python -m pytest -q
```

Expected: all non-live tests pass.

- [ ] **Step 2: Run frontend typecheck and unit tests**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-web
pnpm exec tsc --noEmit
pnpm run test:unit
```

Expected: TypeScript passes and Vitest passes.

- [ ] **Step 3: Start dev servers for manual UI verification**

Run in terminal A:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
uv run python main.py
```

Run in terminal B:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-web
pnpm run dev
```

Expected:

- API serves without startup errors.
- Web dev server prints a local URL.

- [ ] **Step 4: Manual browser checks**

Open the web dev URL and verify:

- `/login` shows one primary "使用 Happy Token 登录" action.
- `/login` does not show local username/password inputs.
- `/login` does not show registration controls.
- A user session with `newapi_binding_status=pending` shows the NewAPI account menu status as pending.
- `/settings/newapi` loads an iframe pointing at `https://gateway.happy-token.cn`.
- The page includes a new-window fallback link.

- [ ] **Step 5: Server deployment checks**

Run:

```bash
ssh hk 'curl -k -s https://gateway.happy-token.cn/api/status | python -m json.tool | sed -n "1,120p"'
ssh hk 'curl -k -s https://auth.happy-token.cn/.well-known/openid-configuration | python -m json.tool | sed -n "1,120p"'
ssh hk 'curl -k -sI https://gateway.happy-token.cn/ | sed -n "1,80p"'
```

Expected:

- NewAPI status includes `"oidc_enabled": true`.
- NewAPI status includes `"server_address": "https://gateway.happy-token.cn"`.
- Casdoor discovery includes `authorization_endpoint`, `token_endpoint`, and `userinfo_endpoint`.
- Gateway headers do not include `X-Frame-Options: DENY` or a `frame-ancestors` CSP blocking `image.happy-token.cn`.

- [ ] **Step 6: Commit verification notes if docs changed**

If verification adds docs, commit in the relevant nested repository:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
git status --short
cd /Users/forever/workspace/HappyImage/happyimage-web
git status --short
```

Expected: no uncommitted implementation changes remain in nested repos.

---

## Self-Review

Spec coverage:

- Casdoor-only login is covered by Tasks 5 and 7.
- Per-user NewAPI token binding is covered by Tasks 1 through 4.
- HappyImage not doing billing/quota is preserved by Tasks 3 and 8: the UI links to NewAPI and does not implement quota screens.
- NewAPI management embedding is covered by Task 8.
- Server architecture docs are covered by Task 9.
- Verification of OIDC/cookie/frame behavior is covered by Task 10.

Known implementation gap:

- HappyImage cannot create a NewAPI user token unless the platform exposes the internal provisioning endpoint described above. The implementation handles this safely by reporting `pending` instead of blocking login or pretending a token exists.
