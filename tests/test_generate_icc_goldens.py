"""Regressions for the pinned LittleCMS reference-vector generator.

Run: python3 -m unittest discover -s tests -p 'test_generate_icc_goldens.py'
Requires Pillow; it does not fetch fonts or rewrite golden fixtures.
"""

from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest import mock


GENERATOR_PATH = Path(__file__).resolve().parents[1] / "tools" / "generate-icc-goldens.py"
SPEC = importlib.util.spec_from_file_location("generate_icc_goldens", GENERATOR_PATH)
generator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(generator)


class IccGoldenToolchainTest(unittest.TestCase):
    def test_pinned_versions_are_accepted(self):
        self.assertIsNone(generator.verify_reference_toolchain("12.3.0", "2.19"))

    def assert_rejected_before_read_or_write(self, pillow_version, lcms_version):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "lcms-2.19-golden.json"
            output.write_text("known-good-golden", encoding="utf-8")
            with (
                mock.patch.object(generator, "OUTPUT", output),
                mock.patch.object(generator, "PILLOW_VERSION", pillow_version),
                mock.patch.object(generator.ImageCms.core, "littlecms_version", lcms_version),
                mock.patch.object(generator.ImageCms, "getOpenProfile") as open_profile,
            ):
                with self.assertRaisesRegex(RuntimeError, "ICC goldens require"):
                    generator.main()
                open_profile.assert_not_called()
            self.assertEqual(output.read_text(encoding="utf-8"), "known-good-golden")

    def test_wrong_littlecms_does_not_replace_golden(self):
        self.assert_rejected_before_read_or_write("12.3.0", "2.20")

    def test_wrong_pillow_does_not_replace_golden(self):
        self.assert_rejected_before_read_or_write("12.4.0", "2.19")


if __name__ == "__main__":
    unittest.main()
