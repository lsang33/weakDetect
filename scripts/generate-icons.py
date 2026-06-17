"""Generate PWA icons with text for '上岸' app"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

BLUE = (59, 130, 246)   # #3B82F6
WHITE = (255, 255, 255)

def create_icon(size: int, out_path: str):
    img = Image.new('RGB', (size, size), BLUE)
    draw = ImageDraw.Draw(img)

    # 圆角效果靠留白模拟，在中心画文字
    text = "上岸"
    font_size = int(size * 0.45)

    # macOS 中文字体
    font_paths = [
        '/System/Library/Fonts/PingFang.ttc',
        '/System/Library/Fonts/STHeiti Light.ttc',
        '/System/Library/Fonts/Hiragino Sans GB.ttc',
        '/Library/Fonts/Arial Unicode.ttf',
    ]
    font = None
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, font_size)
                break
            except:
                continue
    if font is None:
        font = ImageFont.load_default()

    # 计算文字居中位置
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) / 2
    y = (size - th) / 2 - int(size * 0.02)

    draw.text((x, y), text, fill=WHITE, font=font)
    img.save(out_path, 'PNG')
    print(f'  {out_path} ({os.path.getsize(out_path)} bytes)')

if __name__ == '__main__':
    out_dir = sys.argv[1] if len(sys.argv) > 1 else 'dist'
    for size in [192, 512]:
        create_icon(size, os.path.join(out_dir, f'icon-{size}.png'))
