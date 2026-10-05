#!/usr/bin/env bash
# 把主题子模块对齐到指定 ref(默认 main 最新),并让本地主题克隆的 main
# 跟随该 ref——避免 junction/子模块工作树停在 detached HEAD(提交会丢在游离态)。
# 用法: scripts/bump-theme.sh [ref]    例: scripts/bump-theme.sh v0.9.6
set -euo pipefail

REF="${1:-main}"
cd "$(dirname "$0")/.."

git -C themes/hugo-theme-sigil fetch origin -q

# ref 既可能是分支(origin/main),也可能是标签(v0.9.6)
if git -C themes/hugo-theme-sigil rev-parse -q --verify "origin/${REF}" >/dev/null 2>&1; then
    PIN=$(git -C themes/hugo-theme-sigil rev-parse --verify "origin/${REF}")
elif git -C themes/hugo-theme-sigil rev-parse -q --verify "${REF}" >/dev/null 2>&1; then
    PIN=$(git -C themes/hugo-theme-sigil rev-parse --verify "${REF}")
else
    echo "bump-theme: 找不到 ref: ${REF}" >&2
    exit 1
fi

git -C themes/hugo-theme-sigil checkout -q "$PIN"
# junction 的主题仓库回到 main 并快进到 pin——工作树永远停在一个分支上
if git -C themes/hugo-theme-sigil show-ref --verify -q refs/heads/main; then
    git -C themes/hugo-theme-sigil checkout -q main
    git -C themes/hugo-theme-sigil merge --ff-only "$PIN" 2>/dev/null ||
        git -C themes/hugo-theme-sigil checkout -q "$PIN"
fi
git add themes/hugo-theme-sigil

echo "主题对齐: $(git -C themes/hugo-theme-sigil log --oneline -1)"
echo "下一步: git commit(信息例: fix: 子模块升 <版本>——摘要)"
