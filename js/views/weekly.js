// ========================================
// Weekly View
// ========================================

const WeeklyView = {
  currentDate: new Date(),
  currentSummary: null,
  editors: {},

  init() {
    this.initEditors();
    this.bindEvents();
    this.loadWeek(this.currentDate);
  },

  initEditors() {
    this.editors.highlights = new MarkdownEditor(
      document.getElementById('weekly-highlights-editor'),
      {
        id: 'weekly-highlights',
        placeholder: 'Key accomplishments this week...',
        rows: 4,
        onchange: () => this.autoSave()
      }
    );

    this.editors.summary = new MarkdownEditor(
      document.getElementById('weekly-summary-editor'),
      {
        id: 'weekly-summary',
        placeholder: 'Reflect on your week...',
        rows: 4,
        onchange: () => this.autoSave()
      }
    );

    this.editors.nextWeekFocus = new MarkdownEditor(
      document.getElementById('next-week-focus-editor'),
      {
        id: 'next-week-focus',
        placeholder: 'What to focus on next week...',
        rows: 3,
        onchange: () => this.autoSave()
      }
    );
  },

  bindEvents() {
    // Week navigation
    document.getElementById('prev-week').addEventListener('click', () => this.navigateWeek(-1));
    document.getElementById('next-week').addEventListener('click', () => this.navigateWeek(1));
    document.getElementById('this-week-btn').addEventListener('click', () => this.goToThisWeek());
  },

  navigateWeek(delta) {
    this.currentDate = Utils.addDays(this.currentDate, delta * 7);
    this.loadWeek(this.currentDate);
  },

  goToThisWeek() {
    this.currentDate = new Date();
    this.loadWeek(this.currentDate);
  },

  loadWeek(date) {
    this.currentDate = date;
    const weekKey = Utils.formatWeekKey(date);
    const weekNumber = Utils.getWeekNumber(date);
    const weekRange = Utils.formatWeekRange(date);

    // Update header
    document.getElementById('current-week').textContent = `Week ${weekNumber}`;
    document.getElementById('week-range').textContent = weekRange;

    // Load summary
    this.currentSummary = storage.getWeekSummary(weekKey, weekRange);

    // Render sections
    this.renderWeekOverview();
    this.renderStats();
    this.renderFormFields();
  },

  renderWeekOverview() {
    const container = document.getElementById('week-overview');
    const days = Utils.getWeekDays(this.currentDate);
    const today = new Date();

    container.innerHTML = days.map(day => {
      const dateKey = Utils.formatDateKey(day);
      const entry = storage.getDayEntry(dateKey);
      const hasEntry = entry && (entry.tasks?.length > 0 || entry.work || entry.sleep?.bedTime);
      const isToday = Utils.isSameDay(day, today);
      const isFuture = Utils.isFuture(day);

      const mood = entry?.mental?.mood || 0;
      const moodEmoji = Utils.getMoodEmoji(mood);

      const sleepDuration = Utils.calculateSleepDuration(
        entry?.sleep?.bedTime,
        entry?.sleep?.wakeTime
      );

      let classes = 'week-day';
      if (hasEntry) classes += ' has-entry';
      if (isToday) classes += ' today';

      return `
        <div class="${classes}" data-date="${dateKey}">
          <span class="week-day-label">${Utils.getShortDayName(day)}</span>
          <span class="week-day-date">${day.getDate()}</span>
          <span class="week-day-mood">${moodEmoji}</span>
          <span class="week-day-sleep">${sleepDuration || '-'}</span>
        </div>
      `;
    }).join('');

    // Bind click events to navigate to daily view
    container.querySelectorAll('.week-day').forEach(dayEl => {
      dayEl.addEventListener('click', () => {
        const dateKey = dayEl.dataset.date;
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

  renderStats() {
    const container = document.getElementById('weekly-stats');
    const days = Utils.getWeekDays(this.currentDate);

    // Collect stats from daily entries
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
    let tasksCompleted = 0;
    let totalTasks = 0;

    days.forEach(day => {
      const dateKey = Utils.formatDateKey(day);
      const entry = storage.getDayEntry(dateKey);

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
        });
      }

      // Tasks
      if (entry?.tasks) {
        totalTasks += entry.tasks.length;
        tasksCompleted += entry.tasks.filter(t => t.progress === 'done').length;
      }
    });

    const avgSleep = sleepCount > 0 ? Utils.formatDuration(Math.round(totalSleepMinutes / sleepCount)) : '-';
    const avgSleepQuality = sleepQualityCount > 0 ? (totalSleepQuality / sleepQualityCount).toFixed(1) : '-';
    const avgEnergy = energyCount > 0 ? (totalEnergy / energyCount).toFixed(1) : '-';
    const avgMood = moodCount > 0 ? (totalMood / moodCount).toFixed(1) : '-';
    const totalExercise = Utils.formatDuration(totalExerciseMinutes);

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
        <div class="stat-value">${exerciseDays}/7</div>
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
        <div class="stat-value">${tasksCompleted}/${totalTasks}</div>
        <div class="stat-label">Tasks Done</div>
      </div>
    `;

    // Store stats in summary
    this.currentSummary.sleep = {
      avgDuration: avgSleep,
      avgQuality: parseFloat(avgSleepQuality) || 0
    };
    this.currentSummary.exercise = {
      daysActive: exerciseDays,
      totalDuration: totalExercise
    };
    this.currentSummary.avgEnergy = parseFloat(avgEnergy) || 0;
    this.currentSummary.avgMood = parseFloat(avgMood) || 0;
  },

  renderFormFields() {
    if (this.editors.highlights) {
      this.editors.highlights.setValue(this.currentSummary.highlights || '');
    }
    if (this.editors.summary) {
      this.editors.summary.setValue(this.currentSummary.summary || '');
    }
    if (this.editors.nextWeekFocus) {
      this.editors.nextWeekFocus.setValue(this.currentSummary.nextWeekFocus || '');
    }
  },

  autoSave() {
    this.currentSummary.highlights = this.editors.highlights ? this.editors.highlights.getValue() : '';
    this.currentSummary.summary = this.editors.summary ? this.editors.summary.getValue() : '';
    this.currentSummary.nextWeekFocus = this.editors.nextWeekFocus ? this.editors.nextWeekFocus.getValue() : '';

    const weekKey = Utils.formatWeekKey(this.currentDate);
    storage.setWeekSummary(weekKey, this.currentSummary);
    App.updateStatus('Saved locally');
  },

  async generateSummaryFromAI() {
    // This can be called manually if needed
    const available = await AI.isAvailable();
    if (!available) {
      alert('AI (Ollama) is not available. Make sure Ollama is running on your Mac.');
      return;
    }

    const days = Utils.getWeekDays(this.currentDate);
    const entries = days.map(day => {
      const dateKey = Utils.formatDateKey(day);
      const entry = storage.getDayEntry(dateKey);
      return {
        date: dateKey,
        ...entry
      };
    }).filter(e => e.tasks?.length > 0 || e.work);

    if (entries.length === 0) {
      alert('No entries to summarize. Add some daily entries first.');
      return;
    }

    try {
      const summary = await AI.generateWeeklySummary(entries);
      if (this.editors.highlights) {
        this.editors.highlights.setValue(summary);
      }
      this.autoSave();
    } catch (error) {
      console.error('AI generation error:', error);
      alert('Failed to generate summary. Please try again.');
    }
  }
};

// Export
window.WeeklyView = WeeklyView;
