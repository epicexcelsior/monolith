#!/usr/bin/env python3
"""Rebuild the image atlas: remove doge, add radiants + solana mobile."""

import base64
import re
import struct
import urllib.request
from pathlib import Path
from PIL import Image
import io

ATLAS_TS = Path(__file__).parent.parent / "apps/mobile/utils/image-atlas-data.ts"
CELL_W, CELL_H = 256, 256
COLS, ROWS = 3, 2
ATLAS_W, ATLAS_H = CELL_W * COLS, CELL_H * ROWS  # 768x512

# Slot layout (1-based, row-major):
# Slot 1=solana(0,0), 2=radiants(1,0), 3=quicknode(2,0), 4=toly(0,1), 5=mike(1,1), 6=solanamobile(2,1)

RADIANTS_URL = "https://cdn.prod.website-files.com/66e480f0e9eccea9c231ce92/68aa2db695c2d0f8539175f5_Radiants%20logo.png"
SOLANA_MOBILE_URL = "https://directus.messari.io/assets/de56f7a9-293a-4c94-bf8c-d532d48f083c"


def download_image(url: str, name: str) -> Image.Image:
    """Download image from URL and return as PIL Image."""
    print(f"  Downloading {name}...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    print(f"  Downloaded {len(data)} bytes for {name}")
    img = Image.open(io.BytesIO(data))
    # Convert to RGBA
    img = img.convert("RGBA")
    print(f"  {name}: {img.size[0]}x{img.size[1]}")
    return img


def fit_image_to_cell(img: Image.Image, bg_color=(20, 20, 30, 255)) -> Image.Image:
    """Resize image to fit in cell while maintaining aspect ratio, center on bg."""
    # Add padding so logos don't touch edges
    padding = 24
    target_w = CELL_W - padding * 2
    target_h = CELL_H - padding * 2

    w, h = img.size
    scale = min(target_w / w, target_h / h)
    new_w = int(w * scale)
    new_h = int(h * scale)

    # Use LANCZOS for high quality downscale
    resized = img.resize((new_w, new_h), Image.LANCZOS)

    # Create cell with dark background
    cell = Image.new("RGBA", (CELL_W, CELL_H), bg_color)

    # Center the image
    x = (CELL_W - new_w) // 2
    y = (CELL_H - new_h) // 2

    # Composite (handles alpha properly)
    cell.paste(resized, (x, y), resized)
    return cell


def decode_existing_atlas() -> Image.Image:
    """Read existing atlas from TS file and decode into PIL Image."""
    print("Reading existing atlas...")
    content = ATLAS_TS.read_text()

    # Extract base64 string
    match = re.search(r'ATLAS_DATA_BASE64\s*=\s*"([^"]+)"', content)
    if not match:
        raise ValueError("Could not find ATLAS_DATA_BASE64 in file")

    b64 = match.group(1)
    raw = base64.b64decode(b64)
    print(f"  Decoded {len(raw)} bytes ({ATLAS_W}x{ATLAS_H} RGBA = {ATLAS_W * ATLAS_H * 4} expected)")

    # The atlas is OpenGL-flipped (origin bottom-left), so row 0 in memory is the bottom row.
    # PIL expects origin top-left. We need to flip vertically.
    img = Image.frombytes("RGBA", (ATLAS_W, ATLAS_H), raw)
    img = img.transpose(Image.FLIP_TOP_BOTTOM)  # un-flip from OpenGL
    return img


def slot_to_pixel(slot_1based: int) -> tuple[int, int]:
    """Convert 1-based slot to top-left pixel coordinates (in normal top-left origin)."""
    idx = slot_1based - 1
    col = idx % COLS
    row = idx // COLS
    return col * CELL_W, row * CELL_H


def atlas_to_rgba_bytes(img: Image.Image) -> bytes:
    """Convert PIL image back to OpenGL-flipped RGBA bytes."""
    flipped = img.transpose(Image.FLIP_TOP_BOTTOM)
    return flipped.tobytes()


def main():
    # 1. Decode existing atlas
    atlas = decode_existing_atlas()

    # 2. Download new images
    radiants_img = download_image(RADIANTS_URL, "Radiants")
    solana_mobile_img = download_image(SOLANA_MOBILE_URL, "Solana Mobile")

    # 3. Fit to cells
    print("Fitting images to cells...")
    radiants_cell = fit_image_to_cell(radiants_img)
    solana_mobile_cell = fit_image_to_cell(solana_mobile_img)

    # 4. Replace slot 2 (doge → radiants)
    x2, y2 = slot_to_pixel(2)
    atlas.paste(radiants_cell, (x2, y2))
    print(f"  Replaced slot 2 (doge → radiants) at ({x2}, {y2})")

    # 5. Add slot 6 (solana mobile)
    x6, y6 = slot_to_pixel(6)
    atlas.paste(solana_mobile_cell, (x6, y6))
    print(f"  Added slot 6 (solana mobile) at ({x6}, {y6})")

    # 6. Convert to RGBA bytes (OpenGL-flipped)
    raw = atlas_to_rgba_bytes(atlas)
    b64 = base64.b64encode(raw).decode("ascii")
    print(f"  Atlas: {len(raw)} bytes → {len(b64)} base64 chars")

    # 7. Write new TS file
    ts_content = f'''// Auto-generated image atlas — 6 demo images in 3x2 grid (768x512 RGBA)
// Slot layout (1-based, row-major): 1=solana(0,0), 2=radiants(1,0), 3=quicknode(2,0), 4=toly(0,1), 5=mike(1,1), 6=solanamobile(2,1)
// OpenGL-flipped (origin at bottom-left)

export const ATLAS_WIDTH = {ATLAS_W};
export const ATLAS_HEIGHT = {ATLAS_H};
export const ATLAS_COLS = {COLS};
export const ATLAS_ROWS = {ROWS};
export const ATLAS_DATA_BASE64 = "{b64}";
'''
    ATLAS_TS.write_text(ts_content)
    print(f"  Wrote {ATLAS_TS}")

    # 8. Save debug preview
    debug_path = Path(__file__).parent / "atlas-preview.png"
    atlas.save(debug_path)
    print(f"  Saved debug preview to {debug_path}")

    print("\nDone! Updated slots:")
    print("  1=solana, 2=radiants, 3=quicknode, 4=toly, 5=mike, 6=solanamobile")


if __name__ == "__main__":
    main()
