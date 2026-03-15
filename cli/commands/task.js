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
  const projects = cfg.projects || [];
  const p = projects.find(p => p.id === projectArg || p.name.toLowerCase() === projectArg.toLowerCase());
  if (!p) throw new Error(`Project not found: "${projectArg}". Run: tracker project list`);
  return p.id;
}

function findTasks(tasks, ref) {
  const exact = tasks.find(t => t.id === ref);
  if (exact) return [exact];
  const lower = ref.toLowerCase();
  return tasks.filter(t => t.text.toLowerCase().includes(lower));
}

export async function run({ subcmd, args, flags }) {
  const dk = isDateKey(args[0] ?? '') && subcmd === 'list' ? args[0] : dateKey(flags);
  const cfg = await getAppConfig();
  let entry = await getEntry(dk) || { planned: [], log: [] };
  if (!entry.planned) entry.planned = [];

  switch (subcmd) {
    case 'add': {
      const text = args[0];
      if (!text) fail('Usage: tracker task add <text> [--time HH:MM] [--duration Xh] [--project name] [--tags t1,t2]');
      const projectId = resolveProjectId(flags.project, cfg);
      const task = {
        id: genId(),
        text,
        scheduledTime: flags.time || null,
        duration: flags.duration || null,
        status: 'not-started',
        notes: flags.notes || '',
        tagIds: resolveTagIds(flags.tags, cfg),
        projectIds: projectId ? [projectId] : [],
        createdAt: new Date().toISOString(),
      };
      entry.planned.push(task);
      await setEntry(dk, entry);
      ok(task);
      break;
    }

    case 'list': {
      ok(entry.planned);
      break;
    }

    case 'done': {
      const ref = args[0];
      if (!ref) fail('Usage: tracker task done <id|text> [--notes "..."]');
      const matches = findTasks(entry.planned, ref);
      if (matches.length === 0) fail(`No planned task matching: "${ref}"`);
      if (matches.length > 1) fail(`Ambiguous (${matches.length} matches). Use ID: ${matches.map(t => t.id).join(', ')}`);
      matches[0].status = 'done';
      if (flags.notes !== undefined) matches[0].notes = flags.notes;
      await setEntry(dk, entry);
      ok(matches[0]);
      break;
    }

    case 'update': {
      const ref = args[0];
      if (!ref) fail('Usage: tracker task update <id> [--status s] [--time HH:MM] [--duration Xh] [--notes "..."]');
      const task = entry.planned.find(t => t.id === ref);
      if (!task) fail(`Task not found: "${ref}"`);
      if (flags.status !== undefined)   task.status = flags.status;
      if (flags.time !== undefined)     task.scheduledTime = flags.time;
      if (flags.duration !== undefined) task.duration = flags.duration;
      if (flags.notes !== undefined)    task.notes = flags.notes;
      if (flags.tags !== undefined)     task.tagIds = resolveTagIds(flags.tags, cfg);
      if (flags.project !== undefined) {
        const pid = resolveProjectId(flags.project, cfg);
        task.projectIds = pid ? [pid] : [];
      }
      await setEntry(dk, entry);
      ok(task);
      break;
    }

    case 'cancel': {
      const ref = args[0];
      if (!ref) fail('Usage: tracker task cancel <id|text>');
      const matches = findTasks(entry.planned, ref);
      if (matches.length === 0) fail(`No planned task matching: "${ref}"`);
      if (matches.length > 1) fail(`Ambiguous (${matches.length} matches). Use ID: ${matches.map(t => t.id).join(', ')}`);
      matches[0].status = 'cancelled';
      await setEntry(dk, entry);
      ok(matches[0]);
      break;
    }

    default:
      fail(`Unknown subcommand: tracker task ${subcmd ?? ''}. Try: add, list, done, update, cancel`);
  }
}
