import { GitHub } from './github.js';
import { loadConfig } from './config.js';

let _gh = null;
const _monthCache = new Map();
let _appConfig = null;

function gh() {
  if (!_gh) {
    const cfg = loadConfig();
    _gh = new GitHub(cfg.token, cfg.repo);
  }
  return _gh;
}

function monthPath(monthKey) {
  const [year, month] = monthKey.split('-');
  return `data/${year}/${month}.json`;
}

export async function getMonthData(monthKey) {
  if (_monthCache.has(monthKey)) return _monthCache.get(monthKey);
  const result = await gh().getFile(monthPath(monthKey));
  const data = result?.content ?? { month: monthKey, entries: {} };
  _monthCache.set(monthKey, data);
  return data;
}

export async function saveMonthData(monthKey, data) {
  await gh().saveFile(monthPath(monthKey), data, `Update ${monthKey}`);
  _monthCache.set(monthKey, data);
}

export async function getEntry(dateKey) {
  const mk = dateKey.slice(0, 7);
  const data = await getMonthData(mk);
  return data.entries[dateKey] ?? null;
}

export async function setEntry(dateKey, entry) {
  const mk = dateKey.slice(0, 7);
  const data = await getMonthData(mk);
  entry.updatedAt = new Date().toISOString();
  data.entries[dateKey] = entry;
  await saveMonthData(mk, data);
}

export async function getAppConfig() {
  if (_appConfig) return _appConfig;
  const result = await gh().getFile('data/config.json');
  _appConfig = result?.content ?? {};
  return _appConfig;
}

export async function saveAppConfig(cfg) {
  cfg.updatedAt = new Date().toISOString();
  await gh().saveFile('data/config.json', cfg, 'Update config');
  _appConfig = cfg;
}

export function getGitHub() { return gh(); }
