"""Small service-role client. Never expose response bodies or credentials in errors."""
import json
from pathlib import Path
from urllib.parse import urlencode, urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Backend:
    def __init__(self, url, key):
        parsed = urlparse(url)
        if parsed.scheme != 'https' or not parsed.hostname or not parsed.hostname.endswith('.supabase.co') or parsed.path not in ('','/') or parsed.query or parsed.fragment or parsed.username or parsed.port:
            raise ValueError('Invalid Supabase project URL')
        if not key:
            raise ValueError('Missing service role key')
        self.url, self.key = url.rstrip('/'), key
        self.opener = build_opener(NoRedirect())

    @classmethod
    def from_env(cls, path=Path('.env.import')):
        values = {}
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                key, value = line.split('=',1)
                values[key.strip()] = value.strip().strip('\"\'')
        return cls(values.get('SUPABASE_URL',''), values.get('SUPABASE_SERVICE_ROLE_KEY',''))

    def request(self, method, path, payload=None, binary=False):
        body = payload if binary else json.dumps(payload, ensure_ascii=False).encode() if payload is not None else None
        headers = {'apikey':self.key, 'Authorization':'Bearer '+self.key,
                   'Content-Type':'image/png' if binary else 'application/json'}
        if binary:
            headers['x-upsert'] = 'true'
        request = Request(self.url + path, data=body, method=method, headers=headers)
        try:
            with self.opener.open(request, timeout=45) as response:
                data = response.read()
                return json.loads(data) if data else None
        except HTTPError as error:
            raise RuntimeError(f'Supabase HTTP {error.code}; response hidden') from None
        except (URLError, TimeoutError, ValueError):
            raise RuntimeError('Supabase request failed; response hidden') from None

    def rows(self, table, filters):
        return self.request('GET', '/rest/v1/'+table+'?'+urlencode(filters))

    def baseline(self, slug):
        rows = self.rows('import_runs', {'category_slug':'eq.'+slug, 'status':'eq.applied',
            'select':'id,raw_snapshot,proposal', 'order':'applied_at.desc,id.desc', 'limit':'1'})
        return rows[0] if rows else None

    def cards(self, slug):
        result = []
        while True:
            batch = self.rows('cards', {'category_slug':'eq.'+slug, 'select':'card_key,lines',
                'order':'id.asc', 'limit':'500', 'offset':str(len(result))})
            result.extend(batch)
            if len(batch) < 500:
                return result

    def run(self, run_id):
        rows = self.rows('import_runs', {'id':'eq.'+run_id, 'select':'*'})
        return rows[0] if rows else None

    def upload_page(self, path, content):
        self.request('POST', '/storage/v1/object/review-pages/'+path, content, binary=True)

    def insert_run(self, run):
        self.request('POST', '/rest/v1/import_runs', run)
