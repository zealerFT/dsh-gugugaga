# 开发约定

本仓库是咕咕嘎嘎插件的源码事实源。后续开发、构建、测试和文档修改都在当前 Git 仓库完成，不回写其他项目中的旧副本。

## 入口

- 产品与安装：`README.md`
- 开发流程：`docs/DEVELOPMENT.md`
- 架构与技术栈：`docs/ai-dev/01-project-architecture.md`、`docs/ai-dev/02-tech-stack.md`
- 素材来源与生成：`docs/ARTWORK.md`
- 验证范围：`docs/validation.md`

## 实现边界

- 使用 DSH Host bundle 和 client module；运行时保持无第三方依赖。
- `src/adapter.js` 只订阅宿主状态，不发送会话或代替用户处理审批。
- 状态放在 `src/model.js`，存储校验放在 `src/storage.js`，台词校验放在 `src/phrases.js`。
- UI 使用 Shadow DOM；可见文案通过 `src/i18n/index.ts` 的 `t(...)` 获取。
- 用户台词按纯文本显示；角色位置和面板位置独立保存。
- 监听器、计时器、通知和音频资源必须在停用时清理。
- 角色素材保持企鹅套装小朋友的外观；修改表情后检查原图对照、肤色过渡和实际显示尺寸。

## 验证与交付

```bash
npm ci --ignore-scripts
npm run check
python3 tests/test_artwork.py
```

`lib/client.js` 随源码提交，保证本地目录安装可直接加载。修改源码或素材后构建并同步该文件。素材测试需要 Pillow，普通 JS 开发不要求重新生成素材。

功能变化应同步 README、CHANGELOG 和相关测试。效果图必须来自实际运行的插件 UI；演示状态要明确标注，不能写成真实宿主验收。

## 公开内容

- 不提交本机绝对路径、个人联系方式、账号配置、凭据、令牌、密钥、会话记录或真实业务数据。
- 安装文档使用相对路径、当前目录或通用占位符。
- 截图只包含演示数据；检查通知、标题、路径和图像元数据。
- Git 身份和认证只保存在用户配置或 `.git` 中，不写入源码。
