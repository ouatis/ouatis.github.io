#!/usr/bin/env bash
# Prepare IBM Plex Sans and Chinese SC for the main site.
#
# Japanese pages intentionally reuse Chinese SC so the Chinese article titles
# shown on /ja/ keep one consistent set of glyphs.
set -euo pipefail

cd "$(dirname "$0")/.."

IBM_PLEX_VERSION="1.1.0"
FONT_DIR="static/fonts/ibm-plex"
CACHE_DIR="${IBM_PLEX_CACHE_DIR:-.cache/ibm-plex}"
mkdir -p "$CACHE_DIR" "$FONT_DIR"

command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }
command -v tar >/dev/null || { echo "tar is required" >&2; exit 1; }

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
mkdir -p "${FONT_DIR}/latin" "${FONT_DIR}/sc"

for weight in Regular SemiBold Bold; do
    tar -xzf "${CACHE_DIR}/plex-sans-${IBM_PLEX_VERSION}.tgz" \
        -C "${FONT_DIR}/latin" --strip-components=4 --wildcards \
        "package/fonts/split/woff2/IBMPlexSans-${weight}*.css" \
        "package/fonts/split/woff2/IBMPlexSans-${weight}*.woff2"
    tar -xzf "${CACHE_DIR}/plex-sans-sc-${IBM_PLEX_VERSION}.tgz" \
        -C "${FONT_DIR}/sc" --strip-components=5 --wildcards \
        "package/fonts/split/woff2/hinted/IBMPlexSansSC-${weight}*.css" \
        "package/fonts/split/woff2/hinted/IBMPlexSansSC-${weight}*.woff2"
done

cat > "${FONT_DIR}/result.css" <<'CSS'
/* IBM Plex Sans family, generated from @ibm/plex-sans 1.1.0 packages. */
@import url("./latin/IBMPlexSans-Regular.css");
@import url("./latin/IBMPlexSans-SemiBold.css");
@import url("./latin/IBMPlexSans-Bold.css");
@import url("./sc/IBMPlexSansSC-Regular.css");
@import url("./sc/IBMPlexSansSC-SemiBold.css");
@import url("./sc/IBMPlexSansSC-Bold.css");
CSS

find "${FONT_DIR}" -type f -name '*.bin' -delete
printf 'IBM Plex assets: '
find "${FONT_DIR}" -type f | wc -l
