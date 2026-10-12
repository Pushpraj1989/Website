#!/usr/bin/env python3
"""Second-language tables for a site (see build/i18n.py).

  python3 tools/i18n.py extract <slug> [--lang ar] [--chunks N]
      writes data/i18n/<slug>.strings.json (every translatable string) and, with --chunks,
      data/i18n/work/<slug>.<n>.json pieces of about N characters for translators.
  python3 tools/i18n.py merge <slug> [--lang ar]
      merges data/i18n/work/<slug>.<n>.<lang>.json into data/i18n/<slug>.<lang>.json
  python3 tools/i18n.py missing <slug> [--lang ar]
      lists strings that still have no translation.
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "build"))
import i18n  # noqa: E402

D = ROOT / "data" / "i18n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["extract", "merge", "missing"])
    ap.add_argument("slug")
    ap.add_argument("--lang", default="ar")
    ap.add_argument("--chunks", type=int, default=0)
    a = ap.parse_args()
    D.mkdir(parents=True, exist_ok=True)
    data = json.loads((ROOT / "data" / f"{a.slug}.json").read_text(encoding="utf-8"))
    strings = i18n.extract(data)
    table_p = D / f"{a.slug}.{a.lang}.json"
    table = json.loads(table_p.read_text(encoding="utf-8")) if table_p.exists() else {}
    if a.cmd == "extract":
        (D / f"{a.slug}.strings.json").write_text(json.dumps(strings, ensure_ascii=False, indent=1), encoding="utf-8")
        print(a.slug, len(strings), "strings,", sum(map(len, strings)), "characters,", sum(1 for s in strings if s in table), "already translated")
        if a.chunks:
            (D / "work").mkdir(exist_ok=True)
            todo = [s for s in strings if s not in table]
            n, cur, size = 0, [], 0
            for s in todo + [None]:
                if s is None or (size + len(s) > a.chunks and cur):
                    if cur:
                        (D / "work" / f"{a.slug}.{n}.json").write_text(json.dumps(cur, ensure_ascii=False, indent=1), encoding="utf-8")
                        n += 1
                    cur, size = [], 0
                if s is not None:
                    cur.append(s); size += len(s)
            print("chunks:", n)
    elif a.cmd == "merge":
        for p in sorted((D / "work").glob(f"{a.slug}.*.{a.lang}.json")):
            part = json.loads(p.read_text(encoding="utf-8"))
            table.update({k: v for k, v in part.items() if isinstance(v, str) and v.strip()})
        table_p.write_text(json.dumps(table, ensure_ascii=False, indent=1), encoding="utf-8")
        print(a.slug, len(table), "translations;", sum(1 for s in strings if s not in table), "missing")
    else:
        miss = [s for s in strings if s not in table]
        print(json.dumps(miss, ensure_ascii=False, indent=1))
        print(len(miss), "missing", file=sys.stderr)


if __name__ == "__main__":
    main()
