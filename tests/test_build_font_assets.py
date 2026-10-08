"""Offline regressions for the maintenance-only embedded-font generator."""

from __future__ import annotations

import importlib.util
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock


SCRIPT = Path(__file__).resolve().parents[1] / "tools" / "build-font-assets.py"


def load_generator():
    # CI does not install fontTools; the test replaces the conversion boundary.
    fake_font_tools = types.ModuleType("fontTools")
    fake_ttf = types.ModuleType("fontTools.ttLib")
    fake_ttf.TTFont = object
    with mock.patch.dict(sys.modules, {"fontTools": fake_font_tools, "fontTools.ttLib": fake_ttf}):
        spec = importlib.util.spec_from_file_location("zeter_font_asset_builder", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    return module


class FontAssetBuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.builder = load_generator()
        self.builder.ROOT = self.root
        self.builder.FONT_ROOT = self.root / "assets" / "fonts"
        self.builder.FAMILIES = {
            "alpha": ("ZPE Alpha", [("normal", "400", "Alpha-Regular.ttf")]),
            "beta": ("ZPE Beta", [("italic", "700", "Beta-Italic.ttf")]),
        }

    def test_failed_later_download_leaves_all_existing_css_unchanged(self):
        alpha = self.builder.FONT_ROOT / "alpha" / "embedded.css"
        beta = self.builder.FONT_ROOT / "beta" / "embedded.css"
        alpha.parent.mkdir(parents=True)
        beta.parent.mkdir(parents=True)
        alpha.write_bytes(b"old alpha font bytes\n")
        beta.write_bytes(b"old beta font bytes\n")

        def download(folder, filename):
            if folder == "beta":
                raise OSError("offline during later family")
            return b"ttf"

        with mock.patch.object(self.builder, "download_ttf", side_effect=download), \
             mock.patch.object(self.builder, "to_woff2", return_value=b"wOF2"), \
             mock.patch("builtins.print"):
            with self.assertRaisesRegex(OSError, "offline during later family"):
                self.builder.main()

        self.assertEqual(alpha.read_bytes(), b"old alpha font bytes\n")
        self.assertEqual(beta.read_bytes(), b"old beta font bytes\n")

    def test_failed_later_conversion_leaves_existing_css_unchanged(self):
        alpha = self.builder.FONT_ROOT / "alpha" / "embedded.css"
        alpha.parent.mkdir(parents=True)
        alpha.write_text("original alpha\n", encoding="utf-8")

        def convert(payload):
            if payload == b"beta ttf":
                raise ValueError("cannot convert second family")
            return b"wOF2"

        with mock.patch.object(self.builder, "download_ttf", side_effect=lambda folder, _: (folder + " ttf").encode()), \
             mock.patch.object(self.builder, "to_woff2", side_effect=convert), \
             mock.patch("builtins.print"):
            with self.assertRaisesRegex(ValueError, "cannot convert second family"):
                self.builder.main()

        self.assertEqual(alpha.read_text(encoding="utf-8"), "original alpha\n")
        self.assertFalse((self.builder.FONT_ROOT / "beta").exists())

    def test_success_writes_every_family_after_preparing_all(self):
        downloaded = []

        def download(folder, filename):
            downloaded.append((folder, filename))
            # Check whether a pre-existing family was overwritten too early.
            self.assertFalse((self.builder.FONT_ROOT / "alpha" / "embedded.css").exists())
            return b"ttf"

        with mock.patch.object(self.builder, "download_ttf", side_effect=download), \
             mock.patch.object(self.builder, "to_woff2", return_value=b"wOF2"), \
             mock.patch("builtins.print"):
            self.builder.main()

        self.assertEqual(downloaded, [("alpha", "Alpha-Regular.ttf"), ("beta", "Beta-Italic.ttf")])
        for folder, name in [("alpha", "ZPE Alpha"), ("beta", "ZPE Beta")]:
            css = (self.builder.FONT_ROOT / folder / "embedded.css").read_text(encoding="utf-8")
            self.assertIn(f"font-family: '{name}'", css)
            self.assertIn("data:font/woff2;base64,d09GMg==", css)
            self.assertTrue(css.endswith("\n"))


if __name__ == "__main__":
    unittest.main()
