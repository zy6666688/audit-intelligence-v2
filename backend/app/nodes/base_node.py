"""
Base Node Infrastructure for Workflow Orchestration
Provides core patterns for DAG execution, state management, and idempotency
"""
import hashlib
import json
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, Optional, List, Tuple, Generator
from enum import Enum
import pandas as pd
import numpy as np


class NodeStatus(Enum):
    """Node execution status"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    COMPENSATED = "compensated"


class FailurePolicy(Enum):
    """How to handle node failures"""
    RETRY = "retry"
    SKIP = "skip"
    COMPENSATE = "compensate"
    ABORT_WORKFLOW = "abort_workflow"


@dataclass
class RetryPolicy:
    """Retry configuration for transient failures"""
    max_retries: int = 2
    backoff_type: str = "exponential"  # constant, exponential
    backoff_factor: float = 2.0
    retry_on_errors: List[str] = field(default_factory=lambda: ["TransientError"])


@dataclass
class NodeMetadata:
    """Node metadata for orchestration"""
    node_type: str
    version: str = "1.0.0"
    display_name: str = ""
    category: str = "general"
    tags: List[str] = field(default_factory=list)
    
    # Execution policies
    failure_policy: FailurePolicy = FailurePolicy.RETRY
    retry_policy: RetryPolicy = field(default_factory=RetryPolicy)
    timeout_seconds: int = 300
    max_memory_mb: int = 512
    
    # Resource requirements
    requires_gpu: bool = False
    requires_network: bool = False
    requires_human_review: bool = False
    
    # Data handling
    supports_streaming: bool = False
    chunk_size: int = 10000
    cache_results: bool = True


@dataclass
class ExecutionContext:
    """Runtime context passed to nodes during execution"""
    workflow_id: str
    run_id: str
    node_exec_id: str
    attempt_number: int = 0
    
    # Runtime info
    start_time: float = field(default_factory=time.time)
    deadline: Optional[float] = None
    
    # State and evidence
    state_store: Dict[str, Any] = field(default_factory=dict)
    evidence_refs: List[str] = field(default_factory=list)
    
    # AI/LLM context
    ai_budget_remaining: float = 1.0
    model_version: str = "gpt-4"
    
    # User context
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    
    def add_evidence(self, ref: str, description: str = ""):
        """Add evidence reference for audit trail"""
        self.evidence_refs.append({
            "ref": ref,
            "description": description,
            "timestamp": time.time()
        })


@dataclass
class NodeResult:
    """Result from node execution"""
    outputs: Dict[str, Any]
    status: NodeStatus = NodeStatus.SUCCESS
    
    # Execution metrics
    execution_time_ms: float = 0
    memory_used_mb: float = 0
    tokens_used: int = 0
    
    # Hashes for integrity
    input_hash: str = ""
    output_hash: str = ""
    
    # Audit trail
    logs: List[str] = field(default_factory=list)
    evidence_refs: List[str] = field(default_factory=list)
    error: Optional[str] = None
    
    # For streaming results
    is_streaming: bool = False
    stream_generator: Optional[Generator] = None


class BaseNode(ABC):
    """
    Base class for all workflow nodes
    Implements core patterns for orchestration
    """
    
    # Class-level configuration (override in subclasses)
    NODE_TYPE = "BaseNode"
    VERSION = "1.0.0"
    CATEGORY = "general"
    DISPLAY_NAME = "Base Node"
    
    # Input/output schema (override in subclasses)
    INPUT_TYPES = {}
    OUTPUT_TYPES = {}
    
    def __init__(self, metadata: Optional[NodeMetadata] = None):
        """Initialize node with metadata"""
        self.metadata = metadata or NodeMetadata(
            node_type=self.NODE_TYPE,
            version=self.VERSION,
            display_name=self.DISPLAY_NAME,
            category=self.CATEGORY
        )
        
    def generate_idempotency_key(self, inputs: Dict[str, Any], context: ExecutionContext) -> str:
        """
        Generate idempotency key for this execution
        Ensures same inputs + config = same key = skip re-execution
        """
        key_parts = [
            self.NODE_TYPE,
            self.VERSION,
            self._hash_inputs(inputs),
            context.workflow_id,
            # Don't include run_id to enable cross-run caching
        ]
        return hashlib.sha256("|".join(key_parts).encode()).hexdigest()
    
    def _hash_inputs(self, inputs: Dict[str, Any]) -> str:
        """Create deterministic hash of inputs"""
        # Handle different input types
        normalized = {}
        for key, value in inputs.items():
            if isinstance(value, pd.DataFrame):
                # Hash DataFrame structure and sample
                normalized[key] = {
                    "shape": value.shape,
                    "columns": list(value.columns),
                    "dtypes": str(value.dtypes.to_dict()),
                    "sample_hash": pd.util.hash_pandas_object(value.head(100)).sum()
                }
            elif isinstance(value, np.ndarray):
                normalized[key] = {
                    "shape": value.shape,
                    "dtype": str(value.dtype),
                    "data_hash": hashlib.sha256(value.tobytes()).hexdigest()
                }
            else:
                normalized[key] = value
                
        # Create stable JSON and hash it
        json_str = json.dumps(normalized, sort_keys=True, default=str)
        return hashlib.sha256(json_str.encode()).hexdigest()
    
    def _hash_outputs(self, outputs: Dict[str, Any]) -> str:
        """Create deterministic hash of outputs"""
        return self._hash_inputs(outputs)  # Same logic
    
    def validate_inputs(self, inputs: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Validate inputs against schema
        Returns (is_valid, error_message)
        """
        for key, type_info in self.INPUT_TYPES.items():
            required = type_info.get("required", True)
            if required and key not in inputs:
                return False, f"Missing required input: {key}"
                
            if key in inputs:
                expected_type = type_info.get("type")
                value = inputs[key]
                
                # Type checking
                if expected_type == "DATAFRAME" and not isinstance(value, pd.DataFrame):
                    return False, f"Input '{key}' must be a DataFrame"
                elif expected_type == "STRING" and not isinstance(value, str):
                    return False, f"Input '{key}' must be a string"
                elif expected_type == "INT" and not isinstance(value, (int, np.integer)):
                    return False, f"Input '{key}' must be an integer"
                elif expected_type == "FLOAT" and not isinstance(value, (float, int, np.number)):
                    return False, f"Input '{key}' must be a number"
                elif expected_type == "BOOLEAN" and not isinstance(value, bool):
                    return False, f"Input '{key}' must be a boolean"
                    
        return True, None
    
    def execute(self, inputs: Dict[str, Any], context: ExecutionContext) -> NodeResult:
        """
        Main execution wrapper with error handling and metrics
        """
        start_time = time.time()
        result = NodeResult(outputs={})
        
        # Record input hash
        result.input_hash = self._hash_inputs(inputs)
        
        # Validate inputs
        is_valid, error = self.validate_inputs(inputs)
        if not is_valid:
            result.status = NodeStatus.FAILED
            result.error = error
            return result
        
        try:
            # Check deadline
            if context.deadline and time.time() > context.deadline:
                raise TimeoutError("Node execution deadline exceeded")
            
            # Execute pure function (implemented by subclasses)
            outputs = self._execute_pure(inputs, context)
            
            # Handle streaming results
            if isinstance(outputs, Generator):
                result.is_streaming = True
                result.stream_generator = outputs
                result.outputs = {"stream": "streaming"}
            else:
                result.outputs = outputs
                result.output_hash = self._hash_outputs(outputs)
            
            result.status = NodeStatus.SUCCESS
            
        except Exception as e:
            result.status = NodeStatus.FAILED
            result.error = str(e)
            result.logs.append(f"Error: {e}")
            
        finally:
            # Record metrics
            result.execution_time_ms = (time.time() - start_time) * 1000
            result.evidence_refs = context.evidence_refs.copy()
            
        return result
    
    @abstractmethod
    def _execute_pure(self, inputs: Dict[str, Any], context: ExecutionContext) -> Dict[str, Any]:
        """
        Pure function implementation (no side effects)
        Override in subclasses
        """
        pass
    
    def compensate(self, original_inputs: Dict[str, Any], 
                   original_result: NodeResult, 
                   context: ExecutionContext) -> NodeResult:
        """
        Compensation logic for rollback scenarios
        Override in subclasses that need compensation
        """
        return NodeResult(
            outputs={},
            status=NodeStatus.COMPENSATED,
            logs=["No compensation logic implemented"]
        )
    
    def estimate_cost(self, inputs: Dict[str, Any]) -> Dict[str, float]:
        """
        Estimate execution cost (time, memory, AI tokens)
        Override for AI nodes
        """
        return {
            "time_seconds": 1.0,
            "memory_mb": 100,
            "ai_tokens": 0,
            "ai_cost_usd": 0.0
        }
    
    @classmethod
    def get_node_info(cls) -> Dict[str, Any]:
        """
        Get node metadata for UI/orchestrator
        """
        return {
            "node_type": cls.NODE_TYPE,
            "version": cls.VERSION,
            "category": cls.CATEGORY,
            "display_name": cls.DISPLAY_NAME,
            "input_types": cls.INPUT_TYPES,
            "output_types": cls.OUTPUT_TYPES,
            "metadata": {
                "supports_streaming": False,
                "requires_human_review": False,
                "is_deterministic": True
            }
        }
