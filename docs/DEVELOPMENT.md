# 开发指南

## 环境

- Node.js 22 或更新版本，使用 npm 与仓库中的 `package-lock.json`。
- 仅素材处理和素材测试需要 Python 3 与 Pillow。

这是本插件的构建环境。安装和运行 DSH 时还须满足相应宿主发行版的 Node.js 要求；桌面版使用内置运行时，安装入口见 [README](../README.md#快速安装)。

```bash
npm ci --ignore-scripts
npm run check
```

## 目录

```text
src/                 客户端 UI、状态、宿主适配与中文文案
assets/              角色参考图、透明表情帧和来源记录
scripts/             构建、预览服务与素材处理脚本
tests/               Node 行为测试与 Python 素材测试
lib/client.js        DSH 客户端构建产物，随源码提交
locale/              插件管理页展示元信息，英文发现入口与中文翻译
docs/screenshots/    实际 UI 效果图
index.js             Host bundle 入口
cordis.patch.yml     DSH 插件加载声明
```

`src/client.js` 通过 Cordis 生命周期挂载桌宠；`src/adapter.js` 读取 DSH snapshot/subscribe 接口；`src/model.js` 维护状态；`src/pet.js` 负责 UI。详细边界见 [架构说明](ai-dev/01-project-architecture.md)。

## 日常流程

1. 修改聚焦的源码、中文文案或素材。
2. 运行 `npm run check`，同步生成 `lib/client.js`。
3. 对 UI 变化运行 `npm run preview`，检查真实交互及窄窗口表现。
4. 修改素材时补跑 `python3 tests/test_artwork.py` 并检查表情对照。
5. 更新 README、CHANGELOG 与受影响的效果图。

DSH 目录安装依赖已生成的 `lib/client.js`；仅修改 `src/` 不会改变安装后的行为。预览与 DSH 使用同一套 UI 和状态逻辑，只有状态来源不同。

兼容版本写在 `package.json` 顶层 `engines.dsh`，并同步锁文件根包的声明。插件管理页标题和描述使用 `locale/*.json` 的 `meta`，通过 `exports` 暴露并随包发布；桌宠自身 UI 文案仍由 `src/i18n/index.ts` 管理。官方规范与当前分发状态见 [DSH 插件规范](../README.md#dsh-插件规范)。

## 素材环境

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r scripts/requirements-artwork.txt
python scripts/pixelate.py assets/reference.jpg
python tests/test_artwork.py
npm run build
```

Windows 可通过 `.venv\Scripts\Activate.ps1` 激活虚拟环境。算法和素材约束见 [素材说明](ARTWORK.md)。

## 预览与打包

```bash
npm run preview
npm run pack:local
```

预览服务只监听 `127.0.0.1`，默认使用空闲端口；如需指定端口，设置 `GUGUGAGA_PREVIEW_PORT`。结束预览使用 Ctrl+C。

`dist/` 与 `.preview/` 是本地产物，不提交。npm 包只包含运行时文件、素材和用户文档，不包含依赖目录、测试、开发缓存或用户配置。

## 提交前

- 构建与相关测试通过，生成文件与源码一致。
- UI 文案使用国际化 key；用户输入以纯文本渲染。
- 截图来自实际 UI，只包含演示数据。
- 不提交机器路径、个人联系方式、认证配置、密钥或真实会话数据。
- 保留现有未提交修改；不通过强制推送覆盖其他人的提交。
