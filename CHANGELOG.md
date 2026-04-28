# Changelog

## 0.6.0

Released: 2026-04-29

- Expanded `chart` into a broad single-DSL surface with `donut`, `combo`, `waterfall`, `heatmap`, `radar`, `radial-bar`, `treemap`, `sunburst`, `funnel`, `sankey`, `gauge`, `likert`, `box`, `dot`, and `tornado`.
- Added per-series chart options: `type`, `axis`, `color`, `curve`, and `labels`.
- Added chart-level controls for `stack percent`, `curve`, `labels`, `y2ticks`, `y2min`, `y2max`, `ref`, `annotate`, `threshold`, and donut `inner`.
- Added dual-axis combo rendering, smooth and step interpolation, percent-stacked bars and areas, and basic chart label collision avoidance.
- Added public chart fixtures and thumbnails for combo, donut, heatmap, sankey, treemap, and gauge examples, and aligned the README example gallery with all public SVG examples.
- Kept repo-level verification green with `pnpm turbo typecheck --force`, `pnpm turbo test --force`, and `pnpm turbo build --force`.

## 0.5.0

Released: 2026-04-28

- Added top-level `chart` mode with first-pass `bar`, `line`, and `scatter` support.
- Formalized chart parsing, layout, rendering, exported types, and public documentation in `scrawl-core`.
- Added explicit `sequence` branching with `fork source -> a, b` and `join a, b -> target`.
- Added sequence note callout leaders so annotations visibly anchor to their target steps.
- Normalized long sequence notes and section labels into readable multiline annotations.
- Added shared docs and web examples for branching sequence flows.
- Restored repo-level release confidence with green `pnpm turbo test`, `build`, and `typecheck`.

## 0.4.0

Released: 2026-04-28

- Added `sequence` mode for long ordered flows and process walkthroughs.
- Added compact serpentine sequence layout with `wrap=N`, `snake=horizontal|vertical`, `rowgap=N`, and `colgap=N`.
- Added explicit `break` rows for manually controlled sequence wrapping.
- Added `phase` and `lane` markers that render as labeled background regions for grouped steps.
- Added sequence notes with `note left of`, `note right of`, and `note over`.
- Added inline transition labels on chained edges such as `A->B|draft->C|reviewed->D`.
- Expanded parser, layout, and renderer coverage for compact sequence rendering and annotations.

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
