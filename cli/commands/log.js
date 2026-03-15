import { getEntry, setEntry, getAppConfig } from '../storage.js';
import { today, isDateKey, genId, ok, fail } from '../utils.js';

function dateKey(flags) { return flags.date || today(); }

function resolveTagIds(tagNames, cfg) {
  if (!tagNames) return [];
  const tags = cfg.tags || [];
  return tagNames.split(',').map(s => s.trim()).filter(Boolean).map(name => {
    const tag = tags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (!tag) throw new Error(`Tag not found: "${name}". Run: tracker tag list`);
    return tag.id;
  });
}

function resolveProjectId(projectArg, cfg) {
  if (!projectArg) return null;
  const p = (cfg.projects || []).find(p => p.id === projectArg || p.name.toLowerCase() === projectArg.toLowerCase());
  if (!p) throw new Error(`Project not found: "${projectArg}". Run: tracker project list`);
  return p.id;
}

function findEntries(log, ref) {
  const exact = log.find(t => t.id === ref);
  if (exact) return [exact];
  const lower = ref.toLowerCase();
  return log.filter(t => t.text.toLowerCase().includes(lower));
}

export async function run({ subcmd, args, flags }) {
  const dk = isDateKey(args[0] ?? '') && subcmd === 'list' ? args[0] : dateKey(flags);
  const cfg = await getAppConfig();
  let entry = await getEntry(dk) || { planned: [], log: [] };
  if (!entry.log) entry.log = [];

  switch (subcmd) {
    case 'add': {
      const text = args[0];
      if (!text) fail('Usage: tracker log add <text> [--time HH:MM] [--duration Xh] [--notes "..."] [--tags t1,t2] [--project name] [--planned id1,id2]');
      const projectId = resolveProjectId(flags.project, cfg);
      const item = {
        id: genId(),
        text,
        startTime: flags.time || null,
        duration: flags.duration || null,
        notes: flags.notes || '',
        tagIds: resolveTagIds(flags.tags, cfg),
        projectIds: projectId ? [projectId] : [],
        plannedIds: flags.planned ? flags.planned.split(',').map(s => s.trim()).filter(Boolean) : [],
        createdAt: new Date().toISOString(),
      };
      entry.log.push(item);
      await setEntry(dk, entry);
      ok(item);
      break;
    }

    case 'list': {
      ok(entry.log);
      break;
    }

    case 'update': {
      const ref = args[0];
      if (!ref) fail('Usage: tracker log update <id>');
      const item = entry.log.find(t => t.id === ref);
      if (!item) fail(`Log entry not found: "${ref}"`);
      if (flags.time !== undefined)     item.startTime = flags.time;
      if (flags.duration !== undefined) item.duration = flags.duration;
      if (flags.notes !== undefined)    item.notes = flags.notes;
      if (flags.tags !== undefined)     item.tagIds = resolveTagIds(flags.tags, cfg);
      if (flags.project !== undefined) {
        const pid = resolveProjectId(flags.project, cfg);
        item.projectIds = pid ? [pid] : [];
      }
      if (flags.planned !== undefined) {
        item.plannedIds = flags.planned.split(',').map(s => s.trim()).filter(Boolean);
      }
      await setEntry(dk, entry);
      ok(item);
      break;
    }

    case 'delete': {
      const ref = args[0];
      if (!ref) fail('Usage: tracker log delete <id|text>');
      const matches = findEntries(entry.log, ref);
      if (matches.length === 0) fail(`No log entry matching: "${ref}"`);
      if (matches.length > 1) fail(`Ambiguous (${matches.length} matches). Use ID: ${matches.map(t => t.id).join(', ')}`);
      entry.log = entry.log.filter(t => t.id !== matches[0].id);
      await setEntry(dk, entry);
      ok({ deleted: matches[0].id });
      break;
    }

    default:
      fail(`Unknown subcommand: tracker log ${subcmd ?? ''}. Try: add, list, update, delete`);
  }
}
