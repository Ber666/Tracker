// ========================================
// Utility Functions
// ========================================

const Utils = {
  // Generate a unique ID
  generateId() {
    return 't' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  },

  // Format date as YYYY-MM-DD (local time, not UTC)
  formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  // Format date for display (e.g., "February 21, 2026")
  formatDateDisplay(date) {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  },

  // Get day of week (e.g., "Friday")
  getDayOfWeek(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  },

  // Get short day name (e.g., "Mon")
  getShortDayName(date) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  },

  // Format month key (e.g., "2026-02")
  formatMonthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  },

  // Format month display (e.g., "February 2026")
  formatMonthDisplay(date) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  },

  // Get ISO week number
  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  },

  // Format week key (e.g., "2026-W08")
  formatWeekKey(date) {
    const week = this.getWeekNumber(date);
    return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
  },

  // Get start of week (Monday)
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  // Get end of week (Sunday)
  getWeekEnd(date) {
    const start = this.getWeekStart(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return end;
  },

  // Format week range (e.g., "Feb 17 - Feb 23, 2026")
  formatWeekRange(date) {
    const start = this.getWeekStart(date);
    const end = this.getWeekEnd(date);

    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return `${startStr} - ${endStr}`;
  },

  // Get days in week
  getWeekDays(date) {
    const start = this.getWeekStart(date);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  },

  // Get days in month
  getMonthDays(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    // Add empty slots for days before the first day
    const startDay = firstDay.getDay();
    const emptyBefore = startDay === 0 ? 6 : startDay - 1;
    for (let i = 0; i < emptyBefore; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }

    return days;
  },

  // Calculate sleep duration from bed time and wake time
  calculateSleepDuration(bedTime, wakeTime) {
    if (!bedTime || !wakeTime) return null;

    const [bedH, bedM] = bedTime.split(':').map(Number);
    const [wakeH, wakeM] = wakeTime.split(':').map(Number);

    let bedMinutes = bedH * 60 + bedM;
    let wakeMinutes = wakeH * 60 + wakeM;

    // If wake time is before bed time, add 24 hours
    if (wakeMinutes < bedMinutes) {
      wakeMinutes += 24 * 60;
    }

    const durationMinutes = wakeMinutes - bedMinutes;
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  },

  // Parse duration string (e.g., "2h 30m" -> minutes)
  parseDuration(str) {
    if (!str) return 0;

    let minutes = 0;
    const hours = str.match(/(\d+)\s*h/i);
    const mins = str.match(/(\d+)\s*m/i);

    if (hours) minutes += parseInt(hours[1]) * 60;
    if (mins) minutes += parseInt(mins[1]);

    return minutes;
  },

  // Format minutes to duration string
  formatDuration(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  },

  // Add days to date
  addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },

  // Add months to date
  addMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  },

  // Check if same day
  isSameDay(date1, date2) {
    return this.formatDateKey(date1) === this.formatDateKey(date2);
  },

  // Check if today
  isToday(date) {
    return this.isSameDay(date, new Date());
  },

  // Check if future
  isFuture(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  },

  // Debounce function
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Get mood emoji
  getMoodEmoji(mood) {
    if (!mood || mood === 0) return '';
    if (mood >= 8) return '😊';
    if (mood >= 6) return '🙂';
    if (mood >= 4) return '😐';
    if (mood >= 2) return '😕';
    return '😢';
  },

  // Create empty daily entry
  createEmptyEntry(dateKey) {
    return {
      tasks: [],
      work: '',
      sleep: {
        bedTime: '',
        wakeTime: '',
        quality: 0,
        comment: ''
      },
      exercise: [],
      energy: 0,
      mental: {
        mood: 0,
        notes: ''
      },
      freeform: '',
      updatedAt: new Date().toISOString()
    };
  },

  // Create empty weekly summary
  createEmptyWeeklySummary(weekKey, dateRange) {
    return {
      week: weekKey,
      dateRange: dateRange,
      summary: '',
      highlights: '',
      sleep: {
        avgDuration: '',
        avgQuality: 0,
        avgBedTime: '',
        avgWakeTime: ''
      },
      exercise: {
        daysActive: 0,
        totalDuration: '',
        breakdown: {}
      },
      avgEnergy: 0,
      avgMood: 0,
      learnings: '',
      nextWeekFocus: '',
      aiGenerated: '',
      updatedAt: new Date().toISOString()
    };
  },

  // Create empty monthly summary
  createEmptyMonthlySummary(monthKey) {
    return {
      month: monthKey,
      summary: '',
      achievements: '',
      sleepTrends: {
        avgDuration: '',
        avgQuality: 0,
        qualityTrend: 'stable',
        avgBedTime: ''
      },
      exerciseTrends: {
        daysActive: 0,
        totalDuration: '',
        topActivities: [],
        trend: 'stable'
      },
      energyTrend: 'stable',
      moodTrend: 'stable',
      reflections: '',
      nextMonthGoals: '',
      aiGenerated: '',
      updatedAt: new Date().toISOString()
    };
  }
};

// ========================================
// Simple Markdown Parser
// ========================================

const Markdown = {
  // Convert markdown to HTML
  render(text) {
    if (!text) return '';

    let html = this.escapeHtml(text);

    // Code blocks (must be first to prevent inner parsing)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Strikethrough
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

    // Blockquotes
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

    // Horizontal rule
    html = html.replace(/^---$/gm, '<hr>');
    html = html.replace(/^\*\*\*$/gm, '<hr>');

    // Unordered lists
    html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Checkboxes
    html = html.replace(/\[ \]/g, '<input type="checkbox" disabled>');
    html = html.replace(/\[x\]/gi, '<input type="checkbox" checked disabled>');

    // Paragraphs - wrap lines that aren't already in tags
    const lines = html.split('\n');
    html = lines.map(line => {
      if (line.trim() === '') return '';
      if (/^<[hluopbi]|^<\/|^<hr|^<blockquote|^<pre|^<code|^<img/.test(line)) {
        return line;
      }
      return `<p>${line}</p>`;
    }).join('\n');

    return html;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // Get plain text preview (first N characters)
  preview(text, maxLength = 100) {
    if (!text) return '';
    // Strip markdown syntax for preview
    let plain = text
      .replace(/[#*_~`>\-\[\]()!]/g, '')
      .replace(/\n+/g, ' ')
      .trim();
    if (plain.length > maxLength) {
      plain = plain.substring(0, maxLength) + '...';
    }
    return plain;
  }
};

window.Markdown = Markdown;
