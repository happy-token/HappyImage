import pytest

from services.image_model_health import ImageModelHealth


def identity(user="u", key="test-key", provider="newapi-default"):
    return {"id": user, "model_base_url": "https://example.invalid/v1", "model_api_key": key,
            "model_providers": [{"id": provider, "selected": True, "group": "image"}]}


def test_mode_and_credentials_are_isolated(tmp_path):
    health = ImageModelHealth(tmp_path / "health.json")
    health.record(identity(), "m", "edit", RuntimeError("unsupported model"))
    with pytest.raises(ValueError):
        health.require_available(identity(), "m", "edit")
    for user in (identity("other"), identity(key="changed"), identity(provider="custom")):
        assert health.get(user, "m", "edit")["status"] == "unknown"
    assert health.get(identity(), "m", "generate")["status"] == "unknown"
    assert ImageModelHealth(health.path).get(identity(), "m", "edit")["status"] == "unavailable"
    assert "test-key" not in health.path.read_text()


def test_cooldown_is_unknown_not_success(tmp_path, monkeypatch):
    monkeypatch.setattr("services.image_model_health.time.time", lambda: 1000)
    health = ImageModelHealth(tmp_path / "health.json")
    health.record(identity(), "m", "generate", RuntimeError("模型供应商响应超时"))
    assert health.get(identity(), "m", "generate")["status"] == "unavailable"
    monkeypatch.setattr("services.image_model_health.time.time", lambda: 1120)
    assert health.get(identity(), "m", "generate")["status"] == "unknown"
    health.require_available(identity(), "m", "generate")
    health.record(identity(), "m", "generate")
    assert health.get(identity(), "m", "generate")["status"] == "available"


@pytest.mark.parametrize("message", ["额度不足", "invalid api key", "content_policy_violation", "invalid size", "disk full"])
def test_account_prompt_and_local_errors_do_not_disable(tmp_path, message):
    health = ImageModelHealth(tmp_path / "health.json")
    health.record(identity(), "m", "generate", RuntimeError(message))
    assert health.get(identity(), "m", "generate")["status"] == "unknown"


def test_catalog_annotation_does_not_change_cached_models(tmp_path):
    health = ImageModelHealth(tmp_path / "health.json")
    catalog = {"models": [{"model": "m"}], "stale": False}
    result = health.annotate(identity(), catalog)
    assert "availability" not in catalog["models"][0]
    assert result["models"][0]["availability"]["edit"]["status"] == "unknown"
