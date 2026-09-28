# Kadambavanam Digital Twin Reference Library

Static, mobile-friendly building reference library. No Unreal assets are included or changed.

Planned GitHub Pages address (available only after publication and Pages setup): https://marliontechnology202501-netizen.github.io/Kadambavanam_DigitalTwin/

## Contents

- 11 main documented modelling families and 2 additional proposed families.
- A View page for every family with photo, drawing, site-plan and document galleries.
- Cropped and full-context location images derived from the user-supplied concept plan.
- Existing, under-construction, proposed and unverified archive-status categories.
- Original DWG/PDF downloads, medium-quality web photographs and source SHA256 hashes.
- Shared and candidate photographs clearly distinguished from matched references.

This is a dated evidence register, not a current as-built survey. Cottage design-to-photo matching remains provisional. Different layouts use different item numbers. The source screenshot is 777 x 553 pixels; its crops are not georeferenced boundaries.

## Hosting

The site has no build or server dependency. Enable GitHub Pages under Settings > Pages, deploy from branch `main`, folder `/ (root)`. All site paths are relative and work under this repository's Pages subpath. Opening `index.html` locally also works.

## Development

Run `npm ci` and `npm test`. `vendor/lucide.min.js` is the pinned Lucide 0.468.0 browser distribution; its license is included.

Generated web data is checked in. To regenerate against the local source archive, install Pillow and run:

```powershell
python tools/build_site.py --archive 'D:\Kadambavanam' --audit 'D:\Kadambavanam_Analysis' --plan 'PATH_TO_ORIGINAL_SUPPLIED_SCREENSHOT.png'
```

Source inputs remain read-only. The builder checks hashes against the earlier inventory and stops if an original changes. Photo derivatives have a 1400-pixel longest edge; no AI upscaling is used. Original drawings and PDFs are copied byte-for-byte. Local review sheets and omitted-source lists remain under ignored `.cache/`.

## Publication Scope

The owner requested public publication of original DWGs/PDFs and building-reference photos. Unrelated event, food, promotional and external-resort inspiration images are excluded. The collection is expanded from themed folders and visual review; uncertain subtype matches remain shared references, not verified assignments. Sources retain their owners' existing rights; this repository does not grant a blanket license to the architectural or photographic material.
