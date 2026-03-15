import { getAppConfig, saveAppConfig, getMonthData } from '../storage.js';
import { today, genId, ok, fail } from '../utils.js';

function findProject(projects, ref) {
  return projects.find(p => p.id === ref || p.name.toLowerCase() === ref.toLowerCase());
}

async function getProjectStats(projectId) {
  const now = new Date();
  const monthCache = {};
  let totalTasks = 0, doneTasks = 0, lastActiveKey = null;
  const recentTasks = [];

  for (let i = 0; i < 90; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const y  = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    const dateKey = `${y}-${mo}-${dy}`;
    const mk = `${y}-${mo}`;

    if (!monthCache[mk]) {
      const data = await getMonthData(mk);
      monthCache[mk] = data.entries || {};
    }

    const entry = monthCache[mk][dateKey];
    if (!entry) continue;

    for (const t of [...(entry.planned || []), ...(entry.log || [])]) {
      if (!(t.projectIds || []).includes(projectId)) continue;
      totalTasks++;
      if (t.status === 'done') doneTasks++;
      if (!lastActiveKey || dateKey > lastActiveKey) lastActiveKey = dateKey;
      recentTasks.push({ ...t, dateKey });
    }
  }

  recentTasks.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  return {
    totalTasks,
    doneTasks,
    completionPct: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
    lastActiveDate: lastActiveKey,
    recentTasks: recentTasks.slice(0, 15),
  };
}

export async function run({ subcmd, args, flags }) {
  const cfg = await getAppConfig();
  if (!cfg.projects) cfg.projects = [];

  switch (subcmd) {
    case 'list': {
      const result = [];
      for (const p of cfg.projects) {
        const stats = await getProjectStats(p.id);
        result.push({
          ...p,
          stats: {
            totalTasks: stats.totalTasks,
            doneTasks: stats.doneTasks,
            completionPct: stats.completionPct,
            lastActiveDate: stats.lastActiveDate,
          },
        });
      }
      ok(result);
      break;
    }

    case 'add': {
      const name = args[0];
      if (!name) fail('Usage: tracker project add <name> [--color #hex] [--description "..."]');
      const project = {
        id: genId(),
        name,
        color: flags.color || '#4A90D9',
        description: flags.description || '',
      };
      cfg.projects.push(project);
      await saveAppConfig(cfg);
      ok(project);
      break;
    }

    case 'show': {
      const ref = args[0];
      if (!ref) fail('Usage: tracker project show <id|name>');
      const p = findProject(cfg.projects, ref);
      if (!p) fail(`Project not found: "${ref}"`);
      const stats = await getProjectStats(p.id);
      ok({ ...p, stats });
      break;
    }

    case 'tasks': {
      const ref = args[0];
      if (!ref) fail('Usage: tracker project tasks <id|name>');
      const p = findProject(cfg.projects, ref);
      if (!p) fail(`Project not found: "${ref}"`);
      const stats = await getProjectStats(p.id);
      ok(stats.recentTasks);
      break;
    }

    case 'update': {
      const ref = args[0];
      if (!ref) fail('Usage: tracker project update <id|name> [--name "..."] [--color #hex] [--description "..."]');
      const p = findProject(cfg.projects, ref);
      if (!p) fail(`Project not found: "${ref}"`);
      if (flags.name        !== undefined) p.name        = flags.name;
      if (flags.color       !== undefined) p.color       = flags.color;
      if (flags.description !== undefined) p.description = flags.description;
      await saveAppConfig(cfg);
      ok(p);
      break;
    }

    case 'delete': {
      const ref = args[0];
      if (!ref) fail('Usage: tracker project delete <id|name>');
      const p = findProject(cfg.projects, ref);
      if (!p) fail(`Project not found: "${ref}"`);
      cfg.projects = cfg.projects.filter(x => x.id !== p.id);
      await saveAppConfig(cfg);
      ok({ deleted: p.id, name: p.name });
      break;
    }

    default:
      fail(`Unknown subcommand: tracker project ${subcmd ?? ''}. Try: list, add, show, tasks, update, delete`);
  }
}
