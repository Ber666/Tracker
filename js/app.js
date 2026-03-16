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
    document.getElementById('settings-tag-group-add-btn').addEventListener('click', () => this.addTagGroup());
    document.getElementById('settings-tag-group-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.addTagGroup(); });

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
    StatsView.init();
    ProjectsView.init();

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

    // Pull latest data for current month and config
    const monthKey = Utils.formatMonthKey(new Date());
    try {
      await storage.pull(monthKey);
      await storage.pullConfig();
    } catch (error) {
      console.warn('Could not pull initial data:', error);
    }

    // Seed required tag groups if missing
    this.ensureDefaultTagGroups();

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
    } else if (viewName === 'stats') {
      StatsView.render();
    } else if (viewName === 'projects') {
      ProjectsView.render();
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
        // Refresh current view so pulled config changes (tags/projects) appear
        DailyView.loadDate(DailyView.currentDate);
      } else {
        statusText.textContent = result.message;
      }
    } catch (error) {
      console.error('Sync error:', error);
      statusText.textContent = 'Sync failed';
    } finally {
      button.disabled = false;
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="1 4 1 10 7 10"/>
          <polyline points="23 20 23 14 17 14"/>
          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
        </svg>
        <span>Sync</span>
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
    document.getElementById('settings-google-client-id').value = storage.getConfig().googleClientId || '';

    this.renderTagGroups();
    this.renderRefDataColors('tag-group');

    modal.classList.remove('hidden');
  },

  _CHIP_COLORS: ['#006A96','#C69214','#1BA87A','#C8323A','#7B61FF','#E67E22','#1ABC9C','#E91E8C'],

  renderRefDataColors(type) {
    const el = document.getElementById(`settings-${type}-colors`);
    if (!el) return;
    el.innerHTML = this._CHIP_COLORS.map((c, i) =>
      `<button type="button" class="color-swatch${i === 0 ? ' color-swatch-active' : ''}" data-color="${c}" style="background:${c}" title="${c}"></button>`
    ).join('');
    el.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        el.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('color-swatch-active'));
        sw.classList.add('color-swatch-active');
      });
    });
  },

  _genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  },

  // ---- Tag Groups ----

  addTagGroup() {
    const nameEl = document.getElementById('settings-tag-group-name');
    const name = nameEl.value.trim();
    if (!name) return;
    const colorsEl = document.getElementById('settings-tag-group-colors');
    const activeSwatch = colorsEl.querySelector('.color-swatch-active');
    const color = activeSwatch ? activeSwatch.dataset.color : this._CHIP_COLORS[0];
    const groups = storage.getTagGroups();
    groups.push({ id: this._genId(), name, color });
    storage.setTagGroups(groups);
    nameEl.value = '';
    this.renderTagGroups();
    this.renderRefDataColors('tag-group');
  },

  addTagToGroup(groupId) {
    const nameEl = document.getElementById(`tag-group-input-${groupId}`);
    const name = nameEl.value.trim();
    if (!name) return;
    const tags = storage.getTags();
    tags.push({ id: this._genId(), name, groupId });
    storage.setTags(tags);
    nameEl.value = '';
    this.renderTagGroups();
  },

  renderTagGroups() {
    const container = document.getElementById('settings-tag-groups');
    if (!container) return;
    const groups = storage.getTagGroups();
    const tags = storage.getTags();

    if (groups.length === 0) {
      container.innerHTML = '<span class="ref-data-empty">No tag groups yet — add one below</span>';
      return;
    }

    container.innerHTML = groups.map(group => {
      const groupTags = tags.filter(t => t.groupId === group.id);
      return `
        <div class="tag-group-section" data-group-id="${group.id}">
          <div class="tag-group-header">
            <span class="ref-data-swatch" style="background:${group.color}"></span>
            <input type="text" class="tag-group-name-input" data-id="${group.id}" value="${this.escapeHtml(group.name)}" title="Click to rename group">
            <button class="ref-data-delete tag-group-delete" data-id="${group.id}" title="Delete group">×</button>
          </div>
          <div class="tag-group-tags">
            ${groupTags.map(t => `
              <span class="tag-chip-item">
                <input type="text" class="tag-chip-name-input" data-id="${t.id}" value="${this.escapeHtml(t.name)}" title="Click to rename tag">
                <button class="tag-chip-delete" data-id="${t.id}" title="Remove">×</button>
              </span>`).join('')}
            <span class="tag-group-add-inline">
              <input type="text" id="tag-group-input-${group.id}" placeholder="add tag…" class="tag-group-input">
              <button class="tag-group-add-btn" data-group-id="${group.id}">+</button>
            </span>
          </div>
        </div>`;
    }).join('');

    // Rename group
    container.querySelectorAll('.tag-group-name-input').forEach(input => {
      input.addEventListener('change', () => {
        const name = input.value.trim();
        if (!name) { input.value = input.defaultValue; return; }
        const groups = storage.getTagGroups();
        const group = groups.find(g => g.id === input.dataset.id);
        if (group) { group.name = name; storage.setTagGroups(groups); }
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    });

    // Delete group
    container.querySelectorAll('.tag-group-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        storage.setTagGroups(storage.getTagGroups().filter(g => g.id !== id));
        storage.setTags(storage.getTags().filter(t => t.groupId !== id));
        this.renderTagGroups();
      });
    });

    // Rename tag
    container.querySelectorAll('.tag-chip-name-input').forEach(input => {
      input.addEventListener('change', () => {
        const name = input.value.trim();
        if (!name) { input.value = input.defaultValue; return; }
        const tags = storage.getTags();
        const tag = tags.find(t => t.id === input.dataset.id);
        if (tag) { tag.name = name; storage.setTags(tags); }
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    });

    // Delete tag
    container.querySelectorAll('.tag-chip-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        storage.setTags(storage.getTags().filter(t => t.id !== btn.dataset.id));
        this.renderTagGroups();
      });
    });

    // Add tag to group
    container.querySelectorAll('.tag-group-add-btn').forEach(btn => {
      btn.addEventListener('click', () => this.addTagToGroup(btn.dataset.groupId));
    });
    container.querySelectorAll('.tag-group-input').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.addTagToGroup(input.id.replace('tag-group-input-', ''));
      });
    });
  },

  ensureDefaultTagGroups() {
    const DEFAULTS = [
      {
        name: 'Meal', color: '#56B870',
        tags: ['Breakfast', 'Lunch', 'Dinner'],
      },
      {
        name: 'Exercise', color: '#E8654A',
        tags: ['Gym', 'Run', 'Walk', 'Swim', 'Bike', 'Yoga'],
      },
      {
        name: 'Misc', color: '#7B8CDE',
        tags: ['Nap'],
      },
      { name: 'Drinks', color: '#5B9BD5', tags: ['Coffee', 'Tea', 'Water', 'Juice', 'Alcohol'] },
      { name: 'Snacks', color: '#F0A500', tags: ['Snack'] },
    ];

    const groups = storage.getTagGroups();
    const tags = storage.getTags();
    const existingGroupNames = groups.map(g => g.name.toLowerCase());
    let groupsChanged = false;
    let tagsChanged = false;

    for (const def of DEFAULTS) {
      if (!existingGroupNames.includes(def.name.toLowerCase())) {
        const groupId = this._genId();
        groups.push({ id: groupId, name: def.name, color: def.color });
        groupsChanged = true;

        for (const tagName of def.tags) {
          tags.push({ id: this._genId(), name: tagName, groupId });
          tagsChanged = true;
        }
      } else if (def.tags.length > 0) {
        // Group exists — seed any missing tags
        const group = groups.find(g => g.name.toLowerCase() === def.name.toLowerCase());
        const existingTagNames = tags.filter(t => t.groupId === group.id).map(t => t.name.toLowerCase());
        for (const tagName of def.tags) {
          if (!existingTagNames.includes(tagName.toLowerCase())) {
            tags.push({ id: this._genId(), name: tagName, groupId: group.id });
            tagsChanged = true;
          }
        }
      }
    }

    if (groupsChanged) storage.setTagGroups(groups);
    if (tagsChanged) storage.setTags(tags);
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  closeSettings() {
    document.getElementById('settings-modal').classList.add('hidden');
  },

  async saveSettings() {
    const token = document.getElementById('settings-token').value.trim();
    const owner = document.getElementById('settings-owner').value.trim();
    const repo = document.getElementById('settings-repo').value.trim();


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

      const googleClientId = document.getElementById('settings-google-client-id').value.trim();
      const cfg = storage.getConfig();
      cfg.googleClientId = googleClientId;
      storage.setConfig(cfg);

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
