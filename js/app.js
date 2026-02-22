// ========================================
// Main App Controller
// ========================================

const App = {
  github: null,
  autoSyncInterval: null,

  async init() {
    // Check if already configured
    const config = storage.getGitHubConfig();

    if (config.token && config.owner && config.repo) {
      await this.connect(config.token, config.owner, config.repo);
    } else {
      this.showSetupScreen();
    }

    this.bindEvents();
  },

  bindEvents() {
    // Setup form
    document.getElementById('setup-submit').addEventListener('click', () => this.handleSetup());

    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => this.switchView(e.target.dataset.view));
    });

    // Sync button
    document.getElementById('sync-btn').addEventListener('click', () => this.sync());

    // Settings button
    document.getElementById('settings-btn').addEventListener('click', () => this.openSettings());

    // Settings modal
    document.getElementById('settings-save').addEventListener('click', () => this.saveSettings());
    document.getElementById('settings-cancel').addEventListener('click', () => this.closeSettings());
    document.getElementById('settings-logout').addEventListener('click', () => this.logout());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + S to sync
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.sync();
      }

      // Escape to close modals
      if (e.key === 'Escape') {
        DailyView.closeTaskModal();
        DailyView.closeExerciseModal();
        this.closeSettings();
      }
    });
  },

  showSetupScreen() {
    document.getElementById('setup-screen').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
  },

  showMainApp() {
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    // Initialize views
    DailyView.init();
    WeeklyView.init();
    MonthlyView.init();

    // Update last sync display
    this.updateLastSyncDisplay();
  },

  async handleSetup() {
    const token = document.getElementById('github-token').value.trim();
    const owner = document.getElementById('github-owner').value.trim();
    const repo = document.getElementById('github-repo').value.trim();

    if (!token || !owner || !repo) {
      alert('Please fill in all fields');
      return;
    }

    const button = document.getElementById('setup-submit');
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Connecting...';

    try {
      await this.connect(token, owner, repo);
      storage.setGitHubConfig(token, owner, repo);
    } catch (error) {
      alert(error.message);
      button.disabled = false;
      button.textContent = 'Connect';
    }
  },

  async connect(token, owner, repo) {
    this.github = new GitHubStorage(token, owner, repo);

    // Validate connection
    await this.github.validateConnection();

    // Initialize storage with GitHub
    storage.init(this.github);

    // Ensure data structure exists
    await this.github.ensureDataStructure();

    // Pull latest data for current month
    const monthKey = Utils.formatMonthKey(new Date());
    try {
      await storage.pull(monthKey);
    } catch (error) {
      console.warn('Could not pull initial data:', error);
    }

    // Show main app
    this.showMainApp();

    // Load sync queue and update indicator
    storage.loadSyncQueue();
    this.updatePendingIndicator();

    // Start auto-sync
    this.startAutoSync();

    // Check if there's pending sync from last session
    if (storage.getLocal('pendingSync')) {
      storage.removeLocal('pendingSync');
      setTimeout(() => this.sync(), 2000); // Sync after 2 seconds
    }
  },

  switchView(viewName) {
    // Update tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === viewName);
    });

    // Update views
    document.querySelectorAll('.view').forEach(view => {
      view.classList.toggle('active', view.id === `${viewName}-view`);
    });

    // Refresh view data
    if (viewName === 'daily') {
      DailyView.loadDate(DailyView.currentDate);
    } else if (viewName === 'weekly') {
      WeeklyView.loadWeek(WeeklyView.currentDate);
    } else if (viewName === 'monthly') {
      MonthlyView.loadMonth(MonthlyView.currentDate);
    }
  },

  async sync() {
    const button = document.getElementById('sync-btn');
    const statusText = document.getElementById('status-text');

    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span>';
    statusText.textContent = 'Syncing...';

    try {
      const result = await storage.sync();

      if (result.success) {
        statusText.textContent = 'Synced successfully';
        this.updateLastSyncDisplay();
        this.updatePendingIndicator();
      } else {
        statusText.textContent = result.message;
      }
    } catch (error) {
      console.error('Sync error:', error);
      statusText.textContent = 'Sync failed';
    } finally {
      button.disabled = false;
      button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c-1.657 0-3-4.03-3-9s1.343-9 3-9m0 18c1.657 0 3-4.03 3-9s-1.343-9-3-9"/>
        </svg>
      `;
    }
  },

  startAutoSync() {
    // Sync every 30 minutes (reduced from 5 min to avoid too many commits)
    this.autoSyncInterval = setInterval(() => {
      this.sync();
    }, 30 * 60 * 1000);

    // Sync when user leaves the page
    window.addEventListener('beforeunload', () => {
      this.syncBeforeUnload();
    });

    // Sync when page becomes hidden (mobile: switching apps)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.syncBeforeUnload();
      }
    });
  },

  syncBeforeUnload() {
    // Use sendBeacon for reliable sync on page close
    if (storage.syncQueue.size === 0) return;

    // For now, just mark that we need to sync on next load
    storage.setLocal('pendingSync', true);
  },

  stopAutoSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
  },

  updateStatus(message) {
    const statusText = document.getElementById('status-text');
    statusText.textContent = message;

    // Show pending indicator if there are unsynced changes
    this.updatePendingIndicator();
  },

  updatePendingIndicator() {
    const syncBtn = document.getElementById('sync-btn');
    const hasPending = storage.syncQueue && storage.syncQueue.size > 0;

    if (hasPending) {
      syncBtn.classList.add('has-pending');
      syncBtn.title = `Sync with GitHub (${storage.syncQueue.size} pending)`;
    } else {
      syncBtn.classList.remove('has-pending');
      syncBtn.title = 'Sync with GitHub';
    }
  },

  updateLastSyncDisplay() {
    const lastSync = storage.getLastSync();
    const el = document.getElementById('last-sync');

    if (lastSync) {
      const date = new Date(lastSync);
      const now = new Date();
      const diff = now - date;

      let text;
      if (diff < 60000) {
        text = 'Just now';
      } else if (diff < 3600000) {
        text = `${Math.floor(diff / 60000)}m ago`;
      } else if (diff < 86400000) {
        text = `${Math.floor(diff / 3600000)}h ago`;
      } else {
        text = date.toLocaleDateString();
      }

      el.textContent = `Last sync: ${text}`;
    } else {
      el.textContent = 'Never synced';
    }
  },

  openSettings() {
    const modal = document.getElementById('settings-modal');
    const config = storage.getGitHubConfig();

    document.getElementById('settings-token').value = config.token || '';
    document.getElementById('settings-owner').value = config.owner || '';
    document.getElementById('settings-repo').value = config.repo || '';
    document.getElementById('settings-ollama').value = storage.getOllamaUrl();

    modal.classList.remove('hidden');
  },

  closeSettings() {
    document.getElementById('settings-modal').classList.add('hidden');
  },

  async saveSettings() {
    const token = document.getElementById('settings-token').value.trim();
    const owner = document.getElementById('settings-owner').value.trim();
    const repo = document.getElementById('settings-repo').value.trim();
    const ollamaUrl = document.getElementById('settings-ollama').value.trim();

    if (!token || !owner || !repo) {
      alert('Please fill in GitHub credentials');
      return;
    }

    try {
      // Validate new connection if credentials changed
      const currentConfig = storage.getGitHubConfig();
      if (token !== currentConfig.token || owner !== currentConfig.owner || repo !== currentConfig.repo) {
        const newGithub = new GitHubStorage(token, owner, repo);
        await newGithub.validateConnection();

        this.github = newGithub;
        storage.init(this.github);
      }

      storage.setGitHubConfig(token, owner, repo);
      storage.setOllamaUrl(ollamaUrl || 'http://localhost:11434');

      this.closeSettings();
      this.updateStatus('Settings saved');
    } catch (error) {
      alert(error.message);
    }
  },

  logout() {
    if (confirm('Are you sure you want to logout? Your local data will be preserved.')) {
      this.stopAutoSync();
      storage.clearGitHubConfig();
      this.github = null;
      this.closeSettings();
      this.showSetupScreen();
    }
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(registration => {
        console.log('SW registered:', registration.scope);
      })
      .catch(error => {
        console.log('SW registration failed:', error);
      });
  });
}

// Export for global access
window.App = App;
