/**
 * Prisma Client 单例实例
 * 确保应用中只有一个数据库连接池
 */

import { PrismaClient } from '@prisma/client';

// 全局变量用于保存Prisma实例(避免热重载时创建多个连接)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// 优雅关闭连接
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

/**
 * 测试数据库连接
 */
export async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    console.log('✅ 数据库连接成功');
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    return false;
  }
}

/**
 * 清空所有表(仅用于测试环境)
 */
export async function clearDatabase() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot clear database in production!');
  }

  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations')
    .map((name) => `"public"."${name}"`)
    .join(', ');

  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    console.log('✅ 数据库已清空');
  } catch (error) {
    console.error('❌ 清空数据库失败:', error);
  }
}
