# Cloudflare Workers 迁移交接（cloudflare-migration 分支）

这个分支只做「准备」，**没有切 DNS、没有部署、没有改 main、没有改 GitHub Pages 设置**。
今天只把 `cloudflare-migration` 分支推到 GitHub。明天在另一台设备 checkout 这个分支，照下面做即可。

只需要 `git` 和 `python3`；不需要本机装 wrangler，部署由 GitHub Actions 里的 `cloudflare/wrangler-action@v4` 做。

## 0. 复核到的基线（2026-11-04 23:13 Asia/Shanghai）

- `origin/main` = `94a3bf18033b2d6d578aa126e4cc8c965ad02451`（about 页 `unsafe = true` 修复已经在远端）。
- 本分支基于同一个提交，只多一个迁移提交。
- 主题 submodule：`686df5e19c1cf912e566e8a1813e511e287a24ce`。
- Hugo：`0.167.0 extended`；`baseURL = 'https://ouatis.com/'` 不变。
- 当前链路仍是 **Cloudflare edge → GitHub Pages/Fastly origin**；DNS NS 已在 Cloudflare。
- `public/` 约 1084 文件 / 46.3 MiB / 最大单文件 3.41 MiB，低于 Workers Free 的 20,000 文件、25 MiB 限制。
- 仓库现有 secret 只有 `CF_ANALYTICS_TOKEN`；本分支需要新增 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。
- `public/` 里没有 `_headers`、`_redirects`；本方案先用 Workers 默认行为。

## 1. 明天另一台设备：拿到分支

```bash
git clone -b cloudflare-migration https://github.com/ouatis/ouatis.github.io.git
cd ouatis.github.io
git submodule update --init --recursive
```

如果那台设备已经有仓库：

```bash
git fetch origin
git checkout cloudflare-migration
git submodule update --init --recursive
```

**不需要传 zip、不需要传补丁、不需要在这台机器上再操作。**

## 2. 在 Cloudflare / GitHub 先做四件事

1. 确认 `ouatis.com` zone 在 Cloudflare 且 NS 仍是 Cloudflare（已是）。把当前 DNS 记录、CAA、SSL、Cache / Page / Redirect / WAF 规则导出或截图留底；本地没有 API token，看不到 dashboard 内部记录。
2. 建最小权限 API token：Cloudflare dashboard → My Profile → API Tokens → Create Token → Custom token → 选 **Edit Cloudflare Workers** 模板，权限只给这个 account（能不动 Zone 就不动）。复制 token。
3. 在 zone Overview 的 API 区拿 **Account ID**。
4. GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret：
   - `CLOUDFLARE_API_TOKEN` = 上一步 token
   - `CLOUDFLARE_ACCOUNT_ID` = Account ID
   保留原有 `CF_ANALYTICS_TOKEN`。**先不要**把 `CF_CUSTOM_DOMAIN_READY` 设为 `true`（没设就等于 false）。

## 3. 本地预检 + 构建

```bash
python3 scripts/check-cloudflare-migration.py preflight
hugo --minify
python3 scripts/check-cloudflare-migration.py build
```

`preflight` 检查 `wrangler.toml`、`deploy.yml`、`hugo.toml` 与检查脚本本身；`build` 检查 `public/` 的路由、canonical、文件数/大小、IndexNow key 文件、404 与三语入口。若本地字体子集缺失，先跑 `scripts/build-fonts.sh`（需要 `fonttools`、`brotli`）；CI 里这一步已有。

## 4. 影子部署（不碰 ouatis.com）

本分支的 `deploy.yml` 保留 `push: branches: [main]`，所以**推送这个分支不会自动部署**。deploy step 不再限制 ref，因此手动触发也会部署；影子部署用 `workflow_dispatch`：

1. GitHub → Actions → **Deploy Hugo Site** → **Run workflow** → 分支选 `cloudflare-migration` → Run。
2. 等 CI 成功。`Show Workers URL` 步骤会打印 `https://ouatis-site.<subdomain>.workers.dev`。
3. 用那个 URL 跑：

```bash
python3 scripts/check-cloudflare-migration.py live --base-url https://ouatis-site.<subdomain>.workers.dev
```

它会检查首页 200、canonical、无 `x-github-request-id` / `x-fastly-request-id` / `x-proxy-cache` / `via: varnish`、404 返回自定义 404 页、尾斜杠跳转、三语入口、sitemap/feed/llms/robots/IndexNow key。再人工看一眼 OG 图、字体、三语切换。

> 注意：`wrangler.toml` 此时 `workers_dev = true`、`preview_urls = false`；`*.workers.dev` 是影子 URL，不要提交给搜索引擎。`Ping IndexNow` 仍要求 main + `CF_CUSTOM_DOMAIN_READY=true`，影子阶段不会通知搜索引擎。

## 5. 切到 ouatis.com

1. Cloudflare dashboard → Workers & Pages → `ouatis-site` → **Custom Domains** → Add `ouatis.com`。
   - 如果 apex 已经有 CNAME DNS 记录，先删/改；官方文档明确说不能在已有 CNAME 的 hostname 上建 Custom Domain。
   - Cloudflare 会自动建 DNS 并签 Advanced Certificate。
2. `www.ouatis.com`：用 **Redirect Rule / Bulk Redirect** 做 301 → `https://ouatis.com`，开启 Preserve query string / Subpath / Preserve path suffix；再给 `www` 加一条 proxied 占位记录 `A 192.0.2.0` 或 `AAAA 100::`。Custom Domain 只精确匹配 `ouatis.com`，不会自动接 `www`。
3. 检查 CAA：若存在，需允许 `letsencrypt.org`、`pki.goog; cansignhttpexchanges=yes`、`ssl.com`；确认 `http://ouatis.com/.well-known/acme-challenge/*` 没被拦截。
4. 验证：

```bash
python3 scripts/check-cloudflare-migration.py live --base-url https://ouatis.com --expect-production
```

`--expect-production` 会额外检查 `https://www.ouatis.com/` 最终落到 `https://ouatis.com`。通过后也人工确认 canonical、OG 卡、字体、404、三语。

## 6. 关掉影子 URL，并让 main 成为长期发布分支

1. GitHub 仓库 variable 设 `CF_CUSTOM_DOMAIN_READY = true`。
2. 用 final 配置覆盖，并预检：

```bash
cp wrangler.toml.final wrangler.toml
python3 scripts/check-cloudflare-migration.py preflight --stage final
git add wrangler.toml
git commit -m "chore(cloudflare): 关闭 workers.dev"
git push origin cloudflare-migration
```

3. 合进 main 并 push（**这一步才是明天的生产部署**，今天没做）：

```bash
git checkout main
git merge cloudflare-migration
git push origin main
```

main 的 push 会触发新 workflow：`wrangler deploy` 用 `workers_dev = false` 的配置再发一次，且因为 `CF_CUSTOM_DOMAIN_READY=true`，`Ping IndexNow` 才会执行。之后每天 UTC 22:00 的定时重建、字体子集、Cloudflare GraphQL 统计、旧 run 清理都保留。

## 7. 48 小时回滚窗口

- 保留 GitHub Pages custom domain 和 `static/CNAME`，先别删。
- 要临时回退，用 Cloudflare **Origin Rule / Redirect Rule** 把 `ouatis.com` 指回 GitHub Pages；不要把 DNS 切走再切回（Pages 已知问题会让 custom domain inactive）。
- `https://ouatis.github.io/` 目前 301 到 `http://ouatis.com/`（注意是 http），可作为兜底，之后要改成 https 或清理。
- 确认稳定后再做清理：删 GitHub Pages custom domain、删 `static/CNAME`、清理残留 Advanced Certificate、处理 `ouatis.github.io` 的 http 301。

## 8. 迁后 24–48 小时

- `scripts/fetch-analytics.py` 用的是 Cloudflare zone 级 GraphQL（`ZONE_ID = "e0fb8899116f18b8def627ea024dba7d"`），不是 GitHub Pages 专属；确认 `data/analytics.json` 的 pageViews 仍记在同一 zone。
- 确认 IndexNow ping 成功、`7e...` 这类 32 位十六进制 key 文件仍返回 200（检查脚本会自动从 `static/` / `public/` 发现，不写死 key）。
- 再跑一次 `live --expect-production`，并人工看 OG 图、字体、canonical、404、三语、sitemap/feed/llms/robots。

## 9. 可选 _headers

当前 `public/` 没有 `_headers`。Workers 默认发 `Cache-Control: public, max-age=0, must-revalidate`、`ETag`、`CF-Cache-Status`。如果确实要恢复现在的 `Access-Control-Allow-Origin: *` 并阻止影子域名被索引，可新建 `static/_headers`（Hugo 会带进 `public/`），内容：

```
/*
  Access-Control-Allow-Origin: *

https://:version.:subdomain.workers.dev/*
  X-Robots-Tag: noindex
```

不要为了复刻现在 GitHub Pages 的 `max-age=600` 盲目覆盖 Workers 默认缓存头。`_redirects` 不支持域名级跳转，`www` 必须用 Cloudflare Redirect Rule。

## 10. 官方依据

- [Pages overview](https://developers.cloudflare.com/pages/)："Start new projects with Workers."
- [Migrate from Pages to Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)：纯静态无 `main`、无 `binding="ASSETS"`，`not_found_handling="404-page"`。
- [SSG and custom 404](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/)：`html_handling` 默认 `"auto-trailing-slash"`。
- [Workers GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)：`cloudflare/wrangler-action@v4` + 两个 secrets。
- [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)：不能在已有 CNAME 的 hostname 上创建；`www` 需 Redirect Rule + 占位 DNS。
- [Billing and Limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)：静态资源请求免费且不限量；Range 返回 200 完整文件，不返回 206。
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)：Free 20,000 files/version、25 MiB/文件。

## 时间

准备 + 本地/影子验证约 **20–40 分钟**；切域 + 证书/缓存观察约 **15–30 分钟**；另留 **24–48 小时**监控。今天没有执行其中任何发布动作。

这台机器 `/Users/xiaobinggan/Documents/JARDIN/cloudflare-migration-handoff/` 里只是生成用的中间文件，不用带走。如果明天另一台设备不便敲命令，把本文件直接给那台设备的 AI 助手即可。
