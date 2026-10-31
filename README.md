# 阈界人格官方网站

本仓库包含两个站点和一个后端服务：

- 阈界人格（Liminal Selves）项目组门户首页：<https://www.liminalselves.top>
- Aliya Pet 官网（首页 / 功能 / 下载 / 更新日志 / 常见问题）：<https://aliyapet.liminalselves.top>
- Aliya Pet 发布服务（`server/`）：从 GitHub Release 镜像安装包，并为站点和客户端提供版本接口

两个站点都用 [Astro](https://astro.build/) 静态生成。Aliya Pet 站点复用主站的样式、字体、Nav 和 Footer。

## 本地开发

```bash
npm ci            # 按锁定版本安装依赖（Node >= 22.12）
npm run dev       # 开发服务器，默认 4321 端口
npm run build     # 生成 dist/
npm run preview   # 预览构建结果

npm run dev:aliyapet     # Aliya Pet 站点开发服务器；/api、/download、/files 代理到 127.0.0.1:8787
npm run build:aliyapet   # 生成 dist-aliyapet/
npm run test:server      # 发布服务测试（使用伪造的 GitHub API）
node server/index.mjs    # 本地运行发布服务，数据写入 ./data
```

Astro 锁定在 7.4.1：7.4.2 起要求 Node >= 22.23.4。

## 修改内容

- 文案、链接、联系方式、项目列表统一在 `src/data/site.ts`，组件只负责展示。Aliya Pet 站点的文案在 `sites/aliyapet/data/pet.ts`，更新日志页在接口不可用时的兜底版本数据在 `sites/aliyapet/data/changelog-fallback.ts`。
- 主站和下载页之间的链接不写死域名：链接带 `data-sibling="www|aliyapet"`，构建时默认指向 liminalselves.top，运行时由 `src/scripts/sibling.ts` 换成当前访问的根域名。
- 搜索引擎站长验证码填入 `site.verification`（百度 / Google / Bing），对应 meta 会自动输出。
- 改动任何页面文字（包括 `sites/`）后运行 `npm run font`（需要 Python 的 `fonttools` 和 `brotli`），重新生成只包含站内用字的标题字体 `public/fonts/noto-serif-sc-600.woff2`；否则新字会退回系统衬线体。
- 替换 `src/assets/brand/logo.jpg` 后运行 `npm run assets`，重新生成透明标志、favicon 和 `og.png` 分享图。

## SEO

- 构建产物为纯 HTML，正文不依赖 JS；动画在 `prefers-reduced-motion` 或禁用 JS 时直接显示内容。
- 每页输出 title / description / canonical / Open Graph / Twitter Card，首页带 `Organization` 与 `WebSite` JSON-LD。
- `@astrojs/sitemap` 生成 `sitemap-index.xml`，`public/robots.txt` 已声明地址。
- 上线后到百度搜索资源平台、Google Search Console、Bing Webmaster 提交站点与 sitemap。

## 部署

push 到 main 后 GitHub Actions 自动构建，并把 `dist/` 产物提交到 `deploy` 分支（见 `.github/workflows/deploy.yml`）。服务器端只跟踪 `deploy` 分支，更新时 `git pull` 即可：

```bash
sudo git clone -b deploy https://github.com/liminalselves/official-site /opt/official-site
# 之后每次更新
cd /opt/official-site && sudo git pull
```

Nginx 托管该目录，示例：

```nginx
server {
    listen 443 ssl http2;
    server_name www.liminalselves.top;
    root /opt/official-site;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
    error_page 404 /404.html;

    location ~* \.(?:css|js|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    location ~* \.(?:png|webp|jpg|svg)$ {
        expires 30d;
    }
}

# 裸域统一跳转到 www，避免重复收录
server {
    listen 443 ssl http2;
    server_name liminalselves.top;
    return 301 https://www.liminalselves.top$request_uri;
}
```

## Aliya 形象素材

下载页首页的互动形象是从 Aliya Pet 本体渲染出来的分层图，资源和台词都来自 Aliya_pet 仓库（形象只在 aliyapet 站点使用，主站仍只用 logo 与抽象图形）：

- `public/pet/*.webp`、`sites/aliyapet/data/pet-layers.json`：基础形象与各表情、动作帧，由 `scripts/gen-pet-layers.mjs` 生成。只改像素的帧（惊讶、受击）裁成局部图层，改动轮廓的帧存整帧并在显示时替换基础图。
- `sites/aliyapet/data/pet-lines.json`：台词，摘自 Aliya_pet `redesign/ui/assets/dialogue/`。
- `sites/aliyapet/scripts/pet-stage.ts`：眨眼、呼吸、问候、按区域点击反应、连点、头顶抚摸、气泡的状态机。

模型更新后重新出图：在 Aliya_pet `redesign/ui` 运行 `npx vite --port 5199`，用无头 Edge 打开页面，停掉自动动作、呼吸和眨眼，固定视线，逐个调用 `petAI.express()` / `petAI.play('wave')` 截取 960×1440 的透明 PNG，帧名与 `gen-pet-layers.mjs` 里的 `POSES` 对应（另需 `neutral`）；然后运行 `node scripts/gen-pet-layers.mjs <帧目录>`。

## Aliya Pet 发布服务

服务每 10 分钟用 ETag 轮询一次 `liminalselves/Aliya_pet` 的最新 Release 和 Release 列表（列表只存文字，供更新日志页使用）。发现新版本后，它把安装包下载到 `DATA_DIR/releases/<版本>/`，用 GitHub 提供的 sha256 校验通过后再切换到新版本，并保留最近 2 个版本。

Release 说明来自 Aliya_pet 仓库 `CHANGELOG.md` 中对应版本的小节，由 Aliya_pet 的发版 CI 写入。在小节里加一行 `<!-- min-version: x.y.z -->`，低于该版本的客户端就必须更新。

接口返回的链接都使用请求的域名，所以多个域名可以同时使用。

| 接口 | 用途 |
| --- | --- |
| `GET /api/latest` | 首页与下载页：版本、日期、各平台文件（大小、sha256、地址） |
| `GET /api/releases` | 更新日志页与首页版本入口：全部已发布版本的说明，新版本在前 |
| `GET /api/check?platform=windows\|android&version=x.y.z` | 客户端启动检查：是否有更新、是否强制、下载地址 |
| `GET /api/tauri/{target}/{arch}/{version}` | Tauri updater 端点：返回 204 或已签名的 NSIS 安装包 |
| `GET /download/windows\|windows-msi\|android` | 302 跳转到最新安装包，可作为固定分享链接 |
| `GET /files/<版本>/<文件名>` | 镜像的安装包文件，生产环境由 Nginx 直接提供 |

环境变量：`PORT`（默认 8787）、`DATA_DIR`、`GITHUB_TOKEN`（可选）、`SYNC_INTERVAL_MINUTES`、`KEEP_VERSIONS`。

部署：CI 把 `dist-aliyapet/` 和 `server/` 发布到 `deploy-aliyapet` 分支，对应目录分别是 `site/` 和 `server/`。服务器上需要 Node ≥ 20。

```bash
sudo git clone -b deploy-aliyapet https://github.com/liminalselves/official-site /opt/aliyapet
sudo useradd --system --no-create-home --shell /usr/sbin/nologin aliyapet
sudo cp /opt/aliyapet/server/deploy/aliyapet-release.service /etc/systemd/system/
sudo systemctl enable --now aliyapet-release
# Nginx 参考 /opt/aliyapet/server/deploy/nginx-aliyapet.conf，配好证书后 reload
# 之后每次更新
cd /opt/aliyapet && sudo git pull && sudo systemctl restart aliyapet-release
```

## 结构

```
src/
├── data/site.ts        # 站点数据唯一来源
├── layouts/Base.astro  # <head>、SEO、JSON-LD
├── components/         # Nav / Hero / About / Projects / Capabilities / Join / Footer
├── scripts/motion.ts   # 星点背景、视差、卡片倾斜、滚动揭示、复制群号
├── scripts/sibling.ts  # 主站 / 下载页互跳的域名改写
├── styles/global.css   # 设计令牌、按钮、揭示动画
└── pages/              # index、404
sites/aliyapet/         # Aliya Pet 站点（pages / components / layouts / data / scripts）
scripts/                # gen-assets.mjs（品牌图）、subset-font.py（字体子集）
```
