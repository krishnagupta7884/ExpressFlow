# ExpressFlow: Review 2 Presentation Slides & Faculty Q&A Guide

**Course:** BCSE307P – Compiler Design Lab  
**Institution:** Vellore Institute of Technology (VIT)  
**Milestone:** Review 2 (75% Implementation Phase)  
**Team Members:**  
- **Krishna (24BCE0732)** – Frontend Pipeline (AST Parsing, Symbol Table, IR Manifest)  
- **Aaditya Jaiswal (24BCE2584)** – Middle-End Engine (Module Resolver, Route Prefix Tree, CFG Generator)  

---

## 📑 Part 1: Slide-by-Slide Presentation Content

### Slide 1: Title & Overview
- **Header:** ExpressFlow: Semantic Static Analysis of Express.js Middleware Architectures
- **Subtitle:** Ahead-Of-Time (AOT) Route Verification via AST-to-CFG Program Synthesis
- **Milestone:** Review 2 (75% Implementation Completed)
- **Presented by:**
  - Krishna (24BCE0732)
  - Aaditya Jaiswal (24BCE2584)
- **Speaker Notes:**
  > *"Good morning respected faculty. Today we present Review 2 of ExpressFlow, where we have completed 75% of the total system. In Review 1, we showed our frontend AST parsing pipeline. In this review, we present the middle-end engine, which performs cross-file module resolution, URL prefix tree composition, and compiles full Control-Flow Graphs (CFGs) for static security analysis."*

---

### Slide 2: Problem Statement & Motivation
- **The Core Problem:**
  - In Express.js web applications, security guards (authentication, authorization, rate limiting) are applied dynamically as chained middleware functions.
  - Omitted or misordered guards (e.g. running a database deletion handler before token validation) are syntactically valid in JavaScript.
  - Linters only check local syntax; dynamic security testing requires active exploits on a running server.
- **Our Solution (ExpressFlow):**
  - An AOT compiler tool that statically models middleware execution as a formal Control-Flow Graph (CFG) without running the server.
- **Speaker Notes:**
  > *"JavaScript's dynamic nature is both a blessing and a curse. If a developer mounts an admin router without auth, node will run it without throwing any syntax errors. ExpressFlow acts as a security compiler pass: it analyzes the code statically at build time, constructs the execution flow, and mathematically verifies whether security guards are in place."*

---

### Slide 3: 75% Milestone Achievement Matrix
- **Overall System Progress:** 6 of 8 planned milestones completed (75% total).
- **Progress Breakdown Table:**
  | Milestone | Scope | Phase Owner | Status |
  | :--- | :--- | :--- | :---: |
  | **M1: Project Setup** | Repo structure, TypeScript, shared IR contract | Both | **Done (100%)** |
  | **M2: AST & Symbol Tracker** | Babel parser, file crawler, Express scope tracking | Krishna | **Done (100%)** |
  | **M3: Route & Middleware Visitor** | Route deconstruction, nested array flattening | Krishna | **Done (100%)** |
  | **M4: IR Manifest Emission** | Unified JSON handoff serialization (`manifest.json`) | Krishna | **Done (100%)** |
  | **M5: Module & Path Resolution** | Cross-file linking, prefix tree composition | Aaditya | **Done (100%)** |
  | **M6: CFG Generation Engine** | Directed execution graph synthesis ($V, E$) | Aaditya | **Done (100%)** |
  | **M7: Security Invariant Checker** | Dominator tree reachability analysis | Aaditya | Scheduled (Review 3) |
  | **M8: End-to-End Evaluation** | Benchmark against open-source CVEs | Both | Scheduled (Review 3) |
- **Speaker Notes:**
  > *"As shown in our roadmap, Review 1 established the frontend 25% phase. Review 2 completes the entire middle-end engine, bringing us to exactly 75% implementation. The remaining 25% for Review 3 is the graph dominator reachability algorithm and the final CVE benchmark."*

---

### Slide 4: Compiler Pipeline Architecture
- **Diagram:**
  ```
  [Source .js/.ts Files]
           │
           ▼
  [Lexical & Syntactic Analysis] ───► Abstract Syntax Tree (Babel AST)
           │
           ▼
  [Express Symbol Table] ───────────► Scope Resolution (app vs express.Router())
           │
           ▼
  [IR Manifest Serializer] ─────────► Intermediate Representation (manifest.json)
           │
           ▼
  [Cross-File Module Resolver] ─────► Symbol Linking (require & ESM import/export)
           │
           ▼
  [URL Prefix Tree Composer] ───────► Cumulative Route Hierarchy (/api + /admin + /db)
           │
           ▼
  [CFG Synthesis Engine] ───────────► Directed Execution Graphs G = (V, E)
  ```
- **Speaker Notes:**
  > *"Our pipeline follows the classical compiler design model: raw source is tokenized and parsed into an AST, normalized into a strongly-typed Intermediate Representation, linked across translation units, and transformed into a Control-Flow Graph representing program execution."*

---

### Slide 5: Middle-End Engine 1 – Cross-File Symbol Linking
- **Key Challenge:** Real Express apps split routers across separate files (`app.use('/api', require('./routes/api'))`).
- **Our Resolution Algorithm:**
  1. **Pass 1 (Indexing):** Scans all files and indexes declared routers, CommonJS `module.exports`, ESM `export default`, and `require()` / `import` declarations.
  2. **Pass 2 (Path & Export Linking):** When `app.use(path, routerId)` is encountered, the resolver determines if `routerId` was imported, resolves the relative file path, and matches the exported router AST node.
  3. **Root Discovery:** Distinguishes root `APPLICATION` instances from attached sub-routers.
- **Speaker Notes:**
  > *"In a multi-file project, route definitions are distributed. Our module resolver acts like a compiler linker: it matches the imported variable in `app.js` with the exported `Router` declaration in `routes/admin.js`, allowing us to trace cross-file request execution."*

---

### Slide 6: Middle-End Engine 2 – URL Prefix Tree & Middleware Linearization
- **Path Algebra:**
  $$\text{Full Route Path} = \text{Normalize}(\text{Mount}_{\text{Parent}} \circ \text{Mount}_{\text{Sub}} \circ \text{Route Path})$$
  - Example: `combinePaths('/api/admin', '/database')` $\implies$ `'/api/admin/database'`
- **Middleware Linearization Invariant:**
  - Express executes middlewares in strict lexical attachment order:
    $$\text{Global App Middlewares} \longrightarrow \text{Mount Middlewares} \longrightarrow \text{Router Middlewares} \longrightarrow \text{Route Middlewares} \longrightarrow \text{Handler}$$
  - Nested arrays like `[rateLimit, [verifyToken, validateCart]]` are unrolled into flat, sequential execution steps $0, 1, 2, 3$.
- **Speaker Notes:**
  > *"Express allows arbitrary nesting of sub-routers and arrays of middlewares. Our route composer recursively traverses the router mount tree, concatenates URL prefixes, and linearizes all inherited middlewares so that global guards always precede route-specific guards in the execution stack."*

---

### Slide 7: Middle-End Engine 3 – Control-Flow Graph (CFG) Synthesis
- **Formal Graph Definition:** $G = (V, E)$
  - **Nodes ($V$):**
    - `ENTRY`: HTTP request arrival
    - `GLOBAL_MIDDLEWARE`: e.g. `express.json()`, `cors()`
    - `ROUTE_MIDDLEWARE`: e.g. `verifyAdmin`, `rateLimit`
    - `CONTROLLER_HANDLER`: Terminal route action (e.g. `purgeDatabase`)
    - `EXIT`: HTTP response dispatched
  - **Edges ($E$):** Directed execution edges representing `next()` call progression.
- **Multi-Format Visualizers:**
  - **ASCII Art:** Terminal-based visualization for immediate developer inspection.
  - **Graphviz DOT:** Standard `.dot` format for rendering SVG/PDF flowcharts.
  - **Mermaid:** Native markdown diagram format.
- **Speaker Notes:**
  > *"Every composed route is compiled into a formal directed graph. Each node retains its exact source coordinates (file, line, column). The directed edges represent the transfer of control when `next()` is called. This graph is the exact mathematical structure required for dominator analysis in Review 3."*

---

### Slide 8: Concrete Example 1 – Nested Middleware Flattening & Route CFG

- **Input Code (`sample-app.js`):**
  ```javascript
  const express = require('express');
  const app = express();

  // Global middleware
  app.use(express.json());

  // Complex route with arbitrarily nested middleware arrays
  app.post(
    '/checkout',
    [rateLimit, [verifyToken, validateCart]],
    checkoutHandler
  );
  ```

- **Final Compiler Output (CFG ASCII Flowchart):**
  ```
  ╭─────────────────────────────────────────────────────────────────────────────╮
  │ CFG: POST /checkout                                                         │
  │ Source: sample-app.js:14 | Total Nodes: 7 | Directed Edges: 6               │
  ╰─────────────────────────────────────────────────────────────────────────────╯
    [START] ENTRY: POST /checkout (sample-app.js:14:0)
               │
               │  [Step 1: HTTP Request]
               ▼
    [MW]    [GLOBAL] express.json (sample-app.js:6:8)
               │
               │  [Step 2: next()]
               ▼
    [MW]    [ROUTE] rateLimit (sample-app.js:16:5)
               │
               │  [Step 3: next()]
               ▼
    [MW]    [ROUTE] verifyToken (sample-app.js:16:17)
               │
               │  [Step 4: next()]
               ▼
    [MW]    [ROUTE] validateCart (sample-app.js:16:30)
               │
               │  [Step 5: next()]
               ▼
    [ACTN]  [ROUTE] checkoutHandler (sample-app.js:17:4)
               │
               │  [Step 6: Response Sent]
               ▼
    [END]   EXIT (HTTP Response) (sample-app.js:14:0)
  ```
- **What this demonstrates:**
  - Nested array `[rateLimit, [verifyToken, validateCart]]` is completely flattened into sequential steps.
  - Global `express.json` is correctly placed at Step 1 before all route guards.
  - Every node retains exact source coordinates (`sample-app.js:16:17`).
- **Speaker Notes:**
  > *"Here is a concrete example. On the left is the raw developer code with nested arrays. On the right is ExpressFlow's compiled Control-Flow Graph. Notice how our frontend flattened the nested array `[rateLimit, [verifyToken, validateCart]]` into linear execution steps 1, 2, and 3, preceded by the global `express.json` middleware."*

---

### Slide 9: Concrete Example 2 – Cross-File Modular Routing & URL Composition

- **Input Code (File 1: `app.js`):**
  ```javascript
  const express = require('express');
  const app = express();
  app.use(express.json());

  const adminRouter = require('./routes/admin'); // Cross-file import
  app.use('/api/admin', adminRouter);            // Mount prefix
  ```

- **Input Code (File 2: `routes/admin.js`):**
  ```javascript
  const express = require('express');
  const router = express.Router();

  // Sensitive endpoint inside sub-module
  router.delete('/database', verifyAdmin, purgeDatabase);

  module.exports = router;
  ```

- **Final Compiler Output (Summary Table & CFG):**
  ```
  ┌──────────┬──────────────────────────────┬─────────┬──────────────────────────┬──────────────────────┐
  │ METHOD   │ COMPOSED ENDPOINT            │ STEPS   │ ACTION HANDLER           │ SOURCE LOCATION      │
  ├──────────┼──────────────────────────────┼─────────┼──────────────────────────┼──────────────────────┤
  │ DELETE   │ /api/admin/database          │ 5       │ purgeDatabase            │ routes/admin.js:5    │
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
- **What this demonstrates:**
  - Prefix tree composition: `/api/admin` + `/database` $\implies$ `/api/admin/database`.
  - Cross-file linking: `require('./routes/admin')` matched to `module.exports = router`.
  - Cross-file middleware inheritance: `express.json` from `app.js` is automatically prepended to the handler in `routes/admin.js`.
- **Speaker Notes:**
  > *"This slide shows how ExpressFlow resolves multi-file modular architectures. `app.js` mounts `adminRouter` at `/api/admin`. The route is defined inside `routes/admin.js` as `/database`. Our middle-end module resolver links the files together, calculates the cumulative URL `/api/admin/database`, and automatically stitches the global `express.json` middleware from `app.js` before `verifyAdmin` and `purgeDatabase`."*

---

### Slide 10: Live Demonstration & Test Verification
- **Test Suite Results:**
  - 12 comprehensive unit and integration tests passing (100% success rate).
  - Validated on single-file fixtures (`sample-app.js`) and cross-file multi-module projects (`modular-app/`).
- **Live Terminal Execution:**
  - `npm test` $\implies$ Runs the complete automated test suite (12/12 passing).
  - `node dist/index.js ./test/fixtures/modular-app --cfg` $\implies$ Renders composed routes & visual CFG graphs.
  - `node dist/index.js ./test/fixtures/modular-app --dot` $\implies$ Exports Graphviz DOT graphs.
- **Speaker Notes:**
  > *(Proceed to run the terminal demo as described in Part 2 below).*

---

### Slide 11: Review 3 Roadmap & Conclusion
- **Remaining 25% Scope (Final Review):**
  - **Dominator Tree Reachability:** Implementing the Lengauer-Tarjan or iterative dominator algorithm to prove $A \text{ dom } H$ (Auth dominates Handler).
  - **Automated Security Invariant Policy Engine:** Flagging unauthenticated sensitive routes (`DELETE`, `POST` touching `/admin` or `/user`).
  - **Benchmarking:** Testing against real-world repositories like OWASP Juice Shop.
- **Summary:**
  - Frontend (Krishna): 100% complete.
  - Middle-End (Aaditya): 100% complete for Review 2.
  - System is on track, fully functional, and ready for Review 3.
- **Speaker Notes:**
  > *"In conclusion, we have built a working end-to-end compiler frontend and middle-end that takes raw Express source code and produces verified Control-Flow Graphs. In our final review, we will complete the security policy checker. Thank you, and we welcome your questions."*

---

## 💻 Part 2: Step-by-Step Live Demo Script

When the faculty asks for the live demonstration, follow these exact terminal steps:

### Step 1: Run the Complete Automated Test Suite
```bash
npm test
```
**What to Say:**
> *"Here we run our automated test suite using `npm test`. As you can see, Part 1 validates Krishna's frontend pipeline—verifying AST parsing, router discovery, nested array flattening, and export tracking. Part 2 validates Aaditya's middle-end engine—verifying cross-file module resolution across `modular-app`, URL prefix tree composition, and unbroken sequential CFG edge topology. All 12 tests pass successfully."*

---

### Step 2: Run ExpressFlow CLI with CFG Visualization
```bash
node dist/index.js ./test/fixtures/modular-app --cfg
```
**What to Say:**
> *"Now we run ExpressFlow directly on our multi-file modular application fixture. In Phase 1, it indexes all 3 files into our Intermediate Representation. In Phase 2, the middle-end links `app.js` with `routes/admin.js` and `routes/user.js`, resolves 5 composed endpoints, and generates 5 Control-Flow Graphs.*
>
> *Looking at the summary table, you can see `DELETE /api/admin/database` was successfully composed from `/api/admin` mounted in `app.js` and `/database` defined in `routes/admin.js`.*
>
> *Scrolling to the ASCII Control-Flow Graph for `DELETE /api/admin/database`, notice how it models the execution chain: `[START] ENTRY` transitions through `[GLOBAL] express.json` at `app.js:5:8`, then through `[ROUTE] verifyAdmin` at `routes/admin.js:5:27`, reaching `[ACTN] purgeDatabase`, and finally terminating at `[END] EXIT`. Every node tracks exact line and column coordinates."*

---

### Step 3: Demonstrate Graphviz DOT Export
```bash
node dist/index.js ./test/fixtures/modular-app --dot
```
**What to Say:**
> *"For integration into IDEs and reporting pipelines, ExpressFlow also exports standard Graphviz DOT notation, rendering nodes with distinct shapes—ellipses for Entry/Exit, rectangles for Middlewares, and double-octagons for Terminal Controllers."*

---

## 🎓 Part 3: Faculty & External Examiner Q&A Guide

Here are the most probable questions examiners will ask in a Compiler Design Lab review, along with precise, academically sound answers:

### Q1: Why do you need both an AST and a CFG? Why can't you just analyze the AST?
**Answer:**
> *"An Abstract Syntax Tree (AST) represents the syntactic, hierarchical structure of the source code (such as variable declarations, member expressions, and call arguments). However, an AST does not represent temporal execution order. In Express.js, routing logic is declared declaratively across multiple files and chained dynamically. A Control-Flow Graph (CFG) abstracts away language syntax and models the actual runtime execution path of an HTTP request—showing which middleware runs first, which runs second, and where execution terminates upon calling `next()`. Security reachability analysis requires a CFG, not just an AST."*

---

### Q2: How did you implement cross-file module resolution? What if a variable is aliased?
**Answer:**
> *"We implemented a two-pass symbol resolver in `moduleResolver.ts`. In Pass 1, we index all exported identifiers (`module.exports` and ESM `export default`) along with local imports (`require` and `import`). In Pass 2, when `app.use('/prefix', subRouter)` is encountered, the linker queries the import table to find the source file, inspects the target file's export table, and connects the router nodes. For aliasing (e.g. `const api = router`), our AST symbol tracker in `symbolTracker.ts` listens for variable declarators that assign known router instances to new identifiers and propagates the router symbol in the symbol table."*

---

### Q3: What is the Intermediate Representation (IR) and why did you use JSON for it?
**Answer:**
> *"Our Intermediate Representation is defined in `src/shared/types/manifest.ts`. It acts as a clean, decoupled boundary between Krishna's frontend and Aaditya's middle-end. By serializing the IR to a strictly-typed JSON schema (`manifest.json`), the frontend and middle-end can be developed, tested, and benchmarked independently. It also allows ExpressFlow to support alternative frontends (e.g. SWC, TypeScript Compiler API) without modifying the middle-end CFG and security analysis engines."*

---

### Q4: How do you handle arbitrarily nested middleware arrays like `app.get('/path', [m1, [m2, m3]], m4)`?
**Answer:**
> *"In `argumentExtractor.ts`, we implemented a recursive flattening function `flattenMiddlewareNodes()`. When traversing the arguments of a route registration, if an `ArrayExpression` node is encountered, the function recursively unwraps its elements depth-first into a linear list of AST nodes before extracting their metadata. This ensures that `[m1, [m2, m3]], m4` is linearized to `[m1, m2, m3, m4]` with monotonically increasing execution indices, matching Express.js runtime semantics."*

---

### Q5: What is the asymptotic time complexity of your Middle-End pipeline?
**Answer:**
> *"Let $F$ be the number of source files, $R$ be the number of route registrations, and $M$ be the total number of middlewares.
> - **Module Resolution:** $O(F + R)$ since indexing and dictionary lookups operate in near $O(1)$ time.
> - **Route & Prefix Composition:** $O(R \cdot D)$, where $D$ is the maximum depth of the router hierarchy (typically $D \le 4$ in real apps).
> - **CFG Generation:** $O(R \cdot M)$ because we traverse each middleware chain once to generate $M+2$ nodes and $M+1$ directed edges.
> Overall time complexity is $O(F + R \cdot M)$, which is strictly linear with respect to the codebase size, making it extremely fast for ahead-of-time compilation."*

---

### Q6: How will you prove security reachability in Review 3?
**Answer:**
> *"In Review 3, we will implement formal Graph Dominator Tree analysis. In compiler theory, a node $d$ dominates node $n$ ($d \text{ dom } n$) if every path from the entry node to $n$ must pass through $d$.
> For any sensitive route handler $H$ (such as `purgeDatabase` or routes under `/admin`), we compute its dominator set in the CFG. If an Authentication Guard node $A \in \text{Dom}(H)$, the route is mathematically guaranteed to be protected. If $A \notin \text{Dom}(H)$, or if $A$ appears after $H$, our security policy engine flags an invariant violation with exact source code coordinates."*

---

### Q7: What are the current limitations of your implementation?
**Answer:**
> *"Currently, our analysis is optimized for static route registrations. If a developer dynamically attaches routes inside an asynchronous `setTimeout` or reads route strings from a runtime database, static analysis cannot anticipate those runtime values without dynamic symbolic execution or taint tracking. However, standard Express architectures follow declarative route patterns, for which ExpressFlow provides 100% sound and deterministic static coverage."*
