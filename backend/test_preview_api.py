#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试预览API是否正常工作
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_preview_api():
    """测试预览API"""
    print("=" * 60)
    print("测试预览API")
    print("=" * 60)
    
    # 1. 测试API是否可访问
    print("\n1. 测试API健康检查...")
    try:
        response = requests.get(f"{BASE_URL}/health/ready", timeout=5)
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            print("   ✓ API服务正常运行")
        else:
            print(f"   ✗ API服务异常: {response.text}")
            return False
    except requests.exceptions.ConnectionError:
        print("   ✗ 无法连接到API服务，请确保后端正在运行")
        return False
    except Exception as e:
        print(f"   ✗ 错误: {e}")
        return False
    
    # 2. 测试预览路由是否存在
    print("\n2. 测试预览路由...")
    try:
        # 使用一个不存在的prompt_id和node_id来测试路由是否存在
        test_url = f"{BASE_URL}/preview/node/test_prompt/test_node/0"
        response = requests.get(test_url, timeout=5)
        print(f"   请求URL: {test_url}")
        print(f"   状态码: {response.status_code}")
        
        if response.status_code == 404:
            # 404是预期的，说明路由存在但文件不存在
            error_detail = response.json().get("detail", "")
            print(f"   ✓ 预览路由存在（返回404是预期的）")
            print(f"   错误消息: {error_detail}")
            if "Cache file not found" in error_detail or "No cache found" in error_detail:
                print("   ✓ 路由正常工作，只是缓存文件不存在")
                return True
            else:
                print("   ? 路由存在但错误消息不符合预期")
                return True
        elif response.status_code == 200:
            print("   ✓ 预览路由存在且返回数据")
            return True
        else:
            print(f"   ✗ 意外的状态码: {response.status_code}")
            print(f"   响应: {response.text}")
            return False
    except requests.exceptions.ConnectionError:
        print("   ✗ 无法连接到预览路由")
        return False
    except Exception as e:
        print(f"   ✗ 错误: {e}")
        return False

def check_cache_files():
    """检查缓存文件"""
    print("\n" + "=" * 60)
    print("检查缓存文件")
    print("=" * 60)
    
    import os
    
    cache_dir = "cache"
    if not os.path.exists(cache_dir):
        print(f"\n✗ 缓存目录不存在: {cache_dir}")
        return []
    
    print(f"\n缓存目录: {os.path.abspath(cache_dir)}")
    
    # 查找所有parquet文件
    parquet_files = []
    for root, dirs, files in os.walk(cache_dir):
        for file in files:
            if file.endswith(".parquet"):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, cache_dir)
                parquet_files.append(rel_path)
                print(f"  找到: {rel_path}")
    
    if not parquet_files:
        print("\n✗ 未找到任何缓存文件")
        print("  提示: 请先运行工作流以生成缓存文件")
    else:
        print(f"\n✓ 找到 {len(parquet_files)} 个缓存文件")
    
    return parquet_files

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("预览API测试工具")
    print("=" * 60)
    
    # 检查缓存文件
    cache_files = check_cache_files()
    
    # 测试API
    api_ok = test_preview_api()
    
    print("\n" + "=" * 60)
    print("测试结果")
    print("=" * 60)
    if api_ok:
        print("✓ 预览API可以正常访问")
        if cache_files:
            print(f"✓ 找到 {len(cache_files)} 个缓存文件，可以尝试预览")
        else:
            print("⚠ 没有缓存文件，请先运行工作流")
    else:
        print("✗ 预览API存在问题，请检查后端服务")
    
    print("\n提示: 如果API正常但没有缓存文件，请:")
    print("  1. 在前端点击'运行审计'按钮")
    print("  2. 等待所有节点显示'已完成 ✓'")
    print("  3. 然后点击节点的眼睛图标查看预览")


