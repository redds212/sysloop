"""Rows reconstructed by y-position, never PDF extraction order."""
from collections import Counter
from dataclasses import dataclass
import re


@dataclass(frozen=True)
class Word:
    x0: float
    y0: float
    x1: float
    y1: float
    text: str


@dataclass
class Row:
    page: int
    index: int
    words: list[Word]

    @property
    def text(self):
        return " ".join(w.text for w in self.words).strip()

    @property
    def x(self):
        return self.words[0].x0

    @property
    def y(self):
        return min(w.y0 for w in self.words)

    @property
    def ref(self):
        return f"p{self.page}:r{self.index}"


def group_rows(words, page=1, tolerance=3.0):
    """Use top positions; symbols and baseline shifts can differ by a few points."""
    words = [w if isinstance(w, Word) else Word(*w[:5]) for w in words]
    groups = []
    for word in sorted(words, key=lambda w: (w.y0, w.x0)):
        if not word.text.strip():
            continue
        if groups and abs(word.y0 - groups[-1][0].y0) <= tolerance:
            groups[-1].append(word)
        else:
            groups.append([word])
    return [Row(page, i, sorted(group, key=lambda w: w.x0)) for i, group in enumerate(groups)]


def strip_noise(pages):
    """Repeated mixed-case top headers; low lone page numbers. Preserve real headings."""
    top_counts = Counter(row.text for rows, _ in pages for row in rows[:2])
    kept, removed = [], []
    for rows, height in pages:
        for i, row in enumerate(rows):
            header = i < 2 and row.y < height * .25 and (
                re.search(r"licytacja (jednostronna|dwustronna|obronna)", row.text, re.I)
                or (top_counts[row.text] > 2 and not row.text.isupper()
                    and row.text.startswith(('Otwarcie ', 'Obrona ', 'Wejścia '))))
            footer = i == len(rows) - 1 and row.text.isdigit() and row.y > height * .75
            (removed if header or footer else kept).append(row)
    return kept, removed


def split_cells(row):
    """Separators are geometric cells; empty cells retain their seat index."""
    cells = [[]]
    for word in row.words:
        if word.text in ('-', '–', '—', '−'):
            cells.append([])
        elif re.match(r'^[?)-]+-$', word.text) or re.match(r'^\?[-–]$', word.text):
            head = word.text.rstrip('-–')
            if head:
                cells[-1].append(Word(word.x0, word.y0, word.x1, word.y1, head))
            cells.append([])
        else:
            cells[-1].append(word)
    return cells


def cell_text(cell):
    return ' '.join(w.text for w in cell).strip()
