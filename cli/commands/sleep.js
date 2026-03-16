import { getEntry, setEntry } from '../storage.js';
import { today, isDateKey, genId, ok, fail } from '../utils.js';

function dateKey(flags) { return flags.date || today(); }

export async function run({ subcmd, args, flags }) {
  // `tracker sleep 2026-03-14` → show that day's sleep
  if (isDateKey(subcmd ?? '')) {
    const entry = await getEntry(subcmd) || {};
    ok(entry.sleep || {});
    return;
  }

  const dk = dateKey(flags);
  let entry = await getEntry(dk) || { planned: [], log: [] };
  if (!entry.sleep) entry.sleep = {};

  switch (subcmd) {
    case 'set': {
      if (!flags.bed && !flags.wake) fail('Usage: tracker sleep set --bed HH:MM --wake HH:MM');
      if (flags.bed)  entry.sleep.bedTime  = flags.bed;
      if (flags.wake) entry.sleep.wakeTime = flags.wake;
      await setEntry(dk, entry);
      ok(entry.sleep);
      break;
    }

    case 'get':
    case undefined: {
      ok(entry.sleep);
      break;
    }

    case 'nap': {
      if (!flags.time || !flags.duration) fail('Usage: tracker sleep nap --time HH:MM --duration Xm');
      if (!entry.vitals) entry.vitals = {};
      if (!entry.vitals.naps) entry.vitals.naps = [];
      const nap = { id: genId(), time: flags.time, duration: flags.duration, content: flags.duration };
      entry.vitals.naps.push(nap);
      await setEntry(dk, entry);
      ok(nap);
      break;
    }

    default:
      fail(`Unknown subcommand: tracker sleep ${subcmd}. Try: set, get, nap`);
  }
}
