import { parse, ParserOptions } from "@babel/parser";
import { File as BabelFile } from "@babel/types";

export interface ParseOptions {
  sourceType?: "module" | "script" | "unambiguous";
  allowReturnOutsideFunction?: boolean;
}

/**
 * Parses raw JavaScript or TypeScript source code into an AST with exact node coordinates.
 */
export function parseSourceCode(
  sourceCode: string,
  options: ParseOptions = {}
): BabelFile {
  const parserOptions: ParserOptions = {
    sourceType: options.sourceType || "unambiguous",
    allowReturnOutsideFunction: options.allowReturnOutsideFunction ?? true,
    tokens: false,
    plugins: [
      "typescript",
      "jsx",
      "asyncGenerators",
      "dynamicImport",
      "exportDefaultFrom",
      "exportNamespaceFrom",
      "nullishCoalescingOperator",
      "optionalChaining",
      "classProperties",
    ],
  };

  return parse(sourceCode, parserOptions);
}
