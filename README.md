![Tracker](cover.svg)

I built this for myself as a PhD student who constantly wonders where the day went. Planning what I want to do, then logging what I actually did, helps me feel less like time is just slipping by. Data stays in my own private GitHub repo. Sharing it in case it's useful for you too.

## Features

**Plan & log your day** — every day starts with a planned task list on a visual timeline. As the day unfolds, you log what actually happened: unplanned meetings, rabbit holes, anything. The side-by-side view makes it easy to see the gap between intention and reality, which is usually where the day went.

**Check-ins & vitals** — morning check-in records sleep times and 4 ratings (sleep quality, sharpness, mood, body energy) so you can spot patterns in how you feel vs. how you perform. Evening check-in captures focus, social, mood, and physical state. The Vitals panel auto-populates meals, exercise, naps, and drinks from tagged tasks — no double-entry.

**CLI + agent integration** — a JSON-output CLI lets you log anything from the terminal. OpenClaw can use that to handle check-ins and log updates conversationally — e.g., send a WhatsApp message like "just finished a 45-min gym session" and it calls `tracker log add` in the background, or set OpenClaw to check in your progress every hour and automatically update the log.

**Data on GitHub** — all entries are stored as JSON files in a private GitHub repo you own. No accounts, no subscriptions, no third-party servers. Sync is on-demand via the web app or automatic via the CLI.

**Also:** Stats view with sleep / task / rating charts across 7 / 30 / 90 days. Projects view with per-project completion tracking. Google Calendar import for planned tasks.

## Quick Start

### 1. Create a GitHub repo as your private database

1. Go to [github.com/new](https://github.com/new)
2. Create a **private** repository (e.g., `my-journal-data`)
3. Leave it empty (no README, .gitignore, or license)

### 2. Generate a Personal Access Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Generate new token (classic)
3. Select scope: `repo` (Full control of private repositories)
4. Copy the token (starts with `ghp_`)

### 3. Run the app locally

```bash
cd /path/to/Tracker
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080), enter your GitHub token and repo details, and start tracking.

## CLI

The CLI lets you read and write all tracker data from the terminal. Every command outputs JSON, making it easy to script or wire up an LLM agent.

### Setup

```bash
node cli/tracker.js config set --token ghp_... --repo username/my-journal-data

# Optional: symlink for convenience
ln -s $(pwd)/cli/tracker.js /usr/local/bin/tracker
```

Requires Node.js 18+. No npm dependencies.

### Usage

```bash
# Read today
tracker day
tracker day --human          # readable summary

# Plan
tracker task add "Write section 3.2" --time 14:00 --duration 2h --project Thesis --tags Writing
tracker task list
tracker task done "Write section" --notes "Draft done, needs revision"

# Log what actually happened
tracker log add "Unplanned advisor meeting" --time 11:00 --duration 45m --tags Meeting --project Thesis

# Check-ins
tracker sleep set --bed 23:30 --wake 07:45
tracker checkin morning --quality 4 --clarity 3 --mood 4 --body 3 --note "Feeling good"
tracker checkin night --focus 4 --social 3 --mood 4 --body 3

# Browse
tracker tag list
tracker project list
tracker project show Thesis
tracker sync
```

All outputs are `{ "ok": true, "data": ... }` or `{ "ok": false, "error": "..." }` with exit code 1 on error.

## Agent Integration

Once the CLI is set up, you can chat with OpenClaw to operate the tracker on your phone, without openning the website.

## Google Calendar Import

**Create a Google Client ID**

1. Go to [console.cloud.google.com](https://console.cloud.google.com) — sign in with a **personal Google account** (school/work accounts may block OAuth credential creation)
2. Create a project → **APIs & Services → Enable APIs** → enable **Google Calendar API**
3. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: add your app URL (e.g. `http://localhost:8080`)
4. Copy the **Client ID** (ends in `.apps.googleusercontent.com`)
5. In Tracker → **Settings** → paste it into **Google Client ID** → Save

**Importing events**

1. Navigate to the day you want to import
2. Click **↕ Import** next to Planned tasks
3. On first use, click **Connect Google Calendar** and sign in
4. Select events → **Import Selected**

Re-importing the same event updates calendar fields while preserving any notes you've added.

## Tag Groups

Tag groups categorize tasks so the app can auto-populate the Vitals sections. Manage them in **Settings → Tags**.

On first launch, three groups are seeded automatically:

| Group | Purpose | Default tags |
|-------|---------|--------------|
| **Meal** | Auto-fills Meals module | Breakfast, Lunch, Dinner |
| **Exercise** | Auto-fills Exercise module | Gym, Run, Walk, Swim, Bike, Yoga |
| **Misc** | Misc tags (Nap auto-fills Naps module) | Nap |

## File Structure

```
Tracker/
├── index.html
├── css/style.css
├── js/
│   ├── app.js
│   ├── github.js
│   ├── storage.js
│   ├── utils.js
│   ├── markdown-editor.js
│   └── views/
│       ├── daily.js
│       ├── stats.js
│       └── projects.js
├── cli/
│   ├── tracker.js          # entry point (chmod +x)
│   ├── github.js           # GitHub API (Node.js)
│   ├── storage.js          # read/write month files
│   ├── config.js           # ~/.tracker-cli.json
│   ├── utils.js
│   └── commands/           # one file per command
├── sw.js
├── manifest.json
└── icons/
```

## Data Storage

```
data/
├── 2026/
│   ├── 01.json         # January daily entries
│   ├── 02.json         # February daily entries
│   └── ...
└── config.json         # tag groups, projects, Google Client ID
```

## Data Schema

### Daily Entry

```json
{
  "planned": [
    {
      "id": "t1abc123",
      "text": "CS336 Assignment",
      "scheduledTime": "09:00",
      "duration": "2h",
      "status": "not-started | in-progress | done | cancelled",
      "notes": "Optional markdown notes",
      "tagIds": ["tag-id"],
      "projectIds": ["proj-id"],
      "importedFrom": "gcal",
      "gcalEventId": "abc123@google.com",
      "gcalDescription": "Read-only description from Google Calendar"
    }
  ],
  "log": [
    {
      "id": "t2def456",
      "text": "Advisor meeting",
      "startTime": "14:30",
      "duration": "45m",
      "notes": "Discussed chapter 3",
      "tagIds": ["tag-id"],
      "projectIds": ["proj-id"],
      "plannedIds": ["t1abc123"],
      "createdAt": "2026-03-14T14:30:00Z"
    }
  ],
  "sleep": {
    "bedTime": "23:00",
    "wakeTime": "07:30",
    "naps": [{ "id": "n1", "time": "13:00", "duration": "25m" }]
  },
  "morning": { "quality": 4, "clarity": 3, "mood": 4, "fatigue": 3 },
  "night":   { "focus": 4, "social": 3, "mood": 4, "body": 3 },
  "morningMessage": "Ready for a productive day.",
  "nightMessage": "Good but tiring day.",
  "meals": [
    { "id": "m1", "name": "Oatmeal", "time": "08:00", "type": "meal" },
    { "id": "d1", "name": "Coffee", "type": "drink" }
  ],
  "dayNotes": "Free-form markdown notes for the day."
}
```

**Planned tasks** are added in the morning with an optional scheduled time and duration. Status tracks progress throughout the day.
**Log tasks** are ad-hoc entries added as things happen, optionally linked to planned tasks via `plannedIds`.
**morning / night** ratings are 1–5 integers (higher = better for all fields).
**meals** stores both food and drink items, distinguished by `type: "meal" | "drink"`.

## Security

- Data stored in your private GitHub repo
- GitHub token stored in browser localStorage / `~/.tracker-cli.json` (never sent elsewhere)
- All sync over HTTPS
- No backend server

## License

MIT
