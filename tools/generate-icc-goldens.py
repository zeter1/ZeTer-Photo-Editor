#!/usr/bin/env python3
"""Regenerate Stage 13e LittleCMS golden vectors.

Maintenance-only tool. Use a controlled environment:
    python -m pip install Pillow==12.3.0
    python tools/generate-icc-goldens.py
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageCms, __version__ as PILLOW_VERSION

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests" / "fixtures" / "color-management"
SOURCE = FIXTURES / "CGATS001Compat-v2-micro.icc"
DISPLAY = FIXTURES / "DisplayP3-v4.icc"
OUTPUT = FIXTURES / "lcms-2.19-golden.json"
D50 = (0.9642, 1.0, 0.8249)
SAMPLES = [
    ("paper-white", (0, 0, 0, 0)),
    ("rich-black", (255, 255, 255, 255)),
    ("cyan", (255, 0, 0, 0)),
    ("magenta", (0, 255, 0, 0)),
    ("yellow", (0, 0, 255, 0)),
    ("print-mid", (64, 128, 192, 26)),
    ("shadow-mix", (32, 64, 96, 128)),
    ("light-neutral", (10, 20, 30, 40)),
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def image_pixels(image: Image.Image) -> list[tuple[int, int, int]]:
    return [tuple(map(int, value)) for value in image.getdata()]


def lab_to_xyz(l_value: float, a_value: float, b_value: float) -> list[float]:
    delta = 6 / 29
    fy = (l_value + 16) / 116
    fx = fy + a_value / 500
    fz = fy - b_value / 200

    def inverse(value: float) -> float:
        return value**3 if value > delta else 3 * delta * delta * (value - 4 / 29)

    return [D50[0] * inverse(fx), D50[1] * inverse(fy), D50[2] * inverse(fz)]


def convert(source_profile, destination_profile, mode: str, image: Image.Image):
    transform = ImageCms.buildTransformFromOpenProfiles(
        source_profile,
        destination_profile,
        "CMYK",
        mode,
        renderingIntent=0,
        flags=0,
    )
    return image_pixels(ImageCms.applyTransform(image, transform))


def main() -> None:
    source_profile = ImageCms.getOpenProfile(str(SOURCE))
    display_profile = ImageCms.getOpenProfile(str(DISPLAY))
    srgb_profile = ImageCms.createProfile("sRGB")
    lab_profile = ImageCms.createProfile("LAB")

    image = Image.new("CMYK", (len(SAMPLES), 1))
    image.putdata([sample for _, sample in SAMPLES])

    srgb_values = convert(source_profile, srgb_profile, "RGB", image)
    p3_values = convert(source_profile, display_profile, "RGB", image)
    lab8_values = convert(source_profile, lab_profile, "LAB", image)

    vectors = []
    for index, (name, cmyk) in enumerate(SAMPLES):
        l8, a8, b8 = lab8_values[index]
        lab = [l8 * 100 / 255, a8 - 128, b8 - 128]
        vectors.append(
            {
                "id": name,
                "cmyk8": list(cmyk),
                "lab8": [l8, a8, b8],
                "lab": [round(value, 6) for value in lab],
                "xyzD50": [round(value, 6) for value in lab_to_xyz(*lab)],
                "srgb8": list(srgb_values[index]),
                "displayP3_8": list(p3_values[index]),
            }
        )

    payload = {
        "schemaVersion": 1,
        "reference": {
            "engine": "LittleCMS",
            "version": ImageCms.core.littlecms_version,
            "pillow": PILLOW_VERSION,
            "renderingIntent": "perceptual",
            "flags": 0,
            "labEncoding": "Pillow/LittleCMS 8-bit Lab; L*=L8*100/255, a*=a8-128, b*=b8-128",
            "xyzDerivation": "Lab8 decoded then CIELAB→XYZ D50 using ICC PCS white (0.9642,1,0.8249)",
        },
        "profiles": {
            "source": {"file": SOURCE.name, "sha256": sha256(SOURCE)},
            "display": {"file": DISPLAY.name, "sha256": sha256(DISPLAY)},
        },
        "vectors": vectors,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)} using LittleCMS {ImageCms.core.littlecms_version}")


if __name__ == "__main__":
    main()
