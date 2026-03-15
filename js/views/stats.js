// ========================================
// Stats View
// ========================================

const StatsView = {
  range: 30,

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    document.querySelectorAll('.range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.range = parseInt(btn.dataset.range);
        this.render();
      });
    });
  },

  getDays() {
    const days = [];
    const today = new Date();
    for (let i = this.range - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = Utils.formatDateKey(d);
      const entry = storage.getDayEntry(dateKey);
      days.push({ date: d, dateKey, entry });
    }
    return days;
  },

  hasExercise(entry) {
    if ((entry?.exercise || []).length > 0) return true;
    const exGroup = storage.getTagGroups().find(g => g.name.toLowerCase() === 'exercise');
    const allTags = storage.getTags();
    const exTagIds = exGroup ? allTags.filter(t => t.groupId === exGroup.id).map(t => t.id) : [];
    if (exTagIds.length === 0) return false;
    return [...(entry?.planned || []), ...(entry?.log || [])].some(t =>
      (t.tagIds || []).some(id => exTagIds.includes(id))
    );
  },

  render() {
    const days = this.getDays();
    this.renderSummary(days);
    this.renderSleepChart(days);
    this.renderTasksChart(days);
    this.renderRatingsChart(days);
    this.renderExerciseRow(days);
    this.renderDrinksList(days);
  },

  renderSummary(days) {
    const container = document.getElementById('stats-summary');

    let sleepMins = 0, sleepCount = 0;
    const sleepMinsList = [];
    let nightMoodSum = 0, nightMoodCount = 0;
    let focusSum = 0, focusCount = 0;
    let tasksDone = 0, tasksTotal = 0;
    let exerciseDays = 0;
    let trackedDays = 0;
    const bedMins = []; // minutes since midnight for std dev

    days.forEach(({ entry }) => {
      const hasData = entry && (entry.planned?.length || entry.log?.length || entry.morningMessage || entry.sleep?.bedTime);
      if (hasData) trackedDays++;

      const dur = Utils.calculateSleepDuration(entry?.sleep?.bedTime, entry?.sleep?.wakeTime);
      if (dur) {
        const m = Utils.parseDuration(dur);
        sleepMins += m; sleepCount++;
        sleepMinsList.push(m);
      }

      if (entry?.sleep?.bedTime) {
        const [h, m] = entry.sleep.bedTime.split(':').map(Number);
        // Treat times before 6am as next-day (e.g. 1:00 → 25:00)
        const mins = h < 6 ? (h + 24) * 60 + m : h * 60 + m;
        bedMins.push(mins);
      }

      if (entry?.night?.mood) { nightMoodSum += entry.night.mood; nightMoodCount++; }
      if (entry?.night?.focus) { focusSum += entry.night.focus; focusCount++; }

      (entry?.planned || []).forEach(t => {
        tasksTotal++;
        if (t.status === 'done') tasksDone++;
      });

      if (this.hasExercise(entry)) exerciseDays++;
    });

    let avgSleep = '—';
    if (sleepCount > 0) {
      const mean = sleepMins / sleepCount;
      const std = Math.sqrt(sleepMinsList.reduce((s, v) => s + (v - mean) ** 2, 0) / sleepMinsList.length);
      avgSleep = `${Utils.formatDuration(Math.round(mean))} ±${Utils.formatDuration(Math.round(std))}`;
    }
    const avgMood = nightMoodCount > 0 ? (nightMoodSum / nightMoodCount).toFixed(1) : '—';
    const avgFocus = focusCount > 0 ? (focusSum / focusCount).toFixed(1) : '—';
    const completionRate = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) + '%' : '—';

    let bedTimeStr = '—';
    if (bedMins.length > 0) {
      const mean = bedMins.reduce((a, b) => a + b, 0) / bedMins.length;
      const std = Math.sqrt(bedMins.reduce((s, v) => s + (v - mean) ** 2, 0) / bedMins.length);
      const fmt = m => {
        const h = Math.floor(m / 60) % 24;
        const min = Math.round(m % 60);
        return `${h}:${String(min).padStart(2, '0')}`;
      };
      bedTimeStr = `${fmt(mean)} ±${Math.round(std)}m`;
    }

    container.innerHTML = `
      <div class="stat-card"><div class="stat-value">${avgSleep}</div><div class="stat-label">Avg Sleep</div></div>
      <div class="stat-card"><div class="stat-value">${bedTimeStr}</div><div class="stat-label">Bed Time</div></div>
      <div class="stat-card"><div class="stat-value">${avgMood}</div><div class="stat-label">Night Mood</div></div>
      <div class="stat-card"><div class="stat-value">${avgFocus}</div><div class="stat-label">Night Focus</div></div>
      <div class="stat-card"><div class="stat-value">${exerciseDays}</div><div class="stat-label">Exercise Days</div></div>
      <div class="stat-card"><div class="stat-value">${completionRate}</div><div class="stat-label">Tasks Done</div></div>
      <div class="stat-card"><div class="stat-value">${trackedDays}</div><div class="stat-label">Days Tracked</div></div>
    `;
  },

  // SVG helper: generate a bar chart for sleep duration
  renderSleepChart(days) {
    const container = document.getElementById('stats-sleep-chart');
    const W = container.offsetWidth || 600, H = 110, padL = 28, padB = 18, padT = 8;
    const cW = W - padL, cH = H - padB - padT;
    const maxHours = 10;
    const slotW = cW / days.length;
    const bW = Math.min(20, Math.max(2, slotW - 2));
    const labelStep = Math.max(1, Math.ceil(days.length / 8));

    let guides = '', bars = '', xLabels = '';

    [6, 7, 8].forEach(h => {
      const y = padT + cH - (h / maxHours) * cH;
      guides += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" stroke="#DCE8F2" stroke-width="1"/>`;
      guides += `<text x="${padL - 4}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="9" fill="#7A9AB2">${h}h</text>`;
    });

    days.forEach(({ date, entry }, i) => {
      const slotX = padL + i * slotW;
      const x = slotX + (slotW - bW) / 2;
      const dur = Utils.calculateSleepDuration(entry?.sleep?.bedTime, entry?.sleep?.wakeTime);
      const hrs = dur ? Utils.parseDuration(dur) / 60 : 0;
      const bH = Math.max(0, (hrs / maxHours) * cH);
      const y = padT + cH - bH;
      const color = hrs === 0 ? '#E8EFF5' : hrs >= 8 ? '#1BA87A' : hrs >= 6.5 ? '#006A96' : '#C8323A';
      if (bH > 0) {
        bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bW.toFixed(1)}" height="${bH.toFixed(1)}" fill="${color}" rx="2"/>`;
      }
      if (i % labelStep === 0 || i === days.length - 1) {
        xLabels += `<text x="${(slotX + slotW / 2).toFixed(1)}" y="${H - 3}" text-anchor="middle" font-size="9" fill="#7A9AB2">${date.getMonth() + 1}/${date.getDate()}</text>`;
      }
    });

    container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block">${guides}${bars}${xLabels}</svg>`;
  },

  // 8 individual rating mini-charts in a 2×4 grid
  renderRatingsChart(days) {
    const series = [
      { containerId: 'stats-rating-sleep-quality', fn: d => d.entry?.morning?.quality, color: '#7B8CDE' },
      { containerId: 'stats-rating-sharpness',     fn: d => d.entry?.morning?.clarity, color: '#006A96' },
      { containerId: 'stats-rating-morning-mood',  fn: d => d.entry?.morning?.mood,    color: '#1BA87A' },
      { containerId: 'stats-rating-morning-body',  fn: d => d.entry?.morning?.fatigue, color: '#C69214' },
      { containerId: 'stats-rating-focus',         fn: d => d.entry?.night?.focus,     color: '#C8323A' },
      { containerId: 'stats-rating-social',        fn: d => d.entry?.night?.social,    color: '#7B61FF' },
      { containerId: 'stats-rating-night-mood',    fn: d => d.entry?.night?.mood,      color: '#E67E22' },
      { containerId: 'stats-rating-night-body',    fn: d => d.entry?.night?.body,      color: '#1ABC9C' },
    ];
    series.forEach(s => this.renderRatingMiniChart(days, s));
  },

  renderRatingMiniChart(days, { containerId, fn, color }) {
    const container = document.getElementById(containerId);
    const W = container.offsetWidth || 280, H = 80, padL = 16, padB = 14, padT = 4;
    const cW = W - padL, cH = H - padB - padT;
    const step = days.length > 1 ? cW / (days.length - 1) : cW;
    const labelStep = Math.max(1, Math.ceil(days.length / 5));

    let guides = '', path = '', dots = '', xLabels = '';

    [1, 3, 5].forEach(v => {
      const y = padT + cH - ((v - 1) / 4) * cH;
      guides += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" stroke="#E8EFF5" stroke-width="1"/>`;
      guides += `<text x="${padL - 3}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="8" fill="#B4C8DA">${v}</text>`;
    });

    let inSegment = false;
    days.forEach((d, i) => {
      const v = fn(d);
      if (!v) { inSegment = false; return; }
      const x = padL + i * step;
      const y = padT + cH - ((v - 1) / 4) * cH;
      path += inSegment ? `L${x.toFixed(1)},${y.toFixed(1)}` : `M${x.toFixed(1)},${y.toFixed(1)}`;
      inSegment = true;
      dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="${color}"/>`;
    });

    days.forEach(({ date }, i) => {
      if (i % labelStep === 0 || i === days.length - 1) {
        const x = padL + i * step;
        xLabels += `<text x="${x.toFixed(1)}" y="${H - 1}" text-anchor="middle" font-size="8" fill="#7A9AB2">${date.getMonth() + 1}/${date.getDate()}</text>`;
      }
    });

    const line = path ? `<path d="${path}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" opacity="0.8"/>` : '';
    container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block">${guides}${line}${dots}${xLabels}</svg>`;
  },

  // SVG stacked bar chart for task completion
  renderTasksChart(days) {
    const container = document.getElementById('stats-tasks-chart');
    // legend div is rendered first so we read width after clearing it
    container.innerHTML = '';
    const W = container.offsetWidth || 600, H = 90, padL = 24, padB = 16, padT = 6;
    const cW = W - padL, cH = H - padB - padT;
    const slotW = cW / days.length;
    const bW = Math.min(20, Math.max(2, slotW - 2));
    const labelStep = Math.max(1, Math.ceil(days.length / 8));

    let guides = '', bars = '', xLabels = '';

    ['0%', '50%', '100%'].forEach((label, i) => {
      const y = padT + cH - i * (cH / 2);
      guides += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" stroke="#E8EFF5" stroke-width="1"/>`;
      guides += `<text x="${padL - 3}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="8" fill="#B4C8DA">${label}</text>`;
    });

    days.forEach(({ date, entry }, i) => {
      const planned = entry?.planned || [];
      const total = planned.length;
      const slotX = padL + i * slotW;
      const x = slotX + (slotW - bW) / 2;

      if (total === 0) {
        if (i % labelStep === 0 || i === days.length - 1) {
          xLabels += `<text x="${(slotX + slotW / 2).toFixed(1)}" y="${H - 2}" text-anchor="middle" font-size="9" fill="#7A9AB2">${date.getMonth() + 1}/${date.getDate()}</text>`;
        }
        return;
      }

      const done = planned.filter(t => t.status === 'done').length;
      const inProg = planned.filter(t => t.status === 'in-progress').length;
      const missed = total - done - inProg;

      const doneH = (done / total) * cH;
      const inProgH = (inProg / total) * cH;
      const missedH = (missed / total) * cH;

      let y = padT + cH;
      if (missedH > 0) {
        y -= missedH;
        bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bW.toFixed(1)}" height="${missedH.toFixed(1)}" fill="#DCE8F2"/>`;
      }
      if (inProgH > 0) {
        y -= inProgH;
        bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bW.toFixed(1)}" height="${inProgH.toFixed(1)}" fill="#D4870A"/>`;
      }
      if (doneH > 0) {
        y -= doneH;
        bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bW.toFixed(1)}" height="${doneH.toFixed(1)}" fill="#1BA87A"/>`;
      }

      if (i % labelStep === 0 || i === days.length - 1) {
        xLabels += `<text x="${(slotX + slotW / 2).toFixed(1)}" y="${H - 2}" text-anchor="middle" font-size="9" fill="#7A9AB2">${date.getMonth() + 1}/${date.getDate()}</text>`;
      }
    });

    const legend = `<div class="stats-legend" style="margin-bottom:6px">
      <span class="stats-legend-item"><span class="stats-legend-dot" style="background:#1BA87A"></span>Done</span>
      <span class="stats-legend-item"><span class="stats-legend-dot" style="background:#D4870A"></span>In Progress</span>
      <span class="stats-legend-item"><span class="stats-legend-dot" style="background:#DCE8F2;border:1px solid #C8D8E8"></span>Missed</span>
    </div>`;

    container.innerHTML = legend + `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block">${guides}${bars}${xLabels}</svg>`;
  },

  // Row of dots — filled if had exercise that day
  renderExerciseRow(days) {
    const container = document.getElementById('stats-exercise-row');
    const W = container.offsetWidth || 300;
    const H = 36, r = 5, cy = 10, labelY = 28;
    const slotW = W / days.length;
    const labelStep = Math.max(1, Math.ceil(days.length / 8));

    let dots = '', labels = '';
    days.forEach(({ date, dateKey, entry }, i) => {
      const cx = slotW * i + slotW / 2;
      const active = this.hasExercise(entry);
      const fill = active ? '#C8323A' : '#E8EFF5';
      dots += `<circle cx="${cx.toFixed(1)}" cy="${cy}" r="${r}" fill="${fill}"><title>${dateKey}</title></circle>`;
      if (i % labelStep === 0 || i === days.length - 1) {
        labels += `<text x="${cx.toFixed(1)}" y="${labelY}" text-anchor="middle" font-size="8" fill="#7A9AB2">${date.getMonth() + 1}/${date.getDate()}</text>`;
      }
    });

    container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block">${dots}${labels}</svg>`;
  },

  renderDrinksList(days) {
    const container = document.getElementById('stats-drinks-list');
    const groups = [];

    for (let i = days.length - 1; i >= 0; i--) {
      const { dateKey, entry } = days[i];
      const drinks = (entry?.meals || []).filter(m => m.type === 'drink');
      if (drinks.length > 0) groups.push({ dateKey, drinks });
    }

    if (groups.length === 0) {
      container.innerHTML = '<span class="stats-drinks-empty">No entries in this period</span>';
      return;
    }

    container.innerHTML = groups.map(({ dateKey, drinks }) =>
      `<div class="stats-drink-group">
        <div class="stats-drink-date">${dateKey.slice(5)}</div>
        <div class="stats-drink-items">${drinks.map(d => App.escapeHtml(d.name)).join(', ')}</div>
      </div>`
    ).join('');
  },
};

window.StatsView = StatsView;
