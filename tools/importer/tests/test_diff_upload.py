"""Invented fixtures only. No credentials and no real network access."""
from copy import deepcopy
from io import BytesIO
import hashlib
from urllib.error import HTTPError
import pytest
from tools.importer.auction import auction_key
from tools.importer.backend import Backend, NoRedirect
from tools.importer.diff import build_proposal, digest, validate_verified
from tools.importer.upload import prepare, upload, write_json, read_json, slug_path


def fixture():
    auction = [{'side':'we','alts':['5C']}, {'side':'they','alts':['P'],'implicit':True}]
    card = dict(categorySlug='example', cardKey='example|'+auction_key(auction), section='Sekcja testowa',
                sortOrder=0, auction=auction, auctionKey=auction_key(auction), notes=[], reviewFlags=[],
                sourcePage=1, sourceRevision='rev1',
                lines=[dict(key='5D', label='5♦', bids=['5D'], meaning='Wymyślony opis A'),
                       dict(key='5H', label='5♥', bids=['5H'], meaning='Wymyślony opis B')])
    raw = dict(category=dict(slug='example', name='Przykład', group='Otwarcia', sortOrder=0,
                             sourceFile='example.pdf', revision='rev1', notes=[]),
               cards=[card], stats={'pages':1})
    return raw


def verification(raw):
    return {'rawDigest':digest(raw), 'cards':[{'rawCardKey':c['cardKey'], 'card':deepcopy(c),
             'verification':'ok', 'pages':[1]} for c in raw['cards']]}


def baseline(raw, overlay=None):
    return {'id':'baseline-id', **build_proposal(raw, overlay or verification(raw))}


def test_first_import_preserves_raw_and_verified_separately():
    raw = fixture(); overlay = verification(raw)
    overlay['cards'][0]['card']['lines'][0]['meaning'] = 'Poprawka testowa'
    run = build_proposal(raw, overlay)
    assert run['summary'] == dict(added=1,changed=0,removed=0,unchanged=0,cards=1,lines=2,active=1,draft=0)
    assert run['raw_snapshot'] == raw
    assert run['proposal']['changes'][0]['card']['lines'][0]['meaning'] == 'Poprawka testowa'
    assert run['raw_snapshot']['cards'][0]['lines'][0]['meaning'] != 'Poprawka testowa'


def test_changed_raw_preserves_live_text_only_for_unchanged_raw_lines():
    old = fixture(); new = deepcopy(old)
    new['cards'][0]['lines'][1]['meaning'] = 'Rewizja testowa'
    live = [{'card_key':old['cards'][0]['cardKey'], 'lines':deepcopy(old['cards'][0]['lines'])}]
    live[0]['lines'][0]['meaning'] = 'Korekta administratora'
    live[0]['lines'][1]['meaning'] = 'Stara korekta'
    change = build_proposal(new, verification(new), baseline(old), live)['proposal']['changes'][0]
    assert change['kind'] == 'changed'
    assert [l['meaning'] for l in change['effectiveLines']] == ['Korekta administratora','Rewizja testowa']
    assert [l['kind'] for l in change['lineChanges']] == ['unchanged','changed']


def test_added_and_removed_lines_have_markers():
    old = fixture(); new = deepcopy(old)
    new['cards'][0]['lines'] = [dict(key='6S',label='6♠',bids=['6S'],meaning='Nowa testowa')]
    change = build_proposal(new, verification(new), baseline(old))['proposal']['changes'][0]
    assert [x['kind'] for x in change['lineChanges']] == ['added','removed','removed']


@pytest.mark.parametrize('removed', [False, True])
def test_changed_folded_continuation_cannot_silently_preserve_stale_database_text(removed):
    old = fixture(); previous_overlay = verification(old)
    previous_overlay['cards'][0]['card']['lines'] = previous_overlay['cards'][0]['card']['lines'][:1]
    base = baseline(old, previous_overlay)
    new = deepcopy(old); new['cards'][0]['lines'][1]['meaning'] = 'Zmieniony wcięty przykład'
    if removed: new['cards'][0]['lines'].pop()
    overlay = verification(new); overlay['cards'][0]['card']['lines'] = overlay['cards'][0]['card']['lines'][:1]
    with pytest.raises(ValueError, match='folded raw line'):
        build_proposal(new, overlay, base)


def test_revision_page_and_order_alone_are_unchanged():
    old = fixture(); new = deepcopy(old)
    new['cards'][0].update(sourceRevision='rev2', sourcePage=2, sortOrder=3)
    assert build_proposal(new, verification(new), baseline(old))['summary']['unchanged'] == 1


@pytest.mark.parametrize('field', ['context','qualifier'])
def test_context_and_qualifiers_are_distinct_identities(field):
    old = fixture(); new = deepcopy(old); card = new['cards'][0]
    if field == 'context':
        card['context'] = 'Wymyślony warunek'
    else:
        card['auction'][1]['qualifier'] = 'Test'
        card['auctionKey'] = auction_key(card['auction'])
    card['cardKey'] = 'example|'+card['auctionKey']+('|'+card['context'] if field == 'context' else '')
    run = build_proposal(new, verification(new), baseline(old))
    assert [c['kind'] for c in run['proposal']['changes']] == ['added','removed']


def test_verified_identity_is_mapped_back_to_raw_on_later_runs_and_removal():
    raw = fixture(); overlay = verification(raw); card = overlay['cards'][0]['card']
    card['context'] = 'Warunek odczytany z obrazu'
    card['cardKey'] += '|'+card['context']
    base = baseline(raw, overlay)
    run = build_proposal(raw, overlay, base)
    assert run['proposal']['changes'][0]['kind'] == 'unchanged'
    assert run['proposal']['changes'][0]['cardKey'] == card['cardKey']
    empty = deepcopy(raw); empty['cards'] = []
    removed = build_proposal(empty, verification(empty), base)['proposal']['changes'][0]
    assert removed['kind'] == 'removed' and removed['cardKey'] == card['cardKey']
    with pytest.raises(ValueError, match='explicit linking'):
        build_proposal(raw, verification(raw), base)


def test_uncertain_card_cannot_become_active_even_without_parser_flags():
    raw = fixture(); overlay = verification(raw); overlay['cards'][0]['verification'] = 'uncertain'
    change = build_proposal(raw, overlay)['proposal']['changes'][0]
    assert change['card']['status'] == 'draft'
    assert change['card']['review_flags'] == ['verifier_uncertain']


@pytest.mark.parametrize('fault', ['hash','missing','duplicate','empty','flags','identity','pages'])
def test_verification_rejects_incomplete_or_stale_inputs(fault):
    raw = fixture(); overlay = verification(raw); card = overlay['cards'][0]['card']
    if fault == 'hash': overlay['rawDigest'] = 'wrong'
    elif fault == 'missing': overlay['cards'] = []
    elif fault == 'duplicate': card['lines'].append(deepcopy(card['lines'][0]))
    elif fault == 'empty': card['lines'][0]['meaning'] = ''
    elif fault == 'flags': card['reviewFlags'] = ['unknown_auction']
    elif fault == 'identity': card['cardKey'] = 'wrong'
    elif fault == 'pages': overlay['cards'][0]['pages'] = [2]
    with pytest.raises(ValueError): validate_verified(raw, overlay)


class FakeBackend:
    def __init__(self):
        self.base = None; self.stored = None; self.writes = []; self.fail = False
    def baseline(self, slug): return self.base
    def cards(self, slug): return []
    def run(self, run_id): return self.stored
    def upload_page(self, path, data):
        self.writes.append(('page',path))
        if self.fail: raise RuntimeError('Simulated outage')
    def insert_run(self, run):
        self.writes.append(('run',run['id'])); self.stored = deepcopy(run)


def setup(root):
    raw = fixture()
    write_json(root/'parsed/example.json', raw)
    overlay = verification(raw)
    overlay['pageDigests'] = {'p001.png':hashlib.sha256(b'invented-page').hexdigest()}
    write_json(root/'verified/example.json', overlay)
    (root/'pages/example').mkdir(parents=True)
    (root/'pages/example/p001.png').write_bytes(b'invented-page')
    return FakeBackend()


def test_prepare_is_read_only_and_repeatable(tmp_path):
    backend = setup(tmp_path)
    first = prepare('example', tmp_path, backend)
    second = prepare('example', tmp_path, backend)
    assert first == second and not backend.writes
    assert len(first['images']) == 1


def test_prepare_rejects_image_replaced_since_visual_verification(tmp_path):
    backend = setup(tmp_path)
    (tmp_path/'pages/example/p001.png').write_bytes(b'replacement')
    with pytest.raises(ValueError, match='differs from verification'):
        prepare('example', tmp_path, backend)
    assert not backend.writes


def test_updated_verification_metadata_does_not_reuse_stale_input_digest(tmp_path):
    backend = setup(tmp_path); first = prepare('example', tmp_path, backend)
    path = tmp_path/'verified/example.json'; overlay = read_json(path)
    overlay['reviewedAt'] = '2031-01-02'; write_json(path, overlay)
    second = prepare('example', tmp_path, backend)
    assert second['verificationDigest'] == digest(overlay)
    assert second['verificationDigest'] != first['verificationDigest']
    assert upload('example', tmp_path, backend, confirmed=True)['status'] == 'pending'


def test_upload_needs_explicit_confirmation(tmp_path):
    backend = setup(tmp_path); prepare('example', tmp_path, backend)
    with pytest.raises(ValueError, match='confirmation'): upload('example', tmp_path, backend)
    assert not backend.writes


def test_upload_retries_same_run_after_page_failure(tmp_path):
    backend = setup(tmp_path); prepared = prepare('example', tmp_path, backend)
    backend.fail = True
    with pytest.raises(RuntimeError): upload('example', tmp_path, backend, confirmed=True)
    assert backend.stored is None
    backend.fail = False
    first = upload('example', tmp_path, backend, confirmed=True)
    writes = len(backend.writes)
    second = upload('example', tmp_path, backend, confirmed=True)
    assert first['id'] == second['id'] == prepared['run']['id']
    assert second['alreadyUploaded'] and len(backend.writes) == writes
    assert [x[0] for x in backend.writes] == ['page','page','run']


@pytest.mark.parametrize('fault', ['raw','verification','image','run','base'])
def test_upload_rejects_changes_before_any_write(tmp_path, fault):
    backend = setup(tmp_path); prepared = prepare('example', tmp_path, backend)
    if fault == 'base': backend.base = {'id':'newer'}
    elif fault == 'image': (tmp_path/'pages/example/p001.png').write_bytes(b'changed')
    elif fault == 'run':
        prepared['run']['summary']['cards'] = 7
        write_json(tmp_path/'proposals/example.json',prepared)
    else:
        path = tmp_path/('parsed' if fault == 'raw' else 'verified')/'example.json'
        value = read_json(path); value['changed'] = True; write_json(path,value)
    with pytest.raises(ValueError): upload('example', tmp_path, backend, confirmed=True)
    assert not backend.writes


@pytest.mark.parametrize('slug', ['../env', 'x/y', 'x\\y', 'X', '', '..'])
def test_slug_cannot_escape_private_directory(tmp_path, slug):
    with pytest.raises(ValueError): slug_path(tmp_path, 'parsed', slug)


def test_backend_hides_response_body_and_disallows_redirects():
    backend = Backend('https://example.supabase.co', 'invented-secret')
    class FailingOpener:
        def open(self, request, timeout):
            raise HTTPError(request.full_url, 403, 'invented-secret', {}, BytesIO(b'private body'))
    backend.opener = FailingOpener()
    with pytest.raises(RuntimeError) as error: backend.baseline('example')
    assert str(error.value) == 'Supabase HTTP 403; response hidden'
    assert NoRedirect().redirect_request(None,None,302,None,None,None) is None


@pytest.mark.parametrize('url', ['http://example.supabase.co','https://evil.test',
    'https://example.supabase.co/other','https://example.supabase.co?secret=x'])
def test_backend_rejects_wrong_destinations(url):
    with pytest.raises(ValueError): Backend(url,'invented')
