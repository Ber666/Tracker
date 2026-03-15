export function genId() {
  return 't' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

export function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isDateKey(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function ok(data) {
  console.log(JSON.stringify({ ok: true, data }));
}

export function fail(msg) {
  console.log(JSON.stringify({ ok: false, error: msg }));
  process.exit(1);
}

// Parse argv like: ["add", "some text", "--time", "09:00", "--duration", "2h"]
// Returns: { subcmd: "add", args: ["some text"], flags: { time: "09:00", duration: "2h" } }
export function parseCommand(argv) {
  const flags = {};
  const positional = [];
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
        i++;
      } else {
        flags[key] = next;
        i += 2;
      }
    } else {
      positional.push(a);
      i++;
    }
  }
  return { subcmd: positional[0], args: positional.slice(1), flags };
}
