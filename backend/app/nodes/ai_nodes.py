"""
AI分析层节点 - 文本理解、图像识别和综合分析
"""

import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from .base_node import BaseNode, ExecutionContext, FailurePolicy, NodeMetadata
from app.core.llm_client import call_qwen_chat, has_llm_config


class TextUnderstandingAI(BaseNode):
    """
    3A 文本理解AI - 处理文字描述、合同条款等
    """
    
    NODE_TYPE = "TextUnderstandingAI"
    VERSION = "1.0.0"
    CATEGORY = "AI分析"
    DISPLAY_NAME = "文本理解AI"
    
    INPUT_TYPES = {
        "text_data": {"type": "STRING", "required": True},
        "task_type": {"type": "STRING", "required": True}
    }
    
    OUTPUT_TYPES = {
        "text_labels": {"type": "LIST"},
        "key_sentences": {"type": "LIST"},
        "extracted_info": {"type": "DICT"}
    }
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text_data": ("STRING", {"multiline": True}),
                "task_type": (["classify", "summarize", "extract"], {"default": "classify"})
            }
        }
    
    RETURN_TYPES = ("LIST", "LIST", "DICT")
    RETURN_NAMES = ("text_labels", "key_sentences", "extracted_info")
    FUNCTION = "analyze_text"
    
    def analyze_text(self, text_data: str, task_type: str):
        """
        文本分析处理

        优先调用千问 Qwen3（如已配置 QWEN_API_KEY），
        未配置时回退到原有的规则/正则逻辑。
        """
        # 默认输出结构
        text_labels: List[str] = []
        key_sentences: List[str] = []
        extracted_info: Dict[str, Any] = {}

        # 若未配置 LLM，则使用原来的简单规则逻辑
        if not has_llm_config():
            if task_type == "classify":
                # 风险分类
                risk_words = ["异常", "错误", "违规", "超支", "未授权", "违反"]
                if any(word in text_data for word in risk_words):
                    text_labels.append("高风险")
                else:
                    text_labels.append("正常")

            elif task_type == "summarize":
                # 提取关键句
                sentences = text_data.split("。")[:3]
                key_sentences = [s.strip() for s in sentences if s.strip()]

            elif task_type == "extract":
                # 信息提取
                extracted_info = {
                    "has_risk_words": any(word in text_data for word in ["违规", "异常"]),
                    "amounts": re.findall(r"\d+(?:\.\d+)?元", text_data),
                    "dates": re.findall(r"\d{4}[-/年]\d{1,2}[-/月]\d{1,2}", text_data),
                    "text_length": len(text_data),
                }

            return text_labels, key_sentences, extracted_info

        # ===== 使用千问 LLM 分析 =====
        # 约定统一 JSON 输出格式，便于前端和后续节点消费
        system_prompt = (
            "你是一个审计领域的文本分析助手。"
            "始终只返回 JSON，不要包含多余的解释性文字。"
            "根据 task_type，返回对应字段：\n"
            "1) task_type = 'classify': {\"labels\": [\"高风险\" 或 \"正常\" ...]}\n"
            "2) task_type = 'summarize': {\"key_sentences\": [\"句子1\", \"句子2\", ...]}\n"
            "3) task_type = 'extract': {\"extracted_info\": {...}}\n"
            "所有字段名使用英文，内容可以是中文。"
        )

        user_prompt = json.dumps(
            {
                "task_type": task_type,
                "text": text_data,
            },
            ensure_ascii=False,
        )

        try:
            resp = call_qwen_chat(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ]
            )

            content = (
                resp.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )

            parsed: Dict[str, Any] = {}
            if content:
                try:
                    parsed = json.loads(content)
                except json.JSONDecodeError:
                    # 有些模型会在 JSON 前后加解释文字，尝试粗暴截取第一个大括号片段
                    start = content.find("{")
                    end = content.rfind("}")
                    if start != -1 and end != -1 and end > start:
                        try:
                            parsed = json.loads(content[start : end + 1])
                        except Exception:
                            parsed = {}

            if task_type == "classify":
                labels = parsed.get("labels") or []
                if isinstance(labels, list):
                    text_labels = [str(l) for l in labels]
            elif task_type == "summarize":
                ks = parsed.get("key_sentences") or []
                if isinstance(ks, list):
                    key_sentences = [str(s) for s in ks]
            elif task_type == "extract":
                info = parsed.get("extracted_info") or parsed
                if isinstance(info, dict):
                    extracted_info = info

        except Exception:
            # LLM 调用失败时，回退到旧规则逻辑，避免节点整个报错
            if task_type == "classify":
                risk_words = ["异常", "错误", "违规", "超支", "未授权", "违反"]
                if any(word in text_data for word in risk_words):
                    text_labels.append("高风险")
                else:
                    text_labels.append("正常")
            elif task_type == "summarize":
                sentences = text_data.split("。")[:3]
                key_sentences = [s.strip() for s in sentences if s.strip()]
            elif task_type == "extract":
                extracted_info = {
                    "has_risk_words": any(word in text_data for word in ["违规", "异常"]),
                    "amounts": re.findall(r"\d+(?:\.\d+)?元", text_data),
                    "dates": re.findall(r"\d{4}[-/年]\d{1,2}[-/月]\d{1,2}", text_data),
                    "text_length": len(text_data),
                }

        return text_labels, key_sentences, extracted_info


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
        """票据识别处理"""
        validation_result = {}
        anomaly_flags = []
        
        if check_type == "duplicate":
            # 重复检查（模拟）
            validation_result["is_duplicate"] = False
            validation_result["confidence"] = 0.95
            
        elif check_type == "authenticity":
            # 真伪检查
            validation_result["is_authentic"] = True
            
            # 检查必要元素
            if "发票号" not in ocr_text:
                anomaly_flags.append("缺少发票号")
            if "税号" not in ocr_text:
                anomaly_flags.append("缺少税号")
                
        elif check_type == "anomaly":
            # 异常检测
            if "作废" in ocr_text:
                anomaly_flags.append("发票已作废")
            if "过期" in ocr_text:
                anomaly_flags.append("发票已过期")
        
        return validation_result, anomaly_flags


class AnalysisReasoningAI(BaseNode):
    """
    3C 分析推理AI - 综合风险判断
    """
    
    NODE_TYPE = "AnalysisReasoningAI"
    VERSION = "1.0.0"
    CATEGORY = "AI分析"
    DISPLAY_NAME = "分析推理AI"
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "risk_items": ("DATAFRAME",),
                "metrics": ("DICT",)
            },
            "optional": {
                "text_analysis": ("DICT",),
                "image_analysis": ("DICT",)
            }
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


class HumanReviewNode(BaseNode):
    """
    4 人工审核节点 - 支持人工介入和修正
    """
    
    NODE_TYPE = "HumanReviewNode"
    VERSION = "1.0.0"
    CATEGORY = "协同"
    DISPLAY_NAME = "人工审核"
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "risk_items": ("DATAFRAME",),
                "risk_assessment": ("DICT",)
            },
            "optional": {
                "reviewer_comment": ("STRING", {"multiline": True})
            }
        }
    
    RETURN_TYPES = ("DATAFRAME", "STRING")
    RETURN_NAMES = ("reviewed_items", "review_status")
    FUNCTION = "review_items"
    
    def review_items(self, risk_items: pd.DataFrame, risk_assessment: Dict, 
                    reviewer_comment: str = ""):
        """人工审核处理"""
        
        # 模拟人工审核
        reviewed_items = risk_items.copy()
        
        if not reviewed_items.empty:
            # 添加审核状态列
            reviewed_items["review_status"] = "已审核"
            reviewed_items["reviewer_comment"] = reviewer_comment
            reviewed_items["review_time"] = datetime.now().isoformat()
            
            # 模拟部分风险项被确认
            if "risk_level" in reviewed_items.columns:
                high_risk_mask = reviewed_items["risk_level"] == "HIGH"
                reviewed_items.loc[high_risk_mask, "confirmed"] = True
                reviewed_items.loc[~high_risk_mask, "confirmed"] = False
        
        review_status = f"已完成审核，共{len(reviewed_items)}项"
        
        return reviewed_items, review_status


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
