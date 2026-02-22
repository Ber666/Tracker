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
    document.getElementById('add-task-btn').addEventListener('click', () => this.openTaskModal());
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

    // Auto-save on input changes (sleep fields only - editors handle their own)
    const autoSaveInputs = ['bed-time', 'wake-time', 'sleep-comment'];

    autoSaveInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => this.autoSave());
        el.addEventListener('input', Utils.debounce(() => this.autoSave(), 1000));
      }
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
    const unplannedTasks = tasks.filter(t => !t.planned);

    // Render planned tasks
    if (plannedTasks.length === 0) {
      plannedContainer.innerHTML = '<div class="empty-state">No planned tasks</div>';
    } else {
      plannedContainer.innerHTML = plannedTasks.map(task => this.renderTaskItem(task)).join('');
    }

    // Render unplanned tasks
    if (unplannedTasks.length === 0) {
      unplannedContainer.innerHTML = '<div class="empty-state">No tasks added during day</div>';
    } else {
      unplannedContainer.innerHTML = unplannedTasks.map(task => this.renderTaskItem(task)).join('');
    }

    // Bind click events
    document.querySelectorAll('.task-item').forEach(item => {
      item.addEventListener('click', () => {
        const taskId = item.dataset.taskId;
        this.openTaskModal(taskId);
      });
    });

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
        Unplanned: ${unplannedTasks.length}
      `;
      summaryContainer.style.display = 'block';
    } else {
      summaryContainer.style.display = 'none';
    }
  },

  renderTaskItem(task) {
    const textClass = task.progress === 'done' ? 'task-text done' : 'task-text';
    const scheduledStr = task.scheduledTime ? this.formatTime(task.scheduledTime) : '';
    const hasNotes = task.comment && task.comment.trim().length > 0;
    const notesPreview = hasNotes ? Markdown.preview(task.comment, 80) : '';

    return `
      <div class="task-item" data-task-id="${task.id}">
        <div class="task-progress-indicator ${task.progress}"></div>
        <div class="task-content">
          <div class="${textClass}">${this.escapeHtml(task.text)}</div>
          <div class="task-meta">
            ${scheduledStr ? `<span class="task-time">${scheduledStr}</span>` : ''}
            ${task.expectedTime ? `<span class="task-time">${task.expectedTime}</span>` : ''}
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

  openTaskModal(taskId = null, scheduledHour = null, scheduledMinutes = 0) {
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
        document.getElementById('task-scheduled').value = task.scheduledTime || '';
        document.getElementById('task-time').value = task.expectedTime || '';
        document.getElementById('task-progress').value = task.progress;
        document.getElementById('task-comment').value = task.comment || '';
      }
    } else {
      // New task
      title.textContent = 'Add Task';
      deleteBtn.classList.add('hidden');

      document.getElementById('task-text').value = '';
      document.getElementById('task-scheduled').value = scheduledHour !== null
        ? `${String(scheduledHour).padStart(2, '0')}:${String(scheduledMinutes).padStart(2, '0')}`
        : '';
      document.getElementById('task-time').value = '';
      document.getElementById('task-progress').value = 'not-started';
      document.getElementById('task-comment').value = '';
    }

    modal.classList.remove('hidden');
    document.getElementById('task-text').focus();
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

    const taskData = {
      text,
      scheduledTime,
      expectedTime: document.getElementById('task-time').value.trim() || null,
      progress: document.getElementById('task-progress').value,
      comment: document.getElementById('task-comment').value.trim()
    };

    if (!this.currentEntry.tasks) {
      this.currentEntry.tasks = [];
    }

    if (this.editingTaskId) {
      // Update existing
      const index = this.currentEntry.tasks.findIndex(t => t.id === this.editingTaskId);
      if (index !== -1) {
        this.currentEntry.tasks[index] = {
          ...this.currentEntry.tasks[index],
          ...taskData
        };
      }
    } else {
      // Create new
      const isPlanned = this.isBeforeNoon();
      this.currentEntry.tasks.push({
        id: Utils.generateId(),
        ...taskData,
        planned: isPlanned,
        createdAt: new Date().toISOString()
      });
    }

    this.saveEntry();
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

  isBeforeNoon() {
    // Consider tasks added before noon as "planned"
    const now = new Date();
    return now.getHours() < 12;
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

    // Render timeline grid
    let gridHtml = '';
    for (let hour = this.timelineStartHour; hour <= this.timelineEndHour; hour++) {
      const hourStr = String(hour).padStart(2, '0');
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
        const durationMinutes = Utils.parseDuration(task.expectedTime) || 30; // default 30min
        const hourHeight = hourContent.offsetHeight || 60;
        const heightPx = (durationMinutes / 60) * hourHeight;
        taskNode.style.height = `${Math.max(24, heightPx)}px`; // min 24px

        hourContent.appendChild(taskNode);
      }
    });

    // Add current time indicator
    this.updateCurrentTimeIndicator();

    // Setup drag and drop
    this.setupTimelineDragDrop();
  },

  renderTimelineTask(task, scheduled, minutes = 0) {
    const doneClass = task.progress === 'done' ? 'done' : '';
    const scheduledClass = scheduled ? 'scheduled' : '';
    const timeStr = scheduled && task.scheduledTime ? this.formatTime(task.scheduledTime) : '';

    return `
      <div class="timeline-task ${doneClass} ${scheduledClass}"
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

      // Click on empty area to add task at that time
      hourContent.addEventListener('dblclick', (e) => {
        if (e.target === hourContent || e.target.classList.contains('timeline-drop-indicator')) {
          const hour = parseInt(hourContent.dataset.hour);
          const minutes = this.getDropMinutes(hourContent, e);
          this.openTaskModal(null, hour, minutes);
        }
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
