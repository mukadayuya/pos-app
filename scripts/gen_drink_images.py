#!/usr/bin/env python3
"""Generate drink images via Pollinations.ai (free, no API key needed)."""
import urllib.request, urllib.parse, time, sys
from pathlib import Path

OUT_DIR = Path(__file__).parent.parent / "public" / "gyoza-images"
OUT_DIR.mkdir(parents=True, exist_ok=True)

DRINKS = [
    ("beer",       "cold Japanese draft beer in tall glass golden amber foam white head condensation izakaya restaurant close up food photography"),
    ("oolong-hai", "Japanese oolong shochu highball cocktail dark amber tea with ice cubes lemon slice highball glass izakaya drink close up photo"),
    ("lemon-sour", "Japanese frozen lemon sour cocktail pale yellow slushy crushed ice lemon slice tall glass izakaya drink close up photo"),
    ("highball",   "Japanese whisky highball tall glass ice cubes golden amber bubbles dark background bar close up food photography"),
    ("oolong-tea", "iced oolong tea tall glass deep amber brown ice cubes condensation Japanese restaurant close up drink photo"),
    ("cola",       "cola glass ice cubes dark brown carbonated bubbles condensation clean restaurant presentation close up photo"),
]

for name, prompt in DRINKS:
    out_path = OUT_DIR / f"drink-{name}.jpg"
    if out_path.exists():
        print(f"  SKIP {name}")
        continue
    print(f"  Generating {name}...", flush=True)
    encoded = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{encoded}?width=600&height=600&model=flux&nologo=true&seed={abs(hash(name))%9999}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = resp.read()
        with open(out_path, "wb") as f:
            f.write(data)
        size_kb = len(data) // 1024
        print(f"    OK -> {out_path.name} ({size_kb}KB)")
        time.sleep(2)
    except Exception as e:
        print(f"    FAILED: {e}")
        sys.exit(1)

print("\nAll done.")
