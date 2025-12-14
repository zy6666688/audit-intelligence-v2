# 贡献指南

欢迎为审计数智析项目做出贡献！

## 🎯 如何贡献

### 报告Bug

在提交Bug报告前，请：
1. 检查是否已有相同问题
2. 确认问题可复现
3. 提供详细的复现步骤

### 提出新功能

1. 先在Issues中讨论
2. 获得团队认可后再开发
3. 遵循项目架构设计

### 提交代码

1. Fork本仓库
2. 创建功能分支
3. 提交代码并推送
4. 创建Pull Request

## 📝 代码规范

### TypeScript

```typescript
// 使用接口定义类型
interface User {
  id: string;
  name: string;
}

// 使用类型推导
const count = 0; // ✅ 推导为 number
const count: number = 0; // ❌ 多余的类型声明

// 函数返回类型
function getUser(): Promise<User> {
  // ...
}
```

### Vue组件

```vue
<script setup lang="ts">
// 使用 setup 语法
import { ref, computed } from 'vue';

const count = ref(0);
const double = computed(() => count.value * 2);
</script>

<template>
  <view class="container">
    <!-- 使用 view 而不是 div -->
  </view>
</template>

<style lang="scss" scoped>
// 使用 scoped 样式
.container {
  // 使用 SCSS
}
</style>
```

### 命名规范

- **文件名**: 大驼峰 `ProjectDetail.vue`
- **变量名**: 小驼峰 `userInfo`
- **常量名**: 大写下划线 `MAX_COUNT`
- **CSS类名**: 短横线 `project-detail`

## 🧪 测试

提交代码前请确保：

```bash
# TypeScript检查通过
npm run type-check

# 代码规范检查通过
npm run lint

# 所有测试通过
npm test
```

## 📖 文档

- 更新相关文档
- 添加JSDoc注释
- 更新CHANGELOG.md

## ✅ 提交检查清单

- [ ] 代码符合规范
- [ ] 通过TypeScript检查
- [ ] 通过代码规范检查
- [ ] 添加了必要的注释
- [ ] 更新了相关文档
- [ ] 提交信息清晰明确

## 🙏 感谢

感谢您的贡献！
