# 阈界人格官方网站

阈界人格（Liminal Selves）项目组门户首页，基于 [Astro](https://astro.build/) 静态生成：<https://www.liminalselves.top>

## 本地开发

```bash
npm ci            # 按锁定版本安装依赖（Node >= 22.12）
npm run dev       # 开发服务器，默认 4321 端口
npm run build     # 生成 dist/
npm run preview   # 预览构建结果
```

Astro 锁定在 7.4.1：7.4.2 起要求 Node >= 22.23.4。

## 修改内容

- 文案、链接、联系方式、项目列表统一在 `src/data/site.ts`，组件只负责展示。
- 搜索引擎站长验证码填入 `site.verification`（百度 / Google / Bing），对应 meta 会自动输出。
- 改动任何页面文字后运行 `npm run font`（需要 Python 的 `fonttools` 和 `brotli`），重新生成只包含站内用字的标题字体 `public/fonts/noto-serif-sc-600.woff2`；否则新字会退回系统衬线体。
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

## 结构

```
src/
├── data/site.ts        # 站点数据唯一来源
├── layouts/Base.astro  # <head>、SEO、JSON-LD
├── components/         # Nav / Hero / About / Projects / Capabilities / Join / Footer
├── scripts/motion.ts   # 星点背景、视差、卡片倾斜、滚动揭示、复制群号
├── styles/global.css   # 设计令牌、按钮、揭示动画
└── pages/              # index、404
scripts/                # gen-assets.mjs（品牌图）、subset-font.py（字体子集）
```
