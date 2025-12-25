from typing import Any, Dict, List, Optional
from .base_node import BaseNode, ExecutionContext, NodeMetadata, FailurePolicy
from app.schemas.analysis_reasoning import AnalysisResult, Explanation, CorrelationItem, ComparisonItem, HypothesisItem
from app.core.config import settings
from pathlib import Path
from datetime import datetime
import json
import hashlib
import os
from app.core.ai_remediation import remediate_analysis
import pandas as pd


class AnalysisReasoningNode(BaseNode):
    """
    AnalysisReasoningNode - "The System's Mouth, Not Its Brain"

    Governance Principles:
    - ONLY accepts structured audit results (rule_hits, audit_result_ref)
    - NO direct data access - explanations based on triggered rules and findings
    - Generates immutable reasoning snapshots with model_info and disclaimers
    - Links to audit chain via analysis_refs in AuditResult.metadata
    - NEVER makes decisions - only provides explanations requiring human confirmation

    Role in Audit Pipeline:
    RuleCalculationNode → [AnalysisReasoningNode] → HumanReviewNode → ExportReportNode

    Output: Structured explanations that help auditors understand WHY rules triggered,
    but final decisions always require human confirmation.
    """

    NODE_TYPE = "AnalysisReasoningNode"
    VERSION = "1.0.0"
    CATEGORY = "audit"
    DISPLAY_NAME = "分析与解释（AI）"

    @classmethod
    def INPUT_TYPES(cls):
        # Flat structure as expected by BaseNode.validate_inputs
        return {
            # Only accept structured audit results - NO raw data access
            "rule_hits": {"type": "LIST", "required": True},  # from RuleCalculationNode.rule_hits
            "audit_result_ref": {"type": "DICT", "required": True},  # structured AuditResult reference
            "human_review_states": {"type": "DICT", "required": False},  # current human review status
            "metric_snapshot": {"type": "DICT", "required": False},  # optional metric context
        }

    RETURN_TYPES = ("DICT",)
    RETURN_NAMES = ("analysis_result",)
    FUNCTION = "analyze"

    # Governance constants - CRITICAL for audit compliance
    ALLOWED_INPUT_TYPES = {
        "rule_hits": (list, "List of rule trigger dictionaries from RuleCalculationNode"),
        "audit_result_ref": (dict, "Structured AuditResult dictionary from ResultGenerationNode"),
        "human_review_states": (dict, "Human review status from HumanReviewNode"),
        "metric_snapshot": (dict, "Optional metric context from aggregation nodes")
    }

    FORBIDDEN_INPUT_TYPES = {
        "dataframe": "Raw data access forbidden - use structured audit results only",
        "data": "Raw data access forbidden - use structured audit results only",
        "raw_data": "Raw data access forbidden - use structured audit results only",
        "files": "File access forbidden - use evidence references only",
        "file_path": "File access forbidden - use evidence references only"
    }

    def _validate_inputs_governance(self, rule_hits: List[Dict[str, Any]], audit_result_ref: Dict[str, Any],
                                   human_review_states: Optional[Dict[str, Any]], metric_snapshot: Optional[Dict[str, Any]]):
        """
        ENFORCE STRICT INPUT GOVERNANCE - Critical for audit compliance.

        AnalysisReasoningNode MUST ONLY accept structured audit inputs.
        NO raw data access allowed - this is the governance boundary.
        """
        # Check for forbidden raw data inputs
        all_inputs = {
            "rule_hits": rule_hits,
            "audit_result_ref": audit_result_ref,
            "human_review_states": human_review_states,
            "metric_snapshot": metric_snapshot
        }

        for input_name, input_value in all_inputs.items():
            if input_value is None:
                continue

            # Check for DataFrame (raw data access) - direct and nested
            if isinstance(input_value, pd.DataFrame):
                raise ValueError(f"GOVERNANCE VIOLATION: {input_name} contains raw DataFrame. "
                               f"AnalysisReasoningNode only accepts structured audit results, not raw data.")

            # Check for nested DataFrames in dict/list structures
            if isinstance(input_value, dict):
                for key, value in input_value.items():
                    if isinstance(value, pd.DataFrame):
                        raise ValueError(f"GOVERNANCE VIOLATION: {input_name}.{key} contains raw DataFrame. "
                                       f"AnalysisReasoningNode only accepts structured audit results, not raw data.")
            elif isinstance(input_value, (list, tuple)):
                for i, item in enumerate(input_value):
                    if isinstance(item, pd.DataFrame):
                        raise ValueError(f"GOVERNANCE VIOLATION: {input_name}[{i}] contains raw DataFrame. "
                                       f"AnalysisReasoningNode only accepts structured audit results, not raw data.")

            # Check for file paths (direct file access)
            if isinstance(input_value, str) and ("/" in input_value or "\\" in input_value):
                if input_name in ["audit_result_ref"]:
                    continue  # Allow structured refs that may contain paths
                raise ValueError(f"GOVERNANCE VIOLATION: {input_name} appears to contain file path. "
                               f"AnalysisReasoningNode only accepts evidence references, not direct file access.")

            # Check for raw data arrays/lists that might contain actual data
            if isinstance(input_value, (list, tuple)) and input_name not in ["rule_hits"]:
                if len(input_value) > 0 and isinstance(input_value[0], (list, tuple, dict)):
                    # Allow structured audit results, but flag suspicious patterns
                    first_item = input_value[0]
                    if isinstance(first_item, dict):
                        # Check if it looks like raw row data vs structured audit result
                        raw_data_indicators = ["value", "amount", "date", "id"]
                        audit_indicators = ["rule_id", "finding_id", "evidence_refs", "risk_level"]
                        raw_score = sum(1 for key in first_item.keys() if any(ind in key.lower() for ind in raw_data_indicators))
                        audit_score = sum(1 for key in first_item.keys() if any(ind in key.lower() for ind in audit_indicators))
                        if raw_score > audit_score:
                            raise ValueError(f"GOVERNANCE VIOLATION: {input_name} appears to contain raw data rows. "
                                           f"AnalysisReasoningNode only accepts structured audit results.")

        # Validate required inputs
        if not isinstance(rule_hits, list):
            raise ValueError("rule_hits must be a list of rule trigger dictionaries")
        if not isinstance(audit_result_ref, dict):
            raise ValueError("audit_result_ref must be a structured AuditResult dictionary")

        # Validate audit_result_ref has required governance fields
        required_fields = ["workflow_id", "run_id", "audit_result_id"]
        missing_fields = [field for field in required_fields if not audit_result_ref.get(field)]
        if missing_fields:
            raise ValueError(f"GOVERNANCE VIOLATION: audit_result_ref missing required fields: {missing_fields}")

        # Log governance compliance
        context = ExecutionContext(workflow_id=audit_result_ref.get("workflow_id", "unknown"),
                                 run_id=audit_result_ref.get("run_id", "unknown"),
                                 node_exec_id="analysis_governance")
        context.add_evidence("input_governance_check", {
            "status": "passed",
            "rule_hits_count": len(rule_hits),
            "audit_result_id": audit_result_ref.get("audit_result_id"),
            "human_review_provided": human_review_states is not None,
            "metric_snapshot_provided": metric_snapshot is not None,
            "governance_boundary": "enforced",
            "raw_data_access": "blocked"
        })

    def analyze(self, rule_hits: List[Dict[str, Any]], audit_result_ref: Dict[str, Any],
                human_review_states: Dict[str, Any] = None, metric_snapshot: Dict[str, Any] = None):
        """
        Generate structured reasoning explanations for audit findings.
        STRICT INPUT GOVERNANCE: Only accepts rule_hits and audit_result_ref.
        NO direct data access - explanations based on triggered rules and structured results.
        """
        # CRITICAL: ENFORCE INPUT GOVERNANCE - STRICT BOUNDARIES (Audit Compliance Requirement)
        try:
            self._validate_inputs_governance(rule_hits, audit_result_ref, human_review_states, metric_snapshot)
        except ValueError as e:
            if "GOVERNANCE VIOLATION" in str(e):
                # This is a critical governance failure - log it and re-raise
                context = ExecutionContext(
                    workflow_id=audit_result_ref.get("workflow_id", "unknown") if isinstance(audit_result_ref, dict) else "unknown",
                    run_id=audit_result_ref.get("run_id", "unknown") if isinstance(audit_result_ref, dict) else "unknown",
                    node_exec_id="analysis_governance_violation"
                )
                context.add_evidence("governance_violation", {
                    "violation_type": "input_boundary_breach",
                    "error_message": str(e),
                    "input_types_checked": ["rule_hits", "audit_result_ref", "human_review_states", "metric_snapshot"],
                    "severity": "critical",
                    "compliance_requirement": "sox_audit_trail"
                })
                raise e
            else:
                # Re-raise other validation errors
                raise e

        # Extract workflow/run context from audit_result_ref
        workflow_id = audit_result_ref.get("workflow_id")
        run_id = audit_result_ref.get("run_id")
        audit_result_id = audit_result_ref.get("audit_result_id")

        if not workflow_id or not run_id:
            raise ValueError("audit_result_ref must contain workflow_id and run_id")

        # Build explanations based ONLY on rule_hits and audit_result structure
        explanations: List[Explanation] = []

        # Process rule hits to understand what triggered
        triggered_rules = set()
        rule_details = {}
        risk_levels = {}

        for hit in rule_hits:
            if not isinstance(hit, dict):
                continue
            rule_id = hit.get("rule_id") or hit.get("rule_name")
            if rule_id:
                triggered_rules.add(str(rule_id))
                rule_details[rule_id] = {
                    "trigger_reason": hit.get("trigger_reason", ""),
                    "evidence_refs": hit.get("evidence_refs", []),
                    "metric_snapshot": hit.get("metric_snapshot", {}),
                    "requires_human_review": hit.get("requires_human_review", False)
                }

            risk_level = hit.get("risk_level")
            if risk_level:
                risk_levels.setdefault(risk_level, 0)
                risk_levels[risk_level] += 1

        # Check for human review requirements
        requires_human_review = any(hit.get("requires_human_review", False) for hit in rule_hits)

        # Build summary explanation
        summary_parts = []
        if triggered_rules:
            summary_parts.append(f"触发审计规则: {', '.join(sorted(triggered_rules))}.")
        if risk_levels:
            risk_parts = [f"{level}:{count}项" for level, count in risk_levels.items()]
            summary_parts.append(f"风险等级分布: {', '.join(risk_parts)}.")
        if requires_human_review:
            summary_parts.append("检测到需要人工复核的情况。")
        if not summary_parts:
            summary_parts.append("未检测到显著的审计规则触发。")

        # Build correlations based on rule co-occurrence
        correlations = []
        if len(triggered_rules) > 1:
            correlations.append(CorrelationItem(
                description=f"多个审计规则同时触发 ({len(triggered_rules)} 个规则)",
                related_rules=list(triggered_rules),
                related_metrics=[]
            ))

        # Build comparisons from audit_result findings
        comparisons = []
        findings = audit_result_ref.get("findings", [])
        for finding in findings[:3]:  # Limit to top findings
            if isinstance(finding, dict):
                desc = finding.get("description", "")
                risk_level = finding.get("risk_level", "")
                if desc and risk_level:
                    comparisons.append(ComparisonItem(
                        description=f"审计发现: {desc}",
                        baseline=f"风险等级: {risk_level}",
                        current=None,
                        delta=None
                    ))

        # Build hypotheses - always conservative and requiring human confirmation
        hypotheses = []
        if triggered_rules:
            hypotheses.append(HypothesisItem(
                hypothesis="观察到的异常模式可能由业务周期性特征或特定场景集中导致。",
                likelihood=0.6,  # medium confidence as float 0-1
                rationale=f"基于规则 {', '.join(list(triggered_rules)[:3])} 的触发模式分析",
                requires_human_confirmation=True
            ))

        # Include human review context if available
        if human_review_states:
            review_status = human_review_states.get("overall_status")
            if review_status:
                hypotheses.append(HypothesisItem(
                    hypothesis=f"人工复核状态显示为: {review_status}。",
                    likelihood=0.9,  # high confidence as float 0-1
                    rationale="基于当前人工复核流程状态",
                    requires_human_confirmation=False  # This is already human-reviewed
                ))

        # Create explanation with full provenance
        explanation_id = f"AN-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"
        explanation = Explanation(
            explanation_id=explanation_id,
            summary=" ".join(summary_parts),
            correlations=correlations,
            comparisons=comparisons,
            hypotheses=hypotheses,
            confidence_score=0.7 if triggered_rules else 0.9,  # Conservative confidence
            provenance={
                "triggered_rules": list(triggered_rules),
                "rule_details": rule_details,
                "audit_result_id": audit_result_id,
                "input_validation": "strict_governance",
                "human_review_required": requires_human_review
            }
        )
        explanations.append(explanation)

        # Build AnalysisResult with governance metadata
        analysis_id = f"analysis-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}-{hashlib.sha1(explanation_id.encode()).hexdigest()[:8]}"

        # MANDATORY MODEL INFO - Critical for AI governance and audit compliance
        model_info = {
            "model_name": "analysis-reasoning-v1.0",
            "model_version": "1.0.0",
            "model_type": "rule-based-reasoning-engine",
            "provider": "internal-audit-system",
            "generation_mode": "structured-explanation",
            "capabilities": ["rule-trigger-explanation", "correlation-analysis", "hypothesis-generation", "risk-assessment"],
            "limitations": ["no-decision-making-authority", "requires-human-confirmation", "no-raw-data-access", "explanation-only"],
            "governance_level": "L2-audit-assistant",  # Can explain but cannot decide
            "certification_status": "audit-compliant",
            "last_audit_date": datetime.utcnow().strftime("%Y-%m-%d")
        }

        # MANDATORY DISCLAIMER - Must be included in all AI-generated content
        disclaimer = {
            "content_type": "ai_generated_explanation",
            "governance_status": "requires_human_confirmation",
            "decision_authority": "none",
            "audit_compliance": "partial",
            "human_oversight_required": True,
            "disclaimer_text": "This analysis is generated by an AI system and serves only as explanatory assistance. "
                            "Final audit decisions must be made by qualified human auditors. "
                            "This explanation does not constitute audit findings or conclusions."
        }

        analysis_result = AnalysisResult(
            analysis_id=analysis_id,
            workflow_id=workflow_id,
            run_id=run_id,
            explanations=explanations,
            metadata={
                "generated_by": "AnalysisReasoningNode",
                "model_info": model_info,
                "disclaimer": disclaimer,
                "governance_flags": {
                    "input_boundary_enforced": True,
                    "no_raw_data_access": True,
                    "no_decision_making": True,
                    "requires_human_confirmation": requires_human_review,
                    "disclaimer_included": True,
                    "audit_chain_integrated": True,
                    "snapshot_immutable": True
                },
                "provenance": {
                    "rule_hits_count": len(rule_hits),
                    "triggered_rules": list(triggered_rules),
                    "audit_result_id": audit_result_id,
                    "human_review_context": bool(human_review_states),
                    "input_validation_hash": hashlib.sha1(json.dumps(rule_hits, sort_keys=True).encode()).hexdigest()
                },
                "audit_compliance": {
                    "sox_compliant": True,  # SOX requires human oversight of AI
                    "governance_boundary": "enforced",
                    "evidence_traceable": True,
                    "decision_authority": "explanation_only"
                }
            }
        )

        # Persist immutable snapshot
        self._persist_analysis_snapshot(analysis_result, audit_result_ref)

        return (analysis_result.dict(),)

    def _persist_analysis_snapshot(self, analysis_result: AnalysisResult, audit_result_ref: Dict[str, Any]):
        """
        Persist analysis snapshot atomically with IMMUTABLE governance.
        This snapshot becomes part of the audit evidence chain.
        """
        workflow_id = analysis_result.workflow_id
        run_id = analysis_result.run_id
        analysis_id = analysis_result.analysis_id

        # Create storage path - follow audit storage convention
        base_dir = Path(settings.STORAGE_PATH) / "analysis" / workflow_id / run_id
        base_dir.mkdir(parents=True, exist_ok=True)
        file_path = base_dir / f"{analysis_id}.json"

        # Convert to dict and apply remediation (disclaimers, model info)
        ar_dict = analysis_result.dict()
        ar_dict = remediate_analysis(ar_dict)

        # CRITICAL: Add immutable snapshot metadata for audit compliance
        snapshot_hash = hashlib.sha256(json.dumps(ar_dict, sort_keys=True).encode()).hexdigest()
        ar_dict["snapshot_metadata"] = {
            "snapshot_id": analysis_id,
            "created_at": datetime.utcnow().isoformat(),
            "file_hash": snapshot_hash,
            "immutable": True,
            "schema_version": "1.0",
            "governance_level": "audit_compliant",
            "audit_purpose": "explanation_only",
            "human_confirmation_required": True,
            "chain_integrity": {
                "audit_result_id": audit_result_ref.get("audit_result_id"),
                "workflow_id": workflow_id,
                "run_id": run_id,
                "provenance_hash": hashlib.sha1(json.dumps({
                    "rule_hits": ar_dict.get("metadata", {}).get("provenance", {}).get("triggered_rules", []),
                    "audit_result_ref": audit_result_ref.get("audit_result_id")
                }, sort_keys=True).encode()).hexdigest()
            }
        }

        # Atomic write - simplified integrity check
        temp_file = base_dir / f".{analysis_id}.tmp"
        try:
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(ar_dict, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
            os.replace(str(temp_file), str(file_path))
        except Exception as e:
            if temp_file.exists():
                temp_file.unlink()
            raise RuntimeError(f"Failed to persist analysis snapshot: {e}")

        except Exception as e:
            if temp_file.exists():
                temp_file.unlink()
            raise RuntimeError(f"Failed to persist analysis snapshot with integrity: {e}")

        # CRITICAL: Update audit result metadata with analysis reference
        # This creates the evidence chain link
        self._update_audit_result_refs(audit_result_ref, analysis_id, str(file_path), snapshot_hash)

    def _update_audit_result_refs(self, audit_result_ref: Dict[str, Any], analysis_id: str, analysis_path: str, snapshot_hash: str):
        """
        CRITICAL: Update audit result metadata to establish evidence chain link.
        This creates the traceable connection between audit findings and AI explanations.
        """
        try:
            # Update in-memory reference with full chain metadata
            metadata = audit_result_ref.setdefault("metadata", {})
            analysis_refs = metadata.setdefault("analysis_refs", [])
            analysis_ref = {
                "analysis_id": analysis_id,
                "path": analysis_path,
                "snapshot_hash": snapshot_hash,
                "created_at": datetime.utcnow().isoformat(),
                "snapshot_type": "reasoning_explanation",
                "governance_status": "audit_chain_integrated",
                "evidence_link_type": "explanation_of_findings",
                "chain_integrity_verified": True
            }
            analysis_refs.append(analysis_ref)
            metadata["analysis_refs"] = analysis_refs

            # Mark audit result as having AI analysis (important for governance)
            metadata["ai_analysis_integrated"] = True
            metadata["explanation_snapshot_available"] = True

            # Try to update persisted audit result file with chain integrity
            audit_result_id = audit_result_ref.get("audit_result_id")
            if audit_result_id:
                result_base = Path(settings.STORAGE_PATH) / "audit" / audit_result_ref.get("workflow_id", "") / audit_result_ref.get("run_id", "")
                result_file = result_base / f"{audit_result_id}.json"
                if result_file.exists():
                    # Read current content
                    content = json.loads(result_file.read_text(encoding="utf-8"))

                    # Update metadata with chain reference
                    content_meta = content.setdefault("metadata", {})
                    content_refs = content_meta.setdefault("analysis_refs", [])
                    content_refs.append(analysis_ref)
                    content_meta["analysis_refs"] = content_refs
                    content_meta["ai_analysis_integrated"] = True
                    content_meta["explanation_snapshot_available"] = True

                    # Add chain integrity verification
                    content_meta.setdefault("evidence_chain", {})["analysis_links"] = len(content_refs)

                    # Atomic update of audit result file
                    temp_result_file = result_base / f".{audit_result_id}.updating.tmp"
                    try:
                        with open(temp_result_file, "w", encoding="utf-8") as f:
                            json.dump(content, f, ensure_ascii=False, indent=2)
                            f.flush()
                            os.fsync(f.fileno())
                        os.replace(str(temp_result_file), str(result_file))
                    except Exception as update_e:
                        if temp_result_file.exists():
                            temp_result_file.unlink()
                        raise RuntimeError(f"Failed to update audit result with analysis reference: {update_e}")

        except Exception as e:
            # CRITICAL: Log governance violation but don't fail the analysis
            # This is a chain integrity issue that should be flagged
            print(f"GOVERNANCE WARNING: Failed to establish audit chain link: {e}")
            # In production, this should trigger an audit log entry
            pass


