import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEARNING_LESSONS,
  normalizeLearningState,
  learningProgressSummary,
  nextLearningLessonId,
  renderLearningCenterHtml,
} from '../src/ui/learning-center-controller.js';

test('curriculum covers a full beginner-to-advanced editor path', () => {
  assert.equal(LEARNING_LESSONS.length, 10);
  assert.equal(new Set(LEARNING_LESSONS.map(lesson => lesson.id)).size, LEARNING_LESSONS.length);
  assert.deepEqual([...new Set(LEARNING_LESSONS.map(lesson => lesson.level))], ['База','Уверенно','Продвинуто']);
  const corpus=LEARNING_LESSONS.flatMap(lesson => [
    lesson.title, lesson.summary, lesson.challenge,
    ...lesson.skills, ...lesson.practice, ...lesson.mastery, ...lesson.mistakes,
  ]).join(' ');
  for (const term of ['Слои','маск','ретуш','Smart Object','PSD/PSB','цвет','Перо']) {
    assert.match(corpus, new RegExp(term, 'i'));
  }
  assert.ok(LEARNING_LESSONS.every(lesson => lesson.practice.length >= 4));
  assert.ok(LEARNING_LESSONS.every(lesson => lesson.mastery.length >= 3));
});

test('learning state drops unknown/duplicate lesson ids and preserves a valid resume point', () => {
  const state=normalizeLearningState({
    completed:['layers','unknown','layers','start'],
    lastLessonId:'selection',
  });
  assert.deepEqual(state.completed,['layers','start']);
  assert.equal(state.lastLessonId,'selection');
});

test('progress and resume select the first incomplete lesson', () => {
  const state=normalizeLearningState({completed:['start','layers'],lastLessonId:'layers'});
  assert.deepEqual(learningProgressSummary(state),{completed:2,total:10,percent:20});
  assert.equal(nextLearningLessonId(state),'transform');
  assert.equal(nextLearningLessonId({completed:LEARNING_LESSONS.map(lesson=>lesson.id)}),null);
});

test('rendered Learning Center exposes progress, navigation and mastery practice', () => {
  const html=renderLearningCenterHtml({completed:['start'],lastLessonId:'layers'},'layers');
  assert.match(html,/1 \/ 10 уроков/);
  assert.match(html,/aria-valuenow="1"/);
  assert.match(html,/data-learning-lesson-id="layers" aria-current="step"/);
  assert.match(html,/Практика в редакторе/);
  assert.match(html,/Критерий мастерства/);
  assert.match(html,/Отметить урок пройденным/);
});
