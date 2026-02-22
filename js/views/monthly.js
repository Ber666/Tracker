// ========================================
// Monthly View
// ========================================

const MonthlyView = {
  currentDate: new Date(),
  currentSummary: null,
  editors: {},

  init() {
    this.initEditors();
    this.bindEvents();
    this.loadMonth(this.currentDate);
  },

  initEditors() {
    this.editors.achievements = new MarkdownEditor(
      document.getElementById('monthly-achievements-editor'),
      {
        id: 'monthly-achievements',
        placeholder: 'What did you achieve this month?',
        rows: 4,
        onchange: () => this.autoSave()
      }
    );

    this.editors.reflections = new MarkdownEditor(
      document.getElementById('monthly-reflections-editor'),
      {
        id: 'monthly-reflections',
        placeholder: 'Reflect on your month...',
        rows: 4,
        onchange: () => this.autoSave()
      }
    );

    this.editors.nextMonthGoals = new MarkdownEditor(
      document.getElementById('next-month-goals-editor'),
      {
        id: 'next-month-goals',
        placeholder: 'Goals for next month...',
        rows: 3,
        onchange: () => this.autoSave()
      }
    );
  },

  bindEvents() {
    // Month navigation
    document.getElementById('prev-month').addEventListener('click', () => this.navigateMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => this.navigateMonth(1));
    document.getElementById('this-month-btn').addEventListener('click', () => this.goToThisMonth());
  },

  navigateMonth(delta) {
    this.currentDate = Utils.addMonths(this.currentDate, delta);
    this.loadMonth(this.currentDate);
  },

  goToThisMonth() {
    this.currentDate = new Date();
    this.loadMonth(this.currentDate);
  },

  loadMonth(date) {
    this.currentDate = date;
    const monthKey = Utils.formatMonthKey(date);

    // Update header
    document.getElementById('current-month').textContent = Utils.formatMonthDisplay(date);

    // Load summary
    this.currentSummary = storage.getMonthlySummary(monthKey);

    // Render sections
    this.renderCalendar();
    this.renderHealthTrends();
    this.renderFormFields();
  },

  renderCalendar() {
    const container = document.getElementById('month-calendar');
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const days = Utils.getMonthDays(year, month);
    const today = new Date();

    // Add header row
    const headers = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let html = headers.map(h => `<div class="calendar-header">${h}</div>`).join('');

    // Add day cells
    html += days.map(day => {
      if (!day) {
        return '<div class="calendar-day empty"></div>';
      }

      const dateKey = Utils.formatDateKey(day);
      const entry = storage.getDayEntry(dateKey);
      const hasEntry = entry && (entry.tasks?.length > 0 || entry.work || entry.sleep?.bedTime);
      const isToday = Utils.isSameDay(day, today);
      const isFuture = Utils.isFuture(day);

      let classes = 'calendar-day';
      if (hasEntry) classes += ' has-entry';
      if (isToday) classes += ' today';
      if (isFuture) classes += ' future';

      return `<div class="${classes}" data-date="${dateKey}">${day.getDate()}</div>`;
    }).join('');

    container.innerHTML = html;

    // Bind click events
    container.querySelectorAll('.calendar-day:not(.empty)').forEach(dayEl => {
      dayEl.addEventListener('click', () => {
        const dateKey = dayEl.dataset.date;
        if (!dateKey) return;

        const [year, month, day] = dateKey.split('-').map(Number);
        DailyView.loadDate(new Date(year, month - 1, day));

        // Switch to daily view
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('[data-view="daily"]').classList.add('active');
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('daily-view').classList.add('active');
      });
    });
  },

  renderHealthTrends() {
    const container = document.getElementById('monthly-health');
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Collect stats from all days in month
    let totalSleepMinutes = 0;
    let sleepCount = 0;
    let totalSleepQuality = 0;
    let sleepQualityCount = 0;
    let totalEnergy = 0;
    let energyCount = 0;
    let totalMood = 0;
    let moodCount = 0;
    let exerciseDays = 0;
    let totalExerciseMinutes = 0;
    const exerciseTypes = {};
    let tasksCompleted = 0;
    let totalTasks = 0;
    let entriesCount = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(year, month, d);
      if (Utils.isFuture(day)) continue;

      const dateKey = Utils.formatDateKey(day);
      const entry = storage.getDayEntry(dateKey);

      if (!entry || (!entry.tasks?.length && !entry.work && !entry.sleep?.bedTime)) {
        continue;
      }

      entriesCount++;

      // Sleep
      const sleepDuration = Utils.calculateSleepDuration(
        entry?.sleep?.bedTime,
        entry?.sleep?.wakeTime
      );
      if (sleepDuration) {
        totalSleepMinutes += Utils.parseDuration(sleepDuration);
        sleepCount++;
      }
      if (entry?.sleep?.quality) {
        totalSleepQuality += entry.sleep.quality;
        sleepQualityCount++;
      }

      // Energy
      if (entry?.energy) {
        totalEnergy += entry.energy;
        energyCount++;
      }

      // Mood
      if (entry?.mental?.mood) {
        totalMood += entry.mental.mood;
        moodCount++;
      }

      // Exercise
      if (entry?.exercise?.length > 0) {
        exerciseDays++;
        entry.exercise.forEach(ex => {
          totalExerciseMinutes += Utils.parseDuration(ex.duration);
          exerciseTypes[ex.name] = (exerciseTypes[ex.name] || 0) + 1;
        });
      }

      // Tasks
      if (entry?.tasks) {
        totalTasks += entry.tasks.length;
        tasksCompleted += entry.tasks.filter(t => t.progress === 'done').length;
      }
    }

    const avgSleep = sleepCount > 0 ? Utils.formatDuration(Math.round(totalSleepMinutes / sleepCount)) : '-';
    const avgSleepQuality = sleepQualityCount > 0 ? (totalSleepQuality / sleepQualityCount).toFixed(1) : '-';
    const avgEnergy = energyCount > 0 ? (totalEnergy / energyCount).toFixed(1) : '-';
    const avgMood = moodCount > 0 ? (totalMood / moodCount).toFixed(1) : '-';
    const totalExercise = Utils.formatDuration(totalExerciseMinutes);

    // Top exercise activities
    const topExercises = Object.entries(exerciseTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name)
      .join(', ') || '-';

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${avgSleep}</div>
        <div class="stat-label">Avg Sleep</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${avgSleepQuality}</div>
        <div class="stat-label">Sleep Quality</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${exerciseDays}</div>
        <div class="stat-label">Exercise Days</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalExercise}</div>
        <div class="stat-label">Total Exercise</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${avgEnergy}</div>
        <div class="stat-label">Avg Energy</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${avgMood}</div>
        <div class="stat-label">Avg Mood</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${entriesCount}</div>
        <div class="stat-label">Days Tracked</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${tasksCompleted}/${totalTasks}</div>
        <div class="stat-label">Tasks Done</div>
      </div>
    `;

    // Store stats in summary
    this.currentSummary.sleepTrends = {
      avgDuration: avgSleep,
      avgQuality: parseFloat(avgSleepQuality) || 0
    };
    this.currentSummary.exerciseTrends = {
      daysActive: exerciseDays,
      totalDuration: totalExercise,
      topActivities: topExercises.split(', ').filter(s => s !== '-')
    };
  },

  renderFormFields() {
    if (this.editors.achievements) {
      this.editors.achievements.setValue(this.currentSummary.achievements || '');
    }
    if (this.editors.reflections) {
      this.editors.reflections.setValue(this.currentSummary.reflections || '');
    }
    if (this.editors.nextMonthGoals) {
      this.editors.nextMonthGoals.setValue(this.currentSummary.nextMonthGoals || '');
    }
  },

  autoSave() {
    this.currentSummary.achievements = this.editors.achievements ? this.editors.achievements.getValue() : '';
    this.currentSummary.reflections = this.editors.reflections ? this.editors.reflections.getValue() : '';
    this.currentSummary.nextMonthGoals = this.editors.nextMonthGoals ? this.editors.nextMonthGoals.getValue() : '';

    const monthKey = Utils.formatMonthKey(this.currentDate);
    storage.setMonthlySummary(monthKey, this.currentSummary);
    App.updateStatus('Saved locally');
  },

  async generateReflectionFromAI() {
    // This can be called manually if needed
    const available = await AI.isAvailable();
    if (!available) {
      alert('AI (Ollama) is not available. Make sure Ollama is running on your Mac.');
      return;
    }

    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth();

      const weeklySummaries = [];
      let checkDate = new Date(year, month, 1);

      while (checkDate.getMonth() === month) {
        const weekKey = Utils.formatWeekKey(checkDate);
        const summary = storage.getWeekSummary(weekKey, '');
        if (summary.highlights || summary.summary) {
          weeklySummaries.push(summary);
        }
        checkDate = Utils.addDays(checkDate, 7);
      }

      const monthlyStats = {
        avgSleepQuality: this.currentSummary.sleepTrends?.avgQuality,
        exerciseDays: this.currentSummary.exerciseTrends?.daysActive,
        avgMood: this.currentSummary.avgMood
      };

      if (weeklySummaries.length === 0) {
        alert('No weekly summaries found. Try generating weekly summaries first.');
        return;
      }

      const reflection = await AI.generateMonthlyReflection(weeklySummaries, monthlyStats);
      if (this.editors.reflections) {
        this.editors.reflections.setValue(reflection);
      }
      this.autoSave();
    } catch (error) {
      console.error('AI generation error:', error);
      alert('Failed to generate reflection. Please try again.');
    }
  }
};

// Export
window.MonthlyView = MonthlyView;
