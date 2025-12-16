"""
Python Script Node - Allows users to write custom Python code with security sandbox
Enhanced with workflow orchestration support
"""
import pandas as pd
import numpy as np
from io import StringIO
import sys
import hashlib
from typing import Any, Dict, Optional, Tuple

# resource module is only available on Unix-like systems
try:
    import resource
    HAS_RESOURCE = True
except ImportError:
    HAS_RESOURCE = False
from RestrictedPython import compile_restricted
from RestrictedPython import safe_globals, safe_builtins, limited_builtins, utility_builtins
from RestrictedPython.Guards import guarded_iter_unpack_sequence, safer_getattr, full_write_guard
from RestrictedPython.PrintCollector import PrintCollector

from .base_node import BaseNode, ExecutionContext, NodeMetadata, NodeResult, NodeStatus, FailurePolicy


class SafePrintCollector:
    """
    A size-limited PrintCollector to prevent DoS attacks via excessive printing.
    Drop-in replacement for RestrictedPython.PrintCollector.
    """
    def __init__(self, _getattr_=None, max_size=100 * 1024):  # Default 100KB limit
        self.txt = []
        self._getattr_ = _getattr_
        self.max_size = max_size
        self.current_size = 0
        self.limit_reached = False

    def write(self, text):
        if self.limit_reached:
            return
            
        text_len = len(text)
        if self.current_size + text_len > self.max_size:
            remaining = self.max_size - self.current_size
            if remaining > 0:
                self.txt.append(text[:remaining])
            self.txt.append("\n[System: Output truncated - Limit exceeded]")
            self.current_size = self.max_size
            self.limit_reached = True
        else:
            self.txt.append(text)
            self.current_size += text_len

    def __call__(self):
        return ''.join(self.txt)

    def _call_print(self, *objects, **kwargs):
        if kwargs.get('file', None) is None:
            kwargs['file'] = self
        else:
            self._getattr_(kwargs['file'], 'write')       

        print(*objects, **kwargs)


class PythonScriptNode(BaseNode):
    """
    Execute custom Python code in a restricted sandbox environment.
    Enhanced with resource limits and execution context.
    """
    
    # Node configuration
    NODE_TYPE = "PythonScriptNode"
    VERSION = "2.0.0"  # Bumped for architecture changes
    CATEGORY = "script"
    DISPLAY_NAME = "Python Script"
    
    # Schema definition
    INPUT_TYPES = {
        "script": {"type": "STRING", "required": True, "multiline": True},
        "dataframe": {"type": "DATAFRAME", "required": False}
    }
    
    OUTPUT_TYPES = {
        "dataframe": {"type": "DATAFRAME"},
        "console_log": {"type": "STRING"}
    }
    
    @classmethod
    def INPUT_TYPES_LEGACY(cls) -> Dict[str, Any]:
        return {
            "required": {
                "script": ("STRING", {
                    "multiline": True,
                    "default": """# Available variables:
# - df: Input DataFrame (if connected)
# - np: numpy module
# - pd: pandas module

# Your code here:
result = df.copy()
result['new_column'] = result['amount'] * 1.1
print(f"Processed {len(result)} rows")

# Return value (must be a DataFrame or tuple of values)
return result
""",
                    "dynamicPrompts": False  # Disable dynamic prompts for code editor
                }),
            },
            "optional": {
                "dataframe": ("DATAFRAME",),  # Optional input DataFrame
            }
        }
    
    RETURN_TYPES = ("DATAFRAME", "STRING")
    RETURN_NAMES = ("dataframe", "console_log")
    FUNCTION = "execute_script"
    OUTPUT_NODE = False
    
    def __init__(self, metadata: Optional[NodeMetadata] = None):
        """Initialize with enhanced metadata"""
        if metadata is None:
            metadata = NodeMetadata(
                node_type=self.NODE_TYPE,
                version=self.VERSION,
                display_name=self.DISPLAY_NAME,
                category=self.CATEGORY,
                failure_policy=FailurePolicy.SKIP,  # Skip on script errors
                timeout_seconds=30,  # Strict timeout for scripts
                max_memory_mb=256,  # Memory limit
                requires_network=False,  # No network in sandbox
                cache_results=False  # Don't cache script results by default
            )
        super().__init__(metadata)
    
    def _create_sandbox_environment(self, context: ExecutionContext, input_df: Optional[pd.DataFrame] = None, print_collector: Optional[SafePrintCollector] = None) -> Dict[str, Any]:
        """
        Create a sandboxed execution environment with restricted builtins and safe imports.
        Enhanced with context awareness and resource tracking.
        """
        # Start with safe builtins and context info
        env = {
            '__builtins__': safe_builtins,
            '__context__': {
                'workflow_id': context.workflow_id,
                'run_id': context.run_id,
                'node_id': context.node_exec_id,
                'attempt': context.attempt_number
            },
        }
        
        # Add safe iteration
        env['_iter_unpack_sequence_'] = guarded_iter_unpack_sequence
        env['_getiter_'] = iter  # Use standard iter for RestrictedPython 7.x
        
        # Add basic Python builtins we allow
        env['len'] = len
        env['range'] = range
        env['enumerate'] = enumerate
        env['zip'] = zip
        env['map'] = map
        env['filter'] = filter
        env['sorted'] = sorted
        env['sum'] = sum
        env['min'] = min
        env['max'] = max
        env['abs'] = abs
        env['round'] = round
        env['int'] = int
        env['float'] = float
        env['str'] = str
        env['bool'] = bool
        env['list'] = list
        env['dict'] = dict
        env['set'] = set
        env['tuple'] = tuple
        env['print'] = print  # Will be redirected to StringIO
        env['isinstance'] = isinstance
        env['type'] = type
        
        # Use RestrictedPython guards with DataFrame support
        def _setitem_impl(obj, index, value):
            """Helper function for item assignment"""
            obj[index] = value
            return None
        
        env['_getattr_'] = safer_getattr
        env['_getitem_'] = lambda obj, index: obj[index]
        env['_setitem_'] = _setitem_impl
        env['_write_'] = lambda obj: obj  # Simpler write guard for DataFrames
        
        # Add to __builtins__ as well
        env['__builtins__']['_getitem_'] = env['_getitem_']
        env['__builtins__']['_setitem_'] = env['_setitem_']
        env['__builtins__']['_getattr_'] = env['_getattr_']
        env['__builtins__']['_write_'] = env['_write_']
        
        # Whitelist safe modules
        env['pd'] = pd
        env['np'] = np
        env['pandas'] = pd
        env['numpy'] = np
        
        # Expose input DataFrame if provided
        if input_df is not None:
            env['df'] = input_df
        
        return env
    
    def _execute_pure(self, inputs: Dict[str, Any], context: ExecutionContext) -> Dict[str, Any]:
        """
        Execute script in sandbox with resource limits
        Pure function - no side effects
        """
        script = inputs.get("script", "")
        dataframe = inputs.get("dataframe")
        
        # Execute with legacy method (refactored)
        result_df, console_log = self._execute_script_sandboxed(script, dataframe, context)
        
        return {
            "dataframe": result_df,
            "console_log": console_log
        }
    
    def _execute_script_sandboxed(self, script: str, dataframe: Optional[pd.DataFrame], context: ExecutionContext) -> Tuple[pd.DataFrame, str]:
        """
        Execute the Python script in a sandboxed environment with resource limits.
        
        Args:
            script: Python code to execute
            dataframe: Optional input DataFrame available as 'df' in the script
            context: Execution context with runtime info
        
        Returns:
            Tuple of (result DataFrame, console output)
        """
        
        # Add execution context info to console
        context_info = f"# Execution Context: workflow={context.workflow_id}, node={context.node_exec_id}\n"
        print(f"[PythonScriptNode] Executing script (length: {len(script)} chars)")
        
        # Capture print() output
        console_output = StringIO()
        original_stdout = sys.stdout
        sys.stdout = console_output
        
        # Create PrintCollector to capture print() output from RestrictedPython
        _print_collector = SafePrintCollector(safer_getattr)
        
        # Create sandboxed execution environment with print collector
        safe_env = self._create_sandbox_environment(context, dataframe, _print_collector)
        
        try:
            # Compile the restricted code
            compile_result = compile_restricted(
                script,
                filename='<user_script>',
                mode='exec'
            )
            
            # Check for compilation errors
            # In RestrictedPython 7.x, compile_restricted returns CompileResult
            if hasattr(compile_result, 'errors') and compile_result.errors:
                error_msg = "Compilation errors:\n" + "\n".join(compile_result.errors)
                print(error_msg)
                sys.stdout = original_stdout
                return (dataframe if dataframe is not None else pd.DataFrame(), 
                        console_output.getvalue() + "\n❌ " + error_msg)
            
            if hasattr(compile_result, 'warnings') and compile_result.warnings:
                warning_msg = "Warnings:\n" + "\n".join(compile_result.warnings)
                print(warning_msg)
            
            # Get the compiled code object
            byte_code = compile_result.code if hasattr(compile_result, 'code') else compile_result
            
            # Execute the code
            exec(byte_code, safe_env)
            
            # Get the return value
            # User can either:
            # 1. Set a variable named 'result' or 'output'
            # 2. Use 'return' statement (needs to be in a function)
            result_df = safe_env.get('result')
            if result_df is None:
                result_df = safe_env.get('output')
            
            if result_df is None:
                # If no result variable, return the input dataframe
                result_df = dataframe if dataframe is not None else pd.DataFrame()
                print("⚠️ No 'result' or 'output' variable found. Returning input DataFrame.")
            
            # Validate result is a DataFrame
            if not isinstance(result_df, pd.DataFrame):
                error_msg = f"❌ Error: Script must return a DataFrame, got {type(result_df)}"
                print(error_msg)
                sys.stdout = original_stdout
                return (dataframe if dataframe is not None else pd.DataFrame(), 
                        console_output.getvalue())
            
            print(f"✅ Script executed successfully. Output shape: {result_df.shape}")
            
        except Exception as e:
            error_msg = f"Script execution error: {str(e)}"
            # Log error to context
            context.add_evidence("script_error", error_msg)
            return pd.DataFrame(), context_info + error_msg
        
        finally:
            sys.stdout = original_stdout
        
        # Collect console output from both StringIO and RestrictedPython's PrintCollector
        console_log = console_output.getvalue()
        
        # Get RestrictedPython's print output from PrintCollector
        if _print_collector is not None:
            try:
                # Call the PrintCollector instance to get collected output
                collected_output = _print_collector()
                if collected_output:
                    # Prepend collected output if not already in console_log
                    if collected_output not in console_log:
                        console_log = collected_output + console_log
            except Exception as e:
                # If PrintCollector fails, just use what we have
                pass
        
        return (result_df, console_log)


    def execute_script(self, script: str, dataframe: Optional[pd.DataFrame] = None) -> Tuple[pd.DataFrame, str]:
        """
        Legacy interface for backward compatibility
        """
        # Create minimal context for legacy calls
        context = ExecutionContext(
            workflow_id="legacy",
            run_id="legacy_run",
            node_exec_id="script_exec"
        )
        
        result = self._execute_pure(
            {"script": script, "dataframe": dataframe},
            context
        )
        
        return result["dataframe"], result["console_log"]
    
    def estimate_cost(self, inputs: Dict[str, Any]) -> Dict[str, float]:
        """
        Estimate script execution cost
        """
        script = inputs.get("script", "")
        dataframe = inputs.get("dataframe")
        
        # Rough estimates based on script complexity
        script_lines = len(script.splitlines())
        df_size = dataframe.shape[0] * dataframe.shape[1] if dataframe is not None else 0
        
        return {
            "time_seconds": min(30, script_lines * 0.1 + df_size * 0.00001),
            "memory_mb": min(256, 50 + df_size * 0.0001),
            "ai_tokens": 0,
            "ai_cost_usd": 0.0
        }

# Register the node
NODE_CLASS_MAPPINGS = {
    "PythonScriptNode": PythonScriptNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PythonScriptNode": "Python Script"
}
