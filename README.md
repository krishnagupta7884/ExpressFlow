# ExpressFlow

> **Semantic Static Analysis of Express.js Middleware Architectures**  
> *A specialized ahead-of-time compiler tool that constructs Control-Flow Graphs (CFGs) from Express.js source code and verifies path-reachability security invariants using formal Dominator Tree analysis.*

---

## 📌 Project Overview

In Express.js applications, security checkpoints (such as authentication, authorization, and rate limiting) are executed as sequentially chained middleware functions. Because JavaScript allows middlewares to be attached dynamically, developers can inadvertently omit authentication or misorder handlers (e.g., executing a sensitive handler before an authentication guard). Such code is syntactically valid and fails silently without throwing runtime exceptions.

**ExpressFlow** addresses this vulnerability class through **Ahead-Of-Time (AOT) Static Program Analysis**. It parses JavaScript/TypeScript source code into an Abstract Syntax Tree (AST), extracts routing definitions and ordered middleware chains, compiles them into a structured Intermediate Representation (IR), synthesizes formal Control-Flow Graphs (CFGs), and runs formal **Dominator Tree reachability verification** to detect architectural security flaws before deployment.

---

## 👥 Team & Division of Responsibilities

| Register No. | Name | Role & Planned Contribution |
| :--- | :--- | :--- |
| **24BCE0732** | **Krishna** | **Frontend Pipeline & AST Engineering:** Lexical and syntactic analysis, ESTree/Babel AST generation, Express scope & symbol tracking, route/middleware argument deconstruction, and IR manifest serialization. |
| **24BCE2584** | **Aaditya Jaiswal** | **Middle-End Engine & Backend Security Analysis:** Cross-file module linking, prefix tree URL composition, Control-Flow Graph (CFG) generation, formal Dominator Tree ($Dom(n)$) computation, and security invariant verification. |

---

## 🏗️ Complete System Architecture (100% Implementation)

```
+===================================================================================+
|                                EXPRESSFLOW COMPILER SYSTEM                        |
+===================================================================================+
|                                                                                   |
|   [ Source Files (.js / .ts) ]                                                    |
|                |                                                                  |
|   =============v======================================                            |
|   PHASE 1: FRONTEND AST PARSER (Lead: Krishna)                                    |
|     1. Lexical & Syntactic Parsing (Source -> AST via @babel/parser)              |
|     2. Express Identifier Tracking (Detect `app` & `express.Router()`)            |
|     3. AST Visitor Engine (Extract `app.use`, `app.get`, `router.post`, etc.)     |
|     4. Argument Unpacking (Route Paths, Nested Arrays, Inline Callbacks)          |
|     5. Source Coordinate Tagging (`line`, `column`, `filePath`)                   |
|     6. IR Serialization (Emits `manifest.json`)                                   |
|   =============|======================================                            |
|                |                                                                  |
|                | Handoff Contract (Intermediate Representation JSON)              |
|                v                                                                  |
|   =============v======================================                            |
|   PHASE 2: MIDDLE-END CFG ENGINE (Lead: Aaditya Jaiswal)                          |
|     1. Cross-File Symbol & Module Resolver (`require` / `import` linking)         |
|     2. URL Prefix Tree & Path Composer (Cumulative sub-router mount calculation)   |
|     3. Directed Control-Flow Graph (CFG) Synthesis ($V, E$)                       |
|     4. Multi-Format Visualizers (ASCII Flowcharts, Graphviz DOT, Mermaid diagrams) |
|   =============|======================================                            |
|                |                                                                  |
|                | Composed Route CFGs ($G = (V, E)$)                               |
|                v                                                                  |
|   =============v======================================                            |
|   PHASE 3: BACKEND SECURITY VERIFIER (Lead: Aaditya Jaiswal)                      |
|     1. Dominator Tree Construction: Iterative Dataflow Framework ($Dom(n), idom$) |
|     2. Invariant Rule 1: Auth-Before-Sensitive ($A \text{ dom } H$)                |
|     3. Invariant Rule 2: Execution Ordering Invariant ($\text{order}(A) < \text{order}(H)$)|
|     4. Invariant Rule 3: Unprotected Administrative Mount Isolation               |
|     5. Invariant Rule 4: Brute-Force Rate-Limiting Enforcement ($L \text{ dom } H$)|
|     6. Diagnostic Vulnerability Reporter (Trace, Invariant Formula & Remediation) |
+===================================================================================+
```

---

## ✨ Features

### Phase 1: Frontend Pipeline (Krishna)
- **AST-Based Parsing:** Uses `@babel/parser` to parse ECMAScript, TypeScript, and JSX with full source location (`line`, `column`) fidelity.
- **Dynamic Scoped Symbol Table:** Discovers Express applications and sub-routers (`express()`, `express.Router()`) regardless of identifier naming.
- **Recursive Middleware Flattening:** Accurately unrolls arbitrarily nested middleware arrays (e.g., `[rateLimit, [verifyToken, validateCart]]` $\rightarrow$ linear execution order: $0, 1, 2, 3$).
- **Anonymous & Inline Handler Isolation:** Differentiates between named middleware identifiers and anonymous inline callback signatures (`(req, res, next) => { ... }`).
- **Sub-Router Mount Tracking:** Detects prefix mounting (e.g., `app.use('/api/users', userRouter)`).
- **Module Export Recording:** Tracks CommonJS (`module.exports`) and ESM (`export default`) router exports for cross-file linking.

### Phase 2: Middle-End CFG Engine (Aaditya Jaiswal)
- **Cross-File Symbol & Module Resolver:** Resolves `require()` and `import` references across separate modules and directories.
- **URL Prefix Tree & Route Composer:** Computes cumulative endpoints across arbitrarily nested sub-router mounts (e.g. `/api` + `/admin` + `/purge-cache` $\rightarrow$ `DELETE /api/admin/purge-cache`).
- **Control-Flow Graph (CFG) Generator:** Constructs formal directed graphs ($V, E$) capturing the exact execution progression of middlewares from `ENTRY` to `MIDDLEWARE_N`, `CONTROLLER_HANDLER`, and `EXIT`.
- **CFG Visualizers & Exporters:** Generates instant terminal ASCII flowcharts, Graphviz DOT representations, and Mermaid diagram code for reports and slides.

### Phase 3: Backend Security Analysis & Dominator Verifier (Aaditya Jaiswal)
- **Formal Dominator Tree Computation:** Computes $Dom(n)$ and immediate dominator $idom(n)$ using the classical iterative forward dataflow equations:
  $$Dom(n) = \{n\} \cup \left( \bigcap_{p \in Pred(n)} Dom(p) \right)$$
- **Invariant Rule 1 (Auth-Before-Sensitive):** Statically proves whether a sensitive endpoint (`DELETE`, `PUT`, `PATCH`, `/admin`, `/purge`, etc.) is guarded by an authentication checkpoint ($A \text{ dom } H$).
- **Invariant Rule 2 (Misordered Security Checkpoints):** Detects execution order inversions where a security guard is mistakenly registered after a business logic controller in the route handler chain.
- **Invariant Rule 3 (Unprotected Administrative Mounts):** Ensures all routes grouped under administrative prefix trees enforce privileged authorization.
- **Invariant Rule 4 (Brute-Force Rate Limiting):** Ensures public authentication endpoints (`/login`, `/register`) enforce rate-limiting throttles before processing credentials.
- **Diagnostic Vulnerability Reporter:** Formats vulnerability diagnostic cards with severity badges (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), formal invariant definitions, control-flow execution traces with highlighted vulnerable gaps, and actionable code remediation steps.

---

## 📁 Repository Structure

```
ExpressFlow/
├── package.json                 # Project dependencies and npm scripts
├── tsconfig.json                # TypeScript compiler configuration
├── .gitignore                   # Standard ignore rules (node_modules, dist, etc.)
├── README.md                    # Project documentation
├── FINAL_PROJECT_REPORT.md      # Comprehensive academic & technical project report
├── FRONTEND_IMPLEMENTATION.md   # Complete frontend architectural specification
│
├── src/
│   ├── index.ts                 # CLI Entry point & orchestrator (Phases 1, 2, 3)
│   │
│   ├── shared/
│   │   └── types/
│   │       └── manifest.ts      # Shared Intermediate Representation (IR) contract
│   │
│   ├── frontend/                # Phase 1: Frontend AST Pipeline (Krishna)
│   │   ├── index.ts             # Frontend public API
│   │   ├── parser/
│   │   │   ├── astParser.ts     # Location-aware Babel parser wrapper
│   │   │   └── fileLoader.ts    # Recursive file crawler and disk reader
│   │   ├── scope/
│   │   │   └── symbolTracker.ts # Identifies Express applications and router instances
│   │   ├── visitor/
│   │   │   ├── argumentExtractor.ts  # Route path & middleware array deconstructor
│   │   │   ├── routeVisitor.ts       # AST visitor for route registrations and mounts
│   │   │   └── exportTracker.ts      # CommonJS and ESM router export tracker
│   │   └── serializer/
│   │       └── manifestBuilder.ts    # Emits the unified JSON IR manifest
│   │
│   └── middleend/               # Phase 2 & 3: Middle-End CFG & Security Verifier (Aaditya Jaiswal)
│       ├── index.ts             # Middle-end public API
│       ├── types/
│       │   └── cfg.ts           # CFG node, edge, and graph definitions
│       ├── resolver/
│       │   ├── moduleResolver.ts     # Cross-file CommonJS/ESM module linker
│       │   └── routeComposer.ts      # Hierarchical URL mount path calculator
│       ├── cfg/
│       │   └── cfgBuilder.ts         # Directed Control-Flow Graph synthesis engine
│       ├── visualizer/
│       │   ├── asciiGraph.ts         # Terminal ASCII flowchart renderer
│       │   ├── dotGenerator.ts       # Graphviz DOT format exporter
│       │   └── mermaidGenerator.ts   # Mermaid markdown diagram generator
│       ├── analysis/
│       │   ├── dominatorTree.ts      # Formal iterative dominator tree algorithm
│       │   ├── securityModel.ts      # Security violation definitions & rules
│       │   └── securityChecker.ts    # Invariant verification engine
│       └── reporter/
│           └── terminalReporter.ts   # Diagnostic security report renderer
│
├── test/
│   ├── fixtures/
│   │   ├── sample-app.js        # Single-file complex routing test fixture
│   │   ├── modular-app/         # Multi-file secure modular Express architecture
│   │   └── vulnerable-app/      # Realistic Express application with intentional flaws
│   ├── middleend.test.ts        # Unit test suite for CFG construction & resolvers
│   ├── security.test.ts         # Unit test suite for Dominator Trees & Invariants
│   └── run-test.js              # Complete 18-test automated verification runner
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.x or later (tested on Node.js LTS v24.x)
- **npm**: v9.x or later

### Installation

```bash
git clone https://github.com/krishnagupta7884/ExpressFlow.git
cd ExpressFlow
npm install
```

### Build

Compile TypeScript source code to `dist/`:
```bash
npm run build
```

### Running Tests

Execute the automated test suite verifying all 18 test cases across all three compiler phases:
```bash
npm test
```

Expected output:
```
================================================================================
 EXPRESSFLOW AUTOMATED COMPREHENSIVE TEST SUITE (100% IMPLEMENTATION)
================================================================================

>>> PART 1: FRONTEND PIPELINE (Lexical, AST & Manifest IR) <<<
[Test 1] Parsing fixture and analyzing AST...
[Test 2] Verifying Discovered Routers... (APPLICATION & ROUTER)
[Test 3] Verifying Extracted Routes... (Global, static, nested arrays, callbacks)
[Test 4] Verifying Sub-Router Mounts... (app.use('/api/users', userRouter))
[Test 5] Verifying Exports... (CommonJS module.exports)
[Test 6] Verifying Full Project Manifest Builder... (8 files indexed)

>>> PART 2: MIDDLE-END ENGINE (Module Resolution, Route Composition & CFG) <<<
[Test 7] Running Middle-End Pipeline on sample-app fixture...
[Test 8] Verifying Route Hierarchy & Prefix Composition...
[Test 9] Verifying Control-Flow Graph (CFG) Construction & Graph Invariants...
[Test 10] Verifying Cross-File Symbol & Module Resolution (modular-app)...
[Test 11] Verifying Cross-File Route Composition...
[Test 12] Verifying CFG Visualization Generation (ASCII, DOT, Mermaid)...

>>> PART 3: BACKEND SECURITY ENGINE (Dominator Reachability & Invariants) <<<
[Test 13] Verifying Graph Dominator Tree Construction on CFG...
[Test 14] Auditing Vulnerable Project Target (vulnerable-app)...
[Test 15] Verifying Invariant Rule 1: Auth-Before-Sensitive...
[Test 16] Verifying Invariant Rule 2: Misordered Security Checkpoint...
[Test 17] Verifying Invariant Rule 4: Brute-Force Rate Limiting...
[Test 18] Verifying Clean Project (modular-app) Passes Security Audit...

================================================================================
🎉 ALL 18 TESTS PASSED! EXPRESSFLOW 100% IMPLEMENTATION IS COMPLETE!
================================================================================
```

---

## 💻 CLI Usage

Run ExpressFlow on any Express.js codebase:

```bash
# Full static security audit (Endpoint table + Diagnostic Vulnerability Report):
node dist/index.js ./test/fixtures/vulnerable-app

# Render visual ASCII Control-Flow Graphs (CFGs) for each route:
node dist/index.js ./test/fixtures/vulnerable-app --cfg

# Generate Graphviz DOT representations for external visualization:
node dist/index.js ./test/fixtures/vulnerable-app --dot

# Fail with non-zero exit code on CRITICAL / HIGH security findings (CI/CD integration):
node dist/index.js ./test/fixtures/vulnerable-app --strict

# Output machine-readable JSON security audit report:
node dist/index.js ./test/fixtures/vulnerable-app --json

# Run on clean modular application:
node dist/index.js ./test/fixtures/modular-app
```

---

## 🛡️ Formal Security Verification Model

ExpressFlow translates Express routing definitions into directed Control-Flow Graphs $G = (V, E)$, where $V$ includes `ENTRY`, middleware steps $\{M_0, M_1, \dots, M_k\}$, terminal `ACTION_HANDLER`, and `EXIT`.

### Dominance Invariant
A node $d$ dominates node $n$ ($d \text{ dom } n$) if every path from `ENTRY` to $n$ in $G$ must pass through $d$.

$$\forall p \in \text{Paths}(ENTRY \rightarrow n), \quad d \in p$$

### Enforced Invariant Rules

1. **Rule 1: Auth-Before-Sensitive (`RULE_1_AUTH_BEFORE_SENSITIVE`)**
   For any route $R$ executing a destructive or sensitive operation (e.g. `DELETE`, `PUT`, `/admin`, `/purge`):
   $$\exists A \in \text{AuthGuards}(R) \quad \text{such that} \quad A \text{ dom } H$$
   *If no authenticating guard dominates the handler, a **CRITICAL** vulnerability is flagged.*

2. **Rule 2: Misordered Security Checkpoint (`RULE_2_MISORDERED_SECURITY_GUARD`)**
   Security checks must precede action handlers in the execution order:
   $$A \in \text{AuthGuards}(R) \implies \text{executionOrder}(A) < \text{executionOrder}(H)$$
   *If an authentication guard is placed after an action handler, a **CRITICAL** execution order inversion is flagged.*

3. **Rule 3: Unprotected Admin Mount (`RULE_3_UNPROTECTED_ADMIN_MOUNT`)**
   All routes registered under administrative prefixes (`/admin`) must enforce role or privilege checks.

4. **Rule 4: Missing Rate Limiting (`RULE_4_MISSING_RATE_LIMIT`)**
   All public credential entrypoints (e.g., `POST /login`, `POST /register`) must enforce throttling:
   $$\exists L \in \text{RateLimiters}(R) \quad \text{such that} \quad L \text{ dom } H$$

---

## 📚 Course Information

- **Course:** BCSE307P – Compiler Design Lab
- **Milestone:** Review 3 (100% Final Implementation — AST Frontend + Middle-End CFG Engine + Backend Dominator Security Verifier)
- **Institution:** Vellore Institute of Technology (VIT)
