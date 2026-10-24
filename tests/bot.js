/* Test bot: follows the highlighted control for every lesson step and reports where it gets stuck. */
const FILL = {
  search: { 'l7.s1': 'invoice', 'l7.s6': 'Atlas' },
  'c-to-input': { 'l4.s2': 'Priya', 'l4.s6': 'Marcus', 'l5.s4': 'Aisha', 'l5.s7': 'Carla' },
  'c-cc-input': { 'l4.s6': 'Sam' },
  'c-req-input': { 'l12.s2': 'Priya', 'l12.s6': 'Marcus' },
  'nf-name': { '*': 'Atlas Project' }, 'newfolder-input': { '*': 'Vendors' }
};
const SELECT = { 'rule-move': (k)=>/l8\.s6/.test(k)?/vendor/i:/atlas/i, 'bs-theme': 'darkgray', 's-undo': '20' };
const DEFAULT_TEXT = { 'c-subject': 'Hello team', 'c-body': 'Thanks, see you soon.', 'ev-title': 'Vendor review', 'rule-text': 'x', 'ar-text': 'Away' };

exports.runLesson = async function (pg, L, opts) {
  opts = opts || {};
  const problems = [];
  const base = pg.url().split('#')[0];
  await pg.goto(base + '#/'); await pg.waitForSelector('.hero');
  await pg.goto(base + '#/lesson/' + L.id);
  await pg.waitForSelector('#start-lesson');
  if (!opts.noNav) { await pg.click('#start-lesson'); } else { await pg.click('#start-lesson'); }
  let last = '', stuck = 0, steps = 0, guard = 0;
  while (guard++ < 400) {
    await pg.waitForTimeout(120);
    const st = await pg.evaluate(() => { const r = OT.app.runner(); if (!r) return null; return { idx: r.idx, state: r.state, id: (r.step().id || ''), type: r.step().type || '', answer: r.step().answer, title: r.step().title }; });
    if (!st) { problems.push('no runner'); break; }
    if (st.state === 'finished') break;
    if (opts.stopAt !== undefined && st.idx === opts.stopAt && st.state === 'active') break;
    const key = st.idx + ':' + st.state;
    if (key !== last) { last = key; stuck = 0; if (st.state === 'active') steps++; } else stuck++;
    if (stuck > 14) { const info = await pg.evaluate(() => ({ hl: [...document.querySelectorAll('.ot-hl')].map(e => e.dataset.t || e.className).join(','), coach: document.querySelector('#coach').innerText.slice(0, 260), keys: OT.app.runner().targetKeys() })); problems.push(`STUCK ${L.id}.${st.id} "${st.title}" ${JSON.stringify(info)}`); break; }
    if (st.state === 'done') { const nx = await pg.$('[data-c="next"]'); if (nx) await nx.click(); continue; }
    if (st.type === 'q') {
      const radios = await pg.$$('.coach input[name="q-opt"]');
      // answer index refers to displayed order (no shuffle in lessons)
      await radios[st.answer].check(); await pg.click('[data-c="check"]'); continue;
    }
    // auto-fill empty compose/event fields
    for (const [sel, txt] of [['#c-subject', DEFAULT_TEXT['c-subject']], ['#ev-title', DEFAULT_TEXT['ev-title']]]) {
      const h = await pg.$(sel); if (h && !(await h.inputValue())) await h.fill(txt);
    }
    const body = await pg.$('#c-body'); if (body && !(await body.inputValue()).trim()) await body.fill(DEFAULT_TEXT['c-body']);
    const hl = await pg.$('.sim .ot-hl');
    if (!hl) { await pg.waitForTimeout(250); continue; }
    const info = await hl.evaluate(e => ({ t: e.dataset.t || '', tag: e.tagName, type: e.type || '', id: e.id || '' }));
    const stepKey = L.id + '.' + st.id;
    try {
      if (info.tag === 'SELECT') {
        let want = SELECT[info.t]; if (typeof want === 'function') want = want(stepKey); const opts = await hl.$$eval('option', os => os.map(o => ({ v: o.value, l: o.textContent })));
        const pick = typeof want === 'string' ? opts.find(o => o.v === want) : opts.find(o => want.test(o.l));
        if (!pick) throw new Error('no option for ' + info.t); await hl.selectOption(pick.v);
      } else if (info.type === 'checkbox' || info.type === 'radio') { await hl.check();
      } else if (info.tag === 'INPUT' || info.tag === 'TEXTAREA') {
        const f = FILL[info.t]; const txt = f ? (f[stepKey] || f['*']) : DEFAULT_TEXT[info.t];
        if (info.t === 'search') { await hl.click(); await hl.fill(txt || 'invoice'); await hl.press('Enter'); }
        else if (txt === undefined) { await hl.fill('Hello there'); }
        else { await hl.click(); await hl.fill(''); await hl.type(txt, { delay: 5 }); if (/^(nf-name|newfolder-input)$/.test(info.t)) { if (info.t === 'newfolder-input') await hl.press('Enter'); } }
      } else { await hl.click({ timeout: 3000 }); }
    } catch (e) { if (!/not attached|detached/.test(e.message)) problems.push(`ACTION ${L.id}.${st.id} on ${info.t}: ${e.message.split('\n')[0]}`); stuck += 1; }
  }
  return { steps, problems };
};
