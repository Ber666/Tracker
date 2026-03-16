import { getEntry, setEntryDeferred, flushEntries, getAppConfig } from '../storage.js';
import { today, genId, ok, fail } from '../utils.js';

// ── helpers (mirrors task.js / log.js) ──────────────────────────────────────

function resolveTagIds(tagIds, cfg) {
  if (!tagIds) return [];
  const tags = cfg.tags || [];
  const ids = Array.isArray(tagIds) ? tagIds : tagIds.split(',').map(s => s.trim()).filter(Boolean);
  return ids.map(id => {
    if (!tags.find(t => t.id === id)) throw new Error(`Tag ID not found: "${id}"`);
    return id;
  });
}

function resolveProjectIds(projectId, cfg) {
  if (!projectId) return [];
  if (!(cfg.projects || []).find(p => p.id === projectId))
    throw new Error(`Project ID not found: "${projectId}"`);
  return [projectId];
}

// ── apply a single operation to an in-memory entry ──────────────────────────

function applyOp(op, entry, cfg) {
  const cmd = op.cmd;

  if (cmd === 'log') {
    if (!op.text) throw new Error('"text" is required for cmd:log');
    if (!entry.log) entry.log = [];
    const item = {
      id: genId(),
      text: op.text,
      startTime: op.time || null,
      duration: op.duration || null,
      notes: op.notes || '',
      tagIds: resolveTagIds(op.tags, cfg),
      projectIds: resolveProjectIds(op.project, cfg),
      plannedIds: op.plannedIds || [],
      createdAt: new Date().toISOString(),
    };
    entry.log.push(item);
    return item;
  }

  if (cmd === 'task') {
    if (!op.text) throw new Error('"text" is required for cmd:task');
    if (!entry.planned) entry.planned = [];
    const task = {
      id: genId(),
      text: op.text,
      scheduledTime: op.time || null,
      duration: op.duration || null,
      status: op.status || 'not-started',
      notes: op.notes || '',
      tagIds: resolveTagIds(op.tags, cfg),
      projectIds: resolveProjectIds(op.project, cfg),
      createdAt: new Date().toISOString(),
    };
    entry.planned.push(task);
    return task;
  }

  if (cmd === 'sleep') {
    if (op.bed)  entry.sleep = { ...(entry.sleep || {}), bedTime:  op.bed  };
    if (op.wake) entry.sleep = { ...(entry.sleep || {}), wakeTime: op.wake };
    if (op.nap) {
      if (!entry.vitals) entry.vitals = {};
      if (!entry.vitals.naps) entry.vitals.naps = [];
      const nap = { id: genId(), time: op.nap.time, duration: op.nap.duration, content: op.nap.duration };
      entry.vitals.naps.push(nap);
    }
    return { sleep: entry.sleep, nap: op.nap ? entry.vitals.naps.at(-1) : undefined };
  }

  if (cmd === 'checkin') {
    if (op.morning !== undefined) entry.morningMessage = op.morning;
    if (op.night   !== undefined) entry.nightMessage   = op.night;
    return { morningMessage: entry.morningMessage, nightMessage: entry.nightMessage };
  }

  throw new Error(`Unknown cmd: "${cmd}". Supported: log, task, sleep, checkin`);
}

// ── main ─────────────────────────────────────────────────────────────────────

export async function run({ args }) {
  // Accept JSON as positional arg or from stdin
  let raw;
  if (args[0]) {
    raw = args[0];
  } else {
    // Read from stdin
    raw = await new Promise((resolve, reject) => {
      let buf = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', d => { buf += d; });
      process.stdin.on('end', () => resolve(buf));
      process.stdin.on('error', reject);
    });
  }

  let ops;
  try {
    ops = JSON.parse(raw);
  } catch {
    fail('Invalid JSON. Expected an array of operation objects.');
  }
  if (!Array.isArray(ops)) fail('Batch input must be a JSON array.');
  if (ops.length === 0) { ok([]); return; }

  const cfg = await getAppConfig(); // cached — one GitHub read

  // Load all needed entries (one read per affected date, shared cache)
  const dateMap = new Map(); // dateKey → entry object (mutated in-place)
  for (const op of ops) {
    const dk = op.date || today();
    if (!dateMap.has(dk)) {
      const e = await getEntry(dk);
      dateMap.set(dk, e || { planned: [], log: [] });
    }
  }

  // Apply all operations in memory
  const results = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const dk = op.date || today();
    try {
      const result = applyOp(op, dateMap.get(dk), cfg);
      results.push({ index: i, ok: true, data: result });
    } catch (e) {
      results.push({ index: i, ok: false, error: e.message });
    }
  }

  // Write each date once
  for (const [dk, entry] of dateMap) {
    await setEntryDeferred(dk, entry);
  }
  await flushEntries(); // one GitHub commit per affected month

  ok(results);
}
