#!/usr/bin/env python3
"""
List edges in workflow presets that cannot be statically mapped to node input names.
This helps surface which exact edges failed inference for manual review.
"""
import json
import os
import glob
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.graph_normalizer import infer_input_name_from_slot
from app.core.registry import node_registry


def main():
    wf_dir = os.path.join(os.path.dirname(__file__), "..", "workflows")
    files = glob.glob(os.path.join(wf_dir, "*.json"))
    if not files:
        print("No workflows found")
        return 0

    overall = []
    for f in files:
        with open(f, "r", encoding="utf-8") as fh:
            wf = json.load(fh)
        nodes = {n.get("id"): n for n in wf.get("nodes", [])}
        edges = wf.get("edges", []) or []
        unmapped = []
        for e in edges:
            to = e.get("to")
            to_slot = e.get("to_slot", 0)
            if not to or to not in nodes:
                continue
            class_name = nodes[to].get("type") or nodes[to].get("class_type")
            node_class = node_registry.get_node_class(class_name)
            inferred = infer_input_name_from_slot(node_class, to_slot) if node_class else None
            if not inferred:
                unmapped.append({"edge": e, "to_class": class_name, "inferred": None})
        overall.append({"workflow": os.path.basename(f), "unmapped_edges": unmapped})

    for o in overall:
        print("=" * 60)
        print("Workflow:", o["workflow"])
        if not o["unmapped_edges"]:
            print(" No unmapped edges")
            continue
        print(" Unmapped edges:")
        for u in o["unmapped_edges"]:
            print("  -", u["edge"], "to_class=", u["to_class"])

    return 0


if __name__ == "__main__":
    rc = main()
    sys.exit(rc)


