"""
Registry validation utilities.
Used at startup and in CI to ensure node mappings are well-formed.
"""
from typing import Tuple, List, Dict, Any, Optional
import logging
import json
import os
from app.core.registry import node_registry
from app.core.config import settings

logger = logging.getLogger(__name__)

# Candidate method names considered valid for execution
DEFAULT_EXEC_METHOD_CANDIDATES = [
    "execute",
    "run",
    "FUNCTION",  # placeholder - handled via getattr on class
    "generate_result",
    "export_report",
    "export_report_result",
    "save_result",
    "convert_to_table",
    "preview_result",
]

# Known/simple type names used for INPUT_TYPES / RETURN_TYPES validation
# KNOWN_INPUT_TYPES moved into settings for configurability
KNOWN_INPUT_TYPES = set(t.upper() for t in getattr(settings, "REGISTRY_VALIDATION_KNOWN_INPUT_TYPES", []))


def _format_suggestion(node_name: str, reason: str, suggestion: str) -> Dict[str, str]:
    return {"node": node_name, "reason": reason, "suggestion": suggestion}


def validate_node_registry(registry: Optional[Any] = None) -> Tuple[List[str], List[str], List[Dict[str, str]]]:
    """
    Validate node_registry mappings.
    Returns (errors, warnings, suggestions) where suggestions is a list of dicts with migration hints.
    """
    if registry is None:
        registry = node_registry

    errors: List[str] = []
    warnings: List[str] = []
    suggestions: List[Dict[str, str]] = []

    for name, cls in registry.node_mappings.items():
        if cls is None:
            errors.append(f"Node '{name}' mapped to None")
            continue

        # Check class type / executable method presence
        try:
            has_function = False
            # Preferred function name from class attribute
            preferred = getattr(cls, "FUNCTION", None)
            if preferred and hasattr(cls, preferred):
                has_function = True
            # other candidates: method on class
            for cand in ("execute", "run", "generate_result", "export_report", "export_report_result", "save_result", "convert_to_table", "preview_result"):
                if hasattr(cls, cand):
                    has_function = True
                    break

            if not has_function:
                errors.append(f"Node '{name}' class {cls.__name__} has no executable method (expected one of FUNCTION/execute/run/export_report/...)")
        except Exception as e:
            errors.append(f"Node '{name}' class introspection failed: {e}")

        # Check INPUT_TYPES format
        input_types = getattr(cls, "INPUT_TYPES", None)
        if input_types is None:
            # not mandatory but recommend presence
            warnings.append(f"Node '{name}' ({cls.__name__}) missing INPUT_TYPES (recommended)")
        else:
            # validate common shapes: dict {name: type|string} or dict {name: {\"type\": TYPE, ...}}
            if isinstance(input_types, dict):
                for k, v in input_types.items():
                    # allow either string like "DATAFRAME" or dict with 'type' key
                    if isinstance(v, str):
                        if v.upper() not in KNOWN_INPUT_TYPES:
                            warnings.append(f"Node '{name}' INPUT_TYPES key '{k}' has unknown type '{v}'")
                    elif isinstance(v, dict):
                        t = v.get("type")
                        if not t or (isinstance(t, str) and t.upper() not in KNOWN_INPUT_TYPES):
                            warnings.append(f"Node '{name}' INPUT_TYPES key '{k}' has invalid/missing 'type' field")
                    else:
                        warnings.append(f"Node '{name}' INPUT_TYPES key '{k}' has unexpected value type {type(v).__name__}")
            elif callable(input_types):
                # can't safely call arbitrary callables during validation; warn about non-standard shape
                warnings.append(f"Node '{name}' INPUT_TYPES is callable; ensure it returns a mapping of input definitions")
            else:
                warnings.append(f"Node '{name}' INPUT_TYPES has unexpected type {type(input_types).__name__}")

        # Check RETURN_TYPES / RETURN_NAMES consistency
        ret_types = getattr(cls, "RETURN_TYPES", None)
        ret_names = getattr(cls, "RETURN_NAMES", None)
        if ret_types is None and ret_names is None:
            warnings.append(f"Node '{name}' ({cls.__name__}) missing RETURN_TYPES/RETURN_NAMES (recommended)")
        else:
            if ret_types is not None and not isinstance(ret_types, (list, tuple)):
                warnings.append(f"Node '{name}' RETURN_TYPES should be a list/tuple, got {type(ret_types).__name__}")
            if ret_names is not None and not isinstance(ret_names, (list, tuple)):
                warnings.append(f"Node '{name}' RETURN_NAMES should be a list/tuple, got {type(ret_names).__name__}")
            if ret_types is not None and ret_names is not None:
                if len(ret_types) != len(ret_names):
                    errors.append(f"Node '{name}' RETURN_TYPES length ({len(ret_types)}) != RETURN_NAMES length ({len(ret_names)})")
                else:
                    # basic validation of types
                    for t in ret_types:
                        if isinstance(t, str) and t.upper() not in KNOWN_INPUT_TYPES:
                            warnings.append(f"Node '{name}' RETURN_TYPES contains unknown type '{t}'")

        # Detect legacy FUNCTION usage pattern and generate migration suggestion
        if hasattr(cls, "FUNCTION") and not hasattr(cls, "execute"):
            reason = "Uses legacy FUNCTION attribute without canonical 'execute' method"
            suggestion = ("Add an 'execute' method that wraps the legacy FUNCTION, "
                          "and declare RETURN_TYPES/RETURN_NAMES. Example:\n"
                          "def execute(self, inputs, context):\n"
                          "    return self.__class__.__dict__['FUNCTION'](self, inputs)")
            suggestions.append(_format_suggestion(name, reason, suggestion))

    return errors, warnings, suggestions


def validate_registry_cli() -> int:
    """
    CLI entrypoint: validates registry and prints results.
    Returns exit code 0 on success (no errors), 2 on warnings-only, 1 on errors.
    """
    result = validate_node_registry()
    # support both old (errors,warnings) and new (errors,warnings,suggestions) signatures
    if len(result) == 2:
        errors, warnings = result
        suggestions = []
    else:
        errors, warnings, suggestions = result

    if errors:
        print("Registry validation errors:")
        for e in errors:
            print("  -", e)
    if warnings:
        print("Registry validation warnings:")
        for w in warnings:
            print("  -", w)
    if suggestions:
        print("Registry migration suggestions (automated hints):")
        for s in suggestions:
            print(f"  - Node: {s.get('node')}")
            print(f"    Reason: {s.get('reason')}")
            print(f"    Suggestion: {s.get('suggestion')}")
        # Attempt to write suggestions to CI artifact path if configured
        artifact_path = getattr(settings, "REGISTRY_SUGGESTIONS_ARTIFACT_PATH", None)
        if artifact_path:
            try:
                os.makedirs(os.path.dirname(artifact_path), exist_ok=True)
                with open(artifact_path, "w", encoding="utf-8") as fh:
                    json.dump({"suggestions": suggestions}, fh, ensure_ascii=False, indent=2)
                print(f"Wrote registry suggestions to artifact: {artifact_path}")
            except Exception as e:
                print(f"Failed to write registry suggestions artifact: {e}")

    if errors:
        return 1
    if warnings or suggestions:
        return 2
    print("Registry validation passed: no errors or warnings")
    return 0

