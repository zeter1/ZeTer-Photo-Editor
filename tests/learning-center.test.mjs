import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEARNING_LESSONS,
  LEARNING_LESSON_GUIDES,
  normalizeLearningState,
  learningProgressSummary,
  nextLearningLessonId,
  learningLessonReadiness,
  learningLevelProgress,
  renderLearningCenterHtml,
} from '../src/ui/learning-center-controller.js';

test('curriculum covers a full beginner-to-advanced editor path with a learning model and knowledge check', () => {
  assert.equal(LEARNING_LESSONS.length, 10);
  assert.equal(new Set(LEARNING_LESSONS.map(lesson => lesson.id)).size, LEARNING_LESSONS.length);
  assert.deepEqual([...new Set(LEARNING_LESSONS.map(lesson => lesson.level))], ['База','Уверенно','Продвинуто']);
  const corpus=LEARNING_LESSONS.flatMap(lesson => [
    lesson.title,lesson.summary,lesson.challenge,...lesson.skills,...lesson.practice,...lesson.mastery,...lesson.mistakes,
  ]).join(' ');
  for (const term of ['Слои','маск','ретуш','Smart Object','PSD/PSB','цвет','Перо']) assert.match(corpus,new RegExp(term,'i'));
  assert.ok(LEARNING_LESSONS.every(lesson => lesson.practice.length >= 4));
  assert.ok(LEARNING_LESSONS.every(lesson => lesson.mastery.length >= 3));
  for (const lesson of LEARNING_LESSONS) {
    const guide=LEARNING_LESSON_GUIDES[lesson.id];
    assert.ok(guide?.mentalModel.length > 60,lesson.id);
    assert.ok(guide?.decisionRule.length > 40,lesson.id);
    assert.equal(guide?.quiz.length,2,lesson.id);
    assert.ok(guide.quiz.every(item => item.correctIndex >= 0 && item.correctIndex < item.options.length));
    assert.ok(guide.quiz.every(item => item.explanation.length > 20));
  }
});

test('learning state validates evidence fields and preserves a valid resume point', () => {
  const state=normalizeLearningState({
    version:2,
    completed:['layers','unknown','layers','start'],
    lastLessonId:'selection',
    practice:{start:[0,0,3,99,-1],unknown:[0]},
    mastery:{start:[2,'1',0]},
    quizPassed:['start','unknown','start'],
  });
  assert.deepEqual(state.completed,['layers','start']);
  assert.equal(state.lastLessonId,'selection');
  assert.deepEqual(state.practice,{start:[0,3]});
  assert.deepEqual(state.mastery,{start:[0,2]});
  assert.deepEqual(state.quizPassed,['start']);
});

test('legacy completed lessons migrate to v2 mastery evidence without losing progress', () => {
  const state=normalizeLearningState({completed:['start'],lastLessonId:'start'});
  assert.equal(state.version,2);
  assert.equal(state.practice.start.length,LEARNING_LESSONS[0].practice.length);
  assert.equal(state.mastery.start.length,LEARNING_LESSONS[0].mastery.length);
  assert.deepEqual(state.quizPassed,['start']);
  assert.equal(learningLessonReadiness(state,'start').ready,true);
});

test('lesson readiness requires hands-on practice, mastery self-check and knowledge check', () => {
  const lesson=LEARNING_LESSONS[0];
  const practice=Array.from({length:lesson.practice.length},(_,index)=>index);
  const mastery=Array.from({length:lesson.mastery.length},(_,index)=>index);
  assert.equal(learningLessonReadiness({version:2,practice:{start:practice},mastery:{start:mastery}},'start').ready,false);
  const ready=learningLessonReadiness({version:2,practice:{start:practice},mastery:{start:mastery},quizPassed:['start']},'start');
  assert.equal(ready.practice.done,true);
  assert.equal(ready.mastery.done,true);
  assert.equal(ready.quizPassed,true);
  assert.equal(ready.ready,true);
});

test('progress, level summary and resume select the first incomplete lesson', () => {
  const state=normalizeLearningState({version:2,completed:['start','layers'],lastLessonId:'layers'});
  assert.deepEqual(learningProgressSummary(state),{completed:2,total:10,percent:20});
  assert.equal(nextLearningLessonId(state),'transform');
  assert.equal(nextLearningLessonId({version:2,completed:LEARNING_LESSONS.map(lesson=>lesson.id)}),null);
  assert.deepEqual(learningLevelProgress({version:2,completed:['start','layers','selection']}),[
    {level:'База',completed:2,total:3},
    {level:'Уверенно',completed:1,total:4},
    {level:'Продвинуто',completed:0,total:3},
  ]);
});

test('rendered Learning Center teaches, tracks evidence and gates mastery completion', () => {
  const html=renderLearningCenterHtml({version:2,completed:[],lastLessonId:'start',practice:{start:[0]},mastery:{},quizPassed:[]},'start');
  assert.match(html,/0 \/ 10 уроков/);
  assert.match(html,/Ментальная модель/);
  assert.match(html,/Правило выбора/);
  assert.match(html,/Практика на реальном холсте/);
  assert.match(html,/data-learning-checklist="practice"/);
  assert.match(html,/Проверка знаний/);
  assert.match(html,/data-learning-action="check-quiz"/);
  assert.match(html,/Самопроверка мастерства/);
  assert.match(html,/data-learning-practice-progress/);
  assert.match(html,/data-learning-quiz-progress/);
  assert.match(html,/data-learning-action="toggle-complete"[^>]* disabled/);
});

test('ready lesson exposes mastery completion instead of a disabled credit button', () => {
  const lesson=LEARNING_LESSONS[0];
  const state={
    version:2,
    completed:[],
    lastLessonId:'start',
    practice:{start:Array.from({length:lesson.practice.length},(_,index)=>index)},
    mastery:{start:Array.from({length:lesson.mastery.length},(_,index)=>index)},
    quizPassed:['start'],
  };
  const html=renderLearningCenterHtml(state,'start');
  const button=html.match(/<button[^>]*data-learning-action="toggle-complete"[^>]*>/)?.[0] || '';
  assert.ok(button);
  assert.doesNotMatch(button,/disabled/);
  assert.match(html,/Все условия выполнены/);
  assert.match(html,/✓ Зачёт/);
});
