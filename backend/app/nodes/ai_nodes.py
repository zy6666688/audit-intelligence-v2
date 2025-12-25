"""
AI分析层节点 - 文本理解、图像识别和综合分析
"""

import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from .base_node import BaseNode, ExecutionContext, FailurePolicy, NodeMetadata
from app.core.llm_client import call_chat, has_llm_config
from app.core.database import SessionLocal
from app.core.audit_service import AuditService
from app.models.rule_metrics import RuleAction
from app.core.config import settings
from pathlib import Path
import uuid
import tempfile
import os
import hashlib


class ReviewResult:
    """Iterable & indexable result wrapper to support legacy unpacking of 2 or 4 values."""
    def __init__(self, reviewed_items, review_status, review_task_id=None, audit_log_id=None):
        self._items = (reviewed_items, review_status, review_task_id, audit_log_id)

    def __iter__(self):
        for it in self._items:
            yield it

    def __getitem__(self, idx):
        return self._items[idx]

    def __len__(self):
        return len(self._items)


class TextUnderstandingAI(BaseNode):
    """
    文本事实结构化引擎 - 把自然语言文本拆解为可核查、可引用、可复算的结构化事实

    核心职责：文本 → 结构化字段抽取（金额、日期、主体、行为义务等）
    强制要求：原文锚定、字段级置信度、抽取来源标记
    禁止行为：语义总结、合并推理、跨文档推断
    """

    NODE_TYPE = "TextUnderstandingAI"
    VERSION = "2.0.0"
    CATEGORY = "文本结构化"
    DISPLAY_NAME = "文本事实结构化引擎"
    
    @classmethod
    def INPUT_TYPES(cls):
        # flat mapping expected by BaseNode.validate_inputs
        return {
            "text_data": {"type": "STRING", "required": True},
            "template_type": {"type": "STRING", "required": True},
            "custom_fields": {"type": "STRING", "required": False},
            "extraction_method": {"type": "STRING", "required": False},
            "confidence_threshold": {"type": "FLOAT", "required": False},
            "provider": {"type": "STRING", "required": False},
            "model": {"type": "STRING", "required": False},
            "api_key": {"type": "STRING", "required": False},
            "base_url": {"type": "STRING", "required": False},
        }
    
    RETURN_TYPES = ("DICT", "LIST")
    RETURN_NAMES = ("structured_fields", "extraction_metadata")
    FUNCTION = "analyze_text"

    # 字段模板定义 - 结构化字段抽取模板
    FIELD_TEMPLATES = {
        "contract": {
            "amount": {
                "type": "currency",
                "description": "合同金额",
                "patterns": [r"(\d+(?:\.\d+)?)元", r"金额[为:](\d+(?:\.\d+)?)"]
            },
            "effective_date": {
                "type": "date",
                "description": "合同生效日期",
                "patterns": [r"\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?", r"自\d{4}年\d{1,2}月\d{1,2}日起"]
            },
            "expiry_date": {
                "type": "date",
                "description": "合同到期日期",
                "patterns": [r"至\d{4}[-/年]\d{1,2}[-/月]\d{1,2}", r"到期日[为:]\d{4}[-/年]\d{1,2}[-/月]\d{1,2}"]
            },
            "party_a": {
                "type": "entity",
                "description": "甲方/出卖人",
                "patterns": [r"甲方[为:](\w+)", r"出卖人[为:](\w+)"]
            },
            "party_b": {
                "type": "entity",
                "description": "乙方/买受人",
                "patterns": [r"乙方[为:](\w+)", r"买受人[为:](\w+)"]
            },
            "obligation": {
                "type": "obligation",
                "description": "合同义务",
                "patterns": [r"(?:应|须|应当)([^，。；\n]+)", r"责任[为:]([^，。；\n]+)"]
            },
            "condition": {
                "type": "condition",
                "description": "合同条件",
                "patterns": [r"(?:若|如果|当)([^，。；\n]+)(?:则|时)", r"(?:除非|除了)([^，。；\n]+)"]
            },
        },
        "invoice": {
            "amount": {
                "type": "currency",
                "description": "发票金额",
                "patterns": [r"金额[为:]\d+(?:\.\d+)?", r"小计[为:]\d+(?:\.\d+)?元?"]
            },
            "invoice_date": {
                "type": "date",
                "description": "开票日期",
                "patterns": [r"开票日期[为:]\d{4}[-/年]\d{1,2}[-/月]\d{1,2}", r"日期[为:]\d{4}[-/年]\d{1,2}[-/月]\d{1,2}"]
            },
            "tax_amount": {
                "type": "currency",
                "description": "税额",
                "patterns": [r"税额[为:]\d+(?:\.\d+)?", r"增值税[为:]\d+(?:\.\d+)?元?"]
            },
        },
        "regulation": {
            "article_number": {
                "type": "reference",
                "description": "条款编号",
                "patterns": [r"第[一二三四五六七八九十\d]+条", r"第\d+(?:\.\d+)*条"]
            },
            "effective_date": {
                "type": "date",
                "description": "法规生效日期",
                "patterns": [r"自\d{4}年\d{1,2}月\d{1,2}日起施行", r"发布日期[为:]\d{4}[-/年]\d{1,2}[-/月]\d{1,2}"]
            },
            "responsible_party": {
                "type": "entity",
                "description": "责任主体",
                "patterns": [r"由([^，。；\n]+)负责", r"主管部门[为:]([^，。；\n]+)"]
            },
        },
        "note": {
            "amount": {
                "type": "currency",
                "description": "金额",
                "patterns": [r"\d+(?:\.\d+)?元", r"金额\d+(?:\.\d+)?元?"]
            },
            "date": {
                "type": "date",
                "description": "日期",
                "patterns": [r"\d{4}[-/年]\d{1,2}[-/月]\d{1,2}", r"日期[为:]\d{4}[-/年]\d{1,2}[-/月]\d{1,2}"]
            },
            "person": {
                "type": "entity",
                "description": "经办人/负责人",
                "patterns": [r"经([^，。；\n]+)(?:确认|审核|批准)", r"负责人[为:]([^，。；\n]+)"]
            },
        },
    }
    
    def _extract_with_rules(self, text_data: str, template_type: str) -> Dict[str, Any]:
        """基于规则的字段抽取"""
        fields = {}
        template = self.FIELD_TEMPLATES.get(template_type, {})

        for field_name, field_config in template.items():
            patterns = field_config.get("patterns", [])
            field_type = field_config.get("type", "string")

            for pattern in patterns:
                matches = re.finditer(pattern, text_data, re.IGNORECASE)
                for match in matches:
                    value = match.group(1) if len(match.groups()) > 0 else match.group(0)

                    # 记录原文锚定信息
                    if field_name not in fields:
                        fields[field_name] = {
                            "value": value,
                            "confidence": 0.8,  # 规则匹配的默认置信度
                            "evidence": {
                                "start": match.start(),
                                "end": match.end(),
                                "text": match.group(0),
                                "method": "rule"
                            },
                            "extraction_info": {
                                "method": "rule",
                                "pattern": pattern,
                                "timestamp": datetime.now().isoformat()
                            }
                        }
                        break  # 只取第一个匹配

        return fields

    def _extract_with_llm(self, text_data: str, template_type: str, model: str = None,
                         provider: str = None, api_key: str = None, base_url: str = None) -> Dict[str, Any]:
        """基于LLM的字段抽取"""
        template = self.FIELD_TEMPLATES.get(template_type, {})
        field_descriptions = []

        for field_name, field_config in template.items():
            field_type = field_config.get("type", "string")
            desc = f"- {field_name} ({field_type}): {field_config.get('description', f'Extract {field_name}')}"
            field_descriptions.append(desc)

        system_prompt = f"""你是一个审计领域的文本结构化助手。
你的任务是从文本中抽取结构化字段信息。

要求：
1. 只返回JSON格式，不要任何解释文字
2. 每个字段必须包含：value（抽取值）、confidence（0-1置信度）、evidence（原文锚定）
3. evidence必须包含：start/end位置、匹配的原文文本
4. 如果某个字段无法抽取，返回null
5. 置信度要实事求是：明确匹配=0.9，模糊匹配=0.6，无法确定=0.3

输出格式：
{{
  "字段名": {{
    "value": "抽取的值",
    "confidence": 0.8,
    "evidence": {{
      "start": 10,
      "end": 25,
      "text": "原文匹配片段"
    }}
  }},
  ...
}}

要抽取的字段：
{chr(10).join(field_descriptions)}
"""

        user_prompt = f"请从以下文本中抽取结构化信息：\n\n{text_data}"

        try:
            resp = call_chat(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                model=model,
                provider=provider,
                api_key=api_key,
                base_url=base_url,
            )

            content = resp.get("choices", [{}])[0].get("message", {}).get("content", "")

            if content:
                # 尝试解析JSON
                start = content.find("{")
                end = content.rfind("}")
                if start != -1 and end != -1:
                    json_content = content[start:end+1]
                    parsed = json.loads(json_content)

                    # 为每个字段添加提取信息
                    for field_name, field_data in parsed.items():
                        if field_data and isinstance(field_data, dict):
                            field_data["extraction_info"] = {
                                "method": "llm",
                                "model": model or "unknown",
                                "provider": provider or "unknown",
                                "timestamp": datetime.now().isoformat()
                            }

                    return parsed

        except Exception as e:
            print(f"LLM extraction failed: {e}")

        return {}

    def _merge_extractions(self, rule_fields: Dict, llm_fields: Dict, method: str) -> Dict[str, Any]:
        """合并规则和LLM的抽取结果"""
        merged = {}

        all_field_names = set(rule_fields.keys()) | set(llm_fields.keys())

        for field_name in all_field_names:
            rule_field = rule_fields.get(field_name)
            llm_field = llm_fields.get(field_name)

            if method == "rule":
                merged[field_name] = rule_field
            elif method == "llm":
                merged[field_name] = llm_field
            else:  # hybrid
                if rule_field and llm_field:
                    # 比较两个结果，如果一致则提高置信度
                    rule_value = rule_field.get("value")
                    llm_value = llm_field.get("value")

                    if rule_value and llm_value and str(rule_value).strip() == str(llm_value).strip():
                        # 结果一致，合并证据，取较高置信度
                        merged_confidence = max(rule_field.get("confidence", 0), llm_field.get("confidence", 0))
                        merged[field_name] = {
                            **llm_field,
                            "confidence": min(merged_confidence + 0.1, 1.0),  # 奖励一致性
                            "evidence": {
                                "rule": rule_field.get("evidence"),
                                "llm": llm_field.get("evidence")
                            },
                            "extraction_info": {
                                "method": "hybrid",
                                "rule_match": True,
                                "llm_match": True,
                                "timestamp": datetime.now().isoformat()
                            }
                        }
                    else:
                        # 结果不一致，保留LLM结果但降低置信度
                        merged[field_name] = {
                            **llm_field,
                            "confidence": llm_field.get("confidence", 0) * 0.8,  # 惩罚不一致
                            "conflict": {
                                "rule_value": rule_value,
                                "llm_value": llm_value
                            },
                            "extraction_info": {
                                "method": "hybrid",
                                "conflict": True,
                                "rule_value": rule_value,
                                "llm_value": llm_value,
                                "timestamp": datetime.now().isoformat()
                            }
                        }
                elif rule_field:
                    merged[field_name] = rule_field
                elif llm_field:
                    merged[field_name] = llm_field

        return merged

    def analyze_text(
        self,
        text_data: str,
        template_type: str,
        custom_fields: Optional[str] = None,
        extraction_method: str = "hybrid",
        confidence_threshold: float = 0.7,
        model: Optional[str] = None,
        provider: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        """
        文本事实结构化引擎 - 把自然语言文本拆解为可核查、可引用、可复算的结构化事实

        Args:
            text_data: 输入的文本数据
            template_type: 字段模板类型 (contract/invoice/regulation/note/custom)
            custom_fields: 自定义字段模板 (JSON格式)
            extraction_method: 抽取方法 (hybrid/llm/rule)
            confidence_threshold: 置信度阈值，低于此值标记为需要人工复核

        Returns:
            structured_fields: 结构化字段字典
            extraction_metadata: 抽取元数据列表
        """
        # 初始化输出结构
        structured_fields: Dict[str, Any] = {}
        extraction_metadata: List[Dict[str, Any]] = []

        # 处理自定义字段模板
        if template_type == "custom" and custom_fields:
            try:
                custom_template = json.loads(custom_fields)
                self.FIELD_TEMPLATES["custom"] = custom_template
            except json.JSONDecodeError:
                extraction_metadata.append({
                    "type": "error",
                    "message": "自定义字段模板JSON格式错误",
                    "timestamp": datetime.now().isoformat()
                })

        # 执行抽取
        rule_fields = {}
        llm_fields = {}

        # 规则抽取
        if extraction_method in ["rule", "hybrid"]:
            rule_fields = self._extract_with_rules(text_data, template_type)

        # LLM抽取
        if extraction_method in ["llm", "hybrid"] and has_llm_config(provider):
            llm_fields = self._extract_with_llm(text_data, template_type, model, provider, api_key, base_url)

        # 合并结果
        structured_fields = self._merge_extractions(rule_fields, llm_fields, extraction_method)

        # 应用置信度阈值，标记需要人工复核的字段
        for field_name, field_data in structured_fields.items():
            if field_data and isinstance(field_data, dict):
                confidence = field_data.get("confidence", 0)
                if confidence < confidence_threshold:
                    field_data["needs_human_review"] = True
                    field_data["review_reason"] = f"置信度 {confidence:.2f} 低于阈值 {confidence_threshold}"

        # 生成抽取元数据
        extraction_metadata.append({
            "extraction_method": extraction_method,
            "template_type": template_type,
            "total_fields_attempted": len(self.FIELD_TEMPLATES.get(template_type, {})),
            "fields_extracted": len([f for f in structured_fields.values() if f is not None]),
            "low_confidence_fields": len([f for f in structured_fields.values()
                                        if f and f.get("needs_human_review")]),
            "timestamp": datetime.now().isoformat(),
            "text_length": len(text_data),
            "text_hash": hashlib.sha256(text_data.encode()).hexdigest()[:16]
        })

        return structured_fields, extraction_metadata


class ImageRecognitionAI(BaseNode):
    """
    3B 图像/票据识别AI - 深度票据审查
    """
    
    NODE_TYPE = "ImageRecognitionAI"
    VERSION = "1.0.0"
    CATEGORY = "AI分析"
    DISPLAY_NAME = "票据识别AI"
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "ocr_text": ("STRING", {}),
                "check_type": (["duplicate", "authenticity", "anomaly"], {"default": "anomaly"})
            }
        }
    
    RETURN_TYPES = ("DICT", "LIST")
    RETURN_NAMES = ("validation_result", "anomaly_flags")
    FUNCTION = "recognize_ticket"
    
    def recognize_ticket(self, ocr_text: str, check_type: str):
        """票据识别处理

        返回约定格式：
        - 第一个返回值为 response dict（包含 schema_version/response_id/processed_at/model_version/disclaimer/validation_result/warnings/errors）
        - 第二个返回值为 anomaly_flags 列表（每项结构化为 {code, message, provenance?}）
        保持向后兼容：原先直接返回 validation_result dict 的逻辑仍可由 response["validation_result"] 访问。
        """
        # 基本校验与约束
        MAX_OCR_CHARS = 200000
        response_meta = {
            "schema_version": "ImageRecognitionAI:v0.1",
            "response_id": str(uuid.uuid4()),
            "processed_at": datetime.utcnow().isoformat(),
            "model_version": None,
            "disclaimer": "machine-generated; for reviewer use only",
            "warnings": [],
            "errors": None,
        }

        validation_result: Dict[str, Any] = {}
        anomaly_flags: List[Dict[str, Any]] = []

        if ocr_text is None:
            response_meta["errors"] = {
                "code": "INVALID_INPUT",
                "message": "ocr_text is required",
            }
            return response_meta, anomaly_flags

        if len(ocr_text) > MAX_OCR_CHARS:
            response_meta["errors"] = {
                "code": "PAYLOAD_TOO_LARGE",
                "message": f"ocr_text exceeds max allowed chars ({MAX_OCR_CHARS})",
                "details": {"max_chars": MAX_OCR_CHARS, "received_chars": len(ocr_text)},
            }
            return response_meta, anomaly_flags

        # === 逻辑分支 ===
        try:
            if check_type == "duplicate":
                # 重复检查（模拟）
                validation_result["is_duplicate"] = False
                validation_result["confidence"] = round(0.95, 4)
                response_meta["model_version"] = "rule-based-v0.1"

            elif check_type == "authenticity":
                # 真伪检查
                validation_result["is_authentic"] = True
                response_meta["model_version"] = "rule-based-v0.1"

                # 检查必要元素，结构化 anomaly flags
                if "发票号" not in ocr_text:
                    anomaly_flags.append({"code": "MISSING_INVOICE_NO", "message": "缺少发票号", "provenance": {"snippet": None}})
                if "税号" not in ocr_text:
                    anomaly_flags.append({"code": "MISSING_TAX_ID", "message": "缺少税号", "provenance": {"snippet": None}})

            elif check_type == "anomaly":
                # 异常检测
                response_meta["model_version"] = "rule-based-v0.1"
                if "作废" in ocr_text:
                    anomaly_flags.append({"code": "VOIDED", "message": "发票已作废", "provenance": {"snippet": "作废"}})
                if "过期" in ocr_text:
                    anomaly_flags.append({"code": "EXPIRED", "message": "发票已过期", "provenance": {"snippet": "过期"}})

            # 额外汇总信息
            validation_result.setdefault("text_length", len(ocr_text))

        except Exception as e:
            # 异常时返回错误契约，保持 response meta 存在
            response_meta["errors"] = {"code": "INTERNAL_ERROR", "message": str(e)}
            return response_meta, anomaly_flags

        # 最终封装返回（向后兼容：旧代码期望第一个返回值是 dict）
        response_meta["validation_result"] = validation_result
        # 如果没有结构化 anomaly flags，保持 [] 以便下游统一处理
        return response_meta, anomaly_flags


class AnalysisReasoningAI(BaseNode):
    """
    3C 分析推理AI - 综合风险判断
    """
    
    NODE_TYPE = "AnalysisReasoningAI"
    VERSION = "1.0.0"
    CATEGORY = "AI分析"
    DISPLAY_NAME = "分析推理AI"
    
    INPUT_TYPES = {
        "risk_items": {"type": "DATAFRAME", "required": True},
        "metrics": {"type": "DICT", "required": True},
        "text_analysis": {"type": "DICT", "required": False},
        "image_analysis": {"type": "DICT", "required": False},
    }
    
    RETURN_TYPES = ("DICT", "STRING", "LIST")
    RETURN_NAMES = ("risk_assessment", "risk_level", "suggestions")
    FUNCTION = "analyze_risk"
    
    def analyze_risk(self, risk_items: pd.DataFrame, metrics: Dict, 
                    text_analysis: Dict = None, image_analysis: Dict = None):
        """综合风险分析"""
        
        # 计算风险分数
        risk_score = 0
        risk_factors = []
        
        # 规则命中
        if not risk_items.empty:
            rule_count = len(risk_items)
            high_risk_count = len(risk_items[risk_items.get("risk_level", "") == "HIGH"]) if "risk_level" in risk_items.columns else 0
            
            risk_score += rule_count * 10 + high_risk_count * 15
            risk_factors.append(f"触发{rule_count}条规则")
        
        # 文本风险
        if text_analysis and text_analysis.get("has_risk_words"):
            risk_score += 20
            risk_factors.append("包含风险关键词")
        
        # 图像异常
        if image_analysis and len(image_analysis.get("anomaly_flags", [])) > 0:
            risk_score += 15
            risk_factors.append("票据存在异常")
        
        # 确定风险等级
        if risk_score >= 50:
            risk_level = "HIGH"
        elif risk_score >= 20:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"
        
        # 生成建议
        suggestions = []
        if risk_level == "HIGH":
            suggestions.append("建议立即进行人工复核")
            suggestions.append("重点检查异常交易记录")
        elif risk_level == "MEDIUM":
            suggestions.append("建议抽样复核")
        else:
            suggestions.append("常规审计程序即可")
        
        risk_assessment = {
            "risk_score": risk_score,
            "risk_factors": risk_factors,
            "assessment_time": datetime.now().isoformat()
        }
        
        return risk_assessment, risk_level, suggestions

    # Governance error for boundary violations
    class GovernanceViolationError(Exception):
        pass

    def _execute_pure(self, inputs: Dict[str, Any], context: ExecutionContext) -> Dict[str, Any]:
        """
        Enforce input boundaries, call analyze_risk, persist snapshot atomically, and return analysis_result.
        """
        # Input boundary enforcement: forbid raw file/dataframe keys like 'dataframe', 'raw_dataframe', 'file_path'
        forbidden_keys = ["dataframe", "raw_dataframe", "file_path", "file", "raw_file"]
        for k in inputs.keys():
            lk = k.lower()
            for fk in forbidden_keys:
                if fk in lk:
                    # log audit entry and raise governance error
                    try:
                        db = SessionLocal()
                        AuditService.log(db, action_type="governance_violation", target_type="analysis_node", target_id=self.NODE_TYPE, parameters={"key": k, "reason": "forbidden input"})
                        db.close()
                    except Exception:
                        pass
                    raise self.GovernanceViolationError(f"Forbidden input key detected: {k}")

        # Extract allowed inputs
        risk_items = inputs.get("risk_items")
        metrics = inputs.get("metrics") or inputs.get("common_metrics") or {}
        human_review_states = inputs.get("human_review_states", {})

        # Run analysis
        risk_assessment, risk_level, suggestions = self.analyze_risk(risk_items, metrics, text_analysis=inputs.get("text_analysis"), image_analysis=inputs.get("image_analysis"))

        # Build analysis result
        analysis_id = uuid.uuid4().hex
        workflow_id = inputs.get("workflow_id") or context.workflow_id
        run_id = inputs.get("run_id") or context.run_id
        generated_at = datetime.utcnow().isoformat()

        model_info = {
            "model_name": getattr(settings, "ANALYSIS_MODEL_NAME", "internal-rules"),
            "model_version": getattr(settings, "ANALYSIS_MODEL_VERSION", "v1"),
            "provider": getattr(settings, "ANALYSIS_MODEL_PROVIDER", "internal"),
            "generation_mode": getattr(settings, "ANALYSIS_GENERATION_MODE", "rules-only"),
        }

        input_summary = {
            "metric_keys": list(metrics.keys()) if isinstance(metrics, dict) else [],
            "human_review_keys": list(human_review_states.keys()) if isinstance(human_review_states, dict) else [],
        }

        explanations = []
        for idx, s in enumerate(suggestions or []):
            explanations.append({"explanation_id": f"ex_{idx}", "text": str(s), "references": []})

        provenance = {
            "node_id": self.NODE_TYPE,
            "code_version": getattr(settings, "APP_VERSION", "unknown"),
            "ruleset_version": getattr(settings, "RULESET_VERSION", "unknown"),
        }

        analysis_obj = {
            "analysis_id": analysis_id,
            "workflow_id": workflow_id,
            "run_id": run_id,
            "generated_at": generated_at,
            "model_info": model_info,
            "input_summary": input_summary,
            "explanations": explanations,
            "disclaimer": "This analysis was system-generated and requires human confirmation before being used as an audit conclusion.",
            "provenance": provenance,
            "metadata": {"schema_version": "analysis_v1"}
        }

        # persist snapshot atomically
        storage_root = getattr(settings, "STORAGE_PATH", "./storage")
        analysis_dir = Path(storage_root) / "analysis" / (workflow_id or "unknown_workflow") / (run_id or "unknown_run")
        analysis_dir.mkdir(parents=True, exist_ok=True)
        final_path = analysis_dir / f"{analysis_id}.json"
        # write temp file then atomic replace
        try:
            fd, tmp_path = tempfile.mkstemp(dir=str(analysis_dir), prefix=f".{analysis_id}.", text=True)
            with os.fdopen(fd, "w", encoding="utf-8") as tf:
                import json as _json
                content = {**analysis_obj, "risk_assessment": risk_assessment, "risk_level": risk_level}
                raw = _json.dumps(content, ensure_ascii=False, sort_keys=True, indent=2, default=str)
                tf.write(raw)
                tf.flush()
                os.fsync(tf.fileno())
            # compute file hash
            h = hashlib.sha256()
            with open(tmp_path, "rb") as rb:
                for chunk in iter(lambda: rb.read(8192), b""):
                    h.update(chunk)
            file_hash = h.hexdigest()
            # attach hash and write final
            analysis_obj["metadata"]["file_hash"] = file_hash
            # rewrite tmp with hash included
            import json as _json2
            with open(tmp_path, "w", encoding="utf-8") as tf:
                content2 = {**analysis_obj, "risk_assessment": risk_assessment, "risk_level": risk_level}
                tf.write(_json2.dumps(content2, ensure_ascii=False, sort_keys=True, indent=2, default=str))
                tf.flush()
                os.fsync(tf.fileno())
            os.replace(tmp_path, str(final_path))
        except Exception as e:
            try:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
            except Exception:
                pass
            raise

        # audit log entry
        try:
            db = SessionLocal()
            AuditService.log(db, action_type="analysis_snapshot_created", target_type="analysis", target_id=analysis_id, parameters={"storage_path": str(final_path)})
            db.close()
        except Exception:
            pass

        return {"analysis_result": {**analysis_obj, "risk_assessment": risk_assessment, "risk_level": risk_level}, "analysis_id": analysis_id, "storage_path": str(final_path)}


class HumanReviewNode(BaseNode):
    """
    审计决策登记器 - 把人的明确决策记录成可追溯、可复核、可签字的系统事实

    核心职责：记录人工决策，驱动审计状态转换，确保审计结论的合法性
    禁止行为：自行计算风险、自动生成结论、修改原始证据、覆盖AI/规则结果

    API钩子：
    - 入站：create_review_task（被ExportReportNode等调用）
    - 出站：commit_review_decision（人工调用）
    """

    NODE_TYPE = "HumanReviewNode"
    VERSION = "2.0.0"
    CATEGORY = "审计决策"
    DISPLAY_NAME = "审计决策登记器"
    
    @classmethod
    def INPUT_TYPES(cls):
        # flat mapping expected by BaseNode.validate_inputs
        return {
            "action": {"type": "STRING", "required": True},
            # For create_task action
            "audit_result_id": {"type": "STRING", "required": False},
            "trigger_source": {"type": "STRING", "required": False},
            "trigger_reason": {"type": "STRING", "required": False},
            "affected_rule_ids": {"type": "LIST", "required": False},
            "analysis_refs": {"type": "LIST", "required": False},
            # For commit_decision action
            "task_id": {"type": "STRING", "required": False},
            "reviewer_id": {"type": "STRING", "required": False},
            "reviewer_name": {"type": "STRING", "required": False},
            "reviewer_role": {"type": "STRING", "required": False},
            "reviewer_license": {"type": "STRING", "required": False},
            "decision_type": {"type": "STRING", "required": False},
            "decision_comment": {"type": "STRING", "required": False},
            "override_reason": {"type": "STRING", "required": False},
        }

    RETURN_TYPES = ("DICT",)
    RETURN_NAMES = ("result",)
    FUNCTION = "process_review_action"
    
    def process_review_action(self, action: str, **kwargs):
        """
        处理人工审核动作 - 审计决策登记器的核心方法

        Args:
            action: "create_task" | "commit_decision"
            **kwargs: 对应的参数

        Returns:
            结果字典
        """
        if action == "create_task":
            result = self._create_review_task(**kwargs)
            return (result,)  # Return as tuple for BaseNode
        elif action == "commit_decision":
            result = self._commit_review_decision(**kwargs)
            return (result,)  # Return as tuple for BaseNode
        else:
            result = {
                "status": "error",
                "message": f"Unsupported action: {action}",
                "supported_actions": ["create_task", "commit_decision"]
            }
            return (result,)  # Return as tuple for BaseNode

    def _create_review_task(self, audit_result_id: str = None, trigger_source: str = "ai_gov",
                           trigger_reason: str = "", affected_rule_ids: List[str] = None,
                           analysis_refs: List[str] = None, **kwargs):
        """
        创建人工复核任务 - 入站钩子，被其他节点调用

        Args:
            audit_result_id: 审计结果ID
            trigger_source: 触发来源 (ai_gov/rule/analysis/export)
            trigger_reason: 触发原因
            affected_rule_ids: 受影响的规则ID列表
            analysis_refs: 分析引用列表

        Returns:
            任务创建结果
        """
        # 生成任务ID
        task_id = f"hr_{uuid.uuid4().hex[:12]}"

        # 构建任务payload
        task_payload = {
            "task_id": task_id,
            "audit_result_id": audit_result_id,
            "trigger_source": trigger_source,
            "trigger_reason": trigger_reason,
            "affected_rule_ids": affected_rule_ids or [],
            "analysis_refs": analysis_refs or [],
            "created_at": datetime.now().isoformat(),
            "status": "pending_review",  # 明确的状态机状态
            "created_by": "system",  # 系统自动创建
        }

        # 持久化任务到存储
        storage_path = getattr(settings, "STORAGE_PATH", "./storage")
        task_dir = Path(storage_path) / "tasks" / "human_review"
        task_dir.mkdir(parents=True, exist_ok=True)
        task_file = task_dir / f"{task_id}.json"

        try:
            # 原子写入
            tmp_file = task_dir / f".{task_id}.tmp"
            tmp_file.write_text(json.dumps(task_payload, ensure_ascii=False, indent=2), encoding="utf-8")
            os.replace(str(tmp_file), str(task_file))
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to persist task: {str(e)}",
                "task_id": task_id
            }

        # 写入审计日志 - RuleAction
        audit_log_id = None
        try:
            session = SessionLocal()
            ra = RuleAction(
                user_id="system",
                action="human_review_task_created",
                rule_id=None,  # 人工复核任务不是针对特定规则
                reason=f"Human review task created: {trigger_reason}",
                metadata={
                    "task_id": task_id,
                    "trigger_source": trigger_source,
                    "audit_result_id": audit_result_id
                }
            )
            session.add(ra)
            session.commit()
            session.refresh(ra)
            audit_log_id = ra.id
        except Exception:
            try:
                session.rollback()
            except Exception:
                pass
        finally:
            try:
                session.close()
            except Exception:
                pass

        return {
            "status": "created",
            "task_id": task_id,
            "review_task_id": task_id,  # 向后兼容
            "audit_log_id": audit_log_id,
            "task_payload": task_payload
        }

    def _commit_review_decision(self, task_id: str, reviewer_id: str, reviewer_name: str,
                               reviewer_role: str = "auditor", reviewer_license: str = "",
                               decision_type: str = "approve", decision_comment: str = "",
                               override_reason: str = "", **kwargs):
        """
        提交人工审核决策 - 出站钩子，人工调用

        Args:
            task_id: 任务ID
            reviewer_id: 审核人ID
            reviewer_name: 审核人姓名
            reviewer_role: 审核人角色
            reviewer_license: 审核人执业证号
            decision_type: 决策类型 (approve/reject/request_changes/override)
            decision_comment: 决策评论（必填）
            override_reason: 覆盖原因（override时必填）

        Returns:
            决策提交结果
        """
        # 验证必填字段
        if not decision_comment.strip():
            return {
                "status": "error",
                "message": "decision_comment is required and cannot be empty",
                "task_id": task_id
            }

        if decision_type == "override" and not override_reason.strip():
            return {
                "status": "error",
                "message": "override_reason is required for override decisions",
                "task_id": task_id
            }

        # 读取任务
        storage_path = getattr(settings, "STORAGE_PATH", "./storage")
        task_dir = Path(storage_path) / "tasks" / "human_review"
        task_file = task_dir / f"{task_id}.json"

        if not task_file.exists():
            return {
                "status": "error",
                "message": "Review task not found",
                "task_id": task_id
            }

        try:
            task_payload = json.loads(task_file.read_text(encoding="utf-8"))
        except Exception:
            return {
                "status": "error",
                "message": "Failed to read review task",
                "task_id": task_id
            }

        # 验证任务状态
        current_status = task_payload.get("status")
        if current_status not in ["pending_review", "in_review"]:
            return {
                "status": "error",
                "message": f"Task status '{current_status}' does not allow decision commit",
                "task_id": task_id
            }

        # 查找对应的AuditResult
        audit_result_id = task_payload.get("audit_result_id")
        snapshot_path = self._locate_audit_result_snapshot(audit_result_id, task_payload)

        if not snapshot_path:
            return {
                "status": "error",
                "message": "Associated audit result not found",
                "task_id": task_id,
                "audit_result_id": audit_result_id
            }

        # 读取并更新AuditResult
        try:
            audit_result = json.loads(snapshot_path.read_text(encoding="utf-8"))
        except Exception:
            return {
                "status": "error",
                "message": "Failed to read audit result",
                "task_id": task_id
            }

        # 准备签名条目
        reviewer_info = {
            "id": reviewer_id,
            "name": reviewer_name,
            "role": reviewer_role,
            "license": reviewer_license,
            "decision_time": datetime.now().isoformat(),
            "decision_type": decision_type,
            "comment": decision_comment
        }

        if decision_type == "override":
            reviewer_info["override_reason"] = override_reason

        # 更新签名和状态
        signatures = audit_result.get("signatures", {})
        metadata = audit_result.get("metadata", {})

        if decision_type == "approve":
            signatures["approved_by"] = reviewer_info
            audit_result["signature_status"] = "approved"
            new_status = "approved"
        elif decision_type == "reject":
            signatures["rejected_by"] = reviewer_info
            audit_result["signature_status"] = "rejected"
            new_status = "rejected"
        elif decision_type == "request_changes":
            signatures["changes_requested_by"] = reviewer_info
            audit_result["signature_status"] = "changes_required"
            new_status = "changes_required"
        elif decision_type == "override":
            signatures["overridden_by"] = reviewer_info
            audit_result["signature_status"] = "approved"  # override后变为approved
            new_status = "approved"
        else:
            return {
                "status": "error",
                "message": f"Unsupported decision_type: {decision_type}",
                "task_id": task_id
            }

        audit_result["signatures"] = signatures

        # 添加人工复核引用
        human_review_refs = metadata.get("human_review_refs", [])
        human_review_refs.append({
            "task_id": task_id,
            "decision": decision_type,
            "reviewer": reviewer_id,
            "timestamp": reviewer_info["decision_time"]
        })
        metadata["human_review_refs"] = human_review_refs
        audit_result["metadata"] = metadata

        # 创建新版本快照
        versions_dir = snapshot_path.parent
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        new_snapshot_name = f"{audit_result_id}_reviewed_{timestamp}.json"
        new_snapshot_path = versions_dir / new_snapshot_name

        try:
            # 原子写入
            tmp_file = versions_dir / f".{new_snapshot_name}.tmp"
            tmp_file.write_text(json.dumps(audit_result, ensure_ascii=False, indent=2), encoding="utf-8")
            os.replace(str(tmp_file), str(new_snapshot_path))
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to write updated audit result: {str(e)}",
                "task_id": task_id
            }

        # 写入审计日志
        try:
            db = SessionLocal()
            AuditService.log(
                db,
                action_type=f"human_review_{decision_type}",
                target_type="audit_result",
                target_id=audit_result_id,
                parameters={
                    "task_id": task_id,
                    "reviewer_id": reviewer_id,
                    "reviewer_name": reviewer_name,
                    "decision_type": decision_type,
                    "decision_comment": decision_comment
                }
            )
            db.close()
        except Exception:
            pass

        # 更新任务状态
        task_payload["status"] = new_status
        task_payload["completed_at"] = datetime.now().isoformat()
        task_payload["reviewer"] = reviewer_info

        completed_dir = task_dir / "completed"
        completed_dir.mkdir(parents=True, exist_ok=True)
        completed_file = completed_dir / f"{task_id}.json"

        try:
            completed_file.write_text(json.dumps(task_payload, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass

        return {
            "status": "completed",
            "task_id": task_id,
            "decision_type": decision_type,
            "new_signature_status": audit_result["signature_status"],
            "snapshot_path": str(new_snapshot_path),
            "reviewer_info": reviewer_info
        }

    def _locate_audit_result_snapshot(self, audit_result_id: str = None, task_payload: Dict = None):
        """定位AuditResult快照文件"""
        storage_path = getattr(settings, "STORAGE_PATH", "./storage")
        audit_root = Path(storage_path) / "audit"

        # 1. 通过audit_result_id直接查找
        if audit_result_id:
            for snapshot_file in audit_root.rglob(f"*{audit_result_id}*.json"):
                return snapshot_file

        # 2. 通过workflow_id和run_id推断
        if task_payload:
            workflow_id = task_payload.get("workflow_id") or task_payload.get("workflow")
            run_id = task_payload.get("run_id") or task_payload.get("run")

            if workflow_id and run_id:
                candidate_dir = audit_root / workflow_id / run_id
                if candidate_dir.exists():
                    # 选择最新的文件
                    json_files = list(candidate_dir.glob("*.json"))
                    if json_files:
                        return max(json_files, key=lambda p: p.stat().st_mtime)

        return None

    # 向后兼容的方法 - 建议逐步迁移到新的API
    def create_from_remediation_task(self, task_id: str):
        """
        向后兼容方法 - 从现有的remediation任务创建人工复核条目
        建议迁移到新的 process_review_action(action="create_task", ...) API
        """
        return self._create_review_task(audit_result_id=None, trigger_source="remediation",
                                       trigger_reason=f"Legacy remediation task {task_id}")

    # 向后兼容的方法 - 建议逐步迁移到新的API
    def complete_review_and_sign(self, task_id: str, reviewer: Dict[str, str], decision: str, comment: Optional[str] = None):
        """
        向后兼容方法 - 完成remediation任务并签名
        建议迁移到新的 process_review_action(action="commit_decision", ...) API
        """
        # 映射旧的参数格式到新的API
        decision_type_map = {
            "approve": "approve",
            "reject": "reject"
        }

        if decision not in decision_type_map:
            return {"task_id": task_id, "status": "error", "message": f"Unsupported decision: {decision}"}

        return self._commit_review_decision(
            task_id=task_id,
            reviewer_id=reviewer.get("id", ""),
            reviewer_name=reviewer.get("name", ""),
            reviewer_role=reviewer.get("role", "auditor"),
            reviewer_license=reviewer.get("license", ""),
            decision_type=decision_type_map[decision],
            decision_comment=comment or ""
        )


NODE_CLASS_MAPPINGS = {
    "TextUnderstandingAI": TextUnderstandingAI,
    "ImageRecognitionAI": ImageRecognitionAI,
    "AnalysisReasoningAI": AnalysisReasoningAI,
    "HumanReviewNode": HumanReviewNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "TextUnderstandingAI": "文本理解AI",
    "ImageRecognitionAI": "票据识别AI",
    "AnalysisReasoningAI": "分析推理AI",
    "HumanReviewNode": "人工审核"
}
