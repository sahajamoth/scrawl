import { readInput, parseArgs } from '../utils/stdin.js'

// Rough token estimate: GPT-style tokenization ≈ 4 chars per token
// TOML is dense; scrawl uses single-char keys — approximately 3-4 chars/token
function estimateTokens(source: string): number {
  // Strip comments and count non-whitespace content
  const stripped = source
    .split('\n')
    .filter(line => !line.trimStart().startsWith('#'))
    .join('\n')
  return Math.ceil(stripped.length / 3.5)
}

export async function tokensCommand(args: string[]): Promise<void> {
  const { file } = parseArgs(args)
  const source = await readInput(file)
  const tokens = estimateTokens(source)
  const chars = source.length
  console.log(`~${tokens} tokens (${chars} chars)`)
}
