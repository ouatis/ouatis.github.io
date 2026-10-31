# AGENTS.md

给在这台机器上干活的 AI Agent(以及偶尔失忆的人类)。

## 这是什么

ouatis.com——「笼城往事」,SigiL 的三语博客(zh-CN 为主,en/ja 界面)。Hugo
构建,主题 `hugo-theme-sigil` 以子模块身份接入,GitHub Actions 部署到
GitHub Pages。

## 关键事实:themes/hugo-theme-sigil 是 submodule(2026-10-13 订正)

**2026-10-13 实测订正:这里已不是 NTFS junction,而是标准 git submodule。**
此前本文件(与 `ouatis-design` 技能卡)记载的「junction／两份路径同一份工作树」已失效。

实测依据:

- `.gitmodules` 有条目:`url = https://github.com/ouatis/hugo-theme-sigil`;
- `themes/hugo-theme-sigil/.git` 是**文件**而非目录,内容为
  `gitdir: ../../.git/modules/themes/hugo-theme-sigil`;
- index 模式 `160000`(gitlink),`git ls-tree HEAD themes/` 可复核 pin;
- `os.readlink` 报「不是一个重分析点」,即不是 junction。

原 junction 时代的告警**不再适用**,实际规则有三条:

- **两份独立工作树**:独立克隆在 `C:\Users\louxi\Documents\Repos\hugo-theme-sigil`
  (branch `main`),与本仓内的 submodule checkout **互不影响**。在独立库改完
  **不会**自动进本仓,必须显式更新 pin 并单独提交。
- **detached HEAD 是 submodule 的正常状态**。submodule checkout 默认就停在 pin
  那个 commit 上,`git submodule update` 也会置于 detached;这不是「提交丢在游离态」
  的故障。真正的规则是**不要在本仓的 submodule 里直接提交主题改动**,改动一律在独立库做。
- **「子模块 bump」的动作未变**:主题库 HEAD/tag 移动后,在本仓
  `git add themes/hugo-theme-sigil` 并**单独**提交,再用 `git ls-tree HEAD themes/`
  验证 pin 真的移动;amend 后同样要确认分支指针前进。

`scripts/bump-theme.sh` 会消除游离态——它按 submodule 语义实现。
**改本文件前请先 `git fetch` 比对远端**(见仓库层规则)。

## 事实归属(2026-10-13 增补)

本文件是**本仓库运行时事实的唯一权威源**:仓库路径、submodule/junction 形态、
构建与部署命令、内容约定、`publish:` 前缀同步机制。技能卡只覆盖设计与跨仓库
联动;两者冲突时以本文件为准。

- 仓库路径(2026-10-13 实测):主站 `C:\Users\louxi\Documents\Repos\ouatis.github.io`;
  主题 `C:\Users\louxi\Documents\Repos\hugo-theme-sigil`。
  ⚠️ `ouatis-design` 技能卡原在 vault 外 `~/.agents/skills/`，无同步机制保护；2026-10-30 核查该目录已无此卡（仅剩 `codexhost-delegation`），原漂移风险随之失效。
- `JARDIN\03-OUATIS` 只是文稿区,**不是内容真理来源**;内容同步进本仓靠
  `publish:` 前缀提交(见「内容约定」)。

## 主题升级

```bash
scripts/bump-theme.sh v0.9.x   # 对齐子模块 pin,本地主题 main 跟随
```

**submodule 语义**(2026-10-13 订正):`themes/hugo-theme-sigil` 是标准
submodule,不是 junction。`git submodule update` 让它停在 pin 的 detached HEAD
属**正常**;`scripts/bump-theme.sh` 对齐 pin 后会消除游离态。**提交主题改动前务必
在独立库 `C:\Users\louxi\Documents\Repos\hugo-theme-sigil` 里
`git branch --show-current` 确认在 `main` 上**,而不是在本仓的 submodule 里。

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
- 主题的参数契约与坑见主题仓库的 AGENTS.md,路径 C:\Users\louxi\Documents\Repos\hugo-theme-sigil(2026-10-13 订正:已不是 junction,需按绝对路径打开)。
