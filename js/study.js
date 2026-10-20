/**
 * Study Mode Controller: Flashcard Flip Sessions & Interactive Multiple-Choice Quizzes
 */

import { calculateQuizScore } from './search-scoring.js';
import { escapeHtml } from './verification.js';

export class StudyController {
  constructor(app) {
    this.app = app;
    this.mode = 'flashcards'; // 'flashcards' | 'quiz'
    this.deck = [];
    this.currentIndex = 0;
    this.isFlipped = false;
    this.flashcardResults = { known: [], unknown: [] };
    this.quizAnswers = {};
    this.quizSubmitted = false;
    this.boundKeyHandler = this.handleKeyDown.bind(this);
  }

  startSession(mode = 'flashcards', filter = {}) {
    this.mode = mode;
    this.currentIndex = 0;
    this.isFlipped = false;
    this.flashcardResults = { known: [], unknown: [] };
    this.quizAnswers = {};
    this.quizSubmitted = false;

    // Filter approved items
    let candidateItems = this.app.state.items.filter(it => it.status === 'approved');

    if (filter.concept) {
      candidateItems = candidateItems.filter(it => it.concept === filter.concept);
    }
    if (filter.tag) {
      candidateItems = candidateItems.filter(it => it.tags && it.tags.includes(filter.tag));
    }

    if (mode === 'quiz') {
      candidateItems = candidateItems.filter(it => it.type === 'quiz');
    }

    // Shuffle deck
    this.deck = [...candidateItems].sort(() => Math.random() - 0.5);

    window.removeEventListener('keydown', this.boundKeyHandler);
    window.addEventListener('keydown', this.boundKeyHandler);

    this.render();
  }

  stopSession() {
    window.removeEventListener('keydown', this.boundKeyHandler);
  }

  handleKeyDown(e) {
    // Only handle if currently on study tab
    if (this.app.currentTab !== 'study') return;
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    if (this.mode === 'flashcards' && this.deck.length > 0 && this.currentIndex < this.deck.length) {
      if (e.code === 'Space') {
        e.preventDefault();
        this.toggleFlip();
      } else if (e.key === '1') {
        e.preventDefault();
        this.markFlashcard(false);
      } else if (e.key === '2') {
        e.preventDefault();
        this.markFlashcard(true);
      }
    }
  }

  toggleFlip() {
    this.isFlipped = !this.isFlipped;
    const cardEl = document.querySelector('.study-flip-card');
    if (cardEl) {
      cardEl.classList.toggle('flipped', this.isFlipped);
    }
  }

  markFlashcard(isKnown) {
    const currentItem = this.deck[this.currentIndex];
    if (!currentItem) return;

    if (isKnown) {
      this.flashcardResults.known.push(currentItem);
      currentItem.studyStats = currentItem.studyStats || {};
      currentItem.studyStats.knownCount = (currentItem.studyStats.knownCount || 0) + 1;
    } else {
      this.flashcardResults.unknown.push(currentItem);
      currentItem.studyStats = currentItem.studyStats || {};
      currentItem.studyStats.unknownCount = (currentItem.studyStats.unknownCount || 0) + 1;
    }
    currentItem.studyStats.timesStudied = (currentItem.studyStats.timesStudied || 0) + 1;
    currentItem.studyStats.lastStudied = new Date().toISOString();

    // Persist stats silently
    this.app.saveCurrentState();

    this.currentIndex++;
    this.isFlipped = false;
    this.render();
  }

  selectQuizOption(optionIndex) {
    if (this.quizAnswers[this.currentIndex] !== undefined) return; // already answered
    const currentItem = this.deck[this.currentIndex];
    const chosenOption = currentItem.options[optionIndex];
    this.quizAnswers[this.currentIndex] = chosenOption;
    this.render();
  }

  nextQuizQuestion() {
    this.currentIndex++;
    this.render();
  }

  finishQuiz() {
    const score = calculateQuizScore(this.deck, this.quizAnswers);
    this.app.state.quizHistory = this.app.state.quizHistory || [];
    this.app.state.quizHistory.push({
      id: `quiz-${Date.now()}`,
      timestamp: new Date().toISOString(),
      total: score.total,
      correct: score.correct,
      percentage: score.percentage
    });
    this.app.saveCurrentState();
    this.quizSubmitted = true;
    this.render();
  }

  render() {
    const container = document.getElementById('study-view-container');
    if (!container) return;

    if (this.deck.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-icon">📖</div>
          <h3>No approved items available to study</h3>
          <p>Approve items from the <a href="#queue" class="inline-link" id="link-to-queue">Review Queue</a> or load sample demo data to begin your study session.</p>
          <div class="empty-actions">
            <button class="btn btn-primary" id="study-switch-to-queue">Go to Review Queue</button>
          </div>
        </div>
      `;
      document.getElementById('study-switch-to-queue')?.addEventListener('click', () => {
        this.app.switchTab('queue');
      });
      document.getElementById('link-to-queue')?.addEventListener('click', (e) => {
        e.preventDefault();
        this.app.switchTab('queue');
      });
      return;
    }

    if (this.mode === 'flashcards') {
      this.renderFlashcards(container);
    } else {
      this.renderQuiz(container);
    }
  }

  renderFlashcards(container) {
    if (this.currentIndex >= this.deck.length) {
      // Completed Flashcards Deck
      const total = this.deck.length;
      const knownCount = this.flashcardResults.known.length;
      const pct = Math.round((knownCount / total) * 100);

      container.innerHTML = `
        <div class="study-summary-card">
          <div class="summary-badge">${pct >= 80 ? '🌟' : '💡'}</div>
          <h2>Session Complete!</h2>
          <div class="summary-metric">
            <span class="score-number">${knownCount}/${total}</span>
            <span class="score-label">${pct}% Retention Rate</span>
          </div>
          <div class="summary-breakdown">
            <span class="stat-pill success">✓ Known: ${knownCount}</span>
            <span class="stat-pill danger">✗ Still Learning: ${this.flashcardResults.unknown.length}</span>
          </div>

          <div class="summary-actions">
            ${
              this.flashcardResults.unknown.length > 0
                ? `<button class="btn btn-warning" id="study-review-missed">Review Missed Cards (${this.flashcardResults.unknown.length})</button>`
                : ''
            }
            <button class="btn btn-primary" id="study-restart-deck">Restart Full Deck</button>
            <button class="btn btn-secondary" id="study-switch-quiz">Take Quiz Instead</button>
          </div>
        </div>
      `;

      document.getElementById('study-review-missed')?.addEventListener('click', () => {
        this.deck = [...this.flashcardResults.unknown];
        this.currentIndex = 0;
        this.flashcardResults = { known: [], unknown: [] };
        this.isFlipped = false;
        this.render();
      });

      document.getElementById('study-restart-deck')?.addEventListener('click', () => {
        this.startSession('flashcards');
      });

      document.getElementById('study-switch-quiz')?.addEventListener('click', () => {
        this.startSession('quiz');
      });

      return;
    }

    const item = this.deck[this.currentIndex];
    const progressPercent = Math.round(((this.currentIndex) / this.deck.length) * 100);

    container.innerHTML = `
      <div class="study-session-header">
        <div class="study-mode-tabs">
          <button class="mode-tab-btn active" id="btn-mode-flashcards">Flashcards</button>
          <button class="mode-tab-btn" id="btn-mode-quiz">Quiz Mode</button>
        </div>
        <div class="study-progress-wrapper">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
          </div>
          <span class="progress-text">Card ${this.currentIndex + 1} of ${this.deck.length}</span>
        </div>
      </div>

      <div class="study-card-perspective">
        <div class="study-flip-card ${this.isFlipped ? 'flipped' : ''}" id="flip-card-element" tabindex="0" role="button" aria-label="Flashcard. Press space to flip.">
          <!-- Card Front -->
          <div class="card-face card-front">
            <div class="card-top-meta">
              <span class="concept-badge">${escapeHtml(item.concept || 'Concept')}</span>
              <span class="flip-hint">Space / Click to Flip ↷</span>
            </div>
            <div class="card-body-content">
              <h3 class="card-prompt">${escapeHtml(item.front || item.question || '')}</h3>
            </div>
            <div class="card-bottom-meta">
              <div class="tags-row">
                ${(item.tags || []).map(t => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join('')}
              </div>
              <span class="flip-tap-note">Tap card to see answer</span>
            </div>
          </div>

          <!-- Card Back -->
          <div class="card-face card-back">
            <div class="card-top-meta">
              <span class="concept-badge">${escapeHtml(item.concept || 'Concept')}</span>
              <span class="verified-label">✓ Source Fact</span>
            </div>
            <div class="card-body-content">
              <p class="card-answer">${escapeHtml(item.back || item.answer || '')}</p>
              ${
                item.source_excerpt
                  ? `<div class="card-source-box">
                      <div class="source-box-title">Source Excerpt:</div>
                      <p class="source-box-text">"${escapeHtml(item.source_excerpt)}"</p>
                    </div>`
                  : ''
              }
            </div>
            <div class="card-bottom-meta">
              <span class="flip-hint">Space / Click to Flip back</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Study Action Controls -->
      <div class="study-controls">
        <button class="btn btn-study-unknown" id="btn-mark-unknown" title="Press 1">
          <span class="btn-icon">✗</span> Still Learning <kbd>1</kbd>
        </button>
        <button class="btn btn-study-flip" id="btn-flip-card" title="Press Space">
          <span class="btn-icon">↻</span> Flip Card <kbd>Space</kbd>
        </button>
        <button class="btn btn-study-known" id="btn-mark-known" title="Press 2">
          <span class="btn-icon">✓</span> I Know This <kbd>2</kbd>
        </button>
      </div>
    `;

    document.getElementById('btn-mode-flashcards')?.addEventListener('click', () => this.startSession('flashcards'));
    document.getElementById('btn-mode-quiz')?.addEventListener('click', () => this.startSession('quiz'));
    document.getElementById('flip-card-element')?.addEventListener('click', () => this.toggleFlip());
    document.getElementById('btn-flip-card')?.addEventListener('click', () => this.toggleFlip());
    document.getElementById('btn-mark-unknown')?.addEventListener('click', () => this.markFlashcard(false));
    document.getElementById('btn-mark-known')?.addEventListener('click', () => this.markFlashcard(true));
  }

  renderQuiz(container) {
    if (this.quizSubmitted || this.currentIndex >= this.deck.length) {
      // Quiz Summary Screen
      const score = calculateQuizScore(this.deck, this.quizAnswers);
      container.innerHTML = `
        <div class="study-summary-card">
          <div class="summary-badge">${score.percentage >= 80 ? '🏆' : '📝'}</div>
          <h2>Quiz Completed</h2>
          <div class="summary-metric">
            <span class="score-number">${score.correct} / ${score.total}</span>
            <span class="score-label">${score.percentage}% - ${score.rating}</span>
          </div>

          <div class="quiz-results-review">
            <h4>Question Breakdown</h4>
            ${score.results.map((res, idx) => `
              <div class="quiz-review-item ${res.isCorrect ? 'review-correct' : 'review-incorrect'}">
                <div class="review-header">
                  <span class="review-num">Q${idx + 1}.</span>
                  <span class="review-title">${escapeHtml(res.question)}</span>
                  <span class="review-status">${res.isCorrect ? '✓ Correct' : '✗ Missed'}</span>
                </div>
                <div class="review-answers">
                  <div><strong>Your answer:</strong> ${escapeHtml(res.userAnswer || '(none)')}</div>
                  ${!res.isCorrect ? `<div><strong>Correct answer:</strong> ${escapeHtml(res.correctAnswer)}</div>` : ''}
                </div>
                ${res.explanation ? `<div class="review-explanation">${escapeHtml(res.explanation)}</div>` : ''}
                ${res.source_excerpt ? `<div class="review-source">Source: "${escapeHtml(res.source_excerpt)}"</div>` : ''}
              </div>
            `).join('')}
          </div>

          <div class="summary-actions">
            <button class="btn btn-primary" id="quiz-retry-btn">Retry Quiz</button>
            <button class="btn btn-secondary" id="quiz-back-flashcards">Switch to Flashcards</button>
          </div>
        </div>
      `;

      document.getElementById('quiz-retry-btn')?.addEventListener('click', () => {
        this.startSession('quiz');
      });
      document.getElementById('quiz-back-flashcards')?.addEventListener('click', () => {
        this.startSession('flashcards');
      });

      return;
    }

    const item = this.deck[this.currentIndex];
    const currentAnswer = this.quizAnswers[this.currentIndex];
    const isAnswered = currentAnswer !== undefined;
    const progressPercent = Math.round(((this.currentIndex) / this.deck.length) * 100);

    const options = Array.isArray(item.options) && item.options.length > 0
      ? item.options
      : ['Option 1', 'Option 2', 'Option 3', 'Option 4'];

    container.innerHTML = `
      <div class="study-session-header">
        <div class="study-mode-tabs">
          <button class="mode-tab-btn" id="btn-mode-flashcards">Flashcards</button>
          <button class="mode-tab-btn active" id="btn-mode-quiz">Quiz Mode</button>
        </div>
        <div class="study-progress-wrapper">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
          </div>
          <span class="progress-text">Question ${this.currentIndex + 1} of ${this.deck.length}</span>
        </div>
      </div>

      <div class="quiz-question-card">
        <div class="card-top-meta">
          <span class="concept-badge">${escapeHtml(item.concept || 'Concept')}</span>
          <span class="quiz-type-badge">Multiple Choice</span>
        </div>
        <h3 class="quiz-question-text">${escapeHtml(item.question || item.front || '')}</h3>

        <div class="quiz-options-list">
          ${options.map((opt, idx) => {
            let stateClass = '';
            if (isAnswered) {
              if (opt === item.answer) {
                stateClass = 'option-correct';
              } else if (opt === currentAnswer) {
                stateClass = 'option-incorrect';
              } else {
                stateClass = 'option-dimmed';
              }
            }

            return `
              <button class="quiz-option-btn ${stateClass}" data-opt-index="${idx}" ${isAnswered ? 'disabled' : ''}>
                <span class="opt-letter">${String.fromCharCode(65 + idx)}</span>
                <span class="opt-text">${escapeHtml(opt)}</span>
                ${isAnswered && opt === item.answer ? '<span class="opt-check">✓</span>' : ''}
                ${isAnswered && opt === currentAnswer && opt !== item.answer ? '<span class="opt-cross">✗</span>' : ''}
              </button>
            `;
          }).join('')}
        </div>

        ${
          isAnswered
            ? `
              <div class="quiz-feedback-box ${currentAnswer === item.answer ? 'feedback-correct' : 'feedback-incorrect'}">
                <div class="feedback-heading">
                  ${currentAnswer === item.answer ? '✓ Correct!' : `✗ Incorrect — Correct answer is: ${escapeHtml(item.answer)}`}
                </div>
                ${item.explanation ? `<p class="feedback-explanation">${escapeHtml(item.explanation)}</p>` : ''}
                ${item.source_excerpt ? `<div class="feedback-source"><strong>Source:</strong> "${escapeHtml(item.source_excerpt)}"</div>` : ''}
              </div>
            `
            : ''
        }

        <div class="quiz-nav-row">
          ${
            isAnswered
              ? `
                <button class="btn btn-primary" id="btn-quiz-next">
                  ${this.currentIndex < this.deck.length - 1 ? 'Next Question →' : 'Complete Quiz & View Score'}
                </button>
              `
              : `<span class="quiz-hint-text">Select an option above to check your answer</span>`
          }
        </div>
      </div>
    `;

    document.getElementById('btn-mode-flashcards')?.addEventListener('click', () => this.startSession('flashcards'));
    document.getElementById('btn-mode-quiz')?.addEventListener('click', () => this.startSession('quiz'));

    container.querySelectorAll('.quiz-option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.optIndex, 10);
        this.selectQuizOption(idx);
      });
    });

    document.getElementById('btn-quiz-next')?.addEventListener('click', () => {
      if (this.currentIndex < this.deck.length - 1) {
        this.nextQuizQuestion();
      } else {
        this.finishQuiz();
      }
    });
  }
}
