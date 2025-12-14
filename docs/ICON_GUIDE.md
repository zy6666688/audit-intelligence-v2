# TabBar 图标使用指南

## 当前状态

目前使用 **Emoji + 文字** 的临时方案显示底部导航栏，可以正常使用但不够美观。

```
🏠 首页  |  📁 项目  |  📝 底稿  |  👤 我的
```

---

## 添加真实图标的方法

### 方案1: 使用IconFont（推荐）

**优点**: 
- 矢量图标，清晰度高
- 文件小，加载快
- 易于修改颜色

**步骤**:

1. **访问 iconfont.cn**
   - 网址: https://www.iconfont.cn/
   - 搜索并选择合适的图标（首页、项目、文件、用户等）

2. **下载图标**
   - 选择 "下载代码"
   - 将字体文件放到 `src/static/fonts/` 目录

3. **引入字体**（在 App.vue 或 main.ts 中）
   ```css
   @font-face {
     font-family: 'iconfont';
     src: url('/static/fonts/iconfont.ttf') format('truetype');
   }
   ```

4. **修改 pages.json**（使用 iconfont）
   ```json
   "tabBar": {
     "iconfontSrc": "static/fonts/iconfont.ttf",
     "list": [
       {
         "pagePath": "pages/index/index",
         "text": "首页",
         "iconfont": {
           "text": "\\ue600",
           "selectedText": "\\ue601",
           "fontSize": "22px",
           "color": "#999999",
           "selectedColor": "#1890ff"
         }
       }
     ]
   }
   ```

---

### 方案2: 使用PNG图标

**图标规格要求**:
- 尺寸: 81px × 81px (推荐)
- 格式: PNG
- 背景: 透明
- 普通状态: 灰色 (#999999)
- 选中状态: 蓝色 (#1890ff)

**需要的图标**:

1. **首页图标**
   - `src/static/tabbar/home.png` (未选中)
   - `src/static/tabbar/home-active.png` (选中)

2. **项目图标**
   - `src/static/tabbar/project.png`
   - `src/static/tabbar/project-active.png`

3. **底稿图标**
   - `src/static/tabbar/workpaper.png`
   - `src/static/tabbar/workpaper-active.png`

4. **我的图标**
   - `src/static/tabbar/profile.png`
   - `src/static/tabbar/profile-active.png`

**修改 pages.json**:
```json
"tabBar": {
  "color": "#999999",
  "selectedColor": "#1890ff",
  "borderStyle": "black",
  "backgroundColor": "#FFFFFF",
  "list": [
    {
      "pagePath": "pages/index/index",
      "iconPath": "static/tabbar/home.png",
      "selectedIconPath": "static/tabbar/home-active.png",
      "text": "首页"
    },
    {
      "pagePath": "pages/project/list",
      "iconPath": "static/tabbar/project.png",
      "selectedIconPath": "static/tabbar/project-active.png",
      "text": "项目"
    },
    {
      "pagePath": "pages/workpaper/list",
      "iconPath": "static/tabbar/workpaper.png",
      "selectedIconPath": "static/tabbar/workpaper-active.png",
      "text": "底稿"
    },
    {
      "pagePath": "pages/profile/index",
      "iconPath": "static/tabbar/profile.png",
      "selectedIconPath": "static/tabbar/profile-active.png",
      "text": "我的"
    }
  ]
}
```

---

### 方案3: 在线图标库

可以从以下网站下载免费图标：

1. **阿里巴巴矢量图标库**
   - https://www.iconfont.cn/
   - 海量免费图标

2. **Iconify**
   - https://icon-sets.iconify.design/
   - 多种风格

3. **Remix Icon**
   - https://remixicon.com/
   - 现代简洁

4. **Material Icons**
   - https://fonts.google.com/icons
   - Google设计

---

## 推荐图标关键词

搜索时使用这些关键词：

- 首页: `home`, `house`, `首页`
- 项目: `folder`, `project`, `文件夹`, `项目`
- 底稿: `document`, `file`, `文档`, `底稿`
- 我的: `user`, `profile`, `person`, `用户`

---

## 快速测试

修改完 `pages.json` 后：

1. **H5端**: 刷新浏览器即可看到效果
2. **小程序**: 需要重新编译

```bash
# H5
npm run dev:h5

# 小程序
npm run dev:mp-weixin
```

---

## 注意事项

1. **路径问题**: 
   - uni-app中路径不需要 `/` 开头
   - 正确: `static/tabbar/home.png`
   - 错误: `/static/tabbar/home.png`

2. **图标大小**:
   - 小程序建议 81px × 81px
   - H5可以稍大 (96px × 96px)

3. **文件大小**:
   - 单个图标建议 < 40KB
   - 使用 TinyPNG 等工具压缩

4. **兼容性**:
   - PNG图标: 所有平台支持
   - IconFont: H5支持，小程序需要base64

---

## 当前临时方案代码

如需恢复Emoji方案，修改 `src/pages.json`:

```json
"tabBar": {
  "color": "#666666",
  "selectedColor": "#1890ff",
  "list": [
    { "pagePath": "pages/index/index", "text": "🏠 首页" },
    { "pagePath": "pages/project/list", "text": "📁 项目" },
    { "pagePath": "pages/workpaper/list", "text": "📝 底稿" },
    { "pagePath": "pages/profile/index", "text": "👤 我的" }
  ]
}
```

---

**建议**: 优先使用 **方案1 (IconFont)**，图标质量高且易于维护！
