/* ==========================================================================
   sim-forms.js — compose window, meeting form, settings, backstage, dialogs
   Classic Outlook opens messages/meetings in separate windows and uses the
   File tab + dialogs. New Outlook composes inline and uses a Settings pane.
   ========================================================================== */
(function () {
  'use strict';
  var OT = window.OT, U = OT.util, I = OT.icon, S = OT.Sim.prototype, esc = U.esc;

  function htmlToText(h) {
    return String(h).replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
  }
  OT.util.htmlToText = htmlToText;

  S.slots = function () {
    if (!this.dSlots || !this.el.dialog.contains(this.dSlots.dlg)) {
      this.el.dialog.innerHTML = '<div class="bs-slot"></div><div class="dlg-slot"></div>';
      this.dSlots = { bs: this.el.dialog.querySelector('.bs-slot'), dlg: this.el.dialog.querySelector('.dlg-slot') };
    }
    return this.dSlots;
  };
  S.clearOverlays = function () {
    this.el.dialog.innerHTML = ''; this.dSlots = null;
    this.ui.dialog = null; this.ui.settings = null; this.ui.backstage = null;
    this.el.sim.classList.remove('has-dialog');
  };

  /* ---------------------------------------------------------------- helpers */
  S.rcptFor = function (v) {
    if (typeof v === 'object' && v) return v;
    var c = this.contact(v);
    if (c) return { id: c.id, name: c.name, email: c.email };
    return { id: null, name: String(v), email: String(v) };
  };
  S.storedRcpt = function (r) { return r.id ? r.id : { name: r.email, email: r.email }; };
  S.matchContacts = function (q) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return [];
    var self = this;
    return Object.keys(this.s.contacts).map(function (k) { return self.s.contacts[k]; }).filter(function (c) {
      return c.id !== 'jordan' && (c.name.toLowerCase().indexOf(q) !== -1 || c.email.toLowerCase().indexOf(q) !== -1);
    }).slice(0, 5);
  };
  S.F = function () { return this.ui.compose || this.ui.evform; };
  S.dq = function (sel) { return this.el.dialog.querySelector(sel); };
  S.cq = function (sel) { return this.el.compose.querySelector(sel); };

  /* --------------------------------------------------------------- compose */
  S.signatureText = function () { var s = this.cfg().signature; return s ? '\n\n' + s : ''; };

  S.quotedHeader = function (m) {
    var c = this.contact(m.from) || { name: m.from, email: '' }, self = this;
    return '\n\n________________________________\nFrom: ' + c.name + ' <' + c.email + '>\nSent: ' + U.fmtDate(new Date(m.date)) + ' ' + U.fmtTime(new Date(m.date)) +
      '\nTo: ' + this.recipientsLabel(m.to) + (m.cc && m.cc.length ? '\nCc: ' + this.recipientsLabel(m.cc) : '') + '\nSubject: ' + m.subject + '\n\n' + htmlToText(m.body);
  };

  S.openCompose = function (o) {
    if (this.ui.compose || this.ui.evform) this.closeCompose(true);
    this.closeMenu();
    var kind = o.kind || 'new', src = o.source ? this.msg(o.source) : null, self = this;
    var c = { kind: kind, sourceId: o.source || null, to: [], cc: [], subject: '', body: '', attachments: [], draftId: null, deliverAt: null, important: false, tab: 'message', ccShown: false, error: '', pend: { to: '', cc: '' } };
    if (o.restore) {
      for (var k in o.restore) c[k] = o.restore[k];
    } else if (src) {
      var base = src.subject.replace(/^((re|fw|fwd):\s*)+/i, '');
      if (kind === 'reply' || kind === 'replyall') {
        c.to = [this.rcptFor(src.from)];
        c.subject = 'RE: ' + base;
        if (kind === 'replyall') {
          (src.to || []).forEach(function (r) {
            var rr = self.rcptFor(r);
            if (rr.id !== 'jordan' && !c.to.some(function (x) { return x.email === rr.email; })) c.to.push(rr);
          });
          (src.cc || []).forEach(function (r) {
            var rr = self.rcptFor(r);
            if (rr.id !== 'jordan') c.cc.push(rr);
          });
          c.ccShown = c.cc.length > 0;
        }
      } else if (kind === 'forward') {
        c.subject = 'FW: ' + base;
        c.attachments = src.attachments.map(function (a) { return U.clone(a); });
      }
      c.body = this.signatureText() + this.quotedHeader(src);
    } else {
      (o.to || []).forEach(function (r) { c.to.push(self.rcptFor(r)); });
      c.body = this.signatureText();
    }
    c.initialBody = c.body;
    this.ui.compose = c;
    this.renderCompose();
    this.el.sim.classList.add('has-compose');
    this.emit('compose-open', { kind: kind, source: o.source || null });
    var focusId = (kind === 'new' && !c.to.length) ? 'c-to-input' : (c.to.length && kind === 'new' ? 'c-subject' : 'c-body');
    var n = this.cq('#' + focusId); if (n) { n.focus(); if (focusId === 'c-body' && n.setSelectionRange) n.setSelectionRange(0, 0); }
  };

  S.editDraft = function (id) {
    var m = this.msg(id); if (!m) return;
    var self = this;
    this.openCompose({
      kind: 'new', restore: {
        to: (m.to || []).map(function (r) { return self.rcptFor(r); }), cc: (m.cc || []).map(function (r) { return self.rcptFor(r); }),
        subject: m.subject, body: htmlToText(m.body), attachments: m.attachments.slice(), draftId: id
      }
    });
  };

  S.syncFromDom = function () {
    var c = this.F(); if (!c) return;
    var q = function (s, self) { return self.cq(s); };
    var sub = this.cq('#c-subject'); if (sub && this.ui.compose) c.subject = sub.value;
    var body = this.cq('#c-body'); if (body) c.body = body.value;
    ['to', 'cc', 'req', 'opt'].forEach(function (f) {
      var inp = this.cq('#c-' + f + '-input');
      if (inp) { c.pend = c.pend || {}; c.pend[f] = inp.value; }
    }, this);
    var ev = this.ui.evform;
    if (ev) {
      var t = this.cq('#ev-title'); if (t) ev.title = t.value;
      var d = this.cq('#ev-date'); if (d) ev.date = d.value;
      var s1 = this.cq('#ev-start'); if (s1) ev.start = s1.value;
      var s2 = this.cq('#ev-end'); if (s2) ev.end = s2.value;
      var l = this.cq('#ev-location'); if (l) ev.location = l.value;
    }
  };

  S.rcptField = function (f, label, hideLabel) {
    var c = this.F(), self = this, list = c[f] || [];
    var chips = list.map(function (r, i) {
      return '<span class="chip-r' + (r.id ? '' : ' ext') + '" title="' + esc(r.email) + '">' + esc(r.name) +
        '<button type="button" class="chip-x" data-act="rcpt-remove" data-field="' + f + '" data-i="' + i + '" aria-label="Remove ' + esc(r.name) + '">' + I('x', 10) + '</button></span>';
    }).join('');
    return '<div class="rcpt" data-field="' + f + '" data-t="c-' + f + '"><label class="rcpt-l' + (hideLabel ? ' sr' : '') + '" for="c-' + f + '-input">' + label + '</label><div class="rcpt-box">' + chips +
      '<input id="c-' + f + '-input" class="rcpt-in" autocomplete="off" spellcheck="false" aria-label="' + label + '" value="' + esc((c.pend && c.pend[f]) || '') + '" data-t="c-' + f + '-input"></div><div class="rcpt-sug" id="c-' + f + '-sug" role="listbox"></div></div>';
  };

  S.attStrip = function (c) {
    if (!c.attachments.length) return '';
    var self = this;
    return '<div class="cw-atts" aria-label="Attachments">' + c.attachments.map(function (a, i) {
      return '<span class="att-chip">' + self.fileIcon(a.ext) + '<span><b>' + esc(a.name) + '</b> <small>' + U.fmtSize(a.size) + '</small></span><button type="button" class="chip-x" data-act="attach-remove" data-i="' + i + '" aria-label="Remove attachment ' + esc(a.name) + '">' + I('x', 10) + '</button></span>';
    }).join('') + '</div>';
  };

  S.renderCompose = function () {
    var c = this.ui.compose; if (!c) return;
    var isNew = this.isNew(), html;
    var titleTxt = (c.subject ? c.subject : 'Untitled') + ' - Message (HTML)';
    var errHtml = '<div class="cw-err" id="c-err" role="alert">' + esc(c.error || '') + '</div>';
    var imp = '<button type="button" class="rb rb-s' + (c.important ? ' on' : '') + '" data-act="compose-importance" data-t="c-importance" aria-pressed="' + c.important + '" aria-label="High importance" title="High importance">' + I('flag', 16, 'rb-ic') + '<span class="rb-l">High Importance</span></button>';
    var attBtn = '<button type="button" class="rb rb-l" data-act="menu" data-menu="attach-menu" aria-haspopup="menu" aria-expanded="false" data-t="c-attach" aria-label="Attach file" title="Attach file">' + I('attach', 22, 'rb-ic') + '<span class="rb-l">Attach File</span>' + I('chev-down', 10, 'rb-caret') + '</button>';
    if (!isNew) {
      var tabs = [['message', 'Message'], ['insert', 'Insert'], ['options', 'Options']];
      var tabHtml = '<div class="rtabs" role="tablist">' + tabs.map(function (t) {
        return '<button type="button" role="tab" class="rtab' + (c.tab === t[0] ? ' on' : '') + '" aria-selected="' + (c.tab === t[0]) + '" data-act="compose-tab" data-arg="' + t[0] + '" data-t="c-tab-' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div>';
      var panel = '';
      if (c.tab === 'message') panel = '<div class="rg"><div class="rg-items">' + attBtn + imp + '</div><div class="rg-label">Include</div></div>';
      if (c.tab === 'insert') panel = '<div class="rg"><div class="rg-items">' + attBtn + '<button type="button" class="rb rb-l" data-act="compose-signature" data-t="c-signature" aria-label="Insert signature">' + I('file', 22, 'rb-ic') + '<span class="rb-l">Signature</span></button></div><div class="rg-label">Include</div></div>';
      if (c.tab === 'options') panel = '<div class="rg"><div class="rg-items"><button type="button" class="rb rb-l' + (c.deliverAt ? ' on' : '') + '" data-act="delay-open" data-t="c-delay" aria-label="Delay Delivery">' + I('clock', 22, 'rb-ic') + '<span class="rb-l">Delay Delivery</span></button></div><div class="rg-label">More Options</div></div>';
      html = '<div class="cw classic" role="dialog" aria-label="' + esc(titleTxt) + '">' +
        '<div class="cw-title"><span class="cw-t">' + esc(titleTxt) + '</span><button type="button" class="cw-save" data-act="compose-save" data-t="c-save" aria-label="Save as draft" title="Save">' + I('file', 14) + '</button><button type="button" class="cw-x" data-act="compose-close" data-t="c-close" aria-label="Close">' + I('x', 14) + '</button></div>' +
        '<div class="cw-ribbon">' + tabHtml + '<div class="rpanel">' + panel + '</div></div>' +
        '<div class="cw-form"><div class="cw-sendcol"><button type="button" class="send-big" data-act="compose-send" data-t="c-send" aria-label="Send">' + I('send', 22) + '<span>Send</span></button></div>' +
        '<div class="cw-fields">' +
        '<div class="cw-row"><button type="button" class="to-btn" data-act="dialog" data-arg="selectnames" data-field="to" data-t="c-to-btn">To…</button>' + this.rcptField('to', 'To', true) + '</div>' +
        '<div class="cw-row"><button type="button" class="to-btn" data-act="dialog" data-arg="selectnames" data-field="cc" data-t="c-cc-btn">Cc…</button>' + this.rcptField('cc', 'Cc', true) + '</div>' +
        '<div class="cw-row"><label class="subj-l" for="c-subject">Subject</label><input id="c-subject" class="subj" data-t="c-subject" autocomplete="off" value="' + esc(c.subject) + '"></div>' +
        (c.deliverAt ? '<div class="cw-note">' + I('clock', 13) + ' Do not deliver before ' + esc(c.deliverAt) + '</div>' : '') +
        this.attStrip(c) + '</div></div>' +
        '<textarea id="c-body" class="cw-body" data-t="c-body" aria-label="Message body">' + esc(c.body) + '</textarea>' + errHtml + '</div>';
    } else {
      html = '<div class="cw new" role="region" aria-label="New message">' +
        '<div class="cw-bar"><div class="send-split"><button type="button" class="send" data-act="compose-send" data-t="c-send" aria-label="Send">' + I('send', 15) + '<span>Send</span></button>' +
        '<button type="button" class="send-arrow" data-act="menu" data-menu="sendarrow" aria-haspopup="menu" aria-expanded="false" data-t="c-send-arrow" aria-label="More send options">' + I('chev-down', 12) + '</button></div>' +
        '<button type="button" class="rb rb-s" data-act="menu" data-menu="attach-menu" aria-haspopup="menu" aria-expanded="false" data-t="c-attach" aria-label="Attach">' + I('attach', 16, 'rb-ic') + '<span class="rb-l">Attach</span>' + I('chev-down', 10, 'rb-caret') + '</button>' +
        '<button type="button" class="rb rb-s' + (c.important ? ' on' : '') + '" data-act="compose-importance" data-t="c-importance" aria-pressed="' + c.important + '" aria-label="High importance">' + I('flag', 16, 'rb-ic') + '<span class="rb-l">Importance</span></button>' +
        '<span class="grow"></span><button type="button" class="rb rb-s" data-act="compose-discard" data-t="c-discard" aria-label="Discard">' + I('trash', 16, 'rb-ic') + '<span class="rb-l">Discard</span></button>' +
        '<button type="button" class="rb rb-s" data-act="compose-close" data-t="c-close" aria-label="Close">' + I('x', 16, 'rb-ic') + '</button></div>' +
        '<div class="cw-fields">' +
        '<div class="cw-row">' + this.rcptField('to', 'To') + (c.ccShown ? '' : '<button type="button" class="linkbtn" data-act="compose-showcc" data-t="c-showcc">Cc</button>') + '</div>' +
        (c.ccShown ? '<div class="cw-row">' + this.rcptField('cc', 'Cc') + '</div>' : '') +
        '<div class="cw-row"><label class="sr" for="c-subject">Subject</label><input id="c-subject" class="subj" data-t="c-subject" placeholder="Add a subject" autocomplete="off" value="' + esc(c.subject) + '"></div>' +
        this.attStrip(c) + '</div>' +
        '<textarea id="c-body" class="cw-body" data-t="c-body" aria-label="Message body" placeholder="Type your message">' + esc(c.body) + '</textarea>' + errHtml + '</div>';
    }
    this.el.compose.innerHTML = html;
    this.bindForms();
    this.rendered();
  };

  S.bindForms = function () {
    if (this._formsBound) return;
    this._formsBound = true;
    var self = this, host = this.el.compose;
    host.addEventListener('input', function (e) {
      var t = e.target, m = /^c-(to|cc|req|opt)-input$/.exec(t.id || '');
      if (m) self.updateSuggest(m[1], t.value);
      if (t.id === 'c-subject' && self.ui.compose) { var tt = self.cq('.cw-t'); if (tt) tt.textContent = (t.value || 'Untitled') + ' - Message (HTML)'; }
      if (/^ev-(date|start|end)$/.test(t.id || '')) self.updateConflict();
    });
    host.addEventListener('change', function (e) { if (/^ev-(date|start|end)$/.test(e.target.id || '')) self.updateConflict(); });
    host.addEventListener('keydown', function (e) {
      var t = e.target, m = /^c-(to|cc|req|opt)-input$/.exec(t.id || '');
      if (!m) return;
      if (e.key === 'Enter' || e.key === ';' || e.key === ',') { e.preventDefault(); self.flushRcpt(m[1], true); }
      else if (e.key === 'Backspace' && !t.value) { var f = self.F(); if (f[m[1]].length) { f[m[1]].pop(); self.syncFromDom(); self.refreshForm(); var n = self.cq('#c-' + m[1] + '-input'); if (n) n.focus(); } }
    });
    host.addEventListener('focusout', function (e) {
      var t = e.target, m = /^c-(to|cc|req|opt)-input$/.exec(t.id || '');
      if (m && t.value.trim() && self.ui.compose || (m && self.ui.evform && t.value.trim())) {
        setTimeout(function () { if (self.F() && !self.cq('#c-' + m[1] + '-sug button:hover')) self.flushRcpt(m[1], false); }, 150);
      }
    });
  };

  S.updateSuggest = function (f, q) {
    var box = this.cq('#c-' + f + '-sug'); if (!box) return;
    var list = this.matchContacts(q), c = this.F();
    list = list.filter(function (x) { return !(c[f] || []).some(function (r) { return r.id === x.id; }); });
    box.innerHTML = list.map(function (x) {
      return '<button type="button" role="option" class="sug" data-act="rcpt-pick" data-field="' + f + '" data-id="' + x.id + '" data-t="sug-' + x.id + '"><span class="av sm" style="background:' + U.colorFor(x.name) + '" aria-hidden="true">' + esc(U.initials(x.name)) + '</span><span><b>' + esc(x.name) + '</b><small>' + esc(x.email) + '</small></span></button>';
    }).join('');
  };

  S.addRcpt = function (f, r) {
    var c = this.F(); if (!c) return;
    c[f] = c[f] || [];
    if (c.pend) c.pend[f] = '';
    if (c[f].some(function (x) { return x.email.toLowerCase() === r.email.toLowerCase(); })) return;
    c[f].push(r);
  };

  S.flushRcpt = function (f, refocus) {
    var c = this.F(); if (!c) return;
    var inp = this.cq('#c-' + f + '-input'); if (!inp) return;
    var v = inp.value.trim();
    if (!v) return;
    var found = this.matchContacts(v);
    var exact = found.filter(function (x) { return x.name.toLowerCase() === v.toLowerCase() || x.email.toLowerCase() === v.toLowerCase(); })[0];
    var pick = exact || found[0];
    if (pick) { this.syncFromDom(); this.addRcpt(f, this.rcptFor(pick.id)); }
    else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { this.syncFromDom(); this.addRcpt(f, { id: null, name: v, email: v }); }
    else { c.error = '“' + v + '” isn’t a name or email address Outlook can find. Use a name from the suggestions or a full email address.'; var er = this.cq('#c-err') || this.cq('#ev-err'); if (er) er.textContent = c.error; return; }
    c.error = '';
    this.refreshForm();
    if (refocus !== false) { var n = this.cq('#c-' + f + '-input'); if (n) n.focus(); }
  };

  S.refreshForm = function () { if (this.ui.compose) this.renderCompose(); else if (this.ui.evform) this.renderEvForm(); };

  S.composeMessageData = function () {
    var c = this.ui.compose;
    return { to: c.to.slice(), cc: c.cc.slice(), subject: c.subject, body: c.body, attachments: c.attachments.slice(), important: c.important, kind: c.kind, sourceId: c.sourceId };
  };

  S.isDirty = function () {
    var c = this.ui.compose; if (!c) return false;
    return !!(c.to.length || c.cc.length || c.subject.trim() || c.attachments.length || (c.body !== c.initialBody && c.body.trim()));
  };

  S.saveDraft = function (silent) {
    var c = this.ui.compose; if (!c) return null;
    this.syncFromDom();
    var data = { id: c.draftId || this.nextId('d'), folder: 'drafts', from: 'jordan', to: c.to.map(this.storedRcpt), cc: c.cc.map(this.storedRcpt), subject: c.subject || '(no subject)', date: this.tick(), read: true, attachments: c.attachments.slice(), draft: true, body: '<div class="pre">' + esc(c.body) + '</div>' };
    if (c.draftId) { var old = this.msg(c.draftId); if (old) { for (var k in data) old[k] = data[k]; } else this.s.messages.push(data); }
    else this.s.messages.push(data);
    this.emit('draft-save', { id: data.id });
    if (!silent) this.toast('Draft saved to the Drafts folder.');
    return data;
  };

  S.closeCompose = function (silent) {
    var c = this.ui.compose, ev = this.ui.evform;
    if (c) {
      this.syncFromDom();
      if (this.isDirty() && silent) this.saveDraft(true);
    }
    this.ui.compose = null; this.ui.evform = null;
    this.el.compose.innerHTML = '';
    this.el.sim.classList.remove('has-compose');
    this.render();
  };

  S.requestCloseCompose = function () {
    if (this.ui.evform) { this.syncFromDom(); this.ui.evform = null; this.el.compose.innerHTML = ''; this.el.sim.classList.remove('has-compose'); this.emit('event-form-close', {}); this.render(); return; }
    var c = this.ui.compose; if (!c) return;
    this.syncFromDom();
    if (!this.isDirty()) { this.closeCompose(true); return; }
    if (this.isNew()) { this.saveDraft(false); this.closeCompose(); }
    else this.showDialog('savechanges', {});
  };

  S.sendCompose = function (opts) {
    opts = opts || {};
    var c = this.ui.compose; if (!c) return;
    this.flushRcpt('to', false); this.flushRcpt('cc', false);
    this.syncFromDom();
    c = this.ui.compose; if (!c) return;
    if (!c.to.length && !c.cc.length) {
      c.error = 'Add at least one recipient before sending. Type a name in the To box and pick a suggestion.';
      var er = this.cq('#c-err'); if (er) er.textContent = c.error;
      this.emit('compose-error', { error: 'no-recipient' });
      return;
    }
    if (!c.subject.trim() && !c.noSubjectOk) {
      var self = this;
      this.confirm({ title: 'Send without a subject?', text: 'This message has no subject. Do you want to send it anyway?', ok: 'Send Anyway', cancel: 'Don\'t Send', onOk: function () { c.noSubjectOk = true; self.sendCompose(opts); } });
      return;
    }
    var self2 = this;
    var msg = {
      id: this.nextId('m'), folder: 'sent', from: 'jordan', to: c.to.map(this.storedRcpt), cc: c.cc.map(this.storedRcpt), subject: c.subject.trim() || '(no subject)',
      body: '<div class="pre">' + esc(c.body) + '</div>', date: this.tick(), read: true, attachments: c.attachments.slice(), important: c.important,
      kind: c.kind, inReplyTo: c.sourceId
    };
    var delivery = 'immediate', delayUntil = opts.schedule ? opts.schedule : null;
    if (c.draftId) this.s.messages = this.s.messages.filter(function (x) { return x.id !== c.draftId; });
    if (opts.schedule) {
      msg.folder = 'drafts'; msg.scheduledFor = opts.schedule; delivery = 'scheduled';
    } else if (c.deliverAt) {
      msg.folder = 'outbox'; msg.deliverAt = c.deliverAt; delivery = 'deferred';
    } else if (this.isNew() && this.cfg().undoSend > 0) {
      delivery = 'pending';
    }
    var payload = { id: msg.id, kind: c.kind, inReplyTo: c.sourceId, to: c.to.map(function (r) { return r.id || r.email; }), cc: c.cc.map(function (r) { return r.id || r.email; }), subject: msg.subject, attachments: msg.attachments.map(function (a) { return a.name; }), delivery: delivery, mode: this.ui.mode, scheduleLabel: opts.schedule || null, deliverAt: c.deliverAt || null };
    this.ui.compose = null;
    this.el.compose.innerHTML = '';
    this.el.sim.classList.remove('has-compose');
    this.closeMenu();
    if (delivery === 'pending') {
      var secs = this.cfg().undoSend, self3 = this;
      msg.folder = 'outbox'; msg.pendingSend = true;
      this.s.messages.push(msg);
      var tm = setTimeout(function () { self3.commitPending(msg.id); }, secs * 1000);
      this.timers.push(tm);
      this.ui.pending.push({ id: msg.id, timer: tm, data: this.dataForRestore(c, msg) });
      this.emit('compose-send', payload);
      this.toast('Message sent (undo available for ' + secs + ' seconds)', { action: { label: 'Undo', act: 'undo-send', id: msg.id }, ms: secs * 1000 });
    } else {
      this.s.messages.push(msg);
      this.emit('compose-send', payload);
      if (delivery === 'scheduled') { this.emit('schedule-send', { id: msg.id, label: opts.schedule }); this.toast('Scheduled to send ' + opts.schedule + '. Find it in Drafts.'); }
      else if (delivery === 'deferred') { this.emit('delay-delivery', { id: msg.id, deliverAt: c.deliverAt }); this.toast('Message is waiting in the Outbox until ' + c.deliverAt + '.'); }
      else if (this.isNew()) this.toast('Message sent');
    }
    this.render();
  };

  S.dataForRestore = function (c, msg) {
    return { kind: c.kind, sourceId: c.sourceId, to: c.to, cc: c.cc, subject: c.subject, body: c.body, attachments: c.attachments, important: c.important, ccShown: c.cc.length > 0, initialBody: '', noSubjectOk: c.noSubjectOk };
  };
  S.commitPending = function (id) {
    var p = this.ui.pending.filter(function (x) { return x.id === id; })[0];
    var m = this.msg(id);
    if (!p || !m) return;
    this.ui.pending = this.ui.pending.filter(function (x) { return x.id !== id; });
    m.folder = 'sent'; delete m.pendingSend;
    this.emit('send-committed', { id: id });
    this.render();
  };
  S.undoSend = function (id) {
    var p = this.ui.pending.filter(function (x) { return x.id === id; })[0];
    if (!p) { this.toast('It\'s too late to undo: the message was already sent.'); return; }
    clearTimeout(p.timer);
    this.ui.pending = this.ui.pending.filter(function (x) { return x.id !== id; });
    this.s.messages = this.s.messages.filter(function (m) { return m.id !== id; });
    this.emit('undo-send', { id: id });
    this.openCompose({ kind: p.data.kind, restore: p.data });
    this.toast('Sending was canceled. Your message is back in the compose window.');
  };

  /* ---------------------------------------------------------- meeting form */
  S.openEventForm = function (o) {
    if (this.ui.compose || this.ui.evform) this.closeCompose(true);
    this.closeMenu();
    var self = this, start = o.start ? new Date(o.start) : new Date(2026, 9, 26, 10, 0);
    var end = new Date(start.getTime() + 30 * 60000);
    var ev = { title: '', req: [], opt: [], date: U.isoDate(start), start: U.isoTime(start), end: U.isoTime(end), location: '', teams: false, body: '', error: '', pend: { req: '', opt: '' }, optShown: false };
    (o.attendees || []).forEach(function (a) { if (a) ev.req.push(self.rcptFor(a)); });
    this.ui.evform = ev;
    this.renderEvForm();
    this.el.sim.classList.add('has-compose');
    this.emit('event-form-open', {});
    var n = this.cq('#ev-title'); if (n) n.focus();
  };

  S.renderEvForm = function () {
    var ev = this.ui.evform; if (!ev) return;
    var isNew = this.isNew(), hasAtt = ev.req.length + ev.opt.length > 0;
    var teamsBtn = isNew
      ? '<button type="button" role="switch" aria-checked="' + ev.teams + '" class="tgl' + (ev.teams ? ' on' : '') + '" data-act="ev-teams" data-t="c-teams"><span class="knob"></span><span class="tgl-l">Teams meeting</span></button>'
      : '<button type="button" class="rb rb-l' + (ev.teams ? ' on' : '') + '" data-act="ev-teams" data-t="c-teams" aria-pressed="' + ev.teams + '" aria-label="Teams Meeting">' + I('video', 22, 'rb-ic') + '<span class="rb-l">Teams Meeting</span></button>';
    var fields =
      '<div class="cw-row"><label class="subj-l" for="ev-title">' + (isNew ? 'Title' : 'Subject') + '</label><input id="ev-title" class="subj" data-t="ev-title" autocomplete="off" placeholder="' + (isNew ? 'Add a title' : '') + '" value="' + esc(ev.title) + '"></div>' +
      '<div class="cw-row">' + (isNew ? '' : '<span class="to-btn static">Required</span>') + this.rcptField('req', isNew ? 'Invite attendees' : 'Required', !isNew) + (isNew && !ev.optShown ? '<button type="button" class="linkbtn" data-act="ev-optional" data-t="ev-optional">Optional</button>' : '') + '</div>' +
      (ev.optShown || ev.opt.length ? '<div class="cw-row">' + (isNew ? '' : '<span class="to-btn static">Optional</span>') + this.rcptField('opt', 'Optional', !isNew) + '</div>' : (!isNew ? '<div class="cw-row"><span class="to-btn static">Optional</span>' + this.rcptField('opt', 'Optional', true) + '</div>' : '')) +
      '<div class="cw-row times"><label for="ev-date">Date</label><input id="ev-date" type="date" data-t="ev-date" value="' + esc(ev.date) + '"><label for="ev-start">Start</label><input id="ev-start" type="time" data-t="ev-start" value="' + esc(ev.start) + '"><label for="ev-end">End</label><input id="ev-end" type="time" data-t="ev-end" value="' + esc(ev.end) + '"></div>' +
      '<div class="cw-note warn" id="ev-conflict" role="status"></div>' +
      '<div class="cw-row"><label class="subj-l" for="ev-location">Location</label><input id="ev-location" class="subj" data-t="ev-location" autocomplete="off" value="' + esc(ev.location) + '"></div>';
    var html;
    if (!isNew) {
      html = '<div class="cw classic ev" role="dialog" aria-label="' + esc((ev.title || 'Untitled') + ' - Meeting') + '">' +
        '<div class="cw-title"><span class="cw-t">' + esc((ev.title || 'Untitled') + ' - Meeting') + '</span><button type="button" class="cw-x" data-act="compose-close" data-t="c-close" aria-label="Close">' + I('x', 14) + '</button></div>' +
        '<div class="cw-ribbon"><div class="rtabs" role="tablist"><button type="button" role="tab" class="rtab on" aria-selected="true">Meeting</button></div><div class="rpanel"><div class="rg"><div class="rg-items">' + teamsBtn + '</div><div class="rg-label">Teams Meeting (add-in)</div></div></div></div>' +
        '<div class="cw-form"><div class="cw-sendcol"><button type="button" class="send-big" data-act="ev-send" data-t="ev-send" aria-label="' + (hasAtt ? 'Send' : 'Save and close') + '">' + I('send', 22) + '<span>' + (hasAtt ? 'Send' : 'Save & Close') + '</span></button></div><div class="cw-fields">' + fields + '</div></div>' +
        '<textarea id="ev-body" class="cw-body" aria-label="Meeting description">' + esc(ev.body) + '</textarea><div class="cw-err" id="ev-err" role="alert">' + esc(ev.error) + '</div></div>';
    } else {
      html = '<div class="cw new ev" role="region" aria-label="New event">' +
        '<div class="cw-bar"><div class="send-split"><button type="button" class="send" data-act="ev-send" data-t="ev-send" aria-label="' + (hasAtt ? 'Send' : 'Save') + '">' + I('send', 15) + '<span>' + (hasAtt ? 'Send' : 'Save') + '</span></button></div>' +
        teamsBtn + '<span class="grow"></span><button type="button" class="rb rb-s" data-act="compose-close" data-t="c-discard" aria-label="Discard">' + I('trash', 16, 'rb-ic') + '<span class="rb-l">Discard</span></button></div>' +
        '<div class="cw-fields">' + fields + '</div><textarea id="ev-body" class="cw-body" aria-label="Description" placeholder="Add a description">' + esc(ev.body) + '</textarea><div class="cw-err" id="ev-err" role="alert">' + esc(ev.error) + '</div></div>';
    }
    this.el.compose.innerHTML = html;
    this.bindForms();
    this.updateConflict();
    this.rendered();
  };

  S.updateConflict = function () {
    var ev = this.ui.evform, box = this.cq('#ev-conflict'); if (!ev || !box) return;
    var d = (this.cq('#ev-date') || {}).value, s = (this.cq('#ev-start') || {}).value, e = (this.cq('#ev-end') || {}).value;
    var a = U.parseLocal(d, s), b = U.parseLocal(d, e);
    if (!a || !b) { box.textContent = ''; return; }
    if (b <= a) { box.textContent = 'The end time is before the start time.'; return; }
    var hits = this.s.events.filter(function (x) { return x.status !== 'declined' && x.status !== 'pending' && x.start < b.getTime() && x.end > a.getTime(); });
    box.textContent = hits.length ? 'Heads up — you already have: ' + hits.map(function (h) { return h.title; }).join(', ') + ' at this time.' : '';
  };

  S.sendEvent = function () {
    var ev = this.ui.evform; if (!ev) return;
    this.flushRcpt('req', false); this.flushRcpt('opt', false);
    this.syncFromDom();
    ev = this.ui.evform; if (!ev) return;
    var body = this.cq('#ev-body'); if (body) ev.body = body.value;
    var fail = function (self, msg) { ev.error = msg; var er = self.cq('#ev-err'); if (er) er.textContent = msg; self.emit('event-error', { error: msg }); };
    if (!ev.title.trim()) return fail(this, 'Add a title for the meeting.');
    var a = U.parseLocal(ev.date, ev.start), b = U.parseLocal(ev.date, ev.end);
    if (!a || !b) return fail(this, 'Choose a valid date and start/end time.');
    if (b <= a) return fail(this, 'The end time must be after the start time.');
    var attendees = [{ id: 'jordan', type: 'required', resp: 'accepted' }]
      .concat(ev.req.map(function (r) { return { id: r.id || r.email, type: 'required', resp: 'none' }; }))
      .concat(ev.opt.map(function (r) { return { id: r.id || r.email, type: 'optional', resp: 'none' }; }));
    var evt = { id: this.nextId('e'), title: ev.title.trim(), start: a.getTime(), end: b.getTime(), organizer: 'jordan', status: 'organizer', location: ev.teams ? (ev.location || 'Microsoft Teams Meeting') : ev.location, teams: ev.teams, attendees: attendees, body: ev.body };
    this.s.events.push(evt);
    this.ui.evform = null; this.el.compose.innerHTML = ''; this.el.sim.classList.remove('has-compose');
    if (this.ui.app === 'calendar') { /* keep view; make sure the new event is visible */
      var days = this.weekDays(), vis = days.some(function (d) { return U.sameDay(d, a); });
      if (!vis) this.ui.calDate = new Date(a);
    }
    this.emit('event-send', { id: evt.id, title: evt.title, start: evt.start, end: evt.end, attendees: attendees.map(function (x) { return x.id + ':' + x.type; }), teams: evt.teams, hasAttendees: attendees.length > 1 });
    this.toast(attendees.length > 1 ? 'Meeting invitation sent (simulated). Nothing leaves this training.' : 'Appointment saved to your calendar.');
    this.render();
  };

  /* --------------------------------------------------------------- dialogs */
  S.fileInfo = function (id) { return this.s.files.filter(function (f) { return f.id === id; })[0]; };

  S.showDialog = function (id, d) {
    d = d || {};
    var isNew = this.isNew(), self = this, title = '', body = '', btns = [], wide = false;
    var ok = function (label, t, extra) { return { label: label, act: 'dlg-submit', cls: 'primary', t: t || 'dlg-ok', extra: extra }; };
    var cancel = function (label) { return { label: label || 'Cancel', act: 'dialog-close', t: 'dlg-cancel' }; };
    switch (id) {
      case 'confirm':
        title = d.title; body = '<p>' + esc(d.text) + '</p>'; btns = [{ label: d.ok, act: 'dlg-confirm', cls: 'primary', t: 'dlg-ok' }, cancel(d.cancel)]; break;
      case 'savechanges':
        title = 'Microsoft Outlook'; body = '<p>Do you want to save changes to this message?</p>';
        btns = [{ label: 'Save', act: 'dlg-savechanges', arg: 'save', cls: 'primary', t: 'dlg-save' }, { label: 'Don\'t Save', act: 'dlg-savechanges', arg: 'discard', t: 'dlg-nosave' }, cancel()]; break;
      case 'newfolder': {
        title = 'Create New Folder';
        var opts = this.allFoldersFlat().filter(function (o) { return o.f.id !== 'outbox'; }).map(function (o) { return '<option value="' + o.f.id + '"' + (o.f.id === (d.parent || 'inbox') ? ' selected' : '') + '>' + '  '.repeat(o.depth) + esc(o.f.name) + '</option>'; }).join('');
        body = '<label for="dlg-name">Name:</label><input id="dlg-name" class="inp" data-t="nf-name" autocomplete="off"><label for="dlg-parent">Select where to place the folder:</label><select id="dlg-parent" class="inp" data-t="nf-parent">' + opts + '</select><div class="dlg-err" id="dlg-err" role="alert"></div>';
        btns = [ok('OK', 'nf-ok'), cancel()]; break;
      }
      case 'rename':
        title = 'Rename Folder'; body = '<label for="dlg-name">New name:</label><input id="dlg-name" class="inp" value="' + esc((this.folder(d.id) || {}).name || '') + '" data-t="rn-name"><div class="dlg-err" id="dlg-err" role="alert"></div>'; btns = [ok('OK', 'rn-ok'), cancel()]; break;
      case 'newrule': {
        var src = d.fromMsg ? this.msg(d.fromMsg) : null;
        title = isNew ? 'Create rule' : 'Rules Wizard';
        var fopts = this.allFoldersFlat().filter(function (o) { return o.f.id !== 'outbox' && o.f.id !== 'inbox'; }).map(function (o) { return '<option value="' + o.f.id + '">' + '  '.repeat(o.depth) + esc(o.f.name) + '</option>'; }).join('');
        body = '<label for="dlg-name">Rule name:</label><input id="dlg-name" class="inp" value="' + esc(src ? 'Messages from ' + this.name(src.from) : '') + '" data-t="rule-name">' +
          '<label for="dlg-field">When a message arrives and…</label><select id="dlg-field" class="inp"><option value="from">the sender contains</option><option value="subject">the subject contains</option></select>' +
          '<input id="dlg-text" class="inp" aria-label="Text to match" value="' + esc(src ? this.name(src.from) : '') + '" data-t="rule-text">' +
          '<label for="dlg-move">Move it to folder:</label><select id="dlg-move" class="inp" data-t="rule-move">' + fopts + '</select><div class="dlg-err" id="dlg-err" role="alert"></div>';
        btns = [ok(isNew ? 'Save' : 'Finish', 'rule-ok'), cancel()]; break;
      }
      case 'rules': {
        title = 'Rules and Alerts'; wide = true;
        body = '<p class="muted">Classic Outlook manages rules in this dialog (Home > Rules > Manage Rules &amp; Alerts, or File > Info). Rules created in classic that run on your PC (client-side) may not run in new Outlook.</p>' + this.rulesList();
        btns = [{ label: 'New Rule…', act: 'dialog', arg: 'newrule', t: 'rules-new' }, { label: 'Run Rules Now', act: 'rules-run', t: 'rules-run' }, { label: 'OK', act: 'dialog-close', cls: 'primary', t: 'dlg-ok' }]; break;
      }
      case 'addins': {
        title = isNew ? 'Add apps' : 'Add-ins for Outlook'; wide = true;
        var list = [['a1', 'Meeting Notes Helper', 'Capture notes and action items from a meeting.'], ['a2', 'Translator Pro', 'Translate selected text in a message.'], ['a3', 'Expense Tagger', 'Tag receipts and forward them to Finance.'], ['a4', 'Quick Polls', 'Insert a one-question poll into a message.']];
        this.s.addins = this.s.addins || {};
        body = '<p class="muted">All add-ins here are fictional. ' + (isNew ? 'New Outlook supports <b>web add-ins only</b>; classic COM/VSTO add-ins and VBA macros are not supported.' : 'Classic Outlook supports web add-ins and COM/VSTO add-ins.') + '</p><ul class="addin-list">' +
          list.map(function (a) { var on = self.s.addins[a[0]]; return '<li><div><b>' + a[1] + '</b><small>' + a[2] + '</small></div><button type="button" class="btn' + (on ? '' : ' primary') + '" data-act="addin-toggle" data-arg="' + a[0] + '" data-t="addin-' + a[0] + '">' + (on ? 'Remove' : 'Add') + '</button></li>'; }).join('') + '</ul>';
        btns = [{ label: 'Close', act: 'dialog-close', cls: 'primary', t: 'dlg-ok' }]; break;
      }
      case 'addressbook': case 'selectnames': {
        var sel = id === 'selectnames';
        title = sel ? 'Select Names: Global Address List' : 'Address Book: Global Address List'; wide = true;
        body = '<label for="ab-q">Search:</label><input id="ab-q" class="inp" data-t="ab-search" autocomplete="off"><ul class="ab-list" id="ab-list">' + this.abRows(sel, d.field || 'to', '') + '</ul>';
        btns = [{ label: sel ? 'OK' : 'Close', act: 'dialog-close', cls: 'primary', t: 'dlg-ok' }]; break;
      }
      case 'saveas': {
        var m = this.msg(d.msgId), a = m && m.attachments.filter(function (x) { return x.id === d.attId; })[0];
        title = 'Save Attachment'; this._saveas = { msgId: d.msgId, attId: d.attId };
        body = '<label for="dlg-fname">File name:</label><input id="dlg-fname" class="inp" value="' + esc(a ? a.name : '') + '" readonly><fieldset class="rad"><legend>Save in:</legend>' +
          ['Documents', 'Desktop', 'Downloads'].map(function (f, i) { return '<label class="rad-i"><input type="radio" name="sa-folder" value="' + f + '"' + (i === 0 ? ' checked' : '') + ' data-t="sa-' + f.toLowerCase() + '"> ' + f + '</label>'; }).join('') + '</fieldset><p class="muted">Simulated: nothing is written to your computer.</p>';
        btns = [ok('Save', 'sa-ok'), cancel()]; break;
      }
      case 'saveall': {
        title = 'Save All Attachments'; this._saveas = { msgId: d.msgId, all: true };
        body = '<fieldset class="rad"><legend>Save in:</legend>' + ['Documents', 'Desktop', 'Downloads'].map(function (f, i) { return '<label class="rad-i"><input type="radio" name="sa-folder" value="' + f + '"' + (i === 0 ? ' checked' : '') + ' data-t="sa-' + f.toLowerCase() + '"> ' + f + '</label>'; }).join('') + '</fieldset><p class="muted">Simulated: nothing is written to your computer.</p>';
        btns = [ok('OK', 'sa-ok'), cancel()]; break;
      }
      case 'viewer': {
        var vm = this.msg(d.msgId), va = vm && vm.attachments.filter(function (x) { return x.id === d.attId; })[0];
        var pv = va ? va.preview : { kind: 'text', title: '', lines: [] };
        title = 'Preview: ' + (va ? va.name : ''); wide = true;
        body = this.previewHtml(pv);
        btns = [{ label: 'Close', act: 'dialog-close', cls: 'primary', t: 'dlg-ok' }]; break;
      }
      case 'filepicker': {
        title = d.arg === 'cloud' ? 'Browse cloud locations — OneDrive (simulated)' : (isNew ? 'Open' : 'Insert File'); wide = true;
        body = '<p class="muted">Choose a fictional file to attach. Nothing is read from your computer.</p><ul class="fp-list2">' + this.s.files.map(function (f) { return '<li><button type="button" class="fp-file" data-act="attach-file" data-arg="' + f.id + '" data-t="fp-' + f.id + '">' + self.fileIcon(f.name.split('.').pop().toLowerCase()) + '<span><b>' + esc(f.name) + '</b><small>' + esc(f.folder) + ' · ' + U.fmtSize(f.size) + '</small></span></button></li>'; }).join('') + '</ul>';
        btns = [cancel('Cancel')]; break;
      }
      case 'delay': {
        title = 'Properties'; var c = this.ui.compose || {};
        body = '<fieldset class="rad"><legend>Delivery options</legend><label class="rad-i"><input type="checkbox" id="dl-on" data-t="dl-on"' + (c.deliverAt ? ' checked' : '') + '> Do not deliver before</label>' +
          '<div class="dl-row"><input id="dl-date" type="date" class="inp" value="2026-10-27" data-t="dl-date"><input id="dl-time" type="time" class="inp" value="08:00" data-t="dl-time"></div></fieldset><p class="muted">The message waits in the Outbox until that time. Outlook classic must stay open for it to send.</p>';
        btns = [{ label: 'Close', act: 'dlg-submit', cls: 'primary', t: 'dl-close' }]; break;
      }
      case 'rsvpedit':
        title = 'Edit the response'; this._rsvpEdit = { id: d.id, resp: d.resp };
        body = '<label for="dlg-text">Add a message (optional):</label><textarea id="dlg-text" class="inp" rows="4"></textarea>'; btns = [ok('Send', 'rsvp-send'), cancel()]; break;
      case 'autoreply':
        title = 'Automatic Replies'; wide = true;
        body = '<label class="rad-i"><input type="radio" name="ar" value="off"' + (this.s.autoReply.on ? '' : ' checked') + '> Do not send automatic replies</label><label class="rad-i"><input type="radio" name="ar" value="on" data-t="ar-on"' + (this.s.autoReply.on ? ' checked' : '') + '> Send automatic replies</label><label for="dlg-text">Reply once for each sender with the following text:</label><textarea id="dlg-text" class="inp" rows="5" data-t="ar-text">' + esc(this.s.autoReply.text) + '</textarea>';
        btns = [ok('OK', 'ar-ok'), cancel()]; break;
      case 'options': {
        var oc = (this.ui.optPage || 'general'); title = 'Outlook Options'; wide = true;
        body = this.optionsHtml(oc);
        btns = [{ label: 'OK', act: 'dialog-close', cls: 'primary', t: 'opt-ok' }]; break;
      }
      case 'signature':
        title = 'Signatures'; body = '<label for="dlg-text">Edit signature:</label><textarea id="dlg-text" class="inp" rows="4" data-t="sig-text">' + esc(this.cfg().signature) + '</textarea><p class="muted">Added to the bottom of new messages.</p>'; btns = [ok('OK', 'sig-ok'), cancel()]; break;
      case 'help':
        title = 'Help — about this simulator'; wide = true;
        body = '<p>This is a <b>training simulator</b>. Nothing connects to a real mailbox and nothing is ever sent. All people, messages and files are fictional.</p><ul><li>Use the <b>toggle</b> in the top-right corner to switch between Classic and New Outlook.</li><li>Message list: arrow keys move, Enter opens, Delete deletes. Right-click a message or folder for more commands.</li><li>You can drag a message onto a folder, or use Move.</li></ul><p>The simulator clock is fixed at Monday, October 26, 2026, 9:12 AM.</p>';
        btns = [{ label: 'Close', act: 'dialog-close', cls: 'primary', t: 'dlg-ok' }]; break;
      case 'feedback':
        title = 'Give feedback'; body = '<label for="dlg-text">Tell Microsoft what you think (simulated):</label><textarea id="dlg-text" class="inp" rows="4"></textarea><p class="muted">In real new Outlook, Help &gt; Give feedback sends feedback to Microsoft. Here, nothing is sent.</p>'; btns = [ok('Submit', 'fb-ok'), cancel()]; break;
      case 'whatsnew':
        title = 'What\'s new'; body = '<p>In new Outlook, <b>Help &gt; What\'s new</b> lists recent features. Microsoft publishes monthly updates for new Outlook, and features roll out gradually, so what you see can differ by account type, tenant policy and release.</p><p>Classic Outlook has no equivalent "What\'s new" command.</p>'; btns = [{ label: 'Close', act: 'dialog-close', cls: 'primary', t: 'dlg-ok' }]; break;
      default: return;
    }
    var slots = this.slots();
    var html = '<div class="dlg-scrim"><div class="dlg' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dlg-title" data-dlg="' + id + '"><div class="dlg-h"><h2 id="dlg-title">' + esc(title) + '</h2><button type="button" class="x" data-act="dialog-close" aria-label="Close dialog" data-t="dlg-x">' + I('x', 14) + '</button></div><div class="dlg-b">' + body + '</div><div class="dlg-f">' +
      btns.map(function (b) { return '<button type="button" class="btn ' + (b.cls || '') + '" data-act="' + b.act + '"' + (b.arg ? ' data-arg="' + b.arg + '"' : '') + (b.t ? ' data-t="' + b.t + '"' : '') + '>' + esc(b.label) + '</button>'; }).join('') + '</div></div></div>';
    slots.dlg.innerHTML = html;
    this.ui.dialog = { id: id, data: d };
    this.el.sim.classList.add('has-dialog');
    this.emit('dialog-open', { id: id });
    var first = slots.dlg.querySelector('input:not([readonly]):not([type=checkbox]):not([type=radio]),textarea,select') || slots.dlg.querySelector('.dlg-f .btn.primary') || slots.dlg.querySelector('button');
    if (first) first.focus();
    this.rendered();
  };

  S.closeDialog = function () {
    if (!this.ui.dialog) return;
    var id = this.ui.dialog.id;
    this.ui.dialog = null;
    if (this.dSlots) this.dSlots.dlg.innerHTML = '';
    this.el.sim.classList.remove('has-dialog');
    if (id === 'selectnames') this.refreshForm();
    this.rendered();
  };

  S.previewHtml = function (pv) {
    var h = '<div class="pv"><h3>' + esc(pv.title) + '</h3>';
    if (pv.kind === 'table') {
      h += '<table class="pv-t"><tbody>' + pv.rows.map(function (r, i) { return '<tr>' + r.map(function (c) { return (i === 0 ? '<th>' : '<td>') + esc(c) + (i === 0 ? '</th>' : '</td>'); }).join('') + '</tr>'; }).join('') + '</tbody></table>';
    } else if (pv.kind === 'image') {
      h += '<div class="pv-img" style="background:linear-gradient(135deg,' + pv.color + ',#e9f1fb)" role="img" aria-label="Placeholder image">' + I('eye', 36) + '</div>';
    } else {
      h += '<div class="pv-doc">' + pv.lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '</div>';
    }
    return h + '<p class="muted">Fictional content for training.</p></div>';
  };

  S.rulesList = function () {
    var self = this;
    if (!this.s.rules.length) return '<p>No rules yet.</p>';
    return '<ul class="rule-list">' + this.s.rules.map(function (r) {
      return '<li><label class="rl-t"><input type="checkbox" data-act="rule-toggle" data-arg="' + r.id + '"' + (r.enabled ? ' checked' : '') + ' aria-label="Enable rule ' + esc(r.name) + '"> <b>' + esc(r.name) + '</b></label><small>If the ' + (r.field === 'from' ? 'sender' : 'subject') + ' contains “' + esc(r.text) + '” → move to ' + esc(self.folderName(r.moveTo)) + '</small>' +
        '<span class="rl-a"><button type="button" class="btn" data-act="rules-run" data-arg="' + r.id + '" data-t="rule-run-' + r.id + '">Run now</button><button type="button" class="btn" data-act="rule-delete" data-arg="' + r.id + '" data-t="rule-del-' + r.id + '">Delete</button></span></li>';
    }).join('') + '</ul>';
  };

  S.abRows = function (sel, field, q) {
    var self = this;
    return this.matchContacts(q || ' ').concat(q ? [] : []).length ? '' : '';
  };
  S.abRows = function (sel, field, q) {
    var self = this, ql = String(q || '').toLowerCase();
    return Object.keys(this.s.contacts).map(function (k) { return self.s.contacts[k]; }).filter(function (c) {
      return c.id !== 'jordan' && (!ql || (c.name + ' ' + c.email).toLowerCase().indexOf(ql) !== -1);
    }).sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (c) {
      return '<li><span class="av sm" style="background:' + U.colorFor(c.name) + '" aria-hidden="true">' + esc(U.initials(c.name)) + '</span><span class="ab-n"><b>' + esc(c.name) + '</b><small>' + esc(c.title) + ' · ' + esc(c.email) + '</small></span>' +
        (sel ? '<button type="button" class="btn" data-act="ab-add" data-field="to" data-id="' + c.id + '" data-t="ab-to-' + c.id + '">To →</button><button type="button" class="btn" data-act="ab-add" data-field="cc" data-id="' + c.id + '" data-t="ab-cc-' + c.id + '">Cc →</button>'
          : '<button type="button" class="btn" data-act="ab-mail" data-id="' + c.id + '" data-t="ab-mail-' + c.id + '">New Email</button>') + '</li>';
    }).join('');
  };

  S.optionsHtml = function (page) {
    var c = this.cfg();
    var nav = [['general', 'General'], ['mail', 'Mail'], ['calendar', 'Calendar']].map(function (p) {
      return '<button type="button" class="opt-n' + (page === p[0] ? ' on' : '') + '" data-act="opt-page" data-arg="' + p[0] + '" data-t="opt-' + p[0] + '">' + p[1] + '</button>';
    }).join('');
    var content = '';
    if (page === 'general') {
      content = '<h3>General options</h3><label for="opt-theme">Office Theme:</label><select id="opt-theme" class="inp" data-t="opt-theme">' +
        [['colorful', 'Colorful'], ['darkgray', 'Dark Gray'], ['black', 'Black'], ['white', 'White']].map(function (t) { return '<option value="' + t[0] + '"' + (c.officeTheme === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select>' +
        '<p class="muted">In classic Outlook the theme is also under File &gt; Office Account.</p>';
    } else if (page === 'mail') {
      content = '<h3>Mail options</h3><p>Compose messages</p><button type="button" class="btn" data-act="dialog" data-arg="signature" data-t="opt-signatures">Signatures…</button><p class="muted">Classic Outlook has no built-in Undo Send. To hold messages briefly, create a rule that defers delivery.</p>';
    } else {
      content = '<h3>Calendar options</h3><label for="opt-ws">Work time — start:</label><select id="opt-ws" class="inp" data-t="opt-ws">' + this.hourOpts(c.workStart, 5, 11) + '</select><label for="opt-we">Work time — end:</label><select id="opt-we" class="inp" data-t="opt-we">' + this.hourOpts(c.workEnd, 14, 20) + '</select>';
    }
    return '<div class="opt"><div class="opt-nav" role="tablist">' + nav + '</div><div class="opt-c">' + content + '</div></div>';
  };
  S.hourOpts = function (sel, a, b) {
    var o = '';
    for (var h = a; h <= b; h++) o += '<option value="' + h + '"' + (h === sel ? ' selected' : '') + '>' + ((h % 12) || 12) + ':00 ' + (h < 12 ? 'AM' : 'PM') + '</option>';
    return o;
  };

  /* ------------------------------------------------------------ attachments */
  S.openViewer = function (msgId, attId) {
    this.emit('attachment-preview', { msgId: msgId, attId: attId });
    this.showDialog('viewer', { msgId: msgId, attId: attId });
  };
  S.saveAttachment = function (msgId, attId, folder, how) {
    var m = this.msg(msgId), a = m && m.attachments.filter(function (x) { return x.id === attId; })[0];
    if (!a) return;
    this.s.downloads.push({ name: a.name, folder: folder });
    if (!this.s.files.some(function (f) { return f.name === a.name; })) this.s.files.push({ id: 'f-dl-' + this.nextId('x'), name: a.name, size: a.size, folder: folder, preview: a.preview });
    this.emit('attachment-save', { msgId: msgId, attId: attId, folder: folder, how: how, name: a.name });
    this.toast((how === 'download' ? 'Downloaded ' : 'Saved ') + a.name + ' to ' + folder + ' (simulated — nothing was written to your computer)', { ms: 5000 });
  };
  S.saveAllAttachments = function (msgId) {
    if (this.isNew()) {
      var m = this.msg(msgId), self = this;
      m.attachments.forEach(function (a) { self.s.downloads.push({ name: a.name, folder: 'Downloads' }); });
      this.emit('attachment-saveall', { msgId: msgId, folder: 'Downloads', how: 'download' });
      this.toast('Downloaded ' + U.plural(m.attachments.length, 'file') + ' to Downloads (simulated)', { ms: 5000 });
    } else this.showDialog('saveall', { msgId: msgId });
  };
  S.openRsvpEdit = function (id, resp) { this.showDialog('rsvpedit', { id: id, resp: resp }); };

  /* ------------------------------------------------------ settings (New) */
  var PAGES = {
    general: { label: 'General', pages: [['appearance', 'Appearance']] },
    mail: { label: 'Mail', pages: [['compose', 'Compose and reply'], ['rules', 'Rules'], ['autoreply', 'Automatic replies']] },
    calendar: { label: 'Calendar', pages: [['calview', 'View'], ['events', 'Events and invitations']] }
  };
  S.openSettings = function (cat, page) {
    cat = cat || 'general';
    if (!PAGES[cat]) cat = 'general';
    page = page || PAGES[cat].pages[0][0];
    this.closeMenu();
    this.ui.settings = { cat: cat, page: page };
    this.emit('settings-open', { cat: cat, page: page });
    this.renderSettings();
  };
  S.closeSettings = function () {
    this.ui.settings = null;
    if (this.dSlots) this.dSlots.bs.innerHTML = '';
    this.el.sim.classList.remove('has-dialog');
    this.rendered();
    this.emit('settings-close', {});
  };
  S.renderSettings = function () {
    var st = this.ui.settings; if (!st) return;
    var self = this, c = this.cfg(), slots = this.slots();
    var nav = Object.keys(PAGES).map(function (k) {
      var open = st.cat === k;
      return '<div class="sn-cat"><button type="button" class="sn-c' + (open ? ' on' : '') + '" data-act="settings-nav" data-arg="' + k + '" data-arg2="' + PAGES[k].pages[0][0] + '" data-t="s-cat-' + k + '" aria-expanded="' + open + '">' + PAGES[k].label + I(open ? 'chev-down' : 'chev-right', 11) + '</button>' +
        (open ? PAGES[k].pages.map(function (p) { return '<button type="button" class="sn-p' + (st.page === p[0] ? ' on' : '') + '" data-act="settings-nav" data-arg="' + k + '" data-arg2="' + p[0] + '" data-t="s-nav-' + p[0] + '">' + p[1] + '</button>'; }).join('') : '') + '</div>';
    }).join('');
    var content = '';
    var sw = function (on, act, arg, arg2, label, t) { return '<button type="button" role="switch" aria-checked="' + on + '" class="tgl' + (on ? ' on' : '') + '" data-act="' + act + '" data-arg="' + arg + '" data-arg2="' + arg2 + '" data-t="' + t + '"><span class="knob"></span><span class="tgl-l">' + label + '</span></button>'; };
    switch (st.page) {
      case 'appearance':
        content = '<h3>Appearance</h3><p class="muted">Theme and dark mode live in Settings &gt; General &gt; Appearance in new Outlook.</p><div class="seg" role="group" aria-label="Mode">' +
          [['light', 'Light'], ['dark', 'Dark']].map(function (t) { return '<button type="button" class="segb' + (c.theme === t[0] ? ' on' : '') + '" aria-pressed="' + (c.theme === t[0]) + '" data-act="setting" data-arg="theme" data-arg2="' + t[0] + '" data-t="s-theme-' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
          '<p><b>Accent color</b></p><div class="swatches" role="group" aria-label="Accent color">' + [['blue', '#0f6cbd'], ['teal', '#038387'], ['plum', '#8764b8'], ['forest', '#498205']].map(function (a) { return '<button type="button" class="swatch' + (c.accent === a[0] ? ' on' : '') + '" style="background:' + a[1] + '" aria-label="' + a[0] + '" aria-pressed="' + (c.accent === a[0]) + '" data-act="setting" data-arg="accent" data-arg2="' + a[0] + '" data-t="s-accent-' + a[0] + '"></button>'; }).join('') + '</div>';
        break;
      case 'compose':
        content = '<h3>Compose and reply</h3><label for="s-undo"><b>Undo send</b></label><select id="s-undo" class="inp" data-t="s-undo">' + [0, 5, 10, 15, 20, 30].map(function (n) { return '<option value="' + n + '"' + (c.undoSend === n ? ' selected' : '') + '>' + (n ? n + ' seconds' : 'Off') + '</option>'; }).join('') + '</select><p class="muted">New Outlook waits this long before sending so you can click Undo. Classic Outlook has no built-in Undo send.</p>' +
          '<label for="s-sig"><b>Email signature</b></label><textarea id="s-sig" class="inp" rows="3" data-t="s-sig">' + esc(c.signature) + '</textarea><button type="button" class="btn primary" data-act="sig-save" data-t="s-sig-save">Save</button>';
        break;
      case 'rules':
        content = '<h3>Rules</h3><p class="muted">Rules apply to messages that arrive after you create them. Use Run now for existing mail. New Outlook doesn\'t support rules for Gmail, Yahoo or iCloud accounts, and rules can\'t be imported or exported.</p>' + this.rulesList() + '<button type="button" class="btn primary" data-act="dialog" data-arg="newrule" data-t="s-rule-add">' + I('plus', 13) + ' Add new rule</button>';
        break;
      case 'autoreply':
        content = '<h3>Automatic replies</h3>' + sw(this.s.autoReply.on, 'autoreply-toggle', 'x', 'x', 'Turn on automatic replies', 's-ar-toggle') + '<label for="s-ar-text">Message</label><textarea id="s-ar-text" class="inp" rows="4" data-t="s-ar-text">' + esc(this.s.autoReply.text) + '</textarea><button type="button" class="btn primary" data-act="ar-save" data-t="s-ar-save">Save</button>';
        break;
      case 'calview':
        content = '<h3>View</h3><label for="s-ws">Work hours start</label><select id="s-ws" class="inp" data-t="s-ws">' + this.hourOpts(c.workStart, 5, 11) + '</select><label for="s-we">Work hours end</label><select id="s-we" class="inp" data-t="s-we">' + this.hourOpts(c.workEnd, 14, 20) + '</select>';
        break;
      case 'events':
        content = '<h3>Events and invitations</h3>' + sw(c.showDeclined, 'setting', 'showDeclined', c.showDeclined ? 'false' : 'true', 'Show declined meetings on my calendar', 's-declined') + '<p class="muted">Preserving declined meetings is available in new Outlook; classic Outlook removes declined meetings from the calendar.</p>';
        break;
      default: content = '';
    }
    slots.bs.innerHTML = '<div class="dlg-scrim settings-scrim"><div class="dlg settings" role="dialog" aria-modal="true" aria-labelledby="set-title" data-dlg="settings"><div class="dlg-h"><h2 id="set-title">Settings</h2><button type="button" class="x" data-act="settings-close" aria-label="Close settings" data-t="settings-close">' + I('x', 14) + '</button></div><div class="set-body"><nav class="set-nav" aria-label="Settings categories">' + nav + '</nav><div class="set-content">' + content + '</div></div></div></div>';
    this.el.sim.classList.add('has-dialog');
    this.rendered();
  };

  /* ------------------------------------------------------- backstage (Classic) */
  S.openBackstage = function (page) {
    this.closeMenu();
    this.ui.backstage = { page: page || 'info' };
    this.emit('backstage-open', { page: page || 'info' });
    this.renderBackstage();
  };
  S.closeBackstage = function () {
    this.ui.backstage = null;
    if (this.dSlots) this.dSlots.bs.innerHTML = '';
    this.rendered();
    this.emit('backstage-close', {});
  };
  S.renderBackstage = function () {
    var bs = this.ui.backstage; if (!bs) return;
    var self = this, c = this.cfg(), slots = this.slots();
    var items = [['info', 'Info'], ['account', 'Office Account'], ['options', 'Options']];
    var nav = '<button type="button" class="bs-back" data-act="backstage-close" data-t="bs-back" aria-label="Back to Outlook">' + I('chev-left', 18) + '</button>' + items.map(function (i) {
      return '<button type="button" class="bs-n' + (bs.page === i[0] ? ' on' : '') + '" data-act="' + (i[0] === 'options' ? 'dialog' : 'backstage') + '" data-arg="' + (i[0] === 'options' ? 'options' : i[0]) + '" data-t="bs-' + i[0] + '">' + i[1] + '</button>';
    }).join('');
    var content = '';
    if (bs.page === 'info') {
      content = '<h2>Account Information</h2><p>' + esc(this.me().email) + '</p><div class="bs-cards">' +
        '<div class="bs-card"><button type="button" class="btn big" data-act="dialog" data-arg="autoreply" data-t="bs-autoreply">' + I('mail', 22) + '<span>Automatic Replies<br><small>Use automatic replies to notify others you are out of office.</small></span></button></div>' +
        '<div class="bs-card"><button type="button" class="btn big" data-act="dialog" data-arg="rules" data-t="bs-rules">' + I('filter', 22) + '<span>Manage Rules &amp; Alerts<br><small>Use rules to organize incoming mail.</small></span></button></div>' +
        '<div class="bs-card"><button type="button" class="btn big" data-act="dialog" data-arg="addins" data-t="bs-addins">' + I('puzzle', 22) + '<span>Manage Add-ins<br><small>Manage the add-ins that work with Outlook.</small></span></button></div></div>';
    } else if (bs.page === 'account') {
      content = '<h2>Office Account</h2><label for="bs-theme">Office Theme:</label><select id="bs-theme" class="inp" data-t="bs-theme">' + [['colorful', 'Colorful'], ['darkgray', 'Dark Gray'], ['black', 'Black'], ['white', 'White']].map(function (t) { return '<option value="' + t[0] + '"' + (c.officeTheme === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select>';
    }
    slots.bs.innerHTML = '<div class="backstage" role="dialog" aria-modal="true" aria-label="File menu"><nav class="bs-nav" aria-label="File">' + nav + '</nav><div class="bs-content">' + content + '</div></div>';
    this.rendered();
  };

  /* --------------------------------------------------------------- onChange */
  S.onChange = function (e) {
    var t = e.target, id = t.id;
    if (id === 's-undo') this.setSetting('undoSend', +t.value);
    else if (id === 's-ws') this.setSetting('workStart', +t.value);
    else if (id === 's-we') this.setSetting('workEnd', +t.value);
    else if (id === 'opt-ws') this.setSetting('workStart', +t.value);
    else if (id === 'opt-we') this.setSetting('workEnd', +t.value);
    else if (id === 'opt-theme' || id === 'bs-theme') this.setSetting('officeTheme', t.value);
    else if (id === 'ab-q') { var l = this.dq('#ab-list'); if (l) l.innerHTML = this.abRows(true, 'to', t.value); }
  };

  /* ------------------------------------------------------------- form acts */
  S.formAct = function (act, el, d) {
    var self = this, c, id;
    switch (act) {
      case 'compose-send': this.sendCompose(); return true;
      case 'compose-close': this.requestCloseCompose(); return true;
      case 'compose-save': this.saveDraft(false); this.closeCompose(); return true;
      case 'compose-discard': this.syncFromDom(); this.emit('compose-discard', {}); this.ui.compose = null; this.el.compose.innerHTML = ''; this.el.sim.classList.remove('has-compose'); this.render(); return true;
      case 'compose-tab': this.syncFromDom(); this.ui.compose.tab = d.arg; this.renderCompose(); return true;
      case 'compose-showcc': this.syncFromDom(); this.ui.compose.ccShown = true; this.renderCompose(); var cc = this.cq('#c-cc-input'); if (cc) cc.focus(); return true;
      case 'compose-importance': this.syncFromDom(); this.ui.compose.important = !this.ui.compose.important; this.renderCompose(); return true;
      case 'compose-signature': this.syncFromDom(); c = this.ui.compose; if (this.cfg().signature) { c.body = this.signatureText().replace(/^\n\n/, '') + '\n\n' + c.body; } else { this.toast('No signature is saved yet. Add one in File > Options > Mail > Signatures.'); } this.renderCompose(); return true;
      case 'compose-schedule': this.sendCompose({ schedule: d.arg }); return true;
      case 'schedule-menu': this.openMenu('schedule', this.root.querySelector('[data-t="c-send-arrow"]') || el, this.menuItems('schedule'), { label: 'Schedule send' }); return true;
      case 'delay-open': this.syncFromDom(); this.showDialog('delay', {}); return true;
      case 'undo-send': this.undoSend(d.id); return true;
      case 'attach-file': {
        var f = this.fileInfo(d.arg); if (!f || !this.ui.compose) { this.closeDialog(); return true; }
        this.syncFromDom();
        this.ui.compose.attachments.push({ id: 'att-' + this.nextId('a'), name: f.name, size: f.size, ext: f.name.split('.').pop().toLowerCase(), preview: f.preview });
        this.emit('attach-add', { name: f.name });
        if (this.ui.dialog) this.closeDialog();
        this.renderCompose();
        return true;
      }
      case 'attach-pick': this.syncFromDom(); this.showDialog('filepicker', { arg: d.arg }); return true;
      case 'attach-remove': this.syncFromDom(); this.ui.compose.attachments.splice(+d.i, 1); this.renderCompose(); return true;
      case 'rcpt-remove': this.syncFromDom(); this.F()[d.field].splice(+d.i, 1); this.refreshForm(); return true;
      case 'rcpt-pick': this.syncFromDom(); this.addRcpt(d.field, this.rcptFor(d.id)); this.refreshForm(); var ni = this.cq('#c-' + d.field + '-input'); if (ni) ni.focus(); return true;
      case 'ab-add': if (this.ui.compose || this.ui.evform) { this.syncFromDom(); this.addRcpt(d.field, this.rcptFor(d.id)); this.toast(this.name(d.id) + ' added to ' + (d.field === 'cc' ? 'Cc' : 'To') + '.'); this.emit('address-pick', { id: d.id, field: d.field }); } return true;
      case 'ab-mail': this.closeDialog(); this.openCompose({ kind: 'new', to: [d.id] }); return true;
      case 'ev-teams': this.syncFromDom(); this.ui.evform.teams = !this.ui.evform.teams; this.emit('event-teams', { on: this.ui.evform.teams }); this.renderEvForm(); return true;
      case 'ev-optional': this.syncFromDom(); this.ui.evform.optShown = true; this.renderEvForm(); var oi = this.cq('#c-opt-input'); if (oi) oi.focus(); return true;
      case 'ev-send': this.sendEvent(); return true;
      case 'dlg-confirm': { var pc = this.pendingConfirm; this.closeDialog(); if (pc && pc.onOk) pc.onOk(); return true; }
      case 'dlg-savechanges': this.closeDialog(); if (d.arg === 'save') { this.saveDraft(false); this.closeCompose(); } else { this.ui.compose = null; this.el.compose.innerHTML = ''; this.el.sim.classList.remove('has-compose'); this.render(); } return true;
      case 'dlg-submit': this.dialogSubmit(); return true;
      case 'rules-run': this.runRules(d.arg || null); this.refreshRules(); return true;
      case 'rule-toggle': { var r = this.s.rules.filter(function (x) { return x.id === d.arg; })[0]; if (r) { r.enabled = !r.enabled; this.emit('rule-toggle', { id: r.id, enabled: r.enabled }); } return true; }
      case 'rule-delete': this.s.rules = this.s.rules.filter(function (x) { return x.id !== d.arg; }); this.emit('rule-delete', { id: d.arg }); this.refreshRules(); return true;
      case 'addin-toggle': this.s.addins = this.s.addins || {}; this.s.addins[d.arg] = !this.s.addins[d.arg]; this.emit('addin-toggle', { id: d.arg, on: this.s.addins[d.arg] }); this.showDialog('addins', {}); return true;
      case 'opt-page': this.ui.optPage = d.arg; { var ob = this.dq('.dlg-b'); if (ob) ob.innerHTML = this.optionsHtml(d.arg); } return true;
      case 'sig-save': { var ta = this.dq('#s-sig'); this.setSetting('signature', ta ? ta.value : ''); this.toast('Signature saved.'); return true; }
      case 'autoreply-toggle': this.s.autoReply.on = !this.s.autoReply.on; this.emit('autoreply', { on: this.s.autoReply.on }); this.renderSettings(); return true;
      case 'ar-save': { var at = this.dq('#s-ar-text'); this.s.autoReply.text = at ? at.value : ''; this.emit('autoreply-save', { on: this.s.autoReply.on }); this.toast('Automatic replies saved.'); return true; }
    }
    return false;
  };

  S.refreshRules = function () {
    if (this.ui.dialog && this.ui.dialog.id === 'rules') { var b = this.dq('.dlg-b'); if (b) b.innerHTML = '<p class="muted">Classic Outlook manages rules in this dialog (Home > Rules > Manage Rules &amp; Alerts, or File > Info). Rules created in classic that run on your PC (client-side) may not run in new Outlook.</p>' + this.rulesList(); }
    if (this.ui.settings && this.ui.settings.page === 'rules') this.renderSettings();
  };

  S.dialogSubmit = function () {
    var dlg = this.ui.dialog; if (!dlg) return;
    var v = function (self, sel) { var n = self.dq(sel); return n ? n.value : ''; };
    var err = function (self, msg) { var e = self.dq('#dlg-err'); if (e) e.textContent = msg; };
    switch (dlg.id) {
      case 'newfolder': {
        var res = this.createFolder(v(this, '#dlg-name'), v(this, '#dlg-parent'));
        if (!res.ok) { err(this, res.error); this.emit('folder-create-error', { error: res.error }); return; }
        this.closeDialog(); break;
      }
      case 'rename':
        if (!this.renameFolder(dlg.data.id, v(this, '#dlg-name'))) { err(this, 'Type a name for the folder.'); return; }
        this.closeDialog(); break;
      case 'newrule': {
        var name = v(this, '#dlg-name').trim(), text = v(this, '#dlg-text').trim();
        if (!name || !text) { err(this, 'Give the rule a name and the text to look for.'); return; }
        this.addRule({ name: name, field: v(this, '#dlg-field'), text: text, moveTo: v(this, '#dlg-move') });
        this.closeDialog(); this.refreshRules(); break;
      }
      case 'saveas': {
        var sel = this.dq('input[name=sa-folder]:checked'), folder = sel ? sel.value : 'Documents';
        var sa = this._saveas; this.closeDialog();
        this.saveAttachment(sa.msgId, sa.attId, folder, 'saveas'); break;
      }
      case 'saveall': {
        var s2 = this.dq('input[name=sa-folder]:checked'), f2 = s2 ? s2.value : 'Documents', sa2 = this._saveas, self = this;
        this.closeDialog();
        this.msg(sa2.msgId).attachments.forEach(function (a) { self.s.downloads.push({ name: a.name, folder: f2 }); });
        this.emit('attachment-saveall', { msgId: sa2.msgId, folder: f2, how: 'saveas' });
        this.toast('Saved all attachments to ' + f2 + ' (simulated)');
        break;
      }
      case 'delay': {
        var on = this.dq('#dl-on') && this.dq('#dl-on').checked, c = this.ui.compose;
        var date = v(this, '#dl-date'), time = v(this, '#dl-time');
        var dt = U.parseLocal(date, time);
        if (c) { c.deliverAt = on && dt ? U.fmtShort(dt) + ' ' + U.fmtTime(dt) : null; }
        this.closeDialog();
        if (c) { this.renderCompose(); this.emit('delay-set', { on: !!c.deliverAt, label: c.deliverAt }); }
        break;
      }
      case 'rsvpedit': {
        var re = this._rsvpEdit; this.closeDialog(); this.rsvp(re.id, re.resp, true); break;
      }
      case 'autoreply': {
        var onR = this.dq('input[name=ar]:checked'); this.s.autoReply.on = !!onR && onR.value === 'on';
        this.s.autoReply.text = v(this, '#dlg-text');
        this.emit('autoreply-save', { on: this.s.autoReply.on }); this.closeDialog(); break;
      }
      case 'signature':
        this.setSetting('signature', v(this, '#dlg-text')); this.closeDialog(); break;
      case 'feedback':
        this.closeDialog(); this.toast('Thanks! (Simulated — nothing was sent.)'); this.emit('feedback-send', {}); break;
      default: this.closeDialog();
    }
  };

  /* Enter submits single-line dialogs */
  S.bindDialogKeys = function () {
    if (this._dlgKeys) return; this._dlgKeys = true;
    var self = this;
    this.el.dialog.addEventListener('keydown', function (e) {
      var t = e.target;
      if (e.key === 'Enter' && t.tagName === 'INPUT' && t.type !== 'checkbox' && t.type !== 'radio' && self.ui.dialog && t.id !== 'ab-q') { e.preventDefault(); self.dialogSubmit(); }
      if (e.key === 'Tab' && self.ui.dialog) {
        var box = self.dSlots.dlg.querySelector('.dlg'); if (!box) return;
        var f = U.$$('button:not([disabled]),input:not([disabled]),select,textarea,[tabindex="0"]', box);
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  };
  var _showDialog = S.showDialog;
  S.showDialog = function (id, d) { this.bindDialogKeys(); return _showDialog.call(this, id, d); };
})();
