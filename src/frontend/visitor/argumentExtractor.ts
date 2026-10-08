import * as t from "@babel/types";
import {
  MiddlewareMetadata,
  MiddlewareType,
  RoutePath,
  SourceLocation,
} from "../../shared/types/manifest";

export function toSourceLocation(loc: t.SourceLocation | null | undefined): SourceLocation {
  if (!loc) {
    return {
      start: { line: 0, column: 0 },
      end: { line: 0, column: 0 },
    };
  }
  return {
    start: { line: loc.start.line, column: loc.start.column },
    end: { line: loc.end.line, column: loc.end.column },
  };
}

/**
 * Checks if a given AST node represents a route path (e.g. string literal, regex, or template).
 */
export function isPathNode(node: t.Node): boolean {
  return (
    t.isStringLiteral(node) ||
    t.isTemplateLiteral(node) ||
    t.isRegExpLiteral(node)
  );
}

/**
 * Extracts normalized route path metadata from an AST node.
 */
export function extractRoutePath(node: t.Node | undefined): RoutePath {
  if (!node) {
    return {
      type: "STATIC",
      value: "/",
      raw: "'/'",
      loc: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
    };
  }

  if (t.isStringLiteral(node)) {
    return {
      type: "STATIC",
      value: node.value,
      raw: `'${node.value}'`,
      loc: toSourceLocation(node.loc),
    };
  }

  if (t.isTemplateLiteral(node)) {
    // Reconstruct template literal representation
    const quasis = node.quasis.map((q) => q.value.raw).join("${...}");
    return {
      type: "TEMPLATE",
      value: quasis,
      raw: `\`${quasis}\``,
      loc: toSourceLocation(node.loc),
    };
  }

  if (t.isRegExpLiteral(node)) {
    return {
      type: "DYNAMIC",
      value: `/${node.pattern}/${node.flags}`,
      raw: `/${node.pattern}/${node.flags}`,
      loc: toSourceLocation(node.loc),
    };
  }

  return {
    type: "DYNAMIC",
    value: "<dynamic_path>",
    raw: "<dynamic>",
    loc: toSourceLocation(node.loc),
  };
}

/**
 * Recursively flattens ArrayExpression nodes into a linear list of AST nodes.
 * Express natively supports: app.get('/route', [m1, [m2, m3]], m4)
 */
export function flattenMiddlewareNodes(nodes: t.Node[]): t.Node[] {
  const result: t.Node[] = [];

  for (const node of nodes) {
    if (t.isArrayExpression(node)) {
      const innerNodes: t.Node[] = [];
      for (const element of node.elements) {
        if (element && !t.isSpreadElement(element)) {
          innerNodes.push(element);
        }
      }
      result.push(...flattenMiddlewareNodes(innerNodes));
    } else {
      result.push(node);
    }
  }

  return result;
}

/**
 * Extracts parameter names from an inline function (e.g. req, res, next).
 */
function extractFunctionParams(node: t.Function): string[] {
  return node.params.map((param) => {
    if (t.isIdentifier(param)) return param.name;
    if (t.isAssignmentPattern(param) && t.isIdentifier(param.left)) return param.left.name;
    return "<destructured>";
  });
}

/**
 * Converts a raw AST middleware node into a structured MiddlewareMetadata object.
 */
export function extractMiddlewareMetadata(
  node: t.Node,
  executionOrder: number
): MiddlewareMetadata {
  const loc = toSourceLocation(node.loc);

  // 1. Named Identifier: e.g. authenticate
  if (t.isIdentifier(node)) {
    return {
      executionOrder,
      type: "IDENTIFIER",
      name: node.name,
      rawExpression: node.name,
      isInline: false,
      loc,
    };
  }

  // 2. Member Expression: e.g. auth.verifyToken or authController.login
  if (t.isMemberExpression(node)) {
    const objectName = t.isIdentifier(node.object) ? node.object.name : "<expr>";
    const propName = t.isIdentifier(node.property) ? node.property.name : "<prop>";
    const rawExpression = `${objectName}.${propName}`;
    return {
      executionOrder,
      type: "MEMBER_EXPRESSION",
      name: propName,
      rawExpression,
      isInline: false,
      loc,
    };
  }

  // 3. Factory Call: e.g. passport.authenticate('jwt') or rateLimit({ max: 100 })
  if (t.isCallExpression(node)) {
    let name: string = "<factory_call>";
    if (t.isIdentifier(node.callee)) {
      name = node.callee.name;
    } else if (t.isMemberExpression(node.callee)) {
      const obj = t.isIdentifier(node.callee.object) ? node.callee.object.name : "";
      const prop = t.isIdentifier(node.callee.property) ? node.callee.property.name : "";
      name = obj ? `${obj}.${prop}` : prop;
    }

    return {
      executionOrder,
      type: "FACTORY_CALL",
      name,
      rawExpression: `${name}(...)`,
      isInline: false,
      loc,
    };
  }

  // 4. Inline Function Expression: (req, res, next) => { ... }
  if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) {
    const funcName = t.isFunctionExpression(node) && node.id ? node.id.name : null;
    return {
      executionOrder,
      type: "INLINE_FUNCTION",
      name: funcName,
      rawExpression: "inline_callback",
      isInline: true,
      params: extractFunctionParams(node),
      loc,
    };
  }

  // Fallback for other expression types
  return {
    executionOrder,
    type: "IDENTIFIER",
    name: "<unknown>",
    rawExpression: "<unknown_expression>",
    isInline: false,
    loc,
  };
}
