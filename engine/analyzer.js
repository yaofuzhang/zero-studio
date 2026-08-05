/**
 * Zero Studio 分析引擎 — 纯函数，可在 Node.js 主进程运行
 */

const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const fs = require('fs');
const path = require('path');

const TODO_RE = /(?:\/\/|#|\/\*|\*)\s*(TODO|FIXME|HACK|XXX|BUG|OPTIMIZE|REVIEW)\b/gi;
const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.jsx', '.mjs', '.cjs']);

function countLines(text) {
  const lines = text.split('\n');
  let code = 0, comment = 0, blank = 0, inBlock = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { blank++; continue; }
    if (!inBlock && line.startsWith('/*')) { inBlock = true; comment++; if (line.includes('*/')) inBlock = false; continue; }
    if (inBlock) { comment++; if (line.includes('*/')) inBlock = false; continue; }
    if (line.startsWith('//') || line.startsWith('#')) { comment++; continue; }
    code++;
  }
  return { total: lines.length, code, comment, blank };
}

function calcComplexity(code) {
  let total = 0, count = 0;
  const perFunction = [];
  try {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties'],
      errorRecovery: true,
    });
    traverse(ast, {
      FunctionDeclaration(p) {
        const n = p.node;
        const name = n.id?.name || '<fn>';
        const ccn = countCCN(p);
        total += ccn; count++;
        perFunction.push({ name, complexity: ccn, line: n.loc?.start.line || 0 });
      },
      ArrowFunctionExpression(p) {
        const parent = p.parent;
        if (!parent.id?.name) return;
        const ccn = countCCN(p);
        total += ccn; count++;
        perFunction.push({ name: parent.id.name, complexity: ccn, line: p.node.loc?.start.line || 0 });
      },
      ObjectMethod(p) {
        const n = p.node;
        const ccn = countCCN(p);
        total += ccn; count++;
        perFunction.push({ name: n.key?.name || '<method>', complexity: ccn, line: n.loc?.start.line || 0 });
      },
      ClassMethod(p) {
        const n = p.node;
        const ccn = countCCN(p);
        total += ccn; count++;
        perFunction.push({ name: n.key?.name || '<method>', complexity: ccn, line: n.loc?.start.line || 0 });
      },
    });
  } catch { return { total: 0, average: 0, count: 0, perFunction: [] }; }
  return { total, average: count > 0 ? +(total / count).toFixed(1) : 0, count, perFunction };
}

function countCCN(p) {
  let n = 1;
  p.traverse({
    IfStatement() { n++; }, ForStatement() { n++; }, ForInStatement() { n++; }, ForOfStatement() { n++; },
    WhileStatement() { n++; }, DoWhileStatement() { n++; },
    SwitchCase(q) { if (q.node.test) n++; },
    ConditionalExpression() { n++; },
    LogicalExpression(q) { if (['&&', '||'].includes(q.node.operator)) n++; },
    CatchClause() { n++; },
  });
  return n;
}

function countTodos(code) {
  let n = 0;
  for (const line of code.split('\n')) {
    const r = new RegExp(TODO_RE.source, 'gi');
    if (r.test(line)) n++;
  }
  return n;
}

function calcScore(lines, avgCC, todos, opts = {}) {
  const ml = opts.maxLines || 800, mc = opts.maxComplexity || 15, md = opts.maxTodoDensity || 5;
  const lp = Math.max(0, (lines - ml) * 0.1);
  const cp = Math.max(0, (avgCC - mc) * 5);
  const td = lines > 0 ? (todos / lines) * 1000 : 0;
  const tp = Math.max(0, (td - md) * 2);
  const score = Math.max(0, Math.round(100 - lp - cp - tp));
  let level = score < 40 ? 'red' : score < 70 ? 'yellow' : 'green';
  return { score, level };
}

function walkFiles(root, exclude = ['node_modules', '.git', 'dist', 'build', 'out']) {
  const results = [];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') || exclude.includes(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && CODE_EXTS.has(path.extname(e.name))) results.push(full);
    }
  }
  walk(root);
  return results;
}

function analyzeFile(filePath, opts) {
  const name = path.basename(filePath);
  const rel = filePath;
  try {
    const code = fs.readFileSync(filePath, 'utf-8');
    const lines = countLines(code);
    const cc = calcComplexity(code);
    const todos = countTodos(code);
    const health = calcScore(lines.total, cc.average, todos, opts);
    return { name, path: rel, lines, complexity: cc, todos, health };
  } catch {
    return { name, path: rel, lines: { total: 0, code: 0, comment: 0, blank: 0 }, complexity: { total: 0, average: 0, count: 0, perFunction: [] }, todos: 0, health: { score: 0, level: 'red' } };
  }
}

function analyzeFolder(root, opts) {
  const files = walkFiles(root);
  const results = files.map(f => analyzeFile(f, opts)).sort((a, b) => a.health.score - b.health.score);
  const reds = results.filter(r => r.health.level === 'red').length;
  const yellows = results.filter(r => r.health.level === 'yellow').length;
  const greens = results.filter(r => r.health.level === 'green').length;
  const avgScore = results.length ? Math.round(results.reduce((s, r) => s + r.health.score, 0) / results.length) : 100;
  const totalTodos = results.reduce((s, r) => s + r.todos, 0);
  const totalLines = results.reduce((s, r) => s + r.lines.code, 0);

  return {
    root,
    files: results,
    summary: { total: results.length, reds, yellows, greens, avgScore, totalTodos, totalLines },
    timestamp: Date.now(),
  };
}

module.exports = { analyzeFolder, analyzeFile, walkFiles };
