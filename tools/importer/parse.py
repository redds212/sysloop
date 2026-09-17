"""Offline parsing. Never print meanings, private headings, or parse payloads."""
from collections import Counter
from copy import deepcopy
from pathlib import Path
import json
import re
import pymupdf
from .layout import group_rows, strip_noise, split_cells, cell_text
from .auction import alternatives, auction_key, header_calls, leading_call, normalize, parse_stub, stub_cells, UNKNOWN_LABEL, CALL_PATTERN

SECTION = re.compile(r'^(?:LICYTACJA|DALSZA\s+LICYTACJA|KONTYNUACJA|KONTRA\s+NA)\b')
PROSE = re.compile(r'^(?:OPIS\b|UWAGI\s+OG[ÓO]LNE)')
TITLE = re.compile(r'^(?:OTWARCIE\s+[1-7]|OBRONA\s+(?:vs|przeciwko|VS)|WEJ[ŚS]CIA\s+DWUKOLOROWE|LICYTACJA W OBRONIE)')
NOTE = re.compile(r'^(?:UWAGA\b|UWAGI\b|TAK JAK\b|SCHEMAT\b|DALSZA LICYTACJA JAK\b)', re.I)
FLAGS = ('line_count_mismatch','ambiguous_layout','relative_stub','auction_from_header','unknown_auction',
         'duplicate_key','wrapped_line','unknown_token','empty_meaning','suspicious_length','qualifier_guess','verifier_uncertain')


def category_for(path):
    catalog = json.loads(Path(__file__).with_name('categories.json').read_text(encoding='utf-8'))
    for index, meta in enumerate(catalog):
        match = re.fullmatch(re.escape(meta['prefix']) + r'(?:_(rev\d+\w*|\d{4}))?', Path(path).stem, re.I)
        if match:
            return {**{k:v for k,v in meta.items() if k != 'prefix'}, 'sortOrder':index,
                    'sourceFile':Path(path).name, 'revision':match.group(1) or '', 'notes':[]}
    raise ValueError('Plik nie ma kategorii w categories.json')


def line_candidate(row):
    """Read the label cell and its y-aligned meaning, with/without a printed dash."""
    cells = split_cells(row)
    if len(cells) > 1 and cells[0]:
        label = cell_text(cells[0])
        part = leading_call(label)
        if part and not part[1] and part[0] != '?':
            raw = part[0]
            # A row-wide auction is classified before this candidate is attached.
            separator = next((i for i,w in enumerate(row.words) if w.text in ('-','–','—','−')), None)
            if separator is not None:
                words = row.words[separator+1:]
                return raw, ' '.join(w.text for w in words), words[0].x0 if words else None
        if UNKNOWN_LABEL.fullmatch(label) or (re.fullmatch(r'[\w♣♦♥♠/*+()]{1,16}',label) and row.x < 160 and not NOTE.match(label)):
            words = [w for cell in cells[1:] for w in cell]
            return label, ' '.join(w.text for w in words), words[0].x0 if words else None
    # Some tables have no separator. A large horizontal gap isolates the label cell.
    for i in range(1, min(4,len(row.words))):
        left, right = row.words[:i], row.words[i:]
        label = ' '.join(w.text for w in left)
        if right[0].x0 - left[-1].x1 < 9:
            continue
        try:
            alternatives(label.strip('()'))
        except ValueError:
            continue
        return label, ' '.join(w.text for w in right), right[0].x0
    return None


class Parser:
    def __init__(self, category):
        self.category = deepcopy(category)
        self.category.setdefault('notes', [])
        self.cards = []
        self.current = None
        self.section = ''
        self.section_calls = []
        self.section_flags = []
        self.header_kind = ''
        self.header_page = 1
        self.root = []
        self.prose = None
        self.last_line = None
        self.meaning_x = None
        self.note_mode = False
        self.audit = []
        self.candidate_refs = []
        self.line_refs = []
        self.orphan_refs = []

    def record(self, row, kind):
        self.audit.append({'row':row.ref, 'kind':kind, 'page':row.page,
                           'bounds':[row.x,row.y,max(w.x1 for w in row.words),max(w.y1 for w in row.words)],
                           'text':row.text})

    def finish(self):
        if self.current:
            if self.current['lines']:
                self.cards.append(self.current)
            elif self.current['notes']:
                self.category['notes'].append({'title':self.current['section'], 'body':'\n'.join(self.current['notes'])})
        self.current = None
        self.last_line = None
        self.meaning_x = None
        self.note_mode = False

    def new_card(self, auction, page, flags=(), context='', auction_note=''):
        self.finish()
        self.current = {'categorySlug':self.category['slug'], 'section':self.section, 'sortOrder':len(self.cards),
            'auction':auction, 'auctionKey':auction_key(auction), 'notes':[], 'lines':[],
            'reviewFlags':list(dict.fromkeys(flags)), 'sourcePage':page, 'sourceRevision':self.category['revision']}
        self.current['_sourceOrder'] = self.row_order.get(self.active_row.ref,0)
        if context: self.current['context'] = context
        if auction_note: self.current['auctionNote'] = auction_note

    def ensure_card(self, row):
        if self.current:
            return
        flags = list(self.section_flags)
        auction = self.section_calls
        if self.header_kind == 'summary' and not auction:
            auction = self.root
        elif self.header_kind in ('section','prose') and auction:
            flags.append('auction_from_header')
        if not auction:
            flags.append('unknown_auction')
        self.new_card(normalize(auction), self.header_page if self.header_kind else row.page, flags)

    def add_line(self, row, candidate):
        self.ensure_card(row)
        raw, meaning, x = candidate
        try:
            bids = alternatives(raw.strip('() '))
        except ValueError:
            bids = []
            self.current['reviewFlags'].append('unknown_token')
        key = '/'.join(bids) or f'unknown:{raw}'
        repeats = sum(1 for line in self.current['lines'] if line['key'].split('#')[0] == key)
        if repeats: key += f'#{repeats+1}'
        line = {'key':key, 'label':raw, 'bids':bids, 'meaning':meaning}
        self.current['lines'].append(line)
        if not meaning:
            self.current['reviewFlags'].extend(['line_count_mismatch','empty_meaning'])
        if 'unknown_auction' in self.current['reviewFlags']:
            self.orphan_refs.append(row.ref)
        self.last_line, self.meaning_x, self.note_mode = line, x, False
        self.candidate_refs.append(row.ref)
        self.line_refs.append({'row':row.ref, 'cardOrder':len(self.cards), 'lineKey':key})
        self.record(row, 'call_line')

    def text_row(self, row):
        text = row.text
        if self.current:
            if NOTE.match(text):
                self.note_mode = True
            if self.last_line and not self.note_mode and self.meaning_x is not None and row.x >= self.meaning_x - 4:
                self.last_line['meaning'] += '\n' + text
                self.record(row, 'meaning_continuation')
                return
            if self.last_line and not self.note_mode and row.words[0].text in ('-','–','—'):
                self.last_line['meaning'] += '\n' + text
                self.current['reviewFlags'].append('wrapped_line')
                self.record(row, 'meaning_continuation_uncertain')
                return
            # An isolated '<opponents call> = ...' describes that call, not an answer.
            part = leading_call(text)
            if part and part[1].startswith('='):
                try: bids = alternatives(part[0].strip('() '))
                except ValueError: bids = []
                match = next((c for c in reversed(self.current['auction']) if c['side']=='they' and c['alts']==bids),None)
                if match:
                    match['qualifier'] = part[1].lstrip('= ')
                    self.current['auctionKey'] = auction_key(self.current['auction'])
                    self.record(row, 'qualifier')
                    return
            self.current['notes'].append(text)
            self.note_mode = True
            if not self.current['lines']:
                self.current['reviewFlags'].append('line_count_mismatch')
            self.record(row, 'card_note')
        else:
            if self.prose is None:
                self.prose = {'title':self.section, 'body':''}
                self.category['notes'].append(self.prose)
            self.prose['body'] += ('\n' if self.prose['body'] else '') + text
            self.record(row, 'category_note')

    def parse(self, rows):
        self.row_order = {r.ref:i for i,r in enumerate(rows)}
        if len(self.row_order) != len(rows):
            raise ValueError('Powtórzone identyfikatory wierszy źródłowych')
        i = 0
        while i < len(rows):
            row = rows[i]; text = row.text
            self.active_row = row
            if SECTION.match(text) and not NOTE.match(text) or PROSE.match(text) or text.upper().startswith('ZESTAWIENIE') or TITLE.match(text):
                self.finish(); self.prose = None
                self.section, self.header_page = text, row.page
                self.section_calls, self.section_flags = header_calls(text)
                if TITLE.match(text):
                    self.header_kind = 'title'
                    self.root = self.section_calls
                elif text.upper().startswith('ZESTAWIENIE'):
                    self.header_kind = 'summary'
                    self.ensure_card(row)
                elif PROSE.match(text):
                    self.header_kind = 'prose'
                else:
                    self.header_kind = 'section'
                self.record(row,'header'); i += 1; continue

            # Collect consecutive geometrically valid stub rows before classifying call lines.
            stub = stub_cells(row)
            if stub:
                batch, j = [row], i + 1
                has_question = any(c[1]=='?' for c in stub)
                while not has_question and j < len(rows):
                    following = stub_cells(rows[j])
                    if not following: break
                    batch.append(rows[j]); j += 1
                    has_question = any(c[1]=='?' for c in following)
                if has_question:
                    auction, flags, context, note = parse_stub(batch,self.section_calls)
                    flags += self.section_flags
                    self.new_card(auction,row.page,flags,context,note)
                    for r in batch: self.record(r,'stub')
                    i = j; continue

            candidate = line_candidate(row)
            if candidate:
                self.add_line(row,candidate)
            else:
                self.text_row(row)
            i += 1
        self.finish()
        # Independent conservative audit for glued label/separator tokens missed by cell parsing.
        # Indented continuation calls and full auction examples remain notes with their source row.
        candidate_set = set(self.candidate_refs)
        label_x = [r.x for r in rows if r.ref in candidate_set]
        boundary = sorted(label_x)[len(label_x)//2]+18 if label_x else 150
        classifications = {r['row']:r for r in self.audit}
        recovered = 0
        for row in rows:
            entry = classifications[row.ref]
            if entry['kind'] in ('call_line','stub','header') or row.x > boundary:
                continue
            match = re.match(rf'^({CALL_PATTERN})\s*[-–]\s*(.+)$',row.text,re.I)
            if not match:
                continue
            if re.match(rf'^(?:{CALL_PATTERN}|\({CALL_PATTERN}\))\s*[-–]',match.group(2),re.I) or '->' in row.text:
                entry['auditReason'] = 'auction_example_or_reference'
                continue
            self.active_row = row
            self.new_card([],row.page,['unknown_auction','ambiguous_layout'])
            # Attach every recovered line as an explicit orphan, never silently as prose.
            before = len(self.audit)
            self.add_line(row,(match.group(1),match.group(2),None))
            entry['kind'] = 'recovered_call_line'
            del self.audit[before:]
            self.finish(); recovered += 1
        self.cards.sort(key=lambda card:card['_sourceOrder'])
        order_map = {card['sortOrder']:i for i,card in enumerate(self.cards)}
        for i,card in enumerate(self.cards):
            card['sortOrder'] = i
            del card['_sourceOrder']
        for reference in self.line_refs:
            reference['cardOrder'] = order_map[reference['cardOrder']]
        keys = Counter()
        for card in self.cards:
            base = f"{card['categorySlug']}|{card['auctionKey']}" + (f"|{card['context']}" if card.get('context') else '')
            keys[base] += 1
            card['cardKey'] = base + (f'#{keys[base]}' if keys[base] > 1 else '')
            if keys[base] > 1: card['reviewFlags'].append('duplicate_key')
            if len(card['lines']) == 1 or len(card['lines']) > 30: card['reviewFlags'].append('suspicious_length')
            card['reviewFlags'] = sorted(set(card['reviewFlags']))
        flags = Counter(flag for c in self.cards for flag in c['reviewFlags'])
        stats = {'cards':len(self.cards), 'lines':sum(len(c['lines']) for c in self.cards),
                 'flaggedCards':sum(bool(c['reviewFlags']) for c in self.cards),
                 'flags':{f:flags[f] for f in FLAGS if flags[f]}, 'unattachedLines':len(self.orphan_refs),
                 'detectedCallLines':len(self.candidate_refs), 'unaccountedCallLines':0,
                 'recoveredByAudit':recovered}
        if stats['lines'] != stats['detectedCallLines']:
            raise RuntimeError('Niezgodny bilans odzywek — zapis wstrzymany')
        return {'category':self.category, 'cards':self.cards, 'stats':stats,
                'audit':{'rows':self.audit,'lineReferences':self.line_refs,'unattachedRows':self.orphan_refs}}


def parse_file(path, output_root=Path('data'), render=True):
    path, output_root = Path(path), Path(output_root)
    meta = category_for(path)
    with pymupdf.open(path) as doc:
        pages = [(group_rows(page.get_text('words'),i+1),page.rect.height) for i,page in enumerate(doc)]
        rows, removed = strip_noise(pages)
        result = Parser(meta).parse(rows)
        result['stats']['pages'] = len(doc)
        result['audit']['removedNoiseRows'] = [r.ref for r in removed]
        result['audit']['totalSourceRows'] = sum(len(p[0]) for p in pages)
        if len(rows) != len(result['audit']['rows']):
            raise RuntimeError('Niezgodny bilans wierszy — zapis wstrzymany')
        if render:
            folder = output_root/'pages'/meta['slug']; folder.mkdir(parents=True,exist_ok=True)
            for i,page in enumerate(doc):
                page.get_pixmap(matrix=pymupdf.Matrix(1.5,1.5),alpha=False).save(folder/f'p{i+1:03}.png')
    folder = output_root/'parsed'; folder.mkdir(parents=True,exist_ok=True)
    (folder/f"{meta['slug']}.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    from .review_html import write_review
    write_review(result,output_root)
    return result
