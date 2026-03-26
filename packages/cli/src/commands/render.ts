import { writeFileSync } from 'fs'
import { renderDiagram } from '@scrawl/core'
import { readInput, parseArgs } from '../utils/stdin.js'
import type { RenderOptions } from '@scrawl/core'

export async function renderCommand(args: string[]): Promise<void> {
  const { file, flags } = parseArgs(args)
  const source = await readInput(file)

  const options: RenderOptions = {}
  if (flags['theme'] && (flags['theme'] === 'rough' || flags['theme'] === 'clean')) {
    options.theme = flags['theme']
  }

  const svg = renderDiagram(source, options)
  const format = flags['f'] ?? flags['format'] ?? 'svg'
  const output = flags['o'] ?? flags['output']

  if (format === 'png') {
    if (!output || typeof output !== 'string') {
      throw new Error('PNG output requires -o <path> flag')
    }
    const png = await svgToPng(svg)
    writeFileSync(output, png)
    console.error(`Written: ${output}`)
  } else {
    if (output && typeof output === 'string') {
      writeFileSync(output, svg, 'utf8')
      console.error(`Written: ${output}`)
    } else {
      process.stdout.write(svg)
    }
  }
}

async function svgToPng(svg: string): Promise<Buffer> {
  // Dynamic import so PNG support is optional (doesn't fail if resvg-js unavailable)
  try {
    const { Resvg } = await import('@resvg/resvg-js')
    const resvg = new Resvg(svg, { font: { loadSystemFonts: false } })
    const pngData = resvg.render()
    return Buffer.from(pngData.asPng())
  } catch {
    throw new Error('PNG rendering requires @resvg/resvg-js. Run: npm install @resvg/resvg-js')
  }
}
