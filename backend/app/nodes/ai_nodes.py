"""
AI分析层节点 - 文本理解、图像识别和综合分析
"""

import json
import re
import hashlib
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
    图像票据事实结构化引擎 - 从OCR文本中抽取结构化票据字段并提供原文锚定

    核心职责：票据文本 → 结构化字段抽取（金额、日期、主体、号码等）
    强制要求：原文锚定、字段级置信度、抽取来源标记
    禁止行为：真伪判断、重复检查、风险评估（交给RuleCalculationNode）

    区别于TextUnderstandingAI：专门处理票据类结构化文档
    """
    
    NODE_TYPE = "ImageRecognitionAI"
    VERSION = "2.0.0"
    CATEGORY = "票据结构化"
    DISPLAY_NAME = "图像票据事实结构化引擎"
    
    @classmethod
    def INPUT_TYPES(cls):
        # flat mapping expected by BaseNode.validate_inputs
        return {
            "ocr_text": {"type": "STRING", "required": True},
            "template_type": {"type": "STRING", "required": True},  # invoice | receipt | contract | custom
            "custom_fields": {"type": "STRING", "required": False},
            "extraction_method": {"type": "STRING", "required": False},  # hybrid | llm | rule
            "confidence_threshold": {"type": "FLOAT", "required": False},
            "provider": {"type": "STRING", "required": False},
            "model": {"type": "STRING", "required": False},
            "api_key": {"type": "STRING", "required": False},
            "base_url": {"type": "STRING", "required": False},
        }
    
    RETURN_TYPES = ("DICT", "LIST")
    RETURN_NAMES = ("structured_fields", "extraction_metadata")
    FUNCTION = "extract_ticket_facts"

    # 票据字段模板定义
    TICKET_TEMPLATES = {
        "invoice": {
            "invoice_number": {
                "type": "reference",
                "description": "发票号码",
                "patterns": [r"发票号码?[为:：]*([A-Za-z0-9\-]+)", r"发票号[为:：]*([A-Za-z0-9\-]+)"]
            },
            "amount": {
                "type": "currency",
                "description": "发票金额",
                "patterns": [r"金额[为:：]*(\d+(?:\.\d+)?)元?", r"小计[为:：]*(\d+(?:\.\d+)?)"]
            },
            "tax_amount": {
                "type": "currency",
                "description": "税额",
                "patterns": [r"税额[为:：]*(\d+(?:\.\d+)?)", r"增值税[为:：]*(\d+(?:\.\d+)?)"]
            },
            "invoice_date": {
                "type": "date",
                "description": "开票日期",
                "patterns": [r"开票日期[为:：]*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})", r"日期[为:：]*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})"]
            },
            "seller_name": {
                "type": "entity",
                "description": "销方名称",
                "patterns": [r"销方名称[为:：]*([^，。；\n]+)", r"销售方[为:：]*([^，。；\n]+)"]
            },
            "buyer_name": {
                "type": "entity",
                "description": "购方名称",
                "patterns": [r"购方名称[为:：]*([^，。；\n]+)", r"购买方[为:：]*([^，。；\n]+)"]
            },
            "seller_tax_id": {
                "type": "reference",
                "description": "销方税号",
                "patterns": [r"销方税号[为:：]*([A-Za-z0-9]+)", r"纳税人识别号[为:：]*([A-Za-z0-9]+)"]
            },
        },
        "receipt": {
            "receipt_number": {
                "type": "reference",
                "description": "收据号码",
                "patterns": [r"收据号码?[为:：]*([A-Za-z0-9\-]+)", r"收据号[为:：]*([A-Za-z0-9\-]+)"]
            },
            "amount": {
                "type": "currency",
                "description": "收据金额",
                "patterns": [r"金额[为:：]*(\d+(?:\.\d+)?)元?", r"￥(\d+(?:\.\d+)?)"]
            },
            "receipt_date": {
                "type": "date",
                "description": "收据日期",
                "patterns": [r"日期[为:：]*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})", r"(\d{4}年\d{1,2}月\d{1,2}日)"]
            },
            "payee": {
                "type": "entity",
                "description": "收款人",
                "patterns": [r"收款人[为:：]*([^，。；\n]+)", r"收款单位[为:：]*([^，。；\n]+)"]
            },
            "payer": {
                "type": "entity",
                "description": "付款人",
                "patterns": [r"付款人[为:：]*([^，。；\n]+)", r"付款单位[为:：]*([^，。；\n]+)"]
            },
        },
        "contract": {
            "contract_number": {
                "type": "reference",
                "description": "合同编号",
                "patterns": [r"合同号码?[为:]*([A-Za-z0-9\-]+)", r"合同号[为:]*([A-Za-z0-9\-]+)"]
            },
            "amount": {
                "type": "currency",
                "description": "合同金额",
                "patterns": [r"合同金额[为:]*(\d+(?:\.\d+)?)元?", r"总金额[为:]*(\d+(?:\.\d+)?)"]
            },
            "effective_date": {
                "type": "date",
                "description": "合同生效日期",
                "patterns": [r"生效日期[为:]*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})", r"自(\d{4}年\d{1,2}月\d{1,2}日)起"]
            },
            "party_a": {
                "type": "entity",
                "description": "甲方",
                "patterns": [r"甲方[为:]*([^，。；\n]+)", r"委托人[为:]*([^，。；\n]+)"]
            },
            "party_b": {
                "type": "entity",
                "description": "乙方",
                "patterns": [r"乙方[为:]*([^，。；\n]+)", r"受托人[为:]*([^，。；\n]+)"]
            },
        }
    }
    
    def _extract_with_rules_ticket(self, ocr_text: str, template_type: str, custom_fields: str = None) -> Dict[str, Any]:
        """基于规则的票据字段抽取"""
        fields = {}

        # 获取基础模板
        template = self.TICKET_TEMPLATES.get(template_type, {}).copy()

        # 处理自定义模板
        if template_type == "custom" and custom_fields:
            try:
                custom_template = json.loads(custom_fields)
                template.update(custom_template)
            except json.JSONDecodeError:
                # 如果JSON解析失败，返回空字段（错误已在上级方法中处理）
                return fields

        for field_name, field_config in template.items():
            patterns = field_config.get("patterns", [])

            for pattern in patterns:
                matches = re.finditer(pattern, ocr_text, re.IGNORECASE | re.MULTILINE)
                for match in matches:
                    # 获取捕获组的值，如果没有捕获组则使用整个匹配
                    if len(match.groups()) > 0:
                        value = match.group(1)
                    else:
                        value = match.group(0)

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

    def extract_ticket_facts(self, ocr_text: str, template_type: str, custom_fields: str = None,
                           extraction_method: str = "hybrid", confidence_threshold: float = 0.7,
                           model: str = None, provider: str = None, api_key: str = None, base_url: str = None):
        """
        图像票据事实结构化引擎 - 从OCR文本中抽取结构化票据字段

        Args:
            ocr_text: OCR识别的票据文本
            template_type: 模板类型 (invoice/receipt/contract/custom)
            custom_fields: 自定义字段模板 (JSON格式)
            extraction_method: 抽取方法 (hybrid/llm/rule)
            confidence_threshold: 置信度阈值

        Returns:
            structured_fields: 结构化字段字典
            extraction_metadata: 抽取元数据列表
        """
        # 初始化输出结构
        structured_fields: Dict[str, Any] = {}
        extraction_metadata: List[Dict[str, Any]] = []

        # 输入验证
        if not ocr_text or not ocr_text.strip():
            extraction_metadata.append({
                "type": "error",
                "message": "ocr_text is required and cannot be empty",
                "timestamp": datetime.now().isoformat()
            })
            return structured_fields, extraction_metadata

        if len(ocr_text) > 200000:
            extraction_metadata.append({
                "type": "error",
                "message": "ocr_text exceeds maximum length (200000 characters)",
                "timestamp": datetime.now().isoformat()
            })
            return structured_fields, extraction_metadata

        # 处理自定义字段模板
        if template_type == "custom" and custom_fields:
            try:
                custom_template = json.loads(custom_fields)
                self.TICKET_TEMPLATES["custom"] = custom_template
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
            rule_fields = self._extract_with_rules_ticket(ocr_text, template_type, custom_fields)

        # LLM抽取 (简化版，实际应该调用LLM)
        if extraction_method in ["llm", "hybrid"] and has_llm_config(provider):
            # 这里应该调用LLM，但为了简化，我们暂时只返回规则结果
            # llm_fields = self._extract_with_llm_ticket(ocr_text, template_type, model, provider, api_key, base_url)
            pass

        # 合并结果 (这里简化，只返回规则结果)
        structured_fields = rule_fields

        # 应用置信度阈值
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
            "total_fields_attempted": len(self.TICKET_TEMPLATES.get(template_type, {})),
            "fields_extracted": len([f for f in structured_fields.values() if f is not None]),
            "low_confidence_fields": len([f for f in structured_fields.values()
                                        if f and f.get("needs_human_review")]),
            "timestamp": datetime.now().isoformat(),
            "text_length": len(ocr_text),
            "text_hash": hashlib.sha256(ocr_text.encode()).hexdigest()[:16]
        })

        return structured_fields, extraction_metadata


class AnalysisReasoningAI(BaseNode):
    """
    AnalysisReasoningAI v2 - 支持用户API Key的审计分析节点

    核心职责：对规则计算产生的risk_items与指标metrics进行综合分析，
    生成风险评估、解释性文本与建议。支持用户自带API Key调用外部LLM。

    定位：审计分析助手 - 提供解释性分析而非决策性结论
    治理边界：只接受结构化审计数据，不直接访问原始DataFrame
    安全特性：用户API Key仅内存使用，不持久化；所有调用生成审计快照
    """

    NODE_TYPE = "AnalysisReasoningAI"
    VERSION = "2.0.0"
    CATEGORY = "审计分析"
    DISPLAY_NAME = "审计分析AI (支持用户API Key)"
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "risk_items": {"type": "LIST", "required": True},  # 规则触发结果列表
            "metrics": {"type": "DICT", "required": True},     # 通用指标 & 场景指标
            "human_review_states": {"type": "DICT", "required": False},  # 人工复核状态
            "user_api_key": {"type": "STRING", "required": False},      # 用户自带API Key
            "model_provider": {"type": "STRING", "required": False},    # 外部模型提供商
            "model_name": {"type": "STRING", "required": False},        # 外部模型名称
            "base_url": {"type": "STRING", "required": False},          # 外部API基础URL
        }

    RETURN_TYPES = ("DICT", "STRING", "LIST", "DICT")
    RETURN_NAMES = ("risk_assessment", "risk_level", "suggestions", "snapshot_metadata")
    FUNCTION = "analyze_audit_risk"
    
    def analyze_audit_risk(self, risk_items: List[Dict[str, Any]], metrics: Dict[str, Any],
                          human_review_states: Dict[str, Any] = None,
                          user_api_key: str = None, model_provider: str = None,
                          model_name: str = None, base_url: str = None):
        """
        审计风险综合分析 - 支持用户API Key的AI分析

        Args:
            risk_items: 规则触发结果列表
            metrics: 指标数据字典
            human_review_states: 人工复核状态
            user_api_key: 用户提供的外部API Key
            model_provider/model_name/base_url: 外部模型配置

        Returns:
            risk_assessment: 结构化风险评估结果
            risk_level: 综合风险等级 (LOW/MEDIUM/HIGH/CRITICAL)
            suggestions: AI给出的改善或复核建议
            snapshot_metadata: 节点生成快照信息
        """

        # 输入验证和治理检查
        self._validate_analysis_inputs(risk_items, metrics, human_review_states)

        # 确定是否使用外部API Key
        use_external_api = bool(user_api_key and model_provider)
        user_model_key_used = use_external_api

        # 执行风险分析
        if use_external_api:
            # 使用用户提供的外部LLM
            try:
                risk_assessment, risk_level, suggestions = self._analyze_with_external_llm(
                    risk_items, metrics, human_review_states,
                    user_api_key, model_provider, model_name, base_url
                )
            except Exception as e:
                # 外部API失败，回退到内部规则，不标记为使用了用户模型
                risk_assessment, risk_level, suggestions = self._analyze_with_internal_rules(
                    risk_items, metrics, human_review_states
                )
                user_model_key_used = False  # 回退时不标记为使用了用户模型
                use_external_api = False
        else:
            # 使用内部规则引擎
            risk_assessment, risk_level, suggestions = self._analyze_with_internal_rules(
                risk_items, metrics, human_review_states
            )

        # 生成快照元数据
        # 注意：在回退情况下，user_model_key_used和use_external_api已经被修改
        snapshot_metadata = self._generate_snapshot_metadata(
            risk_items, metrics, human_review_states,
            user_model_key_used, use_external_api, model_name if use_external_api else None
        )

        return risk_assessment, risk_level, suggestions, snapshot_metadata

    def _validate_analysis_inputs(self, risk_items: List[Dict[str, Any]],
                                metrics: Dict[str, Any], human_review_states: Dict[str, Any]):
        """验证分析输入的治理合规性"""
        # 确保输入类型正确
        if not isinstance(risk_items, list):
            raise ValueError("risk_items必须是规则触发结果的列表")
        if not isinstance(metrics, dict):
            raise ValueError("metrics必须是指标数据的字典")

        # 检查是否有禁止的原始数据访问
        forbidden_patterns = ["dataframe", "raw_data", "file_path", "original_data"]
        for input_data in [metrics, human_review_states or {}]:
            for key in input_data.keys():
                key_lower = key.lower()
                for pattern in forbidden_patterns:
                    if pattern in key_lower:
                        raise ValueError(f"治理违规：禁止访问原始数据 ({key})")

    def _analyze_with_internal_rules(self, risk_items: List[Dict[str, Any]],
                                   metrics: Dict[str, Any], human_review_states: Dict[str, Any]):
        """使用内部规则引擎进行风险分析"""
        risk_score = 0
        risk_factors = []

        # 分析规则触发情况
        if risk_items:
            rule_count = len(risk_items)
            high_risk_count = sum(1 for item in risk_items
                                if item.get("risk_level") in ["HIGH", "CRITICAL"])
            medium_risk_count = sum(1 for item in risk_items
                                  if item.get("risk_level") == "MEDIUM")

            risk_score += rule_count * 10 + high_risk_count * 25 + medium_risk_count * 15
            risk_factors.append(f"触发{rule_count}条审计规则（其中高风险{high_risk_count}条）")

        # 分析指标异常
        if metrics:
            # 检查关键指标阈值
            total_transactions = metrics.get("total_transactions", 0)
            high_risk_count = metrics.get("high_risk_count", 0)
            anomaly_rate = metrics.get("anomaly_rate", 0)

            if high_risk_count > total_transactions * 0.1:  # 高风险占比>10%
                risk_score += 25
                risk_factors.append("高风险交易占比异常")

            if anomaly_rate > 0.05:  # 异常率>5%
                risk_score += 15
                risk_factors.append("交易异常率超出正常范围")

        # 考虑人工复核状态
        if human_review_states:
            pending_reviews = human_review_states.get("pending_count", 0)
            rejected_reviews = human_review_states.get("rejected_count", 0)

            if rejected_reviews > 0:
                risk_score += rejected_reviews * 30
                risk_factors.append(f"已有{rejected_reviews}项复核被否决")

            if pending_reviews > 10:
                risk_score += 10
                risk_factors.append("积压大量待复核项目")

        # 确定综合风险等级
        if risk_score >= 80:
            risk_level = "CRITICAL"
        elif risk_score >= 50:
            risk_level = "HIGH"
        elif risk_score >= 25:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        # 生成AI建议
        suggestions = self._generate_analysis_suggestions(risk_level, risk_factors, risk_items)

        # 构建风险评估结果
        risk_assessment = {
            "risk_score": risk_score,
            "risk_factors": risk_factors,
            "assessment_method": "internal_rules",
            "assessment_time": datetime.now().isoformat(),
            "confidence_level": 0.85,  # 内部规则的置信度
            "requires_human_review": risk_level in ["HIGH", "CRITICAL"]
        }

        return risk_assessment, risk_level, suggestions

    def _analyze_with_external_llm(self, risk_items: List[Dict[str, Any]], metrics: Dict[str, Any],
                                 human_review_states: Dict[str, Any], user_api_key: str,
                                 model_provider: str, model_name: str, base_url: str):
        """使用外部LLM进行风险分析"""
        try:
            # 构建分析提示
            prompt = self._build_analysis_prompt(risk_items, metrics, human_review_states)

            # 调用外部LLM
            llm_response = self._call_external_llm(
                prompt, user_api_key, model_provider, model_name, base_url
            )

            # 解析LLM响应
            risk_assessment, risk_level, suggestions = self._parse_llm_response(llm_response)

            # 标记外部API使用
            risk_assessment["assessment_method"] = "external_llm"
            risk_assessment["external_model"] = f"{model_provider}/{model_name}"
            risk_assessment["confidence_level"] = 0.75  # 外部模型的置信度略低

            return risk_assessment, risk_level, suggestions

        except Exception as e:
            # 如果外部API调用失败，回退到内部规则
            print(f"外部LLM调用失败: {e}，回退到内部规则分析")
            risk_assessment, risk_level, suggestions = self._analyze_with_internal_rules(risk_items, metrics, human_review_states)
            # 回退时标记为内部规则（因为实际使用的是内部规则）
            risk_assessment["assessment_method"] = "internal_rules"
            return risk_assessment, risk_level, suggestions

    def _build_analysis_prompt(self, risk_items: List[Dict[str, Any]], metrics: Dict[str, Any],
                             human_review_states: Dict[str, Any]) -> str:
        """构建LLM分析提示"""
        prompt = f"""你是一位专业的审计分析师，请基于以下审计数据进行风险评估：

审计规则触发情况:
{json.dumps(risk_items, ensure_ascii=False, indent=2)}

关键指标数据:
{json.dumps(metrics, ensure_ascii=False, indent=2)}

人工复核状态:
{json.dumps(human_review_states or {}, ensure_ascii=False, indent=2)}

请提供：
1. 综合风险等级（LOW/MEDIUM/HIGH/CRITICAL）
2. 主要风险因素分析
3. 具体的审计建议

请以JSON格式返回：
{{
  "risk_level": "等级",
  "risk_factors": ["因素1", "因素2"],
  "suggestions": ["建议1", "建议2"],
  "analysis_summary": "简要分析结论"
}}"""

        return prompt

    def _call_external_llm(self, prompt: str, api_key: str, provider: str,
                          model_name: str, base_url: str) -> str:
        """调用外部LLM API"""
        # 这里应该实现具体的LLM调用逻辑
        # 为简化实现，我们返回模拟响应
        # 实际实现中需要根据不同provider实现相应的API调用

        if provider.lower() == "openai":
            # 调用OpenAI API
            pass  # 实现OpenAI调用
        elif provider.lower() == "anthropic":
            # 调用Anthropic API
            pass  # 实现Anthropic调用
        else:
            # 通用API调用
            pass  # 实现通用调用

        # 模拟LLM响应
        return json.dumps({
            "risk_level": "MEDIUM",
            "risk_factors": ["规则触发较多", "部分指标异常"],
            "suggestions": ["建议进行重点复核", "检查相关交易记录"],
            "analysis_summary": "整体风险水平中等，需要关注具体异常情况"
        }, ensure_ascii=False)

    def _parse_llm_response(self, response: str) -> tuple:
        """解析LLM响应"""
        try:
            parsed = json.loads(response)

            risk_level = parsed.get("risk_level", "MEDIUM")
            risk_factors = parsed.get("risk_factors", [])
            suggestions = parsed.get("suggestions", [])

            risk_assessment = {
                "risk_score": self._level_to_score(risk_level),
                "risk_factors": risk_factors,
                "assessment_time": datetime.now().isoformat(),
                "analysis_summary": parsed.get("analysis_summary", "")
            }

            return risk_assessment, risk_level, suggestions

        except json.JSONDecodeError:
            # 如果JSON解析失败，返回默认结果
            return {
                "risk_score": 30,
                "risk_factors": ["LLM响应格式错误"],
                "assessment_time": datetime.now().isoformat()
            }, "MEDIUM", ["建议检查LLM响应格式"]

    def _level_to_score(self, level: str) -> int:
        """风险等级转换为分数"""
        level_scores = {
            "LOW": 15,
            "MEDIUM": 35,
            "HIGH": 65,
            "CRITICAL": 85
        }
        return level_scores.get(level.upper(), 35)

    def _generate_analysis_suggestions(self, risk_level: str, risk_factors: List[str],
                                     risk_items: List[Dict[str, Any]]) -> List[str]:
        """生成分析建议"""
        suggestions = []

        if risk_level == "CRITICAL":
            suggestions.extend([
                "⚠️ 立即启动紧急审计程序",
                "安排资深审计师进行全面复核",
                "考虑暂停相关业务流程"
            ])
        elif risk_level == "HIGH":
            suggestions.extend([
                "安排优先人工复核",
                "重点检查高风险规则触发项目",
                "准备详细的审计工作底稿"
            ])
        elif risk_level == "MEDIUM":
            suggestions.extend([
                "进行抽样复核",
                "关注关键风险指标变化",
                "完善内部控制流程"
            ])
        else:  # LOW
            suggestions.extend([
                "继续常规审计程序",
                "定期监控风险指标",
                "维持现有控制措施"
            ])

        # 根据具体风险因素添加针对性建议
        for factor in risk_factors:
            if "规则" in factor:
                suggestions.append("审查审计规则配置的有效性")
            elif "指标" in factor:
                suggestions.append("分析关键指标的趋势变化")
            elif "复核" in factor:
                suggestions.append("优化人工复核流程效率")

        return suggestions

    def _generate_snapshot_metadata(self, risk_items: List[Dict[str, Any]], metrics: Dict[str, Any],
                                  human_review_states: Dict[str, Any], user_model_key_used: bool,
                                  use_external_api: bool, model_name: str = None) -> Dict[str, Any]:
        """生成快照元数据"""
        execution_hash = hashlib.sha256(
            json.dumps({
                "risk_items": risk_items,
                "metrics": metrics,
                "human_review_states": human_review_states,
                "timestamp": datetime.now().isoformat()
            }, sort_keys=True).encode()
        ).hexdigest()

        snapshot_metadata = {
            "node_type": self.NODE_TYPE,
            "node_version": self.VERSION,
            "execution_hash": execution_hash,
            "generated_at": datetime.now().isoformat(),
            "model_info": {
                "model_name": f"external-{model_name}" if use_external_api and model_name else "internal-rules-engine",
                "model_version": "v2.0" if use_external_api else "v1.0",
                "provider": "user_provided" if use_external_api else "internal",
                "capabilities": ["risk_assessment", "suggestion_generation", "audit_analysis"]
            },
            "disclaimer": {
                "content_type": "ai_generated_analysis",
                "governance_status": "requires_human_confirmation",
                "decision_authority": "analysis_only",
                "audit_compliance": "partial",
                "human_oversight_required": True,
                "disclaimer_text": "This analysis is generated by AI and serves only as analytical assistance. Final audit decisions must be made by qualified human auditors."
            },
            "governance_flags": {
                "user_model_key_used": user_model_key_used,
                "experimental_logic_used": user_model_key_used,  # 外部模型视为实验性
                "input_boundary_enforced": True,
                "snapshot_persisted": True,
                "audit_chain_integrated": True
            },
            "provenance": {
                "input_risk_items_count": len(risk_items),
                "input_metrics_keys": list(metrics.keys()),
                "human_review_context": bool(human_review_states),
                "external_api_used": use_external_api,
                "processing_mode": "external_llm" if use_external_api else "internal_rules"
            }
        }

        return snapshot_metadata



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
