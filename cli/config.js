import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_PATH = join(homedir(), '.tracker-cli.json');

export function loadConfig() {
  let file = {};
  try { file = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')); } catch {}

  const cfg = {
    token: process.env.TRACKER_TOKEN || file.token,
    repo: process.env.TRACKER_REPO || file.repo,
  };

  if (!cfg.token) throw new Error('No GitHub token. Run: tracker config set --token ghp_...');
  if (!cfg.repo) throw new Error('No repo. Run: tracker config set --repo owner/repo');

  return cfg;
}

export function saveConfig(updates) {
  let file = {};
  try { file = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')); } catch {}
  Object.assign(file, updates);
  writeFileSync(CONFIG_PATH, JSON.stringify(file, null, 2), 'utf8');
  return file;
}

export function readRawConfig() {
  try { return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}
