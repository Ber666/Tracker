// ========================================
// Local Storage + Sync Logic
// ========================================

class Storage {
  constructor() {
    this.github = null;
    this.localPrefix = 'tracker_';
    this.syncQueue = new Set();
    this.isSyncing = false;
  }

  // Initialize with GitHub storage
  init(github) {
    this.github = github;
  }

  // ========================================
  // Local Storage Operations
  // ========================================

  // Get from localStorage
  getLocal(key) {
    try {
      const item = localStorage.getItem(this.localPrefix + key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  }

  // Save to localStorage
  setLocal(key, value) {
    try {
      localStorage.setItem(this.localPrefix + key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error writing to localStorage:', error);
      return false;
    }
  }

  // Remove from localStorage
  removeLocal(key) {
    try {
      localStorage.removeItem(this.localPrefix + key);
      return true;
    } catch (error) {
      console.error('Error removing from localStorage:', error);
      return false;
    }
  }

  // ========================================
  // Config / Settings
  // ========================================

  getConfig() {
    return this.getLocal('config') || {};
  }

  setConfig(config) {
    return this.setLocal('config', config);
  }

  getGitHubConfig() {
    const config = this.getConfig();
    return {
      token: config.githubToken,
      owner: config.githubOwner,
      repo: config.githubRepo
    };
  }

  setGitHubConfig(token, owner, repo) {
    const config = this.getConfig();
    config.githubToken = token;
    config.githubOwner = owner;
    config.githubRepo = repo;
    return this.setConfig(config);
  }

  clearGitHubConfig() {
    const config = this.getConfig();
    delete config.githubToken;
    delete config.githubOwner;
    delete config.githubRepo;
    return this.setConfig(config);
  }

  getOllamaUrl() {
    const config = this.getConfig();
    return config.ollamaUrl || 'http://localhost:11434';
  }

  setOllamaUrl(url) {
    const config = this.getConfig();
    config.ollamaUrl = url;
    return this.setConfig(config);
  }

  // ========================================
  // Daily Entries
  // ========================================

  // Get local key for month data
  getMonthLocalKey(monthKey) {
    return `month_${monthKey}`;
  }

  // Get all entries for a month (local)
  getMonthData(monthKey) {
    return this.getLocal(this.getMonthLocalKey(monthKey)) || {
      month: monthKey,
      entries: {}
    };
  }

  // Save month data (local)
  setMonthData(monthKey, data) {
    data.updatedAt = new Date().toISOString();
    this.setLocal(this.getMonthLocalKey(monthKey), data);
    this.markForSync('month', monthKey);
  }

  // Get a specific day's entry
  getDayEntry(dateKey) {
    const monthKey = dateKey.substring(0, 7);
    const monthData = this.getMonthData(monthKey);
    return monthData.entries[dateKey] || Utils.createEmptyEntry(dateKey);
  }

  // Save a day's entry
  setDayEntry(dateKey, entry) {
    const monthKey = dateKey.substring(0, 7);
    const monthData = this.getMonthData(monthKey);

    entry.updatedAt = new Date().toISOString();
    monthData.entries[dateKey] = entry;

    this.setMonthData(monthKey, monthData);
  }

  // ========================================
  // Weekly Summaries
  // ========================================

  getWeekLocalKey(weekKey) {
    return `week_${weekKey}`;
  }

  getWeekSummary(weekKey, dateRange) {
    const local = this.getLocal(this.getWeekLocalKey(weekKey));
    return local || Utils.createEmptyWeeklySummary(weekKey, dateRange);
  }

  setWeekSummary(weekKey, data) {
    data.updatedAt = new Date().toISOString();
    this.setLocal(this.getWeekLocalKey(weekKey), data);
    this.markForSync('week', weekKey);
  }

  // ========================================
  // Monthly Summaries
  // ========================================

  getMonthlySummaryLocalKey(monthKey) {
    return `monthly_${monthKey}`;
  }

  getMonthlySummary(monthKey) {
    const local = this.getLocal(this.getMonthlySummaryLocalKey(monthKey));
    return local || Utils.createEmptyMonthlySummary(monthKey);
  }

  setMonthlySummary(monthKey, data) {
    data.updatedAt = new Date().toISOString();
    this.setLocal(this.getMonthlySummaryLocalKey(monthKey), data);
    this.markForSync('monthly', monthKey);
  }

  // ========================================
  // Sync Queue
  // ========================================

  markForSync(type, key) {
    this.syncQueue.add(`${type}:${key}`);
    this.saveSyncQueue();

    // Update pending indicator in UI
    if (window.App && App.updatePendingIndicator) {
      App.updatePendingIndicator();
    }
  }

  saveSyncQueue() {
    this.setLocal('syncQueue', Array.from(this.syncQueue));
  }

  loadSyncQueue() {
    const queue = this.getLocal('syncQueue') || [];
    this.syncQueue = new Set(queue);
  }

  getLastSync() {
    return this.getLocal('lastSync');
  }

  setLastSync(timestamp) {
    this.setLocal('lastSync', timestamp);
  }

  // ========================================
  // Sync Operations
  // ========================================

  async sync() {
    if (!this.github || this.isSyncing) {
      return { success: false, message: 'Sync already in progress or not connected' };
    }

    this.isSyncing = true;
    this.loadSyncQueue();

    try {
      // First, ensure data structure exists
      await this.github.ensureDataStructure();

      // Process sync queue
      const errors = [];

      for (const item of this.syncQueue) {
        const [type, key] = item.split(':');

        try {
          if (type === 'month') {
            await this.syncMonth(key);
          } else if (type === 'week') {
            await this.syncWeek(key);
          } else if (type === 'monthly') {
            await this.syncMonthlySummary(key);
          }

          this.syncQueue.delete(item);
        } catch (error) {
          console.error(`Error syncing ${item}:`, error);
          errors.push({ item, error: error.message });
        }
      }

      this.saveSyncQueue();
      this.setLastSync(new Date().toISOString());

      if (errors.length > 0) {
        return { success: false, message: `Sync completed with ${errors.length} errors`, errors };
      }

      return { success: true, message: 'Sync completed' };
    } catch (error) {
      console.error('Sync error:', error);
      return { success: false, message: error.message };
    } finally {
      this.isSyncing = false;
    }
  }

  async syncMonth(monthKey) {
    const localData = this.getMonthData(monthKey);
    const remoteData = await this.github.getMonthlyData(monthKey);

    // Merge: for each entry, keep the one with later updatedAt
    const merged = { ...remoteData };
    merged.entries = { ...remoteData.entries };

    for (const [dateKey, localEntry] of Object.entries(localData.entries)) {
      const remoteEntry = remoteData.entries[dateKey];

      if (!remoteEntry) {
        merged.entries[dateKey] = localEntry;
      } else {
        // Compare updatedAt timestamps
        const localTime = new Date(localEntry.updatedAt || 0).getTime();
        const remoteTime = new Date(remoteEntry.updatedAt || 0).getTime();

        if (localTime >= remoteTime) {
          merged.entries[dateKey] = localEntry;
        }
      }
    }

    // Save merged data
    await this.github.saveMonthlyData(monthKey, merged);

    // Update local with merged data
    this.setLocal(this.getMonthLocalKey(monthKey), merged);
  }

  async syncWeek(weekKey) {
    const localData = this.getLocal(this.getWeekLocalKey(weekKey));
    if (!localData) return;

    const remoteData = await this.github.getWeeklySummary(weekKey);

    // Simple merge: keep local if newer
    if (!remoteData || new Date(localData.updatedAt) >= new Date(remoteData.updatedAt || 0)) {
      await this.github.saveWeeklySummary(weekKey, localData);
    } else {
      // Remote is newer, update local
      this.setLocal(this.getWeekLocalKey(weekKey), remoteData);
    }
  }

  async syncMonthlySummary(monthKey) {
    const localData = this.getLocal(this.getMonthlySummaryLocalKey(monthKey));
    if (!localData) return;

    const remoteData = await this.github.getMonthlySummary(monthKey);

    // Simple merge: keep local if newer
    if (!remoteData || new Date(localData.updatedAt) >= new Date(remoteData.updatedAt || 0)) {
      await this.github.saveMonthlySummary(monthKey, localData);
    } else {
      // Remote is newer, update local
      this.setLocal(this.getMonthlySummaryLocalKey(monthKey), remoteData);
    }
  }

  // Pull latest data from GitHub
  async pull(monthKey) {
    if (!this.github) return;

    try {
      const remoteData = await this.github.getMonthlyData(monthKey);
      const localData = this.getMonthData(monthKey);

      // Merge remote into local (remote wins for newer entries)
      for (const [dateKey, remoteEntry] of Object.entries(remoteData.entries)) {
        const localEntry = localData.entries[dateKey];

        if (!localEntry) {
          localData.entries[dateKey] = remoteEntry;
        } else {
          const localTime = new Date(localEntry.updatedAt || 0).getTime();
          const remoteTime = new Date(remoteEntry.updatedAt || 0).getTime();

          if (remoteTime > localTime) {
            localData.entries[dateKey] = remoteEntry;
          }
        }
      }

      this.setLocal(this.getMonthLocalKey(monthKey), localData);
      return localData;
    } catch (error) {
      console.error('Pull error:', error);
      throw error;
    }
  }
}

// Export singleton
window.storage = new Storage();
