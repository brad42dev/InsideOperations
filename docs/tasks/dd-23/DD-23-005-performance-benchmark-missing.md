---
id: DD-23-005
title: Implement 10k-iteration performance benchmark in Web Worker for Test button
unit: DD-23
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When the user clicks Test, the expression is evaluated 10,000 times to produce a reliable per-evaluation timing estimate. This runs in a dedicated Web Worker with a 5-second timeout. The result is shown as a colored message (green/yellow/orange/red) based on timing thresholds. If the expression is too slow or times out, the user is warned before applying.

## Spec Excerpt (verbatim)

> When a test is run, the system: 1. Compiles the tile arrangement into an evaluable expression. 2. Runs the evaluation **10,000 times** to get reliable timing. 3. Calculates average time per evaluation.
> **Timeout**: Benchmarking runs in a **Web Worker** with a 5-second timeout. If the worker does not complete in 5 seconds, it is terminated and the user is informed.
> — design-docs/23_EXPRESSION_BUILDER.md, §9.2

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:1414–1451` — current test panel; does a single synchronous `evaluateExpression` call
- `frontend/src/shared/components/expression/evaluator.ts` — client-side evaluator; must be importable by a Worker
- `frontend/src/workers/` — existing worker directory; check if an expression worker file can go here

## Verification Checklist

- [ ] A `frontend/src/workers/expressionBenchmark.worker.ts` file exists
- [ ] The worker receives `{ tiles, testValues }`, evaluates 10,000 times, and posts back `{ avgMs, result }`
- [ ] The worker is terminated after 5 seconds if no response
- [ ] Test panel renders one of four colored messages based on thresholds (< 0.1ms green, 0.1–1ms yellow, 1–10ms orange, > 10ms red)
- [ ] Static analysis runs before execution: warns on nested exponentiation, potential divide-by-zero, > 100 operations

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: Lines 1415–1451 show a test panel that calls `evaluateExpression(state.tiles, testNumericValues, undefined)` once synchronously and displays the result. No Worker, no iteration count, no timing, no threshold coloring.

## Fix Instructions (if needed)

1. Create `frontend/src/workers/expressionBenchmark.worker.ts`:
   ```typescript
   import { evaluateExpression } from '../shared/components/expression/evaluator'
   self.onmessage = (e) => {
     const { tiles, testValues } = e.data
     const N = 10_000
     const t0 = performance.now()
     let result: number | null = null
     for (let i = 0; i < N; i++) {
       result = evaluateExpression(tiles, testValues)
     }
     const avgMs = (performance.now() - t0) / N
     self.postMessage({ avgMs, result })
   }
   ```
2. In ExpressionBuilder.tsx, replace the synchronous eval in the test panel with a Worker call:
   - `const worker = new Worker(new URL('../../workers/expressionBenchmark.worker.ts', import.meta.url), { type: 'module' })`
   - Set a 5-second timeout: `const timeout = setTimeout(() => { worker.terminate(); /* show timeout message */ }, 5000)`
   - `worker.onmessage = ({ data }) => { clearTimeout(timeout); /* render result */ }`
   - `worker.postMessage({ tiles: state.tiles, testValues: testNumericValues })`
3. Color the result message per the thresholds in spec §9.2.
4. Add static analysis checks before launching the worker: scan for nested power ops, division by constant 0, and total tile count > 100. Show warnings inline.

Do NOT:
- Block the main thread — the benchmark must run in a Worker
- Show timing when expression has validation errors — only run benchmark on valid expressions
