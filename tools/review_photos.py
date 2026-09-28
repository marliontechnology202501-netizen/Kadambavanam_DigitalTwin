"""Build local-only contact sheets for identifying architectural reference photos."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(r"D:\Kadambavanam_Analysis")
OUT = Path(r"D:\Kadambavanam_DigitalTwin\.cache\review")
OUT.mkdir(parents=True, exist_ok=True)
CAT = json.loads((ROOT / "data/catalogue.json").read_text())
GROUPS = {
    "campus": ["cultural centre campus", "BANQUET SPACES", "cultural centre as a venue"],
    "restaurant": ["/restaurant"],
    "cottages": ["/units", "resort related pics", "A few more pics"],
    "temple": ["TEMPLE COMPLEX"],
    "construction": ["pics during cons"],
    "context": ["MOST IMPORTANT PICS", "@ For Review", "Views _ 1@", "views from and towards site", "swimming pool"],
}
font = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 15)
for name, folders in GROUPS.items():
    items = [r for r in CAT if r.get("preview", "").startswith("previews/")
             and any(f.lower() in r["folder"].lower() for f in folders)]
    for offset in range(0, len(items), 30):
        batch = items[offset:offset+30]
        sheet = Image.new("RGB", (1500, 1240), "white")
        draw = ImageDraw.Draw(sheet)
        draw.text((12, 8), f"{name} / {offset+1}-{offset+len(batch)}", font=font, fill="black")
        for i, row in enumerate(batch):
            x, y = (i % 5)*300, (i // 5)*200+35
            im = Image.open(ROOT/row["preview"]).convert("RGB")
            im.thumbnail((288, 167))
            sheet.paste(im, (x+(300-im.width)//2, y))
            draw.text((x+6, y+169), row["id"]+" "+Path(row["relative_path"]).name[:24], font=font, fill="black")
        sheet.save(OUT/f"{name}_{offset//30+1:02}.jpg", quality=88)
    print(name, len(items))
