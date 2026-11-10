// Usage: node --import ./scripts/test-support/register-alias.mjs ...
import { register } from "node:module";

register("./alias-loader.mjs", import.meta.url);
