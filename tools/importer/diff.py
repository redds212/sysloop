"""Raw-to-raw revision comparison; verification never overwrites the raw snapshot."""
from collections import Counter
from copy import deepcopy
import hashlib
import json
from .auction import auction_key


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                    separators=(',', ':')).encode()).hexdigest()


def indexed(items, field):
    result = {item[field]: item for item in items}
    if len(result) != len(items):
        raise ValueError('Duplicate identity')
    return result


def line_changes(old, new):
    before, after = indexed(old, 'key'), indexed(new, 'key')
    return [{'key': key, 'kind': ('removed' if key not in after else
            'added' if key not in before else 'unchanged' if before[key] == after[key] else 'changed')}
            for key in list(after) + [k for k in before if k not in after]]


def document(card, verification):
    fields = {'categorySlug':'category_slug', 'cardKey':'card_key', 'sortOrder':'sort_order',
              'auctionKey':'auction_key', 'auctionNote':'auction_note', 'reviewFlags':'review_flags',
              'verificationNote':'verification_note', 'sourcePage':'source_page',
              'sourceRevision':'source_revision'}
    result = {fields.get(k, k): deepcopy(card[k]) for k in
              ['categorySlug', 'cardKey', 'section', 'sortOrder', 'auction', 'auctionKey',
               'context', 'auctionNote', 'notes', 'lines', 'reviewFlags', 'verificationNote',
               'sourcePage', 'sourceRevision'] if k in card}
    result.setdefault('context', '')
    result.setdefault('auction_note', '')
    result.setdefault('verification_note', '')
    flags = result.setdefault('review_flags', [])
    if verification != 'ok' and not flags:
        flags.append('verifier_uncertain')
    result['status'] = 'active' if verification == 'ok' and not flags else 'draft'
    return result


def validate_verified(raw, overlay):
    if overlay['rawDigest'] != digest(raw):
        raise ValueError('Verification belongs to another parse')
    before = indexed(raw['cards'], 'cardKey')
    verified = indexed(overlay['cards'], 'rawCardKey')
    if set(before) != set(verified):
        raise ValueError('Verification must account for every raw card')
    indexed([v['card'] for v in verified.values()], 'cardKey')
    for item in verified.values():
        card = item['card']
        if card['categorySlug'] != raw['category']['slug'] or not card['lines']:
            raise ValueError('Invalid verified card')
        indexed(card['lines'], 'key')
        canonical = auction_key(card['auction'])
        identity = card['categorySlug'] + '|' + canonical
        if card.get('context'):
            identity += '|' + card['context']
        if card['auctionKey'] != canonical or not (card['cardKey'] == identity or
                (card['cardKey'].startswith(identity + '#') and
                 card['cardKey'][len(identity)+1:].isdigit())):
            raise ValueError('Invalid canonical identity')
        if item['verification'] not in ('ok', 'uncertain'):
            raise ValueError('Invalid verification status')
        if item['verification'] == 'ok' and (card['reviewFlags'] or
                any(not l['meaning'].strip() or not l['bids'] for l in card['lines'])):
            raise ValueError('Incomplete card cannot be verified')
        pages = item['pages']
        if not pages or any(type(p) is not int or not 1 <= p <= raw['stats']['pages'] for p in pages):
            raise ValueError('Invalid source pages')
    return verified


def build_proposal(raw, overlay, baseline=None, current_cards=()):
    verified = validate_verified(raw, overlay)
    old_cards = indexed(baseline['raw_snapshot']['cards'], 'cardKey') if baseline else {}
    new_cards = indexed(raw['cards'], 'cardKey')
    current = indexed(current_cards, 'card_key')
    # A verifier can repair an auction identity. Remember its raw origin across runs.
    previous = {c['newRaw']['cardKey']: c['cardKey'] for c in
                baseline['proposal']['changes'] if c.get('newRaw')} if baseline else {}
    changes = []
    for key, new in new_cards.items():
        old = old_cards.get(key)
        item = verified[key]
        doc = document(item['card'], item['verification'])
        previous_key = previous.get(key, key)
        if old and previous_key != doc['card_key']:
            raise ValueError('Identity changed after verification; explicit linking required')
        # Revision/page metadata alone must not reset learning.
        def content(c):
            return {k:v for k,v in c.items() if k not in ('sourceRevision', 'sourcePage', 'sortOrder')}
        kind = 'added' if old is None else 'unchanged' if content(old) == content(new) else 'changed'
        db = current.get(previous_key)
        effective = deepcopy(doc['lines'])
        if old and kind == 'changed':
            # A verified line may combine several misclassified raw rows. The current
            # SQL merge only knows one-to-one keys: refuse an unsafe revision instead
            # of preserving stale text when a folded raw continuation changed.
            proposed_keys = {line['key'] for line in doc['lines']}
            previous_change = next((c for c in baseline['proposal']['changes']
                                    if (c.get('newRaw') or {}).get('cardKey') == key), {})
            previous_keys = {l['key'] for l in previous_change.get('card', {}).get('lines', old['lines'])}
            if any(line['kind'] != 'unchanged' and line['key'] not in proposed_keys
                   and (line['kind'] != 'removed' or line['key'] not in previous_keys)
                   for line in line_changes(old['lines'], new['lines'])
                   ):
                raise ValueError('Changed folded raw line requires explicit merge review')
        if old and db:
            before, after = indexed(old['lines'], 'key'), indexed(new['lines'], 'key')
            live = indexed(db['lines'], 'key')
            effective = [deepcopy(live[l['key']]) if l['key'] in before and
                         before[l['key']] == after.get(l['key']) and l['key'] in live else l
                         for l in effective]
        changes.append({'cardKey':doc['card_key'], 'kind':kind, 'card':doc,
                        'oldRaw':deepcopy(old), 'newRaw':deepcopy(new),
                        'verification':item['verification'],
                        'lineChanges':line_changes(old['lines'] if old else [], new['lines']),
                        'effectiveLines':effective, 'sourcePages':item['pages']})
    for key, old in old_cards.items():
        if key not in new_cards:
            changes.append({'cardKey':previous.get(key, key), 'kind':'removed',
                            'oldRaw':deepcopy(old), 'newRaw':None,
                            'lineChanges':line_changes(old['lines'], [])})
    counts = Counter(c['kind'] for c in changes)
    return {'category_slug':raw['category']['slug'], 'source_file':raw['category']['sourceFile'],
            'revision':raw['category']['revision'], 'status':'pending',
            'raw_snapshot':deepcopy(raw), 'proposal':{'baseRunId':baseline['id'] if baseline else None,
                                                    'changes':changes},
            'summary':{**{k:counts[k] for k in ('added','changed','removed','unchanged')},
                       'cards':len(new_cards), 'lines':sum(len(v['card']['lines']) for v in verified.values()),
                       'active':sum(c.get('card',{}).get('status') == 'active' for c in changes),
                       'draft':sum(c.get('card',{}).get('status') == 'draft' for c in changes)}}
