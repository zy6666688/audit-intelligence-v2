from types import SimpleNamespace
import pytest

from app.core import registry_utils


def make_registry(mapping):
    return SimpleNamespace(node_mappings=mapping)


def test_validate_good_node():
    class GoodNode:
        INPUT_TYPES = {"df": "DATAFRAME", "flag": {"type": "BOOLEAN"}}
        RETURN_TYPES = ["DATAFRAME"]
        RETURN_NAMES = ["result"]

        def execute(self, inputs, context=None):
            return {}

    reg = make_registry({"GoodNode": GoodNode})
    errors, warnings, suggestions = registry_utils.validate_node_registry(reg)
    assert errors == []
    # no critical warnings for this well-formed node
    assert suggestions == []


def test_missing_input_and_legacy_function_and_return_mismatch():
    class MissingInputNode:
        RETURN_TYPES = ["DATAFRAME"]
        RETURN_NAMES = ["result"]

        def execute(self, inputs, context=None):
            return {}

    class LegacyNode:
        FUNCTION = "process"

        def process(self, inputs):
            return {}

    class BadReturnNode:
        INPUT_TYPES = {"a": "INT"}
        RETURN_TYPES = ["DATAFRAME", "STRING"]
        RETURN_NAMES = ["only_one"]

        def execute(self, inputs, context=None):
            return {}

    reg = make_registry({
        "MissingInputNode": MissingInputNode,
        "LegacyNode": LegacyNode,
        "BadReturnNode": BadReturnNode,
    })

    errors, warnings, suggestions = registry_utils.validate_node_registry(reg)

    # BadReturnNode should produce an error about mismatch
    assert any("RETURN_TYPES length" in e for e in errors)

    # MissingInputNode should produce a warning about missing INPUT_TYPES
    assert any("missing INPUT_TYPES" in w for w in warnings)

    # LegacyNode should produce a migration suggestion
    assert any(s["node"] == "LegacyNode" for s in suggestions)


