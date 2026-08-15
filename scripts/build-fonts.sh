#!/usr/bin/env bash
# 重新生成思源宋体（Noto Serif CJK SC）站内用字子集。
#
# 依赖：python3 + fonttools（pip install "fonttools[woff]"）、curl
# 用法：scripts/build-fonts.sh
#
# 字符集 = 现有 charset.txt ∪ 从 content/ layouts/ i18n/ archetypes/ hugo.toml
# 提取的全部字符（剔除控制符、组合符、emoji——emoji 由系统字体渲染）。
# 本地或 CI 构建前运行；生成的 charset.txt 可随仓库提交，便于人工核对。
set -euo pipefail

cd "$(dirname "$0")/.."

# 字体源：google/fonts 仓库的 Noto Serif SC 可变字体，按 commit 固定保证可复现
NOTO_VAR_SHA="2e61f4355afd22b801791b0df176065082423b87"
NOTO_VAR_URL="https://github.com/google/fonts/raw/${NOTO_VAR_SHA}/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf"
CACHE_DIR="${NOTO_CACHE_DIR:-.cache/noto-cjk}"
FONT_DIR="static/fonts"

python3 -c 'import fontTools, brotli' 2>/dev/null || {
    echo "缺少依赖：pip install \"fonttools[woff]\"" >&2
    exit 1
}
command -v pyftsubset >/dev/null || {
    echo "找不到 pyftsubset，请确认 fonttools 已安装" >&2
    exit 1
}

mkdir -p "$CACHE_DIR" "$FONT_DIR"

src="${CACHE_DIR}/NotoSerifSC-var.ttf"
if [ ! -s "$src" ]; then
    echo "下载 NotoSerifSC 可变字体（${NOTO_VAR_SHA:0:8}）…"
    curl -fL --retry 3 -o "$src" "$NOTO_VAR_URL"
fi

python3 - <<'PY'
import pathlib
import unicodedata

roots = ["content", "layouts", "i18n", "archetypes"]
exts = {".md", ".html", ".toml", ".yaml", ".yml", ".json", ".txt"}
chars = set(pathlib.Path("hugo.toml").read_text(encoding="utf-8", errors="ignore"))

for root in roots:
    p = pathlib.Path(root)
    if not p.exists():
        continue
    for f in p.rglob("*"):
        if f.is_file() and f.suffix.lower() in exts:
            chars |= set(f.read_text(encoding="utf-8", errors="ignore"))

old = pathlib.Path("static/fonts/charset.txt")
if old.exists():
    chars |= set(old.read_text(encoding="utf-8", errors="ignore"))

def wanted(ch):
    cp = ord(ch)
    if cp < 0x20 or cp == 0x7F:
        return False
    if unicodedata.category(ch) in {"Cc", "Cf", "Mn", "Zl", "Zp"}:
        return False
    if 0x1F000 <= cp <= 0x1FAFF:
        return False
    return True

out = "".join(sorted(c for c in chars if wanted(c)))
old.write_text(out, encoding="utf-8")
print(f"charset: {len(out)} 个字符")
PY

pyftsubset "$src" \
    --text-file="${FONT_DIR}/charset.txt" \
    --output-file="${FONT_DIR}/noto-serif-sc-var.woff2" \
    --flavor=woff2 \
    --desubroutinize

ls -lh "$FONT_DIR"
