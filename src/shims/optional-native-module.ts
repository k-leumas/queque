/**
 * Stand-in for ws's optional native add-ons (`bufferutil`, `utf-8-validate`) in the bundled CLI
 * (quick 261011-jbh, LD-2).
 *
 * ws requires them inside try/catch and falls back to its pure-JS code when they are missing.
 * They are not installed here, so esbuild would leave them as runtime `require` calls that
 * search node_modules next to (and above) the installed bundle. Aliasing them to this module
 * keeps ws's "not installed" behaviour exactly — loading it throws, ws catches — while the
 * bundle resolves nothing from node_modules at runtime. (ws is only reached from ink's
 * DEV-only devtools path.)
 */
export {};

throw new Error('optional native module is not bundled with queque');
