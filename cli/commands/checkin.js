import { getEntry, setEntry } from '../storage.js';
import { today, ok, fail } from '../utils.js';

function dateKey(flags) { return flags.date || today(); }

export async function run({ subcmd, flags }) {
  const dk = dateKey(flags);
  let entry = await getEntry(dk) || { planned: [], log: [] };

  switch (subcmd) {
    case 'morning': {
      if (!entry.morning) entry.morning = {};
      if (flags.quality !== undefined) entry.morning.quality  = parseInt(flags.quality);
      if (flags.clarity !== undefined) entry.morning.clarity  = parseInt(flags.clarity);
      if (flags.mood    !== undefined) entry.morning.mood     = parseInt(flags.mood);
      if (flags.body    !== undefined) entry.morning.fatigue  = parseInt(flags.body);
      if (flags.note    !== undefined) entry.morningMessage   = flags.note;
      await setEntry(dk, entry);
      ok({ morning: entry.morning, morningMessage: entry.morningMessage });
      break;
    }

    case 'night': {
      if (!entry.night) entry.night = {};
      if (flags.focus  !== undefined) entry.night.focus   = parseInt(flags.focus);
      if (flags.social !== undefined) entry.night.social  = parseInt(flags.social);
      if (flags.mood   !== undefined) entry.night.mood    = parseInt(flags.mood);
      if (flags.body   !== undefined) entry.night.body    = parseInt(flags.body);
      if (flags.note   !== undefined) entry.nightMessage  = flags.note;
      await setEntry(dk, entry);
      ok({ night: entry.night, nightMessage: entry.nightMessage });
      break;
    }

    default:
      fail(`Unknown subcommand: tracker checkin ${subcmd ?? ''}. Try: morning, night`);
  }
}
