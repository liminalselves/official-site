"""Build a single Noto Serif SC 600 woff2 containing only the characters used on the site.

Run after changing page copy: python scripts/subset-font.py
Requires: fonttools, brotli (pip install fonttools brotli)
"""
import io
import pathlib
import sys

from fontTools import subset
from fontTools.merge import Merger
from fontTools.ttLib import TTFont

sys.stdout.reconfigure(encoding="utf-8")

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHARDS = ROOT / "node_modules/@fontsource/noto-serif-sc/files"
OUT = ROOT / "public/fonts/noto-serif-sc-600.woff2"

text = "".join(
    p.read_text(encoding="utf-8")
    for root in (ROOT / "src", ROOT / "sites")
    for p in root.rglob("*")
    if p.suffix in {".astro", ".ts"}
)
chars = {c for c in text if ord(c) > 0x7F} | {chr(c) for c in range(0x20, 0x7F)}
chars |= set("，。、：；！？「」『』“”‘’（）《》·—…")
codepoints = {ord(c) for c in chars}

parts = []
covered = set()
for shard in sorted(SHARDS.glob("noto-serif-sc-*-600-normal.woff2")):
    font = TTFont(shard)
    have = codepoints & set(font.getBestCmap()) - covered
    if not have:
        continue
    covered |= have
    opts = subset.Options()
    opts.flavor = None
    opts.layout_features = ["*"]
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=have)
    sub.subset(font)
    buf = io.BytesIO()
    font.save(buf)
    buf.seek(0)
    parts.append(buf)

if not parts:
    sys.exit("no shard matched; run npm install first")

merged = Merger().merge(parts) if len(parts) > 1 else TTFont(parts[0])
merged.flavor = "woff2"
OUT.parent.mkdir(parents=True, exist_ok=True)
merged.save(OUT)

missing = sorted(chr(c) for c in codepoints - covered if not chr(c).isspace())
print(f"{OUT.relative_to(ROOT)}: {OUT.stat().st_size // 1024} KB, {len(covered)} glyphs from {len(parts)} shards")
if missing:
    print("not in font:", "".join(missing))
