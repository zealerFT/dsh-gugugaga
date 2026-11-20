# 插件架构

这是独立的 DSH 插件。`package.json` 和 `cordis.patch.yml` 声明 Host bundle 与客户端模块，适配 DSH `0.2.2-rc.5` 的 bundle/client contract。

`src/adapter.js` 只订阅宿主状态；`src/model.js` 管理互动、提醒和状态转换；`src/phrases.js` 校验和选择按场景存储的用户台词；`src/pet.js` 在 Shadow DOM 渲染界面；`src/i18n/index.ts` 集中保存中文文案；`src/client.js` 接入 Cordis 生命周期。插件不发送会话、不处理审批、不访问文件系统或凭据。偏好、独立角色/面板坐标、自定义台词、互动统计和专注计时保存在插件独有的 localStorage 中。面板拖动使用独立 pointer 状态，角色移动不更改面板坐标。用户台词通过 textContent 显示，朗读复用系统语音。

构建输出使用 DSH `window.__ModuleLoader__.load` 协议，素材内嵌以免依赖外部 CDN。停用时清理 DOM、订阅、事件、音频和所有定时器。预览使用相同 UI 与状态机，只替换状态来源为显式演示控制。

原图是项目维护者提供的企鹅服小朋友三视图。`scripts/pixelate.py` 通过高分辨率原图嘴部几何形变与原图肤色纹理的闭合眼睑合成生成表情，统一输出 224×320 RGBA 素材。微笑、开心和满足保留原图眼睛；睡眠与眨眼完全遮盖虹膜和瞳孔，保留原图刘海。`expressionFor` 按状态选择表情；手动睡眠保持闭眼，眨眼服从减少动态设置，卸载清理定时器。
