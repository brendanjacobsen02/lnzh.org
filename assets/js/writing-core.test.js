const test = require('node:test');
const assert = require('node:assert');
const core = require('./writing-core.js');

test('normalizeText trims and collapses whitespace', () => {
    assert.equal(core.normalizeText('  hi   there \n'), 'hi there');
    assert.equal(core.normalizeText(''), '');
});

test('extractSentences splits on terminal punctuation, keeps remainder', () => {
    const r = core.extractSentences('One sentence. Two now! A third? leftover');
    assert.deepEqual(r.sentences, ['One sentence.', 'Two now!', 'A third?']);
    assert.equal(r.remainder, 'leftover');
});

test('extractSentences keeps closing quotes/brackets with the sentence', () => {
    const r = core.extractSentences('He said "hi." Next');
    assert.deepEqual(r.sentences, ['He said "hi."']);
    assert.equal(r.remainder, 'Next');
});

test('extractSentences returns no sentences when none are complete', () => {
    const r = core.extractSentences('still writing');
    assert.deepEqual(r.sentences, []);
    assert.equal(r.remainder, 'still writing');
});

test('countWords counts whitespace-separated tokens', () => {
    assert.equal(core.countWords('one two three'), 3);
    assert.equal(core.countWords('  spaced   out  '), 2);
    assert.equal(core.countWords(''), 0);
});

test('computeStats reports words, sentences (incl. in-progress), kept', () => {
    const reviewed = [
        { text: 'Kept one.', keep: true },
        { text: 'Cut this.', keep: false },
    ];
    const s = core.computeStats(reviewed, 'in progress');
    assert.equal(s.sentences, 3);          // 2 reviewed + 1 in-progress
    assert.equal(s.kept, 1);
    assert.equal(s.words, 6);              // "Kept one. Cut this. in progress"
});

test('computeStats with empty input is all zeros', () => {
    assert.deepEqual(core.computeStats([], ''), { words: 0, sentences: 0, kept: 0 });
});

test('pad2 zero-pads non-negative integers', () => {
    assert.equal(core.pad2(0), '00');
    assert.equal(core.pad2(7), '07');
    assert.equal(core.pad2(42), '42');
    assert.equal(core.pad2(-3), '00');
});

test('serialize/deserialize drafts round-trips and rejects junk', () => {
    const drafts = [{ id: 'a', text: 'hello', createdAt: 123 }];
    assert.deepEqual(core.deserializeDrafts(core.serializeDrafts(drafts)), drafts);
    assert.deepEqual(core.deserializeDrafts('not json'), []);
    assert.deepEqual(core.deserializeDrafts('{"x":1}'), []);   // not an array
    // drops entries without string text, coerces fields
    assert.deepEqual(
        core.deserializeDrafts('[{"text":"ok"},{"nope":1}]'),
        [{ id: '', text: 'ok', createdAt: 0 }]
    );
});
