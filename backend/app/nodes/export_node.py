import os
import json
import hashlib
from typing import Dict, Any, Optional
from datetime import datetime

from .base_node import BaseNode, ExecutionContext
from app.core.config import settings
from app.core import ai_gov
from app.core.audit_service import AuditService
from app.core.database import SessionLocal
from app.core.database import DB_PATH
import sqlite3


class GovernanceError(Exception):
    def __init__(self, error_type: str, user_message: str, internal_detail: Dict[str, Any] = None):
        self.error_type = error_type
        self.user_message = user_message
        self.internal_detail = internal_detail or {}
        super().__init__(user_message)


class ExportReportNode(BaseNode):
    """
    ExportReportNode - 审计报告导出的最后防线

    核心职责：
    - 执行AI治理检查和签名验证
    - 生成带元数据的导出产物(artifact)
    - 管理UI链接和访问控制
    - 实现阻断/警告/成功三种导出状态

    治理原则：
    - experimental_logic_used标记的内容禁止外部使用
    - 所有产物都有完整provenance追踪
    - 导出行为必须记录审计日志
    """

    NODE_TYPE = "ExportReportNode"
    VERSION = "2.0.0"
    DISPLAY_NAME = "审计报告导出 (带治理检查)"
    CATEGORY = "审计输出"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "audit_result_ref": {"type": "DICT", "required": True},  # 审计结果快照引用
            "export_options": {"type": "DICT", "required": False},   # 导出选项
            "requester": {"type": "DICT", "required": False},        # 请求者信息
            "ui_flags": {"type": "DICT", "required": False},         # UI标志
        }

    RETURN_TYPES = ("DICT",)  # 返回结构化结果
    RETURN_NAMES = ("export_result",)
    FUNCTION = "export_audit_report"

    def _write_auditlog(self, action_type: str, target_id: Optional[str], parameters: Dict[str, Any], user_id: str = "system"):
        try:
            db = SessionLocal()
            try:
                # instrumentation: record that _write_auditlog was called and session bind
                try:
                    with open(r"d:\审计数智析v2\.cursor\debug.log", "a", encoding="utf-8") as _dbg:
                        import time as _time
                        _dbg.write(json.dumps({"sessionId":"debug-session","runId":"export_write_pre","location":"export_node._write_auditlog","message":"_write_auditlog called","data":{"action_type":action_type,"target_id":target_id,"bind": str(getattr(db, 'bind', None))},"timestamp":int(_time.time()*1000)}) + "\n")
                except Exception:
                    pass

                log = AuditService.log(db, action_type=action_type, target_type="audit_result", target_id=target_id, parameters=parameters, user_id=user_id)

                # instrumentation: after write
                try:
                    with open(r"d:\审计数智析v2\.cursor\debug.log", "a", encoding="utf-8") as _dbg:
                        import time as _time
                        _dbg.write(json.dumps({"sessionId":"debug-session","runId":"export_write_post","location":"export_node._write_auditlog","message":"AuditService.log returned","data":{"log_id": getattr(log,'id',None)},"timestamp":int(_time.time()*1000)}) + "\n")
                except Exception:
                    pass

                return log
            finally:
                db.close()
        except Exception as e:
            # Fallback: if DB is not initialized in test env, just print and continue
            try:
                print(f"[AuditLog-Fallback] {action_type} | target: {target_id} | params: {parameters} | error: {e}")
            except Exception:
                pass
            try:
                with open(r"d:\审计数智析v2\.cursor\debug.log", "a", encoding="utf-8") as _dbg:
                    import time as _time
                    _dbg.write(json.dumps({"sessionId":"debug-session","runId":"export_write_error","location":"export_node._write_auditlog","message":"_write_auditlog exception","data":{"error": str(e)},"timestamp":int(_time.time()*1000)}) + "\n")
            except Exception:
                pass
            return None

    def _create_human_review_task(self, audit_result: Dict[str, Any], reason: str) -> str:
        # Create a simple task file under STORAGE_PATH/tasks/human_review/
        storage = getattr(settings, "STORAGE_PATH", "./storage")
        tasks_dir = os.path.join(storage, "tasks", "human_review")
        os.makedirs(tasks_dir, exist_ok=True)
        task_id = hashlib.sha256((audit_result.get("audit_result_id", "") + str(datetime.utcnow())).encode()).hexdigest()[:12]
        task_path = os.path.join(tasks_dir, f"{task_id}.json")
        payload = {
            "task_id": task_id,
            "audit_result_id": audit_result.get("audit_result_id"),
            "workflow_id": audit_result.get("workflow_id"),
            "run_id": audit_result.get("run_id"),
            "reason": reason,
            "created_at": datetime.utcnow().isoformat(),
            "findings": audit_result.get("findings", []),
        }
        try:
            with open(task_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
        except Exception:
            # best-effort file write; if fail, continue
            pass

        # Log creation (best-effort)
        try:
            self._write_auditlog("create_human_review_task", audit_result.get("audit_result_id"), {"task_id": task_id, "reason": reason})
        except Exception:
            pass
        return task_id

    def export_audit_report(self, audit_result_ref: Dict[str, Any],
                           export_options: Dict[str, Any] = None,
                           requester: Dict[str, Any] = None,
                           ui_flags: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        审计报告导出 - 实现完整的治理检查和artifact管理

        Args:
            audit_result_ref: 审计结果快照引用，包含workflow_id, run_id, audit_result_id, storage_path
            export_options: 导出选项 (format, template_id, include_attachments, for_external_use)
            requester: 请求者信息 (user_id, role, request_time)
            ui_flags: UI标志 (force_watermark, additional_notes)

        Returns:
            export_result: 结构化的导出结果
        """

        # 解析输入参数
        export_options = export_options or {}
        requester = requester or {}
        ui_flags = ui_flags or {}

        # 验证audit_result_ref
        if not self._validate_audit_result_ref(audit_result_ref):
            return self._create_blocked_result("INVALID_INPUT",
                "audit_result_ref is invalid or missing required fields",
                {"audit_result_ref": audit_result_ref}
            )

        # 加载审计结果快照
        audit_result = self._load_audit_result_snapshot(audit_result_ref)
        if not audit_result:
            return self._create_blocked_result("SCHEMA_MISMATCH",
                "Cannot load audit result snapshot",
                {"audit_result_ref": audit_result_ref}
            )

        # 执行治理检查
        governance_result = self._perform_governance_checks(audit_result, export_options)

        # 根据治理结果决定导出策略
        if governance_result["should_block"]:
            return self._handle_governance_block(audit_result, governance_result)

        # 生成导出产物
        artifact_result = self._generate_export_artifact(audit_result, export_options, governance_result)

        # 创建成功结果
        return self._create_success_result(artifact_result, governance_result)

    def _validate_audit_result_ref(self, audit_result_ref: Dict[str, Any]) -> bool:
        """验证audit_result_ref的完整性"""
        required_fields = ["workflow_id", "run_id", "audit_result_id"]
        return all(audit_result_ref.get(field) for field in required_fields)

    def _load_audit_result_snapshot(self, audit_result_ref: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """加载审计结果快照"""
        storage_path = audit_result_ref.get("storage_path")
        if not storage_path:
            # 尝试根据workflow_id和run_id构建路径
            workflow_id = audit_result_ref["workflow_id"]
            run_id = audit_result_ref["run_id"]
            audit_result_id = audit_result_ref["audit_result_id"]
            storage_path = os.path.join(
                getattr(settings, "STORAGE_PATH", "./storage"),
                "audit", workflow_id, run_id, f"{audit_result_id}.json"
            )

        if os.path.exists(storage_path):
            try:
                with open(storage_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"Failed to load audit result snapshot: {e}")
                return None
        return None

    def _perform_governance_checks(self, audit_result: Dict[str, Any], export_options: Dict[str, Any]) -> Dict[str, Any]:
        """执行治理检查"""
        result = {
            "should_block": False,
            "warnings": [],
            "violations": {"hard": [], "warnings": []},
            "ai_gov_summary": "",
            "watermark_required": False,
            "review_task_id": None
        }

        # AI治理检查
        gov_res = ai_gov.check(audit_result)

        # 检查硬性违规
        hard_violations = gov_res.get("violations", {}).get("hard", 0)
        if hard_violations > 0 or gov_res.get("status") == "FAILED_HARD":
            result["should_block"] = True
            result["violations"]["hard"] = gov_res.get("violations", {}).get("hard_violations", [])
            result["ai_gov_summary"] = "AI governance hard violations detected"
            return result

        # 检查签名状态
        signature_status = audit_result.get("signature_status")
        for_external_use = export_options.get("for_external_use", False)

        if for_external_use and signature_status != "approved":
            result["should_block"] = True
            result["violations"]["hard"] = ["MISSING_SIGNATURE"]
            result["ai_gov_summary"] = f"Signature status '{signature_status}' not approved for external use"
            return result

        # 检查实验性逻辑标记
        experimental_used = audit_result.get("governance_flags", {}).get("experimental_logic_used", False)
        if experimental_used and for_external_use:
            result["should_block"] = True
            result["violations"]["hard"] = ["EXPERIMENTAL_LOGIC_EXTERNAL"]
            result["ai_gov_summary"] = "Experimental logic used, cannot export for external use"
            return result

        # 检查警告级违规
        warning_violations = gov_res.get("violations", {}).get("warnings", 0)
        if warning_violations > 0 or gov_res.get("status") == "WARN":
            result["warnings"].extend(["AI_GOVERNANCE_WARNINGS"])
            result["watermark_required"] = True
            result["ai_gov_summary"] = "Contains AI-generated content requiring human confirmation"

        # 如果有实验性逻辑但允许内部使用，则要求水印
        if experimental_used:
            result["watermark_required"] = True
            result["warnings"].extend(["EXPERIMENTAL_LOGIC_USED"])

        result["ai_gov_summary"] = result["ai_gov_summary"] or "Clean"
        return result

    def _handle_governance_block(self, audit_result: Dict[str, Any], governance_result: Dict[str, Any]) -> Dict[str, Any]:
        """处理治理阻断"""
        # 创建人工复核任务
        review_task_id = self._create_human_review_task(audit_result, governance_result["ai_gov_summary"])

        # 记录审计日志
        self._write_auditlog("AI_GOVERNANCE_BLOCK", audit_result.get("audit_result_id"), {
            "violations": governance_result["violations"],
            "review_task_id": review_task_id,
            "ai_gov_summary": governance_result["ai_gov_summary"]
        })

        return self._create_blocked_result("AI_GOVERNANCE_BLOCK",
            "AI governance check failed. Human review required.",
            {
                "review_task_id": review_task_id,
                "violations_summary": governance_result["violations"],
                "ai_gov_summary": governance_result["ai_gov_summary"]
            }
        )

    def _generate_export_artifact(self, audit_result: Dict[str, Any], export_options: Dict[str, Any],
                                governance_result: Dict[str, Any]) -> Dict[str, Any]:
        """生成导出产物"""
        # 生成artifact_id
        artifact_id = self._generate_artifact_id(audit_result)

        # 确定存储路径
        storage_paths = self._create_storage_paths(audit_result, artifact_id)

        # 准备导出内容
        export_content = self._prepare_export_content(audit_result, export_options, governance_result)

        # 写入文件
        self._write_export_files(storage_paths, export_content, audit_result, export_options, governance_result)

        # 计算文件哈希
        file_hash = self._calculate_file_hash(storage_paths["artifact_path"])

        # 创建artifact元数据
        metadata = self._create_artifact_metadata(
            artifact_id, audit_result, export_options, governance_result, storage_paths, file_hash
        )

        return {
            "artifact_id": artifact_id,
            "file_path": storage_paths["artifact_path"],
            "metadata_path": storage_paths["metadata_path"],
            "ui_link": self._generate_ui_link(audit_result, artifact_id),
            "metadata": metadata
        }

    def _generate_artifact_id(self, audit_result: Dict[str, Any]) -> str:
        """生成唯一的artifact ID"""
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        audit_id = audit_result.get("audit_result_id", "unknown")
        unique_str = f"{audit_id}-{timestamp}"
        return f"artifact-{hashlib.sha256(unique_str.encode()).hexdigest()[:16]}"

    def _create_storage_paths(self, audit_result: Dict[str, Any], artifact_id: str) -> Dict[str, str]:
        """创建存储路径"""
        env = os.getenv("APP_ENV", "dev")
        workflow_id = audit_result.get("workflow_id", "unknown_workflow")
        run_id = audit_result.get("run_id", "unknown_run")
        audit_result_id = audit_result.get("audit_result_id", "unknown_audit")

        base_dir = os.path.join(
            getattr(settings, "STORAGE_PATH", "./storage"),
            "exports", env, workflow_id, run_id, audit_result_id, artifact_id
        )
        os.makedirs(base_dir, exist_ok=True)

        return {
            "base_dir": base_dir,
            "artifact_path": os.path.join(base_dir, f"audit_report_{audit_result_id}.json"),
            "metadata_path": os.path.join(base_dir, "metadata.json")
        }

    def _prepare_export_content(self, audit_result: Dict[str, Any], export_options: Dict[str, Any],
                              governance_result: Dict[str, Any]) -> Dict[str, Any]:
        """准备导出内容"""
        content = dict(audit_result)
        content["exported_at"] = datetime.utcnow().isoformat()
        content["exported_by"] = "ExportReportNode"
        content["export_format"] = export_options.get("format", "json")
        content["ai_gov_summary"] = governance_result["ai_gov_summary"]

        # 添加水印
        if governance_result["watermark_required"]:
            content["watermark"] = {
                "applied": True,
                "notice": "DRAFT – AI-ASSISTED CONTENT – NOT A FINAL AUDIT OPINION",
                "warnings": governance_result["warnings"],
                "experimental_logic_used": audit_result.get("governance_flags", {}).get("experimental_logic_used", False)
            }

        return content

    def _write_export_files(self, storage_paths: Dict[str, str], export_content: Dict[str, Any],
                          audit_result: Dict[str, Any], export_options: Dict[str, Any],
                          governance_result: Dict[str, Any]):
        """写入导出文件"""
        # 写入artifact文件
        with open(storage_paths["artifact_path"], "w", encoding="utf-8") as f:
            json.dump(export_content, f, ensure_ascii=False, indent=2)

    def _calculate_file_hash(self, file_path: str) -> str:
        """计算文件哈希"""
        hash_sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()

    def _create_artifact_metadata(self, artifact_id: str, audit_result: Dict[str, Any],
                                export_options: Dict[str, Any], governance_result: Dict[str, Any],
                                storage_paths: Dict[str, str], file_hash: str) -> Dict[str, Any]:
        """创建artifact元数据"""
        workflow_id = audit_result.get("workflow_id")
        run_id = audit_result.get("run_id")
        audit_result_id = audit_result.get("audit_result_id")

        metadata = {
            "artifact_id": artifact_id,
            "audit_result_id": audit_result_id,
            "workflow_id": workflow_id,
            "run_id": run_id,
            "file_name": os.path.basename(storage_paths["artifact_path"]),
            "format": export_options.get("format", "json"),
            "ui_link": self._generate_ui_link(audit_result, artifact_id),
            "storage_path": storage_paths["artifact_path"],
            "generated_by": "ExportReportNode v2.0",
            "generated_at": datetime.utcnow().isoformat(),
            "provenance": {
                "audit_result_snapshot_ref": f"/storage/audit/{workflow_id}/{run_id}/{audit_result_id}.json",
                "analysis_snapshot_refs": audit_result.get("metadata", {}).get("analysis_refs", []),
                "ci_scan_report_ref": audit_result.get("metadata", {}).get("ci_scan_report_ref")
            },
            "governance": {
                "experimental_logic_used": audit_result.get("governance_flags", {}).get("experimental_logic_used", False),
                "ai_gov_status": "WARNINGS_ONLY" if governance_result["warnings"] else "CLEAN",
                "ai_gov_summary": governance_result["ai_gov_summary"]
            },
            "access_control": {
                "visibility": "external" if export_options.get("for_external_use") else "internal",
                "signed_url_ttl_seconds": 3600
            },
            "file_hash": file_hash,
            "auditlog_ref": None  # 将在日志记录后填充
        }

        # 写入metadata文件
        with open(storage_paths["metadata_path"], "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)

        return metadata

    def _generate_ui_link(self, audit_result: Dict[str, Any], artifact_id: str) -> str:
        """生成UI链接"""
        workflow_id = audit_result.get("workflow_id")
        run_id = audit_result.get("run_id")
        return f"/ui/exports/{workflow_id}/{run_id}/{artifact_id}"

    def _create_success_result(self, artifact_result: Dict[str, Any], governance_result: Dict[str, Any]) -> Dict[str, Any]:
        """创建成功结果"""
        # 记录审计日志
        audit_log = self._write_auditlog("export_report_success", artifact_result["artifact_id"], {
            "artifact_id": artifact_result["artifact_id"],
            "file_path": artifact_result["file_path"],
            "watermark_applied": governance_result["watermark_required"],
            "warnings": governance_result["warnings"]
        })

        # 更新metadata中的auditlog_ref
        if audit_log and hasattr(audit_log, 'id'):
            artifact_result["metadata"]["auditlog_ref"] = f"/api/auditlogs/{audit_log.id}"

        status = "SUCCESS_WITH_WARNINGS" if governance_result["warnings"] else "SUCCESS"

        return {
            "status": status,
            "artifact_id": artifact_result["artifact_id"],
            "file_path": artifact_result["file_path"],
            "ui_link": artifact_result["ui_link"],
            "metadata_path": artifact_result["metadata_path"],
            "auditlog_ref": artifact_result["metadata"]["auditlog_ref"],
            "warnings": governance_result["warnings"] if governance_result["warnings"] else None
        }

    def _create_blocked_result(self, error_type: str, user_message: str, internal_detail: Dict[str, Any]) -> Dict[str, Any]:
        """创建阻断结果"""
        return {
            "status": "BLOCKED",
            "error_type": error_type,
            "user_message": user_message,
            "internal_detail": internal_detail
        }
        # Validate audit_result shape minimally
        ar = audit_result or {}
        audit_id = ar.get("audit_result_id") or ar.get("audit_result_id") if isinstance(ar, dict) else None

        # Call ai_gov guard
        gov_res = ai_gov.check(ar)

        # If hard violations -> block issuance
        if gov_res.get("violations", {}).get("hard", 0) > 0 or gov_res.get("status") == "FAILED_HARD":
            # instrumentation: log gov_res and audit_id before creating task
            try:
                with open(r"d:\审计数智析v2\.cursor\debug.log", "a", encoding="utf-8") as _dbg:
                    import time as _time
                    _dbg.write(json.dumps({"sessionId":"debug-session","runId":"export_dbg_prewrite","location":"export_node.export_report","message":"hard-violation-detected","data":{"audit_id": audit_id, "gov_res": gov_res},"timestamp":int(_time.time()*1000)}) + "\n")
            except Exception:
                pass
            # also write to per-run log under STORAGE_PATH
            try:
                perrun = os.path.join(getattr(settings, "STORAGE_PATH", "."), "agent_debug.log")
                with open(perrun, "a", encoding="utf-8") as _pr:
                    _pr.write(json.dumps({"sessionId":"debug-session","runId":"export_dbg_prewrite_perrun","location":"export_node.export_report","message":"hard-violation-detected (perrun)","data":{"audit_id": audit_id, "gov_res": gov_res},"timestamp":int(_time.time()*1000)}) + "\n")
            except Exception:
                pass
            # create remediation task and write auditlog
            review_task_id = self._create_human_review_task(ar, reason="AI governance hard violations")
            # instrumentation: just before calling _write_auditlog
            try:
                with open(r"d:\审计数智析v2\.cursor\debug.log", "a", encoding="utf-8") as _dbg:
                    import time as _time
                    _dbg.write(json.dumps({"sessionId":"debug-session","runId":"export_dbg_pre_writecall","location":"export_node.export_report","message":"about to call _write_auditlog","data":{"audit_id": audit_id, "review_task_id": review_task_id},"timestamp":int(_time.time()*1000)}) + "\n")
            except Exception:
                pass
            try:
                perrun = os.path.join(getattr(settings, "STORAGE_PATH", "."), "agent_debug.log")
                with open(perrun, "a", encoding="utf-8") as _pr:
                    _pr.write(json.dumps({"sessionId":"debug-session","runId":"export_dbg_pre_writecall_perrun","location":"export_node.export_report","message":"about to call _write_auditlog (perrun)","data":{"audit_id": audit_id, "review_task_id": review_task_id},"timestamp":int(_time.time()*1000)}) + "\n")
            except Exception:
                pass
            # Try normal audit log path
            log = self._write_auditlog("AI_GOVERNANCE_BLOCK", audit_id, {"ai_gov": gov_res, "review_task_id": review_task_id})
            # instrumentation: after calling _write_auditlog (log may be None)
            try:
                with open(r"d:\审计数智析v2\.cursor\debug.log", "a", encoding="utf-8") as _dbg:
                    import time as _time
                    _dbg.write(json.dumps({"sessionId":"debug-session","runId":"export_dbg_post_writecall","location":"export_node.export_report","message":"returned from _write_auditlog","data":{"log_present": bool(log), "log_id": getattr(log,'id',None)},"timestamp":int(_time.time()*1000)}) + "\n")
            except Exception:
                pass
            try:
                perrun = os.path.join(getattr(settings, "STORAGE_PATH", "."), "agent_debug.log")
                with open(perrun, "a", encoding="utf-8") as _pr:
                    _pr.write(json.dumps({"sessionId":"debug-session","runId":"export_dbg_post_writecall_perrun","location":"export_node.export_report","message":"returned from _write_auditlog (perrun)","data":{"log_present": bool(log), "log_id": getattr(log,'id',None)},"timestamp":int(_time.time()*1000)}) + "\n")
            except Exception:
                pass
            # If no DB record created via Session, attempt a direct sqlite insert as fallback
            if log is None:
                try:
                    # instrumentation
                    with open(r"d:\审计数智析v2\.cursor\debug.log", "a", encoding="utf-8") as _dbg:
                        import time as _time
                        _dbg.write(json.dumps({"sessionId":"debug-session","runId":"export_fallback_sqlite_pre","location":"export_node.export_report","message":"attempting sqlite fallback insert","data":{"DB_PATH": DB_PATH},"timestamp":int(_time.time()*1000)}) + "\n")
                except Exception:
                    pass
                try:
                    conn = sqlite3.connect(DB_PATH, timeout=30)
                    cur = conn.cursor()
                    params_json = json.dumps({"ai_gov": gov_res, "review_task_id": review_task_id}, ensure_ascii=False)
                    cur.execute(
                        "INSERT INTO audit_logs (timestamp, user_id, action_type, target_type, target_id, parameters) VALUES (?, ?, ?, ?, ?, ?)",
                        (datetime.utcnow().isoformat(), "system", "AI_GOVERNANCE_BLOCK", "audit_result", audit_id, params_json)
                    )
                    conn.commit()
                    conn.close()
                    try:
                        with open(r"d:\审计数智析v2\.cursor\debug.log", "a", encoding="utf-8") as _dbg:
                            import time as _time
                            _dbg.write(json.dumps({"sessionId":"debug-session","runId":"export_fallback_sqlite_post","location":"export_node.export_report","message":"sqlite fallback insert succeeded","data":{"audit_id": audit_id},"timestamp":int(_time.time()*1000)}) + "\n")
                    except Exception:
                        pass
                except Exception as e:
                    try:
                        with open(r"d:\审计数智析v2\.cursor\debug.log", "a", encoding="utf-8") as _dbg:
                            import time as _time
                            _dbg.write(json.dumps({"sessionId":"debug-session","runId":"export_fallback_sqlite_err","location":"export_node.export_report","message":"sqlite fallback insert failed","data":{"error": str(e)},"timestamp":int(_time.time()*1000)}) + "\n")
                    except Exception:
                        pass
            # Return structured governance block (do not raise here so callers like tests get structured status)
            status_obj = {"error_type": "AI_GOVERNANCE_BLOCK", "ai_scan_artifact": gov_res.get("report_ref"), "violations_summary": gov_res.get("violations"), "review_task_id": review_task_id}
            try:
                return None, json.dumps(status_obj, ensure_ascii=False)
            except Exception:
                return None, json.dumps(status_obj)

        # Check signatures: require approved for issuance external by default
        sig_status = ar.get("signature_status") or ar.get("signature_status", "")
        if audience == "external":
            required = "approved"
        else:
            # internal may allow approved or draft_with_conditions per policy; keep strict
            required = "approved"

        if sig_status != required:
            # Log and block
            self._write_auditlog("AI_GOVERNANCE_BLOCK", audit_id, {"signature_status": sig_status})
            raise GovernanceError("MISSING_SIGNATURE", f"AuditResult signature_status '{sig_status}' is not '{required}'. Human approval required.", {"signature_status": sig_status})

        # If warnings only -> allow but mark watermark
        watermark = False
        if gov_res.get("violations", {}).get("warnings", 0) > 0 or gov_res.get("status") == "WARN":
            watermark = True

        # Prepare export directory
        storage = getattr(settings, "STORAGE_PATH", "./storage")
        export_dir = os.path.join(storage, "exports", ar.get("workflow_id") or "unknown_workflow", ar.get("run_id") or "unknown_run", ar.get("audit_result_id"))
        os.makedirs(export_dir, exist_ok=True)

        # Create export artifact (JSON + optional watermark annotation)
        file_base = f"{ar.get('audit_result_id')}_{ar.get('version', 'v1')}"
        file_name = f"{file_base}.json"
        file_path = os.path.join(export_dir, file_name)

        # Build export payload: include provenance and ci_scan ref
        export_payload = dict(ar)
        export_payload["exported_at"] = datetime.utcnow().isoformat()
        export_payload["exported_by"] = "system"
        export_payload["ai_gov_summary"] = gov_res

        if watermark:
            export_payload["watermark"] = {
                "notice": "This report contains AI-assisted content and requires human confirmation.",
                "experimental_logic_used": ar.get("governance_flags", {}).get("experimental_logic_used", False)
            }

        # Write payload
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(export_payload, f, ensure_ascii=False, indent=2)

        # Write accompanying metadata.json for provenance
        meta_path = os.path.join(export_dir, "metadata.json")
        meta = {
            "audit_result_id": ar.get("audit_result_id"),
            "ci_scan_report_ref": ar.get("provenance", {}).get("ci_scan_report_ref"),
            "provenance": ar.get("provenance", {}),
            "attachments": ar.get("attachments", []),
            "export_format": export_format,
            "watermark": watermark
        }
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

        # Log export action
        self._write_auditlog("export_report_success", ar.get("audit_result_id"), {"file_path": file_path, "watermark": watermark})

        return {"file_path": file_path, "status": "issued" if not watermark else "issued_with_watermark"}

    def _execute_pure(self, inputs: Dict[str, Any], context: ExecutionContext) -> Dict[str, Any]:
        """执行导出操作的主入口"""
        audit_result_ref = inputs.get("audit_result_ref")
        export_options = inputs.get("export_options", {})
        requester = inputs.get("requester", {})
        ui_flags = inputs.get("ui_flags", {})

        # 设置默认值
        if not export_options.get("format"):
            export_options["format"] = "json"
        if not export_options.get("for_external_use"):
            export_options["for_external_use"] = False

        # 添加上下文信息到requester
        if not requester.get("user_id"):
            requester["user_id"] = context.user_id or "system"
        if not requester.get("request_time"):
            requester["request_time"] = datetime.utcnow().isoformat()

        try:
            result = self.export_audit_report(audit_result_ref, export_options, requester, ui_flags)
            return (result,)
        except Exception as e:
            # 处理意外错误
            error_detail = {
                "error_type": "INTERNAL_ERROR",
                "user_message": "Export failed due to internal error",
                "internal_detail": {"exception": str(e)}
            }
            self._write_auditlog("EXPORT_INTERNAL_ERROR", audit_result_ref.get("audit_result_id"), error_detail)
            return (self._create_blocked_result("INTERNAL_ERROR", "Export failed due to internal error", {"exception": str(e)}),)


NODE_CLASS_MAPPINGS = {
    "ExportReportNode": ExportReportNode
}



