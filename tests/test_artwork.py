from pathlib import Path
import importlib.util
import unittest
from PIL import Image, ImageChops, ImageStat


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("pet_artwork", ROOT / "scripts/pixelate.py")
ARTWORK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ARTWORK)


class ArtworkTests(unittest.TestCase):
    def test_sleep_eyelids_cover_the_original_irises(self):
        source = Image.open(ROOT / "assets/reference.jpg").convert("RGB").resize((2048, 1143), Image.Resampling.LANCZOS)
        sleeping = ARTWORK.closed_eyes(source)
        for region in [(280, 405, 324, 425), (440, 405, 484, 425)]:
            red, green, blue = ImageStat.Stat(sleeping.crop(region)).mean
            self.assertGreater(red, 170)
            self.assertGreater(red - green, 12)
            self.assertGreater(green - blue, 8)

    def test_smile_preserves_original_eyes_and_surrounding_face(self):
        source = Image.open(ROOT / "assets/reference.jpg").convert("RGB").resize((2048, 1143), Image.Resampling.LANCZOS)
        smiling = ARTWORK.smiling_face(source)
        for region in [(255, 375, 339, 470), (421, 375, 508, 470)]:
            self.assertEqual(source.crop(region).tobytes(), smiling.crop(region).tobytes())
        bounds = ImageChops.difference(source, smiling).getbbox()
        self.assertIsNotNone(bounds)
        self.assertGreaterEqual(bounds[0], 340)
        self.assertGreaterEqual(bounds[1], 460)
        self.assertLessEqual(bounds[2], 420)
        self.assertLessEqual(bounds[3], 540)

    def test_expression_frames_share_silhouette_and_body_colors(self):
        neutral = Image.open(ROOT / "assets/front.png").convert("RGBA")
        for name in ["smile", "happy", "eating", "sleep", "blink"]:
            expression = Image.open(ROOT / f"assets/{name}.png").convert("RGBA")
            self.assertEqual(expression.size, (224, 320))
            self.assertEqual(neutral.getchannel("A").tobytes(), expression.getchannel("A").tobytes())
            bounds = ImageChops.difference(neutral.convert("RGB"), expression.convert("RGB")).getbbox()
            self.assertIsNotNone(bounds)
            self.assertGreaterEqual(bounds[0], 35)
            self.assertGreaterEqual(bounds[1], 95)
            self.assertLessEqual(bounds[2], 190)
            self.assertLessEqual(bounds[3], 165)


if __name__ == "__main__":
    unittest.main()
