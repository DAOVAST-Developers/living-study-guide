/**
 * Backup & Export / Import Management
 * Handles JSON file download and validated restoration
 */

export function exportBackupData(state) {
  const backupObject = {
    app: 'LivingStudyGuide',
    version: 1,
    exportedAt: new Date().toISOString(),
    sources: state.sources || [],
    items: state.items || [],
    quizHistory: state.quizHistory || []
  };

  const jsonString = JSON.stringify(backupObject, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `living-study-guide-backup-${dateStr}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function validateAndParseBackup(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON format. File could not be parsed.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Backup file must contain a valid JSON object.');
  }

  if (!Array.isArray(parsed.sources) && !Array.isArray(parsed.items)) {
    throw new Error('Unrecognized backup format: missing sources or items array.');
  }

  const sources = Array.isArray(parsed.sources) ? parsed.sources : [];
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const quizHistory = Array.isArray(parsed.quizHistory) ? parsed.quizHistory : [];

  // Sanitize each item
  const cleanItems = items.map((item, idx) => ({
    id: item.id || `restored-item-${idx}-${Date.now()}`,
    sourceId: item.sourceId || (sources[0]?.id || null),
    concept: item.concept || 'General',
    type: item.type === 'quiz' ? 'quiz' : 'flashcard',
    front: item.front || '',
    back: item.back || '',
    question: item.question || '',
    options: Array.isArray(item.options) ? item.options : [],
    answer: item.answer || '',
    explanation: item.explanation || '',
    source_excerpt: item.source_excerpt || '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    status: ['pending', 'approved', 'discarded'].includes(item.status) ? item.status : 'approved',
    verification: item.verification || { sourceMatch: 'verified', aiClaimCheck: null },
    studyStats: item.studyStats || { timesStudied: 0, knownCount: 0, unknownCount: 0, lastStudied: null },
    created_at: item.created_at || new Date().toISOString()
  }));

  const cleanSources = sources.map((src, idx) => ({
    id: src.id || `restored-src-${idx}-${Date.now()}`,
    title: src.title || `Imported Source ${idx + 1}`,
    text: src.text || '',
    createdAt: src.createdAt || new Date().toISOString()
  }));

  return {
    sources: cleanSources,
    items: cleanItems,
    quizHistory
  };
}
