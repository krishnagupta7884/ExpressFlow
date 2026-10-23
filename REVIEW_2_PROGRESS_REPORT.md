# ExpressFlow: Review 2 Progress Report (75% Implementation)

**Course:** BCSE307P – Compiler Design Lab  
**Institution:** Vellore Institute of Technology (VIT)  
**Project Title:** ExpressFlow: Semantic Static Analysis of Express.js Middleware Architectures  
**Milestone:** Review 2 (75% Implementation Phase)  
**Date:** October 2026  

---

## 👥 Student & Team Information

| S. No. | Register No. | Name | Allocated Domain & Contribution | Implementation Status |
| :--- | :--- | :--- | :--- | :---: |
| 1 | **24BCE0732** | **Krishna** | **Frontend Pipeline:** Lexical and syntactic analysis, ESTree/Babel AST generation, Express scope and symbol tracking, route/middleware argument deconstruction, and IR manifest serialization. | **100% Completed** |
| 2 | **24BCE2584** | **Aaditya Jaiswal** | **Middle-End Engine:** Cross-file module linking, prefix tree URL composition, Control-Flow Graph (CFG) generation, and multi-format graph exporters. | **100% Completed (Review 2 Scope)** |

---

## 📌 Executive Summary

Modern web services built on Express.js rely entirely on sequentially chained middleware functions for security enforcement (e.g., CORS, authentication, authorization, rate limiting). Because JavaScript is dynamically typed and middlewares are attached dynamically at runtime, missing security guards or misordered chains fail silently without throwing compile-time or runtime syntax errors.

**ExpressFlow** addresses this vulnerability class using **Ahead-Of-Time (AOT) Static Program Analysis**. 

In **Review 1 (25% Milestone)**, the team successfully completed the **Frontend Pipeline**, transforming raw JavaScript/TypeScript source code into a strictly validated **Intermediate Representation (IR) Manifest**.

In **Review 2 (75% Milestone)**, the team has implemented the complete **Middle-End Engine**, which:
1. Ingests the IR Manifest and resolves cross-file module imports, exports, and router symbols.
2. Computes the URL prefix hierarchy and composed endpoints across nested sub-router trees.
3. Constructs formal, directed **Control-Flow Graphs (CFGs)** representing the exact execution sequence of middlewares from `ENTRY` through `CONTROLLER_HANDLER` to `EXIT`.
4. Provides multi-format graph export and visualization capabilities (Terminal ASCII, Graphviz DOT, and Mermaid).

All 12 automated unit and integration tests across single-file and multi-file modular architectures pass with 100% success.

---

## 🏗️ End-to-End System Architecture

```
+===================================================================================+
|                                EXPRESSFLOW SYSTEM                                 |
+===================================================================================+
|                                                                                   |
|   [ Source Files (.js / .ts) ]                                                    |
|                |                                                                  |
|   =============v=============================================================     |
|   PHASE 1: FRONTEND PIPELINE (Krishna - 100% Done)                                |
|     1. Lexical & Syntactic Parsing (Source -> AST via @babel/parser)              |
|     2. Express Identifier Tracking (Detect express() & express.Router())          |
|     3. AST Visitor Engine (Extract app.use, app.get, router.post, etc.)           |
|     4. Argument Unpacking (Route Paths, Nested Arrays, Inline Callbacks)          |
|     5. Source Coordinate Tagging (line, column, filePath)                         |
|     6. IR Serialization (Emits manifest.json)                                     |
|   =============|=============================================================     |
|                |                                                                  |
|                | Handoff Contract: Intermediate Representation (IR Manifest JSON) |
|                v                                                                  |
|   =============v=============================================================     |
|   PHASE 2: MIDDLE-END ENGINE (Aaditya Jaiswal - 100% Done for Review 2)           |
|     1. Cross-File Symbol & Module Resolver (moduleResolver.ts)                    |
|        - Resolves require() and ESM import declarations                           |
|        - Connects sub-router mounts to remote router declarations                 |
|     2. URL Prefix Tree & Route Hierarchy Composer (routeComposer.ts)              |
|        - Path algebra: Full Path = Parent Mount + Sub-router Mount + Route Path   |
|        - Middleware linearizer: Combines Global + Mount + Route middlewares       |
|     3. Control-Flow Graph (CFG) Construction Engine (cfgBuilder.ts & cfgModel.ts) |
|        - Builds directed execution graphs G = (V, E) per endpoint                 |
|        - Nodes = ENTRY, GLOBAL_MW, ROUTE_MW, HANDLER, EXIT                        |
|        - Edges = Sequential next() control transfers                              |
|     4. Multi-Format Exporters (ASCII terminal, Graphviz DOT, Mermaid)             |
|   =============|=============================================================     |
|                |                                                                  |
|                | Directed CFGs (Ready for Dominator Analysis)                     |
|                v                                                                  |
|   =============v=============================================================     |
|   PHASE 3: BACKEND SECURITY ANALYSIS (Scheduled for Review 3 - Final 25%)         |
|     - Dominator Tree Construction (Dominance frontiers & path reachability)       |
|     - Security Invariant Policy Verification (Auth-Before-Sensitive-Handler)      |
|     - Diagnostic Vulnerability Reporting with source code coordinate remediation  |
+===================================================================================+
```

---

## 📐 Compiler Theoretical Formalisms

### 1. Abstract Syntax Tree (AST) to Intermediate Representation (IR)
The source program is mapped from a concrete syntax tree into an ESTree-compliant AST using `@babel/parser`. The frontend traverses this tree to project routing constructs into a domain-specific IR conforming to the schema defined in `src/shared/types/manifest.ts`.

### 2. Control-Flow Graph (CFG) Formulation
For each composed HTTP route endpoint $R$, the system constructs a Directed Acyclic Graph (DAG) $G_R = (V, E)$:

- **Vertex Set ($V$):**
  $$V = \{v_{\text{entry}}\} \cup V_{\text{global}} \cup V_{\text{mount}} \cup V_{\text{router}} \cup V_{\text{route}} \cup \{v_{\text{handler}}\} \cup \{v_{\text{exit}}\}$$
  Where:
  - $v_{\text{entry}}$: Initial HTTP request receipt.
  - $V_{\text{global}}$: Middlewares registered via root `app.use()`.
  - $V_{\text{mount}}$: Middlewares registered during router mounting (`app.use('/prefix', mw, router)`).
  - $V_{\text{router}}$: Middlewares registered on the sub-router (`router.use()`).
  - $V_{\text{route}}$: Middlewares explicitly passed to the route registration (`app.post('/path', mw1, mw2, handler)`).
  - $v_{\text{handler}}$: The terminal controller function generating the HTTP response.
  - $v_{\text{exit}}$: Request termination and response transmission.

- **Directed Edge Set ($E$):**
  $$E = \{(u, v) \mid \text{Execution of node } u \text{ transfers control to } v \text{ upon invoking } \texttt{next()}\}$$
  The execution topology forms an unbroken chain:
  $$v_{\text{entry}} \longrightarrow m_0 \longrightarrow m_1 \longrightarrow \dots \longrightarrow m_k \longrightarrow v_{\text{handler}} \longrightarrow v_{\text{exit}}$$

### 3. Route Path Composition Algebra
Let a route be registered on sub-router $R_{\text{sub}}$ mounted onto parent router $R_{\text{parent}}$ at mount path $P_{\text{mount}}$ with route-relative path $P_{\text{route}}$. The absolute URL path $P_{\text{composed}}$ is computed as:
$$P_{\text{composed}} = \text{Normalize}(P_{\text{mount}} \circ P_{\text{route}})$$
Where $\circ$ represents path segment concatenation with duplicate slash elimination and parameter preservation (e.g. `combinePaths('/api/admin', '/purge')` $\implies$ `'/api/admin/purge'`).

---

## 🛠️ Implementation Details by Component

### 1. Cross-File Symbol & Module Resolver (`src/middleend/resolver/moduleResolver.ts`)
- **Two-Pass Resolution Algorithm:**
  - **Pass 1 (Indexing):** Collects all router instances (`APPLICATION` and `ROUTER`), `module.exports`, `export default`, and `require()` / `import` declarations across all scanned files into symbol tables.
  - **Pass 2 (Linker):** Matches `MountRegistration` identifiers to target routers across file boundaries using relative path resolution and export matching.
  - **Heuristic Fallback:** If relative path is not explicitly required, maps sub-router identifiers matching filename conventions (e.g. `userRouter` $\rightarrow$ `routes/user.js`).

### 2. URL Prefix Tree & Route Hierarchy Composer (`src/middleend/composer/routeComposer.ts`)
- Recursively traverses router trees starting from root `APPLICATION` instances downwards through nested sub-routers.
- Aggregates inherited middleware stacks in exact execution sequence:
  `[GLOBAL] -> [MOUNT] -> [ROUTER] -> [ROUTE] -> [HANDLER]`.
- Assigns monotonic `executionOrder` coordinates from $0$ to $N$.

### 3. CFG Generation Engine (`src/middleend/cfg/cfgBuilder.ts` & `cfgModel.ts`)
- Instantiates explicit `CfgNode` objects carrying rich semantic metadata:
  - Node category (`GLOBAL_MIDDLEWARE`, `ROUTE_MIDDLEWARE`, `CONTROLLER_HANDLER`, etc.)
  - Identifier name / inline callback signature
  - Source file coordinate (`filePath`, `line`, `column`)
  - Bidirectional adjacency lists (`predecessors`, `successors`)
- Emits sequential `CfgEdge` links with explicit semantics (`HTTP Request`, `next()`, `Response Sent`).
- Implements visualization exporters:
  - `toAscii()`: Pretty-printed terminal flowchart.
  - `toDot()`: Compliant Graphviz DOT representation with distinct shapes and color schemes.
  - `toMermaid()`: Mermaid diagram format for web documentation and presentations.

---

## 🧪 Experimental Verification & Test Results

The test suite was executed using `npm test` against two distinct architectural configurations:
1. **Single-file test fixture (`test/fixtures/sample-app.js`)**: Evaluates nested middleware arrays, inline callback functions, and local sub-router mounts.
2. **Multi-file modular test fixture (`test/fixtures/modular-app/`)**: Evaluates cross-file CommonJS `require()` resolution, multiple router files (`routes/admin.js`, `routes/user.js`), and URL prefix composition.

### Test Execution Log (12/12 Tests Passing)

```
=================================================
EXPRESSFLOW AUTOMATED TEST SUITE (REVIEW 2 - 75%)
=================================================

>>> PART 1: FRONTEND PIPELINE (Lexical, AST & Manifest IR) <<<

[Test 1] Parsing fixture and analyzing AST...
[Test 2] Verifying Discovered Routers...
  ✓ Correctly identified 'app' (APPLICATION) and 'userRouter' (ROUTER)
[Test 3] Verifying Extracted Routes...
  ✓ Correctly extracted global middleware: app.use(express.json())
  ✓ Correctly extracted GET /health with inline callback parameters [req, res]
  ✓ Correctly flattened nested middleware arrays in POST /checkout (4 middlewares)
  ✓ Correctly extracted sub-router DELETE /:id route with checkAdmin guard
[Test 4] Verifying Sub-Router Mounts...
  ✓ Correctly captured mount: app.use('/api/users', userRouter)
[Test 5] Verifying Exports...
  ✓ Correctly tracked default export of 'app'
[Test 6] Verifying Full Project Manifest Builder...
  ✓ Successfully built manifest across project (4 source files indexed)

>>> PART 2: MIDDLE-END ENGINE (Module Resolution, Route Composition & CFG) <<<

[Test 7] Running Middle-End Pipeline on sample-app fixture...
  ✓ Correctly identified root application 'app'
[Test 8] Verifying Route Hierarchy & Prefix Composition...
  ✓ Correctly composed global + route middlewares in linear order
  ✓ Correctly composed mount path: '/api/users' + '/:id' -> '/api/users/:id'
[Test 9] Verifying Control-Flow Graph (CFG) Construction & Graph Invariants...
  ✓ Verified directed graph topology: ENTRY -> M0 -> M1 -> M2 -> M3 -> HANDLER -> EXIT
[Test 10] Verifying Cross-File Symbol & Module Resolution (modular-app)...
  ✓ Linked cross-file modules across 3 routers
[Test 11] Verifying Cross-File Route Composition...
  ✓ Successfully linked /api/admin/database and /api/users/profile across separate files
[Test 12] Verifying CFG Visualization Generation (ASCII, DOT, Mermaid)...
  ✓ Successfully generated ASCII, Graphviz DOT, and Mermaid diagram exports

=================================================
🎉 ALL TESTS PASSED! 75% IMPLEMENTATION IS READY!
=================================================
```

---

## 📊 Sample Output from ExpressFlow CLI

Executing `node dist/index.js ./test/fixtures/modular-app --cfg` produces:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🚀 EXPRESSFLOW: AHEAD-OF-TIME STATIC ROUTE & CFG COMPILER ENGINE            │
│ Review 2 Milestone: 75% Implementation (Frontend AST + Middle-End CFG)      │
└─────────────────────────────────────────────────────────────────────────────┘
[Phase 1] 🔎 Frontend AST Parser (Krishna)
  Scanning directory: .../modular-app
  ✔ Successfully indexed 3 source file(s) into Intermediate Representation.

[Phase 2] ⚙️  Middle-End CFG Engine (Aaditya)
  Linking modules, composing URL paths, and constructing Control-Flow Graphs...
  ✔ Discovered 3 router declaration(s).
  ✔ Resolved 1 root application entry-point(s).
  ✔ Composed 5 reachable endpoint route(s).
  ✔ Synthesized 5 formal Control-Flow Graph(s) (CFGs).

╭─────────────────────────────────────────────────────────────────────────────╮
│ 📋 COMPOSED ENDPOINT ROUTES & EXECUTION SUMMARY                             │
╰─────────────────────────────────────────────────────────────────────────────╯
┌──────────┬──────────────────────────────┬─────────┬──────────────────────────┬──────────────────────┐
│ METHOD   │ COMPOSED ENDPOINT            │ STEPS   │ ACTION HANDLER           │ SOURCE LOCATION      │
├──────────┼──────────────────────────────┼─────────┼──────────────────────────┼──────────────────────┤
│ GET      │ /status                      │ 4       │ inline(req, res)         │ app.js:16            │
│ DELETE   │ /api/admin/database          │ 5       │ purgeDatabase            │ routes/admin.js:5    │
│ POST     │ /api/admin/restart           │ 6       │ restartServer            │ routes/admin.js:6    │
│ GET      │ /api/users/profile           │ 5       │ getUserProfile           │ routes/user.js:5     │
│ PUT      │ /api/users/settings          │ 6       │ updateSettings           │ routes/user.js:6     │
└──────────┴──────────────────────────────┴─────────┴──────────────────────────┴──────────────────────┘

╭─────────────────────────────────────────────────────────────────────────────╮
│ CFG: DELETE /api/admin/database                                             │
│ Source: routes/admin.js:5 | Total Nodes: 5 | Directed Edges: 4              │
╰─────────────────────────────────────────────────────────────────────────────╯
  [START] ENTRY: DELETE /api/admin/database (routes/admin.js:5:0)
             │
             │  [Step 1: HTTP Request]
             ▼
  [MW]    [GLOBAL] express.json (app.js:5:8)
             │
             │  [Step 2: next()]
             ▼
  [MW]    [ROUTE] verifyAdmin (routes/admin.js:5:27)
             │
             │  [Step 3: next()]
             ▼
  [ACTN]  [ROUTE] purgeDatabase (routes/admin.js:5:40)
             │
             │  [Step 4: Response Sent]
             ▼
  [END]   EXIT (HTTP Response) (routes/admin.js:5:0)
```

---

## 🔮 Roadmap for Final Review 3 (Remaining 25% Scope)

With 75% of the compiler pipeline fully operational, the remaining 25% for the final review encompasses:

| Milestone | Target | Description |
| :--- | :---: | :--- |
| **M7: Security Invariant Checker** | 87.5% | Implement graph dominator tree analysis ($Dom(A, H)$) to formally verify if authentication nodes dominate sensitive route handlers along every reachable execution path. |
| **M8: End-to-End Evaluation & Reporting** | 100% | Integrate the high-precision diagnostic vulnerability reporter, benchmark against open-source vulnerable targets (e.g., OWASP Juice Shop), and produce final comparative accuracy metrics. |

---

## 🏁 Conclusion

ExpressFlow has successfully reached the **75% implementation milestone** ahead of Review 2. The transition from syntactic AST extraction to semantic Control-Flow Graph synthesis has been fully demonstrated and verified through rigorous automated test suites.
