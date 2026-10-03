# -*- coding: utf-8 -*-
"""绘制 TopoGo 应用图标：围棋盘 + 黑白双子 + 拓扑接缝箭头，输出多尺寸 .ico。"""
import math
import os
from PIL import Image, ImageDraw

S = 2048  # 超采样画布
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets")
os.makedirs(OUT_DIR, exist_ok=True)

BG = (24, 34, 54, 255)          # 深蓝石板
BG2 = (36, 50, 76, 255)
BOARD = (222, 172, 92, 255)     # 棋盘木色
LINE = (96, 66, 28, 255)        # 棋盘线
TEAL = (45, 199, 190, 255)      # 接缝箭头
BLACK = (18, 18, 22, 255)
WHITE = (245, 244, 238, 255)

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)


def rounded_rect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


# ---- 背景：圆角方块 + 轻微纵向渐变 ----
for y in range(S):
    t = y / S
    c = tuple(int(BG[i] + (BG2[i] - BG[i]) * t) for i in range(3)) + (255,)
    d.line([(0, y), (S, y)], fill=c)
# 圆角裁切
mask = Image.new("L", (S, S), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=255)
img.putalpha(mask)
d = ImageDraw.Draw(img)

# ---- 棋盘（内嵌圆角方块） ----
m = int(S * 0.14)                    # 棋盘外边距
board_box = [m, m, S - m, S - m]
rounded_rect(d, board_box, int(S * 0.06), BOARD)

# 网格 5x5（4 路视觉，粗细保证小尺寸可读）
n_lines = 5
pad = int(S * 0.10)                  # 棋盘内边距
x0, y0 = m + pad, m + pad
x1, y1 = S - m - pad, S - m - pad
step = (x1 - x0) / (n_lines - 1)
lw = int(S * 0.012)
for i in range(n_lines):
    p = x0 + i * step
    d.line([(p, y0), (p, y1)], fill=LINE, width=lw)
    d.line([(x0, p), (x1, p)], fill=LINE, width=lw)


def stone(cx, cy, r, base, hi):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=base)
    # 高光
    hr = r * 0.55
    d.ellipse([cx - hr, cy - hr * 1.15, cx + hr * 0.2, cy - hr * 0.15], fill=hi)


r_stone = step * 0.46
# 黑子（左上）、白子（右下）——对角呼应
bx, by = x0 + step * 1, y0 + step * 1
wx, wy = x0 + step * 3, y0 + step * 3
stone(bx, by, r_stone, BLACK, (70, 70, 82, 255))
stone(wx, wy, r_stone, WHITE, (255, 255, 255, 255))

# ---- 拓扑接缝箭头：上缘与右缘的青色弧形箭头（示意对边粘合） ----
aw = int(S * 0.018)  # 箭头线宽


def arc_arrow(cx, cy, r, a0, a1, draw):
    bbox = [cx - r, cy - r, cx + r, cy + r]
    draw.arc(bbox, start=a0, end=a1, fill=TEAL, width=aw)
    # 箭头头部（在 a1 处沿切线方向）
    rad = math.radians(a1)
    tipx = cx + r * math.cos(rad)
    tipy = cy + r * math.sin(rad)
    tang = rad + math.pi / 2  # 逆时针切向
    al = aw * 4.2
    for sgn in (+1, -1):
        ax = tipx - al * math.cos(tang + sgn * 0.5)
        ay = tipy - al * math.sin(tang + sgn * 0.5)
        draw.line([(tipx, tipy), (ax, ay)], fill=TEAL, width=aw)


# 右上角一段弧箭头（横接缝）与左下角一段弧箭头（纵接缝）
arc_arrow(int(S * 0.80), int(S * 0.20), int(S * 0.085), 150, 285, d)
arc_arrow(int(S * 0.20), int(S * 0.80), int(S * 0.085), -30, 105, d)

# ---- 输出多尺寸 ----
png_path = os.path.join(OUT_DIR, "topogo-icon.png")
img.resize((256, 256), Image.LANCZOS).save(png_path)

ico_path = os.path.join(OUT_DIR, "topogo.ico")
sizes = [(s, s) for s in (16, 24, 32, 48, 64, 128, 256)]
img.save(ico_path, format="ICO", sizes=sizes)
print("OK:", ico_path, png_path)
