// ========================================
// AI Integration (Ollama)
// ========================================

const AI = {
  ollamaUrl: 'http://localhost:11434',
  model: 'qwen2.5:0.5b',

  // Check if Ollama is available
  async isAvailable() {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  },

  // Generate text using Ollama
  async generate(prompt, options = {}) {
    const url = storage.getOllamaUrl() || this.ollamaUrl;

    try {
      const response = await fetch(`${url}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options.model || this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: options.temperature || 0.7,
            num_predict: options.maxTokens || 500
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error('AI generation error:', error);
      throw error;
    }
  },

  // Polish/improve text
  async polish(text) {
    if (!text || text.trim().length === 0) {
      return text;
    }

    const prompt = `Please polish and improve the following journal entry. Make it clearer and more concise while preserving the original meaning and tone. Keep it natural and personal. Only output the polished text, nothing else.

Original:
${text}

Polished:`;

    return this.generate(prompt);
  },

  // Generate weekly summary from daily entries
  async generateWeeklySummary(entries) {
    if (!entries || entries.length === 0) {
      return null;
    }

    const entriesText = entries.map(e => {
      const tasks = e.tasks || [];
      const doneTasks = tasks.filter(t => t.progress === 'done').map(t => t.text);
      return `${e.date}:
- Tasks completed: ${doneTasks.join(', ') || 'None'}
- Work: ${e.work || 'N/A'}
- Energy: ${e.energy}/10
- Mood: ${e.mental?.mood || 0}/10`;
    }).join('\n\n');

    const prompt = `Based on these daily journal entries from the past week, write a brief weekly summary highlighting key accomplishments, patterns, and insights. Keep it concise (3-5 bullet points).

${entriesText}

Weekly Summary:`;

    return this.generate(prompt, { maxTokens: 300 });
  },

  // Generate monthly reflection from weekly summaries
  async generateMonthlyReflection(weeklySummaries, monthlyStats) {
    const summariesText = weeklySummaries.map((s, i) =>
      `Week ${i + 1}: ${s.highlights || s.summary || 'No summary'}`
    ).join('\n');

    const prompt = `Based on these weekly summaries and statistics, write a brief monthly reflection. Highlight achievements, areas of growth, and suggestions for next month.

Weekly Summaries:
${summariesText}

Monthly Stats:
- Average sleep quality: ${monthlyStats.avgSleepQuality || 'N/A'}
- Exercise days: ${monthlyStats.exerciseDays || 0}
- Average mood: ${monthlyStats.avgMood || 'N/A'}

Monthly Reflection:`;

    return this.generate(prompt, { maxTokens: 400 });
  },

  // Suggest tasks based on patterns
  async suggestTasks(recentEntries) {
    const tasksText = recentEntries.map(e => {
      const tasks = e.tasks || [];
      return tasks.map(t => `- ${t.text} (${t.progress})`).join('\n');
    }).join('\n');

    const prompt = `Based on recent task patterns, suggest 2-3 potential tasks for today. Keep suggestions practical and relevant.

Recent tasks:
${tasksText}

Suggested tasks for today:`;

    return this.generate(prompt, { maxTokens: 150 });
  }
};

// Export for use
window.AI = AI;
