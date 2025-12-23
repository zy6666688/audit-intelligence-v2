#!/usr/bin/env python3
"""
Generate conservative mapping suggestions for workflow edges that couldn't be
statically inferred. Produces a JSON artifact listing suggested mappings per workflow.
"""
import json
import os
import glob
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.graph_normalizer import normalize_workflow_format, infer_input_name_from_slot
from app.core.registry import node_registry
from app.core.config import settings


def get_required_inputs_for_node(node_class):
    if not node_class:
        return []
    if hasattr(node_class, "INPUT_TYPES"):
        it = getattr(node_class, "INPUT_TYPES")
        try:
            input_types = it() if callable(it) else it
        except Exception:
            input_types = it
        if isinstance(input_types, dict):
            if "required" in input_types or "optional" in input_types:
                return list(input_types.get("required", {}).keys())
            return list(input_types.keys())
    return []


def build_suggestions_for_file(path):
    with open(path, "r", encoding="utf-8") as fh:
        wf = json.load(fh)

    nodes_by_id = {n.get("id"): n for n in wf.get("nodes", [])}
    edges = wf.get("edges", []) or []
    incoming = {}
    for e in edges:
        incoming.setdefault(e.get("to"), []).append(e)

    suggestions = []

    # build current inputs map from node params
    for nid, node in nodes_by_id.items():
        class_name = node.get("type") or node.get("class_type")
        node_class = node_registry.get_node_class(class_name)
        required = get_required_inputs_for_node(node_class)
        params = node.get("params", {}) or {}
        incoming_edges = incoming.get(nid, [])

        # For each incoming edge, check if it likely maps to a parameter; if not, propose mapping
        for e in incoming_edges:
            to_slot = e.get("to_slot", 0)
            # try infer param name from slot
            inferred = infer_input_name_from_slot(node_class, to_slot) if node_class else None
            suggested = None
            reason = ""
            if inferred and inferred not in params:
                suggested = {"to_param": inferred, "from": e.get("from"), "from_slot": e.get("from_slot", 0)}
                reason = "Inferred param name from node signature/INPUT_TYPES"
            else:
                # fallback: find first required that's not present
                missing = [r for r in required if r not in params]
                if missing:
                    suggested = {"to_param": missing[0], "from": e.get("from"), "from_slot": e.get("from_slot", 0)}
                    reason = "Fallback: assign to first missing required input"
                else:
                    # no clear target; suggest manual mapping using to_slot
                    suggested = None
                    reason = "No missing required inputs and unable to infer; manual review recommended"

            suggestions.append({
                "workflow": os.path.basename(path),
                "node_id": nid,
                "node_class": class_name,
                "edge": e,
                "inferred_param": inferred,
                "suggested_mapping": suggested,
                "reason": reason,
            })

    return suggestions


def main():
    wf_dir = os.path.join(os.path.dirname(__file__), "..", "workflows")
    files = glob.glob(os.path.join(wf_dir, "*.json"))
    if not files:
        print("No workflows found")
        return 0

    all_suggestions = []
    for f in files:
        s = build_suggestions_for_file(f)
        if s:
            all_suggestions.extend(s)
            print(f"Found {len(s)} suggestions for {os.path.basename(f)}")

    artifact_dir = os.path.join(os.path.dirname(__file__), "..", "ci_artifacts")
    os.makedirs(artifact_dir, exist_ok=True)
    artifact_path = os.path.join(artifact_dir, "workflow_mapping_suggestions.json")
    with open(artifact_path, "w", encoding="utf-8") as fh:
        json.dump({"suggestions": all_suggestions}, fh, ensure_ascii=False, indent=2)

    print("Wrote suggestions to", artifact_path)
    return 0


if __name__ == "__main__":
    rc = main()
    sys.exit(rc)


