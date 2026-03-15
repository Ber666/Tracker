# Tracker — Design Document

## Overview

A personal planning and journaling tool for daily tracking with stats and project views. Uses GitHub as the database for cross-device sync. No backend, no third-party data services.

```
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Repo                             │
│                    (Private, your data)                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  data/                                                    │  │
│  │  ├── 2026/                                                │  │
│  │  │   ├── 01.json      (all January daily entries)        │  │
│  │  │   ├── 02.json      (all February daily entries)       │  │
│  │  │   └── ...                                              │  │
│  │  └── config.json      (tag groups, projects, Google Client ID) │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ GitHub API (read/write JSON)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Static Web App                             │
│              (Hosted on GitHub Pages / Vercel)                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  - Vanilla JS (no build step)                           │    │
│  │  - localStorage for offline + fast access               │    │
│  │  - Service Worker for PWA (offline support)             │    │
│  │  - GitHub PAT for auth                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
            │                                   │
            ▼                                   ▼
    ┌───────────────────┐               ┌───────────────────┐
    │  Mac Browser      │               │  iPhone Safari    │
    └───────────────────┘               │  (PWA mode)       │
                                        └───────────────────┘
```

---

## File Structure

```
Tracker/
├── index.html              # Main app shell
├── css/
│   └── style.css           # Styles
├── js/
│   ├── app.js              # Main controller, settings, sync
│   ├── github.js           # GitHub API wrapper
│   ├── storage.js          # localStorage + GitHub sync logic
│   ├── utils.js            # Date helpers, formatters, etc.
│   ├── markdown-editor.js  # Reusable edit/preview markdown component
│   └── views/
│       ├── daily.js        # Daily view (timeline + check-ins)
│       ├── stats.js        # Stats view (charts + summaries)
│       └── projects.js     # Projects view
├── sw.js                   # Service worker for offline / PWA
├── manifest.json           # PWA manifest
├── icons/                  # App icons (192px, 512px)
├── cover.svg               # Cover image for README
├── DESIGN.md               # This file
└── README.md               # User-facing docs
```

---

## Data Schema

### Daily Entry (`data/2026/03.json`)

```json
{
  "month": "2026-03",
  "entries": {
    "2026-03-14": {
      "planned": [
        {
          "id": "t1abc123",
          "text": "Write thesis section",
          "scheduledTime": "09:00",
          "duration": "2h",
          "status": "done",
          "notes": "Finished intro + methods",
          "tags": ["work"],
          "importedFrom": "gcal",
          "gcalEventId": "abc@google.com",
          "gcalDescription": "Block: deep work"
        }
      ],
      "log": [
        {
          "id": "t2def456",
          "text": "Advisor meeting",
          "startTime": "14:30",
          "duration": "45m",
          "notes": "Discussed chapter 3",
          "tagIds": ["tag-work"],
          "projectIds": ["proj-abc"],
          "plannedIds": ["t1abc123"],
          "createdAt": "2026-03-14T14:30:00Z"
        }
      ],
      "sleep": {
        "bedTime": "23:00",
        "wakeTime": "07:30",
        "naps": [
          { "start": "13:00", "end": "13:25" }
        ]
      },
      "morning": {
        "quality": 4,
        "clarity": 3,
        "mood": 4,
        "fatigue": 4
      },
      "night": {
        "focus": 3,
        "social": 4,
        "mood": 4,
        "body": 3
      },
      "morningMessage": "Good morning! What's the plan for today?",
      "nightMessage": "Solid day overall.",
      "meals": [
        { "id": "m1", "name": "Oatmeal", "time": "08:00", "notes": "With berries", "autoFrom": "t_breakfast" }
      ],
      "drinks": [
        { "id": "d1", "name": "Coffee", "notes": "" }
      ],
      "dayNotes": "Free markdown notes.",
      "updatedAt": "2026-03-14T21:00:00Z"
    }
  }
}
```

#### Planned Task Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique ID |
| `text` | string | Task description |
| `scheduledTime` | string \| null | Time on timeline ("09:00") |
| `duration` | string \| null | Duration estimate ("2h", "30m") |
| `status` | enum | `"not-started"` \| `"in-progress"` \| `"done"` \| `"cancelled"` |
| `notes` | string | Markdown notes/outcome |
| `tags` | string[] | Tag names from config |
| `importedFrom` | string \| null | `"gcal"` if imported |
| `gcalEventId` | string \| null | Google Calendar event ID |
| `gcalDescription` | string \| null | Read-only gcal description |

#### Log Task Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique ID |
| `text` | string | Task description |
| `startTime` | string \| null | Time started ("14:30") |
| `duration` | string \| null | Duration ("45m") |
| `notes` | string | Markdown notes |
| `tagIds` | string[] | Tag IDs from config |
| `projectIds` | string[] | Project IDs |
| `plannedIds` | string[] | IDs of linked planned tasks |
| `createdAt` | string | ISO timestamp |

#### Sleep Fields

| Field | Type | Description |
|-------|------|-------------|
| `bedTime` | string | Bed time ("23:00") |
| `wakeTime` | string | Wake time ("07:30") |
| `naps` | array | `[{ start, end }]` in "HH:MM" format |

#### Morning Check-in (`entry.morning`)

All fields are integers 1–5.

| Field | Description |
|-------|-------------|
| `quality` | Sleep quality (how well did you sleep?) |
| `clarity` | Mental sharpness / clarity |
| `mood` | Morning mood |
| `fatigue` | Body energy / fatigue (higher = more energetic) |

#### Night Check-in (`entry.night`)

All fields are integers 1–5.

| Field | Description |
|-------|-------------|
| `focus` | How focused/productive was the day |
| `social` | Social interactions quality |
| `mood` | Evening mood |
| `body` | Physical state at end of day |

### Config (`data/config.json`)

```json
{
  "tagGroups": [
    { "id": "grp-1", "name": "Meal", "color": "#56B870" },
    { "id": "grp-2", "name": "Exercise", "color": "#E8654A" },
    { "id": "grp-3", "name": "Misc", "color": "#7B8CDE" }
  ],
  "tags": [
    { "id": "tag-1", "name": "Breakfast", "groupId": "grp-1" },
    { "id": "tag-2", "name": "Lunch", "groupId": "grp-1" },
    { "id": "tag-3", "name": "Gym", "groupId": "grp-2" },
    { "id": "tag-4", "name": "Nap", "groupId": "grp-3" }
  ],
  "projects": [
    { "id": "proj-abc", "name": "Thesis", "color": "#4A90D9", "description": "PhD thesis" }
  ],
  "googleClientId": "xxx.apps.googleusercontent.com"
}
```

---

## UI Wireframes

### Daily View

The daily view uses a two-column layout: timeline on the left, dashboard on the right.

```
┌──────────────────────────────────────────────────────────────────┐
│  ◀ Mar 13   [ March 14, 2026 ]   Mar 15 ▶          [Today]      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─── TIMELINE ─────────────────┐  ┌─── DASHBOARD ───────────┐  │
│  │  [Planned ▾] [+ Add] [↕ Import]│  │                         │  │
│  │                              │  │  MORNING CHECK-IN         │  │
│  │  09:00 ██ Write thesis  ~2h  │  │  Bed [23:00] Wake [07:30] │  │
│  │         ● done               │  │  Duration: 8h30m          │  │
│  │                              │  │                           │  │
│  │  11:00                       │  │  Sleep  Sharpness  Body   │  │
│  │                              │  │  ●●●●○   ●●●○○    ●●●●○  │  │
│  │  14:30 ▪ Advisor meeting 45m │  │         Mood              │  │
│  │         (log)                │  │         ●●●●○             │  │
│  │                              │  │  [morning note textarea]  │  │
│  │                              │  │                           │  │
│  │                              │  │  VITALS                   │  │
│  │                              │  │  Naps  [+ Add]            │  │
│  │                              │  │  13:00–13:25 (25m)        │  │
│  │                              │  │                           │  │
│  │                              │  │  Exercise  [+ Add]        │  │
│  │                              │  │  Gym 45m – Upper body     │  │
│  │                              │  │                           │  │
│  │                              │  │  Meals  [+ Add]           │  │
│  │                              │  │  Breakfast: Oatmeal       │  │
│  │                              │  │  Lunch: Salad             │  │
│  │                              │  │                           │  │
│  │                              │  │  Drinks & Snacks [+ Add]  │  │
│  │                              │  │  Coffee                   │  │
│  │                              │  │                           │  │
│  │                              │  │  [notes editor]           │  │
│  │                              │  │                           │  │
│  │                              │  │  NIGHT CHECK-IN           │  │
│  │                              │  │  Focus Social Mood Body   │  │
│  │                              │  │  ●●●○○  ●●●●○  ●●●●○ ●●●○○│  │
│  │                              │  │  [night note textarea]    │  │
│  └──────────────────────────────┘  └───────────────────────────┘  │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  [Daily]  [Stats]  [Projects]               [⟳ Sync] [⚙ Settings]│
└──────────────────────────────────────────────────────────────────┘
```

### Daily Workflow

```
MORNING
  1. Open app, navigate to today
  2. Import Google Calendar events (optional)
  3. Add/review planned tasks on timeline
  4. Fill in Morning Check-in (sleep times, morning ratings, note)

DURING THE DAY
  1. Mark tasks done / in-progress as you go
  2. Add log items for unplanned things that happen
  3. Update Vitals (meals, naps, drinks) as needed

EVENING
  1. Review timeline — any tasks left to mark?
  2. Fill in Night Check-in (ratings + night note)
  3. Sync to GitHub
```

### Stats View

```
┌──────────────────────────────────────────────────────────────────┐
│  [ 7 days ]  [ 30 days ]  [ 90 days ]                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Avg Sleep   Bed Time    Night Mood  Night Focus                 │
│  7h12m±45m  23:14±22m    3.7         3.2                        │
│  Exercise Days  Task Completion  Days Tracked                    │
│  18             74% (89/120)     22                              │
│                                                                  │
│  ┌─ Sleep Duration ──────┐  ┌─ Task Completion ────────────┐    │
│  │  SVG bar chart        │  │  SVG bar chart               │    │
│  └───────────────────────┘  └──────────────────────────────┘    │
│                                                                  │
│  ┌─ Sleep Quality ─┐  ┌─ Sharpness ──┐  ┌─ Morning Mood ─┐ ... │
│  │  mini SVG chart │  │  mini chart  │  │  mini chart    │     │
│  └─────────────────┘  └──────────────┘  └────────────────┘     │
│  (8 rating mini-charts in 2-column grid)                        │
│                                                                  │
│  ┌─ Exercise ─────────────┐  ┌─ Drinks & Snacks ────────────┐   │
│  │  dot timeline per day  │  │  grouped by day, scrollable  │   │
│  └────────────────────────┘  └──────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Projects View

```
┌──────────────────────────────────────────────────────────────────┐
│  Projects                                      [ + New Project ] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ Thesis ───────────────────────────────────────────────────┐  │
│  │  PhD thesis writing and experiments            [▼ Tasks] [Edit] │
│  │  42 tasks · 74% done · last 90 days   Last: 03-13         │  │
│  │  ████████████████░░░░░░░░  (completion bar)               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Sync Strategy

```
User edits  →  localStorage (instant)  →  GitHub (on ⟳ Sync)
                     ↑
             On app load: fetch from GitHub,
             merge with local (newer updatedAt wins)
```

### Sync Rules

1. **On load**: Fetch from GitHub, merge with localStorage (newer `updatedAt` wins)
2. **On edit**: Save to localStorage immediately (auto-save)
3. **On sync**: Push current month file to GitHub
4. **Conflict**: Compare `updatedAt`, keep the newer version

---

## Authentication

Personal Access Token (PAT) only. The user creates a classic PAT at `github.com/settings/tokens` with `repo` scope. The token is stored in localStorage and used for all GitHub API calls. It never leaves the browser.

---

## Tag Groups

Tag groups are stored in `config.json` and define how tasks are auto-categorized in the Vitals section.

```json
{
  "tagGroups": {
    "meal": ["breakfast", "lunch", "dinner", "snack"],
    "exercise": ["gym", "run", "walk", "bike", "swim"],
    "nap": ["nap"],
    "drink": ["coffee", "tea", "water"]
  }
}
```

When a task's tags match a group, it appears automatically in the corresponding Vitals module. The task's notes field is shown inline as a secondary annotation.

---

## PWA / Offline

The service worker (`sw.js`) caches all static app assets on install and serves them from cache first (stale-while-revalidate). GitHub API calls and localhost requests bypass the cache. Versioned cache names (e.g. `tracker-v54`) force cache refresh on deploy.

---

## Security Notes

- Private repo — only you can see data
- PAT stored in localStorage — stays on device, never sent to any server other than `api.github.com`
- HTTPS only — encrypted in transit
- No backend server — no attack surface
- Don't commit your PAT to any repo
- Revoke and regenerate PAT if device is lost
