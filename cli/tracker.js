#!/usr/bin/env node

import { parseCommand, ok, fail } from './utils.js';
import * as configCmd  from './commands/config.js';
import * as dayCmd     from './commands/day.js';
import * as taskCmd    from './commands/task.js';
import * as logCmd     from './commands/log.js';
import * as sleepCmd   from './commands/sleep.js';
import * as checkinCmd from './commands/checkin.js';
import * as tagCmd     from './commands/tag.js';
import * as projectCmd from './commands/project.js';
import * as syncCmd    from './commands/sync.js';

const COMMANDS = {
  config:  configCmd,
  day:     dayCmd,
  task:    taskCmd,
  log:     logCmd,
  sleep:   sleepCmd,
  checkin: checkinCmd,
  tag:     tagCmd,
  project: projectCmd,
  sync:    syncCmd,
};

const [,, cmd, ...rest] = process.argv;

if (!cmd || cmd === 'help' || cmd === '--help') {
  ok({ commands: Object.keys(COMMANDS) });
  process.exit(0);
}

const mod = COMMANDS[cmd];
if (!mod) {
  console.log(JSON.stringify({ ok: false, error: `Unknown command: "${cmd}". Available: ${Object.keys(COMMANDS).join(', ')}` }));
  process.exit(1);
}

const parsed = parseCommand(rest);

mod.run(parsed).catch(e => {
  console.log(JSON.stringify({ ok: false, error: e.message }));
  process.exit(1);
});
