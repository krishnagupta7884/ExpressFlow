import {
  AnalysisDiagnostics,
  AnalysisStatus,
  HttpMethod,
  SourceLocation,
} from "../../shared/types/manifest";

export type VulnerabilitySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type InvariantRuleId =
  | "RULE_1_AUTH_BEFORE_SENSITIVE"
  | "RULE_2_MISORDERED_SECURITY_GUARD"
  | "RULE_3_UNPROTECTED_ADMIN_MOUNT"
  | "RULE_4_MISSING_RATE_LIMIT";

export interface SecurityViolation {
  id: string;
  ruleId: InvariantRuleId;
  ruleName: string;
  severity: VulnerabilitySeverity;
  routeId: string;              // e.g. "DELETE /api/admin/database"
  method: HttpMethod;
  fullPath: string;
  sourceFile: string;
  loc: SourceLocation;
  violatingNodeLabel: string;
  message: string;
  formalInvariant: string;      // Compiler theory graph condition (e.g. "Auth dom Handler")
  remediation: string;
  executionTrace: string[];     // Formatted CFG trace: ENTRY -> mw1 -> HANDLER
}

export interface SecurityAnalysisReport {
  status: AnalysisStatus;
  statusMessage?: string;
  diagnostics?: AnalysisDiagnostics;
  analyzedAt: string;
  totalRoutes: number;
  cleanRoutes: number;
  vulnerableRoutes: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  violations: SecurityViolation[];
  passed: boolean;
}

