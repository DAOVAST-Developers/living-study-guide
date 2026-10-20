/**
 * Search, Filtering, and Scoring Pure Logic
 */

export function filterLibraryItems(items, { query = '', tag = '', concept = '' } = {}) {
  if (!Array.isArray(items)) return [];

  const cleanQuery = (query || '').trim().toLowerCase();
  const cleanTag = (tag || '').trim().toLowerCase();
  const cleanConcept = (concept || '').trim().toLowerCase();

  return items.filter(item => {
    // 1. Tag filter
    if (cleanTag) {
      const itemTags = Array.isArray(item.tags)
        ? item.tags.map(t => t.toLowerCase())
        : [];
      if (!itemTags.includes(cleanTag)) return false;
    }

    // 2. Concept filter
    if (cleanConcept) {
      if ((item.concept || '').toLowerCase() !== cleanConcept) return false;
    }

    // 3. Search query filter
    if (!cleanQuery) return true;

    const searchableFields = [
      item.concept,
      item.front,
      item.back,
      item.question,
      item.source_excerpt,
      ...(Array.isArray(item.options) ? item.options : []),
      ...(Array.isArray(item.tags) ? item.tags : [])
    ];

    return searchableFields.some(field =>
      typeof field === 'string' && field.toLowerCase().includes(cleanQuery)
    );
  });
}

/**
 * Groups items by concept
 */
export function groupItemsByConcept(items) {
  const groups = {};
  for (const item of items) {
    const concept = item.concept || 'General';
    if (!groups[concept]) groups[concept] = [];
    groups[concept].push(item);
  }
  return groups;
}

/**
 * Calculates quiz score and produces performance feedback
 */
export function calculateQuizScore(questions, answers) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return {
      total: 0,
      correct: 0,
      percentage: 0,
      rating: 'No questions',
      results: []
    };
  }

  let correctCount = 0;
  const results = questions.map((q, idx) => {
    const userAnswer = answers[q.id] || answers[idx];
    const isCorrect = userAnswer === q.answer;
    if (isCorrect) correctCount++;

    return {
      questionId: q.id,
      question: q.question,
      userAnswer,
      correctAnswer: q.answer,
      isCorrect,
      explanation: q.explanation || '',
      source_excerpt: q.source_excerpt || ''
    };
  });

  const percentage = Math.round((correctCount / questions.length) * 100);

  let rating = 'Needs Review';
  if (percentage === 100) rating = 'Mastery Achieved';
  else if (percentage >= 80) rating = 'Excellent';
  else if (percentage >= 60) rating = 'Good Progress';

  return {
    total: questions.length,
    correct: correctCount,
    percentage,
    rating,
    results,
    timestamp: new Date().toISOString()
  };
}
