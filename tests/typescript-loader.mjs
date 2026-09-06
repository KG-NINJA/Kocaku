import { existsSync, readFileSync } from 'node:fs';
import ts from 'typescript';

export function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL) {
      const candidate = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(candidate)) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
}
export function load(url, context, nextLoad) {
    if (!url.endsWith('.ts')) return nextLoad(url, context);
    const source = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
    }).outputText;
    return { format: 'module', source, shortCircuit: true };
}
