"""Read the shared image catalog without changing user tokens or providers."""
from __future__ import annotations

from copy import deepcopy
import json
import math
import os
import threading
import time
from urllib import request


class ImageModelCatalog:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._key: tuple[str, str] | None = None
        self._models: list[dict[str, object]] | None = None
        self._checked_at = None
        self._updated_at = None
        self._stale = True

    def get(self, settings: dict[str, object], fallback: list[dict[str, object]], *, refresh: bool = False) -> dict[str, object]:
        url = str(os.environ.get("HAPPYIMAGE_NEWAPI_INTERNAL_URL") or
                  settings.get("gateway_management_url") or settings.get("management_url") or
                  settings.get("gateway_api_base_url") or settings.get("base_url") or "").rstrip("/").removesuffix("/v1")
        group = str(settings.get("image_group") or "image").strip()
        key = (url, group)
        with self._lock:
            if key != self._key:
                self._key = key
                self._models = None
                self._checked_at = self._updated_at = None
                self._stale = True
            now = time.monotonic()
            # Bound manual refreshes too, so every page click cannot hit NewAPI.
            ttl = 5 if refresh else 15
            if self._checked_at is None or now - self._checked_at >= ttl:
                try:
                    models = self._fetch(url, group)
                except (OSError, ValueError, TypeError, OverflowError):
                    self._stale = True
                else:
                    self._models = models
                    self._updated_at = int(time.time())
                    self._stale = False
                self._checked_at = time.monotonic()
            return {
                "models": deepcopy(self._models if self._models is not None else fallback),
                "stale": self._stale,
                "updated_at": self._updated_at,
            }

    @staticmethod
    def _fetch(url: str, group: str) -> list[dict[str, object]]:
        if not url:
            raise ValueError("Missing catalog URL")
        req = request.Request(url + "/api/pricing", headers={"Accept": "application/json"})
        with request.urlopen(req, timeout=10) as response:
            raw = response.read(1024 * 1024 + 1)
        if len(raw) > 1024 * 1024:
            raise ValueError("Catalog too large")
        payload = json.loads(raw)
        if not isinstance(payload, dict) or payload.get("success") is not True or not isinstance(payload.get("data"), list):
            raise ValueError("Invalid catalog response")
        result = {}
        for item in payload["data"]:
            if not isinstance(item, dict):
                raise ValueError("Invalid catalog entry")
            groups = item.get("enable_groups", item.get("enable_group"))
            if not isinstance(groups, list):
                raise ValueError("Missing catalog groups")
            if group not in groups:
                continue
            model = str(item.get("model_name") or item.get("model") or "").strip()
            endpoints = item.get("supported_endpoint_types") or []
            if "image" not in model.lower() and not any(e in endpoints for e in ("image-generation", "image-edit")):
                continue
            quota_type = int(item.get("quota_type", 0))
            price = float(item.get("model_price", 0))
            if not model or quota_type not in (0, 1) or not math.isfinite(price) or price < 0:
                raise ValueError("Invalid catalog pricing")
            result[model] = {"model": model, "group": group,
                             "billing_type": "per_request" if quota_type == 1 else "usage",
                             "quota_type": quota_type, "price": price, "source": "newapi"}
        return [result[model] for model in sorted(result)]
