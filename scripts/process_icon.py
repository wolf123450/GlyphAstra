"""
process_icon.py — Prepare Glyph Astra icon for Tauri

Usage:
  python scripts/process_icon.py                     # pure black on transparent
  python scripts/process_icon.py --color "#2a7fff"   # custom hex foreground color
  python scripts/process_icon.py --color blue        # named color
  python scripts/process_icon.py --threshold 180     # tune black/white split (0-255, default 128)
  python scripts/process_icon.py --no-generate       # skip `tauri icon` step

Output: public/icon-master.png  (1024×1024, RGBA, transparent background)
Then runs: npx tauri icon public/icon-master.png
which writes all required icons into src-tauri/icons/
"""

import argparse
import subprocess
import sys
from pathlib import Path
from typing import Optional

try:
    from PIL import Image, ImageOps
except ImportError:
    print("Pillow not found. Install it with:  pip install Pillow")
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "Glyph_Astra.png"
MASTER = ROOT / "public" / "icon-master.png"
SIZE = 1024


def parse_color(value: str) -> tuple[int, int, int]:
    """Parse a hex (#rrggbb) or named color string to (r, g, b)."""
    from PIL import ImageColor
    r, g, b = ImageColor.getrgb(value)[:3]
    return r, g, b


def process(source: Path, threshold: int, color: Optional[str]) -> Image.Image:
    img = Image.open(source).convert("L")          # to greyscale
    img = ImageOps.autocontrast(img)               # stretch contrast first

    # Threshold: pixels below threshold → 0 (ink), above → 255 (background)
    img = img.point(lambda p: 0 if p < threshold else 255)

    # Convert to RGBA so we can set alpha channel
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size

    if color:
        fr, fg, fb = parse_color(color)
    else:
        fr, fg, fb = 0, 0, 0   # default: black ink

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if r >= 128:          # white → transparent
                pixels[x, y] = (255, 255, 255, 0)
            else:                 # black → foreground color, fully opaque
                pixels[x, y] = (fr, fg, fb, 255)

    # Resize to 1024×1024 with high-quality downscaling
    rgba = rgba.resize((SIZE, SIZE), Image.LANCZOS)
    return rgba


def main():
    ap = argparse.ArgumentParser(description="Process Glyph Astra source icon.")
    ap.add_argument("--source",    default=str(SOURCE), help="Source PNG path")
    ap.add_argument("--out",       default=str(MASTER),  help="Output master PNG path")
    ap.add_argument("--threshold", type=int, default=128,
                    help="Grey threshold for binarisation (0-255, default 128)")
    ap.add_argument("--color",     default=None,
                    help="Foreground color e.g. '#2a7fff' or 'blue' (default: black)")
    ap.add_argument("--no-generate", action="store_true",
                    help="Skip running 'tauri icon' after processing")
    args = ap.parse_args()

    src = Path(args.source)
    if not src.exists():
        print(f"Source not found: {src}")
        sys.exit(1)

    print(f"Processing {src.name}  threshold={args.threshold}  color={args.color or 'black'}")
    img = process(src, args.threshold, args.color)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG")
    print(f"Saved master icon → {out}  ({img.size[0]}×{img.size[1]} RGBA)")

    if not args.no_generate:
        print("\nRunning: npx tauri icon ...")
        result = subprocess.run(
            ["npx", "tauri", "icon", str(out)],
            cwd=str(ROOT),
            shell=True,
        )
        if result.returncode == 0:
            print("\nAll icon sizes written to src-tauri/icons/")
        else:
            print(f"\ntauri icon exited with code {result.returncode}")
            sys.exit(result.returncode)


if __name__ == "__main__":
    main()
