# Admin Service Settings Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move service runtime settings into admin-managed storage, add first setup, remove `/v1/*` compatibility paths, and document the cleaned environment variable model.

**Architecture:** Keep only infrastructure variables in deployment config, especially `BACKEND_URL`, `STORAGE_BACKEND`, and `DATABASE_URL`. Store admin runtime settings through the existing API storage backend and expose setup/settings APIs that redact secrets. Route all product image generation through `/api/image-tasks/*`; remove Web and API `/v1/*` proxy/compatibility layers.

**Tech Stack:** FastAPI, Python unittest/pytest, Next.js App Router, Zustand, Vitest, existing HappyImage storage backends.

---

## File Structure

- Modify `happyimage-api/services/storage/base.py`: extend the storage backend interface with runtime config load/save methods.
- Modify `happyimage-api/services/storage/json_storage.py`: store runtime config in `config.json`.
- Modify `happyimage-api/services/storage/database_storage.py`: add a `runtime_config` table for database-backed settings.
- Modify `happyimage-api/services/storage/git_storage.py`: implement runtime config with a dedicated config file path.
- Modify `happyimage-api/services/storage/factory.py`: pass config storage paths through each backend.
- Modify `happyimage-api/services/config.py`: remove service-setting environment overrides, add normalized admin settings, redaction, gateway helpers, and storage-backed persistence.
- Modify `happyimage-api/api/system.py`: update settings APIs, add setup status/create endpoints, and expose admin recovery login.
- Modify `happyimage-api/api/auth_oidc.py`: use `public_app_url`/`api_public_url` helpers and gateway settings.
- Modify `happyimage-api/services/newapi_binding_service.py`: read unified gateway settings names.
- Modify `happyimage-api/services/web_session_service.py`: use new URL/session helpers.
- Delete `happyimage-api/api/ai.py`: remove `/v1/*` routes.
- Modify `happyimage-api/api/app.py`: remove the `ai` router include.
- Modify API tests under `happyimage-api/test/`: update config, setup, OIDC, NewAPI binding, and remove `/v1/*` tests.
- Modify `happyimage-web/src/middleware.ts`: remove `/v1/*` proxy support and `MODEL_BACKEND_*` usage.
- Modify `happyimage-web/src/middleware.test.ts`: assert only product paths are proxied.
- Modify `happyimage-web/src/lib/api.ts`: remove `/v1/*` helpers and add setup/settings types.
- Modify `happyimage-web/src/app/login/page.tsx`: include admin key recovery when OIDC cannot start.
- Create `happyimage-web/src/app/setup/page.tsx`: first admin and runtime settings setup UI.
- Modify `happyimage-web/src/app/settings/store.ts` and `happyimage-web/src/app/settings/components/config-card.tsx`: expose normalized service settings.
- Modify `happyimage-web/src/app/image/page.tsx`: stop loading models from `/v1/models`; use product task APIs and a local/default model list.
- Modify `happyimage-web/README.md`: replace old env/proxy docs with the new setup and settings model.
- Modify deployment docs/compose files that mention `MODEL_BACKEND_*` or moved `HAPPYTOKEN_*` runtime settings.

---

### Task 1: Storage-Backed Runtime Config

**Files:**
- Modify: `happyimage-api/services/storage/base.py`
- Modify: `happyimage-api/services/storage/json_storage.py`
- Modify: `happyimage-api/services/storage/database_storage.py`
- Modify: `happyimage-api/services/storage/git_storage.py`
- Modify: `happyimage-api/services/storage/factory.py`
- Modify: `happyimage-api/services/config.py`
- Test: `happyimage-api/test/test_config.py`

- [ ] **Step 1: Add failing config storage tests**

Add these tests to `happyimage-api/test/test_config.py`:

```python
def test_config_store_uses_storage_backend_for_runtime_settings(self) -> None:
    class MemoryStorage:
        def __init__(self) -> None:
            self.runtime_config: dict[str, object] = {}

        def load_accounts(self) -> list[dict[str, object]]:
            return []

        def save_accounts(self, accounts: list[dict[str, object]]) -> None:
            pass

        def load_auth_keys(self) -> list[dict[str, object]]:
            return []

        def save_auth_keys(self, auth_keys: list[dict[str, object]]) -> None:
            pass

        def load_runtime_config(self) -> dict[str, object]:
            return dict(self.runtime_config)

        def save_runtime_config(self, config: dict[str, object]) -> None:
            self.runtime_config = dict(config)

        def health_check(self) -> dict[str, object]:
            return {"status": "healthy"}

        def get_backend_info(self) -> dict[str, object]:
            return {"type": "memory"}

    store = self.config_module.ConfigStore(Path("ignored-config.json"), storage_backend=MemoryStorage())
    response = store.update(
        {
            "public_app_url": "https://image.example.com/",
            "api_public_url": "",
            "model_gateway": {
                "gateway_api_base_url": "https://gateway.happy-token.cn/v1/",
                "gateway_management_url": "",
                "token_name": "HappyImage Default",
            },
        }
    )

    self.assertEqual(response["public_app_url"], "https://image.example.com")
    self.assertEqual(response["api_public_url"], "")
    self.assertEqual(response["external_api_url"], "https://image.example.com")
    self.assertEqual(response["model_gateway"]["gateway_api_base_url"], "https://gateway.happy-token.cn/v1")
    self.assertEqual(response["model_gateway"]["gateway_management_url"], "https://gateway.happy-token.cn")
```

Replace `test_prefixed_dotenv_loads_happytoken_settings_only` with:

```python
def test_service_runtime_settings_ignore_happytoken_environment(self) -> None:
    with tempfile.TemporaryDirectory() as tmp_dir:
        module = self.config_module
        old_session_secret = module.os.environ.get("HAPPYTOKEN_SESSION_SECRET")
        old_frontend_base_url = module.os.environ.get("HAPPYTOKEN_FRONTEND_BASE_URL")
        try:
            module.os.environ["HAPPYTOKEN_SESSION_SECRET"] = "env-session-secret"
            module.os.environ["HAPPYTOKEN_FRONTEND_BASE_URL"] = "https://env.example.com"

            store = module.ConfigStore(Path(tmp_dir) / "config.json")

            self.assertEqual(store.session_secret, "")
            self.assertEqual(store.public_app_url, "")
            self.assertEqual(store.frontend_base_url, "")
        finally:
            for key, value in {
                "HAPPYTOKEN_SESSION_SECRET": old_session_secret,
                "HAPPYTOKEN_FRONTEND_BASE_URL": old_frontend_base_url,
            }.items():
                if value is None:
                    module.os.environ.pop(key, None)
                else:
                    module.os.environ[key] = value
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
python -m pytest test/test_config.py -q
```

Expected: failures because `ConfigStore` has no `storage_backend` argument and storage backends do not expose runtime config methods.

- [ ] **Step 3: Extend the storage interface**

In `happyimage-api/services/storage/base.py`, add:

```python
    @abstractmethod
    def load_runtime_config(self) -> dict[str, Any]:
        """Load admin-managed runtime configuration."""
        pass

    @abstractmethod
    def save_runtime_config(self, config: dict[str, Any]) -> None:
        """Persist admin-managed runtime configuration."""
        pass
```

- [ ] **Step 4: Implement JSON runtime config storage**

In `happyimage-api/services/storage/json_storage.py`, update the constructor to accept `runtime_config_path` and add:

```python
    def load_runtime_config(self) -> dict[str, Any]:
        if not self.runtime_config_path.exists():
            return {}
        try:
            data = json.loads(self.runtime_config_path.read_text(encoding="utf-8"))
        except Exception:
            return {}
        return data if isinstance(data, dict) else {}

    def save_runtime_config(self, config: dict[str, Any]) -> None:
        self.runtime_config_path.parent.mkdir(parents=True, exist_ok=True)
        self.runtime_config_path.write_text(
            json.dumps(config, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
```

Set `self.runtime_config_path = runtime_config_path` in `__init__`.

- [ ] **Step 5: Implement database runtime config storage**

In `happyimage-api/services/storage/database_storage.py`, add a model:

```python
class RuntimeConfigModel(Base):
    """Single-row runtime configuration."""
    __tablename__ = "runtime_config"

    key = Column(String(255), primary_key=True)
    data = Column(Text, nullable=False)
```

Add methods to `DatabaseStorageBackend`:

```python
    def load_runtime_config(self) -> dict[str, Any]:
        session = self.Session()
        try:
            row = session.query(RuntimeConfigModel).filter_by(key="default").first()
            if row is None:
                return {}
            data = json.loads(row.data)
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}
        finally:
            session.close()

    def save_runtime_config(self, config: dict[str, Any]) -> None:
        session = self.Session()
        try:
            row = session.query(RuntimeConfigModel).filter_by(key="default").first()
            payload = json.dumps(config, ensure_ascii=False)
            if row is None:
                row = RuntimeConfigModel(key="default", data=payload)
                session.add(row)
            else:
                row.data = payload
            session.commit()
        except Exception as exc:
            session.rollback()
            raise exc
        finally:
            session.close()
```

- [ ] **Step 6: Implement Git runtime config storage**

In `happyimage-api/services/storage/git_storage.py`, add a `runtime_config_file_path` constructor argument:

```python
    def __init__(
        self,
        repo_url: str,
        token: str,
        branch: str = "main",
        file_path: str = "accounts.json",
        auth_keys_file_path: str = "auth_keys.json",
        runtime_config_file_path: str = "runtime_config.json",
        local_cache_dir: Path | None = None,
    ):
        self.repo_url = repo_url
        self.token = token
        self.branch = branch
        self.file_path = file_path
        self.auth_keys_file_path = auth_keys_file_path
        self.runtime_config_file_path = runtime_config_file_path
```

Add runtime config methods:

```python
    def load_runtime_config(self) -> dict[str, Any]:
        data = self._load_json_value(self.runtime_config_file_path)
        return data if isinstance(data, dict) else {}

    def save_runtime_config(self, config: dict[str, Any]) -> None:
        self._save_json_file(
            self.runtime_config_file_path,
            dict(config or {}),
            "Update runtime config",
        )
```

- [ ] **Step 7: Pass config paths from the factory**

In `happyimage-api/services/storage/factory.py`, pass `data_dir / "runtime_config.json"` to JSON storage and `"runtime_config.json"` to Git storage:

```python
return JSONStorageBackend(file_path, auth_keys_path, data_dir / "runtime_config.json")
```

For Git:

```python
runtime_config_file_path = os.getenv("GIT_RUNTIME_CONFIG_FILE_PATH", "runtime_config.json").strip()
auth_keys_file_path = os.getenv("GIT_AUTH_KEYS_FILE_PATH", "auth_keys.json").strip()

return GitStorageBackend(
    repo_url=repo_url,
    token=token,
    branch=branch,
    file_path=file_path,
    auth_keys_file_path=auth_keys_file_path,
    runtime_config_file_path=runtime_config_file_path,
    local_cache_dir=cache_dir,
)
```

- [ ] **Step 8: Move ConfigStore to storage-backed data**

In `happyimage-api/services/config.py`, update `ConfigStore.__init__`:

```python
class ConfigStore:
    def __init__(self, path: Path, storage_backend: StorageBackend | None = None):
        self.path = path
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._storage_backend = storage_backend
        self.data = self._load()
```

Update `_load` and `_save`:

```python
    def _load(self) -> dict[str, object]:
        if self._storage_backend is not None:
            return self._storage_backend.load_runtime_config()
        return _read_json_object(self.path, name="config.json")

    def _save(self) -> None:
        if self._storage_backend is not None:
            self._storage_backend.save_runtime_config(self.data)
            return
        self.path.write_text(json.dumps(self.data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
```

At module bottom, initialize storage first:

```python
config_storage_backend = None
config = ConfigStore(CONFIG_FILE)
```

Then in `get_storage_backend`, when creating the storage backend, update `config._storage_backend` and reload `config.data` once:

```python
            self._storage_backend = create_storage_backend(DATA_DIR)
            if self is config:
                self.data = self._load()
```

This keeps existing import order stable and lets tests pass explicit storage directly.

- [ ] **Step 9: Add normalized URL and gateway properties**

In `happyimage-api/services/config.py`, add:

```python
def _normalize_url(value: object) -> str:
    return str(value or "").strip().rstrip("/")

def _normalize_gateway_api_url(value: object) -> str:
    base = _normalize_url(value)
    if not base:
        return ""
    return base if base.endswith("/v1") else f"{base}/v1"

def _derive_gateway_management_url(api_url: str) -> str:
    normalized = _normalize_url(api_url)
    return normalized.removesuffix("/v1")
```

Add `public_app_url`, `api_public_url`, and `external_api_url` properties. Keep old property names as compatibility aliases:

```python
    @property
    def public_app_url(self) -> str:
        return _normalize_url(self.data.get("public_app_url") or self.data.get("frontend_base_url"))

    @property
    def api_public_url(self) -> str:
        return _normalize_url(self.data.get("api_public_url") or self.data.get("api_base_url"))

    @property
    def external_api_url(self) -> str:
        return self.api_public_url or self.public_app_url

    @property
    def frontend_base_url(self) -> str:
        return self.public_app_url

    @property
    def api_base_url(self) -> str:
        return self.external_api_url
```

Change `cors_origins` to:

```python
    @property
    def cors_origins(self) -> list[str]:
        config_origins = self.data.get("cors_origins")
        if isinstance(config_origins, list) and config_origins:
            return [str(origin).strip().rstrip("/") for origin in config_origins if str(origin).strip()]
        return [self.public_app_url] if self.public_app_url else []
```

- [ ] **Step 10: Normalize model gateway settings**

Replace `get_newapi_binding_settings` with:

```python
    def get_model_gateway_settings(self) -> dict[str, object]:
        source = self.data.get("model_gateway") if isinstance(self.data.get("model_gateway"), dict) else {}
        api_url = _normalize_gateway_api_url(
            source.get("gateway_api_base_url")
            or source.get("base_url")
            or "https://gateway.happy-token.cn/v1"
        )
        management_url = _normalize_url(source.get("gateway_management_url") or source.get("management_url"))
        if not management_url:
            management_url = _derive_gateway_management_url(api_url)
        sql_dsn = str(source.get("sql_dsn") or "").strip()
        provision_url = str(source.get("provision_url") or "").strip()
        provision_secret = str(source.get("provision_secret") or "").strip()
        token_name = (str(source.get("token_name") or "").strip() or "HappyImage Default")[:80]
        return {
            "gateway_api_base_url": api_url,
            "gateway_management_url": management_url,
            "base_url": api_url,
            "management_url": management_url,
            "sql_dsn": sql_dsn,
            "sql_dsn_configured": bool(sql_dsn),
            "provision_url": provision_url,
            "provision_secret": provision_secret,
            "provision_secret_configured": bool(provision_secret),
            "token_name": token_name,
            "enabled": bool((provision_url and provision_secret) or sql_dsn),
        }

    def get_newapi_binding_settings(self) -> dict[str, object]:
        return self.get_model_gateway_settings()
```

- [ ] **Step 11: Run config tests**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
python -m pytest test/test_config.py -q
```

Expected: all config tests pass.

- [ ] **Step 12: Commit**

Run:

```bash
git -C /Users/forever/workspace/HappyImage/happyimage-api add services/storage/base.py services/storage/json_storage.py services/storage/database_storage.py services/storage/git_storage.py services/storage/factory.py services/config.py test/test_config.py
git -C /Users/forever/workspace/HappyImage/happyimage-api commit -m "feat: store runtime settings in configured storage"
```

---

### Task 2: Setup APIs And Admin Recovery Login

**Files:**
- Modify: `happyimage-api/api/system.py`
- Modify: `happyimage-api/api/support.py`
- Modify: `happyimage-api/services/auth_service.py`
- Test: `happyimage-api/test/test_setup_api.py`

- [ ] **Step 1: Add setup API tests**

Create `happyimage-api/test/test_setup_api.py`:

```python
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from fastapi.testclient import TestClient


class SetupAPITests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.data_dir = Path(self.tmp.name)

    def make_client(self):
        from services import config as config_module
        from services.storage.json_storage import JSONStorageBackend
        from services.auth_service import AuthService
        import api.support as support_module
        import api.system as system_module
        import api.app as app_module

        storage = JSONStorageBackend(
            self.data_dir / "accounts.json",
            self.data_dir / "auth_keys.json",
            self.data_dir / "runtime_config.json",
        )
        test_config = config_module.ConfigStore(self.data_dir / "config.json", storage_backend=storage)
        test_auth = AuthService(storage)

        patches = [
            mock.patch.object(config_module, "config", test_config),
            mock.patch.object(support_module, "config", test_config),
            mock.patch.object(system_module, "config", test_config),
            mock.patch.object(system_module, "auth_service", test_auth),
        ]
        for patcher in patches:
            patcher.start()
            self.addCleanup(patcher.stop)
        return TestClient(app_module.create_app())

    def test_setup_status_open_when_no_admin_exists(self) -> None:
        client = self.make_client()

        response = client.get("/api/setup/status")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["setup_required"], True)

    def test_setup_creates_first_admin_and_settings(self) -> None:
        client = self.make_client()

        response = client.post(
            "/api/setup",
            json={
                "admin_name": "Owner",
                "admin_key": "owner-secret-key",
                "public_app_url": "https://image.example.com",
                "session_secret": "session-secret-with-at-least-32-characters",
                "oidc": {
                    "enabled": True,
                    "issuer": "https://auth.example.com",
                    "client_id": "happyimage",
                    "client_secret": "oidc-secret",
                    "scopes": "openid profile email",
                    "allowed_email_domains": "",
                },
                "model_gateway": {
                    "gateway_api_base_url": "https://gateway.happy-token.cn/v1",
                    "gateway_management_url": "",
                    "token_name": "HappyImage Default",
                },
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["ok"], True)
        self.assertEqual(body["setup_required"], False)
        self.assertEqual(body["config"]["public_app_url"], "https://image.example.com")
        self.assertEqual(body["config"]["oidc"]["client_secret_configured"], True)
        self.assertEqual(body["admin"]["role"], "admin")

        second = client.post("/api/setup", json={"admin_name": "Other", "admin_key": "second-secret"})
        self.assertEqual(second.status_code, 403)

    def test_admin_key_login_works_when_oidc_is_unavailable(self) -> None:
        client = self.make_client()
        client.post(
            "/api/setup",
            json={
                "admin_name": "Owner",
                "admin_key": "owner-secret-key",
                "public_app_url": "https://image.example.com",
                "session_secret": "session-secret-with-at-least-32-characters",
                "oidc": {"enabled": False},
                "model_gateway": {"gateway_api_base_url": "https://gateway.happy-token.cn/v1"},
            },
        )

        response = client.post(
            "/api/auth/admin-key-login",
            json={"key": "owner-secret-key"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["role"], "admin")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
python -m pytest test/test_setup_api.py -q
```

Expected: failures because setup routes, JSON storage constructor, and admin key login are not implemented yet.

- [ ] **Step 3: Add setup request models**

In `happyimage-api/api/system.py`, add:

```python
class SetupRequest(BaseModel):
    admin_name: str = ""
    admin_key: str = ""
    public_app_url: str = ""
    api_public_url: str = ""
    session_secret: str = ""
    oidc: dict[str, object] = {}
    model_gateway: dict[str, object] = {}


class AdminKeyLoginRequest(BaseModel):
    key: str = ""
```

- [ ] **Step 4: Add setup helper functions**

In `happyimage-api/api/system.py`, add:

```python
def _admin_exists() -> bool:
    return bool(auth_service.list_keys("admin"))


def _setup_status_payload() -> dict[str, object]:
    return {
        "ok": True,
        "setup_required": not _admin_exists(),
        "storage": config.get_storage_backend().get_backend_info(),
    }


def _normalize_setup_config(body: SetupRequest) -> dict[str, object]:
    public_app_url = body.public_app_url.strip().rstrip("/")
    if public_app_url and not public_app_url.startswith(("http://", "https://")):
        raise ValueError("公开应用地址必须以 http:// 或 https:// 开头")
    session_secret = body.session_secret.strip()
    if len(session_secret) < 32:
        raise ValueError("Session Secret 至少需要 32 个字符")
    return {
        "public_app_url": public_app_url,
        "api_public_url": body.api_public_url.strip().rstrip("/"),
        "session_secret": session_secret,
        "oidc": body.oidc,
        "model_gateway": body.model_gateway,
    }
```

- [ ] **Step 5: Add setup routes**

Inside `create_router` in `happyimage-api/api/system.py`, before auth user management routes, add:

```python
    @router.get("/api/setup/status")
    async def get_setup_status():
        return _setup_status_payload()

    @router.post("/api/setup")
    async def complete_setup(body: SetupRequest):
        if _admin_exists():
            raise HTTPException(status_code=403, detail={"error": "初始化已完成"})
        admin_key = body.admin_key.strip()
        if len(admin_key) < 8:
            raise HTTPException(status_code=400, detail={"error": "管理员密钥至少需要 8 个字符"})
        try:
            next_config = _normalize_setup_config(body)
            config_response = config.update(next_config)
            admin = await run_in_threadpool(
                auth_service.create_key_with_value,
                role="admin",
                name=body.admin_name.strip() or "管理员",
                key=admin_key,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
        return {
            "ok": True,
            "setup_required": False,
            "admin": admin,
            "config": config_response,
        }
```

- [ ] **Step 6: Add admin key recovery login route**

Inside `create_router`, add:

```python
    @router.post("/api/auth/admin-key-login")
    async def admin_key_login(request: Request, body: AdminKeyLoginRequest):
        _check_auth_rate_limit(request, "admin_key_login", "admin")
        key = body.key.strip()
        if not key:
            raise HTTPException(status_code=400, detail={"error": "请输入管理员密钥"})
        identity = auth_service.authenticate(key)
        if identity is None or identity.get("role") != "admin":
            raise HTTPException(status_code=401, detail={"error": "管理员密钥无效"})
        return _auth_login_response(identity, key, app_version)
```

- [ ] **Step 7: Run setup API tests**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
python -m pytest test/test_setup_api.py -q
```

Expected: all setup API tests pass.

- [ ] **Step 8: Commit**

Run:

```bash
git -C /Users/forever/workspace/HappyImage/happyimage-api add api/system.py api/support.py services/auth_service.py test/test_setup_api.py
git -C /Users/forever/workspace/HappyImage/happyimage-api commit -m "feat: add first setup and admin recovery login"
```

---

### Task 3: Use Unified Settings In OIDC, Sessions, And NewAPI Binding

**Files:**
- Modify: `happyimage-api/services/config.py`
- Modify: `happyimage-api/services/oidc_service.py`
- Modify: `happyimage-api/api/auth_oidc.py`
- Modify: `happyimage-api/services/newapi_binding_service.py`
- Modify: `happyimage-api/services/web_session_service.py`
- Test: `happyimage-api/test/test_oidc_login.py`
- Test: `happyimage-api/test/test_newapi_binding_service.py`

- [ ] **Step 1: Update OIDC and NewAPI tests**

In `happyimage-api/test/test_newapi_binding_service.py`, change environment-based settings tests to pass explicit settings:

```python
service = NewAPIBindingService(
    settings={
        "enabled": True,
        "gateway_api_base_url": "https://gateway.happy-token.cn/v1",
        "gateway_management_url": "https://gateway.happy-token.cn",
        "base_url": "https://gateway.happy-token.cn/v1",
        "management_url": "https://gateway.happy-token.cn",
        "provision_url": "http://newapi:3000/api/internal/happyimage/bind-token",
        "provision_secret": "secret",
        "token_name": "HappyImage Default",
        "sql_dsn": "",
    },
    session_factory=session_factory,
)
```

Add this assertion to the SQL fallback test:

```python
self.assertEqual(result["base_url"], "https://gateway.happy-token.cn/v1")
self.assertEqual(result["management_url"], "https://gateway.happy-token.cn")
```

In `happyimage-api/test/test_oidc_login.py`, replace `HAPPYTOKEN_FRONTEND_BASE_URL` and `HAPPYTOKEN_API_BASE_URL` patches with config updates:

```python
config.update(
    {
        "public_app_url": "https://web.example.com",
        "api_public_url": "https://api.example.com",
        "session_secret": "oidc-session-secret",
        "oidc": {
            "enabled": True,
            "issuer": "https://issuer.example",
            "client_id": "happytoken",
            "client_secret": "secret",
            "scopes": "openid profile email",
            "allowed_email_domains": "",
        },
    }
)
```

- [ ] **Step 2: Run tests to verify failures**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
python -m pytest test/test_oidc_login.py test/test_newapi_binding_service.py -q
```

Expected: failures until OIDC and binding services use the unified settings consistently.

- [ ] **Step 3: Remove environment reads from OIDC normalization**

In `happyimage-api/services/config.py`, change `_normalize_oidc_settings` to:

```python
def _normalize_oidc_settings(value: object) -> dict[str, object]:
    source = value if isinstance(value, dict) else {}
    return {
        "enabled": _normalize_bool(source.get("enabled"), False),
        "issuer": str(source.get("issuer") or "").strip().rstrip("/"),
        "client_id": str(source.get("client_id") or "").strip(),
        "client_secret": str(source.get("client_secret") or "").strip(),
        "scopes": str(source.get("scopes") or "openid profile email").strip(),
        "allowed_email_domains": str(source.get("allowed_email_domains") or "").strip(),
    }
```

- [ ] **Step 4: Update NewAPI binding setting names**

In `happyimage-api/services/newapi_binding_service.py`, set URL variables from unified names first:

```python
base_url = self._normalize_url(
    settings.get("gateway_api_base_url") or settings.get("base_url"),
    default=DEFAULT_NEWAPI_URL,
)
model_base_url = self._normalize_model_base_url(base_url)
management_url = self._normalize_url(
    settings.get("gateway_management_url") or settings.get("management_url"),
    default=self._normalize_management_url(base_url),
)
```

Add helper:

```python
    @staticmethod
    def _normalize_management_url(value: object) -> str:
        return _clean(value).rstrip("/").removesuffix("/v1")
```

- [ ] **Step 5: Update OIDC callback URL resolution**

In `happyimage-api/api/auth_oidc.py`, update `_request_external_base_url`:

```python
def _request_external_base_url(request: Request) -> str:
    configured = config.external_api_url
    if configured:
        return configured
    return f"{request.url.scheme}://{request.headers.get('host', request.url.netloc)}"
```

Keep the callback path unchanged.

- [ ] **Step 6: Update session cookie secure/domain behavior**

In `happyimage-api/services/web_session_service.py`, replace `_cookie_uses_secure` with:

```python
    @staticmethod
    def _cookie_uses_secure() -> bool:
        return config.external_api_url.startswith("https://") or config.public_app_url.startswith("https://")
```

- [ ] **Step 7: Run OIDC and binding tests**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
python -m pytest test/test_oidc_login.py test/test_newapi_binding_service.py -q
```

Expected: all selected tests pass.

- [ ] **Step 8: Commit**

Run:

```bash
git -C /Users/forever/workspace/HappyImage/happyimage-api add services/config.py services/oidc_service.py api/auth_oidc.py services/newapi_binding_service.py services/web_session_service.py test/test_oidc_login.py test/test_newapi_binding_service.py
git -C /Users/forever/workspace/HappyImage/happyimage-api commit -m "refactor: use admin runtime settings for auth and gateway"
```

---

### Task 4: Web Setup And Settings UI

**Files:**
- Modify: `happyimage-web/src/lib/api.ts`
- Create: `happyimage-web/src/app/setup/page.tsx`
- Modify: `happyimage-web/src/app/login/page.tsx`
- Modify: `happyimage-web/src/app/settings/store.ts`
- Modify: `happyimage-web/src/app/settings/components/config-card.tsx`

- [ ] **Step 1: Add setup and normalized settings API types**

In `happyimage-web/src/lib/api.ts`, add:

```ts
export type ModelGatewaySettings = {
  gateway_api_base_url: string;
  gateway_management_url: string;
  provision_url?: string;
  provision_secret?: string;
  provision_secret_configured?: boolean;
  sql_dsn?: string;
  sql_dsn_configured?: boolean;
  token_name: string;
  enabled?: boolean;
};

export type SetupStatusResponse = {
  ok: boolean;
  setup_required: boolean;
  storage?: Record<string, unknown>;
};

export type SetupPayload = {
  admin_name: string;
  admin_key: string;
  public_app_url: string;
  api_public_url?: string;
  session_secret: string;
  oidc: OIDCSettings;
  model_gateway: ModelGatewaySettings;
};

export async function fetchSetupStatus() {
  return httpRequest<SetupStatusResponse>("/api/setup/status", {
    redirectOnUnauthorized: false,
  });
}

export async function completeSetup(payload: SetupPayload) {
  return httpRequest<{ ok: boolean; setup_required: boolean; config: SettingsConfig }>("/api/setup", {
    method: "POST",
    body: payload,
    redirectOnUnauthorized: false,
  });
}

export async function loginWithAdminKey(key: string) {
  return httpRequest<LoginResponse>("/api/auth/admin-key-login", {
    method: "POST",
    body: { key },
    redirectOnUnauthorized: false,
  });
}
```

Extend `SettingsConfig`:

```ts
  public_app_url?: string;
  api_public_url?: string;
  external_api_url?: string;
  model_gateway?: ModelGatewaySettings;
```

- [ ] **Step 2: Create first setup page**

Create `happyimage-web/src/app/setup/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { completeSetup, fetchSetupStatus, type SetupPayload } from "@/lib/api";

const initialPayload: SetupPayload = {
  admin_name: "管理员",
  admin_key: "",
  public_app_url: "",
  api_public_url: "",
  session_secret: "",
  oidc: {
    enabled: false,
    issuer: "",
    client_id: "",
    client_secret: "",
    scopes: "openid profile email",
    allowed_email_domains: "",
  },
  model_gateway: {
    gateway_api_base_url: "https://gateway.happy-token.cn/v1",
    gateway_management_url: "https://gateway.happy-token.cn",
    token_name: "HappyImage Default",
    provision_url: "",
    provision_secret: "",
    sql_dsn: "",
  },
};

export default function SetupPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [payload, setPayload] = useState<SetupPayload>(initialPayload);

  useEffect(() => {
    void fetchSetupStatus()
      .then((status) => {
        if (!status.setup_required) router.replace("/login");
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "检查初始化状态失败"))
      .finally(() => setIsChecking(false));
  }, [router]);

  const save = async () => {
    setIsSaving(true);
    try {
      await completeSetup(payload);
      toast.success("初始化完成");
      router.replace("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "初始化失败");
    } finally {
      setIsSaving(false);
    }
  };

  if (isChecking) {
    return <div className="grid min-h-screen place-items-center"><LoaderCircle className="size-5 animate-spin text-stone-400" /></div>;
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-6 text-stone-950">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-normal">初始化 HappyImage</h1>
          <p className="mt-1 text-sm text-stone-500">创建第一个管理员，并保存登录授权与模型网关设置。</p>
        </header>
        <section className="grid gap-4 rounded-lg border border-stone-200 bg-white p-5">
          <Input placeholder="管理员名称" value={payload.admin_name} onChange={(event) => setPayload({ ...payload, admin_name: event.target.value })} />
          <Input placeholder="管理员密钥" type="password" value={payload.admin_key} onChange={(event) => setPayload({ ...payload, admin_key: event.target.value })} />
          <Input placeholder="公开应用地址，例如 https://image.example.com" value={payload.public_app_url} onChange={(event) => setPayload({ ...payload, public_app_url: event.target.value })} />
          <Input placeholder="Session Secret，至少 32 个字符" type="password" value={payload.session_secret} onChange={(event) => setPayload({ ...payload, session_secret: event.target.value })} />
        </section>
        <section className="grid gap-4 rounded-lg border border-stone-200 bg-white p-5">
          <label className="flex items-center gap-3 text-sm font-medium"><Checkbox checked={payload.oidc.enabled} onCheckedChange={(checked) => setPayload({ ...payload, oidc: { ...payload.oidc, enabled: Boolean(checked) } })} />启用 OIDC/OAuth 登录</label>
          <Input placeholder="Issuer" value={payload.oidc.issuer} onChange={(event) => setPayload({ ...payload, oidc: { ...payload.oidc, issuer: event.target.value } })} />
          <Input placeholder="Client ID" value={payload.oidc.client_id} onChange={(event) => setPayload({ ...payload, oidc: { ...payload.oidc, client_id: event.target.value } })} />
          <Input placeholder="Client Secret" type="password" value={payload.oidc.client_secret || ""} onChange={(event) => setPayload({ ...payload, oidc: { ...payload.oidc, client_secret: event.target.value } })} />
        </section>
        <section className="grid gap-4 rounded-lg border border-stone-200 bg-white p-5">
          <Input placeholder="模型网关 API 地址" value={payload.model_gateway.gateway_api_base_url} onChange={(event) => setPayload({ ...payload, model_gateway: { ...payload.model_gateway, gateway_api_base_url: event.target.value } })} />
          <Input placeholder="模型网关管理地址" value={payload.model_gateway.gateway_management_url} onChange={(event) => setPayload({ ...payload, model_gateway: { ...payload.model_gateway, gateway_management_url: event.target.value } })} />
          <Input placeholder="NewAPI SQL DSN" type="password" value={payload.model_gateway.sql_dsn || ""} onChange={(event) => setPayload({ ...payload, model_gateway: { ...payload.model_gateway, sql_dsn: event.target.value } })} />
        </section>
        <div className="flex justify-end">
          <Button onClick={() => void save()} disabled={isSaving}>
            {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            保存并完成初始化
          </Button>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Add admin key recovery to login page**

In `happyimage-web/src/app/login/page.tsx`, import `Input`, `loginWithAdminKey`, and auth storage setter:

```tsx
import { Input } from "@/components/ui/input";
import { loginWithAdminKey } from "@/lib/api";
import { setStoredAuthSession } from "@/store/auth";
```

Add state:

```tsx
const [adminKey, setAdminKey] = useState("");
const [isAdminKeySubmitting, setIsAdminKeySubmitting] = useState(false);
```

Add handler:

```tsx
const handleAdminKeyLogin = async () => {
  setIsAdminKeySubmitting(true);
  try {
    const data = await loginWithAdminKey(adminKey);
    await setStoredAuthSession({
      key: data.access_token || adminKey,
      role: data.role,
      subjectId: data.subject_id,
      name: data.name,
      watermarkLabel: data.watermark_label || "",
      watermarkUnlocked: Boolean(data.watermark_unlocked),
      modelProvider: data.model_provider || "",
      modelBaseUrl: data.model_base_url || "",
      modelApiKeyConfigured: Boolean(data.model_api_key_configured),
      modelGatewayEnabled: Boolean(data.model_gateway_enabled),
      modelProviders: [],
      preferences: {},
    });
    window.location.href = "/settings";
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "管理员密钥登录失败");
  } finally {
    setIsAdminKeySubmitting(false);
  }
};
```

Render a compact recovery section below the OIDC button:

```tsx
<div className="space-y-3 border-t border-stone-100 pt-5">
  <Input
    type="password"
    placeholder="管理员恢复密钥"
    value={adminKey}
    onChange={(event) => setAdminKey(event.target.value)}
  />
  <Button type="button" variant="outline" className="h-11 w-full rounded-lg" disabled={isAdminKeySubmitting} onClick={() => void handleAdminKeyLogin()}>
    {isAdminKeySubmitting ? <LoaderCircle className="size-4 animate-spin" /> : <LogIn className="size-4" />}
    使用管理员密钥进入设置
  </Button>
</div>
```

- [ ] **Step 4: Extend settings store defaults**

In `happyimage-web/src/app/settings/store.ts`, add:

```ts
function defaultModelGateway(): ModelGatewaySettings {
  return {
    gateway_api_base_url: "https://gateway.happy-token.cn/v1",
    gateway_management_url: "https://gateway.happy-token.cn",
    provision_url: "",
    provision_secret: "",
    provision_secret_configured: false,
    sql_dsn: "",
    sql_dsn_configured: false,
    token_name: "HappyImage Default",
    enabled: false,
  };
}
```

In `normalizeConfig`, include:

```ts
    public_app_url: String(config.public_app_url || config.frontend_base_url || ""),
    api_public_url: String(config.api_public_url || config.api_base_url || ""),
    model_gateway: {
      ...defaultModelGateway(),
      ...(typeof config.model_gateway === "object" && config.model_gateway ? config.model_gateway as ModelGatewaySettings : {}),
    },
```

Add setters:

```ts
  setConfigField: (key: keyof SettingsConfig, value: string | boolean | number) => void;
  setModelGatewayField: (key: keyof ModelGatewaySettings, value: string | boolean) => void;
```

Implement:

```ts
  setConfigField: (key, value) => {
    set((state) => state.config ? { config: { ...state.config, [key]: value } } : {});
  },
  setModelGatewayField: (key, value) => {
    set((state) => state.config ? {
      config: {
        ...state.config,
        model_gateway: {
          ...(state.config.model_gateway || defaultModelGateway()),
          [key]: value,
        },
      },
    } : {});
  },
```

- [ ] **Step 5: Add settings UI sections**

In `happyimage-web/src/app/settings/components/config-card.tsx`, read new setters:

```tsx
const setConfigField = useSettingsStore((state) => state.setConfigField);
const setOIDCField = useSettingsStore((state) => state.setOIDCField);
const setModelGatewayField = useSettingsStore((state) => state.setModelGatewayField);
```

Add sections before "图片任务":

```tsx
<section className="space-y-4">
  <div>
    <h2 className="text-lg font-semibold tracking-tight text-stone-950">站点地址</h2>
    <p className="mt-1 text-sm text-stone-500">普通部署只需要填写公开应用地址。</p>
  </div>
  <div className="grid gap-4 md:grid-cols-2">
    <Input value={String(config?.public_app_url || "")} onChange={(event) => setConfigField("public_app_url", event.target.value)} placeholder="https://image.example.com" className="h-10 rounded-xl border-stone-200 bg-white" />
    <Input value={String(config?.api_public_url || "")} onChange={(event) => setConfigField("api_public_url", event.target.value)} placeholder="API 独立域名，可留空" className="h-10 rounded-xl border-stone-200 bg-white" />
  </div>
</section>

<section className="space-y-4 border-t border-stone-100 pt-5">
  <div>
    <h2 className="text-lg font-semibold tracking-tight text-stone-950">登录授权</h2>
    <p className="mt-1 text-sm text-stone-500">配置 OAuth/OIDC 登录。</p>
  </div>
  <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700">
    <Checkbox checked={Boolean(config?.oidc?.enabled)} onCheckedChange={(checked) => setOIDCField("enabled", Boolean(checked))} />
    启用 OIDC 登录
  </label>
  <div className="grid gap-4 md:grid-cols-2">
    <Input value={String(config?.oidc?.issuer || "")} onChange={(event) => setOIDCField("issuer", event.target.value)} placeholder="Issuer" className="h-10 rounded-xl border-stone-200 bg-white" />
    <Input value={String(config?.oidc?.client_id || "")} onChange={(event) => setOIDCField("client_id", event.target.value)} placeholder="Client ID" className="h-10 rounded-xl border-stone-200 bg-white" />
    <Input value={String(config?.oidc?.client_secret || "")} onChange={(event) => setOIDCField("client_secret", event.target.value)} placeholder={config?.oidc?.client_secret_configured ? "已配置，留空表示不修改" : "Client Secret"} className="h-10 rounded-xl border-stone-200 bg-white" />
    <Input value={String(config?.oidc?.scopes || "openid profile email")} onChange={(event) => setOIDCField("scopes", event.target.value)} placeholder="openid profile email" className="h-10 rounded-xl border-stone-200 bg-white" />
  </div>
</section>

<section className="space-y-4 border-t border-stone-100 pt-5">
  <div>
    <h2 className="text-lg font-semibold tracking-tight text-stone-950">模型网关</h2>
    <p className="mt-1 text-sm text-stone-500">用于默认 HappyToken/NewAPI 绑定和模型请求。</p>
  </div>
  <div className="grid gap-4 md:grid-cols-2">
    <Input value={String(config?.model_gateway?.gateway_api_base_url || "")} onChange={(event) => setModelGatewayField("gateway_api_base_url", event.target.value)} placeholder="https://gateway.happy-token.cn/v1" className="h-10 rounded-xl border-stone-200 bg-white" />
    <Input value={String(config?.model_gateway?.gateway_management_url || "")} onChange={(event) => setModelGatewayField("gateway_management_url", event.target.value)} placeholder="https://gateway.happy-token.cn" className="h-10 rounded-xl border-stone-200 bg-white" />
    <Input value={String(config?.model_gateway?.sql_dsn || "")} onChange={(event) => setModelGatewayField("sql_dsn", event.target.value)} placeholder={config?.model_gateway?.sql_dsn_configured ? "SQL DSN 已配置，留空表示不修改" : "NewAPI SQL DSN"} className="h-10 rounded-xl border-stone-200 bg-white" />
    <Input value={String(config?.model_gateway?.token_name || "HappyImage Default")} onChange={(event) => setModelGatewayField("token_name", event.target.value)} placeholder="HappyImage Default" className="h-10 rounded-xl border-stone-200 bg-white" />
  </div>
</section>
```

- [ ] **Step 6: Run Web unit/type checks**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-web
pnpm test:unit src/middleware.test.ts
pnpm exec tsc --noEmit
```

Expected: TypeScript reports unresolved `/v1/*` helper references in image workspace code. Those references are removed in Task 5.

- [ ] **Step 7: Commit**

Run:

```bash
git -C /Users/forever/workspace/HappyImage/happyimage-web add src/lib/api.ts src/app/setup/page.tsx src/app/login/page.tsx src/app/settings/store.ts src/app/settings/components/config-card.tsx
git -C /Users/forever/workspace/HappyImage/happyimage-web commit -m "feat: add setup and admin service settings UI"
```

---

### Task 5: Remove Web `/v1/*` Proxy And Frontend Calls

**Files:**
- Modify: `happyimage-web/src/middleware.ts`
- Modify: `happyimage-web/src/middleware.test.ts`
- Modify: `happyimage-web/src/lib/api.ts`
- Modify: `happyimage-web/src/app/image/page.tsx`

- [ ] **Step 1: Replace middleware tests**

Replace `happyimage-web/src/middleware.test.ts` with:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadMiddleware(env: Record<string, string>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  return import("./middleware");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("middleware proxy helpers", () => {
  it("does not proxy /v1 paths", async () => {
    const { shouldProxy } = await loadMiddleware({});

    expect(shouldProxy("/v1")).toBe(false);
    expect(shouldProxy("/v1/models")).toBe(false);
    expect(shouldProxy("/api/image-tasks")).toBe(true);
    expect(shouldProxy("/images/a.png")).toBe(true);
  });

  it("routes product paths to BACKEND_URL only", async () => {
    const { buildProxyUrl } = await loadMiddleware({
      BACKEND_URL: "http://127.0.0.1:8000",
      MODEL_BACKEND_URL: "http://127.0.0.1:3001",
    });

    expect(buildProxyUrl("/api/image-tasks", "?x=1")).toBe("http://127.0.0.1:8000/api/image-tasks?x=1");
    expect(buildProxyUrl("/images/a.png", "")).toBe("http://127.0.0.1:8000/images/a.png");
  });

  it("preserves product authorization headers", async () => {
    const { buildProxyHeaders } = await loadMiddleware({
      BACKEND_URL: "http://127.0.0.1:8000",
      MODEL_BACKEND_API_KEY: "sk-test",
    });

    const productHeaders = buildProxyHeaders(
      new Headers({ authorization: "Bearer user-token", host: "image.example.com" }),
    );

    expect(productHeaders.get("authorization")).toBe("Bearer user-token");
    expect(productHeaders.get("host")).toBeNull();
  });

  it("does not follow backend redirects so auth cookies survive callbacks", async () => {
    const { buildProxyFetchInit } = await loadMiddleware({
      BACKEND_URL: "http://127.0.0.1:8000",
    });

    const init = buildProxyFetchInit(
      {
        method: "GET",
        body: null,
      } as never,
      new Headers({ accept: "text/html" }),
    );

    expect(init.redirect).toBe("manual");
    expect(init.body).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run middleware tests to verify they fail**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-web
pnpm test:unit src/middleware.test.ts
```

Expected: failures because `shouldProxy` is not exported and `/v1/*` is still proxied.

- [ ] **Step 3: Simplify Web middleware**

In `happyimage-web/src/middleware.ts`, replace the top section and helpers with:

```ts
const BACKEND_BASE =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "");

const PROXY_PREFIXES = [
  "/api/",
  "/images/",
  "/image-thumbnails/",
  "/health",
] as const;
```

Export `shouldProxy`:

```ts
export function shouldProxy(pathname: string): boolean {
  return PROXY_PREFIXES.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`) ||
      pathname.startsWith(prefix),
  );
}
```

Replace `buildProxyUrl` and `buildProxyHeaders`:

```ts
export function buildProxyUrl(pathname: string, search: string) {
  if (!BACKEND_BASE) {
    return "";
  }
  return `${BACKEND_BASE}${pathname}${search}`;
}

export function buildProxyHeaders(incoming: Headers) {
  const headers = new Headers(incoming);
  for (const header of ["host", "connection", "content-length"]) {
    headers.delete(header);
  }
  return headers;
}
```

Update middleware call site:

```ts
const headers = buildProxyHeaders(request.headers);
```

Remove `/v1/:path*` from `config.matcher`.

- [ ] **Step 4: Remove `/v1/*` helpers from Web API client**

In `happyimage-web/src/lib/api.ts`, delete the complete function declarations whose signatures begin with:

```ts
export async function fetchModels()
export async function generateImage(
export async function editImage(
```

Keep `createImageGenerationTask` and `createImageEditTask`.

- [ ] **Step 5: Replace model loading in image page**

In `happyimage-web/src/app/image/page.tsx`, remove `fetchModels` from the import list and add this constant near the existing image model helpers:

```ts
const DEFAULT_IMAGE_MODELS = ["gpt-image-2", "codex-gpt-image-2"];
```

Replace the effect that calls `fetchModels()` with:

```ts
useEffect(() => {
  const providerModels = getSessionProviderImageModels(session);
  const available = mergeImageModels(providerModels, DEFAULT_IMAGE_MODELS);
  setImageModels(available);
  const storedModel =
    session?.preferences?.imageModel ||
    (typeof window !== "undefined"
      ? window.localStorage.getItem(IMAGE_MODEL_STORAGE_KEY)
      : null);
  setImageModel((current) => {
    if (available.includes(current)) {
      return current;
    }
    return normalizeStoredImageModel(storedModel, available);
  });
}, [session, session?.preferences?.imageModel]);
```

- [ ] **Step 6: Search for removed helpers**

Run:

```bash
cd /Users/forever/workspace/HappyImage
rg -n "fetchModels|generateImage\\(|editImage\\(|/v1/|MODEL_BACKEND|NEXT_PUBLIC_MODEL_API_BASE_URL" happyimage-web/src happyimage-web/README.md
```

Expected: no `happyimage-web/src` references except comments already being removed in this task.

- [ ] **Step 7: Run Web tests and type check**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-web
pnpm test:unit src/middleware.test.ts
pnpm exec tsc --noEmit
```

Expected: middleware tests pass and TypeScript reports no `/v1/*` helper errors.

- [ ] **Step 8: Commit**

Run:

```bash
git -C /Users/forever/workspace/HappyImage/happyimage-web add src/middleware.ts src/middleware.test.ts src/lib/api.ts src/app/image/page.tsx
git -C /Users/forever/workspace/HappyImage/happyimage-web commit -m "refactor: remove web v1 proxy path"
```

---

### Task 6: Remove API `/v1/*` Routes And Tests

**Files:**
- Modify: `happyimage-api/api/app.py`
- Delete: `happyimage-api/api/ai.py`
- Delete: `happyimage-api/test/test_v1_chat_completions.py`
- Delete: `happyimage-api/test/test_v1_responses.py`
- Delete: `happyimage-api/test/test_v1_images_edits.py`
- Delete: `happyimage-api/test/test_v1_messages.py`
- Delete: `happyimage-api/test/test_v1_images_generations.py`
- Modify docs that describe API `/v1/*` compatibility.

- [ ] **Step 1: Add a route removal test**

Create `happyimage-api/test/test_v1_routes_removed.py`:

```python
import unittest
from fastapi.testclient import TestClient

from api.app import create_app


class V1RoutesRemovedTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(create_app())

    def test_v1_models_is_not_registered(self) -> None:
        response = self.client.get("/v1/models", headers={"Authorization": "Bearer happytoken"})

        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
python -m pytest test/test_v1_routes_removed.py -q
```

Expected: failure because `/v1/models` still returns a route response.

- [ ] **Step 3: Stop registering API `/v1/*` routes**

In `happyimage-api/api/app.py`, remove `ai` from the import:

```python
from api import auth_oidc, image_conversations, image_tasks, seed_gallery, share_drafts, system
```

Remove:

```python
app.include_router(ai.create_router())
```

- [ ] **Step 4: Delete obsolete API v1 tests**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
git rm -f api/ai.py test/test_v1_chat_completions.py test/test_v1_responses.py test/test_v1_images_edits.py test/test_v1_messages.py test/test_v1_images_generations.py
```

Expected: the listed tracked files are staged for deletion. When a path is not tracked in this repository, remove that path from the command and rerun the same `git rm -f` command for the remaining tracked files.

- [ ] **Step 5: Search remaining API `/v1/*` references**

Run:

```bash
cd /Users/forever/workspace/HappyImage
rg -n "\"/v1|/v1/|OpenAI-compatible|MODEL_BACKEND" happyimage-api/api happyimage-api/services happyimage-api/test happyimage-api/docs happyimage-api/README.md
```

Expected code references after the route removal are limited to documentation and comments. Remove any remaining imports of `api.ai` or references to `openai_v1_models` from runtime code.

- [ ] **Step 6: Run API route removal and image task tests**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
python -m pytest test/test_v1_routes_removed.py test/test_image_tasks_api.py -q
```

Expected: route removal test and image task tests pass.

- [ ] **Step 7: Commit**

Run:

```bash
git -C /Users/forever/workspace/HappyImage/happyimage-api add api/app.py test/test_v1_routes_removed.py
git -C /Users/forever/workspace/HappyImage/happyimage-api commit -m "refactor: remove api v1 compatibility routes"
```

---

### Task 7: README, Compose, And Environment Cleanup

**Files:**
- Modify: `happyimage-web/README.md`
- Modify: `happyimage-web/Dockerfile`
- Modify: `happyimage-web/wrangler.jsonc`
- Modify: `deploy/hs/docker-compose.yml`
- Modify: `happyimage-api/docker-compose.yml`
- Modify: `happyimage-api/.env.example`
- Modify: `happyimage-api/config.example.json`
- Modify API docs that mention `MODEL_BACKEND_*` or `/v1/*`.

- [ ] **Step 1: Update Web README environment section**

In `happyimage-web/README.md`, replace the environment variable table with:

```md
| Variable | Required | Purpose |
| --- | --- | --- |
| `BACKEND_URL` | Production yes | Internal URL used by the Next.js middleware to proxy `/api/*`, `/images/*`, `/image-thumbnails/*`, and `/health` to HappyImage API. |
| `NEXT_PUBLIC_API_BASE_URL` | Usually no | Browser-direct API URL. Keep empty for same-origin middleware deployments. |
| `NEXT_PUBLIC_APP_VERSION` | No | Build-time display version. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | No | Contact email shown in the app. |
| `NEXT_PUBLIC_SUPPORT_WECHAT` | No | Contact WeChat shown in the app. |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID` | Upload scripts only | Used by seed-gallery upload scripts, not by the runtime app. |
```

Add an admin settings table:

```md
| Setting | Configured In |
| --- | --- |
| Public app URL, optional API public URL | `/setup` or admin `/settings` |
| Session secret and cookie settings | `/setup` or admin `/settings` |
| OAuth/OIDC issuer, client ID, client secret, scopes | `/setup` or admin `/settings` |
| Model gateway API URL and management URL | `/setup` or admin `/settings` |
| NewAPI automatic binding SQL DSN or provisioning secret | `/setup` or admin `/settings` |
| Outbound proxy, image storage, safety settings | admin `/settings` |
```

Add a removed variables table:

```md
| Removed variable | Replacement |
| --- | --- |
| `MODEL_BACKEND_URL` | Model gateway API URL in admin settings. |
| `MODEL_BACKEND_API_KEY` | User/default provider key managed by HappyImage API. |
| `NEXT_PUBLIC_MODEL_API_BASE_URL` | Removed with Web `/v1/*` proxying. |
| `HAPPYTOKEN_FRONTEND_BASE_URL` | `public_app_url` in admin settings. |
| `HAPPYTOKEN_API_BASE_URL` | Optional `api_public_url` in admin settings. |
| `HAPPYTOKEN_CORS_ORIGINS` | Derived from `public_app_url` unless explicitly set in admin settings. |
| `HAPPYTOKEN_NEWAPI_BASE_URL` | `gateway_api_base_url` in admin settings. |
| `HAPPYTOKEN_NEWAPI_MANAGEMENT_URL` | `gateway_management_url` in admin settings. |
```

- [ ] **Step 2: Remove `MODEL_BACKEND_*` from Web runtime config**

In `happyimage-web/Dockerfile`, remove:

```dockerfile
MODEL_BACKEND_URL=http://happytoken-api:80
```

In `deploy/hs/docker-compose.yml`, remove:

```yaml
MODEL_BACKEND_URL: "http://happytoken-api:80"
```

- [ ] **Step 3: Remove moved API runtime variables from examples**

In `happyimage-api/.env.example`, keep only infrastructure variables and comments pointing to setup:

```env
# Infrastructure only. Runtime service settings are configured in /setup or admin /settings.
STORAGE_BACKEND=postgres
DATABASE_URL=postgresql://user:password@localhost:5432/happytoken
```

In `happyimage-api/docker-compose.yml`, remove environment entries for:

```text
HAPPYTOKEN_BASE_URL
HAPPYTOKEN_REGISTRATION_ENABLED
HAPPYTOKEN_FRONTEND_BASE_URL
HAPPYTOKEN_API_BASE_URL
HAPPYTOKEN_CORS_ORIGINS
HAPPYTOKEN_SESSION_SECRET
HAPPYTOKEN_SESSION_COOKIE_NAME
HAPPYTOKEN_SESSION_MAX_AGE_SECONDS
HAPPYTOKEN_OIDC_ENABLED
HAPPYTOKEN_OIDC_ISSUER
HAPPYTOKEN_OIDC_CLIENT_ID
HAPPYTOKEN_OIDC_CLIENT_SECRET
HAPPYTOKEN_OIDC_SCOPES
HAPPYTOKEN_OIDC_ALLOWED_EMAIL_DOMAINS
```

Keep:

```yaml
STORAGE_BACKEND: ${STORAGE_BACKEND:-json}
DATABASE_URL: ${DATABASE_URL:-}
```

- [ ] **Step 4: Update `config.example.json` names**

In `happyimage-api/config.example.json`, replace old URL keys with:

```json
"public_app_url": "",
"api_public_url": "",
```

Replace `newapi_binding` or old NewAPI examples with:

```json
"model_gateway": {
  "gateway_api_base_url": "https://gateway.happy-token.cn/v1",
  "gateway_management_url": "https://gateway.happy-token.cn",
  "provision_url": "",
  "provision_secret": "",
  "sql_dsn": "",
  "token_name": "HappyImage Default"
}
```

- [ ] **Step 5: Search docs for removed variables**

Run:

```bash
cd /Users/forever/workspace/HappyImage
rg -n "MODEL_BACKEND|NEXT_PUBLIC_MODEL_API_BASE_URL|HAPPYTOKEN_FRONTEND_BASE_URL|HAPPYTOKEN_API_BASE_URL|HAPPYTOKEN_CORS_ORIGINS|HAPPYTOKEN_NEWAPI_BASE_URL|HAPPYTOKEN_NEWAPI_MANAGEMENT_URL|/v1/|OpenAI-compatible" happyimage-web/README.md happyimage-api/README.md happyimage-api/docs deploy/hs/docker-compose.yml happyimage-api/docker-compose.yml
```

Update remaining deployment instructions so they point to `/setup` or admin `/settings`. Keep `/v1` mentions only when describing the upstream NewAPI gateway URL value, such as `https://gateway.happy-token.cn/v1`.

- [ ] **Step 6: Run final focused checks**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-web
pnpm test:unit src/middleware.test.ts
pnpm exec tsc --noEmit

cd /Users/forever/workspace/HappyImage/happyimage-api
python -m pytest test/test_config.py test/test_setup_api.py test/test_oidc_login.py test/test_newapi_binding_service.py test/test_image_tasks_api.py -q
```

Expected: all selected checks pass.

- [ ] **Step 7: Commit Web documentation and deployment cleanup**

Run:

```bash
git -C /Users/forever/workspace/HappyImage/happyimage-web add README.md Dockerfile wrangler.jsonc
git -C /Users/forever/workspace/HappyImage/happyimage-web commit -m "docs: document simplified runtime configuration"
```

- [ ] **Step 8: Commit API documentation and deployment cleanup**

Run:

```bash
git -C /Users/forever/workspace/HappyImage/happyimage-api add README.md docs docker-compose.yml .env.example config.example.json
git -C /Users/forever/workspace/HappyImage/happyimage-api commit -m "docs: remove legacy runtime environment settings"
```

---

### Task 8: Final Integration Verification

**Files:**
- No planned source edits unless verification finds a regression.

- [ ] **Step 1: Run full Web checks**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-web
pnpm test:unit
pnpm exec tsc --noEmit
```

Expected: all unit tests pass and TypeScript completes without errors.

- [ ] **Step 2: Run API tests**

Run:

```bash
cd /Users/forever/workspace/HappyImage/happyimage-api
python -m pytest -q
```

Expected: all API tests pass and no `test/test_v1_*.py` files remain in the repository.

- [ ] **Step 3: Run environment reference audit**

Run:

```bash
cd /Users/forever/workspace/HappyImage
rg -n "MODEL_BACKEND|NEXT_PUBLIC_MODEL_API_BASE_URL|HAPPYTOKEN_OIDC_|HAPPYTOKEN_NEWAPI_|HAPPYTOKEN_FRONTEND_BASE_URL|HAPPYTOKEN_API_BASE_URL|HAPPYTOKEN_CORS_ORIGINS" happyimage-api happyimage-web deploy -g '!**/node_modules/**'
```

Expected: no runtime code references. Documentation references are allowed only in removed-variable migration tables.

- [ ] **Step 4: Check git status**

Run:

```bash
git -C /Users/forever/workspace/HappyImage/happyimage-web status --short
git -C /Users/forever/workspace/HappyImage/happyimage-api status --short
```

Expected: clean worktrees except for pre-existing unrelated user changes. The known pre-existing `happyimage-api/docker-compose.yml` modification must not be reverted.
