import { readFileSync } from 'fs'
import { isatty } from 'tty'

export async function readInput(filePath?: string): Promise<string> {
  if (filePath) {
    return readFileSync(filePath, 'utf8')
  }
  // Read from stdin
  if (isatty(0)) {
    throw new Error('No file provided and stdin is a TTY. Provide a file path or pipe input.')
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    process.stdin.on('data', chunk => chunks.push(chunk))
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    process.stdin.on('error', reject)
  })
}

export function parseArgs(args: string[]): { file?: string; flags: Record<string, string | boolean> } {
  const flags: Record<string, string | boolean> = {}
  let file: string | undefined

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('-')) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1)
      const next = args[i + 1]
      if (next && !next.startsWith('-')) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    } else if (!file) {
      file = arg
    }
  }

  return { file, flags }
}
