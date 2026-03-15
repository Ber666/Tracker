# Tracker — Design Document

## Overview

A personal planning and journaling tool for daily tracking with weekly and monthly summaries. Uses GitHub as the database for cross-device sync. No backend, no third-party data services.

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
│  │  ├── weekly/                                              │  │
│  │  │   └── 2026-W08.json                                    │  │
│  │  ├── monthly/                                             │  │
│  │  │   └── 2026-02.json                                     │  │
│  │  └── config.json      (tag groups, Google Client ID)      │  │
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
│       ├── weekly.js       # Weekly view
│       └── monthly.js      # Monthly view
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
          "text": "Unplanned advisor meeting",
          "time": "14:30",
          "duration": "45m",
          "notes": ""
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
| `time` | string \| null | Time logged |
| `duration` | string \| null | Duration |
| `notes` | string | Notes |

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

### Weekly Summary (`data/weekly/2026-W11.json`)

```json
{
  "week": "2026-W11",
  "dateRange": "Mar 9–15, 2026",
  "highlights": "Key accomplishments this week...",
  "summary": "Reflection on the week...",
  "nextWeekFocus": "Focus for next week...",
  "sleep": { "avgDuration": "7h15m", "avgQuality": 3.8 },
  "exercise": { "daysActive": 4, "totalDuration": "3h" },
  "avgEnergy": 0,
  "avgMood": 3.6
}
```

### Monthly Summary (`data/monthly/2026-03.json`)

```json
{
  "month": "2026-03",
  "achievements": "What I achieved this month...",
  "reflections": "Reflection on the month...",
  "nextMonthGoals": "Goals for next month...",
  "sleepTrends": { "avgDuration": "7h", "avgQuality": 3.7 },
  "exerciseTrends": { "daysActive": 18, "totalDuration": "12h", "topActivities": [] }
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
│  [Daily]  [Weekly]  [Monthly]               [⟳ Sync] [⚙ Settings]│
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

### Weekly View

```
┌──────────────────────────────────────────────────────────────────┐
│  ◀ W10       [ Week 11: Mar 9–15 ]              W12 ▶           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  DAILY OVERVIEW                                                  │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐             │
│  │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Sat  │ Sun  │             │
│  │  9   │ 10   │ 11   │ 12   │ 13   │ 14   │ 15   │             │
│  │  😊  │  😐  │  😊  │  😊  │  ·   │  ·   │  ·   │             │
│  │  7h  │  6h  │  7h  │  8h  │  -   │  -   │  -   │             │
│  │ 3/4  │ 2/3  │ 4/4  │ 2/5  │      │      │      │             │
│  └──────┴──────┴──────┴──────┴──────┴──────┴──────┘             │
│  (click any day to jump to daily view)                           │
│                                                                  │
│  STATS                                                           │
│  Avg Sleep: 7h  Sleep Quality: 3.8  Exercise: 0/7               │
│  Avg Energy: -  Avg Mood: 3.6  Tasks Done: 11/16                 │
│                                                                  │
│  HIGHLIGHTS                                                      │
│  [markdown editor]                                               │
│                                                                  │
│  WEEKLY REFLECTION                                               │
│  [markdown editor]                                               │
│                                                                  │
│  NEXT WEEK FOCUS                                                 │
│  [markdown editor]                                               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Monthly View

```
┌──────────────────────────────────────────────────────────────────┐
│  ◀ Feb         [ March 2026 ]                    Apr ▶          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CALENDAR                                                        │
│  Mon Tue Wed Thu Fri Sat Sun                                     │
│   2   3   4   5   6   7   8    ← click any day → daily view     │
│   9  10  11  12  13  14  15    each day shows a plan             │
│  16  17  18  19  20  21  22    completion bar (green/amber/red)  │
│  23  24  25  26  27  28  29                                      │
│  30  31                                                          │
│                                                                  │
│  HEALTH TRENDS                                                   │
│  Avg Sleep: 6h45m  Sleep Quality: 3.7  Exercise Days: 18        │
│  Total Exercise: 12h  Avg Energy: -  Avg Mood: 3.6              │
│  Days Tracked: 22  Tasks Done: 89/120                            │
│                                                                  │
│  ACHIEVEMENTS                                                    │
│  [markdown editor]                                               │
│                                                                  │
│  REFLECTIONS                                                     │
│  [markdown editor]                                               │
│                                                                  │
│  NEXT MONTH GOALS                                                │
│  [markdown editor]                                               │
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
