// ---------------------------------------------------------------------------
// Expression Benchmark Worker
// Runs the expression evaluator 10,000 times and reports average timing.
// Receives: { tiles: ExpressionTile[], testValues: Record<string, number> }
// Posts back: { avgMs: number, result: number | null }
//
// tsconfig uses DOM lib (not WebWorker lib) so we shim the dedicated worker
// global the same way wsWorker.ts shims SharedWorkerGlobalScope.
// ---------------------------------------------------------------------------

import { evaluateExpression } from '../shared/components/expression/evaluator'
import type { ExpressionTile } from '../shared/types/expression'

interface BenchmarkRequest {
  tiles: ExpressionTile[]
  testValues: Record<string, number>
}

interface BenchmarkResponse {
  avgMs: number
  result: number | null
}

interface DedicatedWorkerGlobalScopeShim {
  onmessage: ((e: MessageEvent) => void) | null
  postMessage(data: unknown): void
}

const workerSelf = self as unknown as DedicatedWorkerGlobalScopeShim

workerSelf.onmessage = (e: MessageEvent<BenchmarkRequest>) => {
  const { tiles, testValues } = e.data
  const N = 10_000
  const t0 = performance.now()
  let result: number | null = null
  for (let i = 0; i < N; i++) {
    result = evaluateExpression(tiles, testValues, undefined)
  }
  const avgMs = (performance.now() - t0) / N
  const response: BenchmarkResponse = { avgMs, result }
  workerSelf.postMessage(response)
}
