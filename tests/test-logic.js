/**
 * Unit Tests for Living Study Guide Core Logic
 * Runnable via: node tests/test-logic.js
 */

import { splitSentences, verifyExcerpt, normalizeText } from '../js/verification.js';
import { encryptData, decryptData } from '../js/crypto.js';
import { filterLibraryItems, groupItemsByConcept, calculateQuizScore } from '../js/search-scoring.js';
import { DEMO_SOURCE_TEXT, DEMO_ITEMS } from '../js/demo-data.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed++;
    throw new Error(message);
  } else {
    console.log(`✅ PASS: ${message}`);
    passed++;
  }
}

async function runTests() {
  console.log('--- RUNNING LIVING STUDY GUIDE LOGIC TESTS ---\n');

  // 1. Text Normalization Tests
  console.log('[1/6] Testing Text Normalization...');
  assert(
    normalizeText('  Hello   World!\n\nNew line  ') === 'hello world! new line',
    'normalizeText handles multiple spaces, newlines, and trims'
  );

  // 2. Sentence Splitting Tests
  console.log('\n[2/6] Testing Sentence Splitting...');
  const sampleText = 'The Internet is huge. Each packet, e.g. a TCP packet, has an IP. Is it fast? Yes, it is!';
  const sentences = splitSentences(sampleText);
  assert(sentences.length >= 3, `Splits into at least 3 sentences (got ${sentences.length})`);
  assert(sentences[0].index === 1, 'Sentence index starts at 1');
  assert(sentences[0].text.includes('Internet is huge'), 'First sentence matches content');
  // Check that "e.g." didn't break prematurely
  const egSentence = sentences.find(s => s.text.includes('TCP packet'));
  assert(egSentence && egSentence.text.includes('e.g.'), 'Sentence splitter respects abbreviation e.g.');

  // 3. Excerpt Verification Tests
  console.log('\n[3/6] Testing Excerpt Verification...');
  const source = 'Routers inspect each packet\'s destination address and dynamically forward it.';
  
  // Exact match
  const vExact = verifyExcerpt(source, 'inspect each packet\'s destination address');
  assert(vExact.found === true && vExact.status === 'verified', 'Exact excerpt verified');
  assert(vExact.matchSpan.start > 0, 'Exact match span detected');

  // Case & whitespace variation
  const vLoose = verifyExcerpt(source, '  INSPECT   EACH packet\'s\n  destination address  ');
  assert(vLoose.found === true && vLoose.status === 'verified', 'Case and whitespace insensitive match verified');

  // Non-matching excerpt
  const vBad = verifyExcerpt(source, 'Quantum satellites telepathically teleport the data packets.');
  assert(vBad.found === false && vBad.status === 'excerpt not found', 'Unmatched excerpt marked as "excerpt not found"');

  // Empty excerpt
  const vEmpty = verifyExcerpt(source, '');
  assert(vEmpty.found === false && vEmpty.status === 'excerpt not found', 'Empty excerpt rejected');

  // 4. Web Crypto PBKDF2 + AES-GCM Tests
  console.log('\n[4/6] Testing Web Crypto PBKDF2 + AES-GCM...');
  const originalSecret = JSON.stringify({
    apiKey: 'AIzaSyDemoKey1234567890',
    library: [{ id: 1, front: 'What is DNS?', back: 'Domain Name System' }]
  });
  const passphrase = 'Correct-Horse-Battery-Staple-99!';

  const encrypted = await encryptData(originalSecret, passphrase);
  assert(encrypted.v === 1, 'Encryption produces version 1 envelope');
  assert(typeof encrypted.salt === 'string' && encrypted.salt.length > 10, 'Envelope contains base64 salt');
  assert(typeof encrypted.iv === 'string' && encrypted.iv.length > 10, 'Envelope contains base64 IV');
  assert(typeof encrypted.data === 'string' && encrypted.data.length > 20, 'Envelope contains base64 ciphertext');
  assert(!encrypted.data.includes('AIzaSyDemoKey'), 'Ciphertext does not contain plain secret');

  const decrypted = await decryptData(encrypted, passphrase);
  assert(decrypted === originalSecret, 'Round-trip encryption/decryption matches original secret perfectly');

  // Test incorrect passphrase failure
  let decryptFailedAsExpected = false;
  try {
    await decryptData(encrypted, 'Wrong-Passphrase-123');
  } catch (err) {
    decryptFailedAsExpected = true;
  }
  assert(decryptFailedAsExpected, 'Decryption with wrong passphrase throws error as expected');

  // 5. Search, Filter & Scoring Tests
  console.log('\n[5/6] Testing Search & Quiz Scoring...');
  const testItems = [
    { id: '1', concept: 'DNS', front: 'What is DNS?', back: 'Translates hostnames to IPs', tags: ['networking'] },
    { id: '2', concept: 'TCP', front: 'What is TCP?', back: 'Transmission Control Protocol', tags: ['transport'] },
    { id: '3', concept: 'DNS', front: 'What are Root Servers?', back: 'Top level DNS', tags: ['networking', 'dns'] }
  ];

  const searchRes = filterLibraryItems(testItems, { query: 'hostnames' });
  assert(searchRes.length === 1 && searchRes[0].id === '1', 'Search finds item by back content');

  const tagRes = filterLibraryItems(testItems, { tag: 'networking' });
  assert(tagRes.length === 2, 'Tag filter returns 2 networking items');

  const conceptGroups = groupItemsByConcept(testItems);
  assert(conceptGroups['DNS'] && conceptGroups['DNS'].length === 2, 'Items grouped by concept');

  // Scoring
  const questions = [
    { id: 'q1', question: 'Q1', answer: 'A', explanation: 'Exp 1' },
    { id: 'q2', question: 'Q2', answer: 'B', explanation: 'Exp 2' },
    { id: 'q3', question: 'Q3', answer: 'C', explanation: 'Exp 3' },
    { id: 'q4', question: 'Q4', answer: 'D', explanation: 'Exp 4' }
  ];
  const answers = { q1: 'A', q2: 'B', q3: 'WRONG', q4: 'D' };
  const scoreResult = calculateQuizScore(questions, answers);
  assert(scoreResult.total === 4, 'Score total count matches');
  assert(scoreResult.correct === 3, 'Score correct count matches');
  assert(scoreResult.percentage === 75, 'Score percentage is 75%');
  assert(scoreResult.results[0].isCorrect === true, 'Question 1 scored correct');
  assert(scoreResult.results[2].isCorrect === false, 'Question 3 scored incorrect');

  // 6. Demo Data Verification Tests
  console.log('\n[6/6] Verifying Demo Data Excerpts & Flawed Card...');
  assert(DEMO_ITEMS.length === 8, '8 demo pending cards present');

  let allFound = true;
  for (const item of DEMO_ITEMS) {
    const v = verifyExcerpt(DEMO_SOURCE_TEXT, item.source_excerpt);
    if (!v.found) {
      allFound = false;
      console.error(`Item ${item.id} excerpt not found in demo text: "${item.source_excerpt}"`);
    }
  }
  assert(allFound, 'All 8 demo cards have real, valid excerpts in the demo text');

  // Verify that item 6 contains the deliberate flaw in back answer vs excerpt
  const flawedCard = DEMO_ITEMS.find(it => it.id === 'demo-item-6');
  assert(flawedCard !== undefined, 'Deliberately flawed card (demo-item-6) exists');
  assert(flawedCard.back.includes('United Nations'), 'Flawed card contains unmentioned added claim');
  assert(!DEMO_SOURCE_TEXT.includes('United Nations'), 'Notes do NOT contain the added UN claim (verifying the flaw is genuine)');

  console.log(`\n========================================`);
  console.log(`ALL TESTS PASSED! (${passed} checks passed, ${failed} failed)`);
  console.log(`========================================\n`);
}

runTests().catch(err => {
  console.error('\nTest runner failed:', err);
  process.exit(1);
});
