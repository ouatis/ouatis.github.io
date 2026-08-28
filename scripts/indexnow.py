"""部署完成后向 IndexNow(Bing/Yandex 等)提交全站 URL。

密钥文件 static/7e60861932ca6fb2f22e92e0d46e7cd9.txt 属公开验证文件,非机密。
用法: python scripts/indexnow.py [sitemap路径]
  CI 传 public/sitemap.xml(本地文件,优先读同目录子 sitemap,避免 Cloudflare
  对非浏览器 UA 的拦截);不传参数则抓取线上 sitemap。
通知失败不视为部署失败,本脚本恒以 0 退出。
"""

import json
import os
import sys
import urllib.request
import xml.etree.ElementTree as ET

SITE = "https://ouatis.com"
KEY = "7e60861932ca6fb2f22e92e0d46e7cd9"
UA = "Mozilla/5.0 (compatible; ouatis-indexnow/1.0)"
NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=30).read()


def collect(path, base):
    root = ET.parse(path).getroot()
    if root.tag != f"{NS}sitemapindex":
        return [loc.text for loc in root.iter(f"{NS}loc") if loc.text]
    urls = []
    for sm in root.iter(f"{NS}loc"):
        loc = (sm.text or "").strip()
        if not loc:
            continue
        local = os.path.join(base, loc.removeprefix(SITE + "/"))
        if os.path.exists(local):
            urls.extend(collect(local, os.path.dirname(local)))
        else:
            urls.extend(collect_data(fetch(loc), os.path.dirname(loc) + "/"))
    return urls


def collect_data(data, base):
    root = ET.fromstring(data)
    if root.tag != f"{NS}sitemapindex":
        return [loc.text for loc in root.iter(f"{NS}loc") if loc.text]
    urls = []
    for sm in root.iter(f"{NS}loc"):
        loc = (sm.text or "").strip()
        if loc:
            urls.extend(collect_data(fetch(loc), loc.rsplit("/", 1)[0] + "/"))
    return urls


try:
    sitemap_path = sys.argv[1] if len(sys.argv) > 1 else None
    if sitemap_path and os.path.exists(sitemap_path):
        urls = collect(sitemap_path, os.path.dirname(sitemap_path))
    else:
        urls = collect_data(fetch(SITE + "/sitemap.xml"), SITE + "/")

    urls = sorted(set(u for u in urls if u))
    payload = {
        "host": "ouatis.com",
        "key": KEY,
        "keyLocation": f"{SITE}/{KEY}.txt",
        "urlList": urls,
    }
    req = urllib.request.Request(
        "https://api.indexnow.org/indexnow",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": UA,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        print("IndexNow submitted", len(urls), "urls ->", resp.status)
except Exception as err:  # 通知失败不影响部署结果
    print("IndexNow ping failed (non-fatal):", err)
sys.exit(0)
