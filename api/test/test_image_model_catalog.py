import json
from unittest.mock import patch, MagicMock
from services.image_model_catalog import ImageModelCatalog

SETTINGS = {"gateway_management_url": "https://gateway.example", "image_group": "image"}

def entry(name, groups=None, quota=1, price=0.007):
    return {"model_name": name, "enable_groups": groups if groups is not None else ["image"], "quota_type": quota, "model_price": price}

def response(items):
    result = MagicMock()
    result.__enter__.return_value.read.return_value = json.dumps({"success": True, "data": items}).encode()
    return result

def test_discovers_filters_and_preserves_billing(monkeypatch):
    monkeypatch.delenv("HAPPYIMAGE_NEWAPI_INTERNAL_URL", raising=False)
    with patch("services.image_model_catalog.request.urlopen", return_value=response([
        entry("gpt-image-2.5-flare"), entry("codex-gpt-image-2.5-sunburst", price=0.0139), entry("gpt-image-1", quota=0, price=0), entry("chat-model"), entry("other-image", groups=["default"]),
    ])):
        result = ImageModelCatalog().get(SETTINGS, [])
    assert [m["model"] for m in result["models"]] == ["codex-gpt-image-2.5-sunburst", "gpt-image-1", "gpt-image-2.5-flare"]
    assert result["models"][0]["price"] == 0.0139
    assert result["models"][1]["billing_type"] == "usage"
    assert result["stale"] is False

def test_ttl_refresh_removal_and_outage_retains_empty_success():
    catalog = ImageModelCatalog()
    with patch.object(catalog, "_fetch", side_effect=[[{"model": "new"}], [], OSError("offline")]) as fetch, patch("services.image_model_catalog.time.monotonic", return_value=0) as clock:
        first = catalog.get(SETTINGS, [])
        clock.return_value = 10
        assert catalog.get(SETTINGS, []) == first
        assert fetch.call_count == 1
        assert catalog.get(SETTINGS, [], refresh=True)["models"] == []
        clock.return_value = 91
        result = catalog.get(SETTINGS, [{"model": "old"}])
        assert result["models"] == []
        assert result["stale"] is True

def test_failed_refresh_preserves_success_and_cache_is_not_mutable():
    catalog = ImageModelCatalog()
    with patch.object(catalog, "_fetch", side_effect=[[{"model": "new"}], ValueError()]), patch("services.image_model_catalog.time.monotonic", return_value=0) as clock:
        result = catalog.get(SETTINGS, [])
        result["models"][0]["model"] = "modified"
        clock.return_value = 61
        stale = catalog.get(SETTINGS, [])
        assert stale["models"] == [{"model": "new"}]
        assert stale["stale"] is True

def test_internal_url_and_empty_group_authoritative(monkeypatch):
    monkeypatch.setenv("HAPPYIMAGE_NEWAPI_INTERNAL_URL", "http://newapi:3000")
    with patch("services.image_model_catalog.request.urlopen", return_value=response([])) as fetch:
        result = ImageModelCatalog().get(SETTINGS, [{"model": "old"}])
    assert fetch.call_args.args[0].full_url == "http://newapi:3000/api/pricing"
    assert result["models"] == []
    assert not result["stale"]

def test_invalid_payload_and_group_changes():
    catalog = ImageModelCatalog()
    with patch("services.image_model_catalog.request.urlopen", return_value=response([{"model_name": "bad"}])):
        result = catalog.get(SETTINGS, [{"model": "fallback"}])
    assert result["stale"]
    assert result["models"] == [{"model": "fallback"}]
    with patch.object(catalog, "_fetch", side_effect=OSError()):
        result = catalog.get({**SETTINGS, "image_group": "other"}, [])
    assert result["models"] == []

def test_endpoint_requires_auth_and_disables_browser_cache():
    from fastapi import FastAPI, HTTPException
    from fastapi.testclient import TestClient
    import api.auth_oidc as routes
    app = FastAPI()
    app.include_router(routes.create_router())
    with patch.object(routes, "resolve_identity_for_request", side_effect=HTTPException(401)), patch.object(routes.newapi_binding_service, "get_image_model_catalog") as catalog:
        assert TestClient(app).get('/api/auth/image-models').status_code == 401
        catalog.assert_not_called()
    result = {"models": [], "stale": False, "updated_at": 1}
    with patch.object(routes, "resolve_identity_for_request", return_value={"id": "user"}), patch.object(routes.newapi_binding_service, "get_image_model_catalog", return_value=result) as catalog:
        res = TestClient(app).get('/api/auth/image-models?refresh=true')
        assert res.status_code == 200
        assert res.json() == result
        assert res.headers['cache-control'] == 'private, no-store'
        catalog.assert_called_once_with(refresh=True)
