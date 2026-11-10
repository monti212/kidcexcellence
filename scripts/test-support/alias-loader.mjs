// Node module resolver for tests: maps the "@/..." path alias and
// extensionless TypeScript imports to files, so lib/*.ts (including
// lib/platform-store.ts) can be loaded directly with Node's type stripping.
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = process.cwd();
const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts"];

function existingFile(candidate) {
  for (const extension of EXTENSIONS) {
    const file = candidate + extension;
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  let candidate = null;
  if (specifier.startsWith("@/")) {
    candidate = path.join(root, specifier.slice(2));
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file:") &&
    !path.extname(specifier)
  ) {
    candidate = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  const file = candidate && existingFile(candidate);
  if (file) return nextResolve(pathToFileURL(file).href, context);
  return nextResolve(specifier, context);
}
