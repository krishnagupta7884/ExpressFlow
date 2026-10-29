import { SecurityAnalysisReport, SecurityViolation } from "../analysis/securityModel";

/**
 * Formats a single SecurityViolation into a detailed diagnostic terminal card.
 */
export function formatViolationCard(violation: SecurityViolation, index: number, total: number): string {
  const lines: string[] = [];
  const cardWidth = 72;

  let severityBadge = "[CRITICAL]";
  if (violation.severity === "HIGH") severityBadge = "[HIGH]    ";
  else if (violation.severity === "MEDIUM") severityBadge = "[MEDIUM]  ";
  else if (violation.severity === "LOW") severityBadge = "[LOW]     ";

  lines.push(`╭` + "─".repeat(cardWidth - 2) + `╮`);
  lines.push(`│ Issue [${index + 1} of ${total}] ${severityBadge} ${violation.ruleName}`.slice(0, cardWidth - 2).padEnd(cardWidth - 1) + `│`);
  lines.push(`│ Endpoint: ${violation.method} ${violation.fullPath}`.slice(0, cardWidth - 2).padEnd(cardWidth - 1) + `│`);
  lines.push(`│ Location: ${violation.sourceFile}:${violation.loc.start.line}:${violation.loc.start.column}`.slice(0, cardWidth - 2).padEnd(cardWidth - 1) + `│`);
  lines.push(`├` + "─".repeat(cardWidth - 2) + `┤`);

  // Explanation
  lines.push(`│ ⚠️  Violation:` + " ".repeat(cardWidth - 15) + `│`);
  const msgWords = violation.message.split(" ");
  let currentLine = "│    ";
  for (const word of msgWords) {
    if (currentLine.length + word.length + 1 >= cardWidth - 2) {
      lines.push(currentLine.padEnd(cardWidth - 1) + "│");
      currentLine = "│    " + word;
    } else {
      currentLine += (currentLine === "│    " ? "" : " ") + word;
    }
  }
  if (currentLine.length > 5) {
    lines.push(currentLine.padEnd(cardWidth - 1) + "│");
  }

  // Formal Graph Invariant
  lines.push(`│` + " ".repeat(cardWidth - 2) + `│`);
  lines.push(`│ 📐 Formal CFG Invariant:` + " ".repeat(cardWidth - 26) + `│`);
  lines.push(`│    ${violation.formalInvariant}`.slice(0, cardWidth - 2).padEnd(cardWidth - 1) + `│`);

  // Execution Trace
  lines.push(`│` + " ".repeat(cardWidth - 2) + `│`);
  lines.push(`│ 🔍 Control-Flow Execution Trace:` + " ".repeat(cardWidth - 34) + `│`);
  for (const step of violation.executionTrace) {
    const isViolating = step.includes(violation.violatingNodeLabel);
    const marker = isViolating ? " 💥 [VULNERABLE GAP] " : "    ";
    lines.push(`│ ${marker}${step}`.slice(0, cardWidth - 2).padEnd(cardWidth - 1) + `│`);
  }

  // Remediation
  lines.push(`│` + " ".repeat(cardWidth - 2) + `│`);
  lines.push(`│ 💡 Recommended Remediation:` + " ".repeat(cardWidth - 29) + `│`);
  const fixWords = violation.remediation.split(" ");
  let fixLine = "│    ";
  for (const word of fixWords) {
    if (fixLine.length + word.length + 1 >= cardWidth - 2) {
      lines.push(fixLine.padEnd(cardWidth - 1) + "│");
      fixLine = "│    " + word;
    } else {
      fixLine += (fixLine === "│    " ? "" : " ") + word;
    }
  }
  if (fixLine.length > 5) {
    lines.push(fixLine.padEnd(cardWidth - 1) + "│");
  }

  lines.push(`╰` + "─".repeat(cardWidth - 2) + `╯`);
  return lines.join("\n");
}

/**
 * Renders the complete, formal static security audit report for terminal output.
 */
export function formatSecurityReport(report: SecurityAnalysisReport): string {
  const lines: string[] = [];

  lines.push(`┌────────────────────────────────────────────────────────────────────────┐`);
  lines.push(`│ 🛡️  EXPRESSFLOW STATIC SECURITY AUDIT & INVARIANT REPORT                │`);
  lines.push(`│ Verification Engine: Ahead-of-Time Graph Dominator Reachability        │`);
  lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
  lines.push("");

  // Analysis Completion Status Banner
  if (report.status === "INCOMPLETE") {
    lines.push(`╭────────────────────────────────────────────────────────────────────────╮`);
    lines.push(`│ ⚠️  ANALYSIS STATUS: INCOMPLETE                                         │`);
    lines.push(`╰────────────────────────────────────────────────────────────────────────╯`);
    lines.push(`  ${report.statusMessage || "One or more files failed during parsing."}`);
    lines.push(`  Results represent partial analysis and do NOT constitute a clean audit.`);

    if (report.diagnostics?.errors && report.diagnostics.errors.length > 0) {
      lines.push(`\n  Failed Files:`);
      for (const err of report.diagnostics.errors) {
        const locStr = err.loc ? `:${err.loc.start.line}:${err.loc.start.column}` : "";
        lines.push(`    ✖ ${err.filePath}${locStr} - ${err.error.split("\n")[0]}`);
      }
    }
    lines.push("");
  } else if (report.status === "INCONCLUSIVE") {
    lines.push(`╭────────────────────────────────────────────────────────────────────────╮`);
    lines.push(`│ ⚠️  ANALYSIS STATUS: INCONCLUSIVE                                       │`);
    lines.push(`╰────────────────────────────────────────────────────────────────────────╯`);
    lines.push(`  ${report.statusMessage || "Zero route Control-Flow Graphs were synthesized."}`);
    lines.push(`  Route security invariants could not be evaluated.`);
    lines.push("");
  }

  // Summary Metrics Table
  lines.push(`╭────────────────────────────────────────────────────────────────────────╮`);
  lines.push(`│ 📊 SECURITY AUDIT SUMMARY METRICS                                      │`);
  lines.push(`╰────────────────────────────────────────────────────────────────────────╯`);
  lines.push(`  Analysis Status:            ${report.status}`);
  lines.push(`  Total Routes Analyzed:      ${report.totalRoutes}`);
  lines.push(`  No-Rule-Triggered Routes:  ${report.cleanRoutes} (${report.totalRoutes > 0 ? Math.round((report.cleanRoutes / report.totalRoutes) * 100) : 0}%)`);
  lines.push(`  Vulnerable Routes Detected: ${report.vulnerableRoutes}`);
  lines.push(`  Severity Breakdown:         [CRITICAL: ${report.criticalCount}] [HIGH: ${report.highCount}] [MEDIUM: ${report.mediumCount}] [LOW: ${report.lowCount}]`);
  lines.push("");

  if (report.status === "INCOMPLETE") {
    if (report.violations.length === 0) {
      lines.push(`================================================================================`);
      lines.push(`⚠️  ANALYSIS INCOMPLETE: 0 VIOLATIONS IN PARSED FILES, BUT SOURCE ERRORS OCCURRED`);
      lines.push(`================================================================================\n`);
      return lines.join("\n");
    } else {
      lines.push(`================================================================================`);
      lines.push(`🚨 PARTIAL AUDIT FOUND ${report.violations.length} ISSUE(S) IN SUCCESSFULLY PARSED FILES:`);
      lines.push(`================================================================================\n`);
      for (let i = 0; i < report.violations.length; i++) {
        lines.push(formatViolationCard(report.violations[i], i, report.violations.length));
        lines.push("");
      }
      return lines.join("\n");
    }
  }

  if (report.status === "INCONCLUSIVE") {
    lines.push(`================================================================================`);
    lines.push(`⚠️  AUDIT INCONCLUSIVE: NO ROUTES EVALUATED. CHECK PROJECT ROUTE CONFIGURATION.`);
    lines.push(`================================================================================\n`);
    return lines.join("\n");
  }

  if (report.passed) {
    lines.push(`================================================================================`);
    lines.push(`🎉 NO CONFIGURED RULE TRIGGERED (heuristic result, not a proof of security).`);
    lines.push(`================================================================================\n`);
    return lines.join("\n");
  }

  lines.push(`================================================================================`);
  lines.push(`🚨 SECURITY INVARIANTS VIOLATED! ${report.violations.length} ISSUE(S) REQUIRE REMEDIATION:`);
  lines.push(`================================================================================\n`);

  for (let i = 0; i < report.violations.length; i++) {
    lines.push(formatViolationCard(report.violations[i], i, report.violations.length));
    lines.push("");
  }

  return lines.join("\n");
}

