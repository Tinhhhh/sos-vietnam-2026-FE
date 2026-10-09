#!/usr/bin/env node
/**
 * Legacy CSS extractor — ports rules from sos-vietnam-2026/public/css into
 * per-component CSS Modules (and one shared global sheet) without changing
 * the cascade order, so the React UI keeps the legacy look.
 *
 * Usage:
 *   node tools/legacy-css/extract.mjs tools/legacy-css/legacy-css.config.mjs
 *
 * LEGACY_REPO overrides config.legacyRoot.
 *
 * How a selector is routed (one comma-separated selector at a time):
 *   - no class / id            -> the global output that has `includeElementRules`
 *   - only global/context cls  -> the global output
 *   - has a class owned by a module output, and every other class is owned by
 *     that output, global, or context -> that module output. Non-owned classes
 *     are wrapped in :global(...), owned ids are rewritten to owned classes.
 *   - anything else (dispatcher-only classes, unknown ids) is dropped and
 *     reported when it touches an owned class, so the config can be fixed.
 * @keyframes referenced by a kept rule are copied into the same file, because
 * CSS Modules localise animation names per file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

const configArg = process.argv[2];
if (!configArg) {
  console.error('Usage: node tools/legacy-css/extract.mjs <config.mjs>');
  process.exit(1);
}

const projectRoot = process.cwd();
const config = (await import(pathToFileURL(path.resolve(configArg)).href)).default;
const legacyRoot = process.env.LEGACY_REPO || config.legacyRoot;

const contextClasses = new Set(config.contextClasses || []);
const globalOutput = config.outputs.find((o) => o.mode === 'global');
const moduleOutputs = config.outputs.filter((o) => o.mode === 'module');
const globalClasses = new Set(globalOutput?.classes || []);

for (const out of config.outputs) {
  // `states` are owned (localised) but never anchor a selector on their own,
  // e.g. `.active` must not pull `.queue-card.active` into the orb module.
  out.anchorSet = new Set(out.classes || []);
  out.classSet = new Set([...(out.classes || []), ...(out.states || [])]);
  out.idMap = out.ids || {};
  out.rules = [];
  out.keyframeNames = new Set();
}

const report = { dropped: [], ambiguous: [] };

// ---------------------------------------------------------------- parse
const sources = config.sources.map((rel) => {
  const file = path.join(legacyRoot, rel);
  const css = fs.readFileSync(file, 'utf8');
  return { rel, root: postcss.parse(css, { from: file }) };
});

// Last definition wins, same as the browser.
const keyframes = new Map();
for (const { root } of sources) {
  root.walkAtRules(/keyframes$/i, (at) => {
    keyframes.set(at.params.trim(), at);
  });
}

// ------------------------------------------------------------- analysis
function collect(selectorAst) {
  const classes = [];
  const ids = [];
  selectorAst.walk((node) => {
    if (node.type === 'class') classes.push(node.value);
    if (node.type === 'id') ids.push(node.value);
  });
  return { classes, ids };
}

function routeSelector(sel) {
  const ast = selectorParser().astSync(sel);
  const { classes, ids } = collect(ast);

  if (classes.length === 0 && ids.length === 0) {
    return globalOutput?.includeElementRules ? { out: globalOutput, sel } : null;
  }

  const allGlobalish = classes.every((c) => globalClasses.has(c) || contextClasses.has(c));
  const globalIdsOk = ids.every((id) => (globalOutput?.globalIds || []).includes(id));
  if (globalOutput && allGlobalish && globalIdsOk) {
    return { out: globalOutput, sel };
  }

  const candidates = moduleOutputs.filter((out) => {
    const anchors = classes.some((c) => out.anchorSet.has(c)) || ids.some((id) => id in out.idMap);
    if (!anchors) return false;
    const classesOk = classes.every(
      (c) => out.classSet.has(c) || globalClasses.has(c) || contextClasses.has(c),
    );
    const idsOk = ids.every((id) => id in out.idMap);
    return classesOk && idsOk;
  });

  if (candidates.length === 1) {
    return { out: candidates[0], sel: localiseSelector(sel, candidates[0]) };
  }

  const touchesOwned = moduleOutputs.some(
    (out) => classes.some((c) => out.anchorSet.has(c)) || ids.some((id) => id in out.idMap),
  );
  if (candidates.length > 1) {
    report.ambiguous.push({ sel, outputs: candidates.map((c) => c.file) });
  } else if (touchesOwned) {
    const unknown = classes.filter(
      (c) => !globalClasses.has(c) && !contextClasses.has(c) && !moduleOutputs.some((o) => o.classSet.has(c)),
    );
    const owners = [
      ...new Set(
        classes.flatMap((c) =>
          moduleOutputs.filter((o) => o.anchorSet.has(c)).map((o) => path.basename(o.file)),
        ),
      ),
    ];
    report.dropped.push({ sel, unknown, ids, owners });
  }
  return null;
}

function localiseSelector(sel, out) {
  return selectorParser((root) => {
    root.walk((node) => {
      if (node.type === 'id' && node.value in out.idMap) {
        node.replaceWith(selectorParser.className({ value: out.idMap[node.value] }));
        return;
      }
      if (node.type === 'class' && !out.classSet.has(node.value)) {
        const wrapper = selectorParser.pseudo({ value: ':global' });
        wrapper.append(selectorParser.selector({ nodes: [selectorParser.className({ value: node.value })] }));
        node.replaceWith(wrapper);
      }
    });
  }).processSync(sel);
}

function ancestorsOf(node) {
  const chain = [];
  let p = node.parent;
  while (p && p.type !== 'root') {
    chain.unshift(p);
    p = p.parent;
  }
  return chain;
}

function animationNames(decl) {
  if (!/^(-webkit-)?animation(-name)?$/i.test(decl.prop)) return [];
  return decl.value
    .split(',')
    .flatMap((part) => part.trim().split(/\s+/))
    .filter((token) => keyframes.has(token));
}

// --------------------------------------------------------------- routing
for (const { rel, root } of sources) {
  root.walkAtRules((at) => {
    if (!globalOutput) return;
    if (at.name === 'font-face' && globalOutput.includeFontFace) {
      globalOutput.rules.push({ node: at, chain: [], rel, line: at.source.start.line, selectors: null });
    }
  });

  root.walkRules((rule) => {
    const chain = ancestorsOf(rule);
    if (chain.some((a) => a.type === 'atrule' && /keyframes$/i.test(a.name))) return;

    const routed = new Map();
    for (const sel of rule.selectors) {
      const hit = routeSelector(sel.trim());
      if (!hit) continue;
      if (!routed.has(hit.out)) routed.set(hit.out, []);
      routed.get(hit.out).push(hit.sel);
    }

    for (const [out, selectors] of routed) {
      out.rules.push({ node: rule, chain, rel, line: rule.source.start.line, selectors });
      rule.walkDecls((decl) => animationNames(decl).forEach((n) => out.keyframeNames.add(n)));
    }
  });
}

// ---------------------------------------------------------------- output
function emit(out) {
  const result = postcss.root();
  let lastChain = null;
  let lastContainer = result;
  let lastRef = null;

  for (const item of out.rules) {
    const sameChain =
      lastChain && lastChain.length === item.chain.length && lastChain.every((a, i) => a === item.chain[i]);

    if (!sameChain) {
      let container = result;
      for (const at of item.chain) {
        const clone = at.clone({ nodes: [] });
        container.append(clone);
        container = clone;
      }
      lastContainer = container;
      lastChain = item.chain;
    }

    const ref = `${item.rel}:${item.line}`;
    const isJump = !lastRef || lastRef.rel !== item.rel || item.line - lastRef.line > 40 || !sameChain;
    if (isJump) lastContainer.append(postcss.comment({ text: ` legacy ${ref} ` }));
    lastRef = { rel: item.rel, line: item.line };

    const clone = item.node.clone();
    if (item.selectors) clone.selectors = item.selectors;
    lastContainer.append(clone);
  }

  for (const name of out.keyframeNames) {
    const kf = keyframes.get(name);
    if (kf) result.append(kf.clone());
  }

  result.walk((node) => {
    node.raws.before = node.type === 'decl' ? '\n  ' : '\n';
  });

  const header =
    `/*\n * AUTO-GENERATED by tools/legacy-css/extract.mjs from sos-vietnam-2026 legacy CSS.\n` +
    ` * Change the config and re-run instead of editing by hand; delete this header\n` +
    ` * once the file is taken over and edited manually.\n */\n`;
  const target = path.join(projectRoot, out.file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, header + result.toString().trim() + '\n');
  return { file: out.file, rules: out.rules.length, keyframes: out.keyframeNames.size };
}

const summary = config.outputs.map(emit);
console.table(summary);

if (report.ambiguous.length) {
  console.log(`\nAmbiguous selectors (${report.ambiguous.length}) — skipped:`);
  for (const a of report.ambiguous) console.log(`  ${a.sel}\n      -> ${a.outputs.join(', ')}`);
}
if (report.dropped.length) {
  console.log(`\nDropped selectors touching owned classes (${report.dropped.length}):`);
  for (const d of report.dropped) {
    console.log(
      `  ${d.sel}\n      owners=[${d.owners.join(', ')}] unknown=[${d.unknown.join(', ')}]${d.ids.length ? ` ids=[${d.ids.join(', ')}]` : ''}`,
    );
  }
}
