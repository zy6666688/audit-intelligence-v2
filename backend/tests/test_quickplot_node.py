import json
import pandas as pd
from app.nodes.viz_nodes import QuickPlotNode
from app.core.config import settings
from app.nodes.base_node import ExecutionContext


def test_quickplot_metadata_and_sample_persistence(tmp_path):
    settings.STORAGE_PATH = str(tmp_path)
    # create dataframe
    df = pd.DataFrame({
        "date": pd.date_range("2025-01-01", periods=2000, freq="D"),
        "value": list(range(2000))
    })
    node = QuickPlotNode()
    ctx = ExecutionContext(workflow_id="wf_qp", run_id="run_qp", node_exec_id="qp")
    res = node.execute({
        "dataframe": df,
        "chart_type": "line",
        "x_column": "date",
        "y_column": "value",
        "include_metadata": True,
        "persist_sample": True,
        "sample_strategy": "reservoir",
        "sample_seed": 123
    }, ctx)
    assert res.status.name == "SUCCESS"

    # Check echarts_option output
    out_json = res.outputs.get("echarts_option")
    assert out_json is not None
    opt = json.loads(out_json)
    # The echarts_option should contain the wrapped structure {option, _metadata}
    assert "option" in opt and "_metadata" in opt

    # Check qp_metadata output - this is the primary metadata source
    meta = res.outputs.get("qp_metadata")
    assert meta is not None
    assert isinstance(meta, dict)
    assert meta.get("sample_count") is not None and meta.get("total_count") == 2000

    sample_path = meta.get("sample_path")
    assert sample_path is not None
    # persisted file exists
    import os
    assert os.path.exists(sample_path)
    # sample file contains rows and indices
    with open(sample_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert "sample_indices" in data and "rows" in data
    assert len(data["rows"]) == meta["sample_count"]

    # Verify metadata consistency between JSON and separate output
    json_meta = opt["_metadata"]
    assert json_meta == meta


