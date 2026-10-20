/**
 * Living Study Guide - Main Application Controller
 * Handles state management, UI rendering, view transitions, and user interactions.
 */

import { storage } from './storage.js';
import { splitSentences, verifyExcerpt, highlightExcerptInHtml, escapeHtml } from './verification.js';
import { extractStudyItemsFromNotes, checkItemAgainstSource, DEFAULT_MODEL } from './gemini.js';
import { DEMO_SOURCE_TITLE, DEMO_SOURCE_TEXT, DEMO_ITEMS } from './demo-data.js';
import { filterLibraryItems, groupItemsByConcept } from './search-scoring.js';
import { exportBackupData, validateAndParseBackup } from './backup.js';
import { StudyController } from './study.js';

class App {
  constructor() {
    this.passphrase = null;
    this.currentTab = 'dashboard';
    this.activeSourceId = null;
    this.selectedReviewItemId = null;
    this.activeLibraryTag = '';
    this.librarySearchQuery = '';

    // Application state (persisted encrypted)
    this.state = {
      settings: {
        geminiApiKey: '',
        modelName: DEFAULT_MODEL
      },
      sources: [],
      items: [],
      quizHistory: []
    };

    this.studyController = new StudyController(this);
  }

  async init() {
    this.wireGlobalEvents();

    const isInit = await storage.isVaultInitialized();
    if (!isInit) {
      // First run: show Passphrase Creation UI
      this.showFirstRunLockScreen();
    } else {
      // Returning user: show standard unlock UI
      this.showUnlockScreen();
    }
  }

  showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // =========================================================================
  // LOCK SCREEN & CRYPTO LIFECYCLE
  // =========================================================================
  showFirstRunLockScreen() {
    const overlay = document.getElementById('lock-screen-overlay');
    const heading = document.getElementById('lock-screen-heading');
    const subtext = document.getElementById('lock-screen-subtext');
    const confirmGroup = document.getElementById('passphrase-confirm-group');
    const unlockBtn = document.getElementById('btn-vault-unlock');

    overlay.style.display = 'flex';
    heading.textContent = 'Welcome to Living Study Guide';
    subtext.textContent = 'To secure your notes, study cards, and API key, please choose a local passphrase. Everything is encrypted on this device.';
    confirmGroup.style.display = 'block';
    unlockBtn.textContent = 'Create Encrypted Vault';
  }

  showUnlockScreen() {
    const overlay = document.getElementById('lock-screen-overlay');
    const heading = document.getElementById('lock-screen-heading');
    const subtext = document.getElementById('lock-screen-subtext');
    const confirmGroup = document.getElementById('passphrase-confirm-group');
    const unlockBtn = document.getElementById('btn-vault-unlock');

    overlay.style.display = 'flex';
    heading.textContent = 'Living Study Guide';
    subtext.textContent = 'Enter your local passphrase to decrypt your private study guide and API keys.';
    confirmGroup.style.display = 'none';
    unlockBtn.textContent = 'Unlock Private Vault';
  }

  async handleVaultAuth() {
    const passInput = document.getElementById('vault-passphrase-input');
    const confirmInput = document.getElementById('vault-passphrase-confirm');
    const passphrase = passInput.value;

    if (!passphrase || passphrase.length < 4) {
      this.showToast('Passphrase must be at least 4 characters long.', 'error');
      return;
    }

    const isInit = await storage.isVaultInitialized();

    if (!isInit) {
      // First run setup
      if (passphrase !== confirmInput.value) {
        this.showToast('Passphrases do not match. Please verify.', 'error');
        return;
      }

      this.passphrase = passphrase;
      // Initialize with demo data by default for immediate delightful UX
      this.loadDemoDataIntoState();
      await storage.initializeVault(this.passphrase, this.state);
      this.unlockApp();
      this.showToast('Vault created and encrypted! Demo study guide loaded.', 'success');
    } else {
      // Returning user unlock
      try {
        const decryptedState = await storage.unlockVault(passphrase);
        this.passphrase = passphrase;
        if (decryptedState) {
          this.state = decryptedState;
        }
        this.unlockApp();
        this.showToast('Vault unlocked successfully.', 'success');
      } catch (err) {
        this.showToast(err.message || 'Incorrect passphrase.', 'error');
      }
    }
  }

  unlockApp() {
    const overlay = document.getElementById('lock-screen-overlay');
    overlay.style.display = 'none';
    document.getElementById('vault-passphrase-input').value = '';
    document.getElementById('vault-passphrase-confirm').value = '';

    // Initialize default active source if available
    if (this.state.sources.length > 0 && !this.activeSourceId) {
      this.activeSourceId = this.state.sources[0].id;
    }

    this.renderAll();
  }

  lockApp() {
    this.passphrase = null;
    this.studyController.stopSession();
    // Wipe decrypted view content
    document.getElementById('lock-screen-overlay').style.display = 'flex';
    document.getElementById('vault-passphrase-input').value = '';
    this.showUnlockScreen();
    this.showToast('Vault locked. In-memory data wiped.', 'info');
  }

  async saveCurrentState() {
    if (!this.passphrase) return;
    try {
      await storage.saveVault(this.passphrase, this.state);
    } catch (err) {
      console.error('Failed to persist vault:', err);
      this.showToast('Failed to save encrypted state to storage.', 'error');
    }
  }

  // =========================================================================
  // DEMO DATA GENERATION
  // =========================================================================
  loadDemoDataIntoState() {
    const demoSourceId = 'source-demo-internet-basics';
    this.state.sources = [
      {
        id: demoSourceId,
        title: DEMO_SOURCE_TITLE,
        text: DEMO_SOURCE_TEXT,
        createdAt: new Date().toISOString()
      }
    ];

    this.state.items = DEMO_ITEMS.map(item => ({
      ...item,
      sourceId: demoSourceId,
      // Verify excerpt against demo text
      verification: {
        sourceMatch: verifyExcerpt(DEMO_SOURCE_TEXT, item.source_excerpt).status,
        aiClaimCheck: null
      }
    }));

    this.activeSourceId = demoSourceId;
    this.selectedReviewItemId = this.state.items[0]?.id || null;
  }

  // =========================================================================
  // ROUTING & TAB NAVIGATION
  // =========================================================================
  switchTab(tabName) {
    this.currentTab = tabName;

    // Update nav button classes
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update panel visibility
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `view-${tabName}`);
    });

    if (tabName === 'study') {
      this.studyController.startSession('flashcards');
    } else {
      this.studyController.stopSession();
    }

    this.renderAll();
  }

  // =========================================================================
  // GLOBAL EVENT WIRING
  // =========================================================================
  wireGlobalEvents() {
    // Lock screen authentication
    document.getElementById('lock-screen-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleVaultAuth();
    });

    // Quick start with demo from lock screen
    document.getElementById('btn-load-demo-lock')?.addEventListener('click', async () => {
      const pass = 'demo1234';
      document.getElementById('vault-passphrase-input').value = pass;
      document.getElementById('vault-passphrase-confirm').value = pass;
      await this.handleVaultAuth();
    });

    // Emergency reset vault
    document.getElementById('btn-emergency-reset')?.addEventListener('click', async () => {
      const confirmed = confirm('Are you sure you want to completely erase all local data and passphrases on this device? This cannot be undone.');
      if (confirmed) {
        await storage.clearAll();
        location.reload();
      }
    });

    // Nav tabs
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });

    document.getElementById('brand-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.switchTab('dashboard');
    });

    // Header buttons
    document.getElementById('header-btn-lock')?.addEventListener('click', () => this.lockApp());
    document.getElementById('header-btn-settings')?.addEventListener('click', () => this.openSettingsModal());
    document.getElementById('header-btn-demo')?.addEventListener('click', async () => {
      const confirmed = confirm('Reload Demo Notes and 8 sample study cards? This will add them to your workspace.');
      if (confirmed) {
        this.loadDemoDataIntoState();
        await this.saveCurrentState();
        this.renderAll();
        this.showToast('Demo data reloaded successfully!', 'success');
      }
    });

    // Dashboard navigation CTAs
    document.getElementById('dash-btn-goto-queue')?.addEventListener('click', () => this.switchTab('queue'));
    document.getElementById('dash-btn-goto-sources')?.addEventListener('click', () => this.switchTab('sources'));
    document.getElementById('dash-btn-goto-study')?.addEventListener('click', () => this.switchTab('study'));

    // Sources: file upload and form
    const fileUpload = document.getElementById('source-file-upload');
    fileUpload?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      document.getElementById('source-text-input').value = text;
      if (!document.getElementById('source-title-input').value) {
        document.getElementById('source-title-input').value = file.name.replace(/\.[^/.]+$/, '');
      }
    });

    document.getElementById('source-import-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveSource();
    });

    document.getElementById('btn-extract-gemini-trigger')?.addEventListener('click', () => {
      this.handleExtractWithGemini();
    });

    // Review Queue: Merge mode trigger
    document.getElementById('btn-enter-merge-mode')?.addEventListener('click', () => {
      this.openMergeModal();
    });

    // Library: Live search & study triggers
    document.getElementById('library-search-input')?.addEventListener('input', (e) => {
      this.librarySearchQuery = e.target.value;
      this.renderLibrary();
    });

    document.getElementById('lib-btn-study-flashcards')?.addEventListener('click', () => {
      this.switchTab('study');
      this.studyController.startSession('flashcards');
    });

    document.getElementById('lib-btn-study-quiz')?.addEventListener('click', () => {
      this.switchTab('study');
      this.studyController.startSession('quiz');
    });

    // Settings Modal
    document.getElementById('btn-close-settings')?.addEventListener('click', () => this.closeSettingsModal());
    document.getElementById('settings-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'settings-modal') this.closeSettingsModal();
    });

    document.getElementById('btn-toggle-key-visibility')?.addEventListener('click', () => {
      const keyInput = document.getElementById('setting-gemini-key');
      keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
    });

    document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.handleSaveSettings();
    });

    document.getElementById('btn-update-passphrase')?.addEventListener('click', async () => {
      this.handleChangePassphrase();
    });

    document.getElementById('btn-download-backup')?.addEventListener('click', () => {
      exportBackupData(this.state);
      this.showToast('Backup downloaded successfully.', 'success');
    });

    const backupFileInput = document.getElementById('backup-file-input');
    backupFileInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = validateAndParseBackup(text);
        this.state.sources = parsed.sources;
        this.state.items = parsed.items;
        this.state.quizHistory = parsed.quizHistory;
        await this.saveCurrentState();
        this.closeSettingsModal();
        this.renderAll();
        this.showToast(`Restored ${parsed.sources.length} sources and ${parsed.items.length} cards from backup!`, 'success');
      } catch (err) {
        this.showToast(err.message || 'Failed to restore backup.', 'error');
      }
    });

    // Edit Item Modal
    document.getElementById('btn-close-edit')?.addEventListener('click', () => this.closeEditModal());
    document.getElementById('btn-cancel-edit')?.addEventListener('click', () => this.closeEditModal());
    document.getElementById('edit-item-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'edit-item-modal') this.closeEditModal();
    });
    document.getElementById('edit-type-select')?.addEventListener('change', (e) => {
      const isQuiz = e.target.value === 'quiz';
      document.getElementById('edit-flashcard-fields').style.display = isQuiz ? 'none' : 'block';
      document.getElementById('edit-quiz-fields').style.display = isQuiz ? 'block' : 'none';
    });
    document.getElementById('edit-item-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveEditedItem();
    });

    // Merge Modal
    document.getElementById('btn-close-merge')?.addEventListener('click', () => this.closeMergeModal());
    document.getElementById('btn-cancel-merge')?.addEventListener('click', () => this.closeMergeModal());
    document.getElementById('merge-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'merge-modal') this.closeMergeModal();
    });
    document.getElementById('merge-item-1-select')?.addEventListener('change', () => this.updateMergePreview());
    document.getElementById('merge-item-2-select')?.addEventListener('change', () => this.updateMergePreview());
    document.getElementById('merge-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmitMerge();
    });
  }

  // =========================================================================
  // SOURCES & SENTENCE NUMBERING
  // =========================================================================
  handleSaveSource() {
    const title = document.getElementById('source-title-input').value.trim();
    const text = document.getElementById('source-text-input').value.trim();

    if (!title || !text) {
      this.showToast('Please provide both a title and notes text.', 'warning');
      return;
    }

    const newSource = {
      id: `source-${Date.now()}`,
      title,
      text,
      createdAt: new Date().toISOString()
    };

    this.state.sources.unshift(newSource);
    this.activeSourceId = newSource.id;
    this.saveCurrentState();

    document.getElementById('source-title-input').value = '';
    document.getElementById('source-text-input').value = '';
    document.getElementById('source-file-upload').value = '';

    this.renderSources();
    this.renderSentenceInspector(newSource);
    this.showToast(`Saved "${title}" with numbered sentences.`, 'success');
  }

  renderSources() {
    const countEl = document.getElementById('saved-sources-count');
    const listEl = document.getElementById('saved-sources-list');
    if (!listEl) return;

    countEl.textContent = this.state.sources.length;

    if (this.state.sources.length === 0) {
      listEl.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No saved sources yet.</p>';
      return;
    }

    listEl.innerHTML = this.state.sources.map(src => {
      const isActive = src.id === this.activeSourceId;
      const sentenceCount = splitSentences(src.text).length;

      return `
        <div class="card" style="padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; border-color: ${isActive ? 'var(--accent-primary)' : 'var(--border-subtle)'}; background: ${isActive ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-card)'};">
          <div style="cursor: pointer; flex: 1;" class="source-select-item" data-source-id="${src.id}">
            <div style="font-weight: 600; font-size: 0.9rem;">${escapeHtml(src.title)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${sentenceCount} sentences • ${new Date(src.createdAt).toLocaleDateString()}</div>
          </div>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-outline btn-sm btn-extract-this-source" data-source-id="${src.id}" title="Extract Cards with Gemini">✨ Extract</button>
            <button class="btn btn-outline btn-sm btn-delete-source" data-source-id="${src.id}" title="Delete source" style="color: var(--accent-danger);">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.source-select-item').forEach(el => {
      el.addEventListener('click', () => {
        this.activeSourceId = el.dataset.sourceId;
        const source = this.state.sources.find(s => s.id === this.activeSourceId);
        this.renderSources();
        this.renderSentenceInspector(source);
      });
    });

    listEl.querySelectorAll('.btn-extract-this-source').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.activeSourceId = el.dataset.sourceId;
        this.handleExtractWithGemini();
      });
    });

    listEl.querySelectorAll('.btn-delete-source').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.sourceId;
        if (confirm('Delete this source? Linked cards will remain in queue/library.')) {
          this.state.sources = this.state.sources.filter(s => s.id !== id);
          if (this.activeSourceId === id) {
            this.activeSourceId = this.state.sources[0]?.id || null;
          }
          this.saveCurrentState();
          this.renderSources();
          const nextSource = this.state.sources.find(s => s.id === this.activeSourceId);
          this.renderSentenceInspector(nextSource);
          this.showToast('Source deleted.', 'info');
        }
      });
    });
  }

  renderSentenceInspector(source) {
    const titleEl = document.getElementById('inspector-source-title');
    const countBadge = document.getElementById('inspector-sentence-count');
    const container = document.getElementById('inspector-sentences-container');

    if (!source) {
      titleEl.textContent = 'Select a source';
      countBadge.textContent = '0 sentences';
      container.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">Select or import a note to view numbered sentence decomposition.</p>';
      return;
    }

    const sentences = splitSentences(source.text);
    titleEl.textContent = source.title;
    countBadge.textContent = `${sentences.length} sentences`;

    container.innerHTML = sentences.map(s => `
      <div style="margin-bottom: 0.6rem; padding: 0.4rem 0.6rem; border-radius: var(--radius-sm); background: rgba(255, 255, 255, 0.02); border-left: 2px solid var(--border-subtle);" class="sentence-row">
        <span class="sentence-tag">[${s.index}]</span>
        <span>${escapeHtml(s.text)}</span>
      </div>
    `).join('');
  }

  // =========================================================================
  // EXTRACTION WITH GEMINI REST API
  // =========================================================================
  async handleExtractWithGemini() {
    const activeSource = this.state.sources.find(s => s.id === this.activeSourceId);
    if (!activeSource) {
      this.showToast('Please select or save a source document first.', 'warning');
      return;
    }

    const apiKey = this.state.settings.geminiApiKey;
    if (!apiKey) {
      this.showToast('Please enter your Gemini API key in Settings first.', 'warning');
      this.openSettingsModal();
      return;
    }

    const btn = document.getElementById('btn-extract-gemini-trigger');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '✨ Extracting cards...';

    try {
      this.showToast('Calling Gemini API for strictly verbatim extraction...', 'info');
      const items = await extractStudyItemsFromNotes({
        apiKey,
        model: this.state.settings.modelName || DEFAULT_MODEL,
        notesText: activeSource.text
      });

      if (!items || items.length === 0) {
        throw new Error('No items generated by Gemini. Try adjusting notes text.');
      }

      let verifiedCount = 0;
      let unverifiedCount = 0;

      const newItems = items.map((item, idx) => {
        // Run verification check against the source text
        const verification = verifyExcerpt(activeSource.text, item.source_excerpt);
        if (verification.found) verifiedCount++;
        else unverifiedCount++;

        return {
          id: `extracted-${Date.now()}-${idx}`,
          sourceId: activeSource.id,
          concept: item.concept || 'General',
          type: item.type === 'quiz' ? 'quiz' : 'flashcard',
          front: item.front || item.question || '',
          back: item.back || item.answer || '',
          question: item.question || item.front || '',
          options: Array.isArray(item.options) && item.options.length === 4
            ? item.options
            : [item.answer, 'Alternative 1', 'Alternative 2', 'Alternative 3'],
          answer: item.answer || item.back || '',
          explanation: item.explanation || '',
          source_excerpt: item.source_excerpt || '',
          tags: Array.isArray(item.tags) ? item.tags : ['extracted'],
          status: 'pending', // MUST wait in queue
          verification: {
            sourceMatch: verification.status,
            aiClaimCheck: null
          },
          studyStats: { timesStudied: 0, knownCount: 0, unknownCount: 0, lastStudied: null },
          created_at: new Date().toISOString()
        };
      });

      // Add to pending queue
      this.state.items.unshift(...newItems);
      this.selectedReviewItemId = newItems[0].id;
      await this.saveCurrentState();

      this.switchTab('queue');
      this.showToast(
        `Extracted ${newItems.length} cards (${verifiedCount} verified excerpts, ${unverifiedCount} unverified). Awaiting review!`,
        'success',
        5000
      );
    } catch (err) {
      console.error(err);
      this.showToast(err.message || 'Extraction failed.', 'error', 6000);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  // =========================================================================
  // REVIEW QUEUE & EXCERPT VERIFICATION
  // =========================================================================
  renderReviewQueue() {
    const container = document.getElementById('review-items-container');
    const sourceTitleEl = document.getElementById('review-source-title');
    const sourceBodyEl = document.getElementById('review-source-body');
    const badgeEl = document.getElementById('review-source-badge');

    if (!container) return;

    const pendingItems = this.state.items.filter(it => it.status === 'pending');

    if (pendingItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card" style="margin: 0; width: 100%;">
          <div class="empty-icon">🎉</div>
          <h3>Review Queue is Empty!</h3>
          <p>All items have been approved into your Library or discarded. Add new notes or reload demo cards.</p>
          <div style="display: flex; gap: 0.5rem; justify-content: center;">
            <button class="btn btn-primary" id="queue-empty-btn-lib">Go to Library</button>
            <button class="btn btn-secondary" id="queue-empty-btn-demo">Reload Demo Cards</button>
          </div>
        </div>
      `;

      document.getElementById('queue-empty-btn-lib')?.addEventListener('click', () => this.switchTab('library'));
      document.getElementById('queue-empty-btn-demo')?.addEventListener('click', () => {
        this.loadDemoDataIntoState();
        this.saveCurrentState();
        this.renderAll();
      });

      sourceTitleEl.textContent = 'No Active Item Selected';
      sourceBodyEl.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">Select or extract study cards to review them against source notes.</span>';
      badgeEl.textContent = 'Idle';
      return;
    }

    // Default selection
    if (!this.selectedReviewItemId || !pendingItems.some(it => it.id === this.selectedReviewItemId)) {
      this.selectedReviewItemId = pendingItems[0].id;
    }

    const activeItem = pendingItems.find(it => it.id === this.selectedReviewItemId) || pendingItems[0];
    const itemSource = this.state.sources.find(s => s.id === activeItem.sourceId) || this.state.sources[0];

    // Update Left Source Inspector with Highlight
    if (itemSource) {
      sourceTitleEl.textContent = itemSource.title;
      badgeEl.textContent = `${activeItem.concept || 'Concept'}`;
      sourceBodyEl.innerHTML = highlightExcerptInHtml(itemSource.text, activeItem.source_excerpt);

      // Scroll highlight into view if possible
      setTimeout(() => {
        const markEl = sourceBodyEl.querySelector('.source-highlight');
        if (markEl) {
          markEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    } else {
      sourceTitleEl.textContent = 'Source Note Missing';
      sourceBodyEl.textContent = 'The original source note for this card was removed.';
      badgeEl.textContent = 'Orphan';
    }

    // Render pending cards list
    container.innerHTML = pendingItems.map(item => {
      const isSelected = item.id === this.selectedReviewItemId;
      const isVerified = item.verification?.sourceMatch === 'verified';
      const aiCheck = item.verification?.aiClaimCheck;

      let aiBadgeHtml = '';
      if (aiCheck) {
        if (aiCheck.verdict === 'supported') {
          aiBadgeHtml = `<span class="badge badge-supported" title="${escapeHtml(aiCheck.reason)}">✓ AI Checked: Supported</span>`;
        } else {
          aiBadgeHtml = `<span class="badge badge-claims" title="${escapeHtml(aiCheck.reason)}">⚠️ AI Checked: Adds Claims</span>`;
        }
      }

      return `
        <div class="review-card ${isSelected ? 'active-selected' : ''}" data-item-id="${item.id}">
          <div class="review-card-header">
            <div class="review-card-meta">
              <span class="badge badge-concept">${escapeHtml(item.concept || 'Concept')}</span>
              <span class="badge ${isVerified ? 'badge-verified' : 'badge-unverified'}">
                ${isVerified ? '✓ Verbatim Excerpt' : '⚠️ Excerpt Not Found'}
              </span>
              ${aiBadgeHtml}
            </div>
            <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">
              ${item.type === 'quiz' ? 'Multiple Choice' : 'Flashcard'}
            </span>
          </div>

          <!-- Excerpt from source note -->
          <div class="card-excerpt-quote">
            <div class="excerpt-label">Source Excerpt (Word-for-Word):</div>
            "${escapeHtml(item.source_excerpt)}"
          </div>

          <!-- Generated Content -->
          <div class="review-card-generated">
            <div class="generated-prompt">
              ${escapeHtml(item.type === 'quiz' ? item.question : item.front)}
            </div>

            ${
              item.type === 'quiz'
                ? `
                  <div style="font-size: 0.85rem; margin-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.2rem;">
                    ${(item.options || []).map((opt, i) => `
                      <div style="color: ${opt === item.answer ? 'var(--accent-success)' : 'var(--text-secondary)'}; font-weight: ${opt === item.answer ? '600' : 'normal'};">
                        ${String.fromCharCode(65 + i)}. ${escapeHtml(opt)} ${opt === item.answer ? '✓ (Correct)' : ''}
                      </div>
                    `).join('')}
                  </div>
                  ${item.explanation ? `<div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">Explanation: ${escapeHtml(item.explanation)}</div>` : ''}
                `
                : `<div class="generated-answer">${escapeHtml(item.back)}</div>`
            }
          </div>

          <!-- Tags -->
          <div class="tags-row">
            ${(item.tags || []).map(t => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join('')}
          </div>

          <!-- Actions -->
          <div class="review-card-actions">
            <div class="action-buttons-group">
              <button class="btn btn-outline btn-sm btn-check-source" data-item-id="${item.id}" title="Ask Gemini to compare card against excerpt">
                🔍 Check against source
              </button>
              <button class="btn btn-secondary btn-sm btn-edit-card" data-item-id="${item.id}">
                ✏️ Edit
              </button>
            </div>

            <div class="action-buttons-group">
              <button class="btn btn-outline btn-sm btn-discard-card" data-item-id="${item.id}" style="color: var(--accent-danger);">
                🗑️ Discard
              </button>
              <button class="btn btn-success btn-sm btn-approve-card" data-item-id="${item.id}">
                ✓ Approve to Library
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Wire Card Click for Inspection
    container.querySelectorAll('.review-card').forEach(cardEl => {
      cardEl.addEventListener('click', (e) => {
        // If clicked on an action button, do not just select
        if (e.target.closest('button')) return;
        this.selectedReviewItemId = cardEl.dataset.itemId;
        this.renderReviewQueue();
      });
    });

    // Wire Action Buttons
    container.querySelectorAll('.btn-check-source').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleCheckItemAgainstSource(btn.dataset.itemId);
      });
    });

    container.querySelectorAll('.btn-approve-card').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleApproveItem(btn.dataset.itemId);
      });
    });

    container.querySelectorAll('.btn-edit-card').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openEditModal(btn.dataset.itemId);
      });
    });

    container.querySelectorAll('.btn-discard-card').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleDiscardItem(btn.dataset.itemId);
      });
    });
  }

  async handleCheckItemAgainstSource(itemId) {
    const item = this.state.items.find(it => it.id === itemId);
    if (!item) return;

    const apiKey = this.state.settings.geminiApiKey;
    if (!apiKey) {
      this.showToast('Please configure your Gemini API Key in Settings to run AI verification.', 'warning');
      this.openSettingsModal();
      return;
    }

    this.showToast('Checking card against source excerpt with Gemini...', 'info');

    try {
      const result = await checkItemAgainstSource({
        apiKey,
        model: this.state.settings.modelName || DEFAULT_MODEL,
        item
      });

      item.verification = item.verification || {};
      item.verification.aiClaimCheck = result;
      await this.saveCurrentState();
      this.renderReviewQueue();

      if (result.verdict === 'supported') {
        this.showToast(`Verification: Supported! (${result.reason})`, 'success', 5000);
      } else {
        this.showToast(`Verification: Adds Claims! (${result.reason})`, 'warning', 6000);
      }
    } catch (err) {
      console.error(err);
      this.showToast(err.message || 'AI verification failed.', 'error');
    }
  }

  handleApproveItem(itemId) {
    const item = this.state.items.find(it => it.id === itemId);
    if (!item) return;

    item.status = 'approved';
    item.approved_at = new Date().toISOString();
    this.saveCurrentState();
    this.renderAll();
    this.showToast(`Approved "${item.concept}" into Library.`, 'success');
  }

  handleDiscardItem(itemId) {
    const item = this.state.items.find(it => it.id === itemId);
    if (!item) return;

    item.status = 'discarded';
    item.discarded_at = new Date().toISOString();
    this.saveCurrentState();
    this.renderAll();
    this.showToast('Item marked as discarded.', 'info');
  }

  // =========================================================================
  // LIBRARY VIEW
  // =========================================================================
  renderLibrary() {
    const container = document.getElementById('library-groups-container');
    const tagsBar = document.getElementById('library-tags-bar');
    if (!container) return;

    const approvedItems = this.state.items.filter(it => it.status === 'approved');

    // Collect all tags for tag filter pills
    const allTags = new Set();
    approvedItems.forEach(it => {
      (it.tags || []).forEach(t => allTags.add(t));
    });

    // Render tag filter pills
    tagsBar.innerHTML = `
      <button class="tag-filter-pill ${this.activeLibraryTag === '' ? 'active' : ''}" data-tag="">
        All (${approvedItems.length})
      </button>
      ${Array.from(allTags).map(t => `
        <button class="tag-filter-pill ${this.activeLibraryTag === t ? 'active' : ''}" data-tag="${escapeHtml(t)}">
          #${escapeHtml(t)}
        </button>
      `).join('')}
    `;

    tagsBar.querySelectorAll('.tag-filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeLibraryTag = btn.dataset.tag;
        this.renderLibrary();
      });
    });

    // Filter items
    const filteredItems = filterLibraryItems(approvedItems, {
      query: this.librarySearchQuery,
      tag: this.activeLibraryTag
    });

    if (filteredItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-icon">🔍</div>
          <h3>No approved items match your filter</h3>
          <p>${approvedItems.length === 0 ? 'Your library is empty. Approve pending cards from the review queue.' : 'Try clearing your search query or tag selection.'}</p>
          ${approvedItems.length === 0 ? '<button class="btn btn-primary" id="lib-empty-btn-queue">Go to Review Queue</button>' : ''}
        </div>
      `;
      document.getElementById('lib-empty-btn-queue')?.addEventListener('click', () => this.switchTab('queue'));
      return;
    }

    // Group filtered items by concept
    const grouped = groupItemsByConcept(filteredItems);

    container.innerHTML = Object.entries(grouped).map(([concept, items]) => `
      <section class="concept-group-section">
        <div class="concept-group-header">
          <h3 class="concept-group-title">
            <span>🏷️ ${escapeHtml(concept)}</span>
            <span class="badge badge-concept">${items.length} items</span>
          </h3>
          <button class="btn btn-outline btn-sm btn-study-concept" data-concept="${escapeHtml(concept)}">
            ⚡ Study this Concept
          </button>
        </div>

        <div class="concept-cards-grid">
          ${items.map(item => `
            <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; gap: 0.75rem;">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                  <span class="badge badge-concept" style="font-size: 0.7rem;">${escapeHtml(item.concept)}</span>
                  <span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">
                    ${item.type === 'quiz' ? 'Quiz' : 'Flashcard'}
                  </span>
                </div>

                <h4 style="font-size: 1rem; margin-bottom: 0.5rem; line-height: 1.4;">
                  ${escapeHtml(item.type === 'quiz' ? item.question : item.front)}
                </h4>

                <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.75rem; line-height: 1.5;">
                  ${escapeHtml(item.type === 'quiz' ? `Answer: ${item.answer}` : item.back)}
                </p>

                ${
                  item.source_excerpt
                    ? `<div style="font-size: 0.75rem; color: var(--text-muted); border-left: 2px solid var(--accent-info); padding-left: 0.5rem; margin-bottom: 0.75rem; font-style: italic;">
                        "${escapeHtml(item.source_excerpt)}"
                      </div>`
                    : ''
                }

                <div class="tags-row">
                  ${(item.tags || []).map(t => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join('')}
                </div>
              </div>

              <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 0.75rem; border-top: 1px solid var(--border-subtle); font-size: 0.75rem;">
                <span style="color: var(--text-muted);">
                  Studied: ${item.studyStats?.timesStudied || 0}x
                </span>
                <div style="display: flex; gap: 0.35rem;">
                  <button class="btn btn-outline btn-sm btn-edit-lib-card" data-item-id="${item.id}" title="Edit card">✏️</button>
                  <button class="btn btn-outline btn-sm btn-unapprove-card" data-item-id="${item.id}" title="Send back to review queue">↩️ Queue</button>
                  <button class="btn btn-outline btn-sm btn-delete-lib-card" data-item-id="${item.id}" title="Delete card" style="color: var(--accent-danger);">🗑️</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `).join('');

    // Wire Library buttons
    container.querySelectorAll('.btn-study-concept').forEach(btn => {
      btn.addEventListener('click', () => {
        const concept = btn.dataset.concept;
        this.switchTab('study');
        this.studyController.startSession('flashcards', { concept });
      });
    });

    container.querySelectorAll('.btn-edit-lib-card').forEach(btn => {
      btn.addEventListener('click', () => this.openEditModal(btn.dataset.itemId));
    });

    container.querySelectorAll('.btn-unapprove-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = this.state.items.find(it => it.id === btn.dataset.itemId);
        if (item) {
          item.status = 'pending';
          this.saveCurrentState();
          this.renderAll();
          this.showToast(`Returned "${item.concept}" card to Review Queue.`, 'info');
        }
      });
    });

    container.querySelectorAll('.btn-delete-lib-card').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Delete this card permanently from your library?')) {
          this.state.items = this.state.items.filter(it => it.id !== btn.dataset.itemId);
          this.saveCurrentState();
          this.renderAll();
          this.showToast('Card deleted.', 'info');
        }
      });
    });
  }

  // =========================================================================
  // DASHBOARD
  // =========================================================================
  renderDashboard() {
    const pendingCount = this.state.items.filter(it => it.status === 'pending').length;
    const approvedCount = this.state.items.filter(it => it.status === 'approved').length;
    const discardedCount = this.state.items.filter(it => it.status === 'discarded').length;
    const sourcesCount = this.state.sources.length;

    document.getElementById('dash-pending-count').textContent = pendingCount;
    document.getElementById('dash-approved-count').textContent = approvedCount;
    document.getElementById('dash-discarded-count').textContent = discardedCount;
    document.getElementById('dash-sources-count').textContent = sourcesCount;

    document.getElementById('nav-queue-count').textContent = pendingCount;
    document.getElementById('nav-library-count').textContent = approvedCount;

    // Concepts distribution breakdown
    const conceptsListEl = document.getElementById('dash-concepts-list');
    const totalConceptsBadge = document.getElementById('dash-total-concepts');
    const approvedItems = this.state.items.filter(it => it.status === 'approved');
    const conceptMap = {};

    approvedItems.forEach(it => {
      const c = it.concept || 'General';
      conceptMap[c] = (conceptMap[c] || 0) + 1;
    });

    const conceptEntries = Object.entries(conceptMap).sort((a, b) => b[1] - a[1]);
    totalConceptsBadge.textContent = `${conceptEntries.length} concepts`;

    if (conceptEntries.length === 0) {
      conceptsListEl.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No approved concepts yet. Review items in the queue to populate your library.</p>';
    } else {
      const maxCount = Math.max(...conceptEntries.map(e => e[1]));
      conceptsListEl.innerHTML = conceptEntries.slice(0, 6).map(([concept, count]) => {
        const pct = Math.round((count / maxCount) * 100);
        return `
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
              <span style="font-weight: 500;">${escapeHtml(concept)}</span>
              <span style="color: var(--text-muted);">${count} card${count > 1 ? 's' : ''}</span>
            </div>
            <div class="progress-bar-bg" style="height: 6px;">
              <div class="progress-bar-fill" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // Quiz History
    const quizHistoryEl = document.getElementById('dash-quiz-history-list');
    const quizCountBadge = document.getElementById('dash-quiz-attempts');
    const history = this.state.quizHistory || [];
    quizCountBadge.textContent = `${history.length} session${history.length === 1 ? '' : 's'}`;

    if (history.length === 0) {
      quizHistoryEl.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No quiz sessions taken yet. Test your recall in Study Mode to see retention trends.</p>';
    } else {
      quizHistoryEl.innerHTML = history.slice(-5).reverse().map(h => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.8rem; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <div>
            <div style="font-weight: 600; font-size: 0.85rem;">Score: ${h.correct}/${h.total} (${h.percentage}%)</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date(h.timestamp).toLocaleDateString()} ${new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <span class="badge ${h.percentage >= 80 ? 'badge-verified' : h.percentage >= 60 ? 'badge-claims' : 'badge-unverified'}">
            ${h.percentage}%
          </span>
        </div>
      `).join('');
    }
  }

  // =========================================================================
  // EDIT ITEM MODAL
  // =========================================================================
  openEditModal(itemId) {
    const item = this.state.items.find(it => it.id === itemId);
    if (!item) return;

    document.getElementById('edit-item-id').value = item.id;
    document.getElementById('edit-concept-input').value = item.concept || '';
    document.getElementById('edit-type-select').value = item.type || 'flashcard';
    document.getElementById('edit-front-input').value = item.front || '';
    document.getElementById('edit-back-input').value = item.back || '';
    document.getElementById('edit-question-input').value = item.question || '';

    const opts = Array.isArray(item.options) ? item.options : ['', '', '', ''];
    for (let i = 0; i < 4; i++) {
      document.getElementById(`edit-option-${i}`).value = opts[i] || '';
    }
    document.getElementById('edit-answer-input').value = item.answer || '';
    document.getElementById('edit-explanation-input').value = item.explanation || '';
    document.getElementById('edit-excerpt-input').value = item.source_excerpt || '';
    document.getElementById('edit-tags-input').value = (item.tags || []).join(', ');

    const isQuiz = item.type === 'quiz';
    document.getElementById('edit-flashcard-fields').style.display = isQuiz ? 'none' : 'block';
    document.getElementById('edit-quiz-fields').style.display = isQuiz ? 'block' : 'none';

    document.getElementById('edit-item-modal').style.display = 'flex';
  }

  closeEditModal() {
    document.getElementById('edit-item-modal').style.display = 'none';
  }

  handleSaveEditedItem() {
    const id = document.getElementById('edit-item-id').value;
    const item = this.state.items.find(it => it.id === id);
    if (!item) return;

    const type = document.getElementById('edit-type-select').value;
    item.concept = document.getElementById('edit-concept-input').value.trim();
    item.type = type;

    if (type === 'flashcard') {
      item.front = document.getElementById('edit-front-input').value.trim();
      item.back = document.getElementById('edit-back-input').value.trim();
    } else {
      item.question = document.getElementById('edit-question-input').value.trim();
      item.options = [
        document.getElementById('edit-option-0').value.trim(),
        document.getElementById('edit-option-1').value.trim(),
        document.getElementById('edit-option-2').value.trim(),
        document.getElementById('edit-option-3').value.trim()
      ];
      item.answer = document.getElementById('edit-answer-input').value.trim();
      item.explanation = document.getElementById('edit-explanation-input').value.trim();
    }

    item.source_excerpt = document.getElementById('edit-excerpt-input').value.trim();
    item.tags = document.getElementById('edit-tags-input').value
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    // Re-verify excerpt against source if available
    const src = this.state.sources.find(s => s.id === item.sourceId);
    if (src) {
      item.verification = item.verification || {};
      item.verification.sourceMatch = verifyExcerpt(src.text, item.source_excerpt).status;
    }

    this.saveCurrentState();
    this.closeEditModal();
    this.renderAll();
    this.showToast('Study item updated.', 'success');
  }

  // =========================================================================
  // MERGE TWO ITEMS
  // =========================================================================
  openMergeModal() {
    const pendingItems = this.state.items.filter(it => it.status === 'pending');
    if (pendingItems.length < 2) {
      this.showToast('You need at least 2 pending items in the queue to merge.', 'warning');
      return;
    }

    const sel1 = document.getElementById('merge-item-1-select');
    const sel2 = document.getElementById('merge-item-2-select');

    sel1.innerHTML = pendingItems.map(it => `
      <option value="${it.id}">[${escapeHtml(it.concept)}] ${escapeHtml(it.front || it.question || '').slice(0, 50)}...</option>
    `).join('');

    sel2.innerHTML = pendingItems.map((it, idx) => `
      <option value="${it.id}" ${idx === 1 ? 'selected' : ''}>[${escapeHtml(it.concept)}] ${escapeHtml(it.front || it.question || '').slice(0, 50)}...</option>
    `).join('');

    this.updateMergePreview();
    document.getElementById('merge-modal').style.display = 'flex';
  }

  closeMergeModal() {
    document.getElementById('merge-modal').style.display = 'none';
  }

  updateMergePreview() {
    const id1 = document.getElementById('merge-item-1-select').value;
    const id2 = document.getElementById('merge-item-2-select').value;

    const item1 = this.state.items.find(it => it.id === id1);
    const item2 = this.state.items.find(it => it.id === id2);
    if (!item1 || !item2) return;

    document.getElementById('merge-concept-input').value = item1.concept === item2.concept
      ? item1.concept
      : `${item1.concept} & ${item2.concept}`;

    document.getElementById('merge-front-input').value = `${item1.front || item1.question || ''}\n---\n${item2.front || item2.question || ''}`;
    document.getElementById('merge-back-input').value = `${item1.back || item1.answer || ''}\n\nAdditionally:\n${item2.back || item2.answer || ''}`;
    document.getElementById('merge-excerpt-input').value = `${item1.source_excerpt || ''}\n\n${item2.source_excerpt || ''}`.trim();
  }

  handleSubmitMerge() {
    const id1 = document.getElementById('merge-item-1-select').value;
    const id2 = document.getElementById('merge-item-2-select').value;

    if (id1 === id2) {
      this.showToast('Please select two distinct items to merge.', 'warning');
      return;
    }

    const item1 = this.state.items.find(it => it.id === id1);
    const item2 = this.state.items.find(it => it.id === id2);
    if (!item1 || !item2) return;

    const mergedItem = {
      id: `merged-${Date.now()}`,
      sourceId: item1.sourceId || item2.sourceId,
      concept: document.getElementById('merge-concept-input').value.trim(),
      type: 'flashcard',
      front: document.getElementById('merge-front-input').value.trim(),
      back: document.getElementById('merge-back-input').value.trim(),
      source_excerpt: document.getElementById('merge-excerpt-input').value.trim(),
      tags: Array.from(new Set([...(item1.tags || []), ...(item2.tags || [])])),
      status: 'pending',
      verification: {
        sourceMatch: 'verified',
        aiClaimCheck: null
      },
      studyStats: { timesStudied: 0, knownCount: 0, unknownCount: 0, lastStudied: null },
      created_at: new Date().toISOString()
    };

    // Remove the two merged items and add the consolidated item
    this.state.items = this.state.items.filter(it => it.id !== id1 && it.id !== id2);
    this.state.items.unshift(mergedItem);
    this.selectedReviewItemId = mergedItem.id;

    this.saveCurrentState();
    this.closeMergeModal();
    this.renderAll();
    this.showToast('Synthesized two cards into a single consolidated pending card.', 'success');
  }

  // =========================================================================
  // SETTINGS & PASS-PHRASE MANAGEMENT
  // =========================================================================
  openSettingsModal() {
    const keyInput = document.getElementById('setting-gemini-key');
    const modelSelect = document.getElementById('setting-model-select');

    keyInput.value = this.state.settings?.geminiApiKey || '';
    modelSelect.value = this.state.settings?.modelName || DEFAULT_MODEL;

    document.getElementById('setting-new-passphrase').value = '';
    document.getElementById('settings-modal').style.display = 'flex';
  }

  closeSettingsModal() {
    document.getElementById('settings-modal').style.display = 'none';
  }

  handleSaveSettings() {
    const key = document.getElementById('setting-gemini-key').value.trim();
    const model = document.getElementById('setting-model-select').value;

    this.state.settings = this.state.settings || {};
    this.state.settings.geminiApiKey = key;
    this.state.settings.modelName = model;

    this.saveCurrentState();
    this.closeSettingsModal();
    this.showToast('Settings saved and encrypted.', 'success');
  }

  async handleChangePassphrase() {
    const newPass = document.getElementById('setting-new-passphrase').value;
    if (!newPass || newPass.length < 4) {
      this.showToast('New passphrase must be at least 4 characters long.', 'error');
      return;
    }

    try {
      this.passphrase = newPass;
      await storage.initializeVault(newPass, this.state);
      document.getElementById('setting-new-passphrase').value = '';
      this.showToast('Vault re-encrypted with your new passphrase!', 'success');
    } catch (err) {
      this.showToast(err.message || 'Failed to update passphrase.', 'error');
    }
  }

  // =========================================================================
  // RENDER ALL
  // =========================================================================
  renderAll() {
    this.renderDashboard();
    this.renderSources();
    const currentSource = this.state.sources.find(s => s.id === this.activeSourceId);
    this.renderSentenceInspector(currentSource);
    this.renderReviewQueue();
    this.renderLibrary();
    if (this.currentTab === 'study') {
      this.studyController.render();
    }
  }
}

// Instantiate and boot on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  window.__lsg_app = app; // Accessible for debugging & automated checks
  app.init();
});
