// ========================================
// Daily View
// ========================================

const DailyView = {
  currentDate: new Date(),
  currentEntry: null,
  editingTaskId: null,
  editingExerciseIndex: null,
  currentTaskView: 'list',
  draggedTask: null,
  timelineStartHour: 6,
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
    // Initialize markdown editors for daily view
    this.editors.workNotes = new MarkdownEditor(
      document.getElementById('work-notes-editor'),
      {
        id: 'work-notes',
        placeholder: 'What did you work on today?',
        rows: 4,
        onchange: () => this.autoSave()
      }
    );

    this.editors.mentalNotes = new MarkdownEditor(
      document.getElementById('mental-notes-editor'),
      {
        id: 'mental-notes',
        placeholder: 'How are you feeling today?',
        rows: 3,
        onchange: () => this.autoSave()
      }
    );

    this.editors.freeform = new MarkdownEditor(
      document.getElementById('freeform-editor'),
      {
        id: 'freeform',
        placeholder: 'Any other thoughts...',
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

    // Task modal
    document.getElementById('add-task-btn').addEventListener('click', () => this.openTaskModal(null, null, 0, true));
    document.getElementById('add-planned-btn').addEventListener('click', () => this.openTaskModal(null, null, 0, true));
    document.getElementById('add-actual-btn').addEventListener('click', () => this.openTaskModal(null, null, 0, false));
    document.getElementById('task-save').addEventListener('click', () => this.saveTask());
    document.getElementById('task-cancel').addEventListener('click', () => this.closeTaskModal());
    document.getElementById('task-delete').addEventListener('click', () => this.deleteTask());

    // Planned checkbox toggles the "links to planned" dropdown
    document.getElementById('task-planned').addEventListener('change', (e) => {
      this.toggleLinkToPlannedVisibility(!e.target.checked);
    });

    // Notes tabs (edit/preview)
    document.querySelectorAll('.notes-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchNotesTab(tab.dataset.tab));
    });

    // Update preview on input
    document.getElementById('task-comment').addEventListener('input', () => {
      this.updateNotesPreview();
    });

    // Exercise modal
    document.getElementById('add-exercise-btn').addEventListener('click', () => this.openExerciseModal());
    document.getElementById('exercise-save').addEventListener('click', () => this.saveExercise());
    document.getElementById('exercise-cancel').addEventListener('click', () => this.closeExerciseModal());
    document.getElementById('exercise-delete').addEventListener('click', () => this.deleteExercise());

    // Modal backdrop clicks
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', () => {
        this.closeTaskModal();
        this.closeExerciseModal();
      });
    });

    // Sleep time inputs
    document.getElementById('bed-time').addEventListener('change', () => this.updateSleepDuration());
    document.getElementById('wake-time').addEventListener('change', () => this.updateSleepDuration());

    // Auto-save on input changes (sleep fields + shift reason)
    const autoSaveInputs = ['bed-time', 'wake-time', 'sleep-comment'];

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
    // Create rating dots for sleep quality, energy, and mood
    const ratingInputs = ['sleep-quality', 'energy-rating', 'mood-rating'];

    ratingInputs.forEach(id => {
      const container = document.getElementById(id);
      if (!container) return;

      container.innerHTML = '';

      for (let i = 1; i <= 10; i++) {
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

  switchTaskView(view) {
    this.currentTaskView = view;

    // Update toggle buttons
    document.querySelectorAll('.toggle-btn[data-task-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.taskView === view);
    });

    // Update view visibility
    document.getElementById('tasks-list-view').classList.toggle('active', view === 'list');
    document.getElementById('tasks-timeline-view').classList.toggle('active', view === 'timeline');

    if (view === 'timeline') {
      this.renderTimeline();
    }
  },

  navigateDay(delta) {
    this.currentDate = Utils.addDays(this.currentDate, delta);
    this.loadDate(this.currentDate);
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

    // Render all sections
    this.renderTasks();
    this.renderTimeline();
    this.renderSleep();
    this.renderExercise();
    this.renderEnergyMental();
    this.renderWorkNotes();
    this.renderFreeform();
  },

  renderTasks() {
    const plannedContainer = document.getElementById('planned-tasks');
    const unplannedContainer = document.getElementById('unplanned-tasks');
    const summaryContainer = document.getElementById('tasks-summary');

    const tasks = this.currentEntry.tasks || [];
    const plannedTasks = tasks.filter(t => t.planned);
    const actualTasks = tasks.filter(t => !t.planned);

    // Render planned tasks
    if (plannedTasks.length === 0) {
      plannedContainer.innerHTML = '<div class="empty-state">No planned tasks — add your morning plan</div>';
    } else {
      plannedContainer.innerHTML = plannedTasks.map(task => this.renderTaskItem(task)).join('');
    }

    // Render actual tasks
    if (actualTasks.length === 0) {
      unplannedContainer.innerHTML = '<div class="empty-state">No actual tasks logged</div>';
    } else {
      unplannedContainer.innerHTML = actualTasks.map(task => this.renderTaskItem(task, tasks)).join('');
    }

    // Bind click events
    document.querySelectorAll('.task-item').forEach(item => {
      item.addEventListener('click', () => {
        const taskId = item.dataset.taskId;
        this.openTaskModal(taskId);
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
    const done = tasks.filter(t => t.progress === 'done').length;
    const half = tasks.filter(t => t.progress === 'half-done').length;
    const notStarted = tasks.filter(t => t.progress === 'not-started').length;

    if (tasks.length > 0) {
      summaryContainer.innerHTML = `
        Planned: ${plannedTasks.length} |
        Done: ${done} |
        Half: ${half} |
        Not Started: ${notStarted} |
        Actual (unlinked): ${actualTasks.filter(t => !t.linkedTaskId).length}
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
      const linked = actualTasks.filter(a => a.linkedTaskId === planned.id);

      // Determine effective status from progress
      const statusClass = planned.progress === 'done' ? 'contrast-done' :
                          planned.progress === 'half-done' ? 'contrast-half' : 'contrast-missed';
      const statusIcon = planned.progress === 'done' ? '✓' :
                         planned.progress === 'half-done' ? '~' : '✗';

      const linkedHtml = linked.map(a => `
        <div class="contrast-linked-actual">
          <span class="contrast-arrow">→</span>
          <span class="contrast-actual-text">${this.escapeHtml(a.text)}</span>
          ${a.expectedTime ? `<span class="contrast-actual-time">${a.expectedTime}</span>` : ''}
        </div>
      `).join('');

      return `
        <div class="contrast-row ${statusClass}">
          <div class="contrast-planned-row">
            <span class="contrast-status">${statusIcon}</span>
            <span class="contrast-task-text">${this.escapeHtml(planned.text)}</span>
            ${planned.expectedTime ? `<span class="contrast-task-time">${planned.expectedTime}</span>` : ''}
          </div>
          ${linkedHtml}
        </div>
      `;
    }).join('');

    // Unlinked actual tasks (pure additions not corresponding to any plan)
    const unlinkedActuals = actualTasks.filter(a => !a.linkedTaskId);
    const additionsHtml = unlinkedActuals.length > 0 ? `
      <div class="contrast-additions">
        <div class="contrast-additions-label">Unplanned additions</div>
        ${unlinkedActuals.map(a => `
          <div class="contrast-addition-row">
            <span class="contrast-plus">+</span>
            <span class="contrast-task-text">${this.escapeHtml(a.text)}</span>
            ${a.expectedTime ? `<span class="contrast-task-time">${a.expectedTime}</span>` : ''}
          </div>
        `).join('')}
      </div>
    ` : '';

    // Summary stats
    const done = plannedTasks.filter(t => t.progress === 'done').length;
    const half = plannedTasks.filter(t => t.progress === 'half-done').length;
    const missed = plannedTasks.filter(t => t.progress === 'not-started').length;

    const statsHtml = `
      <div class="contrast-stats">
        <span class="contrast-stat stat-done">${done}/${plannedTasks.length} done</span>
        ${half > 0 ? `<span class="contrast-stat stat-half">${half} half</span>` : ''}
        ${missed > 0 ? `<span class="contrast-stat stat-missed">${missed} missed</span>` : ''}
        ${unlinkedActuals.length > 0 ? `<span class="contrast-stat stat-added">+${unlinkedActuals.length} added</span>` : ''}
      </div>
    `;

    breakdownEl.innerHTML = statsHtml + plannedRows + additionsHtml;
    panel.classList.remove('hidden');
  },

  renderTaskItem(task, allTasks = []) {
    const textClass = task.progress === 'done' ? 'task-text done' : 'task-text';
    const scheduledStr = task.scheduledTime ? this.formatTime(task.scheduledTime) : '';
    const hasNotes = task.comment && task.comment.trim().length > 0;
    const notesPreview = hasNotes ? Markdown.preview(task.comment, 80) : '';

    // Show linked info: if actual task links to a planned task, show its name
    let linkedBadge = '';
    if (!task.planned && task.linkedTaskId && allTasks.length > 0) {
      const linked = allTasks.find(t => t.id === task.linkedTaskId);
      if (linked) {
        linkedBadge = `<span class="task-linked-badge" title="Links to planned: ${this.escapeHtml(linked.text)}">→ plan</span>`;
      }
    }

    return `
      <div class="task-item" data-task-id="${task.id}">
        <div class="task-progress-indicator ${task.progress}"></div>
        <div class="task-content">
          <div class="${textClass}">${this.escapeHtml(task.text)}</div>
          <div class="task-meta">
            ${scheduledStr ? `<span class="task-time">${scheduledStr}</span>` : ''}
            ${task.expectedTime ? `<span class="task-time">${task.expectedTime}</span>` : ''}
            ${linkedBadge}
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

  renderSleep() {
    const sleep = this.currentEntry.sleep || {};

    document.getElementById('bed-time').value = sleep.bedTime || '';
    document.getElementById('wake-time').value = sleep.wakeTime || '';
    document.getElementById('sleep-comment').value = sleep.comment || '';

    this.displayRating('sleep-quality', sleep.quality || 0);
    this.updateSleepDuration();
  },

  updateSleepDuration() {
    const bedTime = document.getElementById('bed-time').value;
    const wakeTime = document.getElementById('wake-time').value;
    const duration = Utils.calculateSleepDuration(bedTime, wakeTime);

    document.getElementById('sleep-duration').textContent = duration || '--';
  },

  renderExercise() {
    const container = document.getElementById('exercise-list');
    const exercises = this.currentEntry.exercise || [];

    if (exercises.length === 0) {
      container.innerHTML = '<div class="empty-state">No exercise logged</div>';
      return;
    }

    container.innerHTML = exercises.map((ex, index) => `
      <div class="exercise-item" data-index="${index}">
        <span class="exercise-name">${this.escapeHtml(ex.name)}</span>
        <span class="exercise-duration">${ex.duration || ''}</span>
        <span class="exercise-intensity ${ex.intensity}">${ex.intensity}</span>
      </div>
    `).join('');

    // Bind click events
    container.querySelectorAll('.exercise-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        this.openExerciseModal(index);
      });
    });
  },

  renderEnergyMental() {
    this.displayRating('energy-rating', this.currentEntry.energy || 0);
    this.displayRating('mood-rating', this.currentEntry.mental?.mood || 0);
    if (this.editors.mentalNotes) {
      this.editors.mentalNotes.setValue(this.currentEntry.mental?.notes || '');
    }
  },

  renderWorkNotes() {
    if (this.editors.workNotes) {
      this.editors.workNotes.setValue(this.currentEntry.work || '');
    }
  },

  renderFreeform() {
    if (this.editors.freeform) {
      this.editors.freeform.setValue(this.currentEntry.freeform || '');
    }
  },

  // ========================================
  // Task Modal
  // ========================================

  openTaskModal(taskId = null, scheduledHour = null, scheduledMinutes = 0, isPlanned = true, duration = null) {
    const modal = document.getElementById('task-modal');
    const title = document.getElementById('task-modal-title');
    const deleteBtn = document.getElementById('task-delete');

    this.editingTaskId = taskId;

    if (taskId) {
      // Edit existing task
      title.textContent = 'Edit Task';
      deleteBtn.classList.remove('hidden');

      const task = this.currentEntry.tasks.find(t => t.id === taskId);
      if (task) {
        document.getElementById('task-text').value = task.text;
        document.getElementById('task-date').value = Utils.formatDateKey(this.currentDate);
        document.getElementById('task-scheduled').value = task.scheduledTime || '';
        document.getElementById('task-time').value = task.expectedTime || '';
        document.getElementById('task-progress').value = task.progress;
        document.getElementById('task-comment').value = task.comment || '';
        document.getElementById('task-planned').checked = task.planned !== false;
        this.populatePlannedDropdown(task.linkedTaskId || '');
        this.toggleLinkToPlannedVisibility(task.planned === false);
      }
    } else {
      // New task
      title.textContent = isPlanned ? 'Add Planned Task' : 'Add Actual Task';
      deleteBtn.classList.add('hidden');

      document.getElementById('task-text').value = '';
      document.getElementById('task-date').value = Utils.formatDateKey(this.currentDate);
      document.getElementById('task-scheduled').value = scheduledHour !== null
        ? `${String(scheduledHour).padStart(2, '0')}:${String(scheduledMinutes).padStart(2, '0')}`
        : '';
      document.getElementById('task-time').value = duration || '';
      document.getElementById('task-progress').value = 'not-started';
      document.getElementById('task-comment').value = '';
      document.getElementById('task-planned').checked = isPlanned;
      this.populatePlannedDropdown('');
      this.toggleLinkToPlannedVisibility(!isPlanned);
    }

    modal.classList.remove('hidden');
    document.getElementById('task-text').focus();
  },

  copyPlannedToActual(plannedTaskId) {
    const planned = this.currentEntry.tasks.find(t => t.id === plannedTaskId);
    if (!planned) return;

    // Don't duplicate if already linked
    const alreadyLinked = this.currentEntry.tasks.some(t => t.linkedTaskId === plannedTaskId);
    if (alreadyLinked) {
      App.updateStatus('Already linked — edit the existing actual task');
      return;
    }

    const actualTask = {
      id: Utils.generateId(),
      text: planned.text,
      scheduledTime: null,
      expectedTime: planned.expectedTime || null,
      progress: 'not-started',
      comment: '',
      planned: false,
      linkedTaskId: planned.id,
      createdAt: new Date().toISOString()
    };

    this.currentEntry.tasks.push(actualTask);
    this.saveEntry();
    this.renderTasks();
    this.renderTimeline();
    App.updateStatus('Copied to actual — click to edit');
  },

  populatePlannedDropdown(selectedId = '') {
    const select = document.getElementById('task-linked-plan');
    if (!select) return;

    const plannedTasks = (this.currentEntry.tasks || []).filter(t => t.planned);
    select.innerHTML = '<option value="">None (standalone actual)</option>' +
      plannedTasks.map(t => `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${this.escapeHtml(t.text)}</option>`).join('');
  },

  toggleLinkToPlannedVisibility(show) {
    const group = document.getElementById('link-to-planned-group');
    if (group) {
      group.style.display = show ? '' : 'none';
    }
  },

  closeTaskModal() {
    document.getElementById('task-modal').classList.add('hidden');
    this.editingTaskId = null;
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

  saveTask() {
    const text = document.getElementById('task-text').value.trim();
    if (!text) {
      alert('Please enter a task');
      return;
    }

    const scheduledTime = document.getElementById('task-scheduled').value || null;
    const isPlanned = document.getElementById('task-planned').checked;
    const linkedTaskId = !isPlanned
      ? (document.getElementById('task-linked-plan').value || null)
      : null;
    const taskDateKey = document.getElementById('task-date').value || Utils.formatDateKey(this.currentDate);
    const currentDateKey = Utils.formatDateKey(this.currentDate);
    const isSameDay = taskDateKey === currentDateKey;

    const taskData = {
      text,
      scheduledTime,
      expectedTime: document.getElementById('task-time').value.trim() || null,
      progress: document.getElementById('task-progress').value,
      comment: document.getElementById('task-comment').value.trim(),
      planned: isPlanned,
      linkedTaskId
    };

    if (!this.currentEntry.tasks) {
      this.currentEntry.tasks = [];
    }

    if (this.editingTaskId) {
      if (isSameDay) {
        // Update in current day
        const index = this.currentEntry.tasks.findIndex(t => t.id === this.editingTaskId);
        if (index !== -1) {
          this.currentEntry.tasks[index] = { ...this.currentEntry.tasks[index], ...taskData };
        }
        this.saveEntry();
      } else {
        // Move task to a different day
        const existing = this.currentEntry.tasks.find(t => t.id === this.editingTaskId);
        this.currentEntry.tasks = this.currentEntry.tasks.filter(t => t.id !== this.editingTaskId);
        storage.setDayEntry(currentDateKey, this.currentEntry);

        const targetEntry = storage.getDayEntry(taskDateKey);
        if (!targetEntry.tasks) targetEntry.tasks = [];
        targetEntry.tasks.push({ ...existing, ...taskData });
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
        this.currentEntry.tasks.push(newTask);
        this.saveEntry();
      } else {
        const targetEntry = storage.getDayEntry(taskDateKey);
        if (!targetEntry.tasks) targetEntry.tasks = [];
        targetEntry.tasks.push(newTask);
        storage.setDayEntry(taskDateKey, targetEntry);
        App.updateStatus(`Task added to ${taskDateKey}`);
      }
    }

    this.closeTaskModal();
    this.renderTasks();
    this.renderTimeline();
  },

  deleteTask() {
    if (!this.editingTaskId) return;

    if (confirm('Delete this task?')) {
      this.currentEntry.tasks = this.currentEntry.tasks.filter(t => t.id !== this.editingTaskId);
      this.saveEntry();
      this.closeTaskModal();
      this.renderTasks();
      this.renderTimeline();
    }
  },

  // ========================================
  // Exercise Modal
  // ========================================

  openExerciseModal(index = null) {
    const modal = document.getElementById('exercise-modal');
    const title = document.getElementById('exercise-modal-title');
    const deleteBtn = document.getElementById('exercise-delete');

    this.editingExerciseIndex = index;

    if (index !== null) {
      // Edit existing
      title.textContent = 'Edit Exercise';
      deleteBtn.classList.remove('hidden');

      const exercise = this.currentEntry.exercise[index];
      if (exercise) {
        document.getElementById('exercise-name').value = exercise.name;
        document.getElementById('exercise-duration').value = exercise.duration || '';
        document.getElementById('exercise-intensity').value = exercise.intensity || 'medium';
        document.getElementById('exercise-comment').value = exercise.comment || '';
      }
    } else {
      // New exercise
      title.textContent = 'Add Exercise';
      deleteBtn.classList.add('hidden');

      document.getElementById('exercise-name').value = '';
      document.getElementById('exercise-duration').value = '';
      document.getElementById('exercise-intensity').value = 'medium';
      document.getElementById('exercise-comment').value = '';
    }

    modal.classList.remove('hidden');
    document.getElementById('exercise-name').focus();
  },

  closeExerciseModal() {
    document.getElementById('exercise-modal').classList.add('hidden');
    this.editingExerciseIndex = null;
  },

  saveExercise() {
    const name = document.getElementById('exercise-name').value.trim();
    if (!name) {
      alert('Please enter an activity name');
      return;
    }

    const exerciseData = {
      name,
      duration: document.getElementById('exercise-duration').value.trim() || null,
      intensity: document.getElementById('exercise-intensity').value,
      comment: document.getElementById('exercise-comment').value.trim()
    };

    if (!this.currentEntry.exercise) {
      this.currentEntry.exercise = [];
    }

    if (this.editingExerciseIndex !== null) {
      // Update existing
      this.currentEntry.exercise[this.editingExerciseIndex] = exerciseData;
    } else {
      // Add new
      this.currentEntry.exercise.push(exerciseData);
    }

    this.saveEntry();
    this.closeExerciseModal();
    this.renderExercise();
  },

  deleteExercise() {
    if (this.editingExerciseIndex === null) return;

    if (confirm('Delete this exercise?')) {
      this.currentEntry.exercise.splice(this.editingExerciseIndex, 1);
      this.saveEntry();
      this.closeExerciseModal();
      this.renderExercise();
    }
  },

  // ========================================
  // Auto-save
  // ========================================

  autoSave() {
    this.collectFormData();
    this.saveEntry();
  },

  collectFormData() {
    // Sleep
    this.currentEntry.sleep = {
      bedTime: document.getElementById('bed-time').value,
      wakeTime: document.getElementById('wake-time').value,
      quality: this.getRating('sleep-quality'),
      comment: document.getElementById('sleep-comment').value
    };

    // Energy
    this.currentEntry.energy = this.getRating('energy-rating');

    // Mental
    this.currentEntry.mental = {
      mood: this.getRating('mood-rating'),
      notes: this.editors.mentalNotes ? this.editors.mentalNotes.getValue() : ''
    };

    // Work notes
    this.currentEntry.work = this.editors.workNotes ? this.editors.workNotes.getValue() : '';

    // Freeform
    this.currentEntry.freeform = this.editors.freeform ? this.editors.freeform.getValue() : '';

    // Shift reason (plan vs reality)
    const shiftReasonEl = document.getElementById('plan-shift-reason');
    this.currentEntry.shiftReason = shiftReasonEl ? shiftReasonEl.value : '';
  },

  saveEntry() {
    const dateKey = Utils.formatDateKey(this.currentDate);
    storage.setDayEntry(dateKey, this.currentEntry);
    App.updateStatus('Saved locally');
  },

  // ========================================
  // Timeline View
  // ========================================

  renderTimeline() {
    const gridContainer = document.getElementById('timeline-grid');
    const unscheduledContainer = document.getElementById('unscheduled-tasks');

    if (!gridContainer || !unscheduledContainer) return;

    const tasks = this.currentEntry.tasks || [];
    const scheduledTasks = tasks.filter(t => t.scheduledTime);
    const unscheduledTasks = tasks.filter(t => !t.scheduledTime);

    // Render unscheduled tasks
    if (unscheduledTasks.length === 0) {
      unscheduledContainer.innerHTML = '<span class="empty-state" style="padding: 8px;">Drag tasks here to unschedule</span>';
    } else {
      unscheduledContainer.innerHTML = unscheduledTasks.map(task =>
        this.renderTimelineTask(task, false)
      ).join('');
    }

    // Render timeline grid with column headers
    let gridHtml = `
      <div class="timeline-col-labels">
        <div class="timeline-hour-label"></div>
        <div class="timeline-col-header-content">
          <div class="timeline-col-label-planned">Planned</div>
          <div class="timeline-col-label-actual">Actual</div>
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

    // Place scheduled tasks
    scheduledTasks.forEach(task => {
      const [hourStr, minStr] = task.scheduledTime.split(':');
      const hour = parseInt(hourStr);
      const minutes = parseInt(minStr) || 0;
      const hourContent = gridContainer.querySelector(`.timeline-hour-content[data-hour="${hour}"]`);

      if (hourContent) {
        const taskEl = document.createElement('div');
        taskEl.innerHTML = this.renderTimelineTask(task, true, minutes);
        const taskNode = taskEl.firstElementChild;

        // Position based on minutes within the hour
        const topPercent = (minutes / 60) * 100;
        taskNode.style.top = `${topPercent}%`;

        // Calculate height based on duration
        const durationMinutes = Utils.parseDuration(task.expectedTime) || 30;
        const hourHeight = hourContent.offsetHeight || 60;
        const heightPx = (durationMinutes / 60) * hourHeight;
        taskNode.style.height = `${Math.max(24, heightPx)}px`;

        hourContent.appendChild(taskNode);
      }
    });

    // Add current time indicator
    this.updateCurrentTimeIndicator();

    // Setup drag and drop + draw-to-create
    this.setupTimelineDragDrop();
    this.setupTimelineDraw();
  },

  renderTimelineTask(task, scheduled, minutes = 0) {
    const doneClass = task.progress === 'done' ? 'done' : '';
    const scheduledClass = scheduled ? 'scheduled' : '';
    const sideClass = scheduled ? (task.planned !== false ? 'planned-side' : 'actual-side') : '';
    const timeStr = scheduled && task.scheduledTime ? this.formatTime(task.scheduledTime) : '';

    return `
      <div class="timeline-task ${doneClass} ${scheduledClass} ${sideClass}"
           data-task-id="${task.id}"
           draggable="true">
        <div class="task-progress-indicator ${task.progress}"></div>
        ${timeStr ? `<span class="timeline-task-time">${timeStr}</span>` : ''}
        <span class="timeline-task-text">${this.escapeHtml(task.text)}</span>
        ${task.expectedTime ? `<span class="timeline-task-duration">${task.expectedTime}</span>` : ''}
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
    const unscheduledPool = document.getElementById('unscheduled-tasks');

    // Task drag start
    timelineTasks.forEach(taskEl => {
      taskEl.addEventListener('dragstart', (e) => {
        this.draggedTask = taskEl.dataset.taskId;
        taskEl.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', taskEl.dataset.taskId);
      });

      taskEl.addEventListener('dragend', () => {
        taskEl.classList.remove('dragging');
        this.draggedTask = null;
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      });

      // Click to edit
      taskEl.addEventListener('click', (e) => {
        if (!taskEl.classList.contains('dragging')) {
          this.openTaskModal(taskEl.dataset.taskId);
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
        const hour = parseInt(hourContent.dataset.hour);
        const minutes = this.getDropMinutes(hourContent, e);

        this.scheduleTask(taskId, hour, minutes);
      });

    });

    // Unscheduled pool drop zone
    if (unscheduledPool) {
      unscheduledPool.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        unscheduledPool.classList.add('drag-over');
      });

      unscheduledPool.addEventListener('dragleave', () => {
        unscheduledPool.classList.remove('drag-over');
      });

      unscheduledPool.addEventListener('drop', (e) => {
        e.preventDefault();
        unscheduledPool.classList.remove('drag-over');

        const taskId = e.dataTransfer.getData('text/plain');
        this.unscheduleTask(taskId);
      });
    }
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
      return relX < contentWidth * 0.5 ? 'planned' : 'actual';
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
      const isPlanned = drawSide === 'planned';

      if (dragDistance < 10 || durationMin < 15) {
        // Treat as click: open modal at this time
        this.openTaskModal(null, drawStartTime.hour, drawStartTime.minutes, isPlanned);
      } else {
        // Drag: pre-fill duration
        const actualStart = startMin <= endMin ? drawStartTime : endTime;
        const durationStr = durationMin >= 60
          ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? durationMin % 60 + 'm' : ''}`
          : `${durationMin}m`;
        this.openTaskModal(null, actualStart.hour, actualStart.minutes, isPlanned, durationStr);
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

  scheduleTask(taskId, hour, minutes = 0) {
    const task = this.currentEntry.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.scheduledTime = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    this.saveEntry();
    this.renderTimeline();
    this.renderTasks();
  },

  unscheduleTask(taskId) {
    const task = this.currentEntry.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.scheduledTime = null;
    this.saveEntry();
    this.renderTimeline();
    this.renderTasks();
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
