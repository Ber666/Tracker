import { getAppConfig, saveAppConfig } from '../storage.js';
import { genId, ok, fail } from '../utils.js';

export async function run({ subcmd, args, flags }) {
  const cfg = await getAppConfig();
  if (!cfg.tagGroups) cfg.tagGroups = [];
  if (!cfg.tags) cfg.tags = [];

  switch (subcmd ?? 'list') {

    // ── Tag listing ───────────────────────────────────────────────────────────

    case 'list': {
      ok(cfg.tagGroups.map(g => ({
        id: g.id,
        name: g.name,
        color: g.color,
        tags: cfg.tags.filter(t => t.groupId === g.id).map(t => ({ id: t.id, name: t.name })),
      })));
      break;
    }

    // ── Tag CRUD ──────────────────────────────────────────────────────────────

    case 'add': {
      const name = args[0];
      if (!name || !flags.group) fail('Usage: tracker tag add <name> --group <groupId>');
      const group = cfg.tagGroups.find(g => g.id === flags.group);
      if (!group) fail(`Tag group not found: "${flags.group}". Run: tracker tag list`);
      const tag = { id: genId(), name, groupId: flags.group };
      cfg.tags.push(tag);
      await saveAppConfig(cfg);
      ok(tag);
      break;
    }

    case 'update': {
      const ref = args[0];
      if (!ref) fail('Usage: tracker tag update <id> [--name "..."]');
      const tag = cfg.tags.find(t => t.id === ref);
      if (!tag) fail(`Tag not found: "${ref}". Run: tracker tag list`);
      if (flags.name !== undefined) tag.name = flags.name;
      await saveAppConfig(cfg);
      ok(tag);
      break;
    }

    case 'delete': {
      const ref = args[0];
      if (!ref) fail('Usage: tracker tag delete <id>');
      const tag = cfg.tags.find(t => t.id === ref);
      if (!tag) fail(`Tag not found: "${ref}". Run: tracker tag list`);
      cfg.tags = cfg.tags.filter(t => t.id !== ref);
      await saveAppConfig(cfg);
      ok({ deleted: ref, name: tag.name });
      break;
    }

    // ── Tag group CRUD ────────────────────────────────────────────────────────

    case 'group-add': {
      const name = args[0];
      if (!name) fail('Usage: tracker tag group-add <name> [--color #hex]');
      const group = { id: genId(), name, color: flags.color || '#888888' };
      cfg.tagGroups.push(group);
      await saveAppConfig(cfg);
      ok(group);
      break;
    }

    case 'group-update': {
      const ref = args[0];
      if (!ref) fail('Usage: tracker tag group-update <id> [--name "..."] [--color #hex]');
      const group = cfg.tagGroups.find(g => g.id === ref);
      if (!group) fail(`Tag group not found: "${ref}". Run: tracker tag list`);
      if (flags.name  !== undefined) group.name  = flags.name;
      if (flags.color !== undefined) group.color = flags.color;
      await saveAppConfig(cfg);
      ok(group);
      break;
    }

    case 'group-delete': {
      const ref = args[0];
      if (!ref) fail('Usage: tracker tag group-delete <id>');
      const group = cfg.tagGroups.find(g => g.id === ref);
      if (!group) fail(`Tag group not found: "${ref}". Run: tracker tag list`);
      const tagIds = cfg.tags.filter(t => t.groupId === ref).map(t => t.id);
      cfg.tagGroups = cfg.tagGroups.filter(g => g.id !== ref);
      cfg.tags = cfg.tags.filter(t => t.groupId !== ref);
      await saveAppConfig(cfg);
      ok({ deleted: ref, name: group.name, tagsDeleted: tagIds.length });
      break;
    }

    default:
      fail(`Unknown subcommand: tracker tag ${subcmd}. Try: list, add, update, delete, group-add, group-update, group-delete`);
  }
}
