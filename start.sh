#!/bin/bash

# 审计底稿引擎 - 快速启动脚本
# 版本: v0.9.0-beta

set -e

echo "🚀 审计底稿引擎启动脚本"
echo "========================="
echo ""

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: 未检测到 Docker"
    echo "请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ 错误: 未检测到 Docker Compose"
    echo "请先安装 Docker Compose"
    exit 1
fi

echo "✅ Docker 环境检查通过"
echo ""

# 检查.env文件
if [ ! -f .env ]; then
    echo "⚠️ 未找到.env文件，将从模板创建..."
    cp .env.example .env
    echo "📝 请编辑.env文件并配置必要的环境变量"
    echo "特别注意修改以下配置:"
    echo "  - DB_PASSWORD (数据库密码)"
    echo "  - JWT_SECRET (JWT密钥)"
    echo "  - REDIS_PASSWORD (Redis密码)"
    echo ""
    read -p "是否已完成配置? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "⏸️ 请先配置.env文件，然后重新运行此脚本"
        exit 1
    fi
fi

echo "✅ 环境变量配置检查通过"
echo ""

# 选择部署模式
echo "请选择部署模式:"
echo "  1) 开发模式 (development)"
echo "  2) 生产模式 (production)"
echo ""
read -p "请输入选择 (1/2): " mode

if [ "$mode" == "2" ]; then
    export NODE_ENV=production
    echo "🏭 使用生产模式"
else
    export NODE_ENV=development
    echo "🔧 使用开发模式"
fi
echo ""

# 构建并启动服务
echo "📦 构建Docker镜像..."
docker-compose build

echo ""
echo "🚀 启动服务..."
docker-compose up -d

echo ""
echo "⏳ 等待服务启动..."
sleep 10

# 健康检查
echo ""
echo "🏥 健康检查..."

# 检查数据库
if docker-compose exec -T postgres pg_isready -U postgres &> /dev/null; then
    echo "✅ 数据库: 正常"
else
    echo "❌ 数据库: 异常"
fi

# 检查Redis
if docker-compose exec -T redis redis-cli ping &> /dev/null; then
    echo "✅ Redis: 正常"
else
    echo "❌ Redis: 异常"
fi

# 检查后端
if curl -s http://localhost:3000/health | grep -q "healthy"; then
    echo "✅ 后端服务: 正常"
else
    echo "❌ 后端服务: 异常"
    echo "📝 查看后端日志:"
    docker-compose logs --tail=20 backend
fi

# 检查前端
if curl -s http://localhost:80/ | grep -q "html"; then
    echo "✅ 前端服务: 正常"
else
    echo "⚠️ 前端服务: 可能需要更长时间启动"
fi

echo ""
echo "========================="
echo "🎉 启动完成！"
echo ""
echo "📍 访问地址:"
echo "  前端: http://localhost"
echo "  后端API: http://localhost:3000/api"
echo "  API文档: http://localhost:3000/"
echo ""
echo "👤 默认账号:"
echo "  用户名: admin"
echo "  密码: admin123"
echo ""
echo "📝 常用命令:"
echo "  查看日志: docker-compose logs -f"
echo "  停止服务: docker-compose down"
echo "  重启服务: docker-compose restart"
echo "  查看状态: docker-compose ps"
echo ""
echo "📚 更多帮助请查看: DEPLOYMENT_GUIDE.md"
echo "========================="
