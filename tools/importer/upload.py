"""Prepare locally; upload only on an explicit confirmed invocation. Never apply runs."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re
from uuid import uuid4, UUID
from .backend import Backend
from .diff import build_proposal, digest


def slug_path(root, directory, slug):
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug):
        raise ValueError('Invalid category slug')
    return Path(root) / directory / (slug + '.json')


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    temporary.replace(path)


def prepare(slug, root=Path('data'), backend=None):
    raw = read_json(slug_path(root, 'parsed', slug))
    overlay = read_json(slug_path(root, 'verified', slug))
    if raw['category']['slug'] != slug:
        raise ValueError('Category mismatch')
    backend = backend or Backend.from_env()
    run = build_proposal(raw, overlay, backend.baseline(slug), backend.cards(slug))
    run['id'] = str(uuid4())
    images = {}
    for change in run['proposal']['changes']:
        if change['kind'] in ('added','changed') or change.get('card',{}).get('review_flags'):
            change['pageImages'] = []
            for page in change.get('sourcePages', []):
                name = f'p{page:03}.png'
                image = Path(root) / 'pages' / slug / name
                images[name] = hashlib.sha256(image.read_bytes()).hexdigest()
                if overlay.get('pageDigests', {}).get(name) != images[name]:
                    raise ValueError('Source image differs from verification')
                change['pageImages'].append(run['id']+'/'+name)
    prepared = {'run':run, 'rawDigest':digest(raw), 'verificationDigest':digest(overlay),
                'images':images, 'runDigest':digest(run)}
    path = slug_path(root, 'proposals', slug)
    # Same content prepared twice keeps the upload identity for safe retries.
    if path.exists():
        existing = read_json(path)
        candidate = deepcopy(run)
        candidate['id'] = existing['run']['id']
        for change in candidate['proposal']['changes']:
            if 'pageImages' in change:
                change['pageImages'] = [p.replace(run['id']+'/', candidate['id']+'/')
                                        for p in change['pageImages']]
        if (digest(candidate) == existing.get('runDigest') and images == existing.get('images')
                and prepared['rawDigest'] == existing.get('rawDigest')
                and prepared['verificationDigest'] == existing.get('verificationDigest')):
            return existing
    write_json(path, prepared)
    return prepared


def upload(slug, root=Path('data'), backend=None, *, confirmed=False):
    if not confirmed:
        raise ValueError('Explicit upload confirmation required')
    prepared = read_json(slug_path(root, 'proposals', slug))
    run = prepared['run']
    UUID(run['id'])
    if run['category_slug'] != slug or run['status'] != 'pending' or digest(run) != prepared['runDigest']:
        raise ValueError('Prepared proposal changed')
    if digest(read_json(slug_path(root, 'parsed', slug))) != prepared['rawDigest'] or digest(
            read_json(slug_path(root, 'verified', slug))) != prepared['verificationDigest']:
        raise ValueError('Inputs changed; prepare and review again')
    page_data = {}
    for name, expected in prepared['images'].items():
        if not re.fullmatch(r'p[0-9]{3,}\.png', name):
            raise ValueError('Invalid image path')
        data = (Path(root)/'pages'/slug/name).read_bytes()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError('Source image changed')
        page_data[name] = data
    expected_paths = {run['id']+'/'+n for n in page_data}
    if any(p not in expected_paths for c in run['proposal']['changes'] for p in c.get('pageImages', [])):
        raise ValueError('Image manifest mismatch')
    backend = backend or Backend.from_env()
    existing = backend.run(run['id'])
    if existing:
        # Network failure after insertion can be retried without a second run.
        fields = ('id','category_slug','source_file','revision','raw_snapshot','proposal','summary')
        if any(existing.get(k) != run[k] for k in fields):
            raise ValueError('Upload identity already used for different content')
        return {'id':run['id'], 'status':existing['status'], 'alreadyUploaded':True}
    baseline = backend.baseline(slug)
    if (baseline['id'] if baseline else None) != run['proposal']['baseRunId']:
        raise ValueError('A newer import was applied; prepare again')
    # Images first, pending row last: a failed upload cannot expose an incomplete run.
    for name, data in page_data.items():
        backend.upload_page(run['id']+'/'+name, data)
    backend.insert_run(run)
    return {'id':run['id'], 'status':'pending', 'alreadyUploaded':False}
