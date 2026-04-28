# Changelog

## 0.3.0

Released: 2026-04-28

- Added bent wireframe flow routing with absolute turn steps such as `turns=down right` and sized steps such as `left*2` or `down:140`.
- Fixed wireframe render bounds so explicit left/up bends do not clip outside the SVG frame.
- Improved label placement to use real rendered path midpoints for graph edges and wireframe flows.
- Oriented curved-edge arrowheads from final curve tangents instead of coarse polyline segments.
- Added first-class style preset controls in the CLI (`--style`) and the web playground style picker.
- Expanded deterministic layout and renderer test coverage for presets, routing, and midpoint placement.
- Corrected package export condition ordering to remove `types` resolution warnings during builds.

## 0.2.0

Released: 2026-04-14

- Added first-pass `wireframe` mode for lo-fi UI sketches.
- Added indentation-based UI DSL with `screen`, `header`, `sidebar`, `row`, `column`, `panel`, `card`, `button`, `input`, `textarea`, `image`, `text`, and `list`.
- Added wireframe layout and rendering pipeline in `scrawl-core`.
- Switched the default handwritten font to `Permanent Marker`.
- Increased seeded text variability for a more sketch-like handwritten feel.
- Added standalone demos:
  - `docs/examples/permanent-marker-variability.html`
  - `docs/examples/wireframe-demo.html`
  - `docs/examples/wireframe-dashboard.scrawl`
  - `docs/examples/wireframe-dashboard.svg`
