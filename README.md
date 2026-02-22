# Tracker

A personal daily planning and journaling app with GitHub sync.

## Features

- **Daily Planning**: Track tasks (planned vs ad-hoc), sleep, exercise, energy, mood
- **Weekly/Monthly Views**: Aggregate stats and summaries
- **GitHub Sync**: Data stored in a private GitHub repo
- **AI Integration**: Polish text and generate summaries via Ollama
- **Cross-device**: Works on Mac (browser) and iPhone (PWA)

## Quick Start

### 1. Create a GitHub repo for your data

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
cd /Users/shibo/Documents/Repositories/Tracker

# Option A: Python (built-in)
python3 -m http.server 8080

# Option B: Node.js
npx serve .

# Option C: PHP
php -S localhost:8080
```

4. Open [http://localhost:8080](http://localhost:8080) in your browser
5. Enter your GitHub credentials

### 4. Deploy for iPhone access

**Option A: GitHub Pages**
1. Push this repo to GitHub
2. Go to Settings → Pages → Deploy from main branch
3. Access via `https://yourusername.github.io/tracker/`

**Option B: Vercel**
1. Connect repo to [vercel.com](https://vercel.com)
2. Deploy automatically
3. Access via your Vercel URLnono

### 5. Install as PWA on iPhone

1. Open the deployed URL in Safari
2. Tap Share → Add to Home Screen
3. Name it "Tracker"

## AI Features (Optional)

For AI-powered text polishing and summary generation:

1. Install [Ollama](https://ollama.ai)
2. Pull a small model:
   ```bash
   ollama pull qwen2.5:0.5b
   ```
3. Ollama runs on `localhost:11434` by default

Note: AI features only work on Mac (where Ollama runs). On iPhone, they're skipped.

## File Structure

```
Tracker/
├── index.html          # Main app
├── css/style.css       # Styles
├── js/
│   ├── app.js          # Main controller
│   ├── github.js       # GitHub API
│   ├── storage.js      # Local storage + sync
│   ├── ai.js           # Ollama integration
│   ├── utils.js        # Helpers
│   └── views/
│       ├── daily.js    # Daily view
│       ├── weekly.js   # Weekly view
│       └── monthly.js  # Monthly view
├── sw.js               # Service worker (offline)
├── manifest.json       # PWA manifest
├── icons/              # App icons
├── DESIGN.md           # Design document
└── README.md           # This file
```

## Data Storage

Your data is stored in your private GitHub repo:

```
data/
├── 2026/
│   ├── 01.json         # January daily entries
│   ├── 02.json         # February daily entries
│   └── ...
├── weekly/
│   └── 2026-W08.json   # Weekly summaries
├── monthly/
│   └── 2026-02.json    # Monthly summaries
└── config.json         # App config
```

## Security

- Data stored in your private GitHub repo
- GitHub token stored in browser localStorage (never sent elsewhere)
- All sync over HTTPS
- No backend server

## License

MIT
