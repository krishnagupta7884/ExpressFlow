# ExpressFlow

> **Semantic Static Analysis of Express.js Middleware Architectures**  
> *A specialized ahead-of-time compiler tool that constructs Control-Flow Graphs (CFGs) from Express.js source code to statically verify route security invariants.*

---

## 📌 Project Overview

In Express.js applications, security checkpoints (such as authentication, authorization, and rate limiting) are executed as sequentially chained middleware functions. Because JavaScript allows middlewares to be attached dynamically, developers can inadvertently omit authentication or misorder handlers (e.g., executing a sensitive handler before an authentication guard). Such code is syntactically valid and fails silently without throwing runtime exceptions.

**ExpressFlow** addresses this vulnerability class through **Ahead-Of-Time (AOT) Static Program Analysis**. It parses JavaScript/TypeScript source code into an Abstract Syntax Tree (AST), extracts routing definitions and ordered middleware chains, and compiles them into a structured Intermediate Representation (IR) to verify path-reachability security invariants without running the server.

---

## 👥 Team & Division of Responsibilities

| Register No. | Name | Role & Planned Contribution |
| :--- | :--- | :--- |
| **24BCE0732** | **Krishna** | **Frontend Pipeline:** Lexical and syntactic analysis, ESTree/Babel AST generation, Express scope & symbol tracking, route/middleware argument deconstruction, and IR manifest serialization. |
| **24BCE2584** | **Aaditya Jaiswal** | **Middle-End Engine:** Cross-file module linking, prefix tree URL composition, Control-Flow Graph (CFG) generation, and path-reachability security invariant analysis. |

---

## 🏗️ System Architecture

```
+===================================================================================+
|                                EXPRESSFLOW SYSTEM                                 |
+===================================================================================+
|                                                                                   |
|   [ Source Files (.js / .ts) ]                                                    |
|                |                                                                  |
|   =============v======================================                            |
|   FRONTEND PIPELINE (Lead: Krishna)                                               |
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
|   MIDDLE-END ENGINE (Lead: Aaditya Jaiswal)                                       |
|     - Multi-File Symbol & Module Resolver                                         |
|     - URL Prefix Tree & Path Composer                                             |
|     - Directed Control-Flow Graph (CFG) Construction                              |
|     - Security Dominance & Path Reachability Verification                         |
|     - Diagnostic Vulnerability Reporting                                          |
+===================================================================================+
```

---

## ✨ Features (Frontend Pipeline)

- **AST-Based Parsing:** Uses `@babel/parser` to parse ECMAScript, TypeScript, and JSX with full source location (`line`, `column`) fidelity.
- **Dynamic Scoped Symbol Table:** Discovers Express applications and sub-routers (`express()`, `express.Router()`) regardless of identifier naming.
- **Recursive Middleware Flattening:** Accurately unrolls arbitrarily nested middleware arrays (e.g., `[rateLimit, [verifyToken, validateCart]]` $\rightarrow$ linear execution order: $0, 1, 2, 3$).
- **Anonymous & Inline Handler Isolation:** Differentiates between named middleware identifiers and anonymous inline callback signatures (`(req, res, next) => { ... }`).
- **Sub-Router Mount Tracking:** Detects prefix mounting (e.g., `app.use('/api/users', userRouter)`).
- **Module Export Recording:** Tracks CommonJS (`module.exports`) and ESM (`export default`) router exports for cross-file linking.

---

## 📁 Repository Structure

```
ExpressFlow/
├── package.json                 # Project dependencies and npm scripts
├── tsconfig.json                # TypeScript compiler configuration
├── .gitignore                   # Standard ignore rules (node_modules, dist, etc.)
├── README.md                    # Project documentation
├── FRONTEND_IMPLEMENTATION.md   # Complete architectural & implementation specification
│
├── src/
│   ├── index.ts                 # CLI Entry point
│   │
│   ├── shared/
│   │   └── types/
│   │       └── manifest.ts      # Shared Intermediate Representation (IR) contract
│   │
│   └── frontend/                # Frontend Pipeline Implementation (Krishna)
│       ├── index.ts             # Public API entry point
│       ├── parser/
│       │   ├── astParser.ts     # Location-aware Babel parser wrapper
│       │   └── fileLoader.ts    # Recursive file crawler and disk reader
│       ├── scope/
│       │   └── symbolTracker.ts # Identifies Express applications and router instances
│       ├── visitor/
│       │   ├── argumentExtractor.ts  # Route path & middleware array deconstructor
│       │   ├── routeVisitor.ts       # AST visitor for route registrations and mounts
│       │   └── exportTracker.ts      # CommonJS and ESM router export tracker
│       └── serializer/
│           └── manifestBuilder.ts    # Emits the unified JSON IR manifest
│
├── dist/                        # Compiled JavaScript output (from tsc)
├── manifest.json                # Generated Intermediate Representation (IR) file
└── test/
    ├── fixtures/
    │   └── sample-app.js        # Test Express fixture with complex routes
    └── run-test.js              # Automated test verification suite
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.x or later (tested on Node.js LTS v24.x)
- **npm**: v9.x or later

### Installation

Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd ExpressFlow
npm install
```

### Build

Compile TypeScript source code to `dist/`:
```bash
npm run build
```

### Running Tests

Run the automated test suite against the sample test fixture:
```bash
npm test
```

Expected output:
```
=================================================
Running ExpressFlow Frontend Pipeline Test Suite
=================================================

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
  ✓ Successfully built manifest across project

=================================================
🎉 ALL TESTS PASSED! FRONTEND PIPELINE IS READY!
=================================================
```

---

## 💻 CLI Usage

You can run ExpressFlow directly on any directory containing Express.js source code:

```bash
# Print the IR Manifest to stdout:
node dist/index.js ./test/fixtures

# Save the IR Manifest directly to a JSON file:
node dist/index.js ./test/fixtures ./manifest.json
```

---

## 📄 Intermediate Representation (IR) Format

The frontend produces an IR JSON file conforming to the following structure:

```json
{
  "version": "1.0.0",
  "projectRoot": "/path/to/project",
  "files": [
    {
      "filePath": "routes/user.js",
      "routersDeclared": [
        {
          "identifier": "userRouter",
          "kind": "ROUTER",
          "loc": { "start": { "line": 3, "column": 6 }, "end": { "line": 3, "column": 35 } }
        }
      ],
      "routeRegistrations": [
        {
          "registrationType": "ROUTE",
          "routerIdentifier": "userRouter",
          "httpMethod": "DELETE",
          "path": { "type": "STATIC", "value": "/:id", "raw": "'/:id'", "loc": { ... } },
          "middlewares": [
            { "executionOrder": 0, "type": "IDENTIFIER", "name": "checkAdmin", "isInline": false, "loc": { ... } },
            { "executionOrder": 1, "type": "IDENTIFIER", "name": "deleteUserHandler", "isInline": false, "loc": { ... } }
          ],
          "loc": { "start": { "line": 21, "column": 0 }, "end": { "line": 21, "column": 56 } }
        }
      ],
      "mounts": [],
      "exports": [
        { "type": "DEFAULT", "localIdentifier": "userRouter", "loc": { ... } }
      ]
    }
  ]
}
```

---

## 📚 Course Information

- **Course:** BCSE307P – Compiler Design Lab
- **Milestone:** Review 1 (25% Implementation Phase — Frontend Pipeline)
- **Institution:** Vellore Institute of Technology (VIT)
