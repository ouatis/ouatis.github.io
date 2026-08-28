"""部署完成后向 IndexNow(Bing/Yandex 等)提交全站 URL。

密钥文件 static/7e60861932ca6fb2f22e92e0d46e7cd9.txt 属公开验证文件,非机密。
用法: python scripts/indexnow.py (在 Deploy to GitHub Pages 之后运行)
"""

import json
import urllib.request
import xml.etree.ElementTree as ET

SITE = "https://ouatis.com"
KEY = "7e60861932ca6fb2f22e92e0d46e7cd9"

sitemap = urllib.request.urlopen(SITE + "/sitemap.xml", timeout=30).read()
root = ET.fromstring(sitemap)
ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
urls = [loc.text for loc in root.iter(f"{ns}loc") if loc.text]

payload = {
    "host": "ouatis.com",
    "key": KEY,
    "keyLocation": f"{SITE}/{KEY}.txt",
    "urlList": urls,
}
req = urllib.request.Request(
    "https://api.indexnow.org/indexnow",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json; charset=utf-8"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=30) as resp:
    print("IndexNow submitted", len(urls), "urls ->", resp.status)
