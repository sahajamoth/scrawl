# scrawl

> Hand-drawn diagrams from plain text. 57% fewer tokens than Mermaid.

Scrawl is a compact, line-oriented diagram format that renders to hand-drawn SVGs. Designed for LLM generation, documentation, and anywhere you want diagrams that feel human.

## Why scrawl?

```
lr                                          flowchart LR
push(Git Push)~blue->ci(Run Tests)            push[Git Push]:::blue --> ci[Run Tests]
ci->build(Build)|pass                         ci -->|pass| build[Build Image]
ci=>fail(Notify)~red|fail                     ci -.->|fail| fail[Notify]:::red
build->gate{Approve?}                         build --> gate{Approve?}
gate->prod(Deploy)~green|yes                  gate -->|yes| prod[Deploy]:::green
gate=>fail|no                                 gate -.->|no| fail
                                              classDef blue fill:#3182ce33,stroke:#3182ce
~57 tokens                                    classDef green fill:#38a16933,stroke:#38a169
                                              classDef red fill:#e53e3e33,stroke:#e53e3e
                                              ~129 tokens
```

**Same diagram. 56% fewer tokens.** Colors are inline (`~blue`), not separate `classDef` blocks. Edge labels are inline (`|pass`), not `-->|pass|`. Dashed edges are `=>`, not `-.->`.

## Quick start

```bash
npm install -g @scrawl/cli
echo 'lr\na(Start)~blue->b(End)~green' | scrawl > diagram.svg
```

## Syntax in 60 seconds

```
td                          # direction: td, lr, rl, dt
a:Label->b:Label            # edge with labels
a(Rounded)                  # shape: () rounded
a((Circle))                 # shape: (()) circle
a{Diamond}                  # shape: {} diamond
a[(Cylinder)]               # shape: [()] cylinder
a->b|edge label             # edge label after pipe
a=>b                        # dashed edge
a..>b                       # dotted edge
a<->b                       # bidirectional
a->{b,c,d}                  # fan-out
a~blue                      # color: red blue green yellow purple orange pink gray teal cyan
[Group Name: a b c]         # group nodes
# this is a comment
```

## Style presets

One input, five visual styles:

| `sketch` | `rough` | `clean` | `architect` | `blueprint` |
|----------|---------|---------|-------------|-------------|
| wabi-sabi | art brut | geometric | drafting | engineering |
| default, casual confidence | raw, expressive | minimal warmth | technical sketch | near-perfect |

```javascript
import { renderDiagram } from '@scrawl/core'

renderDiagram('lr\na->b->c', { style: 'architect' })
```

Each preset controls roughness, bowing, stroke width variation, arrowhead style, text wobble, edge curvature, double-line mode, and corner overshoot. Per-element seed derivation ensures every shape has unique character while remaining deterministic.

## Packages

| Package | Description |
|---------|-------------|
| [`@scrawl/core`](packages/core) | Parse + render engine. Zero-coordinate layout via dagre, hand-drawn rendering via rough.js |
| [`@scrawl/cli`](packages/cli) | Pipe-friendly CLI. `scrawl render`, `scrawl validate`, `scrawl tokens` |
| [`remark-scrawl`](packages/remark-scrawl) | Remark/unified plugin. Drop scrawl blocks into Markdown and MDX |
| [`scrawl-web`](apps/web) | Browser playground with CodeMirror editor, live preview, URL sharing |
| [`scrawl-vscode`](apps/vscode) | VS Code extension with syntax highlighting and live preview |

## Use it everywhere

**Markdown docs** — remark-scrawl plugin renders code blocks as inline SVGs:

````markdown
```scrawl
td
a(Start)->b{Check}->c(Done)~green
b=>d(Error)~red
```
````

**LLM prompts** — 57% fewer tokens means cheaper, faster, and fits more context.

**CI pipelines** — deterministic output: same input always produces the same SVG. Diffable in version control.

**VS Code** — live preview as you type.

## Token comparison

| Diagram | scrawl | Mermaid | Savings |
|---------|--------|---------|---------|
| CI/CD Pipeline | ~57t | ~129t | **56%** |
| Microservices | ~77t | ~153t | **50%** |
| User Auth Flow | ~51t | ~133t | **62%** |
| Git Branching | ~55t | ~162t | **66%** |
| React Component Tree | ~50t | ~146t | **66%** |
| Database Schema | ~64t | ~167t | **62%** |
| Network Topology | ~66t | ~152t | **57%** |
| Bug Triage | ~70t | ~134t | **48%** |
| API Lifecycle | ~82t | ~139t | **41%** |
| How Scrawl Works | ~60t | ~164t | **63%** |
| **Average** | | | **57%** |

## How it works

```
lr
src(your .scrawl)~blue->parse(Parse)~purple->ir(Graph IR)~orange->layout(Dagre)~teal->render(rough.js)->svg(SVG)~green
```

1. **Parse** — zero-dependency recursive descent parser converts text to a typed IR
2. **Layout** — dagre computes node positions and edge routing
3. **Render** — rough.js draws hand-drawn shapes, edges with Bezier smoothing, and text with per-character wobble
4. **Seed** — djb2 hash of source content ensures deterministic output

## Contributing

Contributions welcome. This is a pnpm monorepo with Turborepo:

```bash
pnpm install
pnpm turbo build
pnpm turbo test
```

## License

MIT
