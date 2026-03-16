// ========================================
// Daily View
// ========================================

const DailyView = {
  currentDate: new Date(),
  currentEntry: null,
  editingTaskId: null,
  editingTaskType: null,
  currentTaskView: 'list',
  draggedTask: null,
  timelineStartHour: 0,
  timelineEndHour: 23,
  editors: {},
  _drawCleanup: null,

  init() {
    this.initEditors();
    this.bindEvents();
    this.initRatingInputs();
    this.loadDate(this.currentDate);
  },

  initEditors() {
    this.editors.nightMessage = new MarkdownEditor(
      document.getElementById('night-message-editor'),
      {
        id: 'nightMessage',
        placeholder: 'How did the day go?',
        rows: 6,
        onchange: () => this.autoSave()
      }
    );

    this.editors.dayNotes = new MarkdownEditor(
      document.getElementById('day-notes-editor'),
      {
        id: 'dayNotes',
        placeholder: 'Quick thoughts...',
        rows: 3,
        onchange: () => this.autoSave()
      }
    );
  },

  bindEvents() {
    // Date navigation
    document.getElementById('prev-day').addEventListener('click', () => this.navigateDay(-1));
    document.getElementById('next-day').addEventListener('click', () => this.navigateDay(1));
    document.getElementById('today-btn').addEventListener('click', () => this.goToToday());

    // Task view toggle
    document.querySelectorAll('.toggle-btn[data-task-view]').forEach(btn => {
      btn.addEventListener('click', () => this.switchTaskView(btn.dataset.taskView));
    });

    // Task modal buttons
    document.getElementById('add-task-btn').addEventListener('click', () => this.openTaskModal(null, 'planned'));
    document.getElementById('add-planned-btn').addEventListener('click', () => this.openTaskModal(null, 'planned'));
    document.getElementById('add-log-btn').addEventListener('click', () => this.openTaskModal(null, 'log'));
    document.getElementById('task-save').addEventListener('click', () => this.saveTask());
    document.getElementById('task-cancel').addEventListener('click', () => this.closeTaskModal());
    document.getElementById('task-delete').addEventListener('click', () => this.deleteTask());

    // Notes tabs (edit/preview)
    document.querySelectorAll('.notes-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchNotesTab(tab.dataset.tab));
    });

    // Update preview on input
    document.getElementById('task-comment').addEventListener('input', () => {
      this.updateNotesPreview();
    });

    // Project inline add
    document.getElementById('task-add-project-btn').addEventListener('click', () => this.showInlineAdd('project'));
    document.getElementById('task-new-project-cancel').addEventListener('click', () => this.hideInlineAdd('project'));
    document.getElementById('task-new-project-save').addEventListener('click', () => this.saveNewItem('project'));

    // Google Calendar import
    document.getElementById('import-gcal-btn').addEventListener('click', () => this.openGCalImportModal());
    document.getElementById('gcal-cancel').addEventListener('click', () => this.closeGCalImportModal());
    document.getElementById('gcal-connect-btn').addEventListener('click', () => this.connectGoogleCalendar());
    document.getElementById('gcal-reconnect-btn').addEventListener('click', () => this.connectGoogleCalendar());
    document.getElementById('gcal-open-settings-btn').addEventListener('click', () => { this.closeGCalImportModal(); App.openSettings(); });
    document.getElementById('gcal-file-input').addEventListener('change', (e) => this.onGCalFileSelected(e));
    document.getElementById('gcal-filter-btn').addEventListener('click', () => this.filterGCalEvents());
    document.getElementById('gcal-select-all').addEventListener('click', () => this.toggleSelectAllGCalEvents());
    document.getElementById('gcal-import-btn').addEventListener('click', () => this.importGCalEvents());

    // Modal backdrop clicks
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', () => {
        this.closeTaskModal();
        this.closeGCalImportModal();
      });
    });

    // Sleep time inputs
    document.getElementById('bed-time').addEventListener('change', () => this.updateSleepDuration());
    document.getElementById('wake-time').addEventListener('change', () => this.updateSleepDuration());

    // Nap
    document.getElementById('add-nap-btn').addEventListener('click', () => this.showDayAddForm('nap'));
    document.getElementById('nap-add-cancel').addEventListener('click', () => this.hideDayAddForm('nap'));
    document.getElementById('nap-add-save').addEventListener('click', () => this.addNap());

    // Exercise
    document.getElementById('add-exercise-btn').addEventListener('click', () => this.showDayAddForm('exercise'));
    document.getElementById('exercise-add-cancel').addEventListener('click', () => this.hideDayAddForm('exercise'));
    document.getElementById('exercise-add-save').addEventListener('click', () => this.addExercise());

    // Meals
    document.getElementById('add-meal-btn').addEventListener('click', () => this.showDayAddForm('meal'));
    document.getElementById('meal-add-cancel').addEventListener('click', () => this.hideDayAddForm('meal'));
    document.getElementById('meal-add-save').addEventListener('click', () => this.addMeal());

    // Drinks
    document.getElementById('add-drink-btn').addEventListener('click', () => this.showDayAddForm('drink'));
    document.getElementById('drink-add-cancel').addEventListener('click', () => this.hideDayAddForm('drink'));
    document.getElementById('drink-add-save').addEventListener('click', () => this.addDrink());

    // Snacks
    document.getElementById('add-snack-btn').addEventListener('click', () => this.showDayAddForm('snack'));
    document.getElementById('snack-add-cancel').addEventListener('click', () => this.hideDayAddForm('snack'));
    document.getElementById('snack-add-save').addEventListener('click', () => this.addSnack());

    // Auto-save on input changes (morning message + sleep fields + day notes)
    const autoSaveInputs = ['morning-message', 'bed-time', 'wake-time'];

    autoSaveInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => this.autoSave());
        el.addEventListener('input', Utils.debounce(() => this.autoSave(), 1000));
      }
    });

    const shiftReasonEl = document.getElementById('plan-shift-reason');
    if (shiftReasonEl) {
      shiftReasonEl.addEventListener('input', Utils.debounce(() => this.autoSave(), 1000));
    }

    // Drop zone: drag planned task → copy to actual section
    const actualContainer = document.getElementById('unplanned-tasks');
    actualContainer.addEventListener('dragover', (e) => {
      if (e.dataTransfer.types.includes('application/x-planned-task-id')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        actualContainer.classList.add('drop-target-active');
      }
    });
    actualContainer.addEventListener('dragleave', (e) => {
      if (!actualContainer.contains(e.relatedTarget)) {
        actualContainer.classList.remove('drop-target-active');
      }
    });
    actualContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      actualContainer.classList.remove('drop-target-active');
      const taskId = e.dataTransfer.getData('application/x-planned-task-id');
      if (taskId) this.copyPlannedToActual(taskId);
    });
  },

  initRatingInputs() {
    const ratingInputs = [
      { id: 'morning-quality',  max: 5 },
      { id: 'morning-clarity',  max: 5 },
      { id: 'morning-mood',     max: 5 },
      { id: 'morning-fatigue',  max: 5 },
      { id: 'night-focus',      max: 5 },
      { id: 'night-social',     max: 5 },
      { id: 'night-mood',       max: 5 },
      { id: 'night-body',       max: 5 },
    ];

    ratingInputs.forEach(({ id, max }) => {
      const container = document.getElementById(id);
      if (!container) return;
      container.innerHTML = '';
      for (let i = 1; i <= max; i++) {
        const dot = document.createElement('div');
        dot.className = 'rating-dot';
        dot.dataset.value = i;
        dot.addEventListener('click', () => this.setRating(id, i));
        container.appendChild(dot);
      }
    });
  },

  setRating(containerId, value) {
    const container = document.getElementById(containerId);
    container.dataset.value = value;

    // Update visual state
    container.querySelectorAll('.rating-dot').forEach((dot, index) => {
      dot.classList.toggle('active', index < value);
    });

    // Auto-save
    this.autoSave();
  },

  getRating(containerId) {
    const container = document.getElementById(containerId);
    return parseInt(container.dataset.value) || 0;
  },

  displayRating(containerId, value) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.dataset.value = value;
    container.querySelectorAll('.rating-dot').forEach((dot, index) => {
      dot.classList.toggle('active', index < value);
    });
  },

  navigateDay(delta) {
    this.currentDate = Utils.addDays(this.currentDate, delta);
    this.loadDate(this.currentDate);
  },

  switchTaskView(view) {
    this.currentTaskView = view;
    document.querySelectorAll('.toggle-btn[data-task-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.taskView === view);
    });
    document.getElementById('tasks-list-view').classList.toggle('active', view === 'list');
    document.getElementById('tasks-timeline-view').classList.toggle('active', view === 'timeline');
    if (view === 'timeline') this.renderTimeline();
  },

  goToToday() {
    this.currentDate = new Date();
    this.loadDate(this.currentDate);
  },

  loadDate(date) {
    this.currentDate = date;
    const dateKey = Utils.formatDateKey(date);

    // Update header
    document.getElementById('current-date').textContent = Utils.formatDateDisplay(date);
    document.getElementById('day-of-week').textContent = Utils.getDayOfWeek(date);

    // Load entry
    this.currentEntry = storage.getDayEntry(dateKey);

    if (this.syncVitalsFromLog(this.currentEntry)) {
      storage.setDayEntry(Utils.formatDateKey(date), this.currentEntry);
    }

    // Render all sections
    this.renderTasks();
    this.renderTimeline();
    this.renderMorningMessage();
    this.renderSleep();
    this.renderVitals();
    this.renderDayNotes();
    this.renderNotes();
  },

  syncVitalsFromLog(entry) {
    const now = new Date().toISOString();
    const wasEmpty = !entry.vitals;

    // Ensure vitals and all 5 arrays exist
    if (!entry.vitals) entry.vitals = {};
    if (!entry.vitals.meals)    entry.vitals.meals    = [];
    if (!entry.vitals.drinks)   entry.vitals.drinks   = [];
    if (!entry.vitals.snacks)   entry.vitals.snacks   = [];
    if (!entry.vitals.exercise) entry.vitals.exercise = [];
    if (!entry.vitals.naps)     entry.vitals.naps     = [];

    let changed = wasEmpty;

    // One-time migration from old schema (only if vitals was just initialized)
    if (wasEmpty) {
      // Migrate entry.meals[] — type=meal → vitals.meals, type=drink → vitals.drinks
      (entry.meals || []).forEach(m => {
        if (m.type === 'meal') {
          entry.vitals.meals.push({
            id: Utils.generateId(),
            time: m.time || '',
            mealType: m.name || '',
            content: '',
            logId: null,
            createdAt: m.createdAt || now,
          });
        } else if (m.type === 'drink') {
          entry.vitals.drinks.push({
            id: Utils.generateId(),
            time: m.time || '',
            drinkType: m.name || '',
            content: '',
            logId: null,
            createdAt: m.createdAt || now,
          });
        }
      });

      // Migrate entry.exercise[]
      (entry.exercise || []).forEach(e => {
        entry.vitals.exercise.push({
          id: Utils.generateId(),
          time: e.time || '',
          type: e.name || '',
          duration: e.duration || '',
          notes: '',
          logId: null,
          createdAt: e.createdAt || now,
        });
      });

      // Migrate entry.sleep?.naps[]
      (entry.sleep?.naps || []).forEach(n => {
        entry.vitals.naps.push({
          id: Utils.generateId(),
          time: n.time || '',
          duration: n.duration || '',
          logId: null,
          createdAt: n.createdAt || now,
        });
      });
    }

    // Look up tag groups for syncing from log
    const tagGroups = storage.getTagGroups();
    const allTags = storage.getTags();

    const mealGroup = tagGroups.find(g => g.name.toLowerCase() === 'meal');
    const mealTagIds = mealGroup ? allTags.filter(t => t.groupId === mealGroup.id).map(t => t.id) : [];
    const mealTagById = Object.fromEntries(allTags.filter(t => mealTagIds.includes(t.id)).map(t => [t.id, t]));

    const drinksGroup = tagGroups.find(g => g.name.toLowerCase() === 'drinks');
    const drinksTagIds = drinksGroup ? allTags.filter(t => t.groupId === drinksGroup.id).map(t => t.id) : [];
    const drinksTagById = Object.fromEntries(allTags.filter(t => drinksTagIds.includes(t.id)).map(t => [t.id, t]));

    const snacksGroup = tagGroups.find(g => g.name.toLowerCase() === 'snacks');
    const snacksTagIds = snacksGroup ? allTags.filter(t => t.groupId === snacksGroup.id).map(t => t.id) : [];

    const exGroup = tagGroups.find(g => g.name.toLowerCase() === 'exercise');
    const exTagIds = exGroup
      ? allTags.filter(t => t.groupId === exGroup.id).map(t => t.id)
      : allTags.filter(t => ['gym','run','swim','bike','sport','exercise','badminton','yoga'].includes(t.name.toLowerCase())).map(t => t.id);
    const exTagById = Object.fromEntries(allTags.filter(t => exTagIds.includes(t.id)).map(t => [t.id, t]));

    const napTagIds = allTags.filter(t => t.name.toLowerCase().includes('nap')).map(t => t.id);

    // Sync from log entries
    (entry.log || []).forEach(log => {
      const tagIds = log.tagIds || [];

      // Meals
      const mealTagId = tagIds.find(id => mealTagIds.includes(id));
      if (mealTagId) {
        const tagName = mealTagById[mealTagId]?.name || '';
        const existing = entry.vitals.meals.find(v => v.logId === log.id);
        if (!existing) {
          entry.vitals.meals.push({ id: Utils.generateId(), time: log.startTime || '', mealType: tagName, content: '', logId: log.id, createdAt: now });
          changed = true;
        } else if (existing.mealType !== tagName) {
          existing.mealType = tagName;
          changed = true;
        }
      }

      // Drinks
      const drinkTagId = tagIds.find(id => drinksTagIds.includes(id));
      if (drinkTagId) {
        const tagName = drinksTagById[drinkTagId]?.name || '';
        const existing = entry.vitals.drinks.find(v => v.logId === log.id);
        if (!existing) {
          entry.vitals.drinks.push({ id: Utils.generateId(), time: log.startTime || '', drinkType: tagName, content: '', logId: log.id, createdAt: now });
          changed = true;
        } else if (existing.drinkType !== tagName) {
          existing.drinkType = tagName;
          changed = true;
        }
      }

      // Snacks
      const snackTagId = tagIds.find(id => snacksTagIds.includes(id));
      if (snackTagId && !entry.vitals.snacks.some(v => v.logId === log.id)) {
        entry.vitals.snacks.push({
          id: Utils.generateId(),
          time: log.startTime || '',
          content: '',
          logId: log.id,
          createdAt: now,
        });
        changed = true;
      }

      // Exercise
      const exTagId = tagIds.find(id => exTagIds.includes(id));
      if (exTagId) {
        const tagName = exTagById[exTagId]?.name || '';
        const existing = entry.vitals.exercise.find(v => v.logId === log.id);
        if (!existing) {
          entry.vitals.exercise.push({ id: Utils.generateId(), time: log.startTime || '', type: tagName, duration: log.duration || '', notes: '', logId: log.id, createdAt: now });
          changed = true;
        } else if (existing.type !== tagName) {
          existing.type = tagName;
          changed = true;
        }
      }

      // Naps
      const napTagId = tagIds.find(id => napTagIds.includes(id));
      if (napTagId && !entry.vitals.naps.some(v => v.logId === log.id)) {
        entry.vitals.naps.push({
          id: Utils.generateId(),
          time: log.startTime || '',
          duration: log.duration || '',
          logId: log.id,
          createdAt: now,
        });
        changed = true;
      }
    });

    return changed;
  },

  renderTasks() {
    const plannedContainer = document.getElementById('planned-tasks');
    const unplannedContainer = document.getElementById('unplanned-tasks');
    const summaryContainer = document.getElementById('tasks-summary');

    const plannedTasks = this.currentEntry.planned || [];
    const actualTasks = this.currentEntry.log || [];

    // Render planned tasks
    if (plannedTasks.length === 0) {
      plannedContainer.innerHTML = '<div class="empty-state">No planned tasks — add your morning plan</div>';
    } else {
      plannedContainer.innerHTML = plannedTasks.map(task => this.renderTaskItem(task, 'planned', plannedTasks)).join('');
    }

    // Render actual tasks
    if (actualTasks.length === 0) {
      unplannedContainer.innerHTML = '<div class="empty-state">No log entries yet</div>';
    } else {
      unplannedContainer.innerHTML = actualTasks.map(task => this.renderTaskItem(task, 'log', plannedTasks)).join('');
    }

    // Bind click events
    document.querySelectorAll('.task-item').forEach(item => {
      item.addEventListener('click', () => {
        const taskId = item.dataset.taskId;
        const taskType = item.dataset.taskType;
        this.openTaskModal(taskId, taskType);
      });
    });

    // Make planned task items draggable (drag to copy into actual section)
    document.querySelectorAll('#planned-tasks .task-item').forEach(item => {
      item.setAttribute('draggable', 'true');
      item.classList.add('draggable-planned');
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/x-planned-task-id', item.dataset.taskId);
        e.dataTransfer.effectAllowed = 'copy';
        setTimeout(() => item.classList.add('dragging-planned'), 0);
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging-planned');
      });
    });

    // Load shift reason
    const shiftReasonEl = document.getElementById('plan-shift-reason');
    if (shiftReasonEl) {
      shiftReasonEl.value = this.currentEntry.shiftReason || '';
    }

    // Render plan vs reality contrast
    this.renderPlanContrast(plannedTasks, actualTasks);

    // Render summary
    const totalTasks = plannedTasks.length + actualTasks.length;
    if (totalTasks > 0) {
      const plannedDone = plannedTasks.filter(t => t.status === 'done').length;
      const plannedInProgress = plannedTasks.filter(t => t.status === 'in-progress').length;
      const plannedNotStarted = plannedTasks.filter(t => t.status === 'not-started').length;
      const unlinkedActuals = actualTasks.filter(a => !a.plannedIds || a.plannedIds.length === 0).length;

      summaryContainer.innerHTML = `
        Planned: ${plannedTasks.length} |
        Done: ${plannedDone} |
        In Progress: ${plannedInProgress} |
        Not Started: ${plannedNotStarted} |
        Log: ${actualTasks.length} |
        Unlinked: ${unlinkedActuals}
      `;
      summaryContainer.style.display = 'block';
    } else {
      summaryContainer.style.display = 'none';
    }
  },

  renderPlanContrast(plannedTasks, actualTasks) {
    const panel = document.getElementById('plan-vs-reality');
    const breakdownEl = document.getElementById('contrast-breakdown');
    if (!panel || !breakdownEl) return;

    if (plannedTasks.length === 0) {
      panel.classList.add('hidden');
      return;
    }

    // For each planned task, find linked actual tasks
    const plannedRows = plannedTasks.map(planned => {
      const linked = actualTasks.filter(a => (a.plannedIds || []).includes(planned.id));
      const status = planned.status || 'not-started';

      const statusClass = status === 'done' ? 'contrast-done' :
                          status === 'in-progress' ? 'contrast-half' : 'contrast-missed';
      const statusIcon = status === 'done' ? '✓' :
                         status === 'in-progress' ? '~' :
                         status === 'cancelled' ? '⊘' : '✗';

      const linkedHtml = linked.map(a => `
        <div class="contrast-linked-actual">
          <span class="contrast-arrow">→</span>
          <span class="contrast-actual-text">${this.escapeHtml(a.text)}</span>
          ${a.duration ? `<span class="contrast-actual-time">${a.duration}</span>` : ''}
        </div>
      `).join('');

      return `
        <div class="contrast-row ${statusClass}">
          <div class="contrast-planned-row">
            <span class="contrast-status">${statusIcon}</span>
            <span class="contrast-task-text">${this.escapeHtml(planned.text)}</span>
            ${planned.duration ? `<span class="contrast-task-time">${planned.duration}</span>` : ''}
          </div>
          ${linkedHtml}
        </div>
      `;
    }).join('');

    // Unlinked actual tasks
    const unlinkedActuals = actualTasks.filter(a => !a.plannedIds || a.plannedIds.length === 0);
    const additionsHtml = unlinkedActuals.length > 0 ? `
      <div class="contrast-additions">
        <div class="contrast-additions-label">Unplanned additions</div>
        ${unlinkedActuals.map(a => `
          <div class="contrast-addition-row">
            <span class="contrast-plus">+</span>
            <span class="contrast-task-text">${this.escapeHtml(a.text)}</span>
            ${a.duration ? `<span class="contrast-task-time">${a.duration}</span>` : ''}
          </div>
        `).join('')}
      </div>
    ` : '';

    // Summary stats by planned task status
    const done = plannedTasks.filter(t => t.status === 'done').length;
    const half = plannedTasks.filter(t => t.status === 'in-progress').length;
    const missed = plannedTasks.filter(t => t.status === 'not-started' || t.status === 'cancelled').length;

    const statsHtml = `
      <div class="contrast-stats">
        <span class="contrast-stat stat-done">${done}/${plannedTasks.length} done</span>
        ${half > 0 ? `<span class="contrast-stat stat-half">${half} in progress</span>` : ''}
        ${missed > 0 ? `<span class="contrast-stat stat-missed">${missed} missed</span>` : ''}
        ${unlinkedActuals.length > 0 ? `<span class="contrast-stat stat-added">+${unlinkedActuals.length} added</span>` : ''}
      </div>
    `;

    breakdownEl.innerHTML = statsHtml + plannedRows + additionsHtml;
    panel.classList.remove('hidden');
  },

  renderTaskItem(task, type, allPlanned = []) {
    const timeField = type === 'planned' ? task.scheduledTime : task.startTime;
    const scheduledStr = timeField ? this.formatTime(timeField) : '';
    const hasNotes = task.notes && task.notes.trim().length > 0;
    const notesPreview = hasNotes ? Markdown.preview(task.notes, 80) : '';

    // Status/progress indicator
    const statusClass = type === 'planned' ? (task.status || 'not-started') : 'done';

    // Text class for done/cancelled state
    let textClass = 'task-text';
    if (type === 'planned' && (task.status === 'done' || task.status === 'cancelled')) {
      textClass = 'task-text done';
    }

    // Linked plan badges for actual tasks
    let linkedBadges = '';
    if (type === 'log' && (task.plannedIds || []).length > 0 && allPlanned.length > 0) {
      linkedBadges = task.plannedIds
        .map(pid => {
          const linked = allPlanned.find(p => p.id === pid);
          if (linked) {
            return `<span class="task-linked-badge" title="Links to plan: ${this.escapeHtml(linked.text)}">→ plan</span>`;
          }
          return '';
        })
        .filter(Boolean)
        .join('');
    }

    // Project and tag badges
    const projects = storage.getProjects();
    const tags = storage.getTags();
    const tagGroups = storage.getTagGroups();
    const projectBadges = (task.projectIds || []).map(id => {
      const p = projects.find(x => x.id === id);
      return p ? `<span class="task-project-badge" style="background:${p.color}20;color:${p.color};border-color:${p.color}40">${this.escapeHtml(p.name)}</span>` : '';
    }).join('');
    const tagBadges = (task.tagIds || []).map(id => {
      const t = tags.find(x => x.id === id);
      if (!t) return '';
      const g = tagGroups.find(g => g.id === t.groupId);
      const c = g ? g.color : '#888';
      return `<span class="task-tag-badge" style="background:${c}18;color:${c}"># ${this.escapeHtml(t.name)}</span>`;
    }).join('');

    return `
      <div class="task-item" data-task-id="${task.id}" data-task-type="${type}">
        <div class="task-progress-indicator ${statusClass}"></div>
        <div class="task-content">
          <div class="${textClass}">${this.escapeHtml(task.text)}</div>
          <div class="task-meta">
            ${scheduledStr ? `<span class="task-time">${scheduledStr}</span>` : ''}
            ${task.duration ? `<span class="task-time">${task.duration}</span>` : ''}
            ${linkedBadges}
            ${projectBadges}
            ${tagBadges}
            ${task.importedFrom === 'gcal' ? `<span class="task-gcal-badge" title="Imported from Google Calendar">Cal</span>` : ''}
            ${hasNotes ? `<span class="task-has-notes" title="Has notes">📝</span>` : ''}
          </div>
          ${notesPreview ? `<div class="task-notes-preview">${this.escapeHtml(notesPreview)}</div>` : ''}
        </div>
      </div>
    `;
  },

  formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
  },

  renderMorningMessage() {
    const el = document.getElementById('morning-message');
    if (el) el.value = this.currentEntry.morningMessage || '';
  },

  renderSleep() {
    const sleep = this.currentEntry.sleep || {};
    const morning = this.currentEntry.morning || {};

    document.getElementById('bed-time').value = sleep.bedTime || '';
    document.getElementById('wake-time').value = sleep.wakeTime || '';

    this.displayRating('morning-quality', morning.quality || 0);
    this.displayRating('morning-clarity', morning.clarity || 0);
    this.displayRating('morning-mood', morning.mood || 0);
    this.displayRating('morning-fatigue', morning.fatigue || 0);

    this.updateSleepDuration();
  },

  updateSleepDuration() {
    const bedTime = document.getElementById('bed-time').value;
    const wakeTime = document.getElementById('wake-time').value;
    const duration = Utils.calculateSleepDuration(bedTime, wakeTime);
    document.getElementById('sleep-duration').textContent = duration || '--';
  },

  renderNaps() {
    this.renderVitalsList('naps', document.getElementById('nap-list'));
    this.updateSleepDuration();
  },

  showDayAddForm(type) {
    document.getElementById(`${type}-add-form`).classList.remove('hidden');
    document.getElementById(`add-${type}-btn`).classList.add('hidden');
  },

  hideDayAddForm(type) {
    document.getElementById(`${type}-add-form`).classList.add('hidden');
    document.getElementById(`add-${type}-btn`).classList.remove('hidden');
    if (type === 'nap') {
      document.getElementById('nap-time-input').value = '';
      document.getElementById('nap-duration-input').value = '';
    } else if (type === 'exercise') {
      document.getElementById('exercise-time-input').value = '';
      document.getElementById('exercise-name-input').value = '';
      document.getElementById('exercise-duration-input').value = '';
    } else if (type === 'meal') {
      document.getElementById('meal-time-input').value = '';
      document.getElementById('meal-name-input').value = '';
    } else if (type === 'drink') {
      document.getElementById('drink-name-input').value = '';
    } else if (type === 'snack') {
      document.getElementById('snack-name-input').value = '';
    }
  },

  addNap() {
    const time = document.getElementById('nap-time-input').value;
    const duration = document.getElementById('nap-duration-input').value.trim();
    if (!time && !duration) return;
    const now = new Date().toISOString();
    if (!this.currentEntry.vitals) this.currentEntry.vitals = {};
    if (!this.currentEntry.vitals.naps) this.currentEntry.vitals.naps = [];
    this.currentEntry.vitals.naps.push({ id: Utils.generateId(), time, duration, logId: null, createdAt: now });
    // Also keep old field for compat
    if (!this.currentEntry.sleep) this.currentEntry.sleep = {};
    if (!this.currentEntry.sleep.naps) this.currentEntry.sleep.naps = [];
    this.currentEntry.sleep.naps.push({ id: Utils.generateId(), time, duration });
    this.saveEntry();
    this.hideDayAddForm('nap');
    this.renderNaps();
    this.updateSleepDuration();
  },

  renderExercise() {
    this.renderVitalsList('exercise', document.getElementById('exercise-list'));
  },

  renderMeals() {
    this.renderVitalsList('meals', document.getElementById('meal-list'));
  },

  renderDrinks() {
    this.renderVitalsList('drinks', document.getElementById('drink-list'));
  },

  renderSnacks() {
    this.renderVitalsList('snacks', document.getElementById('snack-list'));
  },

  renderVitals() {
    this.renderNaps();
    this.renderExercise();
    this.renderMeals();
    this.renderDrinks();
    this.renderSnacks();
  },

  renderVitalsList(vitalsKey, container) {
    if (!container) return;
    if (!this.currentEntry.vitals) this.currentEntry.vitals = {};
    const items = this.currentEntry.vitals[vitalsKey] || [];

    const html = items.map(item => {
      let labelHtml = '';
      let contentValue = '';
      let contentPlaceholder = 'notes...';

      if (vitalsKey === 'meals') {
        labelHtml = item.mealType ? `<span class="vital-type-label">${this.escapeHtml(item.mealType)}</span>` : '';
        contentValue = item.content || '';
        contentPlaceholder = 'what?';
      } else if (vitalsKey === 'drinks') {
        labelHtml = item.drinkType ? `<span class="vital-type-label">${this.escapeHtml(item.drinkType)}</span>` : '';
        contentValue = item.content || '';
        contentPlaceholder = 'details...';
      } else if (vitalsKey === 'snacks') {
        contentValue = item.content || '';
        contentPlaceholder = 'what?';
      } else if (vitalsKey === 'exercise') {
        labelHtml = item.type ? `<span class="vital-type-label">${this.escapeHtml(item.type)}</span>` : '';
        if (item.duration) labelHtml += ` <span class="vital-type-label">${this.escapeHtml(item.duration)}</span>`;
        contentValue = item.notes || '';
        contentPlaceholder = 'notes...';
      } else if (vitalsKey === 'naps') {
        labelHtml = `<span class="vital-type-label">Nap</span>`;
        contentValue = item.duration || '';
        contentPlaceholder = 'duration (e.g. 20m)';
      }

      return `<div class="vital-item" data-vital-type="${vitalsKey}" data-vital-id="${item.id}">
        ${item.logId ? '<span class="vital-linked" title="Linked to log entry">🔗</span>' : ''}
        <input class="vital-time-input" placeholder="--:--" value="${this.escapeHtml(item.time || '')}">
        ${labelHtml}
        <input class="vital-content-input" placeholder="${contentPlaceholder}" value="${this.escapeHtml(contentValue)}">
        <button class="vital-item-delete">×</button>
      </div>`;
    }).join('');

    container.innerHTML = html;

    // Time inputs
    container.querySelectorAll('.vital-time-input').forEach(input => {
      const saveTime = () => {
        const itemEl = input.closest('.vital-item');
        const item = (this.currentEntry.vitals[vitalsKey] || []).find(i => i.id === itemEl.dataset.vitalId);
        if (!item) return;
        item.time = input.value.trim() || null;
        this.saveEntry();
      };
      input.addEventListener('blur', saveTime);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveTime(); input.blur(); } });
    });

    // Event delegation for content input blur/enter
    container.querySelectorAll('.vital-content-input').forEach(input => {
      const saveInput = () => {
        const itemEl = input.closest('.vital-item');
        const itemId = itemEl.dataset.vitalId;
        const item = (this.currentEntry.vitals[vitalsKey] || []).find(i => i.id === itemId);
        if (!item) return;
        if (vitalsKey === 'exercise') {
          item.notes = input.value;
        } else if (vitalsKey === 'naps') {
          item.duration = input.value;
        } else {
          item.content = input.value;
        }
        this.saveEntry();
      };
      input.addEventListener('blur', saveInput);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveInput(); input.blur(); } });
    });

    // Delete buttons
    container.querySelectorAll('.vital-item-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemEl = btn.closest('.vital-item');
        const itemId = itemEl.dataset.vitalId;
        this.currentEntry.vitals[vitalsKey] = (this.currentEntry.vitals[vitalsKey] || []).filter(i => i.id !== itemId);
        this.saveEntry();
        this.renderVitalsList(vitalsKey, container);
      });
    });
  },

  addExercise() {
    const name = document.getElementById('exercise-name-input').value.trim();
    if (!name) return;
    const time = document.getElementById('exercise-time-input').value;
    const duration = document.getElementById('exercise-duration-input').value.trim();
    const now = new Date().toISOString();
    if (!this.currentEntry.vitals) this.currentEntry.vitals = {};
    if (!this.currentEntry.vitals.exercise) this.currentEntry.vitals.exercise = [];
    this.currentEntry.vitals.exercise.push({ id: Utils.generateId(), time, type: name, duration, notes: '', logId: null, createdAt: now });
    // Also keep old field for compat
    if (!this.currentEntry.exercise) this.currentEntry.exercise = [];
    this.currentEntry.exercise.push({ id: Utils.generateId(), time, name, duration });
    this.saveEntry();
    this.hideDayAddForm('exercise');
    this.renderExercise();
  },

  addMeal() {
    const name = document.getElementById('meal-name-input').value.trim();
    if (!name) return;
    const time = document.getElementById('meal-time-input').value;
    const now = new Date().toISOString();
    if (!this.currentEntry.vitals) this.currentEntry.vitals = {};
    if (!this.currentEntry.vitals.meals) this.currentEntry.vitals.meals = [];
    this.currentEntry.vitals.meals.push({ id: Utils.generateId(), time, mealType: '', content: name, logId: null, createdAt: now });
    this.saveEntry();
    this.hideDayAddForm('meal');
    this.renderMeals();
  },

  addDrink() {
    const name = document.getElementById('drink-name-input').value.trim();
    if (!name) return;
    const now = new Date().toISOString();
    if (!this.currentEntry.vitals) this.currentEntry.vitals = {};
    if (!this.currentEntry.vitals.drinks) this.currentEntry.vitals.drinks = [];
    this.currentEntry.vitals.drinks.push({ id: Utils.generateId(), time: '', drinkType: '', content: name, logId: null, createdAt: now });
    this.saveEntry();
    this.hideDayAddForm('drink');
    this.renderDrinks();
  },

  addSnack() {
    const name = document.getElementById('snack-name-input').value.trim();
    if (!name) return;
    const now = new Date().toISOString();
    if (!this.currentEntry.vitals) this.currentEntry.vitals = {};
    if (!this.currentEntry.vitals.snacks) this.currentEntry.vitals.snacks = [];
    this.currentEntry.vitals.snacks.push({ id: Utils.generateId(), time: '', content: name, logId: null, createdAt: now });
    this.saveEntry();
    this.hideDayAddForm('snack');
    this.renderSnacks();
  },

  renderDayNotes() {
    if (this.editors.dayNotes) this.editors.dayNotes.setValue(this.currentEntry.dayNotes || '');
  },

  renderNotes() {
    const night = this.currentEntry.night || {};
    this.displayRating('night-focus',  night.focus  || 0);
    this.displayRating('night-social', night.social || 0);
    this.displayRating('night-mood',   night.mood   || 0);
    this.displayRating('night-body',   night.body   || 0);
    if (this.editors.nightMessage) {
      this.editors.nightMessage.setValue(this.currentEntry.nightMessage || '');
    }
  },

  // ========================================
  // Task Modal
  // ========================================

  openTaskModal(taskId = null, type = 'planned', scheduledHour = null, scheduledMinutes = 0, duration = null) {
    const modal = document.getElementById('task-modal');
    const title = document.getElementById('task-modal-title');
    const deleteBtn = document.getElementById('task-delete');

    this.editingTaskId = taskId;
    this.editingTaskType = type;

    // Update hidden type field
    document.getElementById('task-type').value = type;

    // Update time label
    document.getElementById('task-time-label').textContent =
      type === 'planned' ? 'Scheduled' : 'Start Time';

    // Show/hide fields based on type
    document.getElementById('task-status-row').style.display = type === 'planned' ? '' : 'none';
    document.getElementById('link-to-planned-group').style.display = type === 'log' ? '' : 'none';

    if (taskId) {
      // Edit existing task
      title.textContent = `Edit ${type === 'planned' ? 'Planned' : 'Log'} Task`;
      deleteBtn.classList.remove('hidden');

      const tasks = type === 'planned'
        ? (this.currentEntry.planned || [])
        : (this.currentEntry.log || []);
      const task = tasks.find(t => t.id === taskId);

      if (task) {
        document.getElementById('task-text').value = task.text;
        document.getElementById('task-date').value = Utils.formatDateKey(this.currentDate);

        if (type === 'planned') {
          document.getElementById('task-scheduled').value = task.scheduledTime || '';
          document.getElementById('task-time').value = task.duration || '';
          document.getElementById('task-progress').value = task.status || 'not-started';
        } else {
          document.getElementById('task-scheduled').value = task.startTime || '';
          document.getElementById('task-time').value = task.duration || '';
          this.populatePlannedMultiSelect(task.plannedIds || []);
        }
        document.getElementById('task-comment').value = task.notes || '';

        const gcalInfo = document.getElementById('task-gcal-info');
        if (task.gcalDescription) {
          document.getElementById('task-gcal-description-text').textContent = task.gcalDescription;
          gcalInfo.classList.remove('hidden');
        } else {
          gcalInfo.classList.add('hidden');
        }

        this.renderProjectChips(task.projectIds || []);
        this.renderTagChips(task.tagIds || []);
      }
    } else {
      // New task
      title.textContent = `Add ${type === 'planned' ? 'Planned' : 'Log'} Task`;
      deleteBtn.classList.add('hidden');

      document.getElementById('task-text').value = '';
      document.getElementById('task-date').value = Utils.formatDateKey(this.currentDate);
      document.getElementById('task-scheduled').value = scheduledHour !== null
        ? `${String(scheduledHour).padStart(2, '0')}:${String(scheduledMinutes).padStart(2, '0')}`
        : '';
      document.getElementById('task-time').value = duration || '';
      document.getElementById('task-progress').value = 'not-started';
      document.getElementById('task-comment').value = '';
      document.getElementById('task-gcal-info').classList.add('hidden');
      this.renderProjectChips([]);
      this.renderTagChips([]);

      if (type === 'log') {
        this.populatePlannedMultiSelect([]);
      }
    }

    modal.classList.remove('hidden');
    document.getElementById('task-text').focus();
  },

  async copyPlannedToActual(plannedId) {
    const planned = (this.currentEntry.planned || []).find(t => t.id === plannedId);
    if (!planned) return;

    // Don't duplicate if already linked
    const alreadyLinked = (this.currentEntry.log || []).some(a =>
      (a.plannedIds || []).includes(plannedId)
    );
    if (alreadyLinked) {
      App.updateStatus('Already linked — edit the existing log entry');
      return;
    }

    const actualTask = {
      id: Utils.generateId(),
      text: planned.text,
      startTime: null,
      duration: planned.duration || null,
      plannedIds: [planned.id],
      notes: '',
      createdAt: new Date().toISOString()
    };

    if (!this.currentEntry.log) this.currentEntry.log = [];
    this.currentEntry.log.push(actualTask);
    await this.saveEntry();
    this.renderTasks();
    this.renderTimeline();
    App.updateStatus('Copied to log — click to edit');
  },

  populatePlannedMultiSelect(selectedIds = []) {
    const select = document.getElementById('task-linked-plan');
    if (!select) return;

    const plannedTasks = this.currentEntry.planned || [];
    if (plannedTasks.length === 0) {
      select.innerHTML = '<option value="" disabled>No planned tasks for this day</option>';
      return;
    }
    select.innerHTML = plannedTasks.map(t =>
      `<option value="${t.id}" ${selectedIds.includes(t.id) ? 'selected' : ''}>${this.escapeHtml(t.text)}</option>`
    ).join('');
  },

  closeTaskModal() {
    document.getElementById('task-modal').classList.add('hidden');
    this.editingTaskId = null;
    this.editingTaskType = null;
    // Reset to edit tab
    this.switchNotesTab('edit');
  },

  switchNotesTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.notes-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });

    const textarea = document.getElementById('task-comment');
    const preview = document.getElementById('task-comment-preview');

    if (tab === 'preview') {
      textarea.classList.add('hidden');
      preview.classList.remove('hidden');
      this.updateNotesPreview();
    } else {
      textarea.classList.remove('hidden');
      preview.classList.add('hidden');
    }
  },

  updateNotesPreview() {
    const text = document.getElementById('task-comment').value;
    const preview = document.getElementById('task-comment-preview');
    preview.innerHTML = Markdown.render(text) || '<em style="color: var(--color-text-tertiary)">Nothing to preview</em>';
  },

  async saveTask() {
    const text = document.getElementById('task-text').value.trim();
    if (!text) {
      alert('Please enter a task');
      return;
    }

    const isPlanned = this.editingTaskType === 'planned';
    const taskDateKey = document.getElementById('task-date').value || Utils.formatDateKey(this.currentDate);
    const currentDateKey = Utils.formatDateKey(this.currentDate);
    const isSameDay = taskDateKey === currentDateKey;

    const projectIds = this.getSelectedChipIds('task-project-chips');
    const tagIds = this.getSelectedChipIds('task-tag-chips');

    // Build task data based on type
    let taskData;
    if (isPlanned) {
      taskData = {
        text,
        scheduledTime: document.getElementById('task-scheduled').value || null,
        duration: document.getElementById('task-time').value.trim() || null,
        status: document.getElementById('task-progress').value,
        notes: document.getElementById('task-comment').value.trim(),
        projectIds,
        tagIds
      };
    } else {
      const plannedIds = Array.from(
        document.getElementById('task-linked-plan').selectedOptions
      ).map(o => o.value).filter(Boolean);
      taskData = {
        text,
        startTime: document.getElementById('task-scheduled').value || null,
        duration: document.getElementById('task-time').value.trim() || null,
        plannedIds,
        notes: document.getElementById('task-comment').value.trim(),
        projectIds,
        tagIds
      };
    }

    if (this.editingTaskId) {
      if (isSameDay) {
        // Update in current day
        if (isPlanned) {
          const index = (this.currentEntry.planned || []).findIndex(t => t.id === this.editingTaskId);
          if (index !== -1) {
            this.currentEntry.planned[index] = { ...this.currentEntry.planned[index], ...taskData };
          }
        } else {
          const index = (this.currentEntry.log || []).findIndex(t => t.id === this.editingTaskId);
          if (index !== -1) {
            this.currentEntry.log[index] = { ...this.currentEntry.log[index], ...taskData };
          }
        }
        await this.saveEntry();
      } else {
        // Move task to different day
        let existing;
        if (isPlanned) {
          existing = (this.currentEntry.planned || []).find(t => t.id === this.editingTaskId);
          this.currentEntry.planned = (this.currentEntry.planned || []).filter(t => t.id !== this.editingTaskId);
        } else {
          existing = (this.currentEntry.log || []).find(t => t.id === this.editingTaskId);
          this.currentEntry.log = (this.currentEntry.log || []).filter(t => t.id !== this.editingTaskId);
        }
        storage.setDayEntry(currentDateKey, this.currentEntry);

        const targetEntry = storage.getDayEntry(taskDateKey);
        if (isPlanned) {
          if (!targetEntry.planned) targetEntry.planned = [];
          targetEntry.planned.push({ ...existing, ...taskData });
        } else {
          if (!targetEntry.log) targetEntry.log = [];
          targetEntry.log.push({ ...existing, ...taskData });
        }
        storage.setDayEntry(taskDateKey, targetEntry);
        App.updateStatus(`Task moved to ${taskDateKey}`);
      }
    } else {
      const newTask = {
        id: Utils.generateId(),
        ...taskData,
        createdAt: new Date().toISOString()
      };
      if (isSameDay) {
        if (isPlanned) {
          if (!this.currentEntry.planned) this.currentEntry.planned = [];
          this.currentEntry.planned.push(newTask);
        } else {
          if (!this.currentEntry.log) this.currentEntry.log = [];
          this.currentEntry.log.push(newTask);
        }
        await this.saveEntry();
      } else {
        const targetEntry = storage.getDayEntry(taskDateKey);
        if (isPlanned) {
          if (!targetEntry.planned) targetEntry.planned = [];
          targetEntry.planned.push(newTask);
        } else {
          if (!targetEntry.log) targetEntry.log = [];
          targetEntry.log.push(newTask);
        }
        storage.setDayEntry(taskDateKey, targetEntry);
        App.updateStatus(`Task added to ${taskDateKey}`);
      }
    }

    this.closeTaskModal();
    this.renderTasks();
    this.renderTimeline();
    this.syncVitalsFromLog(this.currentEntry);
    this.renderVitals();
  },

  async deleteTask() {
    if (!this.editingTaskId) return;

    if (confirm('Delete this task?')) {
      if (this.editingTaskType === 'planned') {
        this.currentEntry.planned = (this.currentEntry.planned || []).filter(t => t.id !== this.editingTaskId);
      } else {
        this.currentEntry.log = (this.currentEntry.log || []).filter(t => t.id !== this.editingTaskId);
      }
      await this.saveEntry();
      this.closeTaskModal();
      this.renderTasks();
      this.renderTimeline();
    }
  },


  // ========================================
  // Auto-save
  // ========================================

  async autoSave() {
    this.collectFormData();
    await this.saveEntry();
  },

  collectFormData() {
    // Morning message
    const morningEl = document.getElementById('morning-message');
    this.currentEntry.morningMessage = morningEl ? morningEl.value : '';

    // Sleep (preserve naps array)
    this.currentEntry.sleep = {
      ...(this.currentEntry.sleep || {}),
      bedTime: document.getElementById('bed-time').value,
      wakeTime: document.getElementById('wake-time').value,
    };

    // Morning ratings
    this.currentEntry.morning = {
      quality:  this.getRating('morning-quality'),
      clarity:  this.getRating('morning-clarity'),
      mood:     this.getRating('morning-mood'),
      fatigue:  this.getRating('morning-fatigue'),
    };

    // Day notes
    this.currentEntry.dayNotes = this.editors.dayNotes ? this.editors.dayNotes.getValue() : '';

    // Energy & mood
    this.currentEntry.night = {
      focus:  this.getRating('night-focus'),
      social: this.getRating('night-social'),
      mood:   this.getRating('night-mood'),
      body:   this.getRating('night-body'),
    };

    // Notes
    this.currentEntry.nightMessage = this.editors.nightMessage ? this.editors.nightMessage.getValue() : '';

    // Shift reason (plan vs reality)
    const shiftReasonEl = document.getElementById('plan-shift-reason');
    this.currentEntry.shiftReason = shiftReasonEl ? shiftReasonEl.value : '';
  },

  async saveEntry() {
    const dateKey = Utils.formatDateKey(this.currentDate);
    await storage.pullBeforeWrite(dateKey);
    storage.setDayEntry(dateKey, this.currentEntry);
    App.updateStatus('Saved locally');
  },

  // ========================================
  // Timeline View
  // ========================================

  renderTimeline() {
    const gridContainer = document.getElementById('timeline-grid');

    if (!gridContainer) return;

    const plannedTasks = this.currentEntry.planned || [];
    const actualTasks = this.currentEntry.log || [];

    const scheduledPlanned = plannedTasks.filter(p => p.scheduledTime);
    const scheduledActual = actualTasks.filter(a => a.startTime);

    // Render timeline grid with column headers
    let gridHtml = `
      <div class="timeline-col-labels">
        <div class="timeline-hour-label"></div>
        <div class="timeline-col-header-content">
          <div class="timeline-col-label-planned">Planned</div>
          <div class="timeline-col-label-actual">Log</div>
        </div>
      </div>
    `;
    for (let hour = this.timelineStartHour; hour <= this.timelineEndHour; hour++) {
      const label = hour === 0 ? '12 AM' :
                    hour < 12 ? `${hour} AM` :
                    hour === 12 ? '12 PM' :
                    `${hour - 12} PM`;

      gridHtml += `
        <div class="timeline-hour" data-hour="${hour}">
          <div class="timeline-hour-label">${label}</div>
          <div class="timeline-hour-content" data-hour="${hour}"></div>
        </div>
      `;
    }
    gridContainer.innerHTML = gridHtml;

    // Helper to place a task on the timeline grid
    const placeTask = (task, type, timeField) => {
      const [hourStr, minStr] = timeField.split(':');
      const hour = parseInt(hourStr);
      const minutes = parseInt(minStr) || 0;
      const hourContent = gridContainer.querySelector(`.timeline-hour-content[data-hour="${hour}"]`);
      if (!hourContent) return;

      const taskEl = document.createElement('div');
      taskEl.innerHTML = this.renderTimelineTask(task, type, true, minutes);
      const taskNode = taskEl.firstElementChild;

      // Position based on minutes within the hour
      const topPercent = (minutes / 60) * 100;
      taskNode.style.top = `${topPercent}%`;

      // Calculate height based on duration
      const durationMinutes = Utils.parseDuration(task.duration) || 30;
      const hourHeight = hourContent.offsetHeight || 60;
      const heightPx = (durationMinutes / 60) * hourHeight;
      taskNode.style.height = `${Math.max(24, heightPx)}px`;

      hourContent.appendChild(taskNode);
    };

    scheduledPlanned.forEach(task => placeTask(task, 'planned', task.scheduledTime));
    scheduledActual.forEach(task => placeTask(task, 'log', task.startTime));

    // Add current time indicator
    this.updateCurrentTimeIndicator();

    // Setup drag and drop + draw-to-create
    this.setupTimelineDragDrop();
    this.setupTimelineDraw();

    // Scroll to 9am on initial render (run after paint so offsetTop is available)
    requestAnimationFrame(() => {
      const nineAm = gridContainer.querySelector('.timeline-hour[data-hour="9"]');
      const col = document.querySelector('.daily-col-left');
      if (nineAm && col) col.scrollTop = nineAm.offsetTop;
    });
  },

  renderTimelineTask(task, type, scheduled, minutes = 0) {
    const statusClass = type === 'planned' ? (task.status || 'not-started') : 'done';
    const doneClass = (type === 'planned' && task.status === 'done') || type === 'log' ? 'done' : '';
    const scheduledClass = scheduled ? 'scheduled' : '';
    const sideClass = scheduled ? (type === 'planned' ? 'planned-side' : 'actual-side') : '';
    const timeField = type === 'planned' ? task.scheduledTime : task.startTime;
    const timeStr = scheduled && timeField ? this.formatTime(timeField) : '';

    const projects = storage.getProjects();
    const tags = storage.getTags();
    const tagGroups = storage.getTagGroups();
    const projectBadges = (task.projectIds || []).map(id => {
      const p = projects.find(x => x.id === id);
      return p ? `<span class="task-project-badge" style="background:${p.color}20;color:${p.color};border-color:${p.color}40">${this.escapeHtml(p.name)}</span>` : '';
    }).join('');
    const tagBadges = (task.tagIds || []).map(id => {
      const t = tags.find(x => x.id === id);
      if (!t) return '';
      const g = tagGroups.find(g => g.id === t.groupId);
      const c = g ? g.color : '#888';
      return `<span class="task-tag-badge" style="background:${c}18;color:${c}"># ${this.escapeHtml(t.name)}</span>`;
    }).join('');

    return `
      <div class="timeline-task ${doneClass} ${scheduledClass} ${sideClass}"
           data-task-id="${task.id}"
           data-task-type="${type}"
           draggable="true">
        <div class="task-progress-indicator ${statusClass}"></div>
        ${timeStr ? `<span class="timeline-task-time">${timeStr}</span>` : ''}
        <span class="timeline-task-text">${this.escapeHtml(task.text)}</span>
        ${projectBadges}${tagBadges}
        ${task.duration ? `<span class="timeline-task-duration">${task.duration}</span>` : ''}
        ${task.importedFrom === 'gcal' ? `<span class="task-gcal-badge" title="Imported from Google Calendar">Cal</span>` : ''}
      </div>
    `;
  },

  updateCurrentTimeIndicator() {
    // Remove existing indicator
    const existing = document.querySelector('.timeline-current-time');
    if (existing) existing.remove();

    // Only show for today
    if (!Utils.isToday(this.currentDate)) return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    if (currentHour < this.timelineStartHour || currentHour > this.timelineEndHour) return;

    const hourEl = document.querySelector(`.timeline-hour[data-hour="${currentHour}"]`);
    if (!hourEl) return;

    const minuteOffset = (currentMinute / 60) * hourEl.offsetHeight;
    const topOffset = hourEl.offsetTop + minuteOffset;

    const indicator = document.createElement('div');
    indicator.className = 'timeline-current-time';
    indicator.style.top = `${topOffset}px`;

    document.getElementById('timeline-grid').appendChild(indicator);
  },

  setupTimelineDragDrop() {
    const timelineTasks = document.querySelectorAll('.timeline-task');
    const hourContents = document.querySelectorAll('.timeline-hour-content');

    // Task drag start
    timelineTasks.forEach(taskEl => {
      taskEl.addEventListener('dragstart', (e) => {
        this.draggedTask = taskEl.dataset.taskId;
        taskEl.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', taskEl.dataset.taskId);
        e.dataTransfer.setData('application/x-task-type', taskEl.dataset.taskType || 'planned');
      });

      taskEl.addEventListener('dragend', () => {
        taskEl.classList.remove('dragging');
        this.draggedTask = null;
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      });

      // Click to edit
      taskEl.addEventListener('click', (e) => {
        if (!taskEl.classList.contains('dragging')) {
          this.openTaskModal(taskEl.dataset.taskId, taskEl.dataset.taskType || 'planned');
        }
      });
    });

    // Hour content drop zones
    hourContents.forEach(hourContent => {
      hourContent.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        hourContent.classList.add('drag-over');

        // Show drop indicator at 15-min snap position
        this.updateDropIndicator(hourContent, e);
      });

      hourContent.addEventListener('dragleave', (e) => {
        hourContent.classList.remove('drag-over');
        this.removeDropIndicator();
      });

      hourContent.addEventListener('drop', (e) => {
        e.preventDefault();
        hourContent.classList.remove('drag-over');
        this.removeDropIndicator();

        const taskId = e.dataTransfer.getData('text/plain');
        const taskType = e.dataTransfer.getData('application/x-task-type') || 'planned';
        const hour = parseInt(hourContent.dataset.hour);
        const minutes = this.getDropMinutes(hourContent, e);

        this.scheduleTask(taskId, taskType, hour, minutes);
      });
    });

    // Unscheduled pool drop zone
  },

  setupTimelineDraw() {
    const gridContainer = document.getElementById('timeline-grid');
    if (!gridContainer) return;

    // Clean up previous listeners and timer
    if (this._drawCleanup) {
      this._drawCleanup();
      this._drawCleanup = null;
    }

    // Auto-refresh the current time indicator every minute
    const timeInterval = setInterval(() => this.updateCurrentTimeIndicator(), 60 * 1000);

    let drawPreview = null;
    let drawStartY = 0;
    let drawStartTime = null;
    let drawSide = 'planned';
    let isDrawActive = false;

    const getTimeFromGridY = (clientY) => {
      const firstHourEl = gridContainer.querySelector('.timeline-hour');
      const timelineTop = firstHourEl
        ? firstHourEl.getBoundingClientRect().top
        : gridContainer.getBoundingClientRect().top;
      const y = Math.max(0, clientY - timelineTop);
      const hourHeight = 60;
      const totalMin = (y / hourHeight) * 60;
      const snapped = Math.round(totalMin / 15) * 15;
      const hour = this.timelineStartHour + Math.floor(snapped / 60);
      const minutes = snapped % 60;
      return {
        hour: Math.max(this.timelineStartHour, Math.min(this.timelineEndHour, hour)),
        minutes
      };
    };

    const getSideFromClientX = (clientX) => {
      const rect = gridContainer.getBoundingClientRect();
      const labelWidth = 50;
      const relX = clientX - rect.left - labelWidth;
      const contentWidth = rect.width - labelWidth;
      return relX < contentWidth * 0.5 ? 'planned' : 'log';
    };

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.timeline-task')) return;
      if (!e.target.closest('.timeline-hour-content')) return;

      isDrawActive = true;
      drawStartY = e.clientY;
      drawStartTime = getTimeFromGridY(e.clientY);
      drawSide = getSideFromClientX(e.clientX);
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!isDrawActive) return;
      if (Math.abs(e.clientY - drawStartY) < 10) return;

      if (!drawPreview) {
        drawPreview = document.createElement('div');
        drawPreview.className = `timeline-draw-preview ${drawSide}-preview`;
        gridContainer.appendChild(drawPreview);
      }

      const endTime = getTimeFromGridY(e.clientY);
      this.updateDrawPreview(drawPreview, drawStartTime, endTime, drawSide);
    };

    const onMouseUp = (e) => {
      if (!isDrawActive) return;
      isDrawActive = false;

      if (drawPreview) {
        drawPreview.remove();
        drawPreview = null;
      }

      const dragDistance = Math.abs(e.clientY - drawStartY);
      const endTime = getTimeFromGridY(e.clientY);
      const startMin = drawStartTime.hour * 60 + drawStartTime.minutes;
      const endMin = endTime.hour * 60 + endTime.minutes;
      const durationMin = Math.abs(endMin - startMin);
      const type = drawSide === 'planned' ? 'planned' : 'log';

      if (dragDistance < 10 || durationMin < 15) {
        // Treat as click: open modal at this time
        this.openTaskModal(null, type, drawStartTime.hour, drawStartTime.minutes);
      } else {
        // Drag: pre-fill duration
        const actualStart = startMin <= endMin ? drawStartTime : endTime;
        const durationStr = durationMin >= 60
          ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? durationMin % 60 + 'm' : ''}`
          : `${durationMin}m`;
        this.openTaskModal(null, type, actualStart.hour, actualStart.minutes, durationStr);
      }
    };

    gridContainer.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    this._drawCleanup = () => {
      gridContainer.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      clearInterval(timeInterval);
    };
  },

  updateDrawPreview(previewEl, startTime, endTime, drawSide) {
    const hourHeight = 60;
    const startY = (startTime.hour - this.timelineStartHour) * hourHeight + (startTime.minutes / 60) * hourHeight;
    const endY = (endTime.hour - this.timelineStartHour) * hourHeight + (endTime.minutes / 60) * hourHeight;
    const top = Math.min(startY, endY);
    const height = Math.max(Math.abs(endY - startY), 4);

    // Horizontal position matching planned-side / actual-side layout
    const gridEl = document.getElementById('timeline-grid');

    // Offset by the column labels header height so the preview aligns with the hour cells
    const firstHourEl = gridEl.querySelector('.timeline-hour');
    const headerOffset = firstHourEl ? firstHourEl.offsetTop : 0;

    previewEl.style.top = `${top + headerOffset}px`;
    previewEl.style.height = `${height}px`;

    const labelWidth = 50;
    const contentWidth = gridEl.offsetWidth - labelWidth;
    const splitPx = labelWidth + Math.floor(contentWidth * 0.40);

    if (drawSide === 'planned') {
      previewEl.style.left = `${labelWidth + 4}px`;
      previewEl.style.right = `${gridEl.offsetWidth - splitPx + 4}px`;
    } else {
      previewEl.style.left = `${splitPx - 4}px`;
      previewEl.style.right = '4px';
    }

    // Time label
    const actualStart = startTime.hour * 60 + startTime.minutes <= endTime.hour * 60 + endTime.minutes
      ? startTime : endTime;
    const durationMin = Math.abs(
      (startTime.hour * 60 + startTime.minutes) - (endTime.hour * 60 + endTime.minutes)
    );
    const timeLabel = this.formatTime(
      `${String(actualStart.hour).padStart(2, '0')}:${String(actualStart.minutes).padStart(2, '0')}`
    );
    const durationLabel = durationMin >= 60
      ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? durationMin % 60 + 'm' : ''}`
      : `${durationMin}m`;

    previewEl.textContent = durationMin > 0 ? `${timeLabel} · ${durationLabel}` : timeLabel;
  },

  getDropMinutes(hourContent, e) {
    const rect = hourContent.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const percentage = relativeY / rect.height;

    // Snap to nearest 15 minutes
    const rawMinutes = percentage * 60;
    const snappedMinutes = Math.round(rawMinutes / 15) * 15;

    return Math.max(0, Math.min(45, snappedMinutes));
  },

  updateDropIndicator(hourContent, e) {
    this.removeDropIndicator();

    const minutes = this.getDropMinutes(hourContent, e);
    const percentage = (minutes / 60) * 100;

    const indicator = document.createElement('div');
    indicator.className = 'timeline-drop-indicator';
    indicator.style.top = `${percentage}%`;
    indicator.innerHTML = `<span>${this.formatMinutes(minutes)}</span>`;

    hourContent.appendChild(indicator);
  },

  removeDropIndicator() {
    document.querySelectorAll('.timeline-drop-indicator').forEach(el => el.remove());
  },

  formatMinutes(minutes) {
    if (minutes === 0) return ':00';
    return `:${String(minutes).padStart(2, '0')}`;
  },

  async scheduleTask(taskId, type, hour, minutes = 0) {
    const tasks = type === 'planned'
      ? (this.currentEntry.planned || [])
      : (this.currentEntry.log || []);
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const timeStr = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    if (type === 'planned') {
      task.scheduledTime = timeStr;
    } else {
      task.startTime = timeStr;
    }
    await this.saveEntry();
    this.renderTimeline();
    this.renderTasks();
  },

  async unscheduleTask(taskId, type) {
    const tasks = type === 'planned'
      ? (this.currentEntry.planned || [])
      : (this.currentEntry.log || []);
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (type === 'planned') {
      task.scheduledTime = null;
    } else {
      task.startTime = null;
    }
    await this.saveEntry();
    this.renderTimeline();
    this.renderTasks();
  },

  // ========================================
  // Google Calendar Import (OAuth + API)
  // ========================================

  _gcalParsedEvents: null,
  _gcalAccessToken: null,
  _gcalTokenExpiry: null,
  _gcalTokenClient: null,

  hasValidGCalToken() {
    // Check in-memory first, then sessionStorage (survives page refresh)
    if (this._gcalAccessToken && this._gcalTokenExpiry && Date.now() < this._gcalTokenExpiry) {
      return true;
    }
    try {
      const token = sessionStorage.getItem('gcalAccessToken');
      const expiry = parseInt(sessionStorage.getItem('gcalTokenExpiry') || '0');
      if (token && Date.now() < expiry) {
        this._gcalAccessToken = token;
        this._gcalTokenExpiry = expiry;
        return true;
      }
    } catch {}
    return false;
  },

  openGCalImportModal() {
    const modal = document.getElementById('gcal-import-modal');
    this._gcalParsedEvents = null;
    document.getElementById('gcal-file-input').value = '';
    document.querySelector('#gcal-import-modal h3').textContent =
      `Import — ${Utils.formatDateDisplay(this.currentDate)}`;
    document.getElementById('gcal-events-list').classList.add('hidden');
    document.getElementById('gcal-no-events').classList.add('hidden');
    document.getElementById('gcal-import-btn').classList.add('hidden');

    const clientId = (storage.getConfig().googleClientId || '').trim();
    document.getElementById('gcal-setup-msg').classList.toggle('hidden', !!clientId);
    document.getElementById('gcal-file-details').open = !clientId;

    if (clientId && this.hasValidGCalToken()) {
      document.getElementById('gcal-connect-btn').classList.add('hidden');
      document.getElementById('gcal-connected-bar').classList.remove('hidden');
      document.getElementById('gcal-date-selector').classList.remove('hidden');
      modal.classList.remove('hidden');
      this.fetchGCalEventsFromAPI();
    } else if (clientId) {
      // Try silent reconnect — no popup if already authorized
      document.getElementById('gcal-connect-btn').classList.add('hidden');
      document.getElementById('gcal-connected-bar').classList.add('hidden');
      document.getElementById('gcal-date-selector').classList.add('hidden');
      modal.classList.remove('hidden');
      this.connectGoogleCalendar(true);
    } else {
      document.getElementById('gcal-connect-btn').classList.add('hidden');
      document.getElementById('gcal-connected-bar').classList.add('hidden');
      document.getElementById('gcal-date-selector').classList.add('hidden');
      modal.classList.remove('hidden');
    }
  },

  closeGCalImportModal() {
    document.getElementById('gcal-import-modal').classList.add('hidden');
    this._gcalParsedEvents = null;
  },

  async loadGIS() {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(script);
    });
  },

  async connectGoogleCalendar(silent = false) {
    const clientId = (storage.getConfig().googleClientId || '').trim();
    if (!clientId) { App.updateStatus('Add Google Client ID in Settings first'); return; }

    const btn = document.getElementById('gcal-connect-btn');
    if (!silent) {
      btn.textContent = 'Connecting…';
      btn.disabled = true;
    }

    try {
      await this.loadGIS();
      this._gcalTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        callback: (resp) => {
          if (resp.error) {
            // Silent auth failed — show Connect button for manual auth
            btn.textContent = 'Connect Google Calendar';
            btn.disabled = false;
            btn.classList.remove('hidden');
            if (!silent) App.updateStatus('Google auth failed: ' + resp.error);
            return;
          }
          this._gcalAccessToken = resp.access_token;
          this._gcalTokenExpiry = Date.now() + resp.expires_in * 1000 - 60000;
          try {
            sessionStorage.setItem('gcalAccessToken', this._gcalAccessToken);
            sessionStorage.setItem('gcalTokenExpiry', String(this._gcalTokenExpiry));
          } catch {}
          btn.classList.add('hidden');
          document.getElementById('gcal-connected-bar').classList.remove('hidden');
          document.getElementById('gcal-date-selector').classList.remove('hidden');
          this.fetchGCalEventsFromAPI();
        }
      });
      this._gcalTokenClient.requestAccessToken({ prompt: silent ? '' : 'select_account' });
    } catch (err) {
      btn.textContent = 'Connect Google Calendar';
      btn.disabled = false;
      App.updateStatus('Failed to load Google auth: ' + err.message);
    }
  },

  async fetchGCalEventsFromAPI() {
    const dateKey = Utils.formatDateKey(this.currentDate);
    const [y, m, d] = dateKey.split('-').map(Number);
    const timeMin = new Date(y, m - 1, d, 0, 0, 0).toISOString();
    const timeMax = new Date(y, m - 1, d, 23, 59, 59).toISOString();

    const filterBtn = document.getElementById('gcal-filter-btn');
    filterBtn.textContent = 'Loading…';
    filterBtn.disabled = true;

    try {
      // Fetch all calendars
      const calResp = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { Authorization: `Bearer ${this._gcalAccessToken}` }
      });
      if (calResp.status === 401) { this._gcalAccessToken = null; this._handleGCalExpired(); return; }
      if (!calResp.ok) throw new Error(`Calendar list failed: ${calResp.status}`);
      const calList = await calResp.json();

      // Fetch events from each visible calendar
      const allEvents = [];
      for (const cal of (calList.items || [])) {
        if (cal.selected === false) continue;
        try {
          const evResp = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events` +
            `?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}` +
            `&singleEvents=true&orderBy=startTime&maxResults=50`,
            { headers: { Authorization: `Bearer ${this._gcalAccessToken}` } }
          );
          if (!evResp.ok) continue;
          const data = await evResp.json();
          for (const ev of (data.items || [])) {
            const converted = this.convertGCalEvent(ev, dateKey);
            if (converted) allEvents.push(converted);
          }
        } catch { /* skip calendar on error */ }
      }

      allEvents.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
      this._gcalParsedEvents = allEvents;
      this.renderGCalEvents(allEvents, dateKey);
    } catch (err) {
      App.updateStatus('Error fetching events: ' + err.message);
    } finally {
      filterBtn.textContent = 'Refresh';
      filterBtn.disabled = false;
    }
  },

  _handleGCalExpired() {
    this._gcalAccessToken = null;
    this._gcalTokenExpiry = null;
    try { sessionStorage.removeItem('gcalAccessToken'); sessionStorage.removeItem('gcalTokenExpiry'); } catch {}
    document.getElementById('gcal-connected-bar').classList.add('hidden');
    document.getElementById('gcal-connect-btn').textContent = 'Reconnect Google Calendar';
    document.getElementById('gcal-connect-btn').disabled = false;
    document.getElementById('gcal-connect-btn').classList.remove('hidden');
    App.updateStatus('Google session expired — please reconnect');
  },

  convertGCalEvent(ev, dateKey) {
    const summary = ev.summary || '(No title)';
    const description = (ev.description || '').replace(/<[^>]+>/g, '').trim();

    if (ev.start.date) {
      // All-day event — only include if dateKey matches
      if (ev.start.date !== dateKey) return null;
      return { summary, description, dateKey, time: null, duration: null, allDay: true, eventId: ev.id };
    }

    const start = new Date(ev.start.dateTime);
    const end = new Date(ev.end.dateTime);
    if (isNaN(start.getTime())) return null;
    const time = `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`;
    const durationMin = Math.round((end - start) / 60000);
    return {
      summary, description,
      dateKey: Utils.formatDateKey(start),
      time,
      duration: durationMin > 0 ? Utils.formatDuration(durationMin) : null,
      allDay: false,
      eventId: ev.id
    };
  },

  onGCalFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const events = this.parseICS(evt.target.result);
      this._gcalParsedEvents = events;
      document.getElementById('gcal-date-selector').classList.remove('hidden');
      this.filterGCalEvents();
    };
    reader.readAsText(file);
  },

  filterGCalEvents() {
    if (this.hasValidGCalToken()) {
      this.fetchGCalEventsFromAPI();
    } else {
      const dateKey = Utils.formatDateKey(this.currentDate);
      const events = this._gcalParsedEvents || [];
      const filtered = events.filter(ev => ev.dateKey === dateKey);
      this.renderGCalEvents(filtered, dateKey);
    }
  },

  renderGCalEvents(events, dateKey) {
    const listEl = document.getElementById('gcal-events-list');
    const noEventsEl = document.getElementById('gcal-no-events');
    const countEl = document.getElementById('gcal-events-count');
    const itemsEl = document.getElementById('gcal-events-items');
    const importBtn = document.getElementById('gcal-import-btn');

    if (events.length === 0) {
      listEl.classList.add('hidden');
      noEventsEl.classList.remove('hidden');
      importBtn.classList.add('hidden');
      return;
    }

    noEventsEl.classList.add('hidden');
    countEl.textContent = `${events.length} event${events.length === 1 ? '' : 's'} on ${dateKey}`;

    itemsEl.innerHTML = events.map((ev, i) => `
      <label class="gcal-event-item">
        <input type="checkbox" class="gcal-event-check" data-index="${i}" checked>
        <div class="gcal-event-details">
          <span class="gcal-event-title">${this.escapeHtml(ev.summary)}</span>
          ${ev.time ? `<span class="gcal-event-time">${this.formatTime(ev.time)}${ev.duration ? ' · ' + ev.duration : ''}</span>` : (ev.allDay ? '<span class="gcal-event-time">All day</span>' : '')}
          ${ev.description ? `<span class="gcal-event-desc">${this.escapeHtml(ev.description.slice(0, 80))}${ev.description.length > 80 ? '…' : ''}</span>` : ''}
        </div>
      </label>
    `).join('');

    listEl.classList.remove('hidden');
    importBtn.classList.remove('hidden');
  },

  toggleSelectAllGCalEvents() {
    const checks = document.querySelectorAll('.gcal-event-check');
    const allChecked = Array.from(checks).every(c => c.checked);
    checks.forEach(c => { c.checked = !allChecked; });
    document.getElementById('gcal-select-all').textContent = allChecked ? 'Select all' : 'Deselect all';
  },

  importGCalEvents() {
    const dateKey = Utils.formatDateKey(this.currentDate);
    const checks = document.querySelectorAll('.gcal-event-check');
    const events = this._gcalParsedEvents || [];
    const filtered = events.filter(ev => ev.dateKey === dateKey);

    const selected = Array.from(checks)
      .filter(c => c.checked)
      .map(c => filtered[parseInt(c.dataset.index)])
      .filter(Boolean);

    if (selected.length === 0) {
      alert('No events selected.');
      return;
    }

    const targetEntry = storage.getDayEntry(dateKey);
    if (!targetEntry.planned) targetEntry.planned = [];

    let added = 0, skipped = 0;
    for (const ev of selected) {
      // Check if already imported by gcalEventId
      const existing = ev.eventId
        ? targetEntry.planned.find(t => t.gcalEventId === ev.eventId)
        : null;

      if (existing) {
        // Update calendar-sourced fields only; preserve user's notes and status
        existing.text = ev.summary;
        existing.scheduledTime = ev.time || null;
        existing.duration = ev.duration || null;
        existing.gcalDescription = ev.description || null;
        skipped++;
      } else {
        targetEntry.planned.push({
          id: Utils.generateId(),
          text: ev.summary,
          scheduledTime: ev.time || null,
          duration: ev.duration || null,
          status: 'not-started',
          notes: '',
          gcalDescription: ev.description || null,
          importedFrom: 'gcal',
          gcalEventId: ev.eventId || null,
          createdAt: new Date().toISOString()
        });
        added++;
      }
    }

    storage.setDayEntry(dateKey, targetEntry);

    // Refresh view if importing for current date
    if (dateKey === Utils.formatDateKey(this.currentDate)) {
      this.currentEntry = targetEntry;
      this.renderTasks();
      this.renderTimeline();
    }

    this.closeGCalImportModal();
    const msg = skipped > 0
      ? `Imported ${added}, skipped ${skipped} already imported`
      : `Imported ${added} event${added === 1 ? '' : 's'} as planned tasks`;
    App.updateStatus(msg);
  },

  // ========================================
  // ICS Parser
  // ========================================

  parseICS(text) {
    // Unfold continuation lines
    const unfolded = text.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);

    const events = [];
    let current = null;

    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        current = {};
      } else if (line === 'END:VEVENT') {
        if (current && current.summary) {
          const parsed = this.processICSEvent(current);
          if (parsed) events.push(parsed);
        }
        current = null;
      } else if (current) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;

        const keyPart = line.substring(0, colonIdx);
        const value = line.substring(colonIdx + 1);
        const baseKey = keyPart.split(';')[0].toUpperCase();
        const params = keyPart.includes(';') ? keyPart.split(';').slice(1) : [];

        if (baseKey === 'SUMMARY') {
          current.summary = this.unescapeICS(value);
        } else if (baseKey === 'DESCRIPTION') {
          current.description = this.unescapeICS(value);
        } else if (baseKey === 'DTSTART') {
          current.dtstart = value;
          current.dtstartParams = params;
        } else if (baseKey === 'DTEND') {
          current.dtend = value;
        } else if (baseKey === 'DURATION') {
          current.icsDuration = value;
        } else if (baseKey === 'UID') {
          current.uid = value;
        }
      }
    }

    return events;
  },

  processICSEvent(ev) {
    if (!ev.dtstart) return null;

    const isAllDay = ev.dtstartParams.some(p => p.toUpperCase().includes('VALUE=DATE')) || /^\d{8}$/.test(ev.dtstart);

    if (isAllDay) {
      const raw = ev.dtstart.replace(/[^\d]/g, '');
      const dateKey = `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
      return { summary: ev.summary, description: ev.description || '', dateKey, time: null, duration: null, allDay: true, eventId: ev.uid || null };
    }

    // Parse datetime
    let dateObj;
    if (/Z$/.test(ev.dtstart)) {
      // UTC
      const s = ev.dtstart;
      dateObj = new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(9,11)}:${s.slice(11,13)}:${s.slice(13,15)}Z`);
    } else {
      // Floating/TZID — treat as local
      const s = ev.dtstart;
      dateObj = new Date(parseInt(s.slice(0,4)), parseInt(s.slice(4,6))-1, parseInt(s.slice(6,8)),
                         parseInt(s.slice(9,11)), parseInt(s.slice(11,13)));
    }

    if (isNaN(dateObj.getTime())) return null;

    const dateKey = Utils.formatDateKey(dateObj);
    const time = `${String(dateObj.getHours()).padStart(2,'0')}:${String(dateObj.getMinutes()).padStart(2,'0')}`;

    // Calculate duration
    let durationMinutes = 0;
    if (ev.dtend) {
      let endObj;
      if (/Z$/.test(ev.dtend)) {
        const s = ev.dtend;
        endObj = new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(9,11)}:${s.slice(11,13)}:${s.slice(13,15)}Z`);
      } else {
        const s = ev.dtend;
        endObj = new Date(parseInt(s.slice(0,4)), parseInt(s.slice(4,6))-1, parseInt(s.slice(6,8)),
                          parseInt(s.slice(9,11)), parseInt(s.slice(11,13)));
      }
      if (!isNaN(endObj.getTime())) {
        durationMinutes = Math.round((endObj - dateObj) / 60000);
      }
    } else if (ev.icsDuration) {
      durationMinutes = this.parseISODuration(ev.icsDuration);
    }

    const duration = durationMinutes > 0 ? Utils.formatDuration(durationMinutes) : null;

    return { summary: ev.summary, description: ev.description || '', dateKey, time, duration, allDay: false, eventId: ev.uid || null };
  },

  unescapeICS(value) {
    return value
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  },

  parseISODuration(dur) {
    let minutes = 0;
    const days = dur.match(/(\d+)D/);
    const hours = dur.match(/(\d+)H/);
    const mins = dur.match(/(\d+)M/);
    if (days) minutes += parseInt(days[1]) * 24 * 60;
    if (hours) minutes += parseInt(hours[1]) * 60;
    if (mins) minutes += parseInt(mins[1]);
    return minutes;
  },

  // ========================================
  // Projects & Tags
  // ========================================

  _CHIP_COLORS: ['#006A96','#C69214','#1BA87A','#C8323A','#7B61FF','#E67E22','#1ABC9C','#E91E8C'],

  renderProjectChips(selectedIds) {
    this._renderChips('task-project-chips', storage.getProjects(), selectedIds, false);
  },

  renderTagChips(selectedIds) {
    const container = document.getElementById('task-tag-chips');
    const groups = storage.getTagGroups();
    const tags = storage.getTags();

    if (groups.length === 0) {
      container.innerHTML = '<span class="chip-empty">No tags — add groups in Settings</span>';
      return;
    }

    container.innerHTML = groups.map(group => {
      const groupTags = tags.filter(t => t.groupId === group.id);
      if (!groupTags.length) return '';
      return `
        <div class="chip-group">
          <span class="chip-group-label" style="color:${group.color}">${this.escapeHtml(group.name)}</span>
          <div class="chip-group-tags">
            ${groupTags.map(tag => {
              const active = selectedIds.includes(tag.id);
              return `<button type="button" class="chip${active ? ' chip-active' : ''}"
                data-id="${tag.id}" data-color="${group.color}"
                style="${active ? `background:${group.color};border-color:${group.color};color:#fff` : `border-color:${group.color}60;color:${group.color}`}">
                ${this.escapeHtml(tag.name)}
              </button>`;
            }).join('')}
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const wasActive = btn.classList.contains('chip-active');
        if (wasActive) {
          btn.classList.remove('chip-active');
          btn.style.background = '';
          btn.style.borderColor = `${btn.dataset.color}60`;
          btn.style.color = btn.dataset.color;
        } else {
          btn.classList.add('chip-active');
          btn.style.background = btn.dataset.color;
          btn.style.borderColor = btn.dataset.color;
          btn.style.color = '#fff';
          // Auto-fill task name if empty
          const nameEl = document.getElementById('task-text');
          if (nameEl && !nameEl.value.trim()) {
            nameEl.value = btn.textContent.trim();
          }
        }
      });
    });
  },

  _renderChips(containerId, items, selectedIds, multiSelect) {
    const container = document.getElementById(containerId);
    if (!items.length) {
      container.innerHTML = '<span class="chip-empty">None yet</span>';
      return;
    }
    container.innerHTML = items.map(item => {
      const active = selectedIds.includes(item.id);
      return `<button type="button" class="chip${active ? ' chip-active' : ''}"
        data-id="${item.id}" data-color="${item.color}"
        style="${active ? `background:${item.color};border-color:${item.color};color:#fff` : `border-color:${item.color}60;color:${item.color}`}">
        ${this.escapeHtml(item.name)}
      </button>`;
    }).join('');
    container.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!multiSelect) {
          // Single select: deselect others in this container
          container.querySelectorAll('.chip').forEach(b => {
            b.classList.remove('chip-active');
            b.style.background = '';
            b.style.borderColor = `${b.dataset.color}60`;
            b.style.color = b.dataset.color;
          });
        }
        const wasActive = btn.classList.contains('chip-active');
        if (wasActive) {
          btn.classList.remove('chip-active');
          btn.style.background = '';
          btn.style.borderColor = `${btn.dataset.color}60`;
          btn.style.color = btn.dataset.color;
        } else {
          btn.classList.add('chip-active');
          btn.style.background = btn.dataset.color;
          btn.style.borderColor = btn.dataset.color;
          btn.style.color = '#fff';
        }
      });
    });
  },

  getSelectedChipIds(containerId) {
    return Array.from(document.querySelectorAll(`#${containerId} .chip-active`))
      .map(b => b.dataset.id);
  },

  showInlineAdd(type) {
    const form = document.getElementById(`task-new-${type}-form`);
    const btn = document.getElementById(`task-add-${type}-btn`);
    const colorsEl = document.getElementById(`task-new-${type}-colors`);
    colorsEl.innerHTML = this._CHIP_COLORS.map((c, i) =>
      `<button type="button" class="color-swatch${i === 0 ? ' color-swatch-active' : ''}" data-color="${c}" style="background:${c}"></button>`
    ).join('');
    colorsEl.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        colorsEl.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('color-swatch-active'));
        sw.classList.add('color-swatch-active');
      });
    });
    form.classList.remove('hidden');
    btn.classList.add('hidden');
    document.getElementById(`task-new-${type}-name`).focus();
  },

  hideInlineAdd(type) {
    document.getElementById(`task-new-${type}-form`).classList.add('hidden');
    document.getElementById(`task-add-${type}-btn`).classList.remove('hidden');
    document.getElementById(`task-new-${type}-name`).value = '';
  },

  saveNewItem(type) {
    const nameEl = document.getElementById(`task-new-${type}-name`);
    const name = nameEl.value.trim();
    if (!name) return;
    const activeSwatch = document.querySelector(`#task-new-${type}-colors .color-swatch-active`);
    const color = activeSwatch ? activeSwatch.dataset.color : this._CHIP_COLORS[0];
    const newItem = { id: Utils.generateId(), name, color };

    if (type === 'project') {
      const projects = storage.getProjects();
      projects.push(newItem);
      storage.setProjects(projects);
      const selected = this.getSelectedChipIds('task-project-chips');
      this.renderProjectChips([...selected, newItem.id]);
    } else {
      const tags = storage.getTags();
      tags.push(newItem);
      storage.setTags(tags);
      const selected = this.getSelectedChipIds('task-tag-chips');
      this.renderTagChips([...selected, newItem.id]);
    }
    this.hideInlineAdd(type);
  },

  // ========================================
  // Utilities
  // ========================================

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Export
window.DailyView = DailyView;
