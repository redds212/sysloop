"""Same canonical token and implicit-pass rules as src/lib/auction/normalize.ts."""
import re
from copy import deepcopy
from .layout import cell_text, split_cells

ALIASES = {'PAS': 'P', 'PASS': 'P', 'KTR': 'X', 'RKTR': 'XX', 'WYŻSZE': '*'}
SUITS = str.maketrans('♣♦♥♠', 'CDHS')
ATOM = r'(?:[1-7]\s*(?:NT|BA|[♣♦♥♠CDHSX*])|RKTR|KTR|PASS|PAS|XX|X|P|WYŻSZE|\*)'
SHORT = r'(?:NT|BA|[♣♦♥♠CDHS])'
CALL_PATTERN = rf'{ATOM}(?:\s*/\s*(?:{ATOM}|{SHORT}))*'
LEADING = re.compile(rf'^\s*(\(\s*{CALL_PATTERN}\s*\)|{CALL_PATTERN}|\?)(?=$|[\s=,;:–—-])', re.I)
ANY_CALL = re.compile(rf'(?<![\w+])(?:\(\s*{CALL_PATTERN}\s*\)|{CALL_PATTERN})(?![\w+])', re.I)
# Preserve shorthand not specified by the token vocabulary for review.
UNKNOWN_LABEL = re.compile(r'^(?:[1-7](?:step|m|M|o|O|szczebel)|[?])$', re.I)


def normalize_token(raw):
    text = re.sub(r'\s+', '', raw.upper()).translate(SUITS)
    text = re.sub(r'BA$', 'NT', text)
    text = ALIASES.get(text, re.sub(r'^([1-7])X$', r'\1*', text))
    if not re.fullmatch(r'(?:[1-7](?:[CDHS]|NT|\*)|P|X|XX|\*)', text):
        raise ValueError('unknown_token')
    return text


def alternatives(raw):
    result, level = [], ''
    for part in raw.split('/'):
        part = part.strip()
        if re.match('[1-7]', part):
            level = part[0]
        elif re.fullmatch(SHORT, part, re.I) and level:
            part = level + part
        token = normalize_token(part)
        if token not in result:
            result.append(token)
    return result


def make_call(raw, side='we', qualifier=None):
    c = {'side': side, 'alts': alternatives(raw.strip('() '))}
    if qualifier:
        c['qualifier'] = qualifier
    return c


def normalize(calls, before_question=True):
    result = []
    for call in deepcopy(calls):
        if result and result[-1]['side'] == call['side']:
            result.append({'side': 'they' if call['side'] == 'we' else 'we', 'alts': ['P'], 'implicit': True})
        result.append(call)
    if before_question and result and result[-1]['side'] == 'we':
        result.append({'side': 'they', 'alts': ['P'], 'implicit': True})
    return result


def auction_key(calls):
    def label(c):
        text = '/'.join(c['alts']) + (f"[{c['qualifier']}]" if c.get('qualifier') else '')
        return f'({text})' if c['side'] == 'they' else text
    return ' '.join(map(label, calls))


def leading_call(text):
    match = LEADING.match(text)
    if match:
        return match.group(1), text[match.end():].strip()
    first = text.split(maxsplit=1)
    if first and UNKNOWN_LABEL.fullmatch(first[0]):
        return first[0], first[1] if len(first) > 1 else ''
    return None


def header_calls(text):
    matches = list(ANY_CALL.finditer(text))
    calls, flags = [], []
    for i, match in enumerate(matches):
        raw = match.group()
        c = make_call(raw, 'they' if raw.startswith('(') else 'we')
        tail = text[match.end():matches[i+1].start() if i+1 < len(matches) else len(text)].strip(' –-—:')
        if tail and not re.fullmatch(r'[\s?/,;()–—-]+', tail):
            c['qualifier'] = tail
            if not re.match(r'^(?:NATURALNE|TRANSFER|NAT|T/O|[<\d]|FIT|=)', tail, re.I):
                flags.append('qualifier_guess')
        calls.append(c)
    return calls, flags


def stub_cells(row):
    cells = split_cells(row)
    parsed = []
    prose_tail = False
    for i, cell in enumerate(cells):
        text = cell_text(cell)
        if not text:
            parsed.append((i, None, '', None))
            continue
        part = leading_call(text)
        if not part:
            if parsed and parsed[-1][1] == '?':
                col, raw, tail, x = parsed[-1]
                parsed[-1] = (col, raw, (tail + ' ' + text).strip(), x)
                continue
            return None
        raw, tail = part
        # Mixed-case annotations may follow a call in a multi-call stub.
        # The parser still requires a final question before accepting a batch.
        annotation = leading_call(tail) if tail else None
        if tail and raw != '?' and not (tail.isupper() or tail.startswith('=')
                or (annotation and annotation[1].startswith('='))
                or re.match(r'^(?:T/O|<\d|[1-7]\+)', tail)):
            prose_tail = True
        parsed.append((i, raw, tail, cell[0].x0))
    filled = [cell for cell in parsed if cell[1]]
    if not filled:
        return None
    if prose_tail and len(filled) < 2:
        return None
    return parsed


def parse_stub(rows, header=None):
    parsed = [stub_cells(row) for row in rows]
    parsed = [row for row in parsed if row]
    flags, note, context = [], [], ''
    if not parsed:
        return [], ['unknown_auction'], context, ''
    max_cells = max(len(row) for row in parsed)
    all_cells = [c for row in parsed for c in row]
    question = next((c for c in reversed(all_cells) if c[1] == '?'), None)
    parenthesized = [c for c in all_cells if c[1] and c[1].startswith('(')]
    four = max_cells >= 3 or bool(parenthesized)
    # A trailing separator on a one-column '?' does not create four seats.
    if not parenthesized and max_cells <= 2:
        four = False
    # Align cell x positions across rows, including leading blank seats with no dash.
    # Tokens are variably wide: a 15pt band handles centred labels and explicit parentheses.
    columns = []
    if four:
        positions = sorted(c[3] for c in all_cells if c[1] and c[3] is not None)
        for x in positions:
            if columns and x - sum(columns[-1])/len(columns[-1]) < 15:
                columns[-1].append(x)
            else: columns.append([x])
        anchors = [sum(xs)/len(xs) for xs in columns]
        if 3 <= len(anchors) <= 4:
            all_cells = [(min(range(len(anchors)),key=lambda n:abs(anchors[n]-x)) if x is not None else col,raw,tail,x)
                         for col,raw,tail,x in all_cells]
            question = next((c for c in reversed(all_cells) if c[1]=='?'),None)
        elif len(anchors) > 4:
            flags.append('ambiguous_layout')
    parity = question[0] % 2 if question and four else 0
    if four and not question and parenthesized:
        parity = 1 - parenthesized[0][0] % 2
    written = []
    annotations = []
    for _, raw, tail, _ in all_cells:
        if raw == '?' and tail:
            annotation = leading_call(tail)
            if annotation and annotation[1].startswith('='):
                annotations.append(annotation)
            else:
                context = tail
    for column, raw, tail, x in all_cells:
        if not raw or raw == '?':
            continue
        side = ('we' if column % 2 == parity else 'they') if four else 'we'
        if raw.startswith('(') and side != 'they':
            flags.append('ambiguous_layout')
        try:
            c = make_call(raw, side)
        except ValueError:
            flags.append('unknown_token')
            continue
        if tail:
            annotation = leading_call(tail)
            if annotation and annotation[1].startswith('='):
                annotations.append(annotation)
            elif tail.startswith('=') and side == 'they':
                c['qualifier'] = tail.lstrip('= ')
            else:
                note.append(tail)
        written.append(c)
    for raw, tail in annotations:
        try: bids = alternatives(raw.strip('() '))
        except ValueError:
            flags.append('qualifier_guess'); note.append(raw + ' ' + tail); continue
        match = next((c for c in reversed(written) if c['side']=='they' and c['alts']==bids),None)
        if match: match['qualifier'] = tail.lstrip('= ')
        else: note.append(raw + ' ' + tail)
    if not question:
        flags.append('ambiguous_layout')
    header = header or []
    # Match a suffix of the header to the beginning of a relative stub.
    if header:
        def signature(c): return (c['side'], tuple(c['alts']))
        h = normalize(header, False)
        w = normalize(written, False)
        if not w:
            written = deepcopy(header)
            flags.append('relative_stub')
        elif [signature(c) for c in w[:len(h)]] != [signature(c) for c in h]:
            overlap = next((n for n in range(min(len(h),len(w)),0,-1)
                if [signature(c) for c in h[-n:]] == [signature(c) for c in w[:n]]), 0)
            if overlap:
                written = h[:-overlap] + w
                flags.append('relative_stub')
            else:
                # A new explicit root is not a relative auction (e.g. paired major openings).
                explicit_root_after_pass = (written and written[0]['alts'] == ['P']
                    and any(c['alts'] == h[0]['alts'] for c in written[1:]))
                if written and written[0]['alts'] in (['P'],['X'],['XX']) and not explicit_root_after_pass:
                    written = h + w
                    flags.append('relative_stub')
        # Qualifiers in a section header belong to matching prefix calls, not to identities elsewhere.
        norm = normalize(written, False)
        for i, c in enumerate(h):
            if i < len(norm) and signature(c) == signature(norm[i]) and c.get('qualifier'):
                norm[i]['qualifier'] = c['qualifier']
        written = norm
    if not written:
        flags.append('unknown_auction')
    return normalize(written), sorted(set(flags)), context, '\n'.join(note)
