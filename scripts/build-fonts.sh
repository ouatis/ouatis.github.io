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
#   static/fonts/ibm-plex/{latin,sc}/          官方分片 woff2(按 unicode-range 惰性加载)
#
# 官方分片的 css 本身不再分发(已并入哈希文件),省下 public 里 ~870KB 死代码。
# 抽取与合并都在 python 里做:macOS 的 BSD tar 不认 GNU 的 --wildcards。
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

# 抽取官方分片(latin + sc hinted),与合并一步完成
python3 - "$IBM_PLEX_VERSION" "$FONT_DIR" <<'PY'
import fnmatch, glob, hashlib, json, os, re, sys, tarfile

version, font_dir = sys.argv[1], sys.argv[2]
cache = os.environ.get("IBM_PLEX_CACHE_DIR", ".cache/ibm-plex")

jobs = [
    (f"{cache}/plex-sans-{version}.tgz", "latin", 4,
     ["package/fonts/split/woff2/IBMPlexSans-{w}*".format(w=w)
      for w in ("Regular", "SemiBold", "Bold")]),
    (f"{cache}/plex-sans-sc-{version}.tgz", "sc", 5,
     ["package/fonts/split/woff2/hinted/IBMPlexSansSC-{w}*".format(w=w)
      for w in ("Regular", "SemiBold", "Bold")]),
]

for tgz, dest_name, strip, patterns in jobs:
    dest = os.path.join(font_dir, dest_name)
    os.makedirs(dest, exist_ok=True)
    with tarfile.open(tgz, "r:gz") as tar:
        for member in tar.getmembers():
            if not member.isfile():
                continue
            if not any(fnmatch.fnmatch(member.name, pat) for pat in patterns):
                continue
            rest = "/".join(member.name.split("/")[strip:])
            out = os.path.join(dest, os.path.basename(rest))
            with tar.extractfile(member) as src, open(out, "wb") as f:
                f.write(src.read())

# 合并全部 @font-face 为单文件,并给每条补 font-display: swap——
# 官方分片 css 没有这一行,文字会在字体加载期按浏览器默认策略隐身,
# 是 Lighthouse 里 Speed Index 9s+ 的主因。分片相对路径按来源目录重写。
shards = sorted(glob.glob(os.path.join(font_dir, "latin", "*.css"))) \
       + sorted(glob.glob(os.path.join(font_dir, "sc", "*.css")))
parts = []
for shard in shards:
    sub = os.path.basename(os.path.dirname(shard))
    css = open(shard, encoding="utf-8").read()
    css = re.sub(r'url\("\.?/?', f'url("./{sub}/', css)
    css = re.sub(r'(@font-face\s*\{[^}]*?)\}', r'\1  font-display: swap;\n}', css)
    parts.append(f"/* {sub} */\n{css}")
merged = ("/* IBM Plex Sans family, generated from @ibm/plex-sans 1.1.0 packages.\n"
          "   Merged into one file; every face carries font-display: swap. */\n"
          + "\n".join(parts))
digest = hashlib.md5(merged.encode()).hexdigest()[:10]
name = f"ibm-plex-{digest}.css"
open(os.path.join(font_dir, name), "w", encoding="utf-8").write(merged)

os.makedirs("data", exist_ok=True)
json.dump({"file": f"fonts/ibm-plex/{name}"},
          open("data/fonts.json", "w", encoding="utf-8"))
print(f"fonts css: {name} ({os.path.getsize(os.path.join(font_dir, name)) // 1024}KB)")

# 分片 css 已并入哈希文件,不再分发;woff2 保留(被 @font-face 引用)
for shard in shards:
    os.remove(shard)
PY

find "${FONT_DIR}" -type f -name '*.bin' -delete
printf 'IBM Plex assets: '
find "${FONT_DIR}" -type f | wc -l
