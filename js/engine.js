/* ==========================================================================
   engine.js — guided lesson runner
   Watches the simulator's event bus, validates the learner's real actions
   against each step, highlights the control to use, and renders the coach
   panel. Nothing is marked done unless the check function passes.
   ========================================================================== */
(function () {
  'use strict';
  var OT = window.OT, U = OT.util, I = OT.icon, esc = U.esc;

  var IGNORE = { 'click-target': 1, 'menu-open': 0, 'sim-rendered': 1 };
  var PART_LABEL = { classic: 'Classic Outlook', 'new': 'New Outlook' };

  function Runner(o) {
    this.sim = o.sim; this.lesson = o.lesson; this.coach = o.coach; this.cb = o.callbacks || {};
    this.steps = this.lesson.steps; this.idx = 0; this.state = 'active';
    this.doneIds = {}; this.stats = { wrong: 0, hints: 0, qWrong: 0 };
    this.stepWrong = 0; this.hintShown = false; this.fb = null; this.qSel = null; this.qState = null;
    this.muted = false; this.destroyed = false; this.lastKey = '';
    this.bind();
  }
  OT.Runner = Runner;
  var R = Runner.prototype;

  R.bind = function () {
    var self = this;
    this.onSim = function (e) { self.handle(e); };
    OT.bus.on('sim', this.onSim);
    this.onRend = function () { self.schedule(); };
    OT.bus.on('sim-rendered', this.onRend);
    this.poll = setInterval(function () {
      self.handle(null);
      var k = JSON.stringify(self.targetKeys());
      if (k !== self.keysSig) { self.keysSig = k; self.schedule(); }
    }, 300);
    this.onField = function () { self.schedule(); };
    this.sim.root.addEventListener('input', this.onField);
    this.sim.root.addEventListener('change', this.onField);
    this.mo = new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var t = list[i].target;
        if (t && t.closest && t.closest('.sim-callout-host')) continue;
        self.schedule(); return;
      }
    });
    this.mo.observe(this.sim.root, { childList: true, subtree: true });
    this.onResize = function () { self.schedule(); };
    window.addEventListener('resize', this.onResize);
    this.coach.addEventListener('click', function (e) { self.onCoachClick(e); });
    this.coach.addEventListener('change', function (e) { if (e.target.name === 'q-opt') { self.qSel = +e.target.value; } });
  };

  R.destroy = function () {
    this.destroyed = true;
    OT.bus.off('sim', this.onSim); OT.bus.off('sim-rendered', this.onRend);
    clearInterval(this.poll); clearTimeout(this.idle); clearTimeout(this.adv);
    if (this.mo) this.mo.disconnect();
    this.sim.root.removeEventListener('input', this.onField); this.sim.root.removeEventListener('change', this.onField);
    window.removeEventListener('resize', this.onResize);
    this.clearHighlight();
    this.sim.el.callout.innerHTML = '';
  };

  /* ---------------------------------------------------------------- flow */
  R.step = function () { return this.steps[this.idx]; };

  R.start = function (i) {
    var first = this.steps[0];
    this.idx = i || 0;
    this.doneIds = {};
    this.stats = { wrong: 0, hints: 0, qWrong: 0 };
    this.sim.reset({ mode: first.mode || 'classic' });
    this.enter();
  };

  R.enter = function () {
    var st = this.step(), sim = this.sim;
    clearTimeout(this.idle); clearTimeout(this.adv);
    this.state = 'active'; this.stepWrong = 0; this.hintShown = false; this.fb = null; this.qSel = null; this.qState = null; this.modeNote = null;
    if (st.type !== 'q' && st.mode && !st.free && sim.ui.mode !== st.mode) {
      this.muted = true; sim.setMode(st.mode); this.muted = false;
      this.modeNote = 'Switched to ' + PART_LABEL[st.mode] + ' for this part of the lesson.';
    }
    if (st.auto) { this.muted = true; try { st.auto(sim); } catch (err) { if (window.console) console.error(err); } this.muted = false; }
    this.lastKey = '';
    this.render();
    var self = this;
    this.idle = setTimeout(function () { if (self.state === 'active' && !self.hintShown) { self.showHint(true); } }, 25000);
    if (this.cb.onProgress) this.cb.onProgress({ index: this.idx, total: this.steps.length, done: Object.keys(this.doneIds).length });
  };

  R.handle = function (e) {
    if (this.destroyed || this.muted || this.state !== 'active') return;
    var st = this.step(); if (st.type === 'q') return;
    if (e && IGNORE[e.type]) return;
    var sim = this.sim, ok = false;
    try { ok = st.done(e, sim); } catch (err) { ok = false; }
    if (ok) { this.complete(); return; }
    if (e && st.wrong) {
      var msg = null; try { msg = st.wrong(e, sim); } catch (err2) { msg = null; }
      if (msg) { this.stepWrong++; this.stats.wrong++; this.fb = { kind: 'wrong', text: msg }; if (this.stepWrong >= 2 && !this.hintShown) this.showHint(true); this.renderFeedback(); return; }
    }
    if (!e) this.checkMode();
  };

  R.checkMode = function () {
    var st = this.step(); if (!st || st.type === 'q' || st.free) return;
    var bad = st.mode && this.sim.ui.mode !== st.mode;
    var has = !!this.coach.querySelector('.coach-mode');
    if (bad !== has) this.renderFeedback();
  };

  R.complete = function () {
    var st = this.step();
    this.state = 'done'; this.doneIds[st.id || this.idx] = true;
    clearTimeout(this.idle);
    this.fb = null;
    if (this.cb.onProgress) this.cb.onProgress({ index: this.idx, total: this.steps.length, done: Object.keys(this.doneIds).length });
    this.clearHighlight();
    if (st.why) { this.render(); var b = this.coach.querySelector('[data-c="next"]'); if (b) b.focus(); }
    else { this.render(); var self = this; this.adv = setTimeout(function () { self.next(); }, 650); }
  };

  R.next = function () {
    clearTimeout(this.adv);
    if (this.idx >= this.steps.length - 1) { this.finish(); return; }
    this.idx++; this.enter();
  };

  R.finish = function () {
    this.state = 'finished'; this.clearHighlight();
    this.render();
    if (this.cb.onComplete) this.cb.onComplete({ wrong: this.stats.wrong + this.stats.qWrong, hints: this.stats.hints });
  };

  R.showHint = function (auto) {
    if (this.hintShown) return;
    this.hintShown = true; if (!auto) this.stats.hints++; else this.stats.hints++;
    this.renderHint();
  };

  /* ------------------------------------------------------------ questions */
  R.checkQuestion = function () {
    var st = this.step();
    if (this.qSel === null) { this.fb = { kind: 'wrong', text: 'Choose an answer first.' }; this.renderFeedback(); return; }
    if (this.qSel === st.answer) { this.qState = 'right'; this.complete(); }
    else {
      this.stepWrong++; this.stats.qWrong++;
      this.fb = { kind: 'wrong', text: 'Not quite. ' + (this.stepWrong >= 2 ? 'The correct answer is highlighted below.' : 'Read the options again and try once more.') };
      if (this.stepWrong >= 2) this.qState = 'reveal';
      this.render();
    }
  };

  R.onCoachClick = function (e) {
    var b = e.target.closest('[data-c]'); if (!b) return;
    var c = b.getAttribute('data-c');
    if (c === 'next') this.next();
    else if (c === 'hint') this.showHint(false);
    else if (c === 'check') this.checkQuestion();
    else if (c === 'mode') { this.muted = true; this.sim.setMode(this.step().mode); this.muted = false; this.fb = null; this.render(); }
    else if (c === 'restart') { if (this.cb.onRestart) this.cb.onRestart(); }
    else if (c === 'again') { this.start(0); }
    else if (c === 'quiz' && this.cb.onQuiz) this.cb.onQuiz();
    else if (c === 'nextlesson' && this.cb.onNextLesson) this.cb.onNextLesson();
    else if (c === 'dash' && this.cb.onDashboard) this.cb.onDashboard();
  };

  /* ------------------------------------------------------------ rendering */
  R.render = function () {
    var st = this.step(), self = this, total = this.steps.length, html = '';
    if (this.state === 'finished') { this.coach.innerHTML = this.tplFinished(); this.clearHighlight(); return; }
    var part = st.part || (st.mode) || 'classic';
    var dots = this.steps.map(function (s, i) {
      var cls = self.doneIds[s.id || i] ? 'done' : (i === self.idx ? 'cur' : '');
      return '<li class="' + cls + '"><span class="sr">' + (cls === 'done' ? 'Done: ' : (cls === 'cur' ? 'Current: ' : 'To do: ')) + '</span>' + esc(s.title) + '</li>';
    }).join('');
    var doneCount = Object.keys(this.doneIds).length;
    html += '<div class="coach-top"><span class="part part-' + part + '">' + (st.type === 'q' ? 'Knowledge check' : PART_LABEL[part]) + '</span><span class="coach-count">Step ' + (this.idx + 1) + ' of ' + total + '</span></div>';
    html += '<div class="coach-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + doneCount + '" aria-label="Lesson progress"><span style="width:' + Math.round(doneCount / total * 100) + '%"></span></div>';
    html += '<h3 class="coach-title" id="coach-title">' + esc(st.title) + '</h3>';
    if (st.type === 'q') html += this.tplQuestion(st);
    else html += '<div class="coach-do">' + st.do + '</div>';
    html += '<div class="coach-mode-host"></div><div class="coach-fb" role="status" aria-live="polite"></div><div class="coach-hint" aria-live="polite"></div>';
    html += '<div class="coach-actions"></div>';
    html += '<details class="coach-steps"><summary>All steps (' + doneCount + ' of ' + total + ' done)</summary><ol>' + dots + '</ol></details>';
    html += '<div class="coach-foot"><button type="button" class="btn link" data-c="restart">Restart lesson</button></div>';
    this.coach.innerHTML = html;
    this.renderFeedback(); this.renderHint(); this.renderActions();
    this.schedule(true);
  };

  R.tplQuestion = function (st) {
    var self = this, locked = this.state === 'done';
    var opts = st.options.map(function (o, i) {
      var cls = '';
      if (locked && i === st.answer) cls = ' right';
      else if (self.qState === 'reveal' && i === st.answer) cls = ' right';
      return '<label class="q-opt' + cls + '"><input type="radio" name="q-opt" value="' + i + '"' + (self.qSel === i ? ' checked' : '') + (locked ? ' disabled' : '') + '> <span>' + esc(o) + '</span></label>';
    }).join('');
    return '<fieldset class="q"><legend class="coach-do">' + esc(st.q) + '</legend>' + opts + '</fieldset>';
  };

  R.renderFeedback = function () {
    var host = this.coach.querySelector('.coach-fb'), mh = this.coach.querySelector('.coach-mode-host'); if (!host) return;
    var st = this.step(), html = '';
    if (this.state === 'done') {
      html = '<div class="fb ok">' + I('check', 16) + '<div><b>Well done.</b>' + (st.why ? ' ' + (st.type === 'q' ? '' : '') + st.why : '') + '</div></div>';
    } else if (this.fb) {
      html = '<div class="fb ' + (this.fb.kind === 'wrong' ? 'bad' : 'info') + '">' + I(this.fb.kind === 'wrong' ? 'bulb' : 'help', 16) + '<div>' + esc(this.fb.text) + '</div></div>';
    }
    host.innerHTML = html;
    var mode = '';
    if (st.type !== 'q' && !st.free && st.mode && this.sim.ui.mode !== st.mode && this.state === 'active') {
      mode = '<div class="coach-mode fb info">' + I('toggle', 16) + '<div>This step is for <b>' + PART_LABEL[st.mode] + '</b>. <button type="button" class="btn small" data-c="mode">Switch to ' + PART_LABEL[st.mode] + '</button></div></div>';
    } else if (this.modeNote && this.state === 'active') {
      mode = '<div class="coach-note">' + esc(this.modeNote) + '</div>';
    }
    if (mh) mh.innerHTML = mode;
    if (this.state === 'done' && st.type === 'q') this.render2q();
  };
  R.render2q = function () { /* correct answer already marked in tplQuestion via locked state */ };

  R.renderHint = function () {
    var host = this.coach.querySelector('.coach-hint'); if (!host) return;
    var st = this.step();
    host.innerHTML = this.hintShown && this.state === 'active' && st.hint ? '<div class="fb hint">' + I('bulb', 16) + '<div><b>Hint.</b> ' + st.hint + '</div></div>' : '';
    this.renderActions();
  };

  R.renderActions = function () {
    var host = this.coach.querySelector('.coach-actions'); if (!host) return;
    var st = this.step(), h = '';
    if (this.state === 'done') h = '<button type="button" class="btn primary" data-c="next">' + (this.idx >= this.steps.length - 1 ? 'Finish lesson' : 'Next step') + '</button>';
    else if (st.type === 'q') h = '<button type="button" class="btn primary" data-c="check">Check answer</button>';
    else if (st.hint && !this.hintShown) h = '<button type="button" class="btn" data-c="hint">' + I('bulb', 14) + ' Show hint</button>';
    host.innerHTML = h;
  };

  R.tplFinished = function () {
    var L = this.lesson, c = L.compare || [];
    var rows = c.map(function (r) {
      return '<tr><th scope="row">' + r[0] + '</th><td>' + r[1] + '</td><td>' + r[2] + '</td><td><span class="tag tag-' + r[3] + '">' + OT.tagLabel(r[3]) + '</span></td></tr>';
    }).join('');
    return '<div class="coach-top"><span class="part part-done">Lesson complete</span></div><h3 class="coach-title">' + I('trophy', 20) + ' ' + esc(L.title) + '</h3>' +
      '<p class="coach-do">You completed every task' + (this.stats.wrong + this.stats.qWrong ? ' (with ' + U.plural(this.stats.wrong + this.stats.qWrong, 'mistake') + ' along the way)' : ' without a mistake') + '. Here is what changed:</p>' +
      '<div class="cmp-wrap"><table class="cmp"><thead><tr><th>Task</th><th>Classic Outlook</th><th>New Outlook</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="coach-actions"><button type="button" class="btn primary" data-c="nextlesson">Next lesson</button><button type="button" class="btn" data-c="quiz">Take the module quiz</button><button type="button" class="btn" data-c="again">Practice again</button><button type="button" class="btn link" data-c="dash">Back to dashboard</button></div>';
  };

  OT.tagLabel = function (t) {
    return { same: 'Same', moved: 'Moved', different: 'Works differently', 'new': 'New Outlook only', missing: 'Not supported', partial: 'Partly available', classic: 'Classic only' }[t] || t;
  };

  /* ---------------------------------------------------------- highlighting */
  R.targetKeys = function () {
    var st = this.step(); if (!st || st.type === 'q' || this.state !== 'active') return [];
    var t = st.target; if (typeof t === 'function') { try { t = t(this.sim); } catch (e) { t = []; } }
    return t || [];
  };

  R.visible = function (n) {
    if (!n || n.offsetParent === null) return false;
    var r = n.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    // the folder pane is an off-screen drawer on narrow windows until it is opened
    if (this.sim.ui.narrow && !this.sim.ui.drawer && n.closest('.sim-folders')) return false;
    return true;
  };

  R.findTarget = function () {
    var keys = this.targetKeys(), root = this.sim.root, ui = this.sim.ui;
    for (var i = keys.length - 1; i >= 0; i--) {
      var n = root.querySelector('[data-t="' + keys[i] + '"]');
      if (this.visible(n)) return { el: n, key: keys[i] };
    }
    var last = keys[keys.length - 1] || '', h;
    // folder pane lives behind the menu button on narrow windows
    if (keys.some(function (k) { return /^(f-|fav-)/.test(k); }) && !ui.drawer) { h = root.querySelector('[data-t="hamburger"]'); if (this.visible(h)) return { el: h, key: 'hamburger' }; }
    // single-pane layouts: the message list is hidden while a message is open
    if (keys.length && ui.app === 'mail' && ui.pane === 'read') { var bk = root.querySelector('[data-t="rp-back"]'); if (this.visible(bk)) return { el: bk, key: 'rp-back' }; }
    return null;
  };

  R.clearHighlight = function () {
    var nodes = this.sim.root.querySelectorAll('.ot-hl');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('ot-hl');
    this.sim.el.callout.innerHTML = '';
  };

  R.schedule = function (force) {
    var self = this;
    if (this._raf) return;
    this._raf = requestAnimationFrame(function () { self._raf = 0; if (!self.destroyed) self.highlight(force); });
  };

  R.highlight = function (force) {
    this.clearHighlight();
    if (this.state !== 'active') return;
    var found = this.findTarget(); if (!found) return;
    var el = found.el; el.classList.add('ot-hl');
    if (this.lastKey !== found.key) {
      this.lastKey = found.key;
      try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* ignore */ }
    }
    var st = this.step(), text = found.key === 'hamburger' ? 'Open the folders' : (found.key === 'rp-back' ? 'Back to the list' : (st.callout || 'Here'));
    var host = this.sim.el.callout, base = this.sim.el.sim.getBoundingClientRect(), r = el.getBoundingClientRect();
    var b = document.createElement('div'); b.className = 'callout'; b.textContent = text; b.setAttribute('aria-hidden', 'true');
    host.appendChild(b);
    var bw = b.offsetWidth, bh = b.offsetHeight, left = r.left - base.left + r.width / 2 - bw / 2, top = r.bottom - base.top + 8, below = true;
    if (top + bh > base.height - 4) { top = r.top - base.top - bh - 8; below = false; }
    left = Math.max(6, Math.min(left, base.width - bw - 6));
    b.style.left = left + 'px'; b.style.top = Math.max(2, top) + 'px'; b.classList.add(below ? 'below' : 'above');
  };

  /* hide scroll jumps when nothing to do */
})();
