import { getEntry } from '../storage.js';
import { today, isDateKey, ok, fail } from '../utils.js';

export async function run({ subcmd, flags }) {
  const dateKey = subcmd || today();
  if (!isDateKey(dateKey)) fail(`Invalid date: "${dateKey}". Expected YYYY-MM-DD.`);

  const entry = await getEntry(dateKey);

  if (flags.human) {
    if (!entry) { console.log(`${dateKey}: no data`); return; }
    const planned = entry.planned || [];
    const log = entry.log || [];
    const sleep = entry.sleep || {};
    const m = entry.morning || {};
    const n = entry.night || {};

    console.log(`\n=== ${dateKey} ===`);
    console.log(`Sleep: ${sleep.bedTime || '?'} → ${sleep.wakeTime || '?'}`);
    if (m.quality) console.log(`Morning: quality=${m.quality} clarity=${m.clarity} mood=${m.mood} body=${m.fatigue}`);
    if (n.focus)   console.log(`Night:   focus=${n.focus} social=${n.social} mood=${n.mood} body=${n.body}`);

    console.log(`\nPlanned (${planned.length}):`);
    for (const t of planned) {
      const time = t.scheduledTime ? `[${t.scheduledTime}]` : '      ';
      const dur  = t.duration ? ` (${t.duration})` : '';
      console.log(`  ${icon(t.status)} ${time} ${t.text}${dur}`);
    }

    console.log(`\nLog (${log.length}):`);
    for (const t of log) {
      const time = t.startTime ? `[${t.startTime}]` : '      ';
      const dur  = t.duration ? ` (${t.duration})` : '';
      console.log(`  • ${time} ${t.text}${dur}`);
    }
    return;
  }

  ok({ date: dateKey, ...(entry || {}) });
}

function icon(s) {
  return s === 'done' ? '●' : s === 'in-progress' ? '◑' : s === 'cancelled' ? '✕' : '○';
}
