import { describe, it, expect } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkHtml from 'remark-html'
import remarkScrawl from '../index.js'

const SIMPLE_DIAGRAM = `lr
a:Start->b:End`

describe('remarkScrawl', () => {
  it('transforms scrawl code blocks to inline SVG', async () => {
    const file = await unified()
      .use(remarkParse)
      .use(remarkScrawl)
      .use(remarkHtml, { sanitize: false })
      .process(`\`\`\`scrawl\n${SIMPLE_DIAGRAM}\n\`\`\``)

    const html = String(file)
    expect(html).toContain('<div class="scrawl-diagram">')
    expect(html).toContain('<svg')
    expect(html).not.toContain('```scrawl')
  })

  it('transforms scrawl blocks to img when mode=img', async () => {
    const file = await unified()
      .use(remarkParse)
      .use(remarkScrawl, { mode: 'img' })
      .use(remarkHtml, { sanitize: false })
      .process(`\`\`\`scrawl\n${SIMPLE_DIAGRAM}\n\`\`\``)

    const html = String(file)
    expect(html).toContain('<img src="data:image/svg+xml;base64,')
    expect(html).not.toContain('<svg')
  })

  it('leaves non-scrawl code blocks unchanged', async () => {
    const file = await unified()
      .use(remarkParse)
      .use(remarkScrawl)
      .use(remarkHtml, { sanitize: false })
      .process('```javascript\nconsole.log("hello")\n```')

    const html = String(file)
    expect(html).toContain('console.log')
    expect(html).not.toContain('scrawl-diagram')
  })

  it('renders error div on invalid scrawl', async () => {
    const file = await unified()
      .use(remarkParse)
      .use(remarkScrawl)
      .use(remarkHtml, { sanitize: false })
      .process('```scrawl\nnot valid toml ===\n```')

    const html = String(file)
    expect(html).toContain('scrawl-error')
  })

  it('supports custom className', async () => {
    const file = await unified()
      .use(remarkParse)
      .use(remarkScrawl, { className: 'my-diagram' })
      .use(remarkHtml, { sanitize: false })
      .process(`\`\`\`scrawl\n${SIMPLE_DIAGRAM}\n\`\`\``)

    const html = String(file)
    expect(html).toContain('class="my-diagram"')
  })
})
