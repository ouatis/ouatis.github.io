#!/usr/bin/env python3
"""拉取 Cloudflare 逐日 pageViews，合并进 data/analytics.json（页脚总浏览量的数据源）。

Cloudflare 免费版 GraphQL 只保留 52 周逐日数据。每次运行都重新拉取
trailing 52 周窗口并与既有 days 合并：滑出 Cloudflare 窗口的历史日期
保留在 JSON 里不丢失，因此 total 是真正的累计值，而不是"近一年"。

token 读取顺序: 环境变量 CF_API_TOKEN → ~/.cloudflare/ouatis-api-token
用法: python scripts/fetch-analytics.py
"""
import json
import os
import sys
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ZONE_ID = "e0fb8899116f18b8def627ea024dba7d"
GRAPHQL = "https://api.cloudflare.com/client/v4/graphql"
DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "analytics.json"
WINDOW_START = date.today() - timedelta(days=364)

QUERY = """
query($z:String!,$f:Date!,$t:Date!){
  viewer{ zones(filter:{zoneTag:$z}){
    d: httpRequests1dGroups(limit: 370, filter:{date_geq:$f, date_leq:$t}, orderBy:[date_ASC])
    { dimensions{date} sum{pageViews} }
  } }
}"""


def read_token():
    tok = os.environ.get("CF_API_TOKEN")
    if tok:
        return tok
    p = Path.home() / ".cloudflare" / "ouatis-api-token"
    if p.exists():
        return p.read_text(encoding="utf-8").strip()
    print("no token (CF_API_TOKEN / ~/.cloudflare/ouatis-api-token); skip refresh")
    sys.exit(0)


def fetch_daily(tok, start, end):
    body = json.dumps({
        "query": QUERY,
        "variables": {"z": ZONE_ID, "f": str(start), "t": str(end)},
    }).encode()
    req = urllib.request.Request(GRAPHQL, data=body, headers={
        "Authorization": "Bearer " + tok,
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.load(r)
    if d.get("errors"):
        sys.exit("GraphQL errors: " + json.dumps(d["errors"], ensure_ascii=False)[:500])
    rows = ((((d.get("data") or {}).get("viewer") or {}).get("zones") or [{}])[0].get("d")) or []
    return {g["dimensions"]["date"]: (g["sum"].get("pageViews") or 0) for g in rows}


def main():
    tok = read_token()
    old = {}
    if DATA_FILE.exists():
        old = json.loads(DATA_FILE.read_text(encoding="utf-8")).get("days", {})
    fetched = fetch_daily(tok, WINDOW_START, date.today())
    merged = dict(old)
    merged.update(fetched)
    days = {k: merged[k] for k in sorted(merged)}
    total = sum(days.values())
    out = {"updated": str(date.today()), "since": min(days) if days else None,
           "total": total, "days": days}
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(
        json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"days={len(days)} fetched={len(fetched)} since={out['since']} "
          f"total={total} -> {DATA_FILE.name}")


if __name__ == "__main__":
    main()
