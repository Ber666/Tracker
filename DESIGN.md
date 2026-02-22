# Daily Planner with GitHub Storage - Design Document

## Overview

A personal planning and journaling tool that tracks daily work, health, and mental state with weekly/monthly summaries. Uses GitHub as the database for cross-device sync.

```

┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Repo                             │
│                    (Private, your data)                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  data/                                                     │  │
│  │  ├── 2026/                                                 │  │
│  │  │   ├── 01.json      (all January daily entries)         │  │
│  │  │   ├── 02.json      (all February daily entries)        │  │
│  │  │   └── ...                                               │  │
│  │  ├── weekly/                                               │  │
│  │  │   └── 2026-W08.json                                     │  │
│  │  ├── monthly/                                              │  │
│  │  │   └── 2026-02.json                                      │  │
│  │  └── config.json      (settings, templates)                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ GitHub API
                              │ (read/write JSON)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Static Web App                             │
│              (Hosted on GitHub Pages / Vercel)                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  - Vanilla JS (no build step needed)                    │    │
│  │  - localStorage for offline + fast access               │    │
│  │  - Service Worker for PWA                               │    │
│  │  - GitHub OAuth or PAT for auth                         │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
            │                                   │
            ▼                                   ▼
    ┌───────────────────┐               ┌───────────────────┐
    │  Mac Browser      │               │ iPhone Safari     │
    │  + Ollama AI      │               │  (PWA mode)       │
    └───────────────────┘               └───────────────────┘
```

---

## Data Schema

### Daily Entry (`data/2026/02.json`)

```json
{
  "month": "2026-02",
  "entries": {
    "2026-02-21": {
      "tasks": [
        {
          "id": "t1",
          "text": "Finish project proposal",
          "planned": true,
          "expectedTime": "2h",
          "progress": "done",
          "comment": "Sent to team for review",
          "createdAt": "2026-02-21T08:00:00Z"
        },
        {
          "id": "t2",
          "text": "Review PR #42",
          "planned": true,
          "expectedTime": "30m",
          "progress": "half-done",
          "comment": "Left comments, waiting for response",
          "createdAt": "2026-02-21T08:00:00Z"
        },
        {
          "id": "t3",
          "text": "Fix urgent production bug",
          "planned": false,
          "expectedTime": null,
          "progress": "done",
          "comment": "Hotfix deployed",
          "createdAt": "2026-02-21T14:30:00Z"
        }
      ],
      "work": "Completed proposal draft, sent for review...",
      "sleep": {
        "bedTime": "23:30",
        "wakeTime": "07:00",
        "quality": 8,
        "comment": "Woke up once around 3am"
      },
      "exercise": [
        {
          "name": "Gym",
          "duration": "45m",
          "intensity": "medium",
          "comment": "Upper body day"
        },
        {
          "name": "Walking",
          "duration": "20m",
          "intensity": "low",
          "comment": ""
        }
      ],
      "energy": 7,
      "mental": {
        "mood": 8,
        "notes": "Feeling productive today"
      },
      "freeform": "",
      "updatedAt": "2026-02-21T18:30:00Z"
    },
    "2026-02-20": { }
  }
}
```

#### Task Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (e.g., "t1", uuid) |
| `text` | string | Task description |
| `planned` | boolean | `true` = morning plan, `false` = added during day |
| `scheduledTime` | string \| null | Scheduled time on timeline ("09:00", "14:30") |
| `expectedTime` | string \| null | Duration estimate ("30m", "2h", etc.) |
| `progress` | enum | `"not-started"` \| `"half-done"` \| `"done"` |
| `comment` | string | Optional notes/outcome |
| `createdAt` | ISO string | When task was created |

#### Sleep Schema

| Field | Type | Description |
|-------|------|-------------|
| `bedTime` | string | Time went to bed ("23:30") |
| `wakeTime` | string | Time woke up ("07:00") |
| `quality` | number | Self-evaluated 1-10 |
| `comment` | string | Optional notes |

#### Exercise Schema (array of items)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Activity name ("Gym", "Basketball", "Running") |
| `duration` | string | Duration ("45m", "1h") |
| `intensity` | enum | `"low"` \| `"medium"` \| `"high"` |
| `comment` | string | Optional notes |

### Weekly Summary (`data/weekly/2026-W08.json`)

```json
{
  "week": "2026-W08",
  "dateRange": "2026-02-17 to 2026-02-23",
  "summary": "Focused on project proposal...",
  "highlights": [
    "Completed Q1 planning",
    "Shipped feature X"
  ],
  "sleep": {
    "avgDuration": "6.5h",
    "avgQuality": 7.2,
    "avgBedTime": "23:30",
    "avgWakeTime": "07:00"
  },
  "exercise": {
    "daysActive": 4,
    "totalDuration": "4.5h",
    "breakdown": {
      "Gym": 3,
      "Running": 2
    }
  },
  "avgEnergy": 6.8,
  "avgMood": 7.2,
  "learnings": "",
  "nextWeekFocus": "",
  "aiGenerated": "...",
  "updatedAt": "2026-02-23T20:00:00Z"
}
```

### Monthly Summary (`data/monthly/2026-02.json`)

```json
{
  "month": "2026-02",
  "summary": "",
  "achievements": [],
  "sleepTrends": {
    "avgDuration": "6.8h",
    "avgQuality": 7.5,
    "qualityTrend": "stable",
    "avgBedTime": "23:20"
  },
  "exerciseTrends": {
    "daysActive": 18,
    "totalDuration": "15h",
    "topActivities": ["Gym", "Running", "Basketball"],
    "trend": "improving"
  },
  "energyTrend": "improving",
  "moodTrend": "stable",
  "reflections": "",
  "nextMonthGoals": [],
  "aiGenerated": "",
  "updatedAt": "2026-02-28T20:00:00Z"
}
```

---

## File Structure (Web App)

```
Tracker/
├── index.html              # Main app shell
├── css/
│   └── style.css           # Simple, responsive styles
├── js/
│   ├── app.js              # Main app logic
│   ├── github.js           # GitHub API wrapper
│   ├── storage.js          # localStorage + sync logic
│   ├── views/
│   │   ├── daily.js        # Daily view component
│   │   ├── weekly.js       # Weekly view component
│   │   └── monthly.js      # Monthly view component
│   ├── ai.js               # AI integration (Ollama/API)
│   └── utils.js            # Date helpers, etc.
├── sw.js                   # Service worker for offline
├── manifest.json           # PWA manifest
└── DESIGN.md               # This file
```

---

## Authentication Flow

### Option A: Personal Access Token (Simpler) - Recommended

```
┌──────────────────────────────────────────────────────────────┐
│  First Visit:                                                │
│  1. App prompts for GitHub PAT                               │
│  2. User creates PAT at github.com/settings/tokens           │
│     (scope: repo)                                            │
│  3. App stores PAT in localStorage                           │
│  4. App uses PAT for all GitHub API calls                    │
└──────────────────────────────────────────────────────────────┘
```

### Option B: GitHub OAuth (More Secure)

```
┌──────────────────────────────────────────────────────────────┐
│  1. User clicks "Login with GitHub"                          │
│  2. Redirect to GitHub OAuth                                 │
│  3. GitHub redirects back with code                          │
│  4. Exchange code for token (needs small backend OR          │
│     use a service like Netlify Functions)                    │
│  5. Store token, use for API calls                           │
└──────────────────────────────────────────────────────────────┘
```

---

## Sync Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Flow                                │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   User      │───▶│ localStorage│───▶│   GitHub    │     │
│  │   Edits     │    │  (instant)  │    │  (on sync)  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                            │                   │            │
│                            │◀──────────────────┘            │
│                         On app load:                        │
│                         fetch latest from GitHub            │
│                         merge with local                    │
└─────────────────────────────────────────────────────────────┘
```

### Sync Rules

1. **On load**: Fetch from GitHub, merge with localStorage (newer wins by `updatedAt`)
2. **On edit**: Save to localStorage immediately
3. **On explicit save**: Push to GitHub
4. **Auto-save**: Every 5 minutes if there are local changes
5. **Conflict**: Compare `updatedAt`, keep newer, optionally show diff

---

## UI Wireframes

### Daily View

```
┌─────────────────────────────────────────────────────────────┐
│  ◀ Feb 20    [  February 21, 2026  ]    Feb 22 ▶   [Today] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TASKS                                          [+ Add]     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ PLANNED (Morning)                                   │   │
│  │ ├─ ● Finish project proposal      ~2h    [Done    ▾]│   │
│  │ │    └─ "Sent to team for review"                   │   │
│  │ └─ ◐ Review PR #42                ~30m   [Half    ▾]│   │
│  │      └─ "Left comments, waiting"                    │   │
│  │                                                     │   │
│  │ ADDED DURING DAY                                    │   │
│  │ └─ ● Fix urgent production bug          [Done    ▾]│   │
│  │      └─ "Hotfix deployed"                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  SUMMARY                                                    │
│  Planned: 2 | Done: 2 | Half: 1 | Unplanned: 1             │
│                                                             │
│  WORK NOTES                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Completed proposal draft, sent to team for review.  │   │
│  │ Had productive meeting with design team.            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  SLEEP                                                      │
│  Bed: [23:30]  Wake: [07:00]  (7.5h)  Quality: [●●●●●●●●○○] │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Woke up once around 3am                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  EXERCISE                                       [+ Add]     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Gym          45m   [Medium ▾]  "Upper body day"   │   │
│  │ • Walking      20m   [Low    ▾]                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ENERGY                                                     │
│  [●●●●●●●○○○] 7/10                                          │
│                                                             │
│  MENTAL                                                     │
│  Mood: [●●●●●●●●○○]                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Feeling productive. Good focus today.               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Daily]  [Weekly]  [Monthly]           [⟳ Sync] [⚙ Settings]│
└─────────────────────────────────────────────────────────────┘

Progress indicators:  ○ = not-started  |  ◐ = half-done  |  ● = done
```

### Daily Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  MORNING PLANNING                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. Open app, navigate to today                      │   │
│  │ 2. Add tasks with [+ Add] → marked as planned=true  │   │
│  │ 3. Set expected time estimates                      │   │
│  │ 4. All tasks start as "not-started"                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  DURING THE DAY                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. Update progress as you work (not-started → done) │   │
│  │ 2. Add new tasks that come up → marked planned=false│   │
│  │ 3. Add comments to tasks as needed                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  EVENING REVIEW                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. See summary: planned vs actual, completion rate  │   │
│  │ 2. Fill in health metrics (sleep, exercise, energy) │   │
│  │ 3. Record mood and mental notes                     │   │
│  │ 4. Write work notes / reflections                   │   │
│  │ 5. [AI Polish] to clean up summaries                │   │
│  │ 6. Sync to GitHub                                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Weekly View

```
┌─────────────────────────────────────────────────────────────┐
│  ◀ W07       [  Week 8: Feb 17-23  ]         W09 ▶         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DAILY OVERVIEW                                             │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐               │
│  │ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │ Sun │               │
│  │ 😊  │ 😐  │ 😊  │ 😊  │  •  │  •  │  •  │               │
│  │ 7h  │ 6h  │ 7h  │ 8h  │  -  │  -  │  -  │               │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┘               │
│                                                             │
│  HIGHLIGHTS                              [✨ Generate from AI]│
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Completed Q1 planning                             │   │
│  │ • Shipped feature X                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  SUMMARY                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Productive week focused on...                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  STATS                                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Sleep:    Avg 7.2h | Avg Quality 7.5 | Avg Bed 23:15│   │
│  │ Exercise: 4/7 days | 3.5h total | Mostly Medium     │   │
│  │ Energy:   Avg 6.8  | Mood: Avg 7.2                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Daily]  [Weekly]  [Monthly]           [⟳ Sync] [⚙ Settings]│
└─────────────────────────────────────────────────────────────┘
```

### Monthly View

```
┌─────────────────────────────────────────────────────────────┐
│  ◀ Jan        [  February 2026  ]              Mar ▶       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CALENDAR HEATMAP                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │     Mon Tue Wed Thu Fri Sat Sun                     │   │
│  │ W5   ▪   ▪   ▪   ▪   ▪   ○   ○                      │   │
│  │ W6   ▪   ▪   ▪   ▪   ▪   ○   ○                      │   │
│  │ W7   ▪   ▪   ▪   ▪   ▪   ○   ○                      │   │
│  │ W8   ▪   ▪   ▪   •   •   •   •                      │   │
│  └─────────────────────────────────────────────────────┘   │
│  ▪ = entry exists, ○ = no entry, • = future                │
│                                                             │
│  ACHIEVEMENTS                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Launched new feature                              │   │
│  │ • Maintained exercise streak                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  HEALTH TRENDS                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Sleep:    6.8h avg | Quality 7.5 (→) | Bed ~23:20   │   │
│  │ Exercise: 18 days  | 15h total | Top: Gym, Running  │   │
│  │ Energy:   7.2 (↑)  | Mood: 7.1 (→)                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  REFLECTIONS                              [✨ Generate from AI]│
│  ┌─────────────────────────────────────────────────────┐   │
│  │ This month I focused on...                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Daily]  [Weekly]  [Monthly]           [⟳ Sync] [⚙ Settings]│
└─────────────────────────────────────────────────────────────┘
```

---

## AI Integration

### On Mac (Local via Ollama)

```javascript
// ai.js
async function polishWithOllama(text) {
  // Ollama runs on localhost:11434 by default
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      model: 'qwen2.5:0.5b',
      prompt: `Polish and format this journal entry concisely:\n\n${text}`,
      stream: false
    })
  });
  const data = await response.json();
  return data.response;
}
```

### On iPhone (Fallback Options)

1. **Skip AI** - Just manual editing
2. **Free API** - Groq free tier (fast, limited)
3. **Cheap API** - OpenAI/Anthropic with low usage

```javascript
// Detect environment and choose AI backend
function getAIBackend() {
  // Try Ollama first (works on Mac)
  return fetch('http://localhost:11434/api/tags')
    .then(() => 'ollama')
    .catch(() => 'api'); // Fallback to cloud API
}
```

---

## GitHub API Wrapper

```javascript
// github.js
class GitHubStorage {
  constructor(token, repo, owner) {
    this.token = token;
    this.repo = repo;
    this.owner = owner;
    this.baseUrl = `https://api.github.com/repos/${owner}/${repo}/contents`;
  }

  async getFile(path) {
    const response = await fetch(`${this.baseUrl}/${path}`, {
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (response.status === 404) return null;

    const data = await response.json();
    return {
      content: JSON.parse(atob(data.content)),
      sha: data.sha  // Needed for updates
    };
  }

  async saveFile(path, content, sha = null) {
    const body = {
      message: `Update ${path}`,
      content: btoa(JSON.stringify(content, null, 2)),
    };
    if (sha) body.sha = sha;  // Required for updates

    const response = await fetch(`${this.baseUrl}/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(body)
    });

    return response.json();
  }
}
```

---

## PWA Setup

### manifest.json

```json
{
  "name": "Daily Journal",
  "short_name": "Journal",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4a90d9",
  "icons": [
    {
      "src": "icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Service Worker (sw.js)

```javascript
const CACHE_NAME = 'journal-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/github.js',
  '/js/storage.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
```

---

## Setup Steps

1. **Create private GitHub repo**: `my-journal-data`

2. **Create repo structure**:
   ```
   data/
   └── config.json   (empty: {})
   ```

3. **Generate Personal Access Token**:
   - Go to github.com/settings/tokens
   - Generate new token (classic)
   - Scope: `repo` (full control)
   - Save the token securely

4. **Deploy the web app**:
   - GitHub Pages: Settings → Pages → Deploy from main branch
   - OR Vercel: vercel.com → Import repo → Deploy

5. **Open the app URL, enter your PAT and repo info**

6. **On iPhone**: Open in Safari → Share → Add to Home Screen

---

## Security Notes

- ✓ Private repo - only you can see data
- ✓ PAT stored in localStorage - stays on device
- ✓ HTTPS only - encrypted in transit
- ✓ No backend server - no attack surface

- ⚠ Don't commit PAT to any repo
- ⚠ Revoke and regenerate PAT if device is lost
- ⚠ Consider OAuth if sharing with family

---

## Future Enhancements

- [ ] Export to markdown/PDF
- [ ] Search across all entries
- [ ] Tags/categories
- [ ] Habit tracking
- [ ] Data visualization (charts)
- [ ] Multiple journals (work/personal)
