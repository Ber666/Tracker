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


  getProjects() {
    return this.getConfig().projects || [];
  }

  setProjects(projects) {
    const config = this.getConfig();
    config.projects = projects;
    config.configUpdatedAt = new Date().toISOString();
    this.setConfig(config);
    this.markForSync('config', 'main');
  }

  getTags() {
    return this.getConfig().tags || [];
  }

  setTags(tags) {
    const config = this.getConfig();
    config.tags = tags;
    config.configUpdatedAt = new Date().toISOString();
    this.setConfig(config);
    this.markForSync('config', 'main');
  }

  getTagGroups() {
    return this.getConfig().tagGroups || [];
  }

  setTagGroups(groups) {
    const config = this.getConfig();
    config.tagGroups = groups;
    config.configUpdatedAt = new Date().toISOString();
    this.setConfig(config);
    this.markForSync('config', 'main');
  }

  // Pull tagGroups/tags/projects from GitHub config.json into localStorage.
  // Strategy:
  //   - If remote updatedAt is newer → remote wins (full replace)
  //   - Otherwise → merge additions: any remote item missing from local is added
  //     (handles CLI changes made before the CLI started stamping updatedAt)
  async pullConfig() {
    if (!this.github) return;
    try {
      const result = await this.github.getFile('data/config.json');
      if (!result?.content) return;
      const remote = result.content;
      // Skip completely empty/old placeholder with no array fields
      if (!Array.isArray(remote.tagGroups) && !Array.isArray(remote.tags) && !Array.isArray(remote.projects)) return;

      const local = this.getConfig();
      const localTime = new Date(local.configUpdatedAt || 0).getTime();
      const remoteTime = new Date(remote.updatedAt || 0).getTime();

      if (remoteTime > localTime) {
        // Remote is strictly newer — apply fully
        if (Array.isArray(remote.tagGroups)) local.tagGroups = remote.tagGroups;
        if (Array.isArray(remote.tags))      local.tags      = remote.tags;
        if (Array.isArray(remote.projects))  local.projects  = remote.projects;
        local.configUpdatedAt = remote.updatedAt;
        this.setConfig(local);
      } else {
        // Timestamps equal or remote older — merge additions only
        // (picks up CLI-added items that didn't bump updatedAt)
        let changed = false;
        if (Array.isArray(remote.tagGroups)) {
          const localIds = new Set((local.tagGroups || []).map(g => g.id));
          const added = remote.tagGroups.filter(g => !localIds.has(g.id));
          if (added.length) { local.tagGroups = [...(local.tagGroups || []), ...added]; changed = true; }
        }
        if (Array.isArray(remote.tags)) {
          const localIds = new Set((local.tags || []).map(t => t.id));
          const added = remote.tags.filter(t => !localIds.has(t.id));
          if (added.length) { local.tags = [...(local.tags || []), ...added]; changed = true; }
        }
        if (Array.isArray(remote.projects)) {
          const localIds = new Set((local.projects || []).map(p => p.id));
          const added = remote.projects.filter(p => !localIds.has(p.id));
          if (added.length) { local.projects = [...(local.projects || []), ...added]; changed = true; }
        }
        if (changed) this.setConfig(local);
      }
    } catch (e) {
      console.warn('Could not pull config:', e.message);
    }
  }

  // Push tagGroups/tags/projects to GitHub config.json.
  async syncConfig() {
    const local = this.getConfig();
    const now = new Date().toISOString();
    local.configUpdatedAt = now;
    this.setConfig(local);
    await this.github.saveFile('data/config.json', {
      tagGroups: local.tagGroups || [],
      tags: local.tags || [],
      projects: local.projects || [],
      updatedAt: now,
    }, 'Update config');
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
    const entry = monthData.entries[dateKey] || Utils.createEmptyEntry(dateKey);

    // Migrate old schema (tasks[]) → planned[]/actual[]
    let needsSave = Utils.migrateEntrySchema(entry) && !!monthData.entries[dateKey];

    // Migrate actual[] → log[]
    if (entry.actual !== undefined) {
      if (!entry.log) entry.log = entry.actual;
      delete entry.actual;
      needsSave = !!monthData.entries[dateKey];
    }

    if (needsSave) {
      entry.updatedAt = new Date().toISOString();
      monthData.entries[dateKey] = entry;
      this.setLocal(this.getMonthLocalKey(monthKey), monthData);
    }

    return entry;
  }

  // Save a day's entry — only bumps updatedAt if content actually changed
  setDayEntry(dateKey, entry) {
    const monthKey = dateKey.substring(0, 7);
    const monthData = this.getMonthData(monthKey);

    const existing = monthData.entries[dateKey];
    const isDirty = !existing || this._contentChanged(existing, entry);

    if (isDirty) {
      entry.updatedAt = new Date().toISOString();
      monthData.entries[dateKey] = entry;
      this.setMonthData(monthKey, monthData);
    } else {
      // No real change — update local cache silently without queuing a sync
      monthData.entries[dateKey] = entry;
      this.setLocal(this.getMonthLocalKey(monthKey), monthData);
    }
  }

  // Compare two entries ignoring updatedAt itself
  _contentChanged(a, b) {
    const strip = obj => { const { updatedAt, ...rest } = obj; return rest; };
    return JSON.stringify(strip(a)) !== JSON.stringify(strip(b));
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

      // Always pull config so CLI/external changes are reflected immediately
      await this.pullConfig();

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
          } else if (type === 'config') {
            await this.syncConfig();
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

  // Merge two day entries, preserving all log/planned items from both sides.
  // The newer entry wins for scalar fields; arrays are union-merged by id.
  _mergeEntries(local, remote) {
    const localTime = new Date(local.updatedAt || 0).getTime();
    const remoteTime = new Date(remote.updatedAt || 0).getTime();
    const base = localTime >= remoteTime ? { ...local } : { ...remote };
    const other = localTime >= remoteTime ? remote : local;

    // Union-merge arrays by id so items added on either side are never lost
    for (const field of ['log', 'planned']) {
      const baseArr = base[field] || [];
      const otherArr = other[field] || [];
      const baseIds = new Set(baseArr.map(i => i.id));
      const added = otherArr.filter(i => !baseIds.has(i.id));
      if (added.length) base[field] = [...baseArr, ...added];
    }

    // Merge vitals arrays by id too
    if (base.vitals || other.vitals) {
      base.vitals = base.vitals || {};
      const otherVitals = other.vitals || {};
      for (const key of ['meals', 'drinks', 'snacks', 'exercise', 'naps']) {
        const baseArr = base.vitals[key] || [];
        const otherArr = otherVitals[key] || [];
        const baseIds = new Set(baseArr.map(i => i.id));
        const added = otherArr.filter(i => !baseIds.has(i.id));
        if (added.length) base.vitals[key] = [...baseArr, ...added];
      }
    }

    return base;
  }

  async syncMonth(monthKey) {
    const localData = this.getMonthData(monthKey);
    const remoteData = await this.github.getMonthlyData(monthKey);

    // Start with all remote entries, then merge in local
    const merged = { ...remoteData };
    merged.entries = { ...remoteData.entries };

    for (const [dateKey, localEntry] of Object.entries(localData.entries)) {
      const remoteEntry = remoteData.entries[dateKey];
      if (!remoteEntry) {
        merged.entries[dateKey] = localEntry;
      } else {
        merged.entries[dateKey] = this._mergeEntries(localEntry, remoteEntry);
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

  // Pull remote before a write and merge into local (including the day being written).
  // For the day being written: merge arrays by id so remote-only items are preserved.
  // Non-fatal: if offline or GitHub unavailable, write proceeds with local data.
  async pullBeforeWrite(dateKey) {
    if (!this.github) return;
    const monthKey = dateKey.substring(0, 7);
    try {
      const remoteData = await this.github.getMonthlyData(monthKey);
      if (!remoteData?.entries) return;

      const localData = this.getMonthData(monthKey);
      let changed = false;

      for (const [key, remoteEntry] of Object.entries(remoteData.entries)) {
        const localEntry = localData.entries[key];
        if (!localEntry) {
          localData.entries[key] = remoteEntry;
          changed = true;
        } else {
          const merged = this._mergeEntries(localEntry, remoteEntry);
          // Check if merge added anything
          const mergedJson = JSON.stringify(merged);
          if (mergedJson !== JSON.stringify(localEntry)) {
            localData.entries[key] = merged;
            // If this is the day being written, also update currentEntry in DailyView
            if (key === dateKey && window.DailyView?.currentEntry) {
              Object.assign(window.DailyView.currentEntry, merged);
            }
            changed = true;
          }
        }
      }

      if (changed) {
        this.setLocal(this.getMonthLocalKey(monthKey), localData);
      }
    } catch (e) {
      console.warn('[Tracker] pullBeforeWrite failed (proceeding with local write):', e.message);
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
