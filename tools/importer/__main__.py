"""Only aggregate counts go to stdout; private payloads stay in data/."""
import argparse
from pathlib import Path
import json
import sys
from .parse import parse_file, category_for


def main():
    parser = argparse.ArgumentParser(description='Lokalny importer SysLoop')
    sub = parser.add_subparsers(dest='command',required=True)
    one = sub.add_parser('parse'); one.add_argument('file',type=Path)
    sub.add_parser('parse-all')
    args = parser.parse_args()
    files = [args.file] if args.command == 'parse' else sorted(Path('sys files').glob('*.pdf'))
    if not files:
        parser.error('Nie znaleziono plików PDF')
    # Do not silently overwrite two revisions of one category in parse-all.
    slugs = [category_for(path)['slug'] for path in files]
    if len(set(slugs)) != len(slugs):
        parser.error('Kilka rewizji tej samej kategorii: użyj parse dla wybranego pliku')
    summary = []
    print('category | cards | lines | flagged | flag counts | unattached',flush=True)
    for path in files:
        result = parse_file(path)
        row = {'category':result['category']['slug'],**result['stats']}
        summary.append(row)
        flags = ', '.join(f'{key}={n}' for key,n in row['flags'].items()) or '-'
        print(f"{row['category']} | {row['cards']} | {row['lines']} | {row['flaggedCards']} | {flags} | {row['unattachedLines']}",flush=True)
    if args.command == 'parse-all':
        Path('data').mkdir(exist_ok=True)
        Path('data/parse-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(f"TOTAL | {sum(r['cards'] for r in summary)} | {sum(r['lines'] for r in summary)} | {sum(r['flaggedCards'] for r in summary)} | | {sum(r['unattachedLines'] for r in summary)}",flush=True)


if __name__ == '__main__':
    try:
        main()
    except (ValueError,RuntimeError,OSError) as error:
        # No traceback containing PDF fragments or credentials.
        print(f'Import przerwany: {type(error).__name__}. Sprawdź lokalne pliki i konfigurację.',file=sys.stderr)
        sys.exit(1)
