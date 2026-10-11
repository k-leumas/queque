/**
 * No-op stand-in for `react-devtools-core` in the bundled CLI (quick 261011-jbh, LD-2).
 *
 * ink's devtools.js imports it statically, and esbuild hoists that import into the bundle,
 * so the alias target must exist even though ink only loads devtools when DEV=true and the
 * real package resolves (it is not a dependency here). Leaving it external crashed the
 * bundle at startup with ERR_MODULE_NOT_FOUND. The members are the two devtools.js calls.
 */
const devtools = {
  initialize(): void {},
  connectToDevTools(): void {},
};

export default devtools;
