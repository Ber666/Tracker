import { getGitHub, getMonthData } from '../storage.js';
import { today, ok, fail } from '../utils.js';

export async function run({ flags }) {
  try {
    await getGitHub().validate();
  } catch (e) {
    fail(e.message);
  }

  const mk = today().slice(0, 7);
  const data = await getMonthData(mk);
  const daysTracked = Object.keys(data.entries || {}).length;

  if (flags.push) {
    ok({ status: 'ok', note: 'CLI writes directly to GitHub on every command — no local cache to push.' });
  } else {
    ok({ status: 'connected', month: mk, daysTracked });
  }
}
