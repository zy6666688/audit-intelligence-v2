#!/usr/bin/env python3
"""
Simple CLI to run registry validation (used by CI pre-checks).
"""
import sys
import os

# Ensure repo root on path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.registry_utils import validate_registry_cli
from app.core.config import settings
import os, json

def _print_artifact_if_exists():
    artifact_path = getattr(settings, "REGISTRY_SUGGESTIONS_ARTIFACT_PATH", None)
    if artifact_path and os.path.exists(artifact_path):
        try:
            with open(artifact_path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            print("Registry suggestions artifact content:")
            print(json.dumps(data, ensure_ascii=False, indent=2))
        except Exception:
            print("Unable to read registry suggestions artifact")


def _enrich_artifact_with_metadata():
    """If artifact exists, enrich it with CI metadata (timestamp, commit, repo, run id)."""
    artifact_path = getattr(settings, "REGISTRY_SUGGESTIONS_ARTIFACT_PATH", None)
    if not artifact_path or not os.path.exists(artifact_path):
        return

    try:
        with open(artifact_path, "r", encoding="utf-8") as fh:
            payload = json.load(fh)
    except Exception:
        print("Unable to read registry suggestions artifact for enrichment")
        return

    meta = payload.get("metadata", {})
    # Add common CI env metadata if available
    meta.setdefault("timestamp", __import__("datetime").datetime.utcnow().isoformat() + "Z")
    for env_key in ("GITHUB_SHA", "GITHUB_REPOSITORY", "GITHUB_RUN_ID", "GITHUB_RUN_NUMBER", "GITHUB_REF", "CI"):
        val = os.getenv(env_key)
        if val:
            meta[env_key.lower()] = val

    payload["metadata"] = meta

    try:
        with open(artifact_path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
        print(f"Enriched registry suggestions artifact with metadata: {artifact_path}")
    except Exception as e:
        print(f"Failed to write enriched artifact: {e}")

if __name__ == "__main__":
    rc = validate_registry_cli()
    sys.exit(rc)


