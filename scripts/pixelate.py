from collections import deque
from pathlib import Path
import argparse
import base64
import io
import json
import math
from PIL import Image, ImageDraw, ImageFilter, ImageStat


def remove_backdrop(source):
    pixels = source.load()
    width, height = source.size
    background = Image.new("L", source.size, 255)
    mask = background.load()
    pending = deque()

    def enqueue(horizontal, vertical):
        if not 0 <= horizontal < width or not 0 <= vertical < height:
            return
        if mask[horizontal, vertical] == 0:
            return
        red, green, blue = pixels[horizontal, vertical][:3]
        if min(red, green, blue) >= 175 and max(red, green, blue) - min(red, green, blue) < 22:
            mask[horizontal, vertical] = 0
            pending.append((horizontal, vertical))

    for horizontal in range(width):
        enqueue(horizontal, 0)
        enqueue(horizontal, height - 1)
    for vertical in range(height):
        enqueue(0, vertical)
        enqueue(width - 1, vertical)
    while pending:
        horizontal, vertical = pending.popleft()
        enqueue(horizontal - 1, vertical)
        enqueue(horizontal + 1, vertical)
        enqueue(horizontal, vertical - 1)
        enqueue(horizontal, vertical + 1)
    source.putalpha(background)
    for vertical in range(round(height * 0.94), height):
        for horizontal in range(width):
            red, green, blue, alpha = pixels[horizontal, vertical]
            if alpha and min(red, green, blue) > 110 and max(red, green, blue) - min(red, green, blue) < 25:
                pixels[horizontal, vertical] = (red, green, blue, 0)
    return source


def warp_region(source, region, mapping):
    cropped = source.crop(region)
    width, height = cropped.size
    mesh = []
    for top in range(0, height, 2):
        for left in range(0, width, 2):
            right = min(left + 2, width)
            bottom = min(top + 2, height)
            corners = [mapping(left, top), mapping(left, bottom), mapping(right, bottom), mapping(right, top)]
            mesh.append(((left, top, right, bottom), tuple(value for point in corners for value in point)))
    warped = cropped.transform(cropped.size, Image.Transform.MESH, mesh, Image.Resampling.BICUBIC)
    result = source.copy()
    result.paste(warped, region[:2])
    return result


def smiling_face(source, strength=4.0, stretch=1.28, openness=0.5):
    region = (340, 460, 420, 540)

    def mapping(horizontal, vertical):
        offset_horizontal = horizontal - 40
        offset_vertical = vertical - 40
        envelope = max(0, 1 - (offset_horizontal / 40) ** 2) ** 3 * max(0, 1 - (offset_vertical / 40) ** 2) ** 3
        source_horizontal = offset_horizontal / (1 + (stretch - 1) * envelope)
        curve = strength * (1 - 2 * (source_horizontal / 10) ** 2) * envelope
        source_vertical = (offset_vertical - curve) / (1 + (openness - 1) * envelope)
        return 40 + source_horizontal, 40 + source_vertical

    return warp_region(source, region, mapping)


def closed_eyes(source):
    result = source.copy()
    skin = source.crop((350, 408, 414, 477)).filter(ImageFilter.GaussianBlur(8))
    for left, sample_left in [(229, 330), (393, 414)]:
        region = (left, 365, left + 137, 488)
        texture = skin.resize((137, 123), Image.Resampling.BICUBIC)
        top_color = ImageStat.Stat(source.crop((350, 398, 364, 410))).mean
        bottom_color = ImageStat.Stat(source.crop((sample_left, 476, sample_left + 12, 484))).mean
        average = ImageStat.Stat(texture).mean
        texture_pixels = texture.load()
        for vertical in range(123):
            progress = vertical / 122
            for horizontal in range(137):
                original_color = texture_pixels[horizontal, vertical]
                texture_pixels[horizontal, vertical] = tuple(round(max(0, min(255,
                    top_color[channel] * (1 - progress) + bottom_color[channel] * progress
                    + (original_color[channel] - average[channel]) * 0.35
                    - 5 * math.sin(math.pi * progress)
                ))) for channel in range(3))
        mask = Image.new("L", texture.size)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.polygon([(7, 29), (18, 16), (50, 8), (91, 13), (119, 28), (128, 56), (113, 91), (88, 110), (47, 110), (21, 90), (9, 60)], fill=255)
        original = source.crop(region)
        original_pixels = original.load()
        coverage = mask.load()
        for vertical in range(60):
            for horizontal in range(137):
                red, green, blue = original_pixels[horizontal, vertical]
                if red < 120 and red > green * 1.3 and red > blue * 1.3:
                    coverage[horizontal, vertical] = 255
        eyelid = Image.composite(texture, original, mask.filter(ImageFilter.GaussianBlur(3)))
        hair_mask = Image.new("L", texture.size)
        hair_pixels = hair_mask.load()
        pending = deque()

        def preserve_hair(horizontal, vertical):
            if not 0 <= horizontal < 137 or not 0 <= vertical < 123 or hair_pixels[horizontal, vertical]:
                return
            colors = original_pixels[horizontal, vertical]
            maximum = max(colors)
            saturation = (maximum - min(colors)) / max(1, maximum)
            if (maximum < 170 and saturation < 0.5) or (maximum < 235 and saturation < 0.12):
                hair_pixels[horizontal, vertical] = 255
                pending.append((horizontal, vertical))

        for horizontal in range(137):
            preserve_hair(horizontal, 0)
        for vertical in range(123):
            preserve_hair(0, vertical)
            preserve_hair(136, vertical)
        while pending:
            horizontal, vertical = pending.popleft()
            for delta_horizontal, delta_vertical in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                preserve_hair(horizontal + delta_horizontal, vertical + delta_vertical)
        eyelid = Image.composite(original, eyelid, hair_mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.7)))
        result.paste(eyelid, region[:2])
    lashes = Image.new("RGBA", source.size)
    drawing = ImageDraw.Draw(lashes)
    for left in [259, 422]:
        points = [(left + offset, 433 + 8 * math.sin(math.pi * offset / 80)) for offset in range(81)]
        drawing.line(points, fill=(72, 39, 31, 235), width=3)
        drawing.line([(left, 433), (left - 4, 430)], fill=(72, 39, 31, 210), width=2)
        drawing.line([(left + 80, 433), (left + 84, 430)], fill=(72, 39, 31, 210), width=2)
    result = Image.alpha_composite(result.convert("RGBA"), lashes.filter(ImageFilter.GaussianBlur(0.45)))
    return result.convert("RGB")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "assets")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    raw = args.source.read_bytes()
    if raw.startswith(b"/9j/") or raw.startswith(b"iVBOR"):
        raw = base64.b64decode(raw, validate=True)
    reference = Image.open(io.BytesIO(raw)).convert("RGB")
    if raw.startswith(b"\xff\xd8"):
        (args.output / "reference.jpg").write_bytes(raw)
    else:
        reference.save(args.output / "reference.jpg", quality=94)
    reference = reference.resize((2048, 1143), Image.Resampling.LANCZOS)
    smile = smiling_face(reference)
    happy = smiling_face(reference, strength=6.0, stretch=1.7, openness=0.85)
    eating = smiling_face(reference, strength=4.2, stretch=1.12, openness=0.3)
    masters = {"front": reference, "smile": smile, "happy": happy, "eating": eating,
               "sleep": closed_eyes(reference), "blink": closed_eyes(smile), "side": reference, "back": reference}
    regions = {"front": (85, 72, 688, 1028), "side": (756, 76, 1293, 1027), "back": (1357, 74, 1966, 1028)}
    masks = {name: remove_backdrop(reference.crop(region).convert("RGBA")).getchannel("A") for name, region in regions.items()}
    tiles = {}
    for name, master in masters.items():
        angle = name if name in ["side", "back"] else "front"
        cutout = master.crop(regions[angle]).convert("RGBA")
        cutout.putalpha(masks[angle])
        cutout = cutout.crop(masks[angle].getbbox())
        cutout.thumbnail((188, 288), Image.Resampling.LANCZOS)
        tile = Image.new("RGBA", (224, 320))
        tile.alpha_composite(cutout, ((224 - cutout.width) // 2, 308 - cutout.height))
        tiles[name] = tile
    for name, tile in tiles.items():
        tile.save(args.output / f"{name}.png")
    preview = Image.new("RGB", (1008, 552), "#f1eee8")
    for index, tile in enumerate([tiles["smile"], tiles["side"], tiles["back"]]):
        enlarged = tile.resize((336, 480), Image.Resampling.LANCZOS)
        preview.paste(enlarged, (index * 336, 28), enlarged)
    preview.save(args.output / "character-preview.png")
    expressions_preview = Image.new("RGB", (896, 352), "#f1eee8")
    for index, name in enumerate(["smile", "happy", "eating", "sleep"]):
        expressions_preview.paste(tiles[name], (index * 224, 16), tiles[name])
    expressions_preview.save(args.output / "expressions-preview.png")
    face_comparison = Image.new("RGB", (1008, 272), "#f1eee8")
    for index, master in enumerate([reference, smile, happy]):
        face = master.crop((215, 335, 550, 560))
        face_comparison.paste(face, (index * 336, 24))
    face_comparison.save(args.output / "face-comparison.png")
    sleep_comparison = Image.new("RGB", (672, 272), "#f1eee8")
    for index, master in enumerate([reference, masters["sleep"]]):
        sleep_comparison.paste(master.crop((215, 335, 550, 560)), (index * 336, 24))
    sleep_comparison.save(args.output / "sleep-comparison.png")
    (args.output / "provenance.json").write_text(json.dumps({"source": "项目维护者提供的企鹅服小朋友三视图，源文件为 assets/reference.jpg", "method": "原图嘴部局部几何形变、原图肤色纹理构造闭合眼睑与睫毛、透明抠底与统一缩放", "logicalSize": [224, 320], "aiGenerated": False}, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
