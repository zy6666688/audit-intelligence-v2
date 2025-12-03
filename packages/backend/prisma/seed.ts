/**
 * 数据库种子数据
 * 用于初始化系统管理员和示例数据
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始播种数据...');

  // 创建系统管理员
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@audit.com' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@audit.com',
      passwordHash: adminPassword,
      displayName: '系统管理员',
      role: 'admin',
      status: 'active',
    },
  });
  console.log('✅ 管理员创建完成:', admin.email);

  // 创建测试用户
  const userPassword = await bcrypt.hash('user123', 10);
  const testUser = await prisma.user.upsert({
    where: { email: 'auditor@audit.com' },
    update: {},
    create: {
      username: 'auditor',
      email: 'auditor@audit.com',
      passwordHash: userPassword,
      displayName: '审计员',
      role: 'auditor',
      status: 'active',
    },
  });
  console.log('✅ 测试用户创建完成:', testUser.email);

  // 创建示例项目
  const project = await prisma.project.create({
    data: {
      name: '2024年度财务审计',
      description: '针对ABC公司的年度财务报表审计项目',
      ownerId: admin.id,
      auditType: 'financial',
      clientName: 'ABC公司',
      auditPeriod: '2024年度',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
    },
  });
  console.log('✅ 示例项目创建完成:', project.name);

  // 添加项目成员
  await prisma.projectMember.create({
    data: {
      projectId: project.id,
      userId: testUser.id,
      role: 'editor',
    },
  });
  console.log('✅ 项目成员添加完成');

  // 创建示例工作流
  const workflow = await prisma.workflow.create({
    data: {
      projectId: project.id,
      name: '凭证审计流程',
      description: '用于审计会计凭证的标准流程',
      category: 'audit',
      nodes: [
        {
          id: 'node1',
          type: 'data.csv_reader',
          position: { x: 100, y: 100 },
          data: { label: 'CSV数据读取' },
        },
        {
          id: 'node2',
          type: 'audit.data_compare',
          position: { x: 300, y: 100 },
          data: { label: '数据对比' },
        },
      ],
      edges: [
        {
          id: 'edge1',
          source: 'node1',
          target: 'node2',
        },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
      createdBy: admin.id,
      isTemplate: true,
      isPublished: true,
    },
  });
  console.log('✅ 示例工作流创建完成:', workflow.name);

  console.log('\n🎉 数据播种完成!');
  console.log('\n📝 登录信息:');
  console.log('管理员: admin@audit.com / admin123');
  console.log('审计员: auditor@audit.com / user123');
}

main()
  .catch((e) => {
    console.error('❌ 播种失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
