# ExpressFlow: Complete End-to-End Implementation Guide

**Project Title:** ExpressFlow: Semantic Static Analysis of Express.js Middleware Architectures  
**Core Team:**  
- **Krishna:** Frontend Pipeline (Lexical & Syntactic Analysis, AST Parsing, Route & Middleware Extraction)  
- **Aaditya Jaiswal:** Middle-End Engine (Symbol Resolution, CFG Construction, Security Reachability Analysis)  
**Status:** Unified Technical Architecture & Implementation Master Document  

---

## 1. High-Level Concept: What is ExpressFlow?

In Express.js web applications, security and business logic rely heavily on **middleware functions** executed in sequence:

$$\text{Request} \longrightarrow [M_1: \text{Rate Limit}] \longrightarrow [M_2: \text{Authenticate}] \longrightarrow [M_3: \text{Check Admin}] \longrightarrow [H: \text{Delete User DB Record}]$$

If a developer mistakenly registers a route like this:
```javascript
// BUG: Sensitive handler runs BEFORE authentication!
app.post('/admin/delete-database', deleteDbHandler, authenticate);
```
Or forgets authentication completely on a newly added sub-router:
```javascript
// BUG: /api/admin is mounted without verifyToken!
app.use('/api/admin', adminRouter); 
```
The application suffers a severe security bypass.

**ExpressFlow** solves this problem by performing **Ahead-Of-Time (AOT) Static Analysis**. It reads the source code without running it, builds a mathematical graph of how requests flow through middlewares (Control-Flow Graph), and mathematically proves whether mandatory security guards execute before sensitive actions.

---

## 2. System Architecture & Separation of Concerns

ExpressFlow is divided into two cooperative pipelines connected by a strictly typed **Intermediate Representation (IR)**:

```
+===================================================================================+
|                                EXPRESSFLOW SYSTEM                                 |
+===================================================================================+
|                                                                                   |
|   [ Raw JavaScript / TypeScript Source Code ]                                     |
|                         |                                                         |
|   ======================v==================================                       |
|   PART 1: FRONTEND PIPELINE (Lead: Krishna)                                       |
|   --------------------------------------------------------                        |
|   1. File Discovery & Parsing (Source Code -> AST)                                |
|   2. Express Identifier & Scope Tracking (Detect `app` & `router`)                |
|   3. AST Visitor Engine (Extract `app.use`, `app.get`, `router.post`)             |
|   4. Argument Unpacking (Route Paths, Middleware Arrays, Inline Callbacks)        |
|   5. Location Tagging (Map every entity to exact File, Line, and Column)          |
|   6. Serialization (Write structured Intermediate Representation JSON)            |
|   ======================|==================================                       |
|                         |                                                         |
|                         | JSON Handoff Contract (Manifest IR)                     |
|                         v                                                         |
|   ======================v==================================                       |
|   PART 2: MIDDLE-END ENGINE (Lead: Aaditya Jaiswal)                               |
|   --------------------------------------------------------                        |
|   1. IR Ingestion & Normalization                                                 |
|   2. Cross-File Symbol Resolution (Link imported/exported routers & middlewares)  |
|   3. Path & URL Prefix Tree Composition (e.g. `/api` + `/admin` + `/delete`)      |
|   4. Control-Flow Graph (CFG) Construction (Nodes = Middlewares, Edges = Execution)|
|   5. Security Invariant Checking (Reachability / Dominator Path Analysis)         |
|   6. Diagnostic Report Generator (Pinpoint violations with line/col precision)    |
+===================================================================================+
```

---

## 3. Part 1: Frontend Pipeline (Krishna's Domain)

The goal of Krishna's pipeline is to transform unstructured text files into a clean, queryable JSON manifest.

### 3.1. How Krishna's Pipeline Works in Simple Terms

1. **Read Files:** Find all `.js` and `.ts` files in the target project.
2. **Turn Code into a Syntax Tree (AST):** An Abstract Syntax Tree breaks JavaScript code down into a tree of semantic objects (like `CallExpression`, `Identifier`, `Literal`).
3. **Remember Express Objects:** Track which variable names represent Express applications or routers (`const app = express()`, `const authRouter = express.Router()`).
4. **Hunt for Route Definitions:** Whenever the code calls `.use()`, `.get()`, `.post()`, `.put()`, `.delete()`, `.all()`, or `.route()`, capture what is happening.
5. **Deconstruct the Arguments:**
   - Extract the route path (e.g., `"/api/v1/users"`).
   - Extract all middlewares in order, even if wrapped in arrays like `[auth, [checkRole, rateLimit]]`.
   - Distinguish named functions (`requireAuth`) from anonymous inline handlers (`(req, res) => { ... }`).
6. **Record File Coordinates:** Store the exact line and column where each piece of code lives so Aaditya can report meaningful errors later.
7. **Emit JSON Manifest:** Write all extracted data into the standardized JSON structure.

---

### 3.2. Krishna's Core AST Node Targets

| ESTree AST Node | What It Represents in Express Code | Example Code Snippet |
| :--- | :--- | :--- |
| **`CallExpression`** | Any function invocation | `app.get(...)` or `express()` |
| **`MemberExpression`** | An object property access | `app.get` (object: `app`, property: `get`) |
| **`Identifier`** | A variable, function, or parameter name | `authMiddleware`, `app`, `req`, `res` |
| **`Literal` / `StringLiteral`** | A hardcoded string or number | `'/api/users'`, `'DELETE'` |
| **`TemplateLiteral`** | String with backticks / interpolation | `` `/users/${userId}` `` |
| **`ArrayExpression`** | An array of values | `[checkToken, validateBody]` |
| **`ArrowFunctionExpression`** / **`FunctionExpression`** | An inline callback function | `(req, res, next) => { next(); }` |
| **`ImportDeclaration`** / **`VariableDeclaration`** | Module imports or variable definitions | `const app = express()` |

---

### 3.3. Krishna's Detailed Step-by-Step Implementation

#### Step 1: Lexical & Syntactic Parsing (`astParser.ts`)
- Use `@babel/parser` configured with:
  ```typescript
  {
    sourceType: "unambiguous", // automatically handles CommonJS and ES Modules
    plugins: ["typescript", "jsx", "asyncGenerators", "dynamicImport"],
    tokens: false,
    createParenthesizedExpressions: true
  }
  ```
- This guarantees Babel generates an accurate AST while preserving `loc` (`start` and `end` lines and columns).

#### Step 2: Symbol & Router Tracking (`symbolTracker.ts`)
Express code doesn't always use the variable name `app`. Someone might write:
```javascript
const server = express();
const v1Router = express.Router();
const adminApi = Router();
```
The symbol tracker walks the AST first or listens to variable declarations:
- If a function call matches `express()`, record the target variable as an `ApplicationInstance`.
- If a function call matches `express.Router()` or `Router()`, record the target variable as a `RouterInstance`.
- Maintain a set of active router identifiers valid for each scope.

#### Step 3: AST Route Traversal (`routeVisitor.ts`)
Using `@babel/traverse`, set up a visitor for `CallExpression`:
- **Check callee:** Is it a `MemberExpression`? (e.g. `callee.object.name === 'app' && callee.property.name === 'get'`).
- **Check method name:**
  - If it is an HTTP verb (`get`, `post`, `put`, `delete`, `patch`, etc.), create a `RouteRegistration`.
  - If it is `.use()`, inspect arguments:
    - If argument 0 is a string and argument 1 is an identified router (`app.use('/auth', authRouter)`), create a `MountRegistration`.
    - Otherwise, create a global or path-scoped `MiddlewareRegistration`.
  - If it is `.route()` (e.g. `app.route('/items').get(...).post(...)`), trace the method chain back up to associate each HTTP method with the common path.

#### Step 4: Argument & Middleware Unpacking (`argumentExtractor.ts`)
- **Path Resolution:** If argument 0 is a string literal, that is the route path. If argument 0 is a function or identifier (e.g., in `app.use(cors())`), the path defaults to root `'/'`.
- **Recursive Array Flattening:** Express allows nested middleware arrays:
  ```javascript
  app.get('/test', [m1, [m2, m3]], m4);
  ```
  The argument extractor recursively unpacks `ArrayExpression` nodes to produce a flat list: `[m1, m2, m3, m4]`.
- **Middleware Classification:**
  - `IDENTIFIER`: Named middleware (e.g. `verifyToken`).
  - `MEMBER_EXPRESSION`: Property reference (e.g. `authController.checkAuth`).
  - `FACTORY_CALL`: Invocations returning middleware (e.g. `rateLimit({ windowMs: 15 * 60 * 1000 })`).
  - `INLINE_FUNCTION`: Inline callbacks with parameter names captured (`(req, res, next) => {}`).

#### Step 5: Export Tracking (`exportTracker.ts`)
Track how routers leave a file so Aaditya can link them:
- CommonJS: `module.exports = router`
- ESM: `export default router` or `export const apiRouter = router`

#### Step 6: Manifest Serializer (`manifestBuilder.ts`)
Collect all file outputs and serialize them into the structured JSON contract.

---

## 4. The Shared Data Handoff Contract (JSON Schema)

This schema is the mathematical bridge between Krishna's frontend and Aaditya's middle-end:

```typescript
export interface ExpressFlowManifest {
  version: "1.0.0";
  analyzedAt: string;
  projectRoot: string;
  files: SourceFileMetadata[];
}

export interface SourceLocation {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export interface SourceFileMetadata {
  filePath: string;
  routersDeclared: RouterDeclaration[];
  routeRegistrations: RouteRegistration[];
  mounts: MountRegistration[];
  exports: ExportMetadata[];
}

export interface RouterDeclaration {
  identifier: string;
  kind: "APPLICATION" | "ROUTER";
  loc: SourceLocation;
}

export interface RoutePath {
  type: "STATIC" | "TEMPLATE" | "DYNAMIC";
  value: string;
  raw: string;
  loc: SourceLocation;
}

export type MiddlewareType = 
  | "IDENTIFIER" 
  | "MEMBER_EXPRESSION" 
  | "FACTORY_CALL" 
  | "INLINE_FUNCTION";

export interface MiddlewareMetadata {
  executionOrder: number;
  type: MiddlewareType;
  name: string | null;           // e.g. "verifyToken" or null
  rawExpression: string;        // e.g. "auth.verifyToken" or code snippet
  isInline: boolean;
  params?: string[];            // e.g. ["req", "res", "next"]
  loc: SourceLocation;
}

export interface RouteRegistration {
  registrationType: "ROUTE";
  routerIdentifier: string;
  httpMethod: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD" | "ALL";
  path: RoutePath;
  middlewares: MiddlewareMetadata[];
  loc: SourceLocation;
}

export interface MountRegistration {
  registrationType: "MOUNT";
  parentRouter: string;
  subRouterIdentifier: string;
  path: RoutePath;
  loc: SourceLocation;
}

export interface ExportMetadata {
  type: "DEFAULT" | "NAMED";
  exportName?: string;
  localIdentifier: string;
  loc: SourceLocation;
}
```

---

## 5. Part 2: Middle-End Engine (Aaditya's Domain)

The goal of Aaditya's middle-end engine is to take Krishna's JSON manifest, connect the pieces across files, construct Control-Flow Graphs (CFGs), and run formal security reachability analysis.

### 5.1. How Aaditya's Engine Works in Simple Terms

1. **Ingest the Manifest:** Load Krishna's JSON data.
2. **Resolve Cross-File References:** If file `A.js` mounts `const userRouter = require('./routes/user')`, and `user.js` exports `router`, connect them together.
3. **Build the Full URL Hierarchy (Path Composition):**
   - If `app` mounts `apiRouter` at `/api`
   - And `apiRouter` mounts `adminRouter` at `/admin`
   - And `adminRouter` has route `.delete('/database')`
   - Aaditya computes the full endpoint: `DELETE /api/admin/database`.
4. **Construct Control-Flow Graph (CFG):**
   - For every endpoint, build a directed graph showing the exact chain of middleware nodes executed before the final handler:
     $$\text{ENTRY} \longrightarrow M_{\text{global}} \longrightarrow M_{\text{mount}} \longrightarrow M_{\text{route}} \longrightarrow \text{HANDLER} \longrightarrow \text{EXIT}$$
5. **Verify Security Invariants (Path-Reachability Analysis):**
   - Look for sensitive endpoints (e.g. routes modifying data, touching `/admin`, `/user/delete`, etc.).
   - Check if an **Authentication Guard Node** (e.g. `verifyToken`, `checkAuth`, `passport.authenticate`) **dominates** the sensitive handler.
   - If there is any path from `ENTRY` to `HANDLER` that skips authentication, or if authentication runs *after* the handler, flag a security violation!
6. **Output the Vulnerability Report:** Print out clear, actionable alerts referencing Krishna's exact file, line, and column coordinates.

---

### 5.2. Graph Data Structures for Aaditya's CFG

A Control-Flow Graph $G = (V, E)$ for an Express route consists of:

- **Vertices ($V$):**
  - `ENTRY`: Start of the HTTP request.
  - `GLOBAL_MIDDLEWARE`: Middlewares registered on the root `app.use(...)`.
  - `ROUTER_MIDDLEWARE`: Middlewares registered on sub-routers.
  - `ROUTE_MIDDLEWARE`: Middlewares registered directly on the route call.
  - `CONTROLLER_HANDLER`: The terminal route handler (e.g. database update, response sender).
  - `EXIT`: Request completion (response sent).

- **Directed Edges ($E$):**
  - Directed edges represent the order in which Express invokes functions when `next()` is called:
    $$(u, v) \in E \iff \text{Middleware } u \text{ passes control to } v$$

---

### 5.3. Aaditya's Detailed Step-by-Step Implementation

#### Step 1: Symbol & Module Resolver (`moduleResolver.ts`)
- Ingest all `files` from Krishna's manifest.
- Build an index mapping `(filePath, exportName) -> RouterDeclaration`.
- Resolve imports/requires so that when `app.use('/auth', authRouter)` is encountered in `app.js`, Aaditya connects `authRouter` directly to the routes declared in `authRoutes.js`.

#### Step 2: Route Hierarchy & Prefix Composer (`routeComposer.ts`)
- Model the Express routing system as a tree of routers.
- Recursively calculate the cumulative path for every endpoint:
  $$\text{Full Path} = \text{Parent Mount Path} + \text{Sub-router Mount Path} + \text{Route Path}$$
- Example:
  - Root: `/`
  - Mount 1: `/api/v1`
  - Mount 2: `/users`
  - Endpoint: `/:id`
  - **Resolved Endpoint:** `/api/v1/users/:id`

#### Step 3: CFG Builder (`cfgBuilder.ts`)
For every unique `(HTTP_METHOD, FULL_PATH)` combination, generate a directed graph:
1. Create `ENTRY` node.
2. Append all global middlewares applicable to this path in their order of registration.
3. Append all router-level middlewares in mount order.
4. Append all route-specific middlewares in array order.
5. Append the terminal route handler.
6. Connect each node sequentially:
   $$\text{ENTRY} \longrightarrow M_1 \longrightarrow M_2 \longrightarrow \dots \longrightarrow M_k \longrightarrow \text{HANDLER} \longrightarrow \text{EXIT}$$
7. Handle error-handling middleware branches (`(err, req, res, next)`) if modeling error recovery edges.

#### Step 4: Security Policy Engine & Invariant Checker (`securityChecker.ts`)
Aaditya defines **Security Invariant Rules**:

**Rule 1: "Auth-Before-Sensitive-Operation"**
- **Definition:** For all routes matching sensitive patterns (e.g. `POST`, `PUT`, `DELETE` or path containing `/admin`, `/payment`, `/user`), an authenticated middleware node must **dominate** the handler.
- **Formal Graph Dominance Condition:**
  Node $A$ (Auth) dominates Node $H$ (Handler) if every path from `ENTRY` to $H$ in the CFG must pass through $A$.
- **Detection Logic:**
  ```
  For each CFG in compiledEndpoints:
    If endpoint is classified as SENSITIVE:
      Find all nodes along the path from ENTRY to HANDLER.
      Filter nodes that match known Security Checkpoints (e.g., 'verifyToken', 'auth', 'requireAdmin').
      If no security checkpoint exists before HANDLER:
        Emit SENSITIVITY_WITHOUT_AUTHENTICATION warning!
      If security checkpoint exists AFTER HANDLER:
        Emit MISORDERED_AUTHENTICATION warning!
  ```

**Rule 2: "Unprotected Sub-Router Mount"**
- If an entire sub-router handles administrative actions (e.g. `adminRouter`), but neither the mount call `app.use('/admin', adminRouter)` nor the sub-router routes contain an authorization checkpoint, flag the entire router tree.

#### Step 5: Diagnostic Report Generator (`reporter.ts`)
Format the findings into a readable developer report:
```
================================================================================
EXPRESSFLOW STATIC ANALYSIS SECURITY REPORT
================================================================================
[HIGH SEVERITY] Unauthenticated Sensitive Route Detected
  Endpoint: DELETE /api/admin/users/:id
  Handler:  deleteUserHandler
  Location: src/routes/adminRoutes.js:24:14
  
  Control Flow Sequence:
    [ENTRY] 
      -> corsMiddleware (src/server.js:12:0)
      -> logger (src/server.js:13:0)
      -> deleteUserHandler (src/routes/adminRoutes.js:24:14) [UNPROTECTED!]
      -> [EXIT]

  Invariant Violated: Rule #1 (Authentication checkpoint must dominate sensitive handler)
  Fix: Insert 'verifyAdminToken' middleware before 'deleteUserHandler'.
================================================================================
```

---

## 6. End-to-End Walkthrough of a Real Example

Let's trace how a project is analyzed from raw code to final security report.

### The Input Project: `src/server.js` and `src/admin.js`

```javascript
// File: src/admin.js
const express = require('express');
const adminRouter = express.Router();

// Sensitive endpoint missing auth!
adminRouter.delete('/purge-cache', purgeCacheHandler);

module.exports = adminRouter;
```

```javascript
// File: src/server.js
const express = require('express');
const cors = require('cors');
const adminRoutes = require('./admin');

const app = express();
app.use(cors());

// Mount the admin router
app.use('/admin', adminRoutes);

app.listen(3000);
```

---

### Step A: Krishna's Pipeline Runs

Krishna's parser processes both files and emits the **Intermediate Representation (IR)**:

```json
{
  "version": "1.0.0",
  "projectRoot": "./src",
  "files": [
    {
      "filePath": "src/admin.js",
      "routersDeclared": [
        { "identifier": "adminRouter", "kind": "ROUTER", "loc": { "start": { "line": 2, "column": 20 } } }
      ],
      "routeRegistrations": [
        {
          "registrationType": "ROUTE",
          "routerIdentifier": "adminRouter",
          "httpMethod": "DELETE",
          "path": { "type": "STATIC", "value": "/purge-cache", "loc": { "start": { "line": 5, "column": 19 } } },
          "middlewares": [
            {
              "executionOrder": 0,
              "type": "IDENTIFIER",
              "name": "purgeCacheHandler",
              "rawExpression": "purgeCacheHandler",
              "isInline": false,
              "loc": { "start": { "line": 5, "column": 35 }, "end": { "line": 5, "column": 52 } }
            }
          ],
          "loc": { "start": { "line": 5, "column": 0 }, "end": { "line": 5, "column": 54 } }
        }
      ],
      "mounts": [],
      "exports": [
        { "type": "DEFAULT", "localIdentifier": "adminRouter", "loc": { "start": { "line": 7, "column": 0 } } }
      ]
    },
    {
      "filePath": "src/server.js",
      "routersDeclared": [
        { "identifier": "app", "kind": "APPLICATION", "loc": { "start": { "line": 5, "column": 6 } } }
      ],
      "routeRegistrations": [],
      "mounts": [
        {
          "registrationType": "MOUNT",
          "parentRouter": "app",
          "subRouterIdentifier": "adminRoutes",
          "path": { "type": "STATIC", "value": "/admin", "loc": { "start": { "line": 9, "column": 8 } } },
          "loc": { "start": { "line": 9, "column": 0 }, "end": { "line": 9, "column": 31 } }
        }
      ],
      "exports": []
    }
  ]
}
```

---

### Step B: Aaditya's Middle-End Runs

1. **Symbol Linking:** Resolves `adminRoutes` in `src/server.js` to `module.exports = adminRouter` in `src/admin.js`.
2. **Path Composition:** Composes the full endpoint:
   $$\text{Parent: } \texttt{/admin} \;+\; \text{Route: } \texttt{/purge-cache} \implies \mathbf{\texttt{DELETE /admin/purge-cache}}$$
3. **CFG Assembly:**
   $$\text{ENTRY} \longrightarrow \text{cors()} \longrightarrow \text{purgeCacheHandler} \longrightarrow \text{EXIT}$$
4. **Security Analysis:**
   - Detects HTTP verb `DELETE` and keyword `purge-cache` (Classified as: **CRITICAL / SENSITIVE**).
   - Traverses CFG from `ENTRY` to `purgeCacheHandler`.
   - Checks for authentication middleware: **NONE FOUND**.
5. **Output Warning:** Flagged at `src/admin.js:5:35`!

---

## 7. Unified Project Structure

Here is how the combined repository should be structured to keep Krishna's and Aaditya's code cleanly organized:

```
ExpressFlow/
├── package.json
├── tsconfig.json
├── FRONTEND_IMPLEMENTATION.md        # This master documentation
├── src/
│   ├── index.ts                      # CLI entry point (orchestrates both phases)
│   │
│   ├── frontend/                     # ==========================================
│   │   │                             # KRISHNA'S DOMAIN
│   │   ├── parser/                   # ==========================================
│   │   │   ├── astParser.ts          # @babel/parser wrapper with configs
│   │   │   └── fileLoader.ts         # Fast file scanning and source loader
│   │   ├── scope/
│   │   │   └── symbolTracker.ts      # Tracks express() & express.Router() instances
│   │   ├── visitor/
│   │   │   ├── routeVisitor.ts       # AST traversal for app.use, app.get, etc.
│   │   │   ├── argumentExtractor.ts  # Unpacks paths, flattens middleware arrays
│   │   │   └── exportTracker.ts      # Tracks module.exports & export default
│   │   └── serializer/
│   │       └── manifestBuilder.ts    # Compiles and validates the JSON Handoff IR
│   │
│   ├── middleend/                    # ==========================================
│   │   │                             # AADITYA'S DOMAIN
│   │   ├── resolver/                 # ==========================================
│   │   │   └── moduleResolver.ts     # Links cross-file router imports & exports
│   │   ├── composer/
│   │   │   └── routeComposer.ts      # Merges paths: /api + /admin + /users
│   │   ├── cfg/
│   │   │   ├── cfgModel.ts           # CFG Node and Edge data structures
│   │   │   └── cfgBuilder.ts         # Assembles directed graph for each route
│   │   ├── analysis/
│   │   │   ├── dominatorTree.ts      # Graph reachability & dominance algorithms
│   │   │   └── securityChecker.ts    # Auth-before-sensitive-operation rules
│   │   └── reporter/
│   │       └── terminalReporter.ts   # Formatted CLI vulnerability report
│   │
│   └── shared/                       # ==========================================
│       └── types/                    # SHARED CONTRACTS
│           └── manifest.ts           # The TypeScript interfaces for the JSON IR
│
└── test/
    ├── fixtures/                     # Test Express sample codebases
    │   ├── 01-simple-auth/
    │   ├── 02-nested-routers/
    │   └── 03-vulnerable-bypass/
    ├── frontend/                     # Krishna's unit tests
    └── middleend/                    # Aaditya's unit tests
```

---

## 8. Development Roadmap & Milestones

| Milestone | Phase | Owner | Deliverable |
| :--- | :--- | :--- | :--- |
| **M1** | Project Setup | Krishna & Aaditya | Shared repository, `package.json`, shared `manifest.ts` types |
| **M2** | AST & Symbol Tracker | Krishna | Parse JS/TS files, detect `express()` and `Router()` instances |
| **M3** | Route & Middleware Visitor | Krishna | Extract routes, flatten middleware arrays, track exact coordinates |
| **M4** | IR Manifest Emission | Krishna | Emit verified `expressflow-manifest.json` from sample fixtures |
| **M5** | Module & Path Resolution | Aaditya | Ingest Krishna's IR, resolve cross-file imports, calculate full paths |
| **M6** | CFG Generation Engine | Aaditya | Build directed execution graphs for all endpoints |
| **M7** | Security Invariant Checker | Aaditya | Reachability analysis to verify security guards precede handlers |
| **M8** | End-to-End Integration | Both | Run ExpressFlow against real Express projects (e.g. Juice Shop) |

---

## 9. Next Action Steps

1. **Commit and Share:** Use this document as the single source of truth for the project.
2. **Initialize Workspace:** Set up `package.json` with `@babel/parser`, `@babel/traverse`, and TypeScript.
3. **Begin Milestone M1 & M2:** Start building the shared types (`src/shared/types/manifest.ts`) and Krishna's frontend parser components.
