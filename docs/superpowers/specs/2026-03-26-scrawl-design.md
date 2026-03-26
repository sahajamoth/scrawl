# Scrawl Design Document

Date: 2026-03-26
Status: Accepted

---

## 1. Problem Statement

### Why existing formats fall short for LLM use

#### Mermaid

Mermaid is the dominant text-based diagramming format and the one most LLMs have been trained on. It has three problems that make it unsuitable as a primary LLM output format.

First, token efficiency is poor. Mermaid uses verbose keywords (`flowchart LR`, `subgraph`, `style`, `classDef`) and repeated node declarations. A five-node flow diagram with styling can exceed 150 tokens. For a tool call or embedded diagram, this is significant overhead.

Second, the syntax is irregular. Node shape is encoded in bracket selection (`[...]`, `(...)`, `{...}`, `[(...]`, `>...]`), which requires the model to recall a symbol table that has no mnemonic relationship to the shapes it represents. Edge syntax varies by diagram type. The same concept — a labeled directed edge — is written differently in flowchart, sequence, and state diagrams. Models generate syntactically broken Mermaid at a measurable rate, particularly for less common shapes and edge modifiers.

Third, rendering is non-deterministic in practice. Mermaid uses Dagre internally but does not expose a seed. The same source may render differently across Mermaid versions, browser environments, and Dagre configurations. This makes it unsuitable for version-controlled documentation where SVG diffs matter.

#### Excalidraw

Excalidraw produces beautiful handwritten-aesthetic diagrams, but its file format is a JSON blob of absolute coordinates and element IDs. Generating valid Excalidraw JSON requires the model to reason about pixel coordinates, bounding boxes, and element ordering. The token cost for a three-node diagram is in the hundreds. Excalidraw is a drawing tool; it was never designed for programmatic generation.

#### PlantUML

PlantUML's format is more consistent than Mermaid's but requires a running Java server (or embedded library) for rendering. Its syntax is also verbose and its token efficiency is comparable to Mermaid's. The Java dependency makes it unsuitable for edge deployments, VS Code extensions, or browser-based rendering.

#### The gap

What is needed is a format that:

- An LLM can generate reliably from a 20-token schema hint
- Produces deterministic, handwritten-aesthetic SVG
- Requires no coordinate reasoning
- Has token costs linear in graph size with a small constant

Scrawl is that format.

---

## 2. Design Goals and Non-Goals

### Goals

**Token efficiency.** Every key name is one or two characters. The TOML array-of-tables syntax (`[[n]]`) is the minimum overhead for array elements. A three-node, two-edge diagram is approximately 55 tokens.

**LLM-first authoring.** The schema is designed to be memorized from a single sentence. Key names are mnemonics: `l` for label, `s` for shape, `c` for color, `f`/`t` for from/to. The full schema fits in a system prompt addition of under 25 tokens.

**No coordinate specification.** Authors specify topology. The renderer computes geometry. This eliminates the largest category of LLM-generated diagram errors: invalid or overlapping coordinates.

**Deterministic rendering.** The same `.scrawl` file always produces the same SVG. This is a hard requirement for version control, caching, and reproducibility in documentation pipelines.

**Self-contained SVG.** Every rendered SVG embeds its font. No external requests at render time or display time.

**Strict validation.** Errors are caught before any rendering begins. The validator produces actionable error messages with enough context for an LLM to self-correct.

**Handwritten aesthetic.** The rough.js library provides natural line variation that makes diagrams feel sketched rather than produced by a diagram tool. This aesthetic is appropriate for architecture sketches, design documents, and exploratory documentation.

### Non-goals

**Human hand-authoring ergonomics.** Scrawl is optimized for machine generation. Humans who want to hand-author diagrams have better tools (Mermaid, draw.io, Excalidraw).

**Pixel-precise layout control.** If you need exact node positions, scrawl is the wrong tool. Use SVG directly.

**Round-trip editing.** There is no path from rendered SVG back to `.scrawl` source.

**Diagram types beyond directed graphs.** Sequence diagrams, Gantt charts, ER diagrams, and similar are out of scope for v1. See Future Considerations.

**Theming customization.** v1 provides two themes: `rough` and `clean`. Custom color palettes, custom fonts, and custom line weights are not supported in v1.

---

## 3. Format Design Decisions

### Why TOML

TOML was chosen over JSON, YAML, and a custom DSL for three reasons.

First, TOML's array-of-tables syntax (`[[n]]`) maps naturally to a list of diagram elements. Each `[[n]]` block is a node record. The syntax is visually distinct, making the structure easy to parse and easy for models to generate.

Second, TOML is strictly typed with no implicit coercions. There is no YAML-style `yes`/`true`/`on` ambiguity, no JSON comment workarounds, and no indentation sensitivity. This reduces parse failures.

Third, TOML is natively supported by `smol-toml`, a zero-dependency TOML 1.0 parser with an 8 KB minified footprint. This keeps the browser bundle small.

JSON was rejected because it requires commas between array elements and closing brackets, adding tokens with no semantic content. YAML was rejected due to its indentation sensitivity and implicit type coercions, both of which increase model error rates. A custom DSL was rejected because it would not benefit from LLM training data on TOML.

### Why single-character keys

The most frequently generated keys — `id`, `l`, `s`, `c`, `f`, `t` — are one character. This is a deliberate token budget decision. In cl100k_base, each single-character key plus its TOML assignment syntax (`x = "`) costs two to three tokens. A full key name like `label` would cost three to four tokens plus the TOML overhead.

The character choices are mnemonic where possible: `l` for label, `s` for shape, `c` for color, `f` for from, `t` for to. The two-character keys (`st` for style, `id` for identifier) follow natural English abbreviation.

### Why no coordinates

Coordinate specification is the single largest source of error in LLM-generated diagram formats. Models must reason about 2D geometry, estimate node sizes from label lengths, avoid overlapping bounding boxes, and maintain consistent edge routing. This reasoning is unreliable and the token cost is high.

Scrawl delegates all geometric decisions to the layout engine. The model specifies only topology (which nodes exist, which edges connect them, which direction the layout flows). This makes the authoring problem purely graph-theoretic, which models handle well.

The layout engine (dagre or elkjs depending on configuration) produces stable, readable layouts for the class of directed graphs that diagrams typically represent.

### Why rough.js

rough.js produces SVG paths that simulate hand-drawn lines. Given a seed, its output is deterministic. The seed mechanism is what makes scrawl's rendering contract possible: by deriving the seed from the file content, we guarantee that identical files render identically while different files render with different (but stable) line variation.

The handwritten aesthetic is also appropriate for the use case. Scrawl diagrams are typically used in design documents, architecture reviews, and exploratory documentation — contexts where a polished, corporate diagram aesthetic is less appropriate than a sketched, thinking-in-progress aesthetic.

The `clean` theme is provided for cases where the handwritten aesthetic is inappropriate (e.g., formal API documentation, client-facing materials).

---

## 4. Architecture: The Five-Stage Pipeline

Scrawl processing follows a linear five-stage pipeline. Each stage produces a typed intermediate representation that is the sole input to the next stage. Stages do not share mutable state.

```
.scrawl file
     |
     v
[1. Parse]          smol-toml → raw TOML AST → ScrawlRaw (unvalidated)
     |
     v
[2. Validate]       ScrawlRaw → ScrawlDoc (validated, typed)
     |
     v
[3. Layout]         ScrawlDoc + dir → ScrawlLayout (nodes with x/y, edges with waypoints)
     |
     v
[4. Seed]           ScrawlDoc → canonicalize → xxhash32 → seed: number
     |
     v
[5. Render]         ScrawlLayout + seed → SVG string
```

### Stage 1: Parse

The parser calls `smol-toml`'s `parse()` function on the raw UTF-8 string. If TOML parsing fails, a `ParseError` is thrown with the upstream TOML error message and line number. The output is an untyped JavaScript object matching the TOML structure.

Unknown top-level keys are recorded as warnings but do not halt processing.

### Stage 2: Validate

The validator runs the parsed object through a Zod schema. Zod is used rather than hand-written validation because its error messages are structured and include the field path, which allows the CLI and editor extension to surface precise error locations.

The validation schema enforces:
- All required fields are present
- All string enums match allowed values
- All node id references (in edges and groups) resolve to declared nodes
- Node ids are unique
- Group membership is non-overlapping

The output is a `ScrawlDoc` object with fully typed fields and all cross-references resolved.

### Stage 3: Layout

The layout stage converts the `ScrawlDoc` graph into positioned geometry. For `lr`, `td`, `rl`, and `dt` directions, dagre is used. For `radial`, a custom radial placement algorithm distributes nodes on concentric rings based on topological distance from the center node.

The layout stage does not use the rough.js seed. It produces exact floating-point coordinates. Rough.js applies variation on top of these coordinates at render time.

The output is a `ScrawlLayout` object containing:
- Node records with `x`, `y`, `width`, `height`
- Edge records with arrays of waypoints
- Group records with computed bounding boxes
- Viewport `width` and `height` for the SVG viewBox

### Stage 4: Seed derivation

Seed derivation runs in parallel with layout (both take `ScrawlDoc` as input). The process:

1. Serialize `ScrawlDoc` to a canonical JSON string with alphabetically sorted keys.
2. Encode the string as UTF-8 bytes.
3. Pass the bytes to `xxhash-wasm`'s `h32()` function.
4. The resulting 32-bit unsigned integer is the seed.

The seed is derived from the document content, not from the source file bytes. This means that two files with different whitespace but identical structure produce the same seed and therefore identical SVG output.

### Stage 5: Render

The renderer receives `ScrawlLayout` and the seed. It:

1. Creates a rough.js `Rough.svg()` instance with the seed.
2. Constructs an SVG document in memory.
3. Injects the Caveat font as a base64 WOFF2 data URI in `<defs><style>`.
4. Draws groups, then edges, then nodes — in that z-order.
5. For each shape, calls the appropriate `rc.rectangle()`, `rc.circle()`, `rc.polygon()`, or `rc.path()` method.
6. For each edge, calls `rc.curve()` or `rc.linearPath()` with the waypoints.
7. Serializes the SVG DOM to a string.

The renderer does not read the original `.scrawl` file. It operates only on `ScrawlLayout` and `seed`.

---

## 5. Package Breakdown

The monorepo is organized as follows:

```
packages/
  core/          @scrawl/core
  cli/           @scrawl/cli
  remark-scrawl/ remark-scrawl
  vscode/        scrawl-vscode
apps/
  web/           scrawl-web
```

### `@scrawl/core`

The central library. Contains all five pipeline stages as exported functions. Has no CLI, no file system access, and no Node.js-specific APIs.

Exports:
- `parse(source: string): ScrawlRaw` — TOML parse only
- `validate(raw: ScrawlRaw): ScrawlDoc` — validation and type narrowing
- `layout(doc: ScrawlDoc): ScrawlLayout` — layout computation
- `seed(doc: ScrawlDoc): number` — seed derivation
- `render(layout: ScrawlLayout, seed: number): string` — SVG generation
- `compile(source: string): string` — convenience function running all five stages

Also exports all TypeScript types: `ScrawlDoc`, `ScrawlLayout`, `ScrawlNode`, `ScrawlEdge`, `ScrawlGroup`, `ValidationError`.

`@scrawl/core` runs in the browser (no Node.js APIs), in Node.js (>=18), and in Deno. The xxhash-wasm dependency loads its WASM module lazily on first use.

### `@scrawl/cli`

A Node.js command-line interface wrapping `@scrawl/core`.

```
scrawl render diagram.scrawl -o diagram.svg
scrawl validate diagram.scrawl
scrawl render *.scrawl --outdir ./dist
scrawl render diagram.scrawl --format png  # via resvg-js
```

The `--format png` flag uses `resvg-js` to convert the SVG output to a PNG raster at the specified DPI (default 144 for 2x).

The CLI reads from stdin when no file argument is given, enabling pipeline use:

```
echo '[[n]]\nid="a"\nl="Hello"' | scrawl render
```

### `remark-scrawl`

A remark plugin that transforms fenced code blocks tagged `scrawl` into inline SVG in the output HTML.

````markdown
```scrawl
[[n]]
id = "a"
l  = "Hello"
```
````

The plugin calls `@scrawl/core`'s `compile()` function and replaces the code block node with an `html` node containing the SVG string. It is compatible with unified, remark, and rehype pipelines, including Astro, Next.js (with `next-mdx-remote`), and VitePress.

### `scrawl-vscode`

A VS Code extension providing:
- Syntax highlighting for `.scrawl` files (TextMate grammar targeting TOML with scrawl-specific scope names)
- Live preview panel: renders the current `.scrawl` file to SVG on save and on keystroke debounce
- Diagnostics: validation errors surfaced as red squiggles with hover messages
- Code completion for shape codes, direction values, and theme values
- Snippets for common patterns (three-node flow, auth diagram, architecture template)

The extension uses `@scrawl/core` compiled for the extension host (Node.js context). The preview panel uses the same package compiled for the webview (browser context).

### `scrawl-web`

A browser-based playground application. Provides a split-pane editor (Monaco) and live SVG preview. Includes a gallery of example diagrams and a copy-to-clipboard button for the generated SVG.

The web app uses `@scrawl/core` directly in the browser via the WASM-based xxhash. No server-side rendering is required.

---

## 6. Technology Choices

### smol-toml

Selected for its zero-dependency footprint (8 KB minified), strict TOML 1.0 compliance, and good error messages that include line and column numbers. Its streaming API is not needed for scrawl's use case, but its synchronous `parse()` function fits the pipeline model cleanly.

Alternatives considered: `@iarna/toml` (slower, larger), `toml` npm package (not TOML 1.0 compliant), hand-written parser (maintenance burden).

### Zod

Selected for structured validation with typed output narrowing. Zod's `.safeParse()` returns a discriminated union of success and failure, which maps cleanly to the `ValidationError` type. Its error paths enable precise source location reporting.

The Zod schema is the single source of truth for the `ScrawlDoc` TypeScript type. This eliminates the possibility of the runtime validator and the TypeScript types diverging.

Alternatives considered: `valibot` (smaller but less ecosystem adoption), `ajv` (JSON Schema, not suited to cross-reference validation), hand-written validation (no free TypeScript narrowing).

### dagre

Dagre implements the Sugiyama layered graph layout algorithm, which produces clean hierarchical layouts for directed acyclic graphs. It handles the four cardinal directions (`lr`, `td`, `rl`, `dt`) by rotating the layout graph before computation.

Dagre is not actively maintained, but its algorithm is stable and its output is consistent across versions. The specific version used is pinned in `package.json`.

### elkjs

ELK (Eclipse Layout Kernel) is used as a fallback for graphs with cycles or as an alternative higher-quality layout engine when dagre produces overlapping edges. It is loaded lazily — only when dagre's output fails a basic overlap check.

ELK has a larger footprint than dagre and is not used in the browser bundle by default. The CLI uses ELK for better quality on complex diagrams.

### rough.js

rough.js generates SVG path data that simulates hand-drawn geometry. It accepts a `seed` parameter that makes all random line variations deterministic. This is the cornerstone of scrawl's rendering contract.

rough.js operates on a virtual SVG element and returns SVG node objects, which are then serialized to string. In the browser, it can operate on a real SVG DOM element, but `@scrawl/core` uses its headless mode to remain environment-agnostic.

### xxhash-wasm

xxHash32 is a fast non-cryptographic hash function. The WASM implementation (`xxhash-wasm`) produces consistent 32-bit output across all JavaScript environments (browser, Node.js, Deno) without relying on environment-specific hashing APIs.

The 32-bit output is passed directly to rough.js's `seed` option, which expects a number in the range `[0, 2^32)`.

The WASM module is approximately 15 KB. It is loaded once and cached for the lifetime of the process.

Alternatives considered: `farmhash` (Node.js only, no browser support), Web Crypto SHA-256 (async, and its 256-bit output requires truncation), `murmurhash` npm (pure JS, deterministic but slower).

### resvg-js

Used in the CLI for PNG export. `resvg-js` is a Rust/WASM SVG renderer that produces pixel-accurate PNG output from SVG strings. It handles embedded fonts via base64 data URIs, which is exactly the format scrawl uses for the Caveat font.

`resvg-js` is a CLI-only dependency. It is not included in `@scrawl/core` or `remark-scrawl`.

### lz-string

Used in `scrawl-web` to compress diagram source before encoding it in the URL fragment. This enables shareable URLs for the playground without a server. A three-node diagram compresses to approximately 80 characters of URL-safe base64.

---

## 7. SVG Output Design

### Document structure

The SVG output is a self-contained document with a `viewBox` computed from the layout stage. The `width` and `height` attributes are set to match the viewBox dimensions in pixels (no percentage values).

```xml
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 {width} {height}"
  width="{width}"
  height="{height}"
>
  <defs>
    <style>
      @font-face {
        font-family: 'Caveat';
        src: url('data:font/woff2;base64,...') format('woff2');
        font-weight: normal;
        font-style: normal;
      }
      .scrawl-label { font-family: 'Caveat', cursive; fill: #1a1a1a; }
      .scrawl-title { font-family: 'Caveat', cursive; fill: #1a1a1a; font-size: 18px; }
      .scrawl-group-label { font-family: 'Caveat', cursive; fill: #666; font-size: 13px; }
    </style>
    <marker id="scrawl-arrow" ...>...</marker>
    <marker id="scrawl-arrow-start" ...>...</marker>
  </defs>

  <!-- title, when present -->
  <text class="scrawl-title" x="..." y="...">...</text>

  <g class="scrawl-groups">
    <!-- one <rect> per group -->
  </g>

  <g class="scrawl-edges">
    <!-- one <g> per edge: path + optional label text -->
  </g>

  <g class="scrawl-nodes">
    <!-- one <g> per node: shape paths + label text -->
  </g>
</svg>
```

### Font embedding strategy

The Caveat font is embedded as a base64-encoded WOFF2 data URI. The Latin subset (Unicode range `U+0000–U+007F` plus extended Latin for common diacritics) is used to keep the embedded size under 20 KB.

The full Caveat variable font is not used. The static regular weight is embedded, keeping the data URI predictable and stable across builds.

The font is embedded in the `<defs><style>` block rather than as a separate `<defs>` element to ensure compatibility with SVG viewers that do not support `<font>` elements.

SVG files that are inlined into HTML (as `remark-scrawl` does) share the font definition with any other scrawl SVG on the same page. The browser deduplicates identical `@font-face` declarations by source URL, so multiple scrawl diagrams on a page do not download the font multiple times.

### Z-ordering

SVG has no explicit z-index. Later elements in document order are rendered on top. The rendering order is:

1. `<g class="scrawl-groups">` — group background fills are always behind everything else.
2. `<g class="scrawl-edges">` — edges are drawn on top of group fills but behind nodes.
3. `<g class="scrawl-nodes">` — nodes and their labels are always on top.

This order ensures that node shapes always cover the portions of edges that pass through them, creating the visual appearance of edges connecting to node boundaries rather than passing through them.

### Rough.js path generation

Each shape type maps to a rough.js drawing call:

| Shape | rough.js method | Notes |
|-------|----------------|-------|
| `b` (rectangle) | `rc.rectangle(x, y, w, h)` | Sharp corners via roughness options |
| `r` (rounded) | `rc.rectangle(x, y, w, h, {cornerRadius})` | |
| `c` (circle) | `rc.ellipse(cx, cy, w, h)` | |
| `d` (diamond) | `rc.polygon([...4 points...])` | Points computed from bounding box |
| `y` (cylinder) | `rc.path(...)` | Two arcs + two vertical lines |
| `p` (parallelogram) | `rc.polygon([...4 points...])` | Offset top-left and bottom-right |
| `h` (hexagon) | `rc.polygon([...6 points...])` | Regular hexagon from center + radius |

All rough.js calls receive the same seed option, ensuring all shapes in a diagram have consistent line variation style.

---

## 8. Determinism Guarantee

The determinism guarantee is the property that for any `.scrawl` file `F`, every invocation of the renderer on `F` produces byte-identical SVG output (given the same renderer version).

This guarantee has two components.

### Layout determinism

The layout stage uses dagre, which is a deterministic algorithm: given the same graph structure and options, it produces the same node positions. Dagre does not use random numbers internally.

The layout input (the `ScrawlDoc` graph) is derived from the validated TOML, which is order-preserving for arrays. `[[n]]` entries appear in the order they were declared in the file. Dagre processes them in that order. This means that reordering nodes in the source file can change the layout — which is expected and acceptable behavior.

### Render determinism

rough.js uses a seeded pseudorandom number generator (PRNG) internally. When the same seed is passed to the `Rough.svg()` constructor, every subsequent draw call produces the same SVG path data.

The seed is derived as follows:

```
canonical_json = JSON.stringify(ScrawlDoc, sorted_keys)
seed = xxhash32(utf8_bytes(canonical_json))
```

`ScrawlDoc` is the validated, fully typed document. It does not contain raw TOML — it contains the normalized values after validation (e.g., default values filled in, color strings normalized). This means that a file with `s = "b"` and a file with no `s` field (which defaults to `b`) produce the same `ScrawlDoc` and therefore the same seed.

The canonical JSON uses sorted keys at every object level. Array order is preserved (consistent with TOML array semantics). This means that `JSON.stringify` is deterministic across JavaScript engines, which is true when key order is explicitly controlled.

### What the guarantee does not cover

- Renderer version changes may change SVG output. The guarantee is per-version.
- Different layout engines (dagre vs. elkjs) may produce different layouts for the same graph.
- OS-level font rendering is not part of the SVG output — fonts are embedded as paths via rough.js text rendering when using the `rough` theme, so rasterization differences are irrelevant for the SVG format.

---

## 9. Future Considerations

### Sequence diagrams (v2)

The most requested diagram type not supported by v1 is the sequence diagram. Sequence diagrams have a fundamentally different structure: actors, lifelines, and messages with explicit ordering. They do not map to a directed graph.

A v2 extension is planned using a new top-level key `[[m]]` for messages:

```toml
[d]
v    = 2
type = "sequence"

[[actor]]
id = "u"
l  = "User"

[[actor]]
id = "s"
l  = "Server"

[[m]]
f = "u"
t = "s"
l = "POST /login"

[[m]]
f = "s"
t = "u"
l = "200 OK"
```

This would require a separate layout algorithm (vertical time axis, horizontal actor arrangement) and new rendering logic. It is explicitly out of scope for v1.

### Custom themes

v1 provides `rough` and `clean` themes. A `theme = "custom"` mode could allow a `[theme]` configuration block with overrides for fill colors, stroke weights, font size, and rough.js `roughness` and `bowing` parameters.

```toml
[d]
theme = "custom"

[theme]
roughness = 0.5
bowing    = 0.8
stroke    = "#333333"
fill      = "#f5f5f5"
```

This is deferred to v1.1 pending user feedback on the default themes.

### Lezer grammar

A Lezer grammar for `.scrawl` files would enable first-class CodeMirror/Lezer integration (used by the Obsidian editor, among others) and richer VS Code language support via the language server protocol.

The grammar would be derived directly from the ABNF in the format specification. Because scrawl is structurally a TOML subset, the grammar can reuse Lezer's TOML tokenizer for the lexical layer and add scrawl-specific node types for semantic highlighting.

### Layouter abstraction

Currently the layout stage calls dagre directly. A `Layouter` interface would allow pluggable layout backends:

```typescript
interface Layouter {
  layout(doc: ScrawlDoc): ScrawlLayout;
}
```

This would allow users to substitute elkjs, cola.js, or a custom algorithm without modifying `@scrawl/core`. The interface is straightforward to add — the main blocker is defining a stable `ScrawlLayout` type that all layouters can target, which requires observing real-world diagram complexity before committing.

### VS Code Language Server Protocol

The current VS Code extension uses the extension host directly. A proper LSP implementation would allow scrawl support to be added to any LSP-compatible editor (Neovim, Helix, Zed) without editor-specific code.

The LSP server would expose diagnostics (validation errors), completions (shape codes, direction values), and hover documentation (shape descriptions from the format spec). It would wrap `@scrawl/core`'s `validate()` function as its primary diagnostic source.
