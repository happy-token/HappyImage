"""Compact persisted image task/conversation payloads.

Default mode is read-only. Use --write after reviewing the dry-run summary.
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.config import DATA_DIR, config
from services.image_conversation_store import create_image_conversation_store
from services.image_storage_service import image_storage_service
from services.image_task_store import create_image_task_store


def decode_image_data_url(value: str) -> bytes | None:
    prefix, separator, payload = str(value or "").partition(",")
    lowered = prefix.lower()
    if not separator or ";base64" not in lowered or not lowered.startswith("data:image/"):
        return None
    try:
        return base64.b64decode(payload, validate=True)
    except Exception:
        return None


def materialize(value: str, *, base_url: str, owner_id: str, write: bool) -> dict[str, str] | None:
    if not write:
        if not str(value or "").startswith("data:image/"):
            return None
        prefix, separator, _payload = str(value or "").partition(",")
        lowered = prefix.lower()
        if not separator or ";base64" not in lowered:
            return None
        return {
            "url": f"{base_url}/images/__compacted_dry_run__.png",
            "path": "__compacted_dry_run__.png",
            "storage": "local",
        }
    payload = decode_image_data_url(value)
    if payload is None:
        return None
    stored = image_storage_service.save(payload, base_url=base_url, owner_id=owner_id)
    return {"url": stored.url, "path": stored.rel, "storage": stored.storage}


def compact_image_item(item: dict[str, Any], *, base_url: str, owner_id: str, write: bool) -> bool:
    changed = False
    url = str(item.get("url") or "")
    b64_json = str(item.get("b64_json") or "")
    result = materialize(url, base_url=base_url, owner_id=owner_id, write=write) if url.startswith("data:image/") else None
    if result is None and b64_json:
        result = materialize(f"data:image/png;base64,{b64_json}", base_url=base_url, owner_id=owner_id, write=write)
    if result is not None:
        item.update(result)
        item.pop("b64_json", None)
        changed = True
    return changed


def compact_reference_item(item: dict[str, Any], *, base_url: str, owner_id: str, write: bool) -> bool:
    data_url = str(item.get("dataUrl") or item.get("data_url") or "")
    url = str(item.get("url") or "")
    source = data_url or (url if url.startswith("data:image/") else "")
    result = materialize(source, base_url=base_url, owner_id=owner_id, write=write) if source else None
    if result is None:
        return False
    item.update(result)
    item.pop("dataUrl", None)
    item.pop("data_url", None)
    return True


def compact_conversation(item: dict[str, Any], *, base_url: str, write: bool) -> int:
    owner_id = str(item.get("ownerId") or item.get("owner_id") or "").strip()
    changed = 0
    for turn in item.get("turns") or []:
        if not isinstance(turn, dict):
            continue
        for reference in turn.get("referenceImages") or []:
            if isinstance(reference, dict) and compact_reference_item(reference, base_url=base_url, owner_id=owner_id, write=write):
                changed += 1
        for image in turn.get("images") or []:
            if isinstance(image, dict) and compact_image_item(image, base_url=base_url, owner_id=owner_id, write=write):
                changed += 1
    return changed


def compact_task(item: dict[str, Any], *, base_url: str, write: bool) -> int:
    owner_id = str(item.get("owner_id") or "").strip()
    changed = 0
    for image in item.get("data") or []:
        if isinstance(image, dict) and compact_image_item(image, base_url=base_url, owner_id=owner_id, write=write):
            changed += 1
    return changed


def payload_size(items: list[dict[str, Any]]) -> int:
    return len(json.dumps(items, ensure_ascii=False).encode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Compact HappyImage task/conversation image payloads.")
    parser.add_argument("--write", action="store_true", help="persist compacted rows")
    parser.add_argument("--base-url", default=config.base_url, help="public base URL for generated image links")
    args = parser.parse_args()

    base_url = str(args.base_url or config.base_url).rstrip("/")

    conversation_store = create_image_conversation_store(DATA_DIR / "image_conversations.json")
    conversations = conversation_store.load_conversations()
    before_conversations = payload_size(conversations)
    changed_conversation_fields = sum(
        compact_conversation(item, base_url=base_url, write=args.write)
        for item in conversations
        if isinstance(item, dict)
    )
    after_conversations = payload_size(conversations)

    task_store = create_image_task_store(DATA_DIR / "image_tasks.json")
    tasks = task_store.load_tasks()
    before_tasks = payload_size(tasks)
    changed_task_fields = sum(
        compact_task(item, base_url=base_url, write=args.write)
        for item in tasks
        if isinstance(item, dict)
    )
    after_tasks = payload_size(tasks)

    print(
        "conversations: fields={} bytes_before={} bytes_after={} saved={}".format(
            changed_conversation_fields,
            before_conversations,
            after_conversations,
            before_conversations - after_conversations,
        )
    )
    print(
        "tasks: fields={} bytes_before={} bytes_after={} saved={}".format(
            changed_task_fields,
            before_tasks,
            after_tasks,
            before_tasks - after_tasks,
        )
    )
    if not args.write:
        print("dry-run only; re-run with --write to persist")
        return

    if changed_conversation_fields:
        conversation_store.save_changed_conversations(conversations)
    if changed_task_fields:
        task_store.save_tasks(tasks)
    print("compaction written")


if __name__ == "__main__":
    main()
