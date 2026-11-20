# 技术栈事实表

| 类别 | 选择 | 证据 |
| --- | --- | --- |
| 宿主 | DeepSeek Harness 0.2.2-rc.5 及兼容版本 | `package.json` 的宿主版本约束；`src/adapter.js` 的接口 |
| 前端 | 原生 DOM、Shadow DOM、CSS | `src/pet.js`、`src/pet.css` |
| 状态联动 | Cordis effect 与 DSH snapshot/subscribe | `src/adapter.js` |
| 构建 | Node.js 22、esbuild 0.27 | `package.json`、`scripts/build.mjs` |
| 素材 | 角色参考图；Python 3 + Pillow 仅作素材处理 | `scripts/pixelate.py`、`docs/ARTWORK.md` |
| 测试 | Node 内置 test runner | `tests/` |
| 存储 | 本机浏览器 localStorage | `src/storage.js` |

插件没有自建后端、数据库、遥测或运行时第三方网络请求。开发预览使用 Node 内置 HTTP 服务，安装后复用 DSH 原有插件机制。
