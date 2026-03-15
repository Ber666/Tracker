import { saveConfig, readRawConfig } from '../config.js';
import { ok, fail } from '../utils.js';

export async function run({ subcmd, flags }) {
  switch (subcmd) {
    case 'set': {
      if (!flags.token && !flags.repo) fail('Usage: tracker config set --token ghp_... --repo owner/repo');
      const updates = {};
      if (flags.token) updates.token = flags.token;
      if (flags.repo) updates.repo = flags.repo;
      const cfg = saveConfig(updates);
      ok({ repo: cfg.repo, tokenSet: !!cfg.token });
      break;
    }

    case 'show': {
      const cfg = readRawConfig();
      ok({
        repo: cfg.repo || null,
        tokenSet: !!cfg.token,
        tokenPrefix: cfg.token ? cfg.token.slice(0, 7) + '...' : null,
      });
      break;
    }

    default:
      fail(`Unknown subcommand: tracker config ${subcmd ?? ''}. Try: set, show`);
  }
}
