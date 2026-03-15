import { getAppConfig } from '../storage.js';
import { ok, fail } from '../utils.js';

export async function run({ subcmd }) {
  switch (subcmd ?? 'list') {
    case 'list': {
      const cfg = await getAppConfig();
      const groups = cfg.tagGroups || [];
      const tags = cfg.tags || [];
      ok(groups.map(g => ({
        id: g.id,
        name: g.name,
        color: g.color,
        tags: tags.filter(t => t.groupId === g.id).map(t => ({ id: t.id, name: t.name })),
      })));
      break;
    }
    default:
      fail(`Unknown subcommand: tracker tag ${subcmd}. Try: list`);
  }
}
