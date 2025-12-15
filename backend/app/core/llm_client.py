"""
统一的大模型客户端封装（当前用于接入千问 Qwen3）

注意：不在代码库中硬编码 API Key，只通过环境变量读取：
- QWEN_API_KEY: 千问 API Key
- QWEN_API_BASE: 接口 Base URL，默认 https://dashscope.aliyuncs.com/compatible-mode/v1
- QWEN_MODEL: 模型名称，默认 qwen-plus
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List

import requests


QWEN_API_KEY = os.getenv("QWEN_API_KEY", "").strip()
QWEN_API_BASE = os.getenv(
    "QWEN_API_BASE", "https://dashscope.aliyuncs.com/compatible-mode/v1"
).rstrip("/")
QWEN_MODEL = os.getenv("QWEN_MODEL", "qwen-plus").strip() or "qwen-plus"


def has_llm_config() -> bool:
    """是否已配置千问 API Key"""
    return bool(QWEN_API_KEY)


def call_qwen_chat(messages: List[Dict[str, Any]], model: str | None = None) -> Dict[str, Any]:
    """
    调用千问 Chat Completions 接口（OpenAI 兼容协议）

    messages: [{"role": "system" | "user" | "assistant", "content": "..."}, ...]
    返回完整 JSON 响应，调用方自行解析 content。
    """
    if not QWEN_API_KEY:
        raise RuntimeError("QWEN_API_KEY is not set in environment variables")

    use_model = model or QWEN_MODEL
    url = f"{QWEN_API_BASE}/chat/completions"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {QWEN_API_KEY}",
    }

    payload = {
        "model": use_model,
        "messages": messages,
    }

    resp = requests.post(url, headers=headers, data=json.dumps(payload))
    resp.raise_for_status()
    return resp.json()


