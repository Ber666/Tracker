# Tracker CLI — Design

A command-line interface for the Tracker app, built so an LLM agent can read and write your daily data programmatically. Uses the same GitHub data backend and JSON schema as the web app.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              tracker CLI (Node.js)                   │
│                                                      │
│  cli/                                                │
│  ├── tracker.js        # entry point, arg routing    │
│  ├── github.js         # GitHub API (read/write)     │
│  ├── storage.js        # month-file read/write ops   │
│  ├── commands/                                       │
│  │   ├── day.js        # tracker day                 │
│  │   ├── task.js       # tracker task                │
│  │   ├── log.js        # tracker log                 │
│  │   ├── sleep.js      # tracker sleep               │
│  │   ├── checkin.js    # tracker checkin             │
│  │   ├── project.js    # tracker project             │
│  │   ├── tag.js        # tracker tag                 │
│  │   ├── project.js    # tracker project             │
│  │   └── sync.js       # tracker sync                │
│  └── config.js         # ~/.tracker-cli.json         │
└─────────────────────────────────────────────────────┘
              │
              │ GitHub API (same as web app)
              ▼
        Private GitHub repo
        data/YYYY/MM.json
        data/config.json
```

The CLI is a **standalone Node.js script** — no dependency on the web app. It reuses the same data schema and GitHub API access pattern.

---

## Authentication & Config

Config is stored in `~/.tracker-cli.json`:

```json
{
  "token": "ghp_...",
  "repo": "username/my-journal-data"
}
```

Override with env vars: `TRACKER_TOKEN`, `TRACKER_REPO`.

```bash
tracker config set --token ghp_... --repo username/my-journal-data
tracker config show
```

---

## Output Format

**All commands output JSON by default** — designed for LLM agent consumption.

Success:
```json
{ "ok": true, "data": { ... } }
```

Error:
```json
{ "ok": false, "error": "Task not found: t1abc123" }
```

Add `--human` to any command for readable terminal output instead.

---

## Commands

### `tracker day`

Read a full day entry.

```bash
tracker day                    # today
tracker day 2026-03-14         # specific date
tracker day --human            # readable summary
```

Output (`data`):
```json
{
  "date": "2026-03-14",
  "planned": [...],
  "log": [...],
  "sleep": { "bedTime": "23:00", "wakeTime": "07:30", "naps": [] },
  "morning": { "quality": 4, "clarity": 3, "mood": 4, "fatigue": 3 },
  "night": { "focus": 3, "social": 4, "mood": 4, "body": 3 },
  "morningMessage": "...",
  "nightMessage": "...",
  "meals": [...],
  "exercise": [...],
  "dayNotes": "..."
}
```

---

### `tracker task`

Manage planned tasks.

```bash
# Add a task (--tags and --project take IDs — get them from tracker tag list / tracker project list)
tracker task add "Write thesis intro" \
  --time 09:00 \
  --duration 2h \
  --project tmmqzxn2s5kepu \
  --tags mmr2no961fq7x58dl9t \
  --date 2026-03-14       # default: today

# List tasks
tracker task list                # today
tracker task list 2026-03-14

# Mark done (by id or substring match on text)
tracker task done t1abc123
tracker task done "Write thesis"
tracker task done t1abc123 --notes "Finished draft, need to revise methods"

# Update task fields
tracker task update t1abc123 \
  --status in-progress \
  --time 10:00 \
  --duration 3h \
  --notes "Running behind"

# Cancel
tracker task cancel t1abc123
```

Status values: `not-started` | `in-progress` | `done` | `cancelled`

`task list` output:
```json
[
  {
    "id": "t1abc123",
    "text": "Write thesis intro",
    "scheduledTime": "09:00",
    "duration": "2h",
    "status": "done",
    "notes": "Finished draft",
    "tagIds": ["tag-xyz"],
    "projectIds": ["proj-abc"]
  }
]
```

---

### `tracker log`

Add ad-hoc log entries (things that actually happened, planned or not).

```bash
# Add a log entry
tracker log add "Advisor meeting" \
  --time 14:30 \
  --duration 45m \
  --notes "Discussed chapter 3 feedback" \
  --tags mmr2no961fq7x58dl9t \
  --project tmmqzxn2s5kepu \
  --planned t1abc123 \    # link to one or more planned tasks (IDs)
  --date 2026-03-14       # default: today

# Multiple planned links
tracker log add "Finished writing" \
  --planned t1abc123,t1def456

# List today's log entries
tracker log list
tracker log list 2026-03-14

# Update a log entry
tracker log update t2def456 \
  --notes "Updated notes" \
  --duration 1h \
  --planned t1abc123

# Delete a log entry
tracker log delete t2def456
```

`log list` output:
```json
[
  {
    "id": "t2def456",
    "text": "Advisor meeting",
    "startTime": "14:30",
    "duration": "45m",
    "notes": "Discussed chapter 3 feedback",
    "tagIds": ["tag-work"],
    "projectIds": ["proj-abc"],
    "plannedIds": ["t1abc123"],
    "createdAt": "2026-03-14T14:30:00Z"
  }
]
```

Note: `plannedIds` links this log entry back to planned tasks, mirroring the web app's "Links to planned tasks" feature. A log entry can link to multiple planned tasks (e.g. one session that covered several planned items).

---

### `tracker sleep`

```bash
tracker sleep set --bed 23:00 --wake 07:30
tracker sleep set --bed 23:00 --wake 07:30 --date 2026-03-14

tracker sleep nap --time 13:00 --duration 25m   # add nap

tracker sleep get                               # today's sleep data
```

---

### `tracker checkin`


```bash
# Morning check-in (ratings 1–5, higher = better)
tracker checkin morning \
  --quality 4 \      # sleep quality
  --clarity 3 \      # mental sharpness
  --mood 4 \         # morning mood
  --body 3 \         # body energy
  --note "Ready to write today"

# Night check-in
tracker checkin night \
  --focus 3 \        # day focus/productivity
  --social 4 \       # social quality
  --mood 4 \         # evening mood
  --body 3 \         # physical state
  --note "Good but tiring"

# Partial update — only set what's provided
tracker checkin morning --mood 5 --note "Feeling great"
```

---

### `tracker tag`

Manage tags and tag groups.

```bash
# List all groups with their tags
tracker tag list

# Add a tag to an existing group (--group takes a group ID from tag list)
tracker tag add "Breakfast" --group grp-1

# Rename a tag
tracker tag update tag-1 --name "Morning Run"

# Delete a tag
tracker tag delete tag-1

# Add a new tag group
tracker tag group-add "Exercise" --color "#E8654A"

# Update a group
tracker tag group-update grp-2 --name "Fitness" --color "#FF6B35"

# Delete a group (also deletes all tags in it)
tracker tag group-delete grp-2
```

`tag list` output:
```json
[
  {
    "id": "grp-1",
    "name": "Meal",
    "color": "#56B870",
    "tags": [
      { "id": "tag-1", "name": "Breakfast" },
      { "id": "tag-2", "name": "Lunch" },
      { "id": "tag-3", "name": "Dinner" }
    ]
  }
]
```

---

### `tracker project`

```bash
tracker project list

tracker project add "Thesis" \
  --color "#4A90D9" \
  --description "PhD thesis writing and experiments"

tracker project show proj-abc        # card + 90-day stats
tracker project tasks proj-abc       # recent task history

tracker project update proj-abc \
  --name "PhD Thesis" \
  --description "Updated goal"

tracker project delete proj-abc
```

`project list` output:
```json
[
  {
    "id": "proj-abc",
    "name": "Thesis",
    "color": "#4A90D9",
    "description": "PhD thesis writing",
    "stats": {
      "totalTasks": 42,
      "doneTasks": 31,
      "completionPct": 74,
      "lastActiveDate": "2026-03-13"
    }
  }
]
```

---

### `tracker batch`

Write multiple entries in a single GitHub commit. Accepts a JSON array via argument or stdin. Each element is an operation object with a `cmd` field plus the same fields as the individual commands.

```bash
tracker batch '[
  {"cmd": "log",     "text": "morning run",     "time": "07:30", "duration": "30m"},
  {"cmd": "log",     "text": "standup meeting",  "time": "09:00", "duration": "30m"},
  {"cmd": "task",    "text": "review PR #42",    "time": "10:00"},
  {"cmd": "sleep",   "bed": "23:30", "wake": "07:00"},
  {"cmd": "checkin", "morning": "Feeling good today"}
]'

# Pipe from stdin
echo '[{"cmd":"log","text":"lunch","time":"12:30","duration":"45m"}]' | tracker batch
```

**Operation fields:**

| `cmd`     | Required fields | Optional fields |
|-----------|----------------|-----------------|
| `log`     | `text`         | `time`, `duration`, `notes`, `tags`, `project`, `plannedIds`, `date` |
| `task`    | `text`         | `time`, `duration`, `notes`, `status`, `tags`, `project`, `date` |
| `sleep`   | —              | `bed`, `wake`, `nap`, `date` |
| `checkin` | —              | `morning`, `night`, `date` |

`date` defaults to today. All operations targeting the same date are batched into **one GitHub commit**.

Output is an array of per-operation results:
```json
[
  {"index": 0, "ok": true, "data": {"id": "t1abc", "text": "morning run", ...}},
  {"index": 1, "ok": true, "data": {"id": "t2def", ...}},
  {"index": 2, "ok": false, "error": "Tag ID not found: \"xyz\""}
]
```

---

### `tracker sync`

```bash
tracker sync          # pull from GitHub, then push local changes
tracker sync --pull   # pull only (refresh local cache)
tracker sync --push   # push only
```

The CLI maintains a local cache of fetched month files in `~/.tracker-cache/` to avoid redundant API calls.

---

## LLM Agent Usage Pattern

The CLI is designed to be called by an LLM agent in a tool-use loop. Typical agent actions:

```bash
# Read today's state
tracker day --json

# Plan the day (add tasks)
tracker task add "Review PR #42" --time 10:00 --duration 30m
tracker task add "Write section 3.2" --time 14:00 --duration 2h --project proj-abc

# Mark progress
tracker task done "Review PR" --notes "Approved, merged"
tracker task update t1abc123 --status in-progress

# Log unexpected things (or actual work done on a planned task)
tracker log add "Fire drill interrupted deep work" --time 11:00 --duration 15m
tracker log add "Finished thesis section" --time 16:00 --duration 2h --planned t1abc123 --notes "Got through intro + methods"

# End of day
tracker checkin night --focus 4 --social 2 --mood 4 --body 3 \
  --note "Good progress on thesis, social isolation day"
tracker sync
```

### Agent-friendly guarantees

- **All output is valid JSON** (parseable with no stripping required)
- **Exit codes**: `0` = success, `1` = error (check `ok: false` in output)
- **Idempotent reads**: all `get`/`list`/`day` commands are safe to call repeatedly
- **Partial updates**: `checkin` and `task update` only change the fields you pass; other fields are preserved
- **Date default**: omitting `--date` always means today (`YYYY-MM-DD` in local time)
- **Text matching**: `task done "partial text"` matches the first task whose text contains the substring (case-insensitive), returns error if ambiguous

---


## File Layout

```
cli/
├── package.json       # { "type": "module" }, node built-ins only (no npm deps)
├── tracker.js         # #!/usr/bin/env node — entry point
├── config.js          # read/write ~/.tracker-cli.json
├── github.js          # fetch wrapper for GitHub Contents API
├── storage.js         # getEntry(date), setEntry(date, data), getConfig()
├── utils.js           # date helpers, id gen, duration parse
└── commands/
    ├── day.js
    ├── task.js
    ├── log.js
    ├── sleep.js
    ├── checkin.js
    ├── project.js
    ├── tag.js
    ├── project.js
    └── sync.js
```

No npm dependencies — only Node.js built-ins (`fs`, `path`, `https`). Keeps installation trivial: `chmod +x cli/tracker.js && ln -s $(pwd)/cli/tracker.js /usr/local/bin/tracker`.
