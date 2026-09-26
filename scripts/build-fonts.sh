#!/usr/bin/env bash
# Prepare IBM Plex Sans and Chinese SC for the main site.
#
# Japanese pages intentionally reuse Chinese SC so the Chinese article titles
# shown on /ja/ keep one consistent set of glyphs.
#
# 产出:
#   static/fonts/ibm-plex/ibm-plex-<hash>.css  全部 @font-face 合一,每条
#                                              带 font-display: swap;文件名
#                                              含内容哈希,内容变则 URL 变,
#                                              避免字体 CSS 被 CDN/浏览器拿旧版
#   data/fonts.json                            哈希文件名,extend_head 读取
#   static/fonts/ibm-plex/latin/               官方拉丁分片(按 unicode-range 惰性加载)
#   static/fonts/ibm-plex/sc/*-corpus.woff2    语料子集:按全站实际用字把 SC 三字重
#                                              各压成一个文件(源自官方 hinted 全量
#                                              woff2 + fontTools 子集化),全站共用
#                                              一份缓存,换装次数 112→3
#
# 依赖: python3 + pip 包 fonttools、brotli(子集化用);抽取合并用标准库。
set -euo pipefail

cd "$(dirname "$0")/.."

IBM_PLEX_VERSION="1.1.0"
FONT_DIR="static/fonts/ibm-plex"
CACHE_DIR="${IBM_PLEX_CACHE_DIR:-.cache/ibm-plex}"
mkdir -p "$CACHE_DIR" "$FONT_DIR"

command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 1; }

fetch_package() {
    local pkg="$1"
    local archive="${CACHE_DIR}/${pkg}-${IBM_PLEX_VERSION}.tgz"
    local url="https://registry.npmjs.org/@ibm/${pkg}/-/${pkg}-${IBM_PLEX_VERSION}.tgz"
    local tmp="${archive}.tmp.$$"

    if [ -s "$archive" ] && tar -tzf "$archive" >/dev/null 2>&1; then
        return
    fi

    rm -f "$archive" "$tmp"
    echo "Downloading @ibm/${pkg}@${IBM_PLEX_VERSION}..."
    curl -fL --retry 3 --retry-all-errors --connect-timeout 20 -o "$tmp" "$url"
    tar -tzf "$tmp" >/dev/null
    mv "$tmp" "$archive"
}

for pkg in plex-sans plex-sans-sc; do
    fetch_package "$pkg"
done

rm -rf "static/fonts/split" "static/fonts/charset.txt" "${FONT_DIR}"

# 抽取(官方分片 latin;SC 全量 hinted woff2)与合并子集化,一步完成
python3 - "$IBM_PLEX_VERSION" "$FONT_DIR" <<'PY'
import fnmatch, glob, hashlib, json, os, re, subprocess, sys, tarfile

version, font_dir = sys.argv[1], sys.argv[2]
cache = os.environ.get("IBM_PLEX_CACHE_DIR", ".cache/ibm-plex")
work = os.path.join(cache, "work")
weights = [("Regular", 400), ("SemiBold", 600), ("Bold", 700)]

# --- 1. 拉丁官方分片(css + woff2),路径与 IBM 包一致 ---
latin_dest = os.path.join(font_dir, "latin")
os.makedirs(latin_dest, exist_ok=True)
latin_tgz = f"{cache}/plex-sans-{version}.tgz"
patterns = [f"package/fonts/split/woff2/IBMPlexSans-{w}*"
            for w in ("Regular", "SemiBold", "Bold")]
with tarfile.open(latin_tgz, "r:gz") as tar:
    for member in tar.getmembers():
        if not member.isfile():
            continue
        if not any(fnmatch.fnmatch(member.name, pat) for pat in patterns):
            continue
        out = os.path.join(latin_dest, os.path.basename(member.name))
        with tar.extractfile(member) as src, open(out, "wb") as f:
            f.write(src.read())

# --- 2. SC 全量 hinted woff2 抽到工作目录(pyftsubset 的源) ---
sc_tgz = f"{cache}/plex-sans-sc-{version}.tgz"
os.makedirs(work, exist_ok=True)
sc_prefix = "package/fonts/complete/woff2/hinted/"
with tarfile.open(sc_tgz, "r:gz") as tar:
    for member in tar.getmembers():
        if not member.isfile():
            continue
        base = os.path.basename(member.name)
        for weight, _ in weights:
            if member.name == f"{sc_prefix}IBMPlexSansSC-{weight}.woff2":
                with tar.extractfile(member) as src, open(os.path.join(work, base), "wb") as f:
                    f.write(src.read())

# --- 3. 语料扫描:全站实际用字(内容、模板、i18n、站点配置) ---
corpus = set()
scan_globs = ["content/**/*.md", "layouts/**/*.html", "i18n/*.yaml",
              "archetypes/*.md", "hugo.toml",
              "themes/hugo-theme-sigil/layouts/**/*.html",
              "themes/hugo-theme-sigil/i18n/*.yaml"]
for pat in scan_globs:
    for path in glob.glob(pat, recursive=True):
        try:
            corpus |= set(open(path, encoding="utf-8").read())
        except UnicodeDecodeError:
            pass
# 只子集 U+2000 起(CJK、kana、全角与中文标点);ASCII 与西文标点交给拉丁分片
subset_chars = sorted({c for c in corpus if ord(c) >= 0x2000})
charset_path = os.path.join(cache, "ouatis-charset.txt")
with open(charset_path, "w", encoding="utf-8") as f:
    f.write("".join(subset_chars))
print(f"语料字符: 全站去重 {len(corpus)},其中 U+2000 起 {len(subset_chars)}")

# unicode-range 压缩成区间列表
def ranges(chars):
    ords = sorted(ord(c) for c in chars)
    out, start, prev = [], ords[0], ords[0]
    for o in ords[1:]:
        if o == prev + 1:
            prev = o
            continue
        out.append(f"U+{start:X}" if start == prev else f"U+{start:X}-{prev:X}")
        start = prev = o
    out.append(f"U+{start:X}" if start == prev else f"U+{start:X}-{prev:X}")
    return ",".join(out)

unicode_range = ranges(subset_chars)

# --- 4. pyftsubset:三字重各出一个语料子集 woff2 ---
sc_dest = os.path.join(font_dir, "sc")
os.makedirs(sc_dest, exist_ok=True)
subset_css = []
for weight, wnum in weights:
    src = os.path.join(work, f"IBMPlexSansSC-{weight}.woff2")
    out = os.path.join(sc_dest, f"IBMPlexSansSC-{weight}-corpus.woff2")
    subprocess.run(
        [sys.executable, "-m", "fontTools.subset", src,
         f"--text-file={charset_path}", "--flavor=woff2",
         f"--output-file={out}", "--layout-features=*"],
        check=True)
    size = os.path.getsize(out) // 1024
    print(f"subset: IBMPlexSansSC-{weight}-corpus.woff2 ({size}KB)")
    subset_css.append(
        "@font-face {\n"
        '  font-family: "IBM Plex Sans SC";\n'
        "  font-style: normal;\n"
        f"  font-weight: {wnum};\n"
        "  font-display: swap;\n"
        f'  src: url("./sc/IBMPlexSansSC-{weight}-corpus.woff2") format("woff2");\n'
        f"  unicode-range: {unicode_range};\n"
        "}\n")

# --- 5. 拉丁分片 css 改写相对路径 + 补 font-display,与子集 face 合并成单文件 ---
shards = sorted(glob.glob(os.path.join(latin_dest, "*.css")))
parts = []
for shard in shards:
    css = open(shard, encoding="utf-8").read()
    css = re.sub(r'url\("\.?/?', 'url("./latin/', css)
    css = re.sub(r'(@font-face\s*\{[^}]*?)\}', r'\1  font-display: swap;\n}', css)
    parts.append("/* latin */\n" + css)
parts.append("/* sc: corpus subset */\n" + "\n".join(subset_css))
merged = ("/* IBM Plex Sans family, generated from @ibm/plex-sans 1.1.0 packages.\n"
          "   Latin official splits + SC corpus subset; every face carries font-display: swap. */\n"
          + "\n".join(parts))
digest = hashlib.md5(merged.encode()).hexdigest()[:10]
name = f"ibm-plex-{digest}.css"
open(os.path.join(font_dir, name), "w", encoding="utf-8").write(merged)

os.makedirs("data", exist_ok=True)
json.dump({"file": f"fonts/ibm-plex/{name}"},
          open("data/fonts.json", "w", encoding="utf-8"))
print(f"fonts css: {name} ({os.path.getsize(os.path.join(font_dir, name)) // 1024}KB)")

# 拉丁分片 css 已并入,不再分发
for shard in shards:
    os.remove(shard)
PY

find "${FONT_DIR}" -type f -name '*.bin' -delete
printf 'IBM Plex assets: '
find "${FONT_DIR}" -type f | wc -l
