import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def create_report():
    doc = docx.Document()

    # Page Margins: 1 inch (72pt)
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Color Palette - Professional Corporate / Academic Dark Navy Theme
    COLOR_PRIMARY = RGBColor(27, 54, 93)     # Deep Navy #1B365D
    COLOR_SECONDARY = RGBColor(43, 108, 176) # Slate Blue #2B6CB0
    COLOR_TEXT = RGBColor(45, 55, 72)        # Charcoal #2D3748
    COLOR_MUTED = RGBColor(113, 128, 150)    # Muted Gray #718096
    COLOR_CODE = RGBColor(26, 32, 44)        # Dark Code Text #1A202C

    HEX_PRIMARY = "1B365D"
    HEX_LIGHT_BG = "F7FAFC"
    HEX_CODE_BG = "F1F5F9"
    HEX_BORDER = "CBD5E0"
    HEX_ACCENT_BG = "EDF2F7"

    # Helper XML functions
    def set_cell_background(cell, hex_color):
        tcPr = cell._tc.get_or_add_tcPr()
        shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}" w:val="clear"/>')
        tcPr.append(shd)

    def set_cell_margins(cell, top=140, bottom=140, left=180, right=180):
        tcPr = cell._tc.get_or_add_tcPr()
        tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}>'
                          f'<w:top w:w="{top}" w:type="dxa"/>'
                          f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
                          f'<w:left w:w="{left}" w:type="dxa"/>'
                          f'<w:right w:w="{right}" w:type="dxa"/>'
                          f'</w:tcMar>')
        tcPr.append(tcMar)

    def set_table_borders(table, color="D3D8E2", sz="4", val="single"):
        tblPr = table._tbl.tblPr
        borders = parse_xml(f'<w:tblBorders {nsdecls("w")}>'
                            f'<w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
                            f'<w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
                            f'<w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
                            f'<w:insideV w:val="none"/>'
                            f'<w:left w:val="none"/>'
                            f'<w:right w:val="none"/>'
                            f'</w:tblBorders>')
        tblPr.append(borders)

    def set_box_borders(table, border_color="CBD5E0", left_color="1B365D", left_sz="24"):
        tblPr = table._tbl.tblPr
        borders = parse_xml(f'<w:tblBorders {nsdecls("w")}>'
                            f'<w:top w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
                            f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
                            f'<w:left w:val="single" w:sz="{left_sz}" w:space="0" w:color="{left_color}"/>'
                            f'<w:right w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
                            f'</w:tblBorders>')
        tblPr.append(borders)

    # NON-COLLAPSIBLE HEADING HELPERS
    # By using doc.add_paragraph() with Normal style and run formatting,
    # Word NEVER generates collapsible dropdown/expand-collapse arrows!
    def add_sec_heading(title_text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(18)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(title_text)
        run.bold = True
        run.font.name = "Calibri"
        run.font.size = Pt(15)
        run.font.color.rgb = COLOR_PRIMARY
        return p

    def add_sub_heading(title_text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(title_text)
        run.bold = True
        run.font.name = "Calibri"
        run.font.size = Pt(12.5)
        run.font.color.rgb = COLOR_SECONDARY
        return p

    def add_sub_sub_heading(title_text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(title_text)
        run.bold = True
        run.font.name = "Calibri"
        run.font.size = Pt(11)
        run.font.color.rgb = COLOR_TEXT
        return p

    def add_body_p(text, bold_prefix=""):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(5)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            rb = p.add_run(bold_prefix)
            rb.bold = True
            rb.font.name = "Calibri"
            rb.font.size = Pt(10.5)
            rb.font.color.rgb = COLOR_TEXT
        r = p.add_run(text)
        r.font.name = "Calibri"
        r.font.size = Pt(10.5)
        r.font.color.rgb = COLOR_TEXT
        return p

    def add_bullet_p(text, bold_prefix=""):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.25)
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.15
        
        # bullet symbol
        rb_sym = p.add_run("•  ")
        rb_sym.bold = True
        rb_sym.font.name = "Calibri"
        rb_sym.font.size = Pt(10.5)
        rb_sym.font.color.rgb = COLOR_SECONDARY
        
        if bold_prefix:
            rb = p.add_run(bold_prefix)
            rb.bold = True
            rb.font.name = "Calibri"
            rb.font.size = Pt(10.5)
            rb.font.color.rgb = COLOR_TEXT
        r = p.add_run(text)
        r.font.name = "Calibri"
        r.font.size = Pt(10.5)
        r.font.color.rgb = COLOR_TEXT
        return p

    def add_code_block(code_text):
        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = tbl.cell(0, 0)
        set_cell_background(cell, HEX_CODE_BG)
        set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
        
        # border: subtle left border
        tblPr = tbl._tbl.tblPr
        borders = parse_xml(f'<w:tblBorders {nsdecls("w")}>'
                            f'<w:top w:val="none"/>'
                            f'<w:bottom w:val="none"/>'
                            f'<w:left w:val="single" w:sz="18" w:space="0" w:color="2B6CB0"/>'
                            f'<w:right w:val="none"/>'
                            f'</w:tblBorders>')
        tblPr.append(borders)
        
        cp = cell.paragraphs[0]
        cp.paragraph_format.space_before = Pt(0)
        cp.paragraph_format.space_after = Pt(0)
        cp.paragraph_format.line_spacing = 1.1
        
        # split by newline
        lines = code_text.strip().split("\n")
        for i, line in enumerate(lines):
            if i > 0:
                cp = cell.add_paragraph()
                cp.paragraph_format.space_before = Pt(0)
                cp.paragraph_format.space_after = Pt(0)
                cp.paragraph_format.line_spacing = 1.1
            r = cp.add_run(line)
            r.font.name = "Consolas"
            r.font.size = Pt(9.0)
            r.font.color.rgb = COLOR_CODE
        
        # spacing after table
        sp = doc.add_paragraph()
        sp.paragraph_format.space_before = Pt(0)
        sp.paragraph_format.space_after = Pt(4)

    def add_callout_box(text, bold_title="Key Takeaway: "):
        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = tbl.cell(0, 0)
        set_cell_background(cell, HEX_ACCENT_BG)
        set_cell_margins(cell, top=120, bottom=120, left=160, right=160)
        set_box_borders(tbl, border_color="CBD5E0", left_color="1B365D", left_sz="24")
        
        cp = cell.paragraphs[0]
        cp.paragraph_format.space_before = Pt(0)
        cp.paragraph_format.space_after = Pt(0)
        cp.paragraph_format.line_spacing = 1.15
        
        if bold_title:
            rb = cp.add_run(bold_title)
            rb.bold = True
            rb.font.name = "Calibri"
            rb.font.size = Pt(10)
            rb.font.color.rgb = COLOR_PRIMARY
        
        r = cp.add_run(text)
        r.font.name = "Calibri"
        r.font.size = Pt(10)
        r.font.italic = True
        r.font.color.rgb = COLOR_TEXT

        sp = doc.add_paragraph()
        sp.paragraph_format.space_before = Pt(0)
        sp.paragraph_format.space_after = Pt(4)

    # =========================================================================
    # 1. INTRODUCTION PAGE / COVER PAGE
    # =========================================================================
    p_inst = doc.add_paragraph()
    p_inst.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_inst.paragraph_format.space_before = Pt(20)
    p_inst.paragraph_format.space_after = Pt(2)
    r_inst = p_inst.add_run("VELLORE INSTITUTE OF TECHNOLOGY (VIT)")
    r_inst.bold = True
    r_inst.font.name = "Calibri"
    r_inst.font.size = Pt(15)
    r_inst.font.color.rgb = COLOR_PRIMARY

    p_school = doc.add_paragraph()
    p_school.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_school.paragraph_format.space_before = Pt(0)
    p_school.paragraph_format.space_after = Pt(4)
    r_school = p_school.add_run("School of Computer Science and Engineering (SCOPE)")
    r_school.font.name = "Calibri"
    r_school.font.size = Pt(12)
    r_school.font.color.rgb = COLOR_MUTED

    p_course = doc.add_paragraph()
    p_course.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_course.paragraph_format.space_before = Pt(0)
    p_course.paragraph_format.space_after = Pt(24)
    r_course = p_course.add_run("Course: BCSE307P – Compiler Design Lab")
    r_course.bold = True
    r_course.font.name = "Calibri"
    r_course.font.size = Pt(12)
    r_course.font.color.rgb = COLOR_SECONDARY

    # Project Title
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(10)
    p_title.paragraph_format.space_after = Pt(4)
    r_title = p_title.add_run("ExpressFlow: Semantic Static Analysis of Express.js Middleware Architectures")
    r_title.bold = True
    r_title.font.name = "Calibri"
    r_title.font.size = Pt(20)
    r_title.font.color.rgb = COLOR_PRIMARY

    # Subtitle
    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(16)
    r_sub = p_sub.add_run("Ahead-Of-Time (AOT) Route Verification via AST-to-CFG Program Synthesis")
    r_sub.font.name = "Calibri"
    r_sub.font.size = Pt(13)
    r_sub.font.italic = True
    r_sub.font.color.rgb = COLOR_MUTED

    # Document / Milestone Badge
    p_milestone = doc.add_paragraph()
    p_milestone.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_milestone.paragraph_format.space_before = Pt(0)
    p_milestone.paragraph_format.space_after = Pt(28)
    r_m = p_milestone.add_run("COMPREHENSIVE PROJECT PROGRESS REPORT (75% IMPLEMENTATION)")
    r_m.bold = True
    r_m.font.name = "Calibri"
    r_m.font.size = Pt(11)
    r_m.font.color.rgb = COLOR_SECONDARY

    # Team Information Section Heading
    p_th = doc.add_paragraph()
    p_th.paragraph_format.space_before = Pt(14)
    p_th.paragraph_format.space_after = Pt(6)
    r_th = p_th.add_run("Student & Project Team Details")
    r_th.bold = True
    r_th.font.name = "Calibri"
    r_th.font.size = Pt(13)
    r_th.font.color.rgb = COLOR_PRIMARY

    # Team Table
    team_table = doc.add_table(rows=3, cols=5)
    team_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(team_table, color="B0C4DE", sz="6", val="single")

    team_headers = ["S. No.", "Register No.", "Student Name", "Domain & Allocated Responsibilities", "Status"]
    col_widths = [Inches(0.6), Inches(1.2), Inches(1.3), Inches(2.7), Inches(0.9)]

    # Format Header Row
    hdr_cells = team_table.rows[0].cells
    for i, title in enumerate(team_headers):
        hdr_cells[i].text = title
        set_cell_background(hdr_cells[i], HEX_PRIMARY)
        set_cell_margins(hdr_cells[i], top=120, bottom=120, left=100, right=100)
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if i in [0, 1, 4] else WD_ALIGN_PARAGRAPH.LEFT
        for r in p.runs:
            r.bold = True
            r.font.name = "Calibri"
            r.font.size = Pt(9.5)
            r.font.color.rgb = RGBColor(255, 255, 255)

    team_data = [
        ("1", "24BCE0732", "Krishna", "Frontend Pipeline: Lexical & syntactic analysis, ESTree/Babel AST generation, Express scope and symbol tracking, route/middleware argument deconstruction, and IR manifest serialization.", "100% Done"),
        ("2", "24BCE2584", "Aaditya Jaiswal", "Middle-End Engine: Cross-file module linking, prefix tree URL composition, Control-Flow Graph (CFG) generation, and multi-format graph exporters.", "100% Done")
    ]

    for row_idx, data in enumerate(team_data):
        row_cells = team_table.rows[row_idx + 1].cells
        bg_col = "FFFFFF" if row_idx % 2 == 0 else HEX_LIGHT_BG
        for col_idx, text in enumerate(data):
            row_cells[col_idx].text = text
            set_cell_background(row_cells[col_idx], bg_col)
            set_cell_margins(row_cells[col_idx], top=100, bottom=100, left=100, right=100)
            p = row_cells[col_idx].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if col_idx in [0, 1, 4] else WD_ALIGN_PARAGRAPH.LEFT
            for r in p.runs:
                r.font.name = "Calibri"
                r.font.size = Pt(9.0)
                r.font.color.rgb = COLOR_TEXT
                if col_idx in [1, 2]:
                    r.bold = True
                if col_idx == 4:
                    r.bold = True
                    r.font.color.rgb = RGBColor(22, 101, 52) # Dark Green

    # Set column widths
    for row in team_table.rows:
        for i, w in enumerate(col_widths):
            row.cells[i].width = w

    # Metadata footer block on cover
    p_meta = doc.add_paragraph()
    p_meta.paragraph_format.space_before = Pt(36)
    p_meta.paragraph_format.space_after = Pt(2)
    p_meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_meta1 = p_meta.add_run("Academic Term: Fall Semester 2026-2027  |  Submission Date: October 2026\n")
    r_meta1.font.name = "Calibri"
    r_meta1.font.size = Pt(10)
    r_meta1.font.color.rgb = COLOR_MUTED
    r_meta2 = p_meta.add_run("Compiler Engineering & Static Analysis Research Group")
    r_meta2.bold = True
    r_meta2.font.name = "Calibri"
    r_meta2.font.size = Pt(10)
    r_meta2.font.color.rgb = COLOR_SECONDARY

    # End of Introduction Cover Page
    doc.add_page_break()

    # =========================================================================
    # 2. EXECUTIVE SUMMARY & INTRODUCTION
    # =========================================================================
    add_sec_heading("1. Executive Summary & Project Introduction")
    
    add_body_p(
        "Modern enterprise web backends built on Node.js and the Express.js framework process billions of mission-critical "
        "requests daily, ranging from financial transactions to patient health records. The security, authentication, "
        "and authorization postures of these applications do not rely on centralized declarative schemas or compiled type guards. "
        "Instead, Express.js delegates all security enforcement to dynamically chained middleware functions that execute "
        "sequentially in an asynchronous pipeline."
    )
    
    add_body_p(
        "Because JavaScript is an interpreted, dynamically-typed language, middleware functions are registered imperatively "
        "at runtime. If an administrative route inadvertently omits an authorization checkpoint, or if a developer mistakenly "
        "places a database modification handler before an authentication guard, neither the JavaScript runtime (Node.js) nor "
        "standard type checkers (TypeScript) will throw an error or warning. The source code is syntactically flawless and runs "
        "without exceptions, yet it harbors severe authorization bypass vulnerabilities (CWE-862 and CWE-285)."
    )

    add_body_p(
        "ExpressFlow is a specialized Ahead-Of-Time (AOT) compiler and static program analysis framework designed to eliminate "
        "this critical vulnerability class. Rather than relying on fragile regular expressions or costly dynamic runtime penetration tests, "
        "ExpressFlow treats the Express.js application as a formal programming language grammar. It parses source files into Abstract Syntax "
        "Trees (AST), extracts route hierarchies and middleware chains into an Intermediate Representation (IR), links cross-file "
        "modules, and compiles formal directed Control-Flow Graphs (CFGs) for every reachable HTTP endpoint."
    )

    add_callout_box(
        "Project Objective: ExpressFlow bridges classical compiler construction techniques (lexical parsing, AST visitation, "
        "cross-translation unit symbol linking, and Control-Flow Graph synthesis) with server-side web application security, "
        "allowing developers to statically detect route misconfigurations and missing security guards before deploying to production.",
        "Core Project Vision: "
    )

    # =========================================================================
    # 3. PROBLEM STATEMENT EXPLAINED WITH EXAMPLES
    # =========================================================================
    add_sec_heading("2. Problem Statement Explained with Concrete Examples")

    add_body_p(
        "In Express.js architectures, request handling is modeled around the Chain-of-Responsibility pattern. When an HTTP "
        "request arrives at a matching route path, Express dispatches the request to an ordered array of handler functions. "
        "Each middleware function takes three arguments: (req, res, next). Execution proceeds to the next function in the chain "
        "if and only if the current function explicitly invokes next(). If a handler writes a response to the client (res.send() or "
        "res.json()) without calling next(), the request lifecycle immediately terminates."
    )

    add_body_p(
        "While this architecture provides great flexibility, it introduces profound vulnerabilities when software systems scale "
        "into hundreds of routes spread across dozens of modular files. Below, we explain the core failure modes using concrete "
        "code examples extracted from common real-world development mistakes."
    )

    add_sub_heading("Example 1: Missing Authentication on Sensitive Administrative Endpoints")
    add_body_p(
        "Consider an e-commerce or cloud platform where administrative routes allow purging the database or dropping database "
        "tables. In a modular codebase, developers frequently register routes without repeating security middleware, incorrectly "
        "assuming that parent routers or global middleware already enforce authentication."
    )

    add_code_block(
        "// File: routes/admin.js (Vulnerable Implementation)\n"
        "const express = require('express');\n"
        "const router = express.Router();\n\n"
        "// VULNERABILITY: Sensitive route registered without verifyAdmin guard!\n"
        "router.delete('/database', purgeDatabase);\n"
        "router.post('/restart', verifyAdmin, restartServer);\n\n"
        "module.exports = router;"
    )

    add_body_p(
        "Why Existing Tools Fail to Catch This: Node.js executes this code cleanly. Linters like ESLint only check variable "
        "usage and lexical syntax. TypeScript verifies that purgeDatabase matches the Express RequestHandler type signature. "
        "None of them possess semantic awareness that purgeDatabase is a high-privilege action requiring a preceding authorization guard. "
        "Consequently, an unauthenticated attacker can send an HTTP DELETE /api/admin/database request and completely destroy production data."
    )

    add_sub_heading("Example 2: Middleware-Handler Execution Order Inversion Bug")
    add_body_p(
        "Because Express routes accept variable-length argument lists, developers sometimes invert the positional order of handlers. "
        "This occurs especially when multiple developers refactor routes or merge Git branches."
    )

    add_code_block(
        "// File: routes/records.js (Execution Order Inversion)\n"
        "const express = require('express');\n"
        "const router = express.Router();\n\n"
        "// VULNERABILITY: The action handler is passed BEFORE the auth guard!\n"
        "router.post('/wipe-records', deleteCompanyRecords, verifySuperUserToken);\n\n"
        "function deleteCompanyRecords(req, res) {\n"
        "  database.wipeAll();\n"
        "  return res.status(200).json({ success: true, message: 'All records purged' });\n"
        "  // Notice: next() is NEVER called because response has already been sent!\n"
        "}"
    )

    add_body_p(
        "Impact & Execution Dynamics: In this inverted configuration, when a client makes a POST request, Express immediately invokes "
        "deleteCompanyRecords. The records are erased from the database, and the HTTP 200 response is dispatched to the client. "
        "The security guard verifySuperUserToken is never even executed because the control-flow chain halted. The sensitive operation "
        "was executed with zero authorization."
    )

    add_sub_heading("Example 3: Cross-File Router Mounting & Middleware Isolation Pitfalls")
    add_body_p(
        "In production architectures, route definitions are split across separate files. A sub-router mounted at /api/users may "
        "rely on middleware registered in app.js, while another sub-router in routes/admin.js is mounted without any guards."
    )

    add_code_block(
        "// File: app.js\n"
        "const express = require('express');\n"
        "const app = express();\n"
        "const adminRouter = require('./routes/admin');\n\n"
        "app.use(express.json()); // Global body parser only\n\n"
        "// The developer believed auth was applied here, but forgot to pass requireAuth!\n"
        "app.use('/api/admin', adminRouter);\n\n"
        "// File: routes/admin.js\n"
        "const router = express.Router();\n"
        "// Developer wrote this file assuming app.js would protect the entire /api/admin mount\n"
        "router.get('/audit-logs', fetchConfidentialLogs);\n"
        "module.exports = router;"
    )

    add_body_p(
        "Architectural Cause: Because the sub-router file (routes/admin.js) and the mounting file (app.js) are completely separate "
        "translation units, static analysis requires cross-file symbol resolution and URL prefix tree composition. Single-file "
        "scanners cannot see the mount point, while file-level linters cannot determine what prefix /audit-logs ends up having."
    )

    add_sub_heading("Example 4: Nested Middleware Array Obfuscation")
    add_body_p(
        "Express supports passing arbitrarily nested arrays of middleware functions. For example: "
        "app.post('/checkout', [rateLimit, [verifyToken, validateCart]], checkoutHandler). Naive scanning tools using regular expressions "
        "completely break when encountering nested arrays, inline arrow functions, or imported middleware bundles, failing to map "
        "the exact sequential order of execution."
    )

    # =========================================================================
    # 4. PLANNED SOLUTION & THEORETICAL ARCHITECTURE
    # =========================================================================
    add_sec_heading("3. Planned Solution & Theoretical Architecture")

    add_body_p(
        "To resolve these challenges, ExpressFlow implements a full Ahead-Of-Time (AOT) compiler architecture divided into "
        "three structured phases. The compiler takes raw JavaScript and TypeScript project files as input, performs static "
        "analysis without executing the code, and produces formal verification results."
    )

    # Architecture Overview Box
    add_callout_box(
        "Phase 1: Frontend Pipeline (100% Completed by Krishna)\n"
        "Transforms source files into an AST, extracts Express symbols, flattens middleware arrays, and serializes an Intermediate Representation (IR Manifest).\n\n"
        "Phase 2: Middle-End Engine (100% Completed for Review 2 Scope by Aaditya Jaiswal)\n"
        "Resolves cross-file module linkages, computes prefix tree URL compositions, and synthesizes directed Control-Flow Graphs (CFGs).\n\n"
        "Phase 3: Backend Security Analysis Engine (Scheduled for Review 3 - Final 25% Scope)\n"
        "Constructs dominator trees, verifies path-reachability security invariants, and generates source-coordinate diagnostic vulnerability reports.",
        "Three-Phase Compiler Architecture: "
    )

    add_sub_heading("Compiler Theoretical Formalisms")
    
    add_body_p(
        "ExpressFlow is built upon rigorous compiler theory principles:",
        "Theoretical Foundation: "
    )

    add_bullet_p(
        "Abstract Syntax Tree (AST) to Intermediate Representation (IR): Source files are parsed into ESTree-compliant ASTs using "
        "@babel/parser. The frontend traverses the AST to extract route semantics and serializes them into a strongly-typed "
        "Intermediate Representation (manifest.json) that abstracts away JavaScript-specific syntactic noise.",
        "1. IR Normalization: "
    )

    add_bullet_p(
        "Control-Flow Graph (CFG) Mathematical Formulation: For every composed HTTP endpoint R, ExpressFlow constructs a formal "
        "Directed Acyclic Graph (DAG) denoted as G_R = (V, E). "
        "The vertex set V = {v_entry} U V_global U V_mount U V_router U V_route U {v_handler} U {v_exit}. "
        "The directed edge set E represents sequential next() control transfers: (u, v) in E implies that completion of middleware u "
        "transfers control directly to v.",
        "2. Formal CFG Formulation: "
    )

    add_bullet_p(
        "Path Algebra & Route Composition: Let a sub-router R_sub be mounted onto a parent router R_parent at mount path P_mount, "
        "and let an endpoint be declared on R_sub with route path P_route. The cumulative absolute URL path P_composed is computed via "
        "path concatenation with normalization: P_composed = Normalize(P_mount o P_route). Path parameters (:id, :userId) and "
        "duplicate slashes are resolved deterministically.",
        "3. Route Composition Algebra: "
    )

    add_bullet_p(
        "Security Dominance & Path Reachability: In classical compiler optimization, a node D dominates a node N (written D dom N) "
        "if every control-flow path from ENTRY to N must pass through D. In ExpressFlow, security invariants are verified using "
        "dominance: for any sensitive handler H, the set of security guards {Auth} must strictly dominate H along all execution paths.",
        "4. Security Invariant Checking: "
    )

    # =========================================================================
    # 5. CURRENT PROGRESS (75% REVIEW 2 MILESTONE)
    # =========================================================================
    add_sec_heading("4. Current Progress (Review 2 Milestone - 75% Implementation Completed)")

    add_body_p(
        "The ExpressFlow project has achieved a major milestone: 75% of the total system implementation is fully completed, "
        "integrated, and validated through automated test suites. The first two phases (Frontend Pipeline and Middle-End Engine) "
        "are completely operational."
    )

    # Milestone Matrix Table
    add_sub_heading("Milestone Status Matrix")
    
    ms_table = doc.add_table(rows=9, cols=5)
    ms_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(ms_table, color="B0C4DE", sz="6", val="single")

    ms_headers = ["Milestone", "System Scope & Key Deliverables", "Owner", "Target %", "Status"]
    ms_widths = [Inches(1.2), Inches(2.8), Inches(1.1), Inches(0.8), Inches(0.9)]

    hdr_cells = ms_table.rows[0].cells
    for i, title in enumerate(ms_headers):
        hdr_cells[i].text = title
        set_cell_background(hdr_cells[i], HEX_PRIMARY)
        set_cell_margins(hdr_cells[i], top=120, bottom=120, left=100, right=100)
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if i in [0, 2, 3, 4] else WD_ALIGN_PARAGRAPH.LEFT
        for r in p.runs:
            r.bold = True
            r.font.name = "Calibri"
            r.font.size = Pt(9.5)
            r.font.color.rgb = RGBColor(255, 255, 255)

    ms_data = [
        ("M1: Project Setup", "Repository architecture, TypeScript compiler configuration, shared IR contract (manifest.ts)", "Both", "12.5%", "Completed"),
        ("M2: AST & Symbol Tracker", "Babel parser wrapper, recursive file crawler, dynamic Express scope identifier tracker", "Krishna", "25.0%", "Completed"),
        ("M3: Route & MW Visitor", "AST visitor for app.use/app.METHOD, recursive middleware array flattening, coordinate tagging", "Krishna", "37.5%", "Completed"),
        ("M4: IR Manifest Serializer", "Unified JSON manifest builder, source metadata emission, disk caching (manifest.json)", "Krishna", "50.0%", "Completed"),
        ("M5: Module & Path Linker", "Two-pass cross-file CommonJS/ESM module resolver, cumulative URL prefix tree composer", "Aaditya", "62.5%", "Completed"),
        ("M6: CFG Synthesis Engine", "Directed execution graph builder (ENTRY -> MW -> HANDLER -> EXIT), ASCII/DOT/Mermaid exporters", "Aaditya", "75.0%", "Completed"),
        ("M7: Security Checker", "Graph dominator tree construction (Dom(D, H)), auth-before-sensitive-handler verification", "Aaditya", "87.5%", "Scheduled (R3)"),
        ("M8: CVE Evaluation", "OWASP Juice Shop / NodeGoat benchmark, precision/recall metrics, vulnerability diagnostics", "Both", "100.0%", "Scheduled (R3)")
    ]

    for row_idx, data in enumerate(ms_data):
        row_cells = ms_table.rows[row_idx + 1].cells
        bg_col = "FFFFFF" if row_idx % 2 == 0 else HEX_LIGHT_BG
        for col_idx, text in enumerate(data):
            row_cells[col_idx].text = text
            set_cell_background(row_cells[col_idx], bg_col)
            set_cell_margins(row_cells[col_idx], top=100, bottom=100, left=100, right=100)
            p = row_cells[col_idx].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if col_idx in [0, 2, 3, 4] else WD_ALIGN_PARAGRAPH.LEFT
            for r in p.runs:
                r.font.name = "Calibri"
                r.font.size = Pt(9.0)
                r.font.color.rgb = COLOR_TEXT
                if col_idx == 0:
                    r.bold = True
                if col_idx == 4:
                    r.bold = True
                    if "Completed" in text:
                        r.font.color.rgb = RGBColor(22, 101, 52) # Green
                    else:
                        r.font.color.rgb = RGBColor(194, 65, 12) # Amber/Orange

    for row in ms_table.rows:
        for i, w in enumerate(ms_widths):
            row.cells[i].width = w

    add_sub_heading("Detailed Component Implementation Breakdown")

    add_sub_sub_heading("1. Frontend Pipeline Components (Lead: Krishna – 100% Completed)")
    add_bullet_p(
        "Location-Aware AST Parser (src/frontend/parser/astParser.ts): Wraps @babel/parser with full source coordinate tracking. "
        "Parses modern ECMAScript 2024, TypeScript, and JSX into ESTree ASTs with precise line, column, and character offsets.",
        "• astParser.ts: "
    )
    add_bullet_p(
        "Recursive File Crawler (src/frontend/parser/fileLoader.ts): Recursively scans target project directories, automatically "
        "filtering out node_modules, build artifacts (.dist, .build), and version control metadata (.git).",
        "• fileLoader.ts: "
    )
    add_bullet_p(
        "Dynamic Scoped Symbol Tracker (src/frontend/scope/symbolTracker.ts): Identifies all Express application instances and "
        "router declarations by inspecting require('express') and express() / express.Router() call expressions, tracking local variable "
        "aliases across functional scopes.",
        "• symbolTracker.ts: "
    )
    add_bullet_p(
        "Route Deconstruction Visitor (src/frontend/visitor/routeVisitor.ts): Uses @babel/traverse to hook into CallExpression nodes. "
        "Extracts route HTTP methods (GET, POST, PUT, DELETE, PATCH), route paths, and recursively unpacks nested middleware arrays.",
        "• routeVisitor.ts: "
    )
    add_bullet_p(
        "Module Export Tracker (src/frontend/visitor/exportTracker.ts): Inspects module.exports, exports.<name>, and export default "
        "statements to map exported router instances for cross-translation unit linking.",
        "• exportTracker.ts: "
    )
    add_bullet_p(
        "Intermediate Representation Builder (src/frontend/builder/manifestBuilder.ts): Aggregates discovered routers, route registrations, "
        "sub-router mounts, and exported symbols into a strictly typed manifest.json file.",
        "• manifestBuilder.ts: "
    )

    add_sub_sub_heading("2. Middle-End Engine Components (Lead: Aaditya Jaiswal – 100% Completed for Review 2 Scope)")
    add_bullet_p(
        "Cross-File Module Resolver (src/middleend/resolver/moduleResolver.ts): Implements a two-pass linking algorithm. Pass 1 indexes "
        "all router instances and export signatures across all files. Pass 2 resolves require('./routes/admin') import declarations, "
        "matching mounted sub-router variables to remote router files.",
        "• moduleResolver.ts: "
    )
    add_bullet_p(
        "URL Prefix Tree & Route Composer (src/middleend/composer/routeComposer.ts): Performs depth-first traversal of the router "
        "hierarchy. Computes cumulative route paths (/api + /admin + /database -> /api/admin/database) and aggregates inherited "
        "middleware stacks in exact execution sequence: [GLOBAL] -> [MOUNT] -> [ROUTER] -> [ROUTE] -> [HANDLER].",
        "• routeComposer.ts: "
    )
    add_bullet_p(
        "Control-Flow Graph Builder & Model (src/middleend/cfg/cfgBuilder.ts & cfgModel.ts): Constructs explicit directed graphs "
        "composed of CfgNode instances (ENTRY, GLOBAL_MW, ROUTE_MW, CONTROLLER_HANDLER, EXIT) connected by sequential CfgEdge objects "
        "carrying step semantics ('HTTP Request', 'next()', 'Response Sent').",
        "• cfgBuilder.ts: "
    )
    add_bullet_p(
        "Multi-Format Visualization Exporters: Provides three output format generators: toAscii() for rich terminal inspection, "
        "toDot() for Graphviz visual rendering, and toMermaid() for markdown and slide documentation.",
        "• Graph Exporters: "
    )

    add_sub_heading("Experimental Verification & Test Results")
    add_body_p(
        "The automated test suite (test/run-test.js) was executed across both single-file fixtures (test/fixtures/sample-app.js) "
        "and multi-file modular architectures (test/fixtures/modular-app/). All 12 automated unit and integration tests passed "
        "with 100% success rate."
    )

    add_code_block(
        "=================================================\n"
        "EXPRESSFLOW AUTOMATED TEST SUITE (REVIEW 2 - 75%)\n"
        "=================================================\n"
        ">>> PART 1: FRONTEND PIPELINE (Lexical, AST & Manifest IR) <<<\n"
        "[Test 1] Parsing fixture and analyzing AST...                [PASS]\n"
        "[Test 2] Verifying Discovered Routers (app, userRouter)...     [PASS]\n"
        "[Test 3] Verifying Extracted Routes & Flattening...           [PASS]\n"
        "  ✓ Flattened nested middleware arrays in POST /checkout (4 middlewares)\n"
        "  ✓ Extracted sub-router DELETE /:id route with checkAdmin guard\n"
        "[Test 4] Verifying Sub-Router Mounts (app.use('/api/users'))...[PASS]\n"
        "[Test 5] Verifying Exports (module.exports = app)...          [PASS]\n"
        "[Test 6] Verifying Full Project Manifest Builder...           [PASS]\n\n"
        ">>> PART 2: MIDDLE-END ENGINE (Module Resolution, CFG) <<<\n"
        "[Test 7] Running Middle-End Pipeline on sample fixture...     [PASS]\n"
        "[Test 8] Verifying Route Hierarchy & Prefix Composition...    [PASS]\n"
        "  ✓ Correctly composed path: '/api/users' + '/:id' -> '/api/users/:id'\n"
        "[Test 9] Verifying CFG Construction & Graph Invariants...     [PASS]\n"
        "  ✓ Verified directed topology: ENTRY -> M0 -> M1 -> M2 -> HANDLER -> EXIT\n"
        "[Test 10] Verifying Cross-File Symbol Resolution (modular-app)[PASS]\n"
        "[Test 11] Verifying Cross-File Route Composition...           [PASS]\n"
        "  ✓ Linked /api/admin/database and /api/users/profile across separate files\n"
        "[Test 12] Verifying CFG Exporters (ASCII, DOT, Mermaid)...    [PASS]\n"
        "=================================================\n"
        "RESULT: 12/12 TESTS PASSED (100% SUCCESS RATE)\n"
        "================================================="
    )

    add_sub_heading("CLI Execution Demonstration & Composed Routes")
    add_body_p(
        "Running ExpressFlow against the multi-file test fixture (node dist/index.js ./test/fixtures/modular-app --cfg) "
        "produces the following composed route execution summary and synthesized Control-Flow Graph:"
    )

    add_code_block(
        "+---------+-----------------------+-------+-------------------+-------------------+\n"
        "| METHOD  | COMPOSED ENDPOINT     | STEPS | ACTION HANDLER    | SOURCE LOCATION   |\n"
        "+---------+-----------------------+-------+-------------------+-------------------+\n"
        "| GET     | /status               | 4     | inline(req, res)  | app.js:16         |\n"
        "| DELETE  | /api/admin/database   | 5     | purgeDatabase     | routes/admin.js:5 |\n"
        "| POST    | /api/admin/restart    | 6     | restartServer     | routes/admin.js:6 |\n"
        "| GET     | /api/users/profile    | 5     | getUserProfile    | routes/user.js:5  |\n"
        "| PUT     | /api/users/settings   | 6     | updateSettings    | routes/user.js:6  |\n"
        "+---------+-----------------------+-------+-------------------+-------------------+\n\n"
        "SYNTHESIZED CONTROL-FLOW GRAPH (CFG):\n"
        "Endpoint: DELETE /api/admin/database (Source: routes/admin.js:5)\n\n"
        "  [START] ENTRY: DELETE /api/admin/database (routes/admin.js:5)\n"
        "             │\n"
        "             │  [Step 1: HTTP Request]\n"
        "             ▼\n"
        "  [MW]    [GLOBAL] express.json (app.js:5:8)\n"
        "             │\n"
        "             │  [Step 2: next()]\n"
        "             ▼\n"
        "  [MW]    [ROUTE] verifyAdmin (routes/admin.js:5:27)\n"
        "             │\n"
        "             │  [Step 3: next()]\n"
        "             ▼\n"
        "  [ACTN]  [ROUTE] purgeDatabase (routes/admin.js:5:40)\n"
        "             │\n"
        "             │  [Step 4: Response Sent]\n"
        "             ▼\n"
        "  [END]   EXIT (HTTP Response) (routes/admin.js:5)"
    )

    # =========================================================================
    # 6. REMAINING WORK & ROADMAP FOR REVIEW 3
    # =========================================================================
    add_sec_heading("5. Remaining Work & Roadmap to Final Review 3 (Remaining 25% Scope)")

    add_body_p(
        "With 75% of the compiler pipeline fully operational, the remaining 25% of the project scope is scheduled for "
        "Review 3 (Final Phase). This final phase centers on graph dominator analysis, security invariant verification, "
        "and empirical validation against real-world open-source vulnerabilities."
    )

    add_sub_heading("Milestone M7: Graph Dominator Tree Construction & Security Invariant Checker (87.5% Milestone)")
    add_body_p(
        "Scope & Algorithm Design: In the final phase, the middle-end CFGs will be fed into a Graph Dominator Tree analysis engine. "
        "The mathematical relation of dominance will be applied to detect unauthenticated paths:"
    )

    add_bullet_p(
        "Dominator Tree Synthesis: A node D strictly dominates node N if every path from ENTRY to N must pass through D. "
        "The algorithm computes immediate dominators (idom) and dominance frontiers across the CFG.",
        "1. Dominance Calculation: "
    )

    add_bullet_p(
        "Security Invariant Formulation: ExpressFlow will enforce formal security invariants such as Auth-Before-Sensitive-Handler: "
        "For any endpoint handler marked as state-modifying or sensitive (e.g. POST, PUT, DELETE, or administrative paths), "
        "there MUST exist an authentication/authorization node A in the vertex set such that A dominates H (A dom H).",
        "2. Invariant Verification: "
    )

    add_bullet_p(
        "Bypass & Dead Code Detection: If a path exists from ENTRY to H that bypasses A, or if a security middleware is attached "
        "after H, the checker flags a high-severity security invariant violation.",
        "3. Violation Flagging: "
    )

    add_sub_heading("Milestone M8: End-to-End Evaluation, CVE Benchmarking & Vulnerability Reporter (100% Milestone)")
    add_body_p(
        "Scope & Empirical Validation: The remaining engineering tasks focus on diagnostic reporting and real-world benchmarking:"
    )

    add_bullet_p(
        "Diagnostic Vulnerability Reporter: Generates formatted, developer-friendly diagnostic alerts detailing the exact source file, "
        "line number, and column where the security guard was omitted or misordered, along with automated remediation advice.",
        "1. Diagnostic CLI Reporter: "
    )

    add_bullet_p(
        "CVE Benchmarking on Real-World Repositories: ExpressFlow will be benchmarked against widely recognized vulnerable targets, "
        "including OWASP Juice Shop, NodeGoat, and historical vulnerable Express.js CVE targets.",
        "2. Real-World CVE Evaluation: "
    )

    add_bullet_p(
        "Accuracy & Performance Metrics: Quantitative evaluation of static analysis metrics: Precision, Recall, False Positive Rate, "
        "and Analysis Wall-Clock Time per 1,000 lines of code.",
        "3. Metrics & Publication: "
    )

    # Deliverables & Schedule Table
    add_sub_heading("Review 3 Action Plan & Timeline Schedule")

    plan_table = doc.add_table(rows=5, cols=4)
    plan_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(plan_table, color="B0C4DE", sz="6", val="single")

    plan_headers = ["Phase & Week", "Scheduled Task / Deliverable", "Assigned Lead", "Target Output"]
    plan_widths = [Inches(1.3), Inches(2.8), Inches(1.2), Inches(1.4)]

    hdr_cells = plan_table.rows[0].cells
    for i, title in enumerate(plan_headers):
        hdr_cells[i].text = title
        set_cell_background(hdr_cells[i], HEX_PRIMARY)
        set_cell_margins(hdr_cells[i], top=120, bottom=120, left=100, right=100)
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if i in [0, 2] else WD_ALIGN_PARAGRAPH.LEFT
        for r in p.runs:
            r.bold = True
            r.font.name = "Calibri"
            r.font.size = Pt(9.5)
            r.font.color.rgb = RGBColor(255, 255, 255)

    plan_data = [
        ("Week 1 (Oct 28 - Nov 04)", "Implement Dominator Tree Construction (Lengauer-Tarjan algorithm) and Dominance Frontiers on CFGs", "Aaditya Jaiswal", "dominatorTree.ts passing all unit tests"),
        ("Week 2 (Nov 05 - Nov 12)", "Implement Security Invariant Rule Engine (Auth-Before-Handler & Route Invariant Checker)", "Krishna", "invariantChecker.ts with policy definitions"),
        ("Week 3 (Nov 13 - Nov 20)", "Build Diagnostic CLI Vulnerability Reporter with source coordinate remediation suggestions", "Aaditya Jaiswal", "CLI report with line-level diff output"),
        ("Week 4 (Nov 21 - Nov 28)", "Benchmarking against OWASP Juice Shop & NodeGoat, final paper preparation & slide deck", "Both", "Evaluation report & 100% project completion")
    ]

    for row_idx, data in enumerate(plan_data):
        row_cells = plan_table.rows[row_idx + 1].cells
        bg_col = "FFFFFF" if row_idx % 2 == 0 else HEX_LIGHT_BG
        for col_idx, text in enumerate(data):
            row_cells[col_idx].text = text
            set_cell_background(row_cells[col_idx], bg_col)
            set_cell_margins(row_cells[col_idx], top=100, bottom=100, left=100, right=100)
            p = row_cells[col_idx].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if col_idx in [0, 2] else WD_ALIGN_PARAGRAPH.LEFT
            for r in p.runs:
                r.font.name = "Calibri"
                r.font.size = Pt(9.0)
                r.font.color.rgb = COLOR_TEXT
                if col_idx == 0:
                    r.bold = True

    for row in plan_table.rows:
        for i, w in enumerate(plan_widths):
            row.cells[i].width = w

    # =========================================================================
    # 7. CONCLUSION
    # =========================================================================
    add_sec_heading("6. Conclusion")

    add_body_p(
        "ExpressFlow successfully demonstrates how classical compiler construction techniques—specifically lexical and "
        "syntactic AST parsing, symbol scope tracking, Intermediate Representation serialization, and Control-Flow Graph synthesis—can "
        "be harnessed to solve critical security challenges in modern dynamic web applications. "
        "At the 75% implementation milestone, the team has delivered a fully functioning compiler frontend and middle-end engine, "
        "capable of ingesting complex modular Express.js codebases, resolving cross-file module linkages, computing URL prefix hierarchies, "
        "and compiling formal directed Control-Flow Graphs."
    )

    add_body_p(
        "With 12 out of 12 automated unit and integration tests passing across single-file and multi-file architectures, the system "
        "is robust and structurally ready for the final 25% phase. In Review 3, the graph dominator analysis and security invariant "
        "checking algorithms will be integrated, completing an end-to-end Ahead-Of-Time static analysis tool that guarantees "
        "route security before software is deployed into production."
    )

    add_callout_box(
        "Project Status Summary: 75% Total System Implementation Completed. All Frontend and Middle-End Milestones verified with 100% test pass rate. "
        "Scheduled for final completion and empirical benchmarking in Review 3.",
        "Final Assessment: "
    )

    output_path = "ExpressFlow_Progress_Report.docx"
    doc.save(output_path)
    print(f"Successfully generated: {os.path.abspath(output_path)}")

if __name__ == "__main__":
    create_report()
