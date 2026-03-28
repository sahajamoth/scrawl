import { renderDiagram } from './packages/core/dist/index.js'
import { writeFileSync } from 'fs'
import { execSync } from 'child_process'

function estimateTokens(source) {
  const stripped = source
    .split('\n')
    .filter(l => l.trim() && !l.trimStart().startsWith('#'))
    .join('\n')
  return Math.ceil(stripped.length / 3.5)
}

const STYLE_PRESETS = ['sketch', 'rough', 'clean', 'architect', 'blueprint']

const diagrams = [
  {
    title: 'CI/CD Pipeline',
    scrawl: `lr
push(Git Push)~blue->ci(Run Tests)
ci->build(Build Image)|pass
ci=>fail(Notify Team)~red|fail
build->staging(Deploy Staging)~orange->gate{Approve?}
gate->prod(Deploy Prod)~green|yes
gate=>fail|no`,
    mermaid: `flowchart LR
  push[Git Push]:::blue --> ci[Run Tests]
  ci -->|pass| build[Build Image]
  ci -.->|fail| fail[Notify Team]:::red
  build --> staging[Deploy Staging]:::orange
  staging --> gate{Approve?}
  gate -->|yes| prod[Deploy Prod]:::green
  gate -.->|no| fail

  classDef blue fill:#3182ce33,stroke:#3182ce
  classDef orange fill:#dd6b2033,stroke:#dd6b20
  classDef green fill:#38a16933,stroke:#38a169
  classDef red fill:#e53e3e33,stroke:#e53e3e`,
  },
  {
    title: 'Microservices',
    scrawl: `td
gw(API Gateway)~purple->{auth(Auth Service),users(User Service),orders(Order Service)}
users->db_u[(Users DB)]~orange
orders->db_o[(Orders DB)]~orange
orders->queue:Event Bus~blue|emit
queue=>notify(Notify Service)|subscribe
[svcs|Services: auth users orders notify]`,
    mermaid: `flowchart TD
  gw[API Gateway]:::purple
  subgraph svcs [Services]
    auth[Auth Service]
    users[User Service]
    orders[Order Service]
    notify[Notify Service]
  end
  db_u[(Users DB)]:::orange
  db_o[(Orders DB)]:::orange
  queue{{Event Bus}}:::blue

  gw --> auth
  gw --> users
  gw --> orders
  users --> db_u
  orders --> db_o
  orders -->|emit| queue
  queue -.->|subscribe| notify

  classDef purple fill:#805ad533,stroke:#805ad5
  classDef orange fill:#dd6b2033,stroke:#dd6b20
  classDef blue fill:#3182ce33,stroke:#3182ce`,
  },
  {
    title: 'User Auth Flow',
    scrawl: `td
user((User))->login(Login Form)~blue->check{Valid?}
check->mfa(MFA Challenge)~orange|yes
check=>lock(Lock Account)~red|no
mfa->token(Issue JWT)~green|valid
mfa=>lock|invalid`,
    mermaid: `flowchart TD
  user([User]):::blue --> login[Login Form]
  login -->|submit| check{Valid creds?}
  check -->|yes| mfa[MFA Challenge]:::orange
  check -.->|no| lock[Lock Account]:::red
  mfa --> mfa_ok{MFA valid?}
  mfa_ok -->|yes| token[Issue JWT]:::green
  mfa_ok -.->|no| lock

  classDef blue fill:#3182ce33,stroke:#3182ce
  classDef orange fill:#dd6b2033,stroke:#dd6b20
  classDef green fill:#38a16933,stroke:#38a169
  classDef red fill:#e53e3e33,stroke:#e53e3e`,
  },
  {
    title: 'Git Branching',
    scrawl: `td
main(main)~blue->feat(feature/*)->pr(Pull Request)->main
main->hotfix(hotfix/*)~red->main
feat=>test(CI Tests)|auto
pr->review(Code Review)->pr|approved
[dev|Development: feat hotfix test]`,
    mermaid: `flowchart LR
  main[main]:::green
  dev[develop]:::blue
  feat1[feature/login]
  feat2[feature/api]
  hotfix[hotfix/bug-42]:::red
  release[release/1.2]:::orange

  main -.->|branch| dev
  dev -.->|branch| feat1
  dev -.->|branch| feat2
  feat1 -->|merge PR| dev
  feat2 -->|merge PR| dev
  dev --> release
  release -->|tag v1.2| main
  main -.-> hotfix
  hotfix -->|merge| main

  classDef green fill:#38a16933,stroke:#38a169
  classDef blue fill:#3182ce33,stroke:#3182ce
  classDef red fill:#e53e3e33,stroke:#e53e3e
  classDef orange fill:#dd6b2033,stroke:#dd6b20`,
  },
  {
    title: 'React Component Tree',
    scrawl: `td
app(App)~blue->{nav(Nav),main(Main),footer(Footer)}
main->{sidebar(Sidebar),feed(Feed)~purple}
feed->{post(PostCard),ad(AdBanner)~orange}
[layout|Layout: nav main footer]`,
    mermaid: `flowchart TD
  app[App]:::blue
  ctx{{AuthContext}}:::purple
  router[Router]
  nav[Navbar]
  subgraph pages [Pages]
    home[HomePage]
    dash[Dashboard]
  end
  hero[HeroSection]
  feed[ActivityFeed]
  card[DiagramCard]:::green

  app -.->|provides| ctx
  app --> router
  app --> nav
  router --> home
  router --> dash
  home --> hero
  dash --> feed
  feed --> card

  classDef blue fill:#3182ce33,stroke:#3182ce
  classDef purple fill:#805ad533,stroke:#805ad5
  classDef green fill:#38a16933,stroke:#38a169`,
  },
  {
    title: 'Database Schema',
    scrawl: `lr
user(User)~blue->order(Order)~purple|1:N
order->item(OrderItem)|1:N
item->product(Product)~green|N:1
order->payment(Payment)~orange|1:1
user->address(Address)|1:N
[ents|Entities: user order item product payment address]`,
    mermaid: `erDiagram
  users {
    int id PK
    string email
    string name
  }
  orders {
    int id PK
    int user_id FK
    float total
  }
  order_items {
    int id PK
    int order_id FK
    int product_id FK
    int qty
  }
  products {
    int id PK
    string name
    float price
    int category_id FK
  }
  categories {
    int id PK
    string name
  }
  addresses {
    int id PK
    int user_id FK
  }
  users ||--o{ orders : "1:N"
  users ||--o{ addresses : "1:N"
  orders ||--o{ order_items : "1:N"
  order_items }o--|| products : "N:1"
  products }o--|| categories : "N:1"`,
  },
  {
    title: 'Network Topology',
    scrawl: `td
internet{Internet}->fw(Firewall)~red
fw->{dmz(DMZ)~orange,lb(Load Balancer)~blue}
lb->{web1(Web 1),web2(Web 2)}
web1->db[(Primary DB)]~green
web2->db
db=>replica[(Replica)]~teal|sync
[internal|Internal: lb web1 web2 db replica]`,
    mermaid: `flowchart TD
  inet([Internet]):::blue
  fw{Firewall}:::red
  lb[Load Balancer]:::orange
  subgraph app [App Tier]
    w1[Web Server 1]
    w2[Web Server 2]
  end
  subgraph data [Data Tier]
    cache[(Redis)]:::red
    db_p[(Postgres Primary)]:::blue
    db_r[(Postgres Replica)]
  end

  inet --> fw --> lb
  lb --> w1 & w2
  w1 & w2 -.-> cache
  w1 & w2 --> db_p
  db_p -.->|replicate| db_r

  classDef blue fill:#3182ce33,stroke:#3182ce
  classDef red fill:#e53e3e33,stroke:#e53e3e
  classDef orange fill:#dd6b2033,stroke:#dd6b20`,
  },
  {
    title: 'Bug Triage',
    scrawl: `lr
report(Bug Report)->triage{Triage}
triage->critical(Critical)~red|P0
triage->major(Major)~orange|P1
triage->minor(Minor)~green|P2
critical->hotfix(Hotfix Branch)->release(Release)
major->sprint(Sprint Backlog)->release
minor->backlog(Backlog)`,
    mermaid: `flowchart TD
  report[Bug Report]:::red --> repro{Reproducible?}
  repro -->|yes| severity{Severity?}
  repro -.->|no| more[Request Info]
  more -.->|no response| close[Close WONTFIX]:::gray
  severity -->|critical| hotfix[Hotfix Now]:::red
  severity -->|high| sprint[Add to Sprint]:::orange
  severity -.->|low| backlog[Backlog]

  classDef red fill:#e53e3e33,stroke:#e53e3e
  classDef orange fill:#dd6b2033,stroke:#dd6b20
  classDef gray fill:#71809633,stroke:#718096`,
  },
  {
    title: 'API Request Lifecycle',
    scrawl: `lr
client((Client))->lb(Load Balancer)~blue->mw(Middleware)~purple->router{Router}
router->ctrl(Controller)~blue|matched
router=>error(Error Handler)~red|unmatched
ctrl->svc(Service Layer)->repo(Repository)->db[(Database)]~orange
svc=>cache[(Cache)]~teal|hit
ctrl->resp((Response))~green`,
    mermaid: `flowchart LR
  client([Client]):::blue
  tls[TLS]
  rate[Rate Limiter]:::orange
  authn[Auth]
  route{Router}
  handler[Handler]:::green
  cache[(Cache)]:::orange
  db[(Database)]
  resp[Response]:::green

  client --> tls --> rate --> authn --> route --> handler
  handler -.->|lookup| cache
  cache -.->|miss| db
  handler --> resp --> client

  classDef blue fill:#3182ce33,stroke:#3182ce
  classDef orange fill:#dd6b2033,stroke:#dd6b20
  classDef green fill:#38a16933,stroke:#38a169`,
  },
  {
    title: 'How Scrawl Works',
    scrawl: `lr
src(your .scrawl)~blue->parse(Parse)~purple->ir(Graph IR)~orange->layout(Layout)~teal->render(Render)->svg(SVG)~green
parse=>err(Error)~red|invalid
layout->{dagre(Dagre),elk(ELK)}
dagre->render
elk->render`,
    mermaid: `flowchart TD
  toml[.scrawl TOML]:::blue --> parse[Parse + Validate]
  parse --> ir{{Graph IR}}:::purple
  ir --> seed([djb2 Seed])
  ir --> layout[Dagre Layout]
  seed -.-> rough[rough.js Render]:::orange
  layout --> rough
  rough --> svg[SVG Output]:::green
  subgraph outputs [Outputs]
    cli[CLI]
    web[Web Playground]
    vscode[VS Code]
  end
  svg -.-> cli & web & vscode

  classDef blue fill:#3182ce33,stroke:#3182ce
  classDef purple fill:#805ad533,stroke:#805ad5
  classDef orange fill:#dd6b2033,stroke:#dd6b20
  classDef green fill:#38a16933,stroke:#38a169`,
  },
]

console.log('Rendering 10 diagrams x 5 presets...')

const rendered = diagrams.map((d, i) => {
  const scrawlTokens = estimateTokens(d.scrawl)
  const mermaidTokens = estimateTokens(d.mermaid)
  const presetSvgs = {}

  for (const preset of STYLE_PRESETS) {
    try {
      presetSvgs[preset] = renderDiagram(d.scrawl, { style: preset })
    } catch (err) {
      presetSvgs[preset] = null
      console.error(`  ${i + 1}. ${d.title} [${preset}] error: ${err.message}`)
    }
  }

  const savings = mermaidTokens > 0 ? Math.round((1 - scrawlTokens / mermaidTokens) * 100) : 0
  console.log(`  ${i + 1}. ${d.title}  scrawl: ~${scrawlTokens}t  mermaid: ~${mermaidTokens}t  (${savings > 0 ? savings + '% smaller' : 'comparable'})`)

  return { ...d, presetSvgs, scrawlTokens, mermaidTokens, savings }
})

// Aggregate stats
const totalScrawl = rendered.reduce((s, d) => s + d.scrawlTokens, 0)
const totalMermaid = rendered.reduce((s, d) => s + d.mermaidTokens, 0)
const avgSavings = Math.round((1 - totalScrawl / totalMermaid) * 100)

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>scrawl — diagram gallery &amp; style presets</title>
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"><\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #f0ece4;
      min-height: 100vh;
      padding: 40px 24px 64px;
      color: #1a202c;
    }
    header { text-align: center; margin-bottom: 48px; }
    header h1 {
      font-family: 'Caveat', cursive; font-size: 64px; font-weight: 600;
      color: #1a202c; letter-spacing: -1px; line-height: 1;
    }
    header p { margin-top: 10px; font-size: 15px; color: #718096; }

    /* Stats bar */
    .stats {
      display: flex; justify-content: center; gap: 32px;
      margin-bottom: 40px; flex-wrap: wrap;
    }
    .stat {
      text-align: center; padding: 16px 24px;
      background: #fff; border-radius: 12px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .stat-value {
      font-family: 'Caveat', cursive; font-size: 36px; font-weight: 600;
      color: #2d3748;
    }
    .stat-label { font-size: 12px; color: #718096; margin-top: 2px; }

    .grid {
      display: grid; grid-template-columns: 1fr;
      gap: 40px; max-width: 1400px; margin: 0 auto;
    }
    .card {
      background: #fff; border-radius: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04);
      overflow: hidden;
    }
    .card-header {
      padding: 14px 20px; border-bottom: 1px solid #f0f0ee;
      display: flex; align-items: center; gap: 10px;
    }
    .card-num {
      font-family: 'Caveat', cursive; font-size: 17px;
      color: #a0aec0; min-width: 22px;
    }
    .card-title {
      font-family: 'Caveat', cursive; font-size: 26px;
      font-weight: 600; color: #2d3748; flex: 1;
    }
    .token-badges { display: flex; gap: 6px; align-items: center; }
    .badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 8px; border-radius: 99px; font-size: 11px;
      font-weight: 500; white-space: nowrap;
    }
    .badge-scrawl { background: #ebf8ff; color: #2b6cb0; border: 1px solid #bee3f8; }
    .badge-mermaid { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    .badge-savings { background: #faf5ff; color: #553c9a; border: 1px solid #e9d8fd; }

    /* Style preset strip */
    .preset-strip {
      display: grid; grid-template-columns: repeat(5, 1fr);
      border-bottom: 1px solid #f0f0ee;
    }
    .preset-col {
      border-right: 1px solid #f0f0ee; padding: 12px;
      display: flex; flex-direction: column; align-items: center;
    }
    .preset-col:last-child { border-right: none; }
    .preset-label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.05em; color: #718096; margin-bottom: 8px;
    }
    .preset-label.active-label { color: #2d3748; }
    .preset-svg {
      width: 100%; min-height: 100px; display: flex;
      align-items: center; justify-content: center;
      background: #fafaf8; border-radius: 8px; padding: 8px;
      overflow: hidden;
    }
    .preset-svg svg { max-width: 100%; height: auto; max-height: 200px; }
    .preset-svg { cursor: pointer; transition: background 0.15s; }
    .preset-svg:hover { background: #f0ede6; }

    /* Lightbox overlay */
    .lightbox {
      display: none; position: fixed; inset: 0; z-index: 999;
      background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
      align-items: center; justify-content: center;
      cursor: zoom-out; padding: 32px;
    }
    .lightbox.open { display: flex; }
    .lightbox-inner {
      background: #fff; border-radius: 16px; padding: 24px;
      max-width: 95vw; max-height: 92vh; overflow: auto;
      box-shadow: 0 24px 80px rgba(0,0,0,0.3);
      cursor: default; position: relative;
    }
    .lightbox-title {
      font-family: 'Caveat', cursive; font-size: 28px; font-weight: 600;
      color: #2d3748; margin-bottom: 4px;
    }
    .lightbox-preset {
      font-size: 12px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.05em; color: #718096; margin-bottom: 16px;
    }
    .lightbox-svg { display: flex; align-items: center; justify-content: center; }
    .lightbox-svg svg { max-width: 90vw; max-height: 75vh; }
    .lightbox-close {
      position: absolute; top: 12px; right: 16px;
      font-size: 24px; color: #a0aec0; cursor: pointer;
      border: none; background: none; font-family: sans-serif;
      line-height: 1; padding: 4px 8px; border-radius: 6px;
    }
    .lightbox-close:hover { color: #2d3748; background: #f0f0ee; }
    .lightbox-nav {
      position: absolute; top: 50%; transform: translateY(-50%);
      font-size: 32px; color: #a0aec0; cursor: pointer;
      border: none; background: rgba(255,255,255,0.9); padding: 8px 14px;
      border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .lightbox-nav:hover { color: #2d3748; }
    .lightbox-prev { left: -60px; }
    .lightbox-next { right: -60px; }

    /* Source tabs */
    .tabs {
      display: flex; border-bottom: 1px solid #f0f0ee; background: #fafaf8;
    }
    .tab-btn {
      padding: 8px 16px; font-size: 12px; font-weight: 500;
      font-family: 'Inter', sans-serif; cursor: pointer;
      border: none; background: transparent; color: #a0aec0;
      border-bottom: 2px solid transparent;
      transition: color 0.1s, border-color 0.1s;
    }
    .tab-btn.active { color: #2d3748; border-bottom-color: #2d3748; }
    .tab-btn:hover:not(.active) { color: #718096; }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }
    pre {
      padding: 16px 18px; font-size: 12px;
      font-family: 'SF Mono', 'Fira Code', 'Menlo', monospace;
      line-height: 1.6; overflow-x: auto; background: #1a202c;
      color: #e2e8f0; margin: 0; max-height: 280px; overflow-y: auto;
    }
    .mermaid-panel {
      padding: 20px; background: #fafaf8;
      display: flex; align-items: center; justify-content: center;
      min-height: 120px;
    }
    .mermaid-panel .mermaid { max-width: 100%; }

    /* Preset descriptions */
    .preset-desc {
      font-size: 10px; color: #a0aec0; margin-top: 4px;
      text-align: center; line-height: 1.3;
    }
    .preset-tag {
      display: inline-block; padding: 1px 6px; border-radius: 4px;
      font-size: 9px; font-weight: 600; margin-top: 4px;
    }
    .tag-sketch { background: #ebf8ff; color: #2b6cb0; }
    .tag-rough { background: #fff5f5; color: #c53030; }
    .tag-clean { background: #f0fff4; color: #276749; }
    .tag-architect { background: #faf5ff; color: #553c9a; }
    .tag-blueprint { background: #ebf4ff; color: #2a4365; }

    footer {
      text-align: center; margin-top: 56px; color: #a0aec0; font-size: 13px;
    }
    footer span { font-family: 'Caveat', cursive; font-size: 18px; color: #718096; }
  </style>
</head>
<body>
  <header>
    <h1>scrawl</h1>
    <p>10 diagrams &middot; 5 style presets &middot; mermaid comparison &middot; token counts</p>
  </header>

  <div class="stats">
    <div class="stat">
      <div class="stat-value">10</div>
      <div class="stat-label">Diagrams</div>
    </div>
    <div class="stat">
      <div class="stat-value">5</div>
      <div class="stat-label">Style Presets</div>
    </div>
    <div class="stat">
      <div class="stat-value">~${totalScrawl}t</div>
      <div class="stat-label">Total scrawl tokens</div>
    </div>
    <div class="stat">
      <div class="stat-value">~${totalMermaid}t</div>
      <div class="stat-label">Total mermaid tokens</div>
    </div>
    <div class="stat">
      <div class="stat-value">${avgSavings}%</div>
      <div class="stat-label">Average savings</div>
    </div>
  </div>

  <div class="grid">
    ${rendered.map((d, i) => {
      const cleanSvg = (svg) => svg ? svg.replace(/<\?xml[^>]*>/, '').trim() : '<div style="color:#e53e3e;font-size:11px">render error</div>'

      return `
    <div class="card">
      <div class="card-header">
        <span class="card-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="card-title">${d.title}</span>
        <div class="token-badges">
          <span class="badge badge-scrawl">scrawl ~${d.scrawlTokens}t</span>
          <span class="badge badge-mermaid">mermaid ~${d.mermaidTokens}t</span>
          ${d.savings > 0 ? `<span class="badge badge-savings">${d.savings}% smaller</span>` : ''}
        </div>
      </div>

      <div class="preset-strip">
        ${STYLE_PRESETS.map(p => `
        <div class="preset-col">
          <div class="preset-label">${p}</div>
          <div class="preset-svg" onclick="openLightbox(${i}, '${p}')" title="Click to zoom">${cleanSvg(d.presetSvgs[p])}</div>
          <span class="preset-tag tag-${p}">${
            p === 'sketch' ? 'wabi-sabi' :
            p === 'rough' ? 'art brut' :
            p === 'clean' ? 'geometric' :
            p === 'architect' ? 'drafting' :
            'engineering'
          }</span>
        </div>`).join('')}
      </div>

      <div class="tabs" role="tablist">
        <button class="tab-btn active" onclick="switchTab(this, 'scrawl-${i}')" role="tab">scrawl source</button>
        <button class="tab-btn" onclick="switchTab(this, 'mermaid-src-${i}')" role="tab">mermaid source</button>
        <button class="tab-btn" onclick="switchTab(this, 'mermaid-render-${i}')" role="tab">mermaid rendered</button>
      </div>

      <div id="scrawl-${i}" class="tab-panel active">
        <pre><code>${d.scrawl.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
      </div>

      <div id="mermaid-src-${i}" class="tab-panel">
        <pre><code>${d.mermaid.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
      </div>

      <div id="mermaid-render-${i}" class="tab-panel">
        <div class="mermaid-panel">
          <div class="mermaid" data-diagram="${i}">${d.mermaid.replace(/"/g, '&quot;')}</div>
        </div>
      </div>
    </div>`
    }).join('\n')}
  </div>

  <footer>
    <p style="margin-bottom:6px; font-size:12px">built with</p>
    <span>scrawl</span>
    <p style="margin-top:8px; font-size:11px; color:#a0aec0">
      style presets: sketch (wabi-sabi) &middot; rough (art brut) &middot; clean (geometric) &middot; architect (drafting) &middot; blueprint (engineering)
    </p>
  </footer>

  <div class="lightbox" id="lightbox" onclick="if(event.target===this)closeLightbox()">
    <div class="lightbox-inner">
      <button class="lightbox-close" onclick="closeLightbox()">&times;</button>
      <button class="lightbox-nav lightbox-prev" onclick="navLightbox(-1)">&lsaquo;</button>
      <button class="lightbox-nav lightbox-next" onclick="navLightbox(1)">&rsaquo;</button>
      <div class="lightbox-title" id="lb-title"></div>
      <div class="lightbox-preset" id="lb-preset"></div>
      <div class="lightbox-svg" id="lb-svg"></div>
    </div>
  </div>

  <script>
    const presetNames = ${JSON.stringify(STYLE_PRESETS)};
    let currentDiagram = 0, currentPresetIdx = 0;

    function openLightbox(diagramIdx, preset) {
      currentDiagram = diagramIdx;
      currentPresetIdx = presetNames.indexOf(preset);
      updateLightbox();
      document.getElementById('lightbox').classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      document.getElementById('lightbox').classList.remove('open');
      document.body.style.overflow = '';
    }

    function navLightbox(delta) {
      const total = presetNames.length;
      currentPresetIdx = (currentPresetIdx + delta + total) % total;
      updateLightbox();
    }

    function updateLightbox() {
      const cards = document.querySelectorAll('.card');
      const card = cards[currentDiagram];
      const title = card.querySelector('.card-title').textContent;
      const preset = presetNames[currentPresetIdx];
      const svgCell = card.querySelectorAll('.preset-svg')[currentPresetIdx];

      document.getElementById('lb-title').textContent = title;
      document.getElementById('lb-preset').textContent = preset;
      document.getElementById('lb-svg').innerHTML = svgCell.innerHTML;
    }

    document.addEventListener('keydown', (e) => {
      if (!document.getElementById('lightbox').classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navLightbox(-1);
      if (e.key === 'ArrowRight') navLightbox(1);
      if (e.key === 'ArrowUp') { currentDiagram = Math.max(0, currentDiagram - 1); updateLightbox(); }
      if (e.key === 'ArrowDown') { currentDiagram = Math.min(document.querySelectorAll('.card').length - 1, currentDiagram + 1); updateLightbox(); }
    });

    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' })

    function switchTab(btn, panelId) {
      const card = btn.closest('.card')
      card.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
      card.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
      btn.classList.add('active')
      const panel = document.getElementById(panelId)
      panel.classList.add('active')

      if (panelId.startsWith('mermaid-render-')) {
        const mermaidEl = panel.querySelector('.mermaid')
        if (mermaidEl && !mermaidEl.dataset.rendered) {
          mermaidEl.dataset.rendered = '1'
          const src = mermaidEl.textContent
          mermaid.render('m' + panelId, src).then(({ svg }) => {
            mermaidEl.innerHTML = svg
          }).catch(err => {
            mermaidEl.innerHTML = '<span style="color:#e53e3e;font-size:12px">Mermaid render error: ' + err.message + '</span>'
          })
        }
      }
    }
  <\/script>
</body>
</html>`

const outPath = `${process.env.HOME}/Desktop/scrawl-gallery.html`
writeFileSync(outPath, html, 'utf8')
console.log(`\nWritten: ${outPath}`)
execSync(`open "${outPath}"`)
console.log('Opened in browser.')
