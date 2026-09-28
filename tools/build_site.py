"""Generate a portable reference library from the read-only Kadambavanam archive."""
import argparse
import hashlib
import json
import re
import shutil
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

HERE = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--archive", type=Path, default=Path(r"D:\Kadambavanam"))
parser.add_argument("--audit", type=Path, default=Path(r"D:\Kadambavanam_Analysis"))
parser.add_argument("--plan", type=Path, required=True)
args = parser.parse_args()
catalogue = json.loads((args.audit / "data/catalogue.json").read_text())
cat = {r["id"]: r for r in catalogue}
register = json.loads((args.audit / "Building_Types/building_types.json").read_text())
for folder in (".cache", "data", "assets/photos", "assets/thumbs", "assets/plans", "assets/docs", "assets/crops"):
    (HERE / folder).mkdir(parents=True, exist_ok=True)


def ids(spec):
    result = set()
    for token in spec.split():
        a, _, b = token.partition("-")
        result.update(f"F{n:04d}" for n in range(int(a), int(b or a) + 1))
    return result


PHOTO_SETS = {
    "B01": ids("281 283-295 298-299 301-305 312-316 321-323 329 333-341 344-348 351-355 368-372 375-377 380-381 396-402 406-407 1855 1857"),
    "B02": ids("317-320 326-328 331-332 385-390 395"),
    "B03": set(),
    "B04": ids("391-394"),
    "B05": ids("297 324 342-343 349-350 356-367 373-374 384 403-405 1856"),
    "B06": ids("99-101 106-107 109-128 131 136 138-142 145 157-158 1050 1060 1062-1065 1074-1075 1077-1079 1081-1088 1101-1104 1107-1128 1135-1154 1160-1165 1167 1171-1175 1860-1864 1867"),
    "B07": ids("1046-1048"),
    "B08": set(),
    "B09": set(), "B10": set(), "B11": set(), "P01": set(), "P02": set(),
}
COTTAGES = ids("809 1051-1056 1062-1063 1066-1069 1858-1859")
SHARED_CONSTRUCTION = set()
POOL_CONTEXT = set()
for row in catalogue:
    folder = row["folder"].lower()
    if not row.get("preview", "").startswith("previews/"):
        continue
    if "/temple complex" in folder:
        PHOTO_SETS["B03"].add(row["id"])
    if "/units" in folder and row["id"] not in ids("1486 1495 1509"):
        COTTAGES.add(row["id"])
    if "pics during cons" in folder:
        SHARED_CONSTRUCTION.add(row["id"])
    if "/swimming pool" in folder:
        POOL_CONTEXT.add(row["id"])

# Exact-byte duplicates elsewhere in the archive are retained as provenance aliases.
STATUS = {
    "B01": ("existing", "Existing in archive", "2024 brochure p.18 and auditorium photographs document the facility. Present-day condition has not been surveyed."),
    "B02": ("existing", "Existing in archive", "2024 brochure p.18 and dining-pavilion photographs document the facility. Kitchen dimensions and present-day condition remain unverified."),
    "B03": ("existing", "Existing in archive", "2024 brochure p.18 and temple photographs document the shrine complex. Individual shrine variants remain to be reconciled."),
    "B04": ("existing", "Existing in archive", "F0391-F0394 show campus sanitary-building exteriors and washroom interiors. Exact correspondence of each photographed block to the plan remains to be checked."),
    "B05": ("unverified", "Status unverified", "The plan names a ticket kiosk. Entry and booth photographs are candidates, not a proven match to that specific kiosk."),
    "B06": ("existing", "Existing in archive", "Restaurant and banquet-space photographs document completed spaces. The campus plan identifies the restaurant/conference complex."),
    "B07": ("construction", "Under construction / 2024", "The September 2024 brochure p.31 explicitly says the Health Centre is under construction. Equipment photos do not prove completion of this building."),
    "B08": ("unverified", "Status unverified", "Named only in the JPEG layout (item 9). The attached PDF-style plan does not separately label it; the crop shows pool-side context, not a confirmed footprint."),
    "B09": ("unverified", "Status unverified", "Detailed Premium-unit drawings exist. The brochure's 15 operational and 14 under-construction cottages are not broken down by these named design families."),
    "B10": ("construction", "Construction archive / provisional", "The Pool view Units construction folder documents unfinished multi-level units, but also contains circular units and completed cottages. Exact design-to-photo and current status remain provisional."),
    "B11": ("construction", "Construction archive / provisional", "Round units are visibly under construction in F1925, F1971, F1982-F1985 and F2005/F2013-F2016. Matching them to the selected Circular-unit DWG revision is still provisional."),
    "P01": ("future", "Future / proposed", "Explicitly labelled Proposed Craft Production Sheds in the supplied plan (item 1). No completion evidence has been matched."),
    "P02": ("future", "Future / proposed", "Explicitly labelled Proposed Crafts Bazaar & Museum in the supplied plan (item 5). No completion evidence has been matched."),
}
LOCATIONS = {
    "B01": ([297, 282, 394, 347], "3", "Auditorium footprint on the supplied concept plan."),
    "B02": ([229, 234, 303, 297], "2", "Kitchen and dining pavilion complex on the supplied concept plan."),
    "B03": ([231, 402, 282, 499], "6", "Temple row along the southwest boundary."),
    "B04": ([315, 202, 349, 245], "4", "Washroom zone; repeated blocks may require separate variants."),
    "B05": ([418, 389, 460, 426], "8", "Ticket-kiosk location in the supplied concept plan; photograph match pending."),
    "B06": ([668, 163, 727, 262], "14", "Restaurant and conference complex at the eastern side of the resort."),
    "B07": ([581, 362, 673, 422], "10", "Health-block zone along the southern resort boundary."),
    "B08": ([574, 191, 679, 278], "Pool context", "Pool-side context only. Changing-room footprint is not separately labelled in this attached plan."),
    "B09": ([494, 169, 714, 443], "11 / zone", "Shared cottage zone only. Premium-unit placements have not been matched to this plan."),
    "B10": ([510, 171, 716, 342], "11 / zone", "Cottages around the pool: candidate zone only, not a verified Pool-view-unit placement."),
    "B11": ([545, 290, 641, 374], "11 / candidate", "Round plan symbols are visible here. Their link to the Circular-unit detailed drawing is provisional."),
    "P01": ([210, 300, 277, 351], "1", "Proposed craft-production sheds near the western entrance."),
    "P02": ([327, 209, 389, 253], "5", "Proposed crafts bazaar/museum near the washrooms."),
}
BROCHURE_PAGES = {"B01": [18], "B02": [18], "B03": [18], "B06": [14, 15, 16],
                  "B07": [31], "B09": [13], "B10": [13], "B11": [13]}
DWGS = {"B07": {"F1900": "CAD02", "F1901": "CAD03", "F1902": "CAD04"},
        "B09": {"F2021": "CAD09", "F2022": "CAD10", "F2023": "CAD11"},
        "B10": {"F1911": "CAD07", "F2020": "CAD08"}, "B11": {"F1897": "CAD01"}}
sources, assets, aliases, errors = {}, {}, {}, []
for row in catalogue:
    aliases.setdefault(row["sha256"], []).append({"id": row["id"], "path": row["relative_path"]})


def verify(fid):
    row = cat[fid]
    if fid not in sources:
        path = args.archive / row["relative_path"]
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != row["sha256"]:
            raise ValueError(f"Archive changed since inventory: {fid}")
        sources[fid] = {"id": fid, "path": row["relative_path"], "sha256": digest,
                        "bytes": row["bytes"], "aliases": aliases[digest]}
    return row


def make_image(source, name, kind="photos"):
    dst = HERE / f"assets/{kind}/{name}.webp"
    thumb = HERE / f"assets/thumbs/{name}.webp"
    if not dst.exists() or not thumb.exists():
        with Image.open(source) as original:
            im = ImageOps.exif_transpose(original).convert("RGB")
            im.thumbnail((1400, 1400), Image.Resampling.LANCZOS)
            im.save(dst, quality=76, method=2)
            im.thumbnail((480, 360), Image.Resampling.LANCZOS)
            im.save(thumb, quality=72, method=1)
    return dst.relative_to(HERE).as_posix(), thumb.relative_to(HERE).as_posix()


def photo(fid):
    if fid in assets:
        return fid
    row = verify(fid)
    preview, thumb = make_image(args.archive / row["relative_path"], fid)
    assets[fid] = {"id": fid, "source": fid, "title": Path(row["relative_path"]).name,
                   "kind": "photo", "preview": preview, "thumb": thumb,
                   "download": preview, "downloadLabel": "Download web photo",
                   "width": row.get("width"), "height": row.get("height")}
    return fid


def document(fid, cad=None):
    if fid in assets:
        return fid
    row = verify(fid)
    original = args.archive / row["relative_path"]
    dest = HERE / "assets/docs" / (fid + "_" + re.sub(r"[^a-zA-Z0-9_.-]+", "_", original.name))
    shutil.copy2(original, dest)
    if cad:
        src = args.audit / f"cad_review/{cad}.png"
        if not src.exists():
            src = args.audit / f"cad_review/{cad}_preview.jpg"
    else:
        src = args.audit / f"pdf_pages/{fid}_01.jpg"
    preview, thumb = make_image(src, fid, "plans")
    assets[fid] = {"id": fid, "source": fid, "title": original.name,
                   "kind": "dwg" if cad else "document", "preview": preview, "thumb": thumb,
                   "download": dest.relative_to(HERE).as_posix(),
                   "downloadLabel": "Download original " + ("DWG" if cad else "PDF"),
                   "note": "Derived CAD preview; conversion reported warnings. Original DWG is authoritative." if cad else "Original document retained byte-for-byte."}
    return fid


def page_asset(number):
    ident = f"F1903-p{number}"
    if ident not in assets:
        document("F1903")
        preview, thumb = make_image(args.audit / f"pdf_pages/F1903_{number:02}.jpg", ident, "plans")
        assets[ident] = {"id": ident, "source": "F1903", "title": f"September 2024 brochure / page {number}",
                         "kind": "document", "preview": preview, "thumb": thumb,
                         "download": assets["F1903"]["download"] + f"#page={number}",
                         "downloadLabel": "Open brochure page", "page": number}
    return ident


plan = Image.open(args.plan).convert("RGB")
shutil.copy2(args.plan, HERE / "assets/plans/supplied-site-plan.png")
PLAN_WIDTH, PLAN_HEIGHT = plan.size
assert (PLAN_WIDTH, PLAN_HEIGHT) == (777, 553), f"Unexpected attached-plan size: {plan.size}"


def make_crop(bid, box):
    x1, y1, x2, y2 = box
    marked = plan.copy()
    draw = ImageDraw.Draw(marked)
    draw.rectangle(box, outline="#c12e4c", width=3)
    marked.save(HERE / f"assets/crops/{bid}-overview.png")
    cx, cy = (x1+x2)/2, (y1+y2)/2
    w, h = max(x2-x1+50, 130), max(y2-y1+50, 100)
    w, h = max(w, h*1.5), max(h, w/1.5)
    left, top = max(0, min(PLAN_WIDTH-w, cx-w/2)), max(0, min(PLAN_HEIGHT-h, cy-h/2))
    crop = marked.crop((int(left), int(top), int(left+w), int(top+h)))
    crop.save(HERE / f"assets/crops/{bid}.png")
    return {"crop": f"assets/crops/{bid}.png", "overview": f"assets/crops/{bid}-overview.png",
            "box": box, "cropBox": [int(left), int(top), int(left+w), int(top+h)]}


document("F1907")
document("F1903")
document("F1904", "CAD05")
document("F1906", "CAD06")
photo("F1908")
photo("F1909")
buildings = []
for t in register["types"]:
    bid = t["id"]
    refs = []
    seen = set()

    def add(aid, relation, note=""):
        key = (aid, relation)
        if key not in seen:
            refs.append({"asset": aid, "relation": relation, "note": note})
            seen.add(key)

    for fid in sorted(PHOTO_SETS[bid]):
        if fid not in cat or not cat[fid].get("preview"):
            continue
        relation = "candidate" if bid in ("B05", "B07") else "matched"
        add(photo(fid), relation, "Entry / equipment context; exact building match is unverified." if relation == "candidate" else "Architectural reference identified in the themed archive and contact-sheet review.")
    if bid in ("B09", "B10", "B11"):
        for fid in sorted(COTTAGES):
            add(photo(fid), "shared", "Existing cottage reference. Not conclusively matched to this named design family.")
        for fid in sorted(SHARED_CONSTRUCTION):
            add(photo(fid), "shared", "Mixed cottage-construction archive, including circular and multi-level units. Exact subtype match is unverified.")
    if bid == "B08":
        for fid in sorted(POOL_CONTEXT):
            add(photo(fid), "context", "Pool-side context. Does not confirm the changing-room building identity.")
    for fid, cid in DWGS.get(bid, {}).items():
        add(document(fid, cid), "matched", "Dedicated architectural drawing set.")
    for fid in ("F1907", "F1908", "F1909", "F1904", "F1906"):
        add(fid, "site", "Shared site plan. Different revisions use different item numbers.")
    for n in BROCHURE_PAGES.get(bid, []):
        add(page_asset(n), "document", "Historical brochure evidence; not a current site survey.")
    proof_names = {"B09": "premium_cad.png", "B10": "pool_view_cad.png", "B11": "circular_cad.png"}
    if bid in proof_names:
        name = bid + "-cad-detail"
        preview, thumb = make_image(args.audit / "Building_Types/proof" / proof_names[bid], name, "plans")
        fid = {"B09": "F2022", "B10": "F2020", "B11": "F1897"}[bid]
        assets[name] = {"id": name, "source": fid, "title": t["name"] + " / selected drawing detail",
                        "kind": "plan", "preview": preview, "thumb": thumb,
                        "download": assets[fid]["download"], "downloadLabel": "Download original DWG",
                        "note": "Selected geometry rendered from the converted DXF. Not a certified survey."}
        refs.insert(0, {"asset": name, "relation": "matched", "note": assets[name]["note"]})
    status, status_label, status_note = STATUS[bid]
    box, number, location_note = LOCATIONS[bid]
    loc = make_crop(bid, box)
    loc.update({"item": number, "note": location_note,
                "certainty": "Context / provisional" if bid in ("B08", "B09", "B10", "B11") else "Named on concept plan"})
    cover = {"B01": "F0312", "B02": "F0395", "B03": "F1442", "B04": "F0393", "B05": "F0404",
             "B06": "F1112", "B07": "F1901", "B08": "F1908", "B09": "B09-cad-detail",
             "B10": "F1913", "B11": "B11-cad-detail", "P01": "F1907", "P02": "F1907"}[bid]
    buildings.append({"id": bid, "name": t["name"], "scope": t["scope"],
                      "area": "Cultural centre" if bid in ("B01", "B02", "B03", "B04", "B05", "P01", "P02") else "Ethnic resort",
                      "status": status, "statusLabel": status_label, "statusNote": status_note,
                      "statusCurrentVerified": False, "location": loc, "refs": refs,
                      "cover": cover, "countingRule": t["counting_rule"], "limitation": t["limitation"],
                      "evidence": t["evidence"]})
    print(bid, len(refs), flush=True)

for key, source in sources.items():
    source["includedOriginal"] = bool(assets.get(key, {}).get("kind") in ("dwg", "document"))

data = {"version": 2, "updated": "2026-09-28", "title": "Kadambavanam",
        "buildings": buildings, "assets": assets, "sources": sources,
        "plan": {"path": "assets/plans/supplied-site-plan.png", "width": PLAN_WIDTH, "height": PLAN_HEIGHT,
                 "sha256": hashlib.sha256(args.plan.read_bytes()).hexdigest(), "source": "User-supplied layout screenshot, 28 September 2026"},
        "coverage": {"archiveFiles": len(catalogue), "publishedSourceFiles": len(sources),
                     "webPhotos": sum(a["kind"] == "photo" for a in assets.values()),
                     "originalDWGs": sum(a["kind"] == "dwg" for a in assets.values()),
                     "originalPDFs": sum(a["kind"] == "document" and not a.get("page") for a in assets.values()),
                     "statusCounts": dict(Counter(b["status"] for b in buildings)),
                     "notes": ["All 11 DWGs and both PDFs are included. Building photos are published as medium-quality 1400-pixel web derivatives; originals remain in the local archive.",
                               "Building and related-detail photographs were expanded from themed folders and visual contact-sheet review. Unrelated food, event and promotional material is not published.",
                               "Shared cottage photographs are deliberately associated with all three cottage families without asserting a subtype match. This creates shared references, not additional source files.",
                               "The Pool view Units construction folder also contains circular units. Folder membership alone does not prove a Pool-view-unit match.",
                               "The Aleenta / Phuket inspiration folder is not evidence of Kadambavanam and is excluded from the public building galleries.",
                               "The source screenshot is only 777 x 553 pixels. Location crops do not add detail or establish survey-accurate footprints.",
                               "Status describes dated archive evidence. No family has a verified current as-built status."]}}
(HERE / "data/library.json").write_text(json.dumps(data, indent=2), encoding="utf-8")
(HERE / "data/library.js").write_text("window.KDV_LIBRARY=" + json.dumps(data, separators=(",", ":")) + ";\n", encoding="utf-8")
published = set(sources)
(HERE / ".cache/coverage-local.json").write_text(json.dumps({"published": sorted(published), "notPublished": [r["id"] for r in catalogue if r["id"] not in published]}, indent=2))
print(json.dumps(data["coverage"], indent=2))
