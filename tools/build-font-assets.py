#!/usr/bin/env python3
"""Regenerate offline bundled WOFF2 font CSS from a pinned google/fonts commit."""

from __future__ import annotations

import base64
import io
import urllib.parse
import urllib.request
from pathlib import Path

from fontTools.ttLib import TTFont

GOOGLE_FONTS_COMMIT = "23e54b51ddffbc7713c583748e3bd86f62b1fa4a"
ROOT = Path(__file__).resolve().parents[1]
FONT_ROOT = ROOT / "assets" / "fonts"

FAMILIES = {
    "roboto": ("ZPE Roboto", [("normal", "400 700", "Roboto[wdth,wght].ttf"), ("italic", "400 700", "Roboto-Italic[wdth,wght].ttf")]),
    "opensans": ("ZPE Open Sans", [("normal", "400 700", "OpenSans[wdth,wght].ttf"), ("italic", "400 700", "OpenSans-Italic[wdth,wght].ttf")]),
    "montserrat": ("ZPE Montserrat", [("normal", "400 700", "Montserrat[wght].ttf"), ("italic", "400 700", "Montserrat-Italic[wght].ttf")]),
    "notosans": ("ZPE Noto Sans", [("normal", "400 700", "NotoSans[wdth,wght].ttf"), ("italic", "400 700", "NotoSans-Italic[wdth,wght].ttf")]),
    "notoserif": ("ZPE Noto Serif", [("normal", "400 700", "NotoSerif[wdth,wght].ttf"), ("italic", "400 700", "NotoSerif-Italic[wdth,wght].ttf")]),
    "rubik": ("ZPE Rubik", [("normal", "400 700", "Rubik[wght].ttf"), ("italic", "400 700", "Rubik-Italic[wght].ttf")]),
    "oswald": ("ZPE Oswald", [("normal", "400 700", "Oswald[wght].ttf")]),
    "ptsans": ("ZPE PT Sans", [
        ("normal", "400", "PT_Sans-Web-Regular.ttf"),
        ("normal", "700", "PT_Sans-Web-Bold.ttf"),
        ("italic", "400", "PT_Sans-Web-Italic.ttf"),
        ("italic", "700", "PT_Sans-Web-BoldItalic.ttf"),
    ]),
    "ptserif": ("ZPE PT Serif", [
        ("normal", "400", "PT_Serif-Web-Regular.ttf"),
        ("normal", "700", "PT_Serif-Web-Bold.ttf"),
        ("italic", "400", "PT_Serif-Web-Italic.ttf"),
        ("italic", "700", "PT_Serif-Web-BoldItalic.ttf"),
    ]),
    "lobster": ("ZPE Lobster", [("normal", "400", "Lobster-Regular.ttf")]),
    "manrope": ("ZPE Manrope", [("normal", "400 700", "Manrope[wght].ttf")]),
    "merriweather": ("ZPE Merriweather", [("normal", "400 700", "Merriweather[opsz,wdth,wght].ttf"), ("italic", "400 700", "Merriweather-Italic[opsz,wdth,wght].ttf")]),
}


def download_ttf(folder: str, filename: str) -> bytes:
    escaped = urllib.parse.quote(filename)
    url = f"https://raw.githubusercontent.com/google/fonts/{GOOGLE_FONTS_COMMIT}/ofl/{folder}/{escaped}"
    request = urllib.request.Request(url, headers={"User-Agent": "ZeTer-Photo-Editor-font-builder/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read()
    if not data.startswith(b"\x00\x01\x00\x00") and data[:4] != b"OTTO":
        raise RuntimeError(f"Unexpected font payload for {folder}/{filename}")
    return data


def to_woff2(ttf_data: bytes) -> bytes:
    font = TTFont(io.BytesIO(ttf_data), recalcTimestamp=False)
    font.flavor = "woff2"
    output = io.BytesIO()
    font.save(output, reorderTables=False)
    data = output.getvalue()
    if data[:4] != b"wOF2":
        raise RuntimeError("fontTools did not produce a WOFF2 payload")
    return data


def render_face(display_name: str, style: str, weight: str, payload: bytes) -> str:
    encoded = base64.b64encode(payload).decode("ascii")
    return (
        "@font-face {\n"
        f"  font-family: '{display_name}';\n"
        f"  font-style: {style};\n"
        f"  font-weight: {weight};\n"
        "  font-display: swap;\n"
        f"  src: url(\"data:font/woff2;base64,{encoded}\") format('woff2');\n"
        "}\n"
    )


def main() -> None:
    for folder, (display_name, faces) in FAMILIES.items():
        target_dir = FONT_ROOT / folder
        target_dir.mkdir(parents=True, exist_ok=True)
        chunks = [
            "/* Generated from google/fonts commit " + GOOGLE_FONTS_COMMIT + ". */",
            "/* cyrillic */",
            "/* latin */",
            "",
        ]
        for style, weight, filename in faces:
            woff2 = to_woff2(download_ttf(folder, filename))
            chunks.append(render_face(display_name, style, weight, woff2))
        target = target_dir / "embedded.css"
        target.write_text("\n".join(chunks).rstrip() + "\n", encoding="utf-8")
        print(f"generated {target.relative_to(ROOT)}")


if __name__ == "__main__":
    main()