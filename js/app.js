/* ==========================================================================
   app.js — application shell: router, dashboard, lessons, quizzes, final
   assessment, summary, reference, practice sandbox, progress store.
   ========================================================================== */
(function () {
  'use strict';
  var OT = window.OT, U = OT.util, I = OT.icon, esc = U.esc;
  var KEY = 'outlook-training.progress.v1';

  /* ------------------------------------------------------------ progress */
  var Progress = OT.progress = {
    data: null,
    blank: function () { return { v: 1, started: null, lessons: {}, quizzes: {}, final: null }; },
    load: function () {
      var raw = OT.storage.get(KEY), d = null;
      try { d = raw ? JSON.parse(raw) : null; } catch (e) { d = null; }
      if (!d || d.v !== 1 || typeof d.lessons !== 'object' || !d.lessons) d = this.blank();
      d.quizzes = d.quizzes || {};
      this.data = d; return d;
    },
    save: function () { OT.storage.set(KEY, JSON.stringify(this.data)); },
    touch: function () { if (!this.data.started) this.data.started = Date.now(); },
    lessonDone: function (id) { return !!(this.data.lessons[id] && this.data.lessons[id].done); },
    markLesson: function (id, stats) {
      this.touch();
      var l = this.data.lessons[id] || { runs: 0 };
      l.done = true; l.at = Date.now(); l.runs = (l.runs || 0) + 1; l.wrong = stats.wrong; l.hints = stats.hints;
      this.data.lessons[id] = l; this.save();
    },
    quizPassed: function (id) { var q = this.data.quizzes[id]; return !!(q && q.passed); },
    saveQuiz: function (id, score, total) {
      this.touch();
      var q = this.data.quizzes[id] || { attempts: 0, best: 0 };
      q.attempts++; q.last = score; q.total = total; q.best = Math.max(q.best || 0, score); q.at = Date.now();
      q.passed = q.passed || score / total >= OT.quiz.PASS;
      this.data.quizzes[id] = q; this.save();
    },
    saveFinal: function (score, total, byModule, missed) {
      this.touch();
      var f = this.data.final || { attempts: 0, best: 0 };
      f.attempts++; f.last = score; f.total = total; f.best = Math.max(f.best || 0, score); f.at = Date.now();
      f.byModule = byModule; f.missed = missed;
      f.passed = f.passed || score / total >= OT.quiz.PASS;
      this.data.final = f; this.save();
    },
    counts: function () {
      var lessons = OT.lessons.filter(function (l) { return Progress.lessonDone(l.id); }).length;
      var quizzes = OT.modules.filter(function (m) { return Progress.quizPassed(m.id); }).length;
      var fin = this.data.final && this.data.final.passed ? 1 : 0;
      var total = OT.lessons.length + OT.modules.length + 1;
      return { lessons: lessons, quizzes: quizzes, final: fin, done: lessons + quizzes + fin, total: total, pct: Math.round((lessons + quizzes + fin) / total * 100) };
    },
    reset: function () { OT.storage.remove(KEY); this.data = this.blank(); }
  };

  /* -------------------------------------------------------------- state */
  var app = { root: null, sim: null, runner: null, route: null, quiz: null, token: 0 };

  function $(s, r) { return (r || document).querySelector(s); }
  function lesson(id) { return OT.lessons.filter(function (l) { return l.id === id; })[0]; }
  function mod(id) { return OT.modules.filter(function (m) { return m.id === id; })[0]; }
  function lessonsOf(mid) { return OT.lessons.filter(function (l) { return l.module === mid; }); }
  function nextLesson(id) { var i = OT.lessons.indexOf(lesson(id)); return OT.lessons[i + 1] || null; }
  function firstUndone() { return OT.lessons.filter(function (l) { return !Progress.lessonDone(l.id); })[0] || null; }
  function go(h) { if (location.hash === h) route(); else location.hash = h; }

  /* ------------------------------------------------------------- layout */
  function frame(inner, opts) {
    opts = opts || {};
    var c = Progress.counts(), r = app.route ? app.route.name : '';
    var nav = [['dashboard', '#/', 'Dashboard'], ['practice', '#/practice', 'Practice'], ['reference', '#/reference', 'Reference'], ['final', '#/final', 'Final assessment'], ['summary', '#/summary', 'My results']];
    var cur = r === 'lesson' || r === 'quiz' ? 'dashboard' : r;
    return '<a class="skip" href="#main">Skip to main content</a>' +
      '<header class="top"><div class="top-in"><a class="brand" href="#/" aria-label="Outlook training home"><span class="brand-mark" aria-hidden="true">' + I('mail', 18) + '</span><span><b>Classic vs New Outlook</b><small>Interactive training</small></span></a>' +
      '<nav class="topnav" aria-label="Main">' + nav.map(function (n) { return '<a href="' + n[1] + '"' + (cur === n[0] ? ' aria-current="page"' : '') + '>' + n[2] + '</a>'; }).join('') + '</nav>' +
      '<div class="top-prog" title="' + c.done + ' of ' + c.total + ' complete"><span class="sr">Overall progress: </span><div class="pbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + c.pct + '" aria-label="Overall progress"><span style="width:' + c.pct + '%"></span></div><b>' + c.pct + '%</b></div></div></header>' +
      '<div class="banner phi no-print" role="note"><b>Practice only.</b> Do not type real member information, PHI, passwords or other sensitive data into this training. Everything here is fictional.</div>' +
      (OT.storage.persistent ? '' : '<div class="banner warn" role="status">Your browser is blocking local storage, so progress is kept only until you close this tab.</div>') +
      '<main id="main" tabindex="-1" class="main' + (opts.wide ? ' wide' : '') + '">' + inner + '</main>' +
      '<footer class="foot"><span>All people, messages and files in this training are fictional. Nothing is sent anywhere; progress stays in this browser only.</span><button type="button" class="btn link" data-go="reset">Reset my progress</button></footer>' +
      '<div id="modal-host"></div>';
  }

  function mount(html, opts, focusSel) {
    destroySim();
    app.root.innerHTML = frame(html, opts);
    window.scrollTo(0, 0);
    var f = (focusSel && $(focusSel)) || $('#main h1') || $('#main');
    if (f) { if (!f.hasAttribute('tabindex')) f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); }
    document.title = (app.route && app.route.title ? app.route.title + ' · ' : '') + 'Classic vs New Outlook training';
  }

  function destroySim() {
    if (app.runner) { app.runner.destroy(); app.runner = null; }
    if (app.sim) { app.sim.destroy(); app.sim = null; }
  }

  /* -------------------------------------------------------------- router */
  function route() {
    var h = (location.hash || '#/').replace(/^#\/?/, ''), p = h.split('/');
    var name = p[0] || 'dashboard', arg = p[1];
    app.route = { name: name, arg: arg };
    if (name === 'lesson' && lesson(arg)) { app.route.title = lesson(arg).title; return viewLesson(lesson(arg)); }
    if (name === 'quiz' && mod(arg)) { app.route.title = mod(arg).title + ' quiz'; return viewQuiz(arg); }
    if (name === 'final') { app.route.title = 'Final assessment'; return viewQuiz('final'); }
    if (name === 'summary') { app.route.title = 'My results'; return viewSummary(); }
    if (name === 'reference') { app.route.title = 'Reference'; return viewReference(); }
    if (name === 'practice') { app.route.title = 'Practice'; return viewPractice(); }
    app.route = { name: 'dashboard', title: 'Dashboard' };
    viewDashboard();
  }

  /* ----------------------------------------------------------- dashboard */
  function chip(kind, text) { return '<span class="chip chip-' + kind + '">' + text + '</span>'; }

  function viewDashboard() {
    var c = Progress.counts(), next = firstUndone(), started = !!Progress.data.started || c.done > 0;
    var cta = next ? '<a class="btn primary big" href="#/lesson/' + next.id + '">' + (started ? 'Continue: ' : 'Start: ') + esc(next.title) + '</a>' :
      '<a class="btn primary big" href="#/final">' + (Progress.data.final && Progress.data.final.passed ? 'View my results' : 'Take the final assessment') + '</a>';
    var h = '<section class="hero"><div class="hero-text"><p class="eyebrow">Employee training</p><h1>Classic Outlook vs New Outlook for Windows</h1>' +
      '<p class="lead">Learn what stays the same, what moved, and what is different. You will practice in a safe, realistic simulator: every task is checked against what you actually do.</p>' +
      '<div class="hero-cta">' + cta + '<a class="btn big" href="#/practice">Open the practice mailbox</a></div></div>' +
      '<div class="hero-prog card" aria-label="Your progress"><div class="ring" style="--p:' + c.pct + '"><b>' + c.pct + '%</b><small>complete</small></div>' +
      '<ul class="stats"><li><b>' + c.lessons + '/' + OT.lessons.length + '</b> lessons</li><li><b>' + c.quizzes + '/' + OT.modules.length + '</b> module quizzes passed</li><li><b>' + (c.final ? 'Passed' : 'Not yet') + '</b> final assessment</li></ul></div></section>';

    h += '<div class="dash-grid"><div class="dash-main"><h2 class="sec">Learning path</h2>';
    OT.modules.forEach(function (m, mi) {
      var ls = lessonsOf(m.id), done = ls.filter(function (l) { return Progress.lessonDone(l.id); }).length, q = Progress.data.quizzes[m.id];
      h += '<section class="card mod" aria-labelledby="mod-' + m.id + '"><div class="mod-h"><div><p class="eyebrow">Module ' + (mi + 1) + '</p><h3 id="mod-' + m.id + '">' + esc(m.title) + '</h3><p class="muted">' + esc(m.blurb) + '</p></div><span class="mod-count">' + done + '/' + ls.length + '</span></div><ol class="lesson-list">';
      ls.forEach(function (l) {
        var d = Progress.lessonDone(l.id), n = OT.lessons.indexOf(l) + 1;
        h += '<li><a class="ll" href="#/lesson/' + l.id + '"><span class="ll-n' + (d ? ' done' : '') + '" aria-hidden="true">' + (d ? I('check', 14) : n) + '</span><span class="ll-t"><b>' + esc(l.title) + '</b><small>' + l.mins + ' min · ' + l.steps.length + ' steps</small></span>' +
          (d ? chip('ok', 'Completed') : chip('todo', 'To do')) + '<span class="ll-go">' + (d ? 'Review' : 'Start') + I('chev-right', 14) + '</span></a></li>';
      });
      var allDone = done === ls.length;
      h += '</ol><div class="mod-quiz"><div><b>Knowledge check</b><small>' + OT.quiz.forModule(m.id).length + ' questions · pass mark ' + Math.round(OT.quiz.PASS * 100) + '%' + (q ? ' · best ' + q.best + '/' + q.total + ' · ' + q.attempts + (q.attempts === 1 ? ' attempt' : ' attempts') : '') + '</small></div>' +
        (q && q.passed ? chip('ok', 'Passed') : chip('todo', allDone ? 'Ready' : 'To do')) + '<a class="btn' + (allDone && !(q && q.passed) ? ' primary' : '') + '" href="#/quiz/' + m.id + '">' + (q ? 'Retake' : 'Take quiz') + '</a></div></section>';
    });
    h += '</div><aside class="dash-side">';
    var remaining = OT.lessons.filter(function (l) { return !Progress.lessonDone(l.id); });
    h += '<section class="card"><h3>Remaining tasks</h3>' + (c.done === c.total ? '<p>Everything is complete. You can revisit any lesson at any time.</p>' :
      '<ul class="todo">' + remaining.slice(0, 4).map(function (l) { return '<li><a href="#/lesson/' + l.id + '">' + esc(l.title) + '</a></li>'; }).join('') + (remaining.length > 4 ? '<li class="muted">+ ' + (remaining.length - 4) + ' more lessons</li>' : '') +
      OT.modules.filter(function (m) { return !Progress.quizPassed(m.id); }).map(function (m) { return '<li><a href="#/quiz/' + m.id + '">Quiz: ' + esc(m.title) + '</a></li>'; }).slice(0, 3).join('') + (Progress.data.final && Progress.data.final.passed ? '' : '<li><a href="#/final">Final assessment</a></li>') + '</ul>') + '</section>';
    h += '<section class="card"><h3>Final assessment</h3><p class="muted">' + OT.quiz.FINAL_COUNT + ' mixed questions. Pass mark ' + Math.round(OT.quiz.PASS * 100) + '%. Best taken after the lessons.</p>' +
      (Progress.data.final ? '<p>Best score: <b>' + Progress.data.final.best + '/' + Progress.data.final.total + '</b></p>' : '') + '<a class="btn' + (c.lessons === OT.lessons.length ? ' primary' : '') + '" href="#/final">' + (Progress.data.final ? 'Retake' : 'Start assessment') + '</a></section>';
    h += '<section class="card"><h3>Need a quick lookup?</h3><p class="muted">See where Classic features live in New Outlook, and which features are partly available or not supported.</p><a class="btn" href="#/reference">Open the reference</a></section>';
    h += '</aside></div>';
    mount(h);
  }

  /* -------------------------------------------------------------- lesson */
  function viewLesson(L) {
    var idx = OT.lessons.indexOf(L), prev = OT.lessons[idx - 1], nxt = OT.lessons[idx + 1], m = mod(L.module), done = Progress.lessonDone(L.id);
    var h = '<nav class="crumb" aria-label="Breadcrumb"><a href="#/">Dashboard</a> <span aria-hidden="true">/</span> <span>' + esc(m.title) + '</span></nav>' +
      '<div class="lesson-head"><div><p class="eyebrow">Lesson ' + (idx + 1) + ' of ' + OT.lessons.length + ' · ' + L.mins + ' min</p><h1>' + esc(L.title) + '</h1></div>' +
      '<div class="lesson-nav">' + (prev ? '<a class="btn" href="#/lesson/' + prev.id + '">' + I('chev-left', 14) + ' Previous</a>' : '') + (nxt ? '<a class="btn" href="#/lesson/' + nxt.id + '">Next ' + I('chev-right', 14) + '</a>' : '') + '</div></div>' +
      '<div class="lesson-grid"><section class="coach card" id="coach" aria-label="Lesson coach"></section><section class="simwrap" aria-label="Outlook simulator"><div class="sim-label"><span>' + I('shield', 14) + ' Training simulator: fictional data, nothing is sent</span></div><div id="sim-root" class="sim-root"></div></section></div>';
    mount(h, { wide: true }, '#main h1');
    app.sim = new OT.Sim($('#sim-root'));
    showIntro(L);
  }

  function showIntro(L) {
    var coach = $('#coach'), done = Progress.lessonDone(L.id);
    var parts = {}; L.steps.forEach(function (s) { if (s.type !== 'q') parts[s.part] = (parts[s.part] || 0) + 1; });
    coach.innerHTML = '<div class="coach-top"><span class="part part-intro">' + (done ? 'Completed' : 'Lesson overview') + '</span><span class="coach-count">' + L.steps.length + ' steps</span></div>' +
      '<h2 class="coach-title">What you will learn</h2><p class="coach-do">' + esc(L.objective) + '</p><p class="muted">' + L.intro + '</p>' +
      '<ul class="plist">' + (parts.classic ? '<li><span class="part part-classic">Classic Outlook</span> ' + parts.classic + ' steps</li>' : '') + (parts['new'] ? '<li><span class="part part-new">New Outlook</span> ' + parts['new'] + ' steps</li>' : '') + '</ul>' +
      '<p class="muted small">The simulator highlights the control to use. When you do the real action, the step is checked off. Use <b>Show hint</b> any time.</p>' +
      '<div class="coach-actions"><button type="button" class="btn primary big" id="start-lesson">' + (done ? 'Practice this lesson again' : 'Start lesson') + '</button></div>';
    $('#start-lesson').focus();
    $('#start-lesson').addEventListener('click', function () { startRunner(L); });
  }

  function startRunner(L) {
    var coach = $('#coach'), token = ++app.token;
    if (app.runner) app.runner.destroy();
    coach.innerHTML = '';
    app.runner = new OT.Runner({
      sim: app.sim, lesson: L, coach: coach,
      callbacks: {
        onComplete: function (stats) {
          Progress.markLesson(L.id, stats);
          var top = $('.top-prog'); if (top) { var c = Progress.counts(); top.querySelector('.pbar span').style.width = c.pct + '%'; top.querySelector('b').textContent = c.pct + '%'; top.querySelector('.pbar').setAttribute('aria-valuenow', c.pct); }
        },
        onRestart: function () { startRunner(L); },
        onQuiz: function () { go('#/quiz/' + L.module); },
        onNextLesson: function () { var n = nextLesson(L.id); go(n ? '#/lesson/' + n.id : '#/'); },
        onDashboard: function () { go('#/'); }
      }
    });
    app.runner.start(0);
    var t = $('.coach-title'); if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
  }

  /* ------------------------------------------------------------ practice */
  function viewPractice() {
    var h = '<div class="lesson-head"><div><p class="eyebrow">Free practice</p><h1>Practice mailbox</h1></div><div class="lesson-nav"><button type="button" class="btn" id="practice-reset">' + I('refresh', 14) + ' Reset mailbox</button></div></div>' +
      '<p class="lead narrow-text">Explore freely. Switch between Classic and New with the toggle in the top-right of the simulator. Nothing here is graded and nothing is sent. Use <b>Reset mailbox</b> to restore the original messages.</p>' +
      '<section class="simwrap full" aria-label="Outlook simulator"><div class="sim-label"><span>' + I('shield', 14) + ' Training simulator: fictional data, nothing is sent</span></div><div id="sim-root" class="sim-root tall"></div></section>';
    mount(h, { wide: true });
    app.sim = new OT.Sim($('#sim-root'));
    $('#practice-reset').addEventListener('click', function () { app.sim.reset({ mode: 'classic' }); });
  }

  /* ---------------------------------------------------------------- quiz */
  function pickFinal() {
    var byMod = {}; OT.modules.forEach(function (m) { byMod[m.id] = U.shuffle(OT.quiz.forModule(m.id).slice()); });
    var out = [], i = 0;
    // 3 from each module (balanced), then fill from the rest incl. scenario questions
    OT.modules.forEach(function (m) { out = out.concat(byMod[m.id].splice(0, 3)); });
    var rest = [];
    OT.modules.forEach(function (m) { rest = rest.concat(byMod[m.id]); });
    rest = U.shuffle(rest.concat(OT.quiz.extra));
    while (out.length < OT.quiz.FINAL_COUNT && i < rest.length) out.push(rest[i++]);
    return U.shuffle(out);
  }

  function prepQuestions(list) {
    return list.map(function (q) {
      var order = U.shuffle(q.options.map(function (o, i) { return i; }));
      return { id: q.id, q: q.q, why: q.why, options: order.map(function (i) { return q.options[i]; }), answer: order.indexOf(q.answer) };
    });
  }

  function viewQuiz(id) {
    var isFinal = id === 'final', m = isFinal ? null : mod(id);
    var qs = prepQuestions(isFinal ? pickFinal() : U.shuffle(OT.quiz.forModule(id).slice()));
    app.quiz = { id: id, isFinal: isFinal, qs: qs, i: 0, sel: null, checked: false, results: [] };
    var ls = isFinal ? OT.lessons : lessonsOf(id), pending = ls.filter(function (l) { return !Progress.lessonDone(l.id); });
    var intro = '<nav class="crumb" aria-label="Breadcrumb"><a href="#/">Dashboard</a> <span aria-hidden="true">/</span> <span>' + (isFinal ? 'Final assessment' : esc(m.title) + ' quiz') + '</span></nav>' +
      '<div class="quiz-card card" id="quiz"></div>';
    mount(intro);
    if (pending.length) {
      $('#quiz').innerHTML = '<p class="eyebrow">' + (isFinal ? 'Final assessment' : 'Knowledge check') + '</p><h1>' + (isFinal ? 'Final assessment' : esc(m.title)) + '</h1><div class="fb info">' + I('help', 16) + '<div>You haven’t finished ' + (isFinal ? 'all' : 'all the') + ' lessons yet (' + pending.length + ' to go). You can still take this ' + (isFinal ? 'assessment' : 'quiz') + ', but you’ll get more from it after the lessons.</div></div>' +
        '<div class="quiz-actions"><button type="button" class="btn primary big" data-q="begin">Start anyway</button><a class="btn" href="#/lesson/' + pending[0].id + '">Go to “' + esc(pending[0].title) + '”</a></div>';
    } else {
      $('#quiz').innerHTML = '<p class="eyebrow">' + (isFinal ? 'Final assessment' : 'Knowledge check') + '</p><h1>' + (isFinal ? 'Final assessment' : esc(m.title)) + '</h1><p class="lead">' + qs.length + ' questions. You need ' + Math.round(OT.quiz.PASS * 100) + '% to pass, and you can retake it as often as you like.</p><div class="quiz-actions"><button type="button" class="btn primary big" data-q="begin">Begin</button></div>';
    }
    var b = $('[data-q="begin"]'); if (b) b.focus();
    $('#quiz').addEventListener('click', quizClick);
    $('#quiz').addEventListener('change', function (e) { if (e.target.name === 'qa') { app.quiz.sel = +e.target.value; var c = $('[data-q="check"]'); if (c) c.disabled = false; } });
  }

  function renderQuestion() {
    var Z = app.quiz, q = Z.qs[Z.i], n = Z.qs.length, checked = Z.checked;
    var opts = q.options.map(function (o, i) {
      var cls = '';
      if (checked) cls = i === q.answer ? ' right' : (i === Z.sel ? ' wrong' : '');
      return '<label class="q-opt' + cls + '"><input type="radio" name="qa" value="' + i + '"' + (Z.sel === i ? ' checked' : '') + (checked ? ' disabled' : '') + '><span>' + esc(o) + '</span>' + (checked && i === q.answer ? '<em class="mark">' + I('check', 14) + ' Correct answer</em>' : '') + (checked && i === Z.sel && i !== q.answer ? '<em class="mark bad">' + I('x', 14) + ' Your answer</em>' : '') + '</label>';
    }).join('');
    var fb = '';
    if (checked) { var ok = Z.sel === q.answer; fb = '<div class="fb ' + (ok ? 'ok' : 'bad') + '" role="status">' + I(ok ? 'check' : 'bulb', 16) + '<div><b>' + (ok ? 'Correct.' : 'Not quite.') + '</b> ' + esc(q.why) + '</div></div>'; }
    $('#quiz').innerHTML = '<div class="coach-top"><span class="eyebrow">' + (Z.isFinal ? 'Final assessment' : esc(mod(Z.id).title)) + '</span><span class="coach-count">Question ' + (Z.i + 1) + ' of ' + n + '</span></div>' +
      '<div class="coach-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + n + '" aria-valuenow="' + Z.i + '" aria-label="Quiz progress"><span style="width:' + Math.round(Z.i / n * 100) + '%"></span></div>' +
      '<fieldset class="q"><legend><h1 class="qtext">' + esc(q.q) + '</h1></legend>' + opts + '</fieldset>' + fb +
      '<div class="quiz-actions">' + (checked ? '<button type="button" class="btn primary" data-q="next">' + (Z.i === n - 1 ? 'See my score' : 'Next question') + '</button>' : '<button type="button" class="btn primary" data-q="check"' + (Z.sel === null ? ' disabled' : '') + '>Check answer</button>') + '</div>';
    var f = $('#quiz .qtext'); if (f) { f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); }
  }

  function quizClick(e) {
    var b = e.target.closest('[data-q]'); if (!b) return;
    var a = b.getAttribute('data-q'), Z = app.quiz;
    if (a === 'begin') { renderQuestion(); }
    else if (a === 'check') { if (Z.sel === null) return; Z.checked = true; var q = Z.qs[Z.i]; Z.results.push({ q: q, sel: Z.sel, ok: Z.sel === q.answer }); renderQuestion(); var nx = $('[data-q="next"]'); if (nx) nx.focus(); }
    else if (a === 'next') { Z.i++; Z.sel = null; Z.checked = false; if (Z.i >= Z.qs.length) finishQuiz(); else renderQuestion(); }
    else if (a === 'retry') { viewQuiz(Z.id); var bb = $('[data-q="begin"]'); if (bb) bb.click(); }
  }

  function moduleOfQ(q) {
    var m = /^m(\d)-/.exec(q.id); return m ? 'm' + m[1] : null;
  }

  function finishQuiz() {
    var Z = app.quiz, total = Z.results.length, score = Z.results.filter(function (r) { return r.ok; }).length, pass = score / total >= OT.quiz.PASS;
    var missed = Z.results.filter(function (r) { return !r.ok; });
    if (Z.isFinal) {
      var by = {}; OT.modules.forEach(function (m) { by[m.id] = { right: 0, total: 0 }; });
      Z.results.forEach(function (r) { var k = moduleOfQ(r.q); if (k) { by[k].total++; if (r.ok) by[k].right++; } });
      Progress.saveFinal(score, total, by, missed.map(function (r) { return moduleOfQ(r.q); }).filter(Boolean));
    } else Progress.saveQuiz(Z.id, score, total);
    var review = missed.length ? '<h2 class="sec">Review what you missed</h2><ul class="review">' + missed.map(function (r) {
      return '<li><b>' + esc(r.q.q) + '</b><div class="bad-ans">Your answer: ' + esc(r.q.options[r.sel]) + '</div><div class="good-ans">Correct: ' + esc(r.q.options[r.q.answer]) + '</div><p>' + esc(r.q.why) + '</p></li>';
    }).join('') + '</ul>' : '<p class="fb ok">' + I('trophy', 16) + '<span>A perfect score. Nicely done.</span></p>';
    var weak = {}; missed.forEach(function (r) { var k = moduleOfQ(r.q); if (k) weak[k] = 1; if (!Z.isFinal) weak[Z.id] = 1; });
    var wl = Object.keys(weak).map(function (k) { return '<a class="btn" href="#/lesson/' + lessonsOf(k)[0].id + '">Review: ' + esc(mod(k).title) + '</a>'; }).join('');
    var next = '';
    if (!Z.isFinal) { var mi = OT.modules.indexOf(mod(Z.id)), nm = OT.modules[mi + 1]; next = pass && nm ? '<a class="btn primary" href="#/lesson/' + lessonsOf(nm.id)[0].id + '">Next module: ' + esc(nm.title) + '</a>' : (pass ? '<a class="btn primary" href="#/final">Take the final assessment</a>' : ''); }
    else next = '<a class="btn primary" href="#/summary">See my results</a>';
    $('#quiz').innerHTML = '<p class="eyebrow">' + (Z.isFinal ? 'Final assessment' : esc(mod(Z.id).title)) + ' · result</p><h1 class="result-h">' + (pass ? 'You passed' : 'Not passed yet') + '</h1>' +
      '<div class="score"><div class="ring ' + (pass ? 'good' : 'warn') + '" style="--p:' + Math.round(score / total * 100) + '"><b>' + score + '/' + total + '</b><small>' + Math.round(score / total * 100) + '%</small></div><p class="lead">' + (pass ? 'You answered ' + score + ' of ' + total + ' correctly. The pass mark is ' + Math.round(OT.quiz.PASS * 100) + '%.' : 'You answered ' + score + ' of ' + total + ' correctly. You need ' + Math.round(OT.quiz.PASS * 100) + '% to pass. Review the explanations below, revisit the lessons, and try again.') + '</p></div>' +
      review + '<div class="quiz-actions"><button type="button" class="btn' + (pass ? '' : ' primary') + '" data-q="retry">Try again</button>' + wl + next + '<a class="btn link" href="#/">Dashboard</a></div>';
    var h1 = $('#quiz .result-h'); if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus(); }
    var top = $('.top-prog'); if (top) { var c = Progress.counts(); top.querySelector('.pbar span').style.width = c.pct + '%'; top.querySelector('b').textContent = c.pct + '%'; }
  }

  /* ------------------------------------------------------------- summary */
  function viewSummary() {
    var c = Progress.counts(), d = Progress.data, f = d.final;
    var h = '<h1>My results</h1><p class="lead narrow-text">Your progress is saved in this browser. ' + (OT.storage.persistent ? '' : '(Storage is blocked here, so it will be lost when you close the tab.) ') + 'Print this page if you need a record.</p>';
    h += '<section class="card"><h2>Overall</h2><div class="sum-grid"><div class="ring" style="--p:' + c.pct + '"><b>' + c.pct + '%</b><small>complete</small></div><ul class="stats"><li><b>' + c.lessons + ' of ' + OT.lessons.length + '</b> lessons completed</li><li><b>' + c.quizzes + ' of ' + OT.modules.length + '</b> module quizzes passed</li><li><b>' + (f ? f.best + '/' + f.total : 'Not taken') + '</b> best final assessment score' + (f ? ' (' + f.attempts + (f.attempts === 1 ? ' attempt' : ' attempts') + ')' : '') + '</li></ul></div>' +
      (f && f.passed && c.lessons === OT.lessons.length ? '<div class="fb ok">' + I('trophy', 16) + '<div><b>Training complete.</b> You finished every lesson and passed the final assessment.</div></div>' : '<div class="fb info">' + I('target', 16) + '<div>To complete the training: finish all lessons, pass each module quiz, and pass the final assessment.</div></div>') + '</section>';
    h += '<section class="card"><h2>Learner</h2><label class="who no-print">Your name (optional, shown on the printed page and in copied results) <input type="text" id="who-name" autocomplete="name" maxlength="80"></label><p class="who-print">Learner: <b id="who-print">__________</b> &nbsp; Date: <b>' + new Date().toLocaleDateString() + '</b></p></section>';
    h += '<section class="card"><h2>Lessons and quizzes</h2><table class="tbl"><thead><tr><th>Module</th><th>Lessons</th><th>Quiz</th></tr></thead><tbody>' + OT.modules.map(function (m) {
      var ls = lessonsOf(m.id), done = ls.filter(function (l) { return Progress.lessonDone(l.id); }).length, q = d.quizzes[m.id];
      return '<tr><th scope="row">' + esc(m.title) + '</th><td>' + done + ' of ' + ls.length + (done === ls.length ? ' ' + chip('ok', 'Done') : '') + '</td><td>' + (q ? q.best + '/' + q.total + ' best' + (q.passed ? ' ' + chip('ok', 'Passed') : ' ' + chip('warn', 'Retry')) : chip('todo', 'Not taken')) + '</td></tr>';
    }).join('') + '</tbody></table></section>';
    if (f) {
      var by = f.byModule || {}, weak = OT.modules.filter(function (m) { return by[m.id] && by[m.id].total && by[m.id].right / by[m.id].total < OT.quiz.PASS; });
      h += '<section class="card"><h2>Last final assessment: ' + f.last + '/' + f.total + '</h2><table class="tbl"><thead><tr><th>Module</th><th>Correct</th></tr></thead><tbody>' + OT.modules.map(function (m) { var x = by[m.id] || { right: 0, total: 0 }; return '<tr><th scope="row">' + esc(m.title) + '</th><td>' + (x.total ? x.right + ' of ' + x.total : '—') + '</td></tr>'; }).join('') + '</tbody></table>' +
        (weak.length ? '<p><b>Worth another look:</b> ' + weak.map(function (m) { return '<a href="#/lesson/' + lessonsOf(m.id)[0].id + '">' + esc(m.title) + '</a>'; }).join(', ') + '</p>' : '') + '</section>';
    }
    h += '<div class="quiz-actions no-print"><button type="button" class="btn" onclick="window.print()">' + I('file', 14) + ' Print this page</button><button type="button" class="btn" data-go="copy">Copy my results</button><button type="button" class="btn" data-go="download">Download my results</button><a class="btn" href="#/final">Retake the final assessment</a><button type="button" class="btn" data-go="reset">Reset my progress</button></div>';
    mount(h);
  }

  /* ----------------------------------------------------------- reference */
  function viewReference() {
    var R = OT.reference;
    var h = '<h1>Reference</h1><p class="lead narrow-text">A quick lookup for when you are back at your desk. Statuses are for <b>new Outlook</b> compared with classic.</p>';
    h += '<section class="card"><h2>Where did it go?</h2><div class="filter-row"><label for="ref-q">Filter</label><input id="ref-q" type="search" class="inp" placeholder="e.g. rules, dark mode, undo" autocomplete="off"></div><div class="cmp-wrap"><table class="cmp" id="map-table"><thead><tr><th>Task</th><th>Classic Outlook</th><th>New Outlook</th><th>Status</th></tr></thead><tbody>' +
      R.MAP.map(function (r) { return '<tr><th scope="row">' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td><td><span class="tag tag-' + r[3] + '">' + OT.tagLabel(r[3]) + '</span></td></tr>'; }).join('') + '</tbody></table></div><p id="ref-empty" class="muted" hidden>No matches.</p></section>';
    h += '<section class="card"><h2>Feature availability in new Outlook</h2><p class="muted">From Microsoft’s feature comparison page (page last updated ' + R.SOURCE.pageUpdated + '; checked ' + R.SOURCE.checked + ').</p><div class="cmp-wrap"><table class="cmp"><thead><tr><th>Feature</th><th>New Outlook</th><th>Note</th></tr></thead><tbody>' +
      R.MATRIX.map(function (r) { return '<tr><th scope="row">' + esc(r[0]) + '</th><td><span class="tag st-' + r[2] + '">' + esc(r[1]) + '</span></td><td>' + esc(r[3]) + '</td></tr>'; }).join('') + '</tbody></table></div></section>';
    h += '<section class="card"><h2>Good to know</h2><ul class="bul">' + R.CAVEATS.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
      '<h3>Source</h3><p><a href="' + R.SOURCE.url + '" target="_blank" rel="noopener noreferrer">' + esc(R.SOURCE.title) + '</a> (Microsoft Support). Verified ' + R.SOURCE.checked + '.</p></section>';
    mount(h);
    var qi = $('#ref-q');
    qi.addEventListener('input', function () {
      var v = qi.value.trim().toLowerCase(), shown = 0;
      Array.prototype.forEach.call(document.querySelectorAll('#map-table tbody tr'), function (tr) { var ok = !v || tr.textContent.toLowerCase().indexOf(v) !== -1; tr.hidden = !ok; if (ok) shown++; });
      $('#ref-empty').hidden = shown > 0;
    });
  }

  /* --------------------------------------------------------------- reset */
  function openReset() {
    var host = $('#modal-host'); if (!host) return;
    var prev = document.activeElement;
    host.innerHTML = '<div class="modal-scrim"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="rs-t"><h2 id="rs-t">Reset all progress?</h2><p>This clears your completed lessons, quiz scores and final assessment results from this browser. You can’t undo it.</p><div class="quiz-actions"><button type="button" class="btn" data-m="cancel">Cancel</button><button type="button" class="btn danger" data-m="ok">Yes, reset everything</button></div></div></div>';
    var cancel = host.querySelector('[data-m="cancel"]'); cancel.focus();
    function close() { host.innerHTML = ''; if (prev && prev.focus) prev.focus(); }
    host.addEventListener('click', function h(e) {
      var b = e.target.closest('[data-m]'); if (!b) return;
      host.removeEventListener('click', h);
      if (b.getAttribute('data-m') === 'ok') { Progress.reset(); host.innerHTML = ''; go('#/'); route(); var m = $('#main'); if (m) m.focus(); } else close();
    });
    host.addEventListener('keydown', function k(e) {
      if (e.key === 'Escape') { host.removeEventListener('keydown', k); close(); }
      if (e.key === 'Tab') { var f = host.querySelectorAll('button'); if (!f.length) return; var a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    });
  }

  /* ------------------------------------------------------ results export */
  function resultsText() {
    var c = Progress.counts(), d = Progress.data, f = d.final, nm = document.getElementById('who-name'), name = nm && nm.value.trim();
    var L = ['Classic vs New Outlook training: results', 'Learner: ' + (name || '(not entered)'), 'Date: ' + new Date().toLocaleDateString(), '',
      'Overall: ' + c.pct + '% complete', 'Lessons completed: ' + c.lessons + ' of ' + OT.lessons.length,
      'Module quizzes passed: ' + c.quizzes + ' of ' + OT.modules.length,
      'Final assessment: ' + (f ? 'best ' + f.best + '/' + f.total + (f.passed ? ' (passed)' : ' (not yet passed)') + ', ' + f.attempts + ' attempt(s)' : 'not taken'), ''];
    OT.modules.forEach(function (m) {
      var ls = lessonsOf(m.id), done = ls.filter(function (l) { return Progress.lessonDone(l.id); }).length, q = d.quizzes[m.id];
      L.push(m.title + ': lessons ' + done + '/' + ls.length + '; quiz ' + (q ? q.best + '/' + q.total + (q.passed ? ' passed' : ' not passed') : 'not taken'));
    });
    return L.join('\n');
  }
  function downloadResults() {
    try {
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([resultsText()], { type: 'text/plain' }));
      a.download = 'outlook-training-results.txt'; document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { window.prompt('Copy your results:', resultsText()); }
  }
  function copyResults(btn) {
    var t = resultsText(), ok = function () { var o = btn.textContent; btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = o; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, downloadResults); else downloadResults();
  }

  /* ---------------------------------------------------------------- init */
  function init() {
    app.root = document.getElementById('app');
    Progress.load();
    app.root.addEventListener('click', function (e) {
      var g = e.target.closest('[data-go]'); if (!g) return;
      var act = g.getAttribute('data-go');
      if (act === 'reset') openReset();
      else if (act === 'copy') copyResults(g);
      else if (act === 'download') downloadResults();
    });
    app.root.addEventListener('input', function (e) {
      if (e.target.id === 'who-name') { var w = document.getElementById('who-print'); if (w) w.textContent = e.target.value.trim() || '__________'; }
    });
    window.addEventListener('hashchange', route);
    window.addEventListener('storage', function (e) { if (e.key === KEY) { Progress.load(); } });
    route();
  }
  OT.app = { init: init, route: route, go: go, runner: function () { return app.runner; }, sim: function () { return app.sim; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
