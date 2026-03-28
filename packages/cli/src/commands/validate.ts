import { parseDiagram } from 'scrawl-core'
import { readInput, parseArgs } from '../utils/stdin.js'

export async function validateCommand(args: string[]): Promise<void> {
  const { file } = parseArgs(args)
  const source = await readInput(file)

  try {
    const diagram = parseDiagram(source)
    const nodeCount = diagram.nodes.length
    const edgeCount = diagram.edges.length
    const groupCount = diagram.groups.length
    console.log(`✓ Valid: ${nodeCount} node${nodeCount !== 1 ? 's' : ''}, ${edgeCount} edge${edgeCount !== 1 ? 's' : ''}, ${groupCount} group${groupCount !== 1 ? 's' : ''}`)
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}
