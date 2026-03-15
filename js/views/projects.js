// ========================================
// Projects View
// ========================================

const ProjectsView = {
  editingId: null,
  expandedId: null,

  init() {
    this.bindStaticEvents();
    this.render();
  },

  bindStaticEvents() {
    document.getElementById('add-project-view-btn').addEventListener('click', () => this.showNewForm());
    document.getElementById('new-project-save').addEventListener('click', () => this.saveNewProject());
    document.getElementById('new-project-cancel').addEventListener('click', () => this.hideNewForm());
  },

  render() {
    this.renderProjectsList();
  },

  // Scan last 90 days across at most 3 month files
  getProjectStats(projectId) {
    const today = new Date();
    const monthCache = {};
    const getMonthEntries = (monthKey) => {
      if (!monthCache[monthKey]) monthCache[monthKey] = storage.getMonthData(monthKey).entries || {};
      return monthCache[monthKey];
    };

    let totalTasks = 0, doneTasks = 0, lastActiveKey = null;
    const recentTasks = [];

    for (let i = 0; i < 90; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = Utils.formatDateKey(d);
      const monthKey = dateKey.substring(0, 7);
      const entries = getMonthEntries(monthKey);
      const entry = entries[dateKey];
      if (!entry) continue;

      [...(entry.planned || []), ...(entry.log || [])].forEach(t => {
        if (!(t.projectIds || []).includes(projectId)) return;
        totalTasks++;
        if (t.status === 'done') doneTasks++;
        if (!lastActiveKey || dateKey > lastActiveKey) lastActiveKey = dateKey;
        recentTasks.push({ ...t, dateKey });
      });
    }

    recentTasks.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    return { totalTasks, doneTasks, lastActiveKey, recentTasks: recentTasks.slice(0, 15) };
  },

  renderProjectsList() {
    const container = document.getElementById('projects-view-list');
    const projects = storage.getProjects();

    if (projects.length === 0) {
      container.innerHTML = `<div class="projects-empty">
        <p>No projects yet.</p>
        <p>Create a project to group tasks and track progress across days.</p>
      </div>`;
      return;
    }

    container.innerHTML = projects.map(p => this.renderProjectCard(p)).join('');
    this.bindCardEvents();
  },

  renderProjectCard(project) {
    const stats = this.getProjectStats(project.id);
    const pct = stats.totalTasks > 0 ? Math.round((stats.doneTasks / stats.totalTasks) * 100) : 0;
    const isExpanded = this.expandedId === project.id;
    const isEditing = this.editingId === project.id;

    if (isEditing) {
      const colorSwatches = App._CHIP_COLORS.map(c =>
        `<button type="button" class="color-swatch${c === project.color ? ' color-swatch-active' : ''}" data-color="${c}" style="background:${c}"></button>`
      ).join('');
      return `<div class="project-card" data-id="${project.id}">
        <div class="project-card-edit">
          <div class="project-edit-name-row">
            <div class="color-swatches project-edit-colors" id="edit-colors-${project.id}">${colorSwatches}</div>
            <input type="text" class="project-edit-name-input" data-id="${project.id}" value="${App.escapeHtml(project.name)}" maxlength="30">
          </div>
          <textarea class="project-edit-desc-input" data-id="${project.id}" placeholder="Description or goals…" rows="2">${App.escapeHtml(project.description || '')}</textarea>
          <div class="project-edit-actions">
            <button class="btn btn-primary btn-small project-edit-save" data-id="${project.id}">Save</button>
            <button class="btn-link project-edit-cancel" data-id="${project.id}">Cancel</button>
            <button class="btn btn-danger btn-small project-delete" data-id="${project.id}">Delete</button>
          </div>
        </div>
      </div>`;
    }

    const taskRows = isExpanded
      ? (stats.recentTasks.length > 0
          ? stats.recentTasks.map(t => {
              const icon = t.status === 'done' ? '●' : t.status === 'in-progress' ? '◑' : '○';
              const color = t.status === 'done' ? '#1BA87A' : t.status === 'in-progress' ? '#D4870A' : '#B4C8DA';
              return `<div class="project-task-row">
                <span style="color:${color};font-size:10px;flex-shrink:0">${icon}</span>
                <span class="project-task-date">${t.dateKey.slice(5)}</span>
                <span class="project-task-text">${App.escapeHtml(t.text)}</span>
              </div>`;
            }).join('')
          : '<span class="ref-data-empty">No tasks in the last 90 days</span>')
      : '';

    return `<div class="project-card" data-id="${project.id}" style="border-left-color:${project.color}">
      <div class="project-card-header">
        <span class="project-card-name" style="color:${project.color}">${App.escapeHtml(project.name)}</span>
        <div class="project-card-actions">
          <button class="btn-link project-expand-btn" data-id="${project.id}">${isExpanded ? '▲ Hide' : '▼ Tasks'}</button>
          <button class="btn-link project-edit-btn" data-id="${project.id}">Edit</button>
        </div>
      </div>
      ${project.description ? `<div class="project-card-desc">${App.escapeHtml(project.description)}</div>` : ''}
      <div class="project-card-stats">
        <span>${stats.totalTasks} tasks · ${pct}% done · last 90 days</span>
        <span>${stats.lastActiveKey ? 'Last: ' + stats.lastActiveKey.slice(5) : 'No activity'}</span>
      </div>
      <div class="project-completion-bar">
        <div class="project-completion-done" style="width:${pct}%"></div>
      </div>
      ${isExpanded ? `<div class="project-tasks-list">${taskRows}</div>` : ''}
    </div>`;
  },

  bindCardEvents() {
    const container = document.getElementById('projects-view-list');

    container.querySelectorAll('.project-expand-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        this.expandedId = this.expandedId === id ? null : id;
        this.renderProjectsList();
      });
    });

    container.querySelectorAll('.project-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.editingId = btn.dataset.id;
        this.renderProjectsList();
        // Wire color swatches in edit form
        const swEl = document.getElementById(`edit-colors-${btn.dataset.id}`);
        if (swEl) {
          swEl.querySelectorAll('.color-swatch').forEach(sw => {
            sw.addEventListener('click', () => {
              swEl.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('color-swatch-active'));
              sw.classList.add('color-swatch-active');
            });
          });
        }
      });
    });

    container.querySelectorAll('.project-edit-save').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const projects = storage.getProjects();
        const project = projects.find(p => p.id === id);
        if (!project) return;

        const nameEl = container.querySelector(`.project-edit-name-input[data-id="${id}"]`);
        const descEl = container.querySelector(`.project-edit-desc-input[data-id="${id}"]`);
        const swEl = document.getElementById(`edit-colors-${id}`);
        const activeSwatch = swEl?.querySelector('.color-swatch-active');

        const name = nameEl?.value.trim();
        if (name) project.name = name;
        if (activeSwatch) project.color = activeSwatch.dataset.color;
        project.description = descEl?.value.trim() || '';

        storage.setProjects(projects);
        this.editingId = null;
        this.renderProjectsList();
      });
    });

    container.querySelectorAll('.project-edit-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        this.editingId = null;
        this.renderProjectsList();
      });
    });

    container.querySelectorAll('.project-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Delete this project? Tasks will keep their data but lose the project label.')) return;
        const id = btn.dataset.id;
        storage.setProjects(storage.getProjects().filter(p => p.id !== id));
        if (this.editingId === id) this.editingId = null;
        if (this.expandedId === id) this.expandedId = null;
        this.renderProjectsList();
      });
    });
  },

  showNewForm() {
    document.getElementById('new-project-form').classList.remove('hidden');
    document.getElementById('add-project-view-btn').classList.add('hidden');
    const swEl = document.getElementById('new-project-colors');
    swEl.innerHTML = App._CHIP_COLORS.map((c, i) =>
      `<button type="button" class="color-swatch${i === 0 ? ' color-swatch-active' : ''}" data-color="${c}" style="background:${c}"></button>`
    ).join('');
    swEl.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        swEl.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('color-swatch-active'));
        sw.classList.add('color-swatch-active');
      });
    });
  },

  hideNewForm() {
    document.getElementById('new-project-form').classList.add('hidden');
    document.getElementById('add-project-view-btn').classList.remove('hidden');
    document.getElementById('new-project-name-input').value = '';
    document.getElementById('new-project-desc-input').value = '';
  },

  saveNewProject() {
    const name = document.getElementById('new-project-name-input').value.trim();
    if (!name) return;
    const swEl = document.getElementById('new-project-colors');
    const color = swEl.querySelector('.color-swatch-active')?.dataset.color || App._CHIP_COLORS[0];
    const description = document.getElementById('new-project-desc-input').value.trim();

    const projects = storage.getProjects();
    projects.push({ id: App._genId(), name, color, description });
    storage.setProjects(projects);
    this.hideNewForm();
    this.renderProjectsList();
  },
};

window.ProjectsView = ProjectsView;
