#!/usr/bin/env python3
"""
Auto-map workflow edges to node required inputs using a conservative heuristic.
This script updates workflow JSON presets in place, assigning incoming edges to
missing required inputs in order of appearance. It writes a brief report to stdout.
"""
import json
import os
import glob
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.graph_normalizer import normalize_workflow_format
from app.core.registry import node_registry


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


def auto_map_file(path):
    with open(path, "r", encoding="utf-8") as fh:
        wf = json.load(fh)

    nodes_by_id = {n.get("id"): n for n in wf.get("nodes", [])}
    edges = wf.get("edges", []) or []

    # incoming edges per target node (preserve order)
    incoming = {}
    for e in edges:
        to = e.get("to")
        incoming.setdefault(to, []).append(e)

    changes = []

    for nid, node in nodes_by_id.items():
        class_name = node.get("type") or node.get("class_type")
        node_class = node_registry.get_node_class(class_name)
        required = get_required_inputs_for_node(node_class)
        params = node.get("params", {}) or {}

        # compute missing required inputs
        missing = [r for r in required if r not in params]
        if not missing:
            continue

        available_edges = incoming.get(nid, []).copy()
        assigned = {}
        used_edges = set()
        # assign edges to missing inputs in order
        for r in missing:
            if not available_edges:
                break
            e = available_edges.pop(0)
            frm = e.get("from")
            from_slot = e.get("from_slot", 0)
            # record mapping as [from_id, from_slot]
            params[r] = [frm, from_slot]
            assigned[r] = [frm, from_slot]
            used_edges.add((frm, nid, from_slot, e.get("to_slot", 0)))

        if assigned:
            node["params"] = params
            changes.append({"node": nid, "class": class_name, "assigned": assigned})

    if changes:
        # backup original
        bak = path + ".bak"
        if not os.path.exists(bak):
            os.rename(path, bak)
        # write updated file
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(wf, fh, ensure_ascii=False, indent=2)

    return changes


def main():
    wf_dir = os.path.join(os.path.dirname(__file__), "..", "workflows")
    files = glob.glob(os.path.join(wf_dir, "*.json"))
    if not files:
        print("No workflow presets found in backend/workflows")
        return 0

    total_changes = 0
    for f in files:
        print("Processing", os.path.basename(f))
        changes = auto_map_file(f)
        if changes:
            total_changes += len(changes)
            print(" Applied mappings for", len(changes), "nodes:")
            for c in changes:
                print("  -", c["node"], c["class"], "assigned:", c["assigned"])
        else:
            print(" No mappings applied")

    print("Total node mappings applied:", total_changes)
    return 0


if __name__ == "__main__":
    rc = main()
    sys.exit(rc)


