# AGENTS.md

给在这台机器上干活的 AI Agent(以及偶尔失忆的人类)。

## 这是什么

ouatis.com——「笼城往事」,SigiL 的三语博客(zh-CN 为主,en/ja 界面)。Hugo
构建,主题 `hugo-theme-sigil` 以子模块身份接入,GitHub Actions 部署到
GitHub Pages。

## 致命事实:themes/hugo-theme-sigil 是 junction

`themes/hugo-theme-sigil` 是指向 `../hugo-theme-sigil`(Repos 下的独立克隆)
的 Windows junction——**两者是同一个仓库、同一份工作树**:

- 在任一路径执行 `git checkout` 会同时翻转两边;
- 永远不要让它处于 detached HEAD——提交会丢在游离态,`main` 不前进;
- 所谓「子模块 bump」= 主题仓库 HEAD 移动后,在本仓库
  `git add themes/hugo-theme-sigil` 并提交;
- amend 之后要确认分支指针真的移动了。

## 主题升级

```bash
scripts/bump-theme.sh v0.9.x   # 对齐子模块 pin,本地主题 main 跟随
```

**junction 陷阱**: themes/hugo-theme-sigil 是指向 ../hugo-theme-sigil 的
junction——同一仓库同一工作树。任何 checkout tag/`git submodule update`
都会让主题仓库进入 detached HEAD;`scripts/bump-theme.sh` 会在对齐后把
main 快进到 pin,消除游离态。主题仓库提交前务必
`git branch --show-current` 确认在 main 上。

## 构建与验证

```bash
hugo --minify          # 生产构建(Hugo ≥ 0.167,与 CI 一致)
bash scripts/build-fonts.sh   # 字体管线:正文语料子集 + OG 标题字体
```

- 字体管线需要 python3 + fonttools + brotli;Git Bash 的 PATH 用 POSIX
  形式(`/c/...`),`C:/...` 形式静默不生效;本机 python3 是垫片
  (Repos/.shims),它不支持 venv,要 venv 用真实 Python。
- build-fonts.sh 3b 段生成 `assets/fonts/og/og-card.ttf`(OG 卡片字体,
  `--flavor=none`——pyftsubset 默认沿用输入的 woff2 flavor,写进 .ttf
  文件名的会是 wOF2 字节,Go 解析器直接拒)。
- **改任何字体后必须 `rm -rf resources` 再测**:Hugo 的处理缓存
  (`resources/_gen`)不把字体字节算进键,旧缓存会给出假绿的构建。

## 输出与特性

- home outputs(仅 zh-CN):HTML、RSS、JSON、JSONFeed、LLMSTXT、LLMSFULL
- `ogAutoCard = true` + `ogCardFont`:无封面的文章构建期生成 1200×630
  OG 卡片(纸底∴);标题字体即上述 og-card.ttf
- llms.txt / llms-full.txt:模板在主题里;站点只出导语
  (`llmsTxtIntro`)与页面短注(about/archives 的 front matter description)
- 主题侧通用验证:`bash scripts/check.sh`

## 自动化(.github/workflows/deploy.yml)

- 每日 22:00 UTC 定时重建,刷新页脚累计浏览量;数字只进当次构建,不回
  commit;
- fetch-analytics.py 拉 Cloudflare 统计(CF_API_TOKEN secret,失败优雅
  跳过);indexnow.py 构建后提交 sitemap;
- 构建失败先看 Actions 日志:`git credential fill` 取 token 可直接拉
  logs API。

## 内容约定

- `content/*.md` 为中文主文,`content/en/`、`content/ja/` 为翻译;
  文章在 Obsidian 打稿,定稿后以 `publish:` 前缀提交同步进来。
- 这些是刻意的,不要"修":`> [!note]` callout 的字面渲染、404 的迷宫
  文案、"Update My Journal"——系游戏《Planescape:
  Torment》的台词;∴ 与三色是全站视觉母题。
- 关于页/归档页 front matter 的 `description` 同时喂给 llms.txt 的页面
  短注与 og:description,改一处三处受益。
- 主题的参数契约与坑见主题仓库的 AGENTS.md(junction 路径过去即可)。
