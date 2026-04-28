import { renderCommand } from './commands/render.js'
import { validateCommand } from './commands/validate.js'
import { tokensCommand } from './commands/tokens.js'

const [,, cmd, ...args] = process.argv

const help = `
scrawl — hand-drawn diagrams from line-oriented text

Usage:
  scrawl render [file] [options]   Render a .scrawl diagram to SVG or PNG
  scrawl validate [file]           Validate a .scrawl file (exit 0=ok, 1=error)
  scrawl tokens [file]             Count approximate LLM token cost

Options for render:
  -o, --output <path>    Output file path (default: stdout for SVG)
  -f, --format <fmt>     Output format: svg | png  (default: svg)
  --theme <theme>        Override theme: rough | clean
  --style <preset>       Override style: sketch | rough | clean | architect | blueprint
  --no-font              Skip font embed (smaller SVG, needs Permanent Marker installed)

File argument is optional: omit to read from stdin.
`.trim()

async function main() {
  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(help)
    process.exit(0)
  }

  try {
    switch (cmd) {
      case 'render':
        await renderCommand(args)
        break
      case 'validate':
        await validateCommand(args)
        break
      case 'tokens':
        await tokensCommand(args)
        break
      default:
        console.error(`Unknown command: ${cmd}\n`)
        console.log(help)
        process.exit(1)
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}

main()
