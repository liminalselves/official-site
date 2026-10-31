# 阈界人格官方网站

一个 Node 服务同时提供两个站点的页面、接口和下载：

- 主站（项目组门户）：<https://www.liminalselves.top>
- Aliya Pet 官网（首页、功能、下载、更新日志、常见问题）：<https://aliyapet.liminalselves.top>

页面用 [Astro](https://astro.build/) 构建成静态文件，交给服务端（`server/`）发出去。Aliya Pet 站点还要用到发布接口：从 GitHub Release 同步版本、镜像安装包，并给 Aliya Pet 客户端检查更新。

## 架构

```
浏览器 ──HTTPS──▶ Nginx（只做证书和转发）──▶ Node 服务 :8787（server/index.mjs）
                                              │  按访问的域名选站点
                                              ├─ www.<域名>、裸域、其他 ─▶ server/sites/main.mjs
                                              │     页面：dist/
                                              └─ aliyapet.<域名>      ─▶ server/sites/aliyapet.mjs
                                                    页面：dist-aliyapet/
                                                    接口：/api/*　下载：/download/*　安装包：/files/*
```

- 站点只看域名的第一段，换任何根域名都能直接用，不需要改配置。
- 两个站点共用的部分在 `server/lib/`：
  - `static.mjs`：静态文件，支持目录跳转、404 页、压缩、304 和断点续传
  - `http.mjs`：域名判断、JSON 响应
  - `sync.mjs`、`release.mjs`：同步 GitHub Release、镜像安装包
- 以后给主站加后端，就在 `server/sites/main.mjs` 里加 `/api/...` 路由。目前主站的 `/api/*` 统一返回 404 JSON。

## 本地运行

```bash
npm ci           # 安装依赖（Node >= 22.12）
npm run serve    # 构建两个站点并启动服务，和线上一样
```

- 主站：<http://localhost:8787>
- Aliya Pet：<http://aliyapet.localhost:8787>

两个地址都不用改 hosts，浏览器会把 `*.localhost` 解析到本机。两个站点之间的互跳链接在本地也能用。第一次启动时，服务会从 GitHub 同步 Release 并下载安装包，数据写入 `./data/`，这个目录不进仓库。同步完成前，接口返回 503，页面显示构建时写入的版本信息。

其他命令：

| 命令 | 用途 |
| --- | --- |
| `npm run build` | 只构建两个站点，生成 `dist/` 和 `dist-aliyapet/` |
| `npm start` | 只启动服务，不重新构建 |
| `npm test` | 服务测试，使用伪造的 GitHub 和测试页面 |
| `npm run dev` / `npm run dev:aliyapet` | 改页面时用，保存后自动刷新（端口 4321）。Aliya Pet 的接口和下载会转发到 8787，需要另开 `npm start` |

Astro 锁定在 7.4.1：从 7.4.2 起要求 Node >= 22.23.4。

## 修改内容

- 文案、链接和数据集中放在两个文件里，组件只负责展示：
  - 主站：`src/data/site.ts`
  - Aliya Pet：`sites/aliyapet/data/pet.ts`。接口不可用时，更新日志页用 `sites/aliyapet/data/changelog-fallback.ts` 的数据。
- 静态文件分两处：
  - `public/`：两个站点共用的品牌文件（logo、字体、图标）
  - `sites/aliyapet/public/`：只给 Aliya Pet 用的文件，包括 Live2D 模型和静态图。构建时会把 `public/` 也复制进去。
- 主站和 Aliya Pet 之间的链接不写死域名。这类链接带 `data-sibling="www|aliyapet"`，运行时由 `src/scripts/sibling.ts` 换成当前访问的根域名。
- 搜索引擎的站长验证码填在 `site.verification`（百度 / Google / Bing）。
- 改动任何页面文字（包括 `sites/`）后，运行 `npm run font`，重新生成只含站内用字的标题字体。这一步需要 Python 的 `fonttools` 和 `brotli`。
- 替换 `src/assets/brand/logo.jpg` 后，运行 `npm run assets`。

## Aliya 形象

Aliya Pet 首页上的 Aliya 运行的是桌宠本体的 Live2D 模型和互动代码。它以网页嵌入的形式放在 `sites/aliyapet/public/pet/`，由 `sites/aliyapet/components/PetStage.astro` 用 iframe 加载。

- 模型加载完成前，以及设备不支持 WebGL2 时，显示静态图。
- 页面上的鼠标位置会转发给嵌入页，所以视线会跟随整个页面上的光标。
- 嵌入构建的说明见 Aliya_pet 仓库的 `docs/EMBED.md`。

模型、台词或互动有改动后，重新同步：

```bash
# Aliya_pet 仓库
cd redesign/ui && npm run build:embed
# 本仓库
node scripts/sync-pet-embed.mjs <Aliya_pet>/redesign/ui/dist-embed
```

## Aliya Pet 接口

服务每 10 分钟用 ETag 轮询一次 `liminalselves/Aliya_pet` 的最新 Release 和 Release 列表。发现新版本后，先把安装包下载到 `DATA_DIR/releases/<版本>/`，用 GitHub 给的 sha256 校验通过，再切换为当前版本。服务只保留最近 2 个版本。

Release 说明来自 Aliya_pet 的 `CHANGELOG.md`，写法见那边的 `docs/CHANGELOG-GUIDE.md`。接口返回的链接都用请求时的域名。

| 接口 | 用途 |
| --- | --- |
| `GET /api/latest` | 下载页用：版本号、日期、更新日志，以及各平台文件的大小、sha256 和地址 |
| `GET /api/releases` | 更新日志页用：所有已发布版本，新版本在前 |
| `GET /api/check?platform=windows\|android&version=x.y.z` | 客户端启动时检查：有没有更新、是否强制更新、下载地址 |
| `GET /api/tauri/{target}/{arch}/{version}` | Tauri updater 用：返回 204，或已签名的安装包信息 |
| `GET /download/windows\|windows-msi\|android` | 302 跳转到最新安装包，可以当固定的分享链接 |
| `GET /files/<版本>/<文件名>` | 镜像下来的安装包，支持断点续传 |

服务的环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | 8787 | 监听端口 |
| `HOST` | 127.0.0.1 | 监听地址 |
| `DATA_DIR` | `./data` | 同步数据和安装包存放位置 |
| `MAIN_DIST` | `dist` | 主站页面目录 |
| `ALIYAPET_DIST` | `dist-aliyapet` | Aliya Pet 页面目录 |
| `GITHUB_TOKEN` | 无 | 可选，用于提高 GitHub API 的访问限额 |
| `SYNC_INTERVAL_MINUTES` | 10 | 同步间隔 |
| `KEEP_VERSIONS` | 2 | 保留几个版本的安装包 |

## SEO

- 构建出来的是纯 HTML，正文不依赖 JS。在 `prefers-reduced-motion` 或禁用 JS 时，动画会直接显示内容。
- 每个页面都输出 title、description、canonical、Open Graph 和 Twitter Card。主站首页还带 `Organization` 和 `WebSite` 两段 JSON-LD。
- 两个站点各自生成 `sitemap-index.xml`，`robots.txt` 里写的是各自站点的 sitemap 地址。

## 部署

push 到 main 后，GitHub Actions 会跑测试、构建两个站点，再把整套服务提交到 `deploy-server` 分支。这个分支包含 `server/`、`dist/` 和 `dist-aliyapet/`，服务器只跟踪它。

`deploy` 分支是给旧部署用的，只有主站的静态页面。服务器切换到新服务后，就可以删掉 `deploy.yml` 里发布这个分支的那一段。

首次部署（服务器需要 Node >= 20）：

```bash
sudo git clone -b deploy-server https://github.com/liminalselves/official-site /d/liminal-site
sudo cp /d/liminal-site/server/deploy/liminal-site.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now liminal-site
curl -s http://127.0.0.1:8787/healthz
```

然后配置 Nginx。示例在 `server/deploy/nginx.conf`：每个域名一个 server 块，只配证书，再加一句 `proxy_pass http://127.0.0.1:8787`。改完后执行 `nginx -t && nginx -s reload`。

以后每次更新：

```bash
cd /d/liminal-site && sudo git pull && sudo systemctl restart liminal-site
```

## 结构

```
server/
├── index.mjs           # 入口：按域名分站
├── lib/                # 静态文件、HTTP 工具、Release 同步
├── sites/              # main.mjs（主站）、aliyapet.mjs（Aliya Pet 页面 + 接口）
├── deploy/             # systemd、Nginx 示例
└── test/
src/                    # 主站：data/site.ts、layouts、components、scripts、styles、pages
sites/aliyapet/         # Aliya Pet 站点（pages / components / layouts / data / scripts / public）
public/                 # 两站共用的品牌文件
scripts/                # 字体子集、品牌图生成、Live2D 嵌入同步
```
