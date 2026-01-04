## 概要
<!-- 简短说明本次变更的目的 -->

## 变更内容
- 简要列出改动点（代码/配置/文档）

## 验收清单（执行层必须在 PR 中附上所有 artifact）
- [ ] PR 分支：`feat/use-nodeeditor-v2` 或对应分支名
- [ ] `npm-install.log` 已上传 (或粘贴关键错误段)
- [ ] `build.log` 已上传
- [ ] Playwright 报告已上传（`playwright-report/` 或 JSON）
- [ ] 三张截图：`V2-render.png`, `node-drag.png`, `connection.png`
- [ ] CI 检查通过（链接）
- [ ] Reviewer（同事）签名与时间： `@reviewer YYYY-MM-DD`

## 重现步骤（供 reviewer 复验）
1. Checkout 分支： `git checkout feat/use-nodeeditor-v2`
2. 本地安装（推荐 WSL）：
   ```bash
   npm ci --legacy-peer-deps
   npm run build
   npm run dev
   ```
3. 打开 `http://localhost:5173`，执行 Playwright 脚本或手动验证。

## 关联 Issue / 需求
- 关联 ID（如有）

## 备注 / 注意点
- 若出现 esbuild 相关错误，见 PR 附件 `esbuild-rebuild.log` 或 `esbuild-install.log`。

## Summary

Describe the purpose of this PR in one or two sentences.

## Changes

- List of changed files and a short description of each change.

## Acceptance artifacts (required)

- [ ] PR branch: `feat/use-nodeeditor-v2`
- [ ] `npm-install.log` attached
- [ ] `build.log` attached
- [ ] Playwright report attached (`playwright-report/`)
- [ ] Screenshots: `V2-render.png`, `node-drag.png`, `connection.png`
- [ ] CI run URL (green)
- [ ] Reviewer sign-off (name + timestamp)

## How to test locally

1. Checkout the branch: `git checkout feat/use-nodeeditor-v2`
2. Install deps and build (recommended in WSL):
   ```bash
   npm ci --legacy-peer-deps
   npm run build
   npm run dev
   ```
3. Open `http://localhost:5173` and verify NodeEditorV2 UI.

## Notes
- If `esbuild` related errors occur, include `esbuild-rebuild.log` and `esbuild-install.log`.


