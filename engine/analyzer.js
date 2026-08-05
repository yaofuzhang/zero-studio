/**
 * zero-code-analyzer — Zero Labs 代码分析引擎
 *
 * 纯函数，零副作用。可在 Node.js、浏览器、CI 中使用。
 */

const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

// ─── Line Counter ──────────────────────────────────

function countLines(text) {
  const lines = text.split('\n');
  let code = 0, comment = 0, blank = 0;
  let inBlock = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) { blank++; continue; }
    if (!inBlock && line.startsWith('/*')) { inBlock = true; comment++; if (line.includes('*/')) inBlock = false; continue; }
    if (inBlock) { comment++; if (line.includes('*/')) inBlock = false; continue; }
    if (line.startsWith('//') || line.startsWith('#')) { comment++; continue; }
    code++;
  }

  return { total: lines.length, code, comment, blank };
}

// ─── Complexity ────────────────────────────────────

function calculateComplexity(code) {
  let total = 0, count = 0;
  const perFunction = [];

  try {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties'],
      errorRecovery: true,
    });

    traverse(ast, {
      FunctionDeclaration(path) {
        const node = path.node;
        const name = node.id?.name || '<fn>';
        const ccn = countCCN(path);
        total += ccn; count++;
        perFunction.push({ name, complexity: ccn, line: node.loc?.start.line || 0 });
      },
      ArrowFunctionExpression(path) {
        const parent = path.parent;
        if (!parent.id?.name) return;
        const name = parent.id.name;
        const ccn = countCCN(path);
        total += ccn; count++;
        perFunction.push({ name, complexity: ccn, line: path.node.loc?.start.line || 0 });
      },
      ObjectMethod(path) {
        const node = path.node;
        const name = node.key?.name || '<method>';
        const ccn = countCCN(path);
        total += ccn; count++;
        perFunction.push({ name, complexity: ccn, line: node.loc?.start.line || 0 });
      },
      ClassMethod(path) {
        const node = path.node;
        const name = node.key?.name || '<method>';
        const ccn = countCCN(path);
        total += ccn; count++;
        perFunction.push({ name, complexity: ccn, line: node.loc?.start.line || 0 });
      },
    });
  } catch {
    return { total: 0, average: 0, count: 0, perFunction: [] };
  }

  return {
    total,
    average: count > 0 ? Math.round((total / count) * 10) / 10 : 0,
    count,
    perFunction,
  };
}

function countCCN(path) {
  let n = 1;
  path.traverse({
    IfStatement() { n++; },
    ForStatement() { n++; },
    ForInStatement() { n++; },
    ForOfStatement() { n++; },
    WhileStatement() { n++; },
    DoWhileStatement() { n++; },
    SwitchCase(p) { if (p.node.test) n++; },
    ConditionalExpression() { n++; },
    LogicalExpression(p) { if (['&&','||'].includes(p.node.operator)) n++; },
    CatchClause() { n++; },
  });
  return n;
}

// ─── TODO Scanner ──────────────────────────────────

function scanTodos(code, keywords) {
  if (!keywords) keywords = ['TODO', 'FIXME', 'HACK', 'XXX', 'BUG', 'OPTIMIZE', 'REVIEW'];
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(?:\\/\\/|#|\\/\\*|\\*)\\s*(${escaped.join('|')})\\b`, 'gi');
  const items = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const r = new RegExp(regex.source, 'gi');
    let m;
    while ((m = r.exec(lines[i])) !== null) {
      items.push({ keyword: m[1].toUpperCase(), line: i + 1, text: lines[i].trim() });
    }
  }

  return items;
}

// ─── Health Score ──────────────────────────────────

function calculateHealthScore(lineCount, avgComplexity, todoCount, opts) {
  const maxLines = opts?.maxLines ?? 800;
  const maxCC = opts?.maxComplexity ?? 15;
  const maxTodoDensity = opts?.maxTodoDensity ?? 5;

  const linePenalty = Math.max(0, (lineCount - maxLines) * 0.1);
  const ccPenalty = Math.max(0, (avgComplexity - maxCC) * 5);
  const todoDensity = lineCount > 0 ? (todoCount / lineCount) * 1000 : 0;
  const todoPenalty = Math.max(0, (todoDensity - maxTodoDensity) * 2);

  const score = Math.max(0, Math.round(100 - linePenalty - ccPenalty - todoPenalty));

  let level;
  if (score < 40) level = 'red';
  else if (score < 70) level = 'yellow';
  else level = 'green';

  return { score, level, linePenalty, complexityPenalty: ccPenalty, todoPenalty };
}

/**
 * 一键分析：输入代码字符串，返回完整报告。
 */
function analyze(code, opts) {
  const lines = countLines(code);
  const complexity = calculateComplexity(code);
  const todos = scanTodos(code);
  const health = calculateHealthScore(lines.total, complexity.average, todos.length, opts);

  return { lines, complexity, todos, todoCount: todos.length, health };
}

module.exports = { countLines, calculateComplexity, scanTodos, calculateHealthScore, analyze };
