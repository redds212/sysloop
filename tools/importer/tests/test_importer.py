"""Invented auctions and meanings, including one case per hazard in SPEC §4.3."""
import json
from pathlib import Path
import pytest
from tools.importer.layout import Word, Row, group_rows, strip_noise
from tools.importer.auction import alternatives, auction_key, make_call, normalize, parse_stub, header_calls
from tools.importer.parse import Parser, category_for, line_candidate
from tools.importer.review_html import write_review


def row(text, y=100, page=1, index=0, x=65):
    words = []
    for part in text.split():
        words.append(Word(x,y,x+len(part)*6,y+10,part)); x += len(part)*6+5
    return Row(page,index,words)


def table_row(label, meaning, y, page=1, index=0, dash=True):
    words = [Word(70,y,70+len(label)*6,y+10,label)] if label else []
    if dash: words.append(Word(115,y,120,y+10,'-'))
    if meaning: words.append(Word(140,y,140+len(meaning)*5,y+10,meaning))
    return Row(page,index,words)


def parse(rows):
    rows = [Row(r.page,i,r.words) for i,r in enumerate(rows)]
    return Parser({'slug':'fictional','name':'Test','group':'Test','revision':'test','notes':[]}).parse(rows)


def root_rows():
    return [row('OTWARCIE 4♣',20,index=0),row('ZESTAWIENIE PIERWSZYCH ODPOWIEDZI',40,index=1)]


def w(text): return make_call(text)
def t(text): return make_call(text,'they')


@pytest.mark.parametrize('calls,expected',[
    ([w('2♣'),w('2♦')],'2C (P) 2D (P)'),
    ([w('2♣'),w('2♦'),w('2♥'),w('3♣'),w('3♦')],'2C (P) 2D (P) 2H (P) 3C (P) 3D (P)'),
    ([t('2♦'),w('ktr'),t('pas'),w('2♥'),t('pas'),w('2♠'),t('pas')],'(2D) X (P) 2H (P) 2S (P)'),
    ([t('2NT'),w('x'),t('pass/xx')],'(2NT) X (P/XX)'),
    ([t('2NT'),w('pass'),t('5♣/♦/♥')],'(2NT) P (5C/5D/5H)'),
    ([w('3♥'),t('ktr')],'3H (X)'),
    ([w('2♣'),t('pas'),w('2♦'),make_call('ktr','they','FIKCYJNE')],'2C (P) 2D (X[FIKCYJNE])'),
    ([t('2♦'),w('pas'),t('WYŻSZE')],'(2D) P (*)'),
    ([t('2♥'),w('3♥')],'(2H) 3H (P)'),
    ([w('5♣')],'5C (P)'),
    ([w('4♥/♠')],'4H/4S (P)'),
])
def test_each_normalization_table_row_invented(calls,expected):
    assert auction_key(normalize(calls)) == expected


def test_hazard_multiple_meanings_by_y_not_text_order():
    # Deliberately reversed PDF extraction order, including four meanings on one call.
    source = root_rows()+[table_row('4♦','wariant A',60,index=2),table_row('','wariant B',74,index=3,dash=False),
        table_row('','wariant C',88,index=4,dash=False),table_row('','wariant D',102,index=5,dash=False),
        table_row('4♥','inne znaczenie',116,index=6)]
    scrambled = [word for r in reversed(source) for word in reversed(r.words)]
    result = parse(group_rows(scrambled))
    assert len(result['cards']) == 1
    assert result['cards'][0]['lines'][0]['meaning'] == 'wariant A\nwariant B\nwariant C\nwariant D'
    assert 'line_count_mismatch' not in result['cards'][0]['reviewFlags']
    assert result['stats']['lines'] == 2


def test_hazard_page_header_and_footer_removed_midblock():
    pages = []
    for page in (1,2):
        pages.append(([row('Otwarcie test — licytacja jednostronna',10,page),table_row('4♦','tekst',80,page),row(str(page),810,page)],842))
    kept, noise = strip_noise(pages)
    assert len(kept) == 2 and len(noise) == 4


def test_hazard_wrapped_rows_and_lone_dash():
    r = parse(root_rows()+[table_row('4♦','pierwszy wariant',60),table_row('','drugi wariant',74)])
    assert len(r['cards'][0]['lines']) == 1
    assert 'drugi wariant' in r['cards'][0]['lines'][0]['meaning']
    assert 'wrapped_line' in r['cards'][0]['reviewFlags']


@pytest.mark.parametrize('label,bids',[('5♥/♠',['5H','5S']),('pas/x',['P','X']),('5♣/♦',['5C','5D']),('KTR /5♦',['X','5D'])])
def test_hazard_grouped_calls(label,bids):
    assert alternatives(label) == bids


def test_hazard_two_column_stub():
    calls,flags,_,_ = parse_stub([row('4♣ - 4♦'),row('4♥ - 4♠'),row('5♣ - ?')])
    assert auction_key(calls) == '4C (P) 4D (P) 4H (P) 4S (P) 5C (P)'
    assert not flags


def test_hazard_four_columns_parenthesized():
    calls,flags,_,_ = parse_stub([row('(3♦) - ktr - (pas) - 3♥'),row('(pas) - 3♠ - (pas) - ?')])
    assert auction_key(calls) == '(3D) X (P) 3H (P) 3S (P)'
    assert not flags


def test_hazard_four_columns_without_parentheses():
    calls,flags,_,_ = parse_stub([row('3♥ - ktr - ? -')])
    assert auction_key(calls) == '3H (X)'
    assert not flags


def test_hazard_empty_seat_cells():
    first = Row(1,0,[Word(100,50,105,60,'-'),Word(160,50,165,60,'-'),Word(190,50,210,60,'pas'),Word(220,50,225,60,'-'),Word(250,50,280,60,'(pas)')])
    second = Row(1,1,[Word(70,70,90,80,'rktr'),Word(100,70,105,80,'-'),Word(130,70,155,80,'(pas)'),Word(160,70,165,80,'-'),Word(190,70,200,80,'?'),Word(220,70,225,80,'-')])
    calls,flags,_,_ = parse_stub([first,second])
    assert auction_key(calls) == 'P (P) XX (P)'
    assert not flags


def test_hazard_qualifiers_preserved_in_identity():
    a, _ = header_calls('LICYTACJA 4♣ – (PAS) – 4♦ – (KTR) T/O')
    b, _ = header_calls('LICYTACJA 4♣ – (PAS) – 4♦ – (KTR) 6+♠')
    assert auction_key(a) != auction_key(b)
    calls,flags,_,_ = parse_stub([row('?')],a)
    assert calls[-1]['qualifier'] == 'T/O'
    assert 'relative_stub' in flags


def test_hazard_context_and_wildcards():
    calls,_,context,_ = parse_stub([row('4♥/♠ - ? WARUNEK TESTOWY')])
    assert context == 'WARUNEK TESTOWY'
    assert auction_key(calls) == '4H/4S (P)'
    assert alternatives('2X') == ['2*'] and alternatives('WYŻSZE') == ['*']


def test_hazard_alternative_stub_calls():
    calls,_,_,_ = parse_stub([row('(3NT) - pass - (5♣/♦/♥) - ?')])
    assert auction_key(calls) == '(3NT) P (5C/5D/5H)'


def test_hazard_trailing_qualifier_or_note():
    calls,_,_,note = parse_stub([row('4♣ - (X) = TEST - ? -')])
    assert calls[-1]['qualifier'] == 'TEST'
    assert note == ''
    calls,_,_,note = parse_stub([row('4♣ - 4♦ UWAGA'),row('? -')])
    assert note == 'UWAGA'


def test_hazard_call_lines_under_prose_header():
    r = parse([row('OPIS INTERWENCJI PO (3♠)'),table_row('4♣','fikcyjne',100)])
    assert 'auction_from_header' in r['cards'][0]['reviewFlags']
    assert r['stats']['lines'] == 1


def test_hazard_relative_stubs_resolve_suffix():
    header = [w('4C'),w('4D'),w('4H')]
    calls,flags,_,_ = parse_stub([row('4♥ - 4♠'),row('5♣ - ?')],header)
    assert auction_key(calls) == '4C (P) 4D (P) 4H (P) 4S (P) 5C (P)'
    assert 'relative_stub' in flags


def test_hazard_cross_reference_is_note_not_generated_cards():
    r = parse(root_rows()+[table_row('4♦','wymyślone',60),row('Tak jak (5♣) - pas - (5♦) transfer.',100)])
    assert len(r['cards']) == 1 and len(r['cards'][0]['notes']) == 1


def test_hazard_duplicate_identity_suffix_and_context():
    r = parse(root_rows()+[table_row('4♦','a',60),row('4♣ - ?',100),table_row('4♦','b',130)])
    assert r['cards'][1]['cardKey'].endswith('#2')
    assert 'duplicate_key' in r['cards'][1]['reviewFlags']


def test_unknown_auction_retains_every_call_line_and_counts_unattached():
    r = parse([table_row('4♦','a',60),table_row('4♥','b',80)])
    assert r['stats']['lines'] == r['stats']['detectedCallLines'] == r['stats']['unattachedLines'] == 2
    assert r['cards'][0]['auction'] == []
    assert 'unknown_auction' in r['cards'][0]['reviewFlags']


def test_empty_meaning_and_unknown_label_are_not_dropped():
    r = parse(root_rows()+[table_row('4♦','',60),table_row('1step','fikcyjne',80)])
    assert r['stats']['lines'] == 2
    assert {'unknown_token','empty_meaning','line_count_mismatch'} <= set(r['cards'][0]['reviewFlags'])


def test_no_separator_label_and_notes_across_pages():
    assert line_candidate(table_row('5♦','tekst',60,dash=False))[0] == '5♦'
    r = parse(root_rows()+[table_row('5♦','a',60),table_row('','b',40,page=2,dash=False)])
    assert r['cards'][0]['lines'][0]['meaning'] == 'a\nb'


def test_body_sentence_never_resets_opening_title():
    r = parse([row('OTWARCIE 4♣'),row('OPIS OTWARCIA'),row('Otwarcie zawiera tekst wymyślony.'),
               row('ZESTAWIENIE PIERWSZYCH ODPOWIEDZI'),table_row('4♦','a',100)])
    assert r['cards'][0]['auctionKey'] == '4C (P)'
    assert 'unknown_auction' not in r['cards'][0]['reviewFlags']


def test_separate_call_annotation_on_stub_row():
    calls,flags,_,_ = parse_stub([row('4♣ - (pas) - 4♦ - (ktr) ktr = testowe'),row('?')])
    assert calls[-1]['qualifier'] == 'testowe'
    assert 'unknown_auction' not in flags


def test_annotation_after_question_is_qualifier_not_context():
    calls,flags,context,_ = parse_stub([row('(3NT) - X - (pass/xx) - ? pass/xx = F')])
    assert calls[-1]['qualifier'] == 'F' and not context
    assert not flags


def test_prose_after_question_separator_and_unknown_named_call():
    r = parse([row('4♣ - (4♦)'),row('? - warunek fikcyjny'),table_row('inne','tekst',100)])
    assert r['cards'][0]['context'] == 'warunek fikcyjny'
    assert r['cards'][0]['lines'][0]['label'] == 'inne'
    assert 'unknown_token' in r['cards'][0]['reviewFlags']


def test_leading_passes_use_x_positions_not_first_filled_cell():
    first = Row(1,0,[Word(190,50,210,60,'pas'),Word(230,50,235,60,'-'),Word(250,50,280,60,'(pas)')])
    second = Row(1,1,[Word(70,70,85,80,'4♣'),Word(100,70,105,80,'-'),Word(130,70,150,80,'(pas)'),
        Word(170,70,175,80,'-'),Word(190,70,210,80,'4♦'),Word(230,70,235,80,'-'),Word(250,70,280,80,'(ktr)')])
    calls,flags,_,_ = parse_stub([first,second,row('?',90,x=70)])
    assert auction_key(calls) == 'P (P) 4C (P) 4D (X)'
    assert not flags


def test_explicit_root_after_leading_pass_never_duplicates_header():
    first = Row(1,0,[Word(250,50,275,60,'pass')])
    second = Row(1,1,[Word(70,70,105,80,'(3NT)'),Word(115,70,120,80,'-'),
        Word(130,70,155,80,'pass'),Word(175,70,180,80,'-'),Word(190,70,215,80,'(5♣)'),
        Word(235,70,240,80,'-'),Word(250,70,260,80,'?')])
    calls,flags,_,_ = parse_stub([first,second],[w('3NT')])
    assert sum(c['alts']==['3NT'] for c in calls) == 1
    assert auction_key(calls) == 'P (3NT) P (5C)'
    assert 'relative_stub' not in flags


def test_category_revision_matching_and_catalog_rows():
    catalog = json.loads(Path('tools/importer/categories.json').read_text(encoding='utf-8'))
    assert len(catalog) == 14 and len({c['slug'] for c in catalog}) == 14
    for meta in catalog:
        mapped = category_for(meta['prefix']+'_rev2099.pdf')
        assert mapped['slug'] == meta['slug'] and mapped['revision'] == 'rev2099'


def test_independent_audit_recovers_glued_separator_without_losing_source():
    r = parse([row('4♦-wariant wymyślony')])
    assert r['stats']['recoveredByAudit'] == 1
    assert r['stats']['unattachedLines'] == 1
    assert r['cards'][0]['lines'][0]['label'] == '4♦'
    assert len(r['audit']['rows']) == 1


def test_meaning_before_first_label_is_flagged_and_preserved():
    r = parse(root_rows()+[table_row('','tekst bez etykiety',50,dash=False),table_row('4♦','tekst',70)])
    assert 'line_count_mismatch' in r['cards'][0]['reviewFlags']
    assert 'tekst bez etykiety' in r['cards'][0]['notes']


def test_large_card_and_same_call_repeats_keep_stable_keys():
    r = parse(root_rows()+[table_row('4♦',f'wariant {i}',60+i*14,index=i+2) for i in range(31)])
    c = r['cards'][0]
    assert len(c['lines']) == 31 and 'suspicious_length' in c['reviewFlags']
    assert c['lines'][1]['key'] == '4D#2' and c['lines'][-1]['key'] == '4D#31'


def test_contexts_produce_distinct_keys_without_duplicate_flag():
    r = parse([row('4♣ - ? WARUNEK A'),table_row('4♦','a',70),row('4♣ - ? WARUNEK B'),table_row('4♦','b',170)])
    assert r['cards'][0]['cardKey'] != r['cards'][1]['cardKey']
    assert all('duplicate_key' not in c['reviewFlags'] for c in r['cards'])


def test_html_escapes_content_and_has_no_remote_dependencies(tmp_path):
    r = parse(root_rows()+[table_row('4♦','<script>alert(1)</script>',60)])
    r['stats']['pages'] = 1
    write_review(r,tmp_path)
    html = (tmp_path/'review/fictional.html').read_text(encoding='utf-8')
    assert '<script>' not in html and '&lt;script&gt;' in html
    assert 'https://' not in html and 'http://' not in html
    assert '../pages/fictional/p001.png' in html
