import { Buffer } from 'node:buffer';

export class GitHub {
  constructor(token, repo) {
    const [owner, name] = repo.split('/');
    this.token = token;
    this.owner = owner;
    this.repo = name;
    this.base = `https://api.github.com/repos/${owner}/${name}/contents`;
    this.shaCache = new Map();
  }

  async _req(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `token ${this.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!res.ok && res.status !== 404) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub API ${res.status}`);
    }
    return res;
  }

  async getFile(path) {
    const res = await this._req(`${this.base}/${path}`);
    if (res.status === 404) return null;
    const data = await res.json();
    this.shaCache.set(path, data.sha);
    const content = JSON.parse(
      Buffer.from(data.content.replace(/\s/g, ''), 'base64').toString('utf8')
    );
    return { content, sha: data.sha };
  }

  async saveFile(path, content, message) {
    const sha = this.shaCache.get(path);
    const body = {
      message: message || `Update ${path}`,
      content: Buffer.from(JSON.stringify(content, null, 2), 'utf8').toString('base64'),
    };
    if (sha) body.sha = sha;

    const res = await this._req(`${this.base}/${path}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.content?.sha) this.shaCache.set(path, data.content.sha);
    return data;
  }

  async validate() {
    const res = await this._req(`https://api.github.com/repos/${this.owner}/${this.repo}`);
    if (res.status === 404) throw new Error('Repository not found.');
    const repo = await res.json();
    if (!repo.permissions?.push) throw new Error('No write access to repository.');
    return true;
  }
}
