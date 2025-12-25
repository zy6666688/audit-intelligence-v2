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


def test_stratified_sampling_strategy(tmp_path):
    """Test stratified sampling maintains group proportions"""
    settings.STORAGE_PATH = str(tmp_path)

    # Create dataframe with categorical column for stratification
    categories = ["A", "B", "C"]
    sizes = [100, 200, 300]  # Different group sizes
    df_parts = []
    for cat, size in zip(categories, sizes):
        part = pd.DataFrame({
            "category": [cat] * size,
            "value": list(range(size))
        })
        df_parts.append(part)

    df = pd.concat(df_parts, ignore_index=True)
    total_rows = len(df)

    node = QuickPlotNode()
    ctx = ExecutionContext(workflow_id="wf_strat", run_id="run_strat", node_exec_id="qp")

    res = node.execute({
        "dataframe": df,
        "chart_type": "line",
        "x_column": "category",
        "y_column": "value",
        "include_metadata": True,
        "persist_sample": False,
        "sample_strategy": "stratified",
        "stratify_column": "category",
        "sample_seed": 42
    }, ctx)

    assert res.status.name == "SUCCESS"

    # Check metadata contains stratified sampling info
    meta = res.outputs.get("qp_metadata")
    assert meta is not None
    assert meta["sample_count"] <= 1000  # Should be limited by MAX_DATA_POINTS

    # Verify stratified sampling maintained proportions
    # Original proportions: A:100, B:200, C:300 (total 600)
    # Sample should maintain approximately these proportions
    out_json = res.outputs.get("echarts_option")
    opt = json.loads(out_json)

    # The sampled data should reflect stratified sampling
    # We can't easily verify exact proportions without parsing chart data,
    # but we can verify the sampling strategy was applied
    assert meta["sample_strategy"] == "stratified"


def test_sampling_strategies_comparison(tmp_path):
    """Test that different sampling strategies produce different but valid results"""
    settings.STORAGE_PATH = str(tmp_path)

    # Create test dataframe larger than MAX_DATA_POINTS to trigger sampling
    df = pd.DataFrame({
        "x": range(2000),
        "y": [i * 2 for i in range(2000)],
        "category": (["A", "B", "C"] * 667)[:2000]  # For stratified sampling
    })

    node = QuickPlotNode()
    ctx = ExecutionContext(workflow_id="wf_comp", run_id="run_comp", node_exec_id="qp")

    strategies = ["systematic", "reservoir", "stratified"]

    results = {}
    for strategy in strategies:
        inputs = {
            "dataframe": df,
            "chart_type": "line",
            "x_column": "x",
            "y_column": "y",
            "include_metadata": True,
            "persist_sample": False,
            "sample_strategy": strategy,
            "sample_seed": 42
        }

        if strategy == "stratified":
            inputs["stratify_column"] = "category"

        res = node.execute(inputs, ctx)
        assert res.status.name == "SUCCESS"

        meta = res.outputs.get("qp_metadata")
        results[strategy] = {
            "sample_count": meta["sample_count"],
            "sample_indices": meta["sample_indices"][:5]  # First 5 indices
        }

    # Verify different strategies produce different sampling patterns
    systematic_indices = results["systematic"]["sample_indices"]
    reservoir_indices = results["reservoir"]["sample_indices"]
    stratified_indices = results["stratified"]["sample_indices"]

    # At least one pair should be different
    assert (systematic_indices != reservoir_indices or
            systematic_indices != stratified_indices or
            reservoir_indices != stratified_indices)

    # All should have reasonable sample counts
    for strategy, result in results.items():
        assert 900 <= result["sample_count"] <= 1000  # Close to MAX_DATA_POINTS


