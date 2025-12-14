#!/bin/bash

# 依赖安装脚本
# 您回来后第一件事就是运行这个脚本

echo "======================================"
echo "审计数智析 - 依赖安装脚本"
echo "======================================"
echo ""

# 进入后端目录
cd packages/backend

echo "📦 安装后端依赖..."
echo ""

# 核心依赖
echo "1/5 安装 exceljs（Excel处理）..."
npm install exceljs

echo "2/5 安装 express-rate-limit（限流）..."
npm install express-rate-limit rate-limit-redis

echo "3/5 安装 class-validator 和 class-transformer（验证）..."
npm install class-validator class-transformer reflect-metadata

echo "4/5 安装 TypeScript 类型定义..."
npm install --save-dev @types/exceljs @types/express

echo "5/5 安装 multer（文件上传）..."
npm install multer @types/multer

echo ""
echo "✅ 后端依赖安装完成！"
echo ""

# 返回根目录
cd ../..

echo "======================================"
echo "安装完成！"
echo "======================================"
echo ""
echo "下一步："
echo "1. 运行 npm run dev 启动开发服务器"
echo "2. 访问 http://localhost:3000"
echo "3. 测试固定资产盘点节点"
echo ""
