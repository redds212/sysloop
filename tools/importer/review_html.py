"""Escaped, self-contained local review pages. No CDN, scripts or network requests."""
from html import escape
from pathlib import Path


def write_review(result, root):
    category = result['category']; slug = category['slug']
    pages = []
    for page in range(1,result['stats']['pages']+1):
        cards = []
        for card in result['cards']:
            if card['sourcePage'] != page:
                continue
            rows = ''.join(f'<tr><th>{escape(line["label"])}</th><td>{escape(line["meaning"])}</td></tr>' for line in card['lines'])
            flags = ' · '.join(card['reviewFlags']) or 'Brak flag — wymaga weryfikacji'
            cards.append(f'<article id="card-{card["sortOrder"]}"><small>#{card["sortOrder"]+1} · {escape(flags)}</small>'
                f'<h3>{escape(card["auctionKey"] or "Nieustalona sekwencja")}</h3><p>{escape(card.get("context",""))}</p>'
                f'<p>{escape(card["section"])}</p><table>{rows}</table>'
                f'<p class="notes">{escape(chr(10).join(card["notes"]))}</p><p>{escape(card.get("auctionNote",""))}</p></article>')
        pages.append(f'<section id="p{page}"><h2>Strona {page}</h2><div class="spread">'
            f'<a href="../pages/{slug}/p{page:03}.png"><img loading="lazy" src="../pages/{slug}/p{page:03}.png" alt="Strona PDF {page}"></a>'
            f'<div>{"".join(cards) or "Brak początku karty na tej stronie. Sprawdź kontynuację poprzedniej."}</div></div></section>')
    prose = ''.join(f'<h3>{escape(n["title"])}</h3><p class="notes">{escape(n["body"])}</p>' for n in category['notes'])
    html = f'''<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' file:; style-src 'unsafe-inline'; base-uri 'none'">
<title>{escape(category['name'])} — przegląd importu</title><style>
body{{font-family:system-ui,sans-serif;margin:24px;background:#0b1220;color:#e8edf5}}h1,h2{{color:#34d399}}
.spread{{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}}img{{width:100%;height:auto}}
article{{background:#131c2e;border:1px solid #334155;border-radius:12px;padding:18px;margin-bottom:16px}}
small{{color:#fbbf24}}table{{width:100%;border-collapse:collapse}}th{{width:64px;text-align:left;vertical-align:top}}
td,th{{padding:8px;border-bottom:1px solid #334155;white-space:pre-wrap}}.notes{{white-space:pre-wrap}}a{{color:#34d399}}
@media(max-width:900px){{.spread{{grid-template-columns:1fr}}}}section{{margin-bottom:40px}}
</style><h1>{escape(category['name'])}</h1><p>Surowy wynik parsera. Żadna karta nie jest jeszcze zatwierdzona.</p>
<p>{result['stats']['cards']} kart · {result['stats']['lines']} odzywek · {result['stats']['flaggedCards']} kart z flagami</p>
<nav>{' · '.join(f'<a href="#p{p}">{p}</a>' for p in range(1,result['stats']['pages']+1))}</nav>
{''.join(pages)}<h2>Notatki kategorii</h2>{prose}</html>'''
    folder = Path(root)/'review'; folder.mkdir(parents=True,exist_ok=True)
    (folder/f'{slug}.html').write_text(html,encoding='utf-8')
