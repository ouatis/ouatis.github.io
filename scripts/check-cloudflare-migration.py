#!/usr/bin/env python3
"""Offline/live checks for the OUATIS -> Cloudflare Workers migration handoff.

Modes:
  preflight [--stage shadow|final]   inspect repo config before commit
  build                             inspect ./public after hugo --minify
  live --base-url URL [--expect-production]   HTTP checks against a deployed URL

No third-party packages; Python 3.8+ and stdlib only.
"""

import argparse
import re
import shutil
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

SITE = 'https://ouatis.com'
UA = 'Mozilla/5.0 (compatible; ouatis-cloudflare-check/1.0)'
BASELINE_COMMIT = '94a3bf18033b2d6d578aa126e4cc8c965ad02451'
ABOUT_FIX = '94a3bf18033b2d6d578aa126e4cc8c965ad02451'
MAX_FILES = 20000
MAX_FILE_BYTES = 25 * 1024 * 1024

REQUIRED_REPO_FILES = [
    'hugo.toml',
    '.gitmodules',
    'static/CNAME',
    'wrangler.toml',
    'wrangler.toml.final',
    '.github/workflows/deploy.yml',
    'scripts/check-cloudflare-migration.py',
    'scripts/indexnow.py',
    'scripts/fetch-analytics.py',
    'scripts/build-fonts.sh',
]

FORBIDDEN_WORKFLOW = [
    'actions/configure-pages@v6',
    'actions/upload-pages-artifact@v5',
    'actions/deploy-pages@v5',
    'environment:',
    'github-pages',
    'pages: write',
    'id-token: write',
    'steps.deployment.outputs.page_url',
]

REQUIRED_WORKFLOW = [
    'name: Deploy Hugo Site',
    'workflow_dispatch:',
    'branches: [main]',
    '0 22 * * *',
    'contents: read',
    'actions: write',
    'concurrency:',
    'group: "cloudflare-workers"',
    'cancel-in-progress: false',
    'runs-on: ubuntu-latest',
    'timeout-minutes: 60',
    'actions/checkout@v7',
    'fetch-depth: 0',
    'submodules: recursive',
    'peaceiris/actions-hugo@v3',
    "hugo-version: '0.167.0'",
    'extended: true',
    'actions/cache@v6',
    'ibm-plex-1.1.0',
    'fonttools brotli',
    'scripts/build-fonts.sh',
    'continue-on-error: true',
    'CF_API_TOKEN: ${{ secrets.CF_ANALYTICS_TOKEN }}',
    'scripts/fetch-analytics.py',
    'hugo --minify',
    'cloudflare/wrangler-action@v4',
    'apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}',
    'accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}',
    'wranglerVersion: "latest"',
    'command: deploy',
    "if: github.ref == 'refs/heads/main'",
    'deployment.outputs.deployment-url',
    'CF_CUSTOM_DOMAIN_READY',
    'scripts/indexnow.py public/sitemap.xml',
    'Prune old workflow runs',
    'GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}',
    'KEEP=${{ github.run_id }}',
    'gh api -X DELETE',
]

REQUIRED_PUBLIC_FILES = [
    'index.html',
    '404.html',
    'sitemap.xml',
    'robots.txt',
    'llms.txt',
    'feed.json',
    'index.xml',
    'en/index.html',
    'ja/index.html',
    'about/index.html',
]

LIVE_PATHS = [
    '/about/',
    '/en/',
    '/ja/',
    '/sitemap.xml',
    '/feed.json',
    '/index.xml',
    '/llms.txt',
    '/robots.txt',
]

FORBIDDEN_HEADERS = [
    'x-github-request-id',
    'x-fastly-request-id',
    'x-proxy-cache',
]

MEDIA_EXTS = {
    '.mp4', '.webm', '.mov', '.m4a', '.mp3', '.ogg', '.wav', '.pdf',
}


def success_text(fail):
    """Turn a failure-oriented description into a readable PASS line."""
    s = fail
    if ' missing (' in s:
        return s.replace(' missing (', ' present (', 1)
    if ' missing ' in s:
        return s.replace(' missing ', ' keeps ', 1)
    if s.startswith('missing '):
        return s[len('missing '):] + ' present'
    if 'still contains ' in s:
        return s.replace('still contains ', 'does not contain ', 1)
    if 'must not declare ' in s:
        return s.replace('must not declare ', 'does not declare ', 1)
    if 'should not declare ' in s:
        return s.replace('should not declare ', 'does not declare ', 1)
    if 'should keep ' in s:
        return s.replace('should keep ', 'keeps ', 1)
    if 'must stay ' in s:
        return s.replace('must stay ', 'stays ', 1)
    if ' must be ' in s:
        return s.replace(' must be ', ' is ', 1)
    if ' stage mismatch: expected ' in s:
        return s.replace(' stage mismatch: expected ', ' is ', 1)
    if s.startswith('stage mismatch: expected '):
        return s.split('expected ', 1)[1]
    if s.endswith(' changed'):
        return s[:-len(' changed')] + ' unchanged'
    if ' must disable ' in s:
        return s.replace(' must disable ', ' disables ', 1)
    if s == 'public/ not found; run hugo --minify':
        return 'public/ found'
    if s.startswith('too many files:'):
        return 'file count within limit: ' + s.split(':', 1)[1].strip().split(' (')[0]
    if s.startswith('largest file ') and ' exceeds ' in s:
        return s.replace(' exceeds ', ' within ', 1)
    if ' lost canonical baseURL' in s:
        return s.replace(' lost canonical baseURL', ' keeps canonical baseURL')
    if s.startswith('GET ') and ' returned ' in s:
        return re.sub(r' returned \d+$', ' returned 200', s)
    if s.startswith('GET ') and ' failed:' in s:
        return re.sub(r' failed:.*$', ' succeeded', s)
    if s.startswith('GET /about did not land on /about/'):
        return 'GET /about landed on /about/'
    if s == 'GET /about did not return 200':
        return 'GET /about returned 200'
    if s == 'homepage did not return 200':
        return 'homepage returned 200'
    if s == 'missing page did not return 404':
        return 'missing page returned 404'
    if s == 'www redirect did not return 200':
        return 'www redirect returned 200'
    if s == 'www redirect did not land on ouatis.com':
        return 'www redirect landed on ouatis.com'
    if s == 'homepage content-type is not HTML':
        return 'homepage content-type is HTML'
    if s.startswith('live response still has '):
        return 'live response has no ' + s[len('live response still has '):]
    if s == 'live response still goes through varnish':
        return 'live response no longer goes through varnish'
    if s.startswith('404 response has no HTML'):
        return '404 response has HTML 404 body'
    if s == 'no IndexNow key file returned 200':
        return 'IndexNow key file returned 200'
    if s.startswith('no 32-hex'):
        return '32-hex IndexNow key found'
    if s.startswith('404 check failed:'):
        return '404 check succeeded'
    if s.startswith('live sitemap check failed:'):
        return 'live sitemap check succeeded'
    if s.startswith('www check failed:'):
        return 'www check succeeded'
    if s.startswith('GET /about failed:'):
        return 'GET /about succeeded'
    if ' did not ' in s:
        return s.replace(' did not ', ' ', 1)
    return s + ' OK'


class Check:
    def __init__(self, name):
        self.name = name
        self.ok = True
        self.lines = []

    def check(self, condition, message):
        if condition:
            self.lines.append(('PASS', success_text(message)))
        else:
            self.lines.append(('FAIL', message))
            self.ok = False

    def info(self, message):
        self.lines.append(('INFO', message))

    def warn(self, message):
        self.lines.append(('WARN', message))

    def result(self):
        print('[{}]'.format(self.name))
        for status, message in self.lines:
            print('  {}: {}'.format(status, message))
        print('[{}] {}'.format(self.name, 'OK' if self.ok else 'FAILED'))
        return 0 if self.ok else 1


def safe_read(path):
    try:
        return path.read_text(encoding='utf-8', errors='replace')
    except OSError:
        return ''


def indexnow_keys(root):
    out = set()
    for d in [root / 'static', root / 'public']:
        if d.is_dir():
            for p in d.glob('*.txt'):
                if re.fullmatch(r'[0-9a-fA-F]{32}', p.stem):
                    out.add(p.stem)
    script = root / 'scripts/indexnow.py'
    if script.is_file():
        for line in safe_read(script).splitlines():
            if line.startswith('KEY ='):
                val = line.split('=', 1)[1].strip().strip(chr(39)).strip(chr(34))
                if re.fullmatch(r'[0-9a-fA-F]{32}', val):
                    out.add(val)
    return sorted(out)


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            headers = {k.lower(): v for k, v in resp.headers.items()}
            return resp.status, headers, resp.read(), resp.geturl()
    except urllib.error.HTTPError as exc:
        headers = {k.lower(): v for k, v in exc.headers.items()}
        return exc.code, headers, exc.read(), getattr(exc, 'url', url)
    except urllib.error.URLError as exc:
        raise RuntimeError('request failed: {} ({})'.format(url, exc))


def cmd_preflight(args):
    c = Check('preflight')
    root = Path.cwd()
    for rel in REQUIRED_REPO_FILES:
        c.check((root / rel).is_file(), 'missing ' + rel)

    hugo = safe_read(root / 'hugo.toml')
    wrangler = safe_read(root / 'wrangler.toml')
    final = safe_read(root / 'wrangler.toml.final')
    workflow = safe_read(root / '.github/workflows/deploy.yml')
    indexnow = safe_read(root / 'scripts/indexnow.py')
    analytics = safe_read(root / 'scripts/fetch-analytics.py')

    c.check('baseURL = ' in hugo and 'https://ouatis.com/' in hugo,
            'hugo.toml baseURL must stay https://ouatis.com/')
    c.check('[markup.goldmark.renderer]' in hugo and 'unsafe = true' in hugo,
            'hugo.toml missing [markup.goldmark.renderer] unsafe = true (already on origin/main)')
    c.check('defaultContentLanguage = "zh-CN"' in hugo,
            'hugo.toml defaultContentLanguage changed')
    c.check('uglyURLs = false' in hugo, 'hugo.toml uglyURLs changed')
    c.check("theme = 'hugo-theme-sigil'" in hugo, 'hugo.toml theme changed')

    c.check('name = "ouatis-site"' in wrangler, 'wrangler.toml name changed')
    c.check('compatibility_date = "2026-11-04"' in wrangler,
            'wrangler.toml compatibility_date changed')
    c.check('[assets]' in wrangler, 'wrangler.toml missing [assets]')
    c.check('directory = "./public"' in wrangler,
            'wrangler.toml assets directory must be ./public')
    c.check('not_found_handling = "404-page"' in wrangler,
            'wrangler.toml not_found_handling must be 404-page')
    c.check('html_handling = "auto-trailing-slash"' in wrangler,
            'wrangler.toml html_handling must be auto-trailing-slash')
    c.check('preview_urls = false' in wrangler,
            'wrangler.toml should keep preview_urls = false')

    expected = 'workers_dev = false' if args.stage == 'final' else 'workers_dev = true'
    c.check(expected in wrangler,
            'wrangler.toml stage mismatch: expected ' + expected)
    c.check('main =' not in wrangler,
            'wrangler.toml must not declare main for assets-only Worker')
    c.check('binding = "ASSETS"' not in wrangler,
            'wrangler.toml must not declare ASSETS binding without a Worker script')
    c.check('custom_domain = true' not in wrangler,
            'wrangler.toml should not declare custom domain (attach in dashboard)')
    c.check('[[routes]]' not in wrangler,
            'wrangler.toml should not declare routes for stage 1')

    c.check('workers_dev = false' in final and 'preview_urls = false' in final,
            'wrangler.toml.final must disable workers.dev and preview URLs')

    for needle in REQUIRED_WORKFLOW:
        c.check(needle in workflow, 'deploy.yml missing ' + needle)
    for forbidden in FORBIDDEN_WORKFLOW:
        c.check(forbidden not in workflow, 'deploy.yml still contains ' + forbidden)

    c.check('SITE = "https://ouatis.com"' in indexnow,
            'scripts/indexnow.py SITE changed')
    c.check('GRAPHQL = "https://api.cloudflare.com/client/v4/graphql"' in analytics,
            'scripts/fetch-analytics.py GraphQL endpoint changed')
    c.check((root / 'static/CNAME').is_file(),
            'static/CNAME missing (keep until rollback window ends)')
    c.check((root / '.gitmodules').is_file(),
            '.gitmodules missing (theme submodule needed)')

    c.info('baseline commit (origin/main): ' + BASELINE_COMMIT)
    c.info('about-page fix already on origin/main: ' + ABOUT_FIX)

    hugo_path = shutil.which('hugo')
    git_path = shutil.which('git')
    if hugo_path:
        c.info('hugo found: ' + hugo_path)
    else:
        c.warn('hugo not found locally; CI installs 0.167.0 extended')
    if git_path:
        c.info('git found: ' + git_path)
    else:
        c.warn('git not found locally; needed for submodule updates')
    return c.result()


def cmd_build(args):
    c = Check('build')
    root = Path.cwd()
    pub = root / 'public'
    c.check(pub.is_dir(), 'public/ not found; run hugo --minify')
    if not pub.is_dir():
        return c.result()

    for rel in REQUIRED_PUBLIC_FILES:
        c.check((pub / rel).is_file(), 'missing public/' + rel)

    index_text = safe_read(pub / 'index.html')
    c.check(SITE in index_text, 'public/index.html lost canonical baseURL')
    sitemap_text = safe_read(pub / 'sitemap.xml')
    c.check(SITE in sitemap_text, 'public/sitemap.xml lost canonical baseURL')

    files = [p for p in pub.rglob('*') if p.is_file()]
    c.check(len(files) <= MAX_FILES,
            'too many files: {} (limit {})'.format(len(files), MAX_FILES))
    largest = max((p.stat().st_size for p in files), default=0)
    c.check(largest <= MAX_FILE_BYTES,
            'largest file {} bytes exceeds 25 MiB'.format(largest))
    total = sum(p.stat().st_size for p in files)
    c.info('{} files, {:.1f} MiB total, largest {:.2f} MiB'.format(
        len(files), total / 1048576.0, largest / 1048576.0))

    found = sorted({p.suffix.lower() for p in files if p.suffix.lower() in MEDIA_EXTS})
    if found:
        c.warn('Workers returns 200 full file for Range requests, not 206; found: ' + ', '.join(found))
    if (pub / 'CNAME').is_file():
        c.warn('public/CNAME still present; remove static/CNAME after rollback window')

    for special in ['_headers', '_redirects']:
        if (pub / special).is_file():
            c.info('public/' + special + ' present; Workers will parse it')
        else:
            c.info('public/' + special + ' absent; relying on Workers defaults')

    keys = indexnow_keys(root)
    c.check(bool(keys), 'no 32-hex IndexNow key .txt file found in static/ or public/')
    for key in keys:
        c.check((pub / (key + '.txt')).is_file(), 'missing public/' + key + '.txt')
    return c.result()


def cmd_live(args):
    c = Check('live')
    base = args.base_url.rstrip('/')
    try:
        status, headers, body, final = fetch(base + '/')
    except RuntimeError as exc:
        c.check(False, str(exc))
        return c.result()

    c.check(status == 200, 'homepage did not return 200')
    c.check('text/html' in headers.get('content-type', '').lower(),
            'homepage content-type is not HTML')
    text = body.decode('utf-8', 'replace')
    c.check(SITE in text, 'homepage lost canonical baseURL')
    for h in FORBIDDEN_HEADERS:
        c.check(h not in headers, 'live response still has ' + h)
    c.check('varnish' not in headers.get('via', '').lower(),
            'live response still goes through varnish')
    c.info('server=' + headers.get('server', '(none)'))
    c.info('cache-control=' + headers.get('cache-control', '(none)'))
    for h in ['speculation-rules', 'nel', 'report-to', 'access-control-allow-origin', 'cf-cache-status']:
        if h in headers:
            c.info(h + ': ' + headers[h])

    try:
        status404, headers404, body404, final404 = fetch(base + '/__cloudflare_migration_missing__/')
    except RuntimeError as exc:
        c.check(False, '404 check failed: ' + str(exc))
    else:
        c.check(status404 == 404, 'missing page did not return 404')
        c.check(b'<html' in body404.lower() or b'404' in body404,
                '404 response has no HTML 404 body (check not_found_handling)')

    for p in LIVE_PATHS:
        try:
            st, hd, bd, fl = fetch(base + p)
        except RuntimeError as exc:
            c.check(False, 'GET ' + p + ' failed: ' + str(exc))
            continue
        c.check(st == 200, 'GET ' + p + ' returned ' + str(st))

    try:
        st, hd, bd, fl = fetch(base + '/about')
    except RuntimeError as exc:
        c.check(False, 'GET /about failed: ' + str(exc))
    else:
        c.check(st == 200, 'GET /about did not return 200')
        path = urlparse(fl).path.rstrip('/')
        c.check(path == '/about',
                'GET /about did not land on /about/ (got ' + path + ')')

    try:
        st, hd, bd, fl = fetch(base + '/sitemap.xml')
    except RuntimeError as exc:
        c.check(False, 'live sitemap check failed: ' + str(exc))
    else:
        c.check(SITE in bd.decode('utf-8', 'replace'),
                'live sitemap.xml lost canonical baseURL')

    keys = indexnow_keys(Path.cwd())
    if keys:
        found = False
        for key in keys:
            try:
                st, hd, bd, fl = fetch(base + '/' + key + '.txt')
            except RuntimeError:
                continue
            if st == 200:
                found = True
        c.check(found, 'no IndexNow key file returned 200')
    else:
        c.warn('no local IndexNow key discovered; skip key URL check')

    if args.expect_production:
        if base != SITE:
            c.warn('--expect-production given but base URL is not ' + SITE)
        try:
            st, hd, bd, fl = fetch('https://www.ouatis.com/')
        except RuntimeError as exc:
            c.check(False, 'www check failed: ' + str(exc))
        else:
            c.check(st == 200, 'www redirect did not return 200')
            host = urlparse(fl).netloc.lower()
            c.check(host == 'ouatis.com', 'www redirect did not land on ouatis.com')
            c.info('www final URL: ' + fl)
        c.info('production checks: also verify OG images, fonts, and analytics manually')
    return c.result()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest='command', required=True)

    preflight = subparsers.add_parser('preflight')
    preflight.add_argument('--stage', choices=['shadow', 'final'], default='shadow')

    subparsers.add_parser('build')

    live = subparsers.add_parser('live')
    live.add_argument('--base-url', required=True)
    live.add_argument('--expect-production', action='store_true')

    args = parser.parse_args()
    if args.command == 'preflight':
        return cmd_preflight(args)
    if args.command == 'build':
        return cmd_build(args)
    if args.command == 'live':
        return cmd_live(args)
    return 2


if __name__ == '__main__':
    sys.exit(main())
