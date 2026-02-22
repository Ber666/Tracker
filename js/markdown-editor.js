// ========================================
// Reusable Markdown Editor Component
// ========================================

class MarkdownEditor {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      placeholder: options.placeholder || 'Write something...',
      rows: options.rows || 4,
      onchange: options.onchange || (() => {}),
      id: options.id || `md-editor-${Date.now()}`
    };

    this.render();
    this.bindEvents();
  }

  render() {
    this.container.classList.add('md-editor');
    this.container.innerHTML = `
      <div class="md-editor-header">
        <div class="md-editor-tabs">
          <button type="button" class="md-tab active" data-tab="edit">Edit</button>
          <button type="button" class="md-tab" data-tab="preview">Preview</button>
        </div>
        <button type="button" class="btn btn-small btn-accent md-ai-btn" title="Polish with AI">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          AI
        </button>
      </div>
      <div class="md-editor-body">
        <textarea
          id="${this.options.id}"
          placeholder="${this.options.placeholder}"
          rows="${this.options.rows}"
        ></textarea>
        <div class="md-preview hidden"></div>
      </div>
      <div class="md-editor-hint">Supports **bold**, *italic*, - lists, [links](url), \`code\`</div>
    `;

    this.textarea = this.container.querySelector('textarea');
    this.preview = this.container.querySelector('.md-preview');
    this.tabs = this.container.querySelectorAll('.md-tab');
    this.aiBtn = this.container.querySelector('.md-ai-btn');
  }

  bindEvents() {
    // Tab switching
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Input change
    this.textarea.addEventListener('input', () => {
      this.options.onchange(this.getValue());
    });

    this.textarea.addEventListener('change', () => {
      this.options.onchange(this.getValue());
    });

    // AI polish button
    this.aiBtn.addEventListener('click', () => this.polish());
  }

  switchTab(tab) {
    this.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

    if (tab === 'preview') {
      this.textarea.classList.add('hidden');
      this.preview.classList.remove('hidden');
      this.preview.innerHTML = Markdown.render(this.getValue()) ||
        '<em style="color: var(--color-text-tertiary)">Nothing to preview</em>';
    } else {
      this.textarea.classList.remove('hidden');
      this.preview.classList.add('hidden');
    }
  }

  async polish() {
    const text = this.getValue().trim();
    if (!text) {
      alert('Please write something first');
      return;
    }

    const available = await AI.isAvailable();
    if (!available) {
      alert('AI (Ollama) is not available. Make sure Ollama is running on your Mac.');
      return;
    }

    // Show loading state
    this.aiBtn.disabled = true;
    const originalHTML = this.aiBtn.innerHTML;
    this.aiBtn.innerHTML = '<span class="spinner"></span>';

    try {
      const polished = await AI.polish(text);
      this.setValue(polished);
      this.options.onchange(polished);
    } catch (error) {
      console.error('AI polish error:', error);
      alert('Failed to polish text. Please try again.');
    } finally {
      this.aiBtn.disabled = false;
      this.aiBtn.innerHTML = originalHTML;
    }
  }

  getValue() {
    return this.textarea.value;
  }

  setValue(value) {
    this.textarea.value = value;
    // Update preview if visible
    if (!this.preview.classList.contains('hidden')) {
      this.preview.innerHTML = Markdown.render(value) ||
        '<em style="color: var(--color-text-tertiary)">Nothing to preview</em>';
    }
  }

  focus() {
    this.textarea.focus();
  }

  reset() {
    this.setValue('');
    this.switchTab('edit');
  }
}

// Factory function to upgrade existing textareas
function createMarkdownEditor(selector, options = {}) {
  const container = typeof selector === 'string'
    ? document.querySelector(selector)
    : selector;

  if (!container) return null;
  return new MarkdownEditor(container, options);
}

// Export
window.MarkdownEditor = MarkdownEditor;
window.createMarkdownEditor = createMarkdownEditor;
