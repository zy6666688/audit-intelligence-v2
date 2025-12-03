#!/bin/bash
# 审计数智析 - 开发环境一键启动脚本
# Bash 版本 (Mac/Linux)

echo "====================================="
echo "  审计数智析 - 开发环境启动"
echo "====================================="
echo ""

# 检查 Node.js
echo "[1/4] 检查 Node.js 环境..."
if ! command -v node &> /dev/null; then
    echo "✗ 未找到 Node.js，请先安装 Node.js 18+"
    exit 1
fi
echo "✓ Node.js 版本: $(node --version)"

# 安装依赖（如果需要）
echo ""
echo "[2/4] 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "正在安装前端依赖..."
    npm install
fi
if [ ! -d "packages/backend/node_modules" ]; then
    echo "正在安装后端依赖..."
    cd packages/backend
    npm install
    cd ../..
fi
echo "✓ 依赖检查完成"

# 启动后端服务
echo ""
echo "[3/4] 启动后端服务..."
cd packages/backend
npm run dev &
BACKEND_PID=$!
cd ../..
sleep 3
echo "✓ 后端服务已启动: http://localhost:3000 (PID: $BACKEND_PID)"

# 启动前端服务
echo ""
echo "[4/4] 启动前端服务..."
npm run dev:h5 &
FRONTEND_PID=$!
sleep 2
echo "✓ 前端服务已启动: http://localhost:8080 (PID: $FRONTEND_PID)"

echo ""
echo "====================================="
echo "  🎉 开发环境启动完成！"
echo "====================================="
echo ""
echo "前端地址: http://localhost:8080"
echo "后端地址: http://localhost:3000"
echo "后端健康检查: http://localhost:3000/health"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# 等待用户中断
wait
