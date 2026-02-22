// ========================================
// GitHub API Wrapper
// ========================================

class GitHubStorage {
  constructor(token, owner, repo) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    this.baseUrl = `https://api.github.com/repos/${owner}/${repo}/contents`;
    this.cache = new Map();
  }

  async request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `GitHub API error: ${response.status}`);
    }

    return response;
  }

  async getFile(path) {
    try {
      const response = await this.request(`${this.baseUrl}/${path}`);

      if (response.status === 404) {
        return null;
      }

      const data = await response.json();
      const content = JSON.parse(atob(data.content));

      // Cache the SHA for later updates
      this.cache.set(path, data.sha);

      return {
        content,
        sha: data.sha
      };
    } catch (error) {
      console.error(`Error fetching ${path}:`, error);
      throw error;
    }
  }

  async saveFile(path, content, message = null) {
    const sha = this.cache.get(path);

    const body = {
      message: message || `Update ${path}`,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))))
    };

    if (sha) {
      body.sha = sha;
    }

    try {
      const response = await this.request(`${this.baseUrl}/${path}`, {
        method: 'PUT',
        body: JSON.stringify(body)
      });

      const data = await response.json();

      // Update cached SHA
      if (data.content && data.content.sha) {
        this.cache.set(path, data.content.sha);
      }

      return data;
    } catch (error) {
      console.error(`Error saving ${path}:`, error);
      throw error;
    }
  }

  async deleteFile(path, message = null) {
    const sha = this.cache.get(path);

    if (!sha) {
      // Try to get the file first to get its SHA
      const file = await this.getFile(path);
      if (!file) return; // File doesn't exist
    }

    const body = {
      message: message || `Delete ${path}`,
      sha: this.cache.get(path)
    };

    try {
      await this.request(`${this.baseUrl}/${path}`, {
        method: 'DELETE',
        body: JSON.stringify(body)
      });

      this.cache.delete(path);
    } catch (error) {
      console.error(`Error deleting ${path}:`, error);
      throw error;
    }
  }

  async ensureDataStructure() {
    // Try to get config file to check if structure exists
    const config = await this.getFile('data/config.json');

    if (!config) {
      // Create initial structure
      await this.saveFile('data/config.json', {
        version: 1,
        createdAt: new Date().toISOString()
      }, 'Initialize data structure');
    }

    return true;
  }

  // Get monthly data file path
  getMonthlyDataPath(monthKey) {
    const [year, month] = monthKey.split('-');
    return `data/${year}/${month}.json`;
  }

  // Get weekly summary file path
  getWeeklySummaryPath(weekKey) {
    return `data/weekly/${weekKey}.json`;
  }

  // Get monthly summary file path
  getMonthlySummaryPath(monthKey) {
    return `data/monthly/${monthKey}.json`;
  }

  // Fetch monthly data (all daily entries for a month)
  async getMonthlyData(monthKey) {
    const path = this.getMonthlyDataPath(monthKey);
    const result = await this.getFile(path);

    if (!result) {
      return {
        month: monthKey,
        entries: {}
      };
    }

    return result.content;
  }

  // Save monthly data
  async saveMonthlyData(monthKey, data) {
    const path = this.getMonthlyDataPath(monthKey);
    return this.saveFile(path, data, `Update ${monthKey} entries`);
  }

  // Get weekly summary
  async getWeeklySummary(weekKey) {
    const path = this.getWeeklySummaryPath(weekKey);
    const result = await this.getFile(path);
    return result ? result.content : null;
  }

  // Save weekly summary
  async saveWeeklySummary(weekKey, data) {
    const path = this.getWeeklySummaryPath(weekKey);
    return this.saveFile(path, data, `Update week ${weekKey} summary`);
  }

  // Get monthly summary
  async getMonthlySummary(monthKey) {
    const path = this.getMonthlySummaryPath(monthKey);
    const result = await this.getFile(path);
    return result ? result.content : null;
  }

  // Save monthly summary
  async saveMonthlySummary(monthKey, data) {
    const path = this.getMonthlySummaryPath(monthKey);
    return this.saveFile(path, data, `Update ${monthKey} summary`);
  }

  // Validate connection
  async validateConnection() {
    try {
      const response = await this.request(
        `https://api.github.com/repos/${this.owner}/${this.repo}`
      );

      if (response.status === 404) {
        throw new Error('Repository not found. Please check the owner and repo name.');
      }

      const repo = await response.json();

      if (!repo.permissions || !repo.permissions.push) {
        throw new Error('You do not have write access to this repository.');
      }

      return true;
    } catch (error) {
      if (error.message.includes('Bad credentials')) {
        throw new Error('Invalid GitHub token. Please check your token.');
      }
      throw error;
    }
  }
}

// Export for use
window.GitHubStorage = GitHubStorage;
