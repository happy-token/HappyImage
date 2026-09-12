"""Passive, credential-scoped image availability; refreshing never generates images."""
from __future__ import annotations

import hashlib
import json
import logging
import math
from pathlib import Path
import threading
import time

from services.config import DATA_DIR

logger = logging.getLogger(__name__)


def scope_for(identity: dict) -> str:
    # A custom provider or another user's quota must not disable the shared catalog.
    selected = next((p for p in identity.get("model_providers", [])
                     if isinstance(p, dict) and p.get("selected")), {})
    if selected.get("id") != "newapi-default":
        return ""
    values = [identity.get("id"), identity.get("model_base_url"),
              identity.get("model_api_key"), selected.get("group")]
    if not all(values[:3]):
        return ""
    return hashlib.sha256(json.dumps(values).encode()).hexdigest()


class ImageModelHealth:
    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.Lock()
        self.records: dict = {}
        try:
            data = json.loads(path.read_text())
            if isinstance(data, dict):
                self.records = {k: v for k, v in data.items()
                                if isinstance(k, str) and isinstance(v, dict)
                                and v.get("status") in ("available", "unavailable")
                                and isinstance(v.get("reason"), str)
                                and isinstance(v.get("expires_at"), (int, float))
                                and math.isfinite(v["expires_at"])}
        except FileNotFoundError:
            pass
        except (OSError, ValueError):
            logger.exception("Cannot load image model availability")

    @staticmethod
    def key(scope: str, model: str, mode: str) -> str:
        return json.dumps([scope, model, mode])

    def get(self, identity: dict, model: str, mode: str) -> dict:
        scope = scope_for(identity)
        with self.lock:
            record = dict(self.records.get(self.key(scope, model, mode), {})) if scope else {}
        if not record:
            return {"status": "unknown", "reason": "尚未验证"}
        if time.time() >= record["expires_at"]:
            return {**record, "status": "unknown", "reason": "等待下次实际调用验证"}
        return record

    def require_available(self, identity: dict, model: str, mode: str) -> None:
        state = self.get(identity, model, mode)
        if state["status"] == "unavailable":
            raise ValueError(f"{model} 暂不可用于{'编辑' if mode == 'edit' else '生成'}：{state['reason']}，请刷新模型列表或稍后重试")

    def record(self, identity: dict, model: str, mode: str, error: Exception | None = None) -> None:
        scope = scope_for(identity)
        if not scope:
            return
        status, reason, ttl = "available", "最近调用成功", 900
        if error is not None:
            message = str(error).lower()
            # Only recognized model/transport failures count. Authentication, balance,
            # content policy, invalid parameters and local storage failures do not.
            if any(s in message for s in ("额度", "余额", "api key", "quota", "balance", "401", "content_policy", "safety")):
                return
            if any(s in message for s in ("当前模型不可用", "model not found", "unsupported model", "无可用渠道", "no available channel", "unsupported endpoint", "endpoint not supported", "不支持图片编辑", "不支持图像编辑")):
                reason, ttl = "上游暂未提供此模型或操作", 300
            elif any(s in message for s in ("响应超时", "上游暂时不可用", "连接模型供应商失败", "timeout", "connection", "502", "503", "504", "没有返回图片", "no image", "no data")):
                reason, ttl = "上游暂时异常", 120
            else:
                return
            status = "unavailable"
        now = int(time.time())
        with self.lock:
            self.records = {k: v for k, v in self.records.items()
                            if isinstance(v, dict) and v.get("expires_at", 0) > now - 900}
            self.records[self.key(scope, model, mode)] = {
                "status": status, "reason": reason, "checked_at": now, "expires_at": now + ttl,
            }
            try:
                self.path.parent.mkdir(parents=True, exist_ok=True)
                temporary = self.path.with_suffix(".tmp")
                temporary.write_text(json.dumps(self.records, ensure_ascii=False))
                temporary.replace(self.path)
            except OSError:
                # A health-state write must not turn a successful paid image into a failure.
                logger.exception("Cannot persist image model availability")

    def annotate(self, identity: dict, catalog: dict) -> dict:
        return {**catalog, "models": [
            {**item, "availability": {mode: self.get(identity, item["model"], mode)
                                      for mode in ("generate", "edit")}}
            for item in catalog["models"]
        ]}


image_model_health = ImageModelHealth(Path(DATA_DIR) / "image_model_health.json")
