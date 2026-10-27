# ExpressFlow: 100% Final Project & Implementation Report

**Course:** BCSE307P — Compiler Design Lab  
**Institution:** School of Computer Science & Engineering, Vellore Institute of Technology (VIT)  
**Project Title:** Ahead-of-Time Static Analysis and Control-Flow Verification of Express.js Middleware Architectures  
**Final Status:** 100% Implementation Complete (Frontend + Middle-End + Backend Security Verifier)

---

## 1. Executive Summary & Problem Formulation

In modern web application engineering, Express.js remains the de facto routing framework for Node.js. In Express, request lifecycle handling is based on the **Middleware Pattern**: requests pass through a sequence of functions before reaching the terminal business logic handler:

$$\text{Request} \longrightarrow M_0 \longrightarrow M_1 \longrightarrow \dots \longrightarrow M_k \longrightarrow \text{Handler} \longrightarrow \text{Response}$$

Because JavaScript is dynamic and weakly typed, route registrations are evaluated imperatively at runtime. This leads to critical architectural vulnerabilities that evade syntax checkers, linters, and type checkers:
1. **Unprotected Sensitive Operations:** Destructive endpoints (`DELETE /purge-cache`, `PUT /settings`) accidentally exposed without authentication guards.
2. **Misordered Security Checkpoints:** A developer accidentally passes an authentication middleware *after* the controller function in the argument list (e.g. `router.post('/drop-database', dropHandler, verifyAdmin)`). Because `dropHandler` terminates the HTTP request, `verifyAdmin` is never invoked, allowing unauthenticated execution without throwing any runtime error!
3. **Missing Rate-Limiting:** Authentication endpoints (`/login`) left unprotected against brute-force credential stuffing.

**ExpressFlow** solves these issues by treating the Express application as a formal programming language input, compiling it ahead-of-time through a 3-phase compiler pipeline:
- **Phase 1 (Frontend):** Lexical & AST parsing, scope symbol tracking, argument unrolling, and Intermediate Representation (IR) generation.
- **Phase 2 (Middle-End):** Cross-file module linking, hierarchical prefix route composition, and Control-Flow Graph (CFG) synthesis.
- **Phase 3 (Backend):** Iterative dataflow Dominator Tree calculation ($Dom(n), idom(n)$), security invariant verification ($A \text{ dom } H$), and diagnostic vulnerability reporting.

---

## 2. Division of Labor & Team Contributions

| Register No. | Name | Phase & Core Responsibilities |
| :--- | :--- | :--- |
| **24BCE0732** | **Krishna** | **Phase 1: Frontend AST Pipeline**<br>• Lexical and syntactic analysis via `@babel/parser`<br>• Dynamic Express scope & symbol table (`app` & `express.Router()` tracking)<br>• Recursive middleware array flattening and inline callback parameter extraction<br>• Source coordinate binding (`line`, `column`, `filePath`)<br>• Intermediate Representation (`manifest.json`) emission |
| **24BCE2584** | **Aaditya Jaiswal** | **Phases 2 & 3: Middle-End CFG Engine & Backend Security Analysis**<br>• Cross-file CommonJS/ESM module resolution and dependency graph traversal<br>• Hierarchical URL prefix composition across arbitrarily nested mounts<br>• Directed Control-Flow Graph (CFG) synthesis ($G = (V, E)$)<br>• Formal Dominator Tree dataflow engine ($Dom(n)$ & $idom(n)$)<br>• Security invariant model ($A \text{ dom } H$, execution order verification)<br>• Visualizers (ASCII, DOT, Mermaid) & diagnostic reporting engine |

---

## 3. Formal Compiler Design Architecture

```
                          [ Raw JavaScript/TypeScript Files ]
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ 1. FRONTEND PARSER PIPELINE                                                         │
│    • Lexer & Parser: Source Code ──> Abstract Syntax Tree (AST)                     │
│    • Symbol Tracker: Detects `express()` and `express.Router()` instances           │
│    • AST Visitor: Deconstructs `app.use()`, `router.get()`, `router.post()`, etc.   │
│    • Middleware Unroller: Recursively flattens nested arrays: [m1, [m2, m3]] ──> m* │
│    • Emits: JSON Intermediate Representation (IR) Manifest                          │
└──────────────────────────────────────────┬──────────────────────────────────────────┘
                                           │ IR Manifest Contract
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ 2. MIDDLE-END ROUTE & CFG ENGINE                                                    │
│    • Module Linker: Resolves `require('./routes/admin')` across files               │
│    • Path Composer: Computes prefix trees: `/api` + `/admin` + `/:id`               │
│    • CFG Synthesizer: Constructs formal Directed Graphs G = (V, E)                  │
│      - V: {ENTRY, GLOBAL_MW, ROUTE_MW, ACTION_HANDLER, EXIT}                         │
│      - E: Directed execution transition edges                                       │
└──────────────────────────────────────────┬──────────────────────────────────────────┘
                                           │ Route CFGs (Directed Graph G)
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ 3. BACKEND SECURITY VERIFIER & DOMINATOR ENGINE                                     │
│    • Dominator Tree Calculation: Iterative Forward Dataflow Equations               │
│      Dom(n) = {n} ∪ ( ∩_{p ∈ Pred(n)} Dom(p) )                                      │
│    • Security Invariant Checking:                                                   │
│      - Rule 1: Sensitive Op ⟹ ∃ Guard A: A dom H                                    │
│      - Rule 2: Guard A ⟹ order(A) < order(H)                                       │
│      - Rule 3: Admin Prefix Mount Isolation                                         │
│      - Rule 4: Credential Endpoint Rate-Limiting                                    │
│    • Diagnostic Reporter: Emits vulnerability cards with execution traces & fixes   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Formal Dataflow Dominator Algorithm

In formal compiler optimization, node $d$ dominates node $n$ ($d \text{ dom } n$) if every control-flow path from the entry node to $n$ must pass through $d$.

### 4.1. Mathematical Formulation
Let $G = (V, E)$ be a directed route CFG with entry node $r = \text{ENTRY}$. The dominator sets $Dom(n)$ satisfy:

$$Dom(r) = \{r\}$$

$$\forall n \in V \setminus \{r\}, \quad Dom(n) = \{n\} \cup \left( \bigcap_{p \in Pred(n)} Dom(p) \right)$$

### 4.2. Implementation in ExpressFlow (`src/middleend/analysis/dominatorTree.ts`)
```typescript
// Iterative Fixed-Point Dominator Algorithm
export function computeDominatorTree(cfg: RouteCfg): DominatorTree {
  const allNodeIds = cfg.nodes.map(n => n.id);
  const entryId = cfg.entryNodeId;
  const dom = new Map<string, Set<string>>();

  // Initialization: Dom(entry) = {entry}; Dom(n) = V for all n != entry
  dom.set(entryId, new Set([entryId]));
  for (const nodeId of allNodeIds) {
    if (nodeId !== entryId) {
      dom.set(nodeId, new Set(allNodeIds));
    }
  }

  // Iterative relaxation until fixed point
  let changed = true;
  while (changed) {
    changed = false;
    for (const nodeId of allNodeIds) {
      if (nodeId === entryId) continue;

      const predecessors = predMap.get(nodeId) || [];
      let intersection: Set<string>;

      if (predecessors.length === 0) {
        intersection = new Set();
      } else {
        intersection = new Set(dom.get(predecessors[0])!);
        for (let i = 1; i < predecessors.length; i++) {
          const predDom = dom.get(predecessors[i])!;
          intersection = new Set([...intersection].filter(x => predDom.has(x)));
        }
      }

      const newDom = new Set([nodeId, ...intersection]);
      const currentDom = dom.get(nodeId)!;
      if (newDom.size !== currentDom.size || [...newDom].some(x => !currentDom.has(x))) {
        dom.set(nodeId, newDom);
        changed = true;
      }
    }
  }
  ...
}
```

---

## 5. Security Invariant Rules & Diagnostic Verification

ExpressFlow enforces four formal security invariants across every synthesized CFG:

### Invariant 1: Auth-Before-Sensitive (`RULE_1_AUTH_BEFORE_SENSITIVE`)
- **Condition:** Route executes a sensitive HTTP method (`DELETE`, `PUT`, `PATCH`) or targets a privileged resource (`/admin`, `/purge`, `/delete`, `/drop`).
- **Formal Invariant:**
  $$\exists A \in \text{AuthGuards}(R) \quad \text{such that} \quad A \text{ dom } H$$
- **Severity:** `CRITICAL`

### Invariant 2: Misordered Security Checkpoint (`RULE_2_MISORDERED_SECURITY_GUARD`)
- **Condition:** An authentication guard exists in the route chain, but was registered after the controller handler:
  $$\text{executionOrder}(A) > \text{executionOrder}(H)$$
- **Formal Invariant Violation:**
  $$A \in \text{AuthGuards}(R) \centernot\implies \text{executionOrder}(A) < \text{executionOrder}(H)$$
- **Severity:** `CRITICAL` (The handler finishes the response, bypassing authentication entirely).

### Invariant 3: Unprotected Administrative Mount (`RULE_3_UNPROTECTED_ADMIN_MOUNT`)
- **Condition:** Sub-router is mounted on an administrative prefix (e.g. `app.use('/api/admin', ...)`), but individual routes lack access control.
- **Severity:** `HIGH`

### Invariant 4: Brute-Force Rate Limiting (`RULE_4_MISSING_RATE_LIMIT`)
- **Condition:** Endpoint handles credentials or sensitive identity tokens (`/login`, `/register`, `/token`).
- **Formal Invariant:**
  $$\exists L \in \text{RateLimiters}(R) \quad \text{such that} \quad L \text{ dom } H$$
- **Severity:** `MEDIUM`

---

## 6. Experimental Validation & Benchmark Results

We evaluated ExpressFlow against three distinct test fixtures:
1. `sample-app.js`: Complex single-file application with nested middleware arrays, inline closures, and sub-router mounts.
2. `modular-app/`: Multi-file production-grade Express application with cross-file CommonJS module imports.
3. `vulnerable-app/`: Realistic Express application with intentionally injected security vulnerabilities.

### Summary Results Table

| Target Fixture | Files | Routers | Composed Routes | CFGs Synthesized | Vulnerabilities Found | Strict Audit Exit Code |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `sample-app.js` | 1 | 2 | 4 | 4 | 0 | 0 (Clean) |
| `modular-app` | 3 | 3 | 4 | 4 | 0 | 0 (Clean) |
| `vulnerable-app` | 4 | 4 | 8 | 8 | 3 | 1 (Fail) |

### Discovered Vulnerabilities in `vulnerable-app`

1. **`DELETE /api/admin/purge-cache` [CRITICAL]**
   - **Violation:** Sensitive `DELETE` operation has no authentication guard before terminal handler `purgeCacheHandler`.
   - **Trace:** `ENTRY ──> express.json ──> [💥 VULNERABLE GAP] ──> purgeCacheHandler ──> EXIT`
   - **Remediation:** Add `verifyToken` / `verifyAdmin` prior to `purgeCacheHandler`.

2. **`POST /api/admin/drop-database` [CRITICAL]**
   - **Violation:** Security guard `verifyAdmin` is registered *after* `dropDatabaseHandler`.
   - **Trace:** `ENTRY ──> express.json ──> dropDatabaseHandler ──> [💥 VULNERABLE GAP] verifyAdmin ──> EXIT`
   - **Remediation:** Reorder arguments so `verifyAdmin` executes first.

3. **`POST /api/auth/login` [MEDIUM]**
   - **Violation:** Public credential endpoint lacks rate-limiting middleware.
   - **Trace:** `ENTRY ──> express.json ──> [💥 VULNERABLE GAP] ──> loginHandler ──> EXIT`
   - **Remediation:** Attach `rateLimit({ max: 5 })` to prevent brute-force attacks.

---

## 7. Automated Test Suite Verification

The automated test suite (`npm test` / `test/run-test.js`) executes 18 unit and integration tests across all three compiler phases:

```
[Phase 1: Frontend AST Pipeline]
  ✓ Test 1: Source AST generation and Babel parsing
  ✓ Test 2: Application and sub-router symbol identification
  ✓ Test 3: Route registration deconstruction and nested array flattening
  ✓ Test 4: Sub-router prefix mount detection
  ✓ Test 5: CommonJS and ESM export tracking
  ✓ Test 6: Full multi-file manifest serialization

[Phase 2: Middle-End CFG Engine]
  ✓ Test 7: Middle-end pipeline execution and root app discovery
  ✓ Test 8: Route hierarchy and cumulative path composition
  ✓ Test 9: Directed Control-Flow Graph construction and edge invariants
  ✓ Test 10: Multi-file symbol and module resolution
  ✓ Test 11: Cross-file route composition
  ✓ Test 12: Visual CFG export generation (ASCII, DOT, Mermaid)

[Phase 3: Backend Security Verifier]
  ✓ Test 13: Graph Dominator Tree construction and dominance proofs
  ✓ Test 14: Full audit on vulnerable project target (vulnerable-app)
  ✓ Test 15: Invariant Rule 1 verification (Auth-Before-Sensitive)
  ✓ Test 16: Invariant Rule 2 verification (Misordered Checkpoints)
  ✓ Test 17: Invariant Rule 4 verification (Rate-Limiting on Credentials)
  ✓ Test 18: Zero false-positive verification on clean modular project

Result: 18 / 18 Tests Passed (100% Success Rate)
```

---

## 8. Conclusion & Deliverables

ExpressFlow is now **100% complete**, fully implementing every requirement for Review 1, Review 2, and the Final Review 3:
1. **Frontend AST Parser:** Robust, location-aware AST extraction and IR manifest builder.
2. **Middle-End Engine:** Cross-file module linking and formal directed CFG synthesizer.
3. **Backend Verifier:** Dominator tree dataflow engine and automated security invariant checker.
4. **Tooling & Reports:** Diagnostic vulnerability cards, terminal ASCII graphs, DOT and Mermaid exporters, `--strict` CI/CD flag, and complete automated test suite.
