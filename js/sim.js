/* ==========================================================================
   sim.js — Outlook simulator: state, model actions, menus, events
   The UI templates live in sim-ui.js and forms/dialogs in sim-forms.js; all
   three extend OT.Sim.prototype. Nothing here touches the network.
   Every user action emits `OT.bus.emit('sim', {type, ...})` so the lesson
   engine can validate what the learner really did.
   ========================================================================== */
(function () {
  'use strict';
  var OT = window.OT, U = OT.util, I = OT.icon;

  function Sim(root) {
    this.root = root;
    this.timers = [];
    this.build();
    this.reset({ mode: 'classic' });
  }
  OT.Sim = Sim;
  var S = Sim.prototype;

  /* ------------------------------------------------------------------ build */
  S.build = function () {
    var r = this.root;
    r.innerHTML =
      '<div class="sim" data-mode="classic">' +
      '<div class="sim-titlebar"></div>' +
      '<div class="sim-ribbonwrap"><div class="sim-ribbon"></div></div>' +
      '<div class="sim-body">' +
      '<nav class="sim-rail" aria-label="Apps"></nav>' +
      '<aside class="sim-folders" aria-label="Folder pane"></aside>' +
      '<main class="sim-main"></main>' +
      '<aside class="sim-side" aria-label="My Day"></aside>' +
      '<div class="sim-drawer-scrim" data-act="drawer-close"></div>' +
      '<div class="sim-compose-host"></div>' +
      '</div>' +
      '<div class="sim-status" role="status"></div>' +
      '<div class="sim-dialog-host"></div>' +
      '<div class="sim-menu-host"></div>' +
      '<div class="sim-toast-host" aria-live="polite"></div>' +
      '<div class="sim-callout-host"></div>' +
      '</div>';
    var q = function (c) { return r.querySelector(c); };
    this.el = {
      sim: q('.sim'), titlebar: q('.sim-titlebar'), ribbon: q('.sim-ribbon'), body: q('.sim-body'), rail: q('.sim-rail'),
      folders: q('.sim-folders'), main: q('.sim-main'), side: q('.sim-side'), compose: q('.sim-compose-host'),
      status: q('.sim-status'), dialog: q('.sim-dialog-host'), menu: q('.sim-menu-host'), toast: q('.sim-toast-host'),
      callout: q('.sim-callout-host')
    };
    this.bind();
  };

  S.bind = function () {
    var self = this, r = this.root;
    r.addEventListener('click', function (e) { self.onClick(e); });
    r.addEventListener('keydown', function (e) { self.onKey(e); });
    r.addEventListener('input', function (e) { self.onInput(e); });
    r.addEventListener('focusin', function (e) { self.onFocusIn(e); });
    r.addEventListener('change', function (e) { if (self.onChange) self.onChange(e); });
    r.addEventListener('contextmenu', function (e) { self.onContext(e); });
    r.addEventListener('dragstart', function (e) { self.onDragStart(e); });
    r.addEventListener('dragover', function (e) {
      var t = e.target.closest && e.target.closest('[data-drop]');
      if (t && self.dragId) { e.preventDefault(); t.classList.add('drop-over'); }
    });
    r.addEventListener('dragleave', function (e) {
      var t = e.target.closest && e.target.closest('[data-drop]');
      if (t) t.classList.remove('drop-over');
    });
    r.addEventListener('drop', function (e) { self.onDrop(e); });
    r.addEventListener('dragend', function () { self.dragId = null; U.$$('.drop-over', r).forEach(function (n) { n.classList.remove('drop-over'); }); });
    if (window.ResizeObserver) {
      this.ro = new ResizeObserver(function () { self.measure(); });
      this.ro.observe(r);
    } else {
      window.addEventListener('resize', function () { self.measure(); });
    }
  };

  S.measure = function () {
    var w = this.root.clientWidth || 0;
    var narrow = w > 0 && w < 760;
    if (narrow !== this.ui.narrow) {
      this.ui.narrow = narrow;
      this.el.sim.classList.toggle('narrow', narrow);
      this.render();
    }
    this.el.sim.classList.toggle('compact-w', w > 0 && w < 1000);
  };

  S.destroy = function () {
    this.clearTimers();
    if (this.ro) this.ro.disconnect();
    this.root.innerHTML = '';
  };

  S.clearTimers = function () {
    this.timers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
    this.timers = [];
  };
  S.later = function (fn, ms) {
    var self = this, id = setTimeout(function () {
      self.timers = self.timers.filter(function (t) { return t !== id; });
      fn();
    }, ms);
    this.timers.push(id);
    return id;
  };

  /* ------------------------------------------------------------------ state */
  S.reset = function (opts) {
    opts = opts || {};
    this.clearTimers();
    this.s = OT.data.create();
    this.clock = 0;
    var mode = opts.mode || 'classic';
    this.ui = {
      mode: mode, app: 'mail', tab: 'home', prevTab: 'home', folder: 'inbox', sel: null,
      search: { query: '', active: false, scope: 'folder', filters: { unread: false, attach: false, flagged: false, from: null, date: null }, tab: 'mail' },
      filter: 'all', sort: 'date', menu: null, dialog: null, settings: null, backstage: null,
      compose: null, evform: null, calView: 'workweek', calDate: new Date(2026, 9, 26), selEvent: null,
      expanded: { inbox: true }, pane: 'list', drawer: false, undoStack: [], myday: false,
      inlineFolder: null, renaming: null, peopleSel: null, peopleQuery: '', narrow: this.ui ? this.ui.narrow : false,
      syncing: false, pending: []
    };
    this.el.compose.innerHTML = '';
    this.el.dialog.innerHTML = '';
    this.el.menu.innerHTML = '';
    this.el.toast.innerHTML = '';
    this.el.sim.classList.remove('has-compose', 'has-dialog');
    if (typeof opts.setup === 'function') opts.setup(this);
    this.measure();
    this.render();
  };

  S.isNew = function () { return this.ui.mode === 'new'; };
  S.cfg = function () { return this.s.settings[this.ui.mode]; };
  S.msg = function (id) { for (var i = 0; i < this.s.messages.length; i++) if (this.s.messages[i].id === id) return this.s.messages[i]; return null; };
  S.folder = function (id) { for (var i = 0; i < this.s.folders.length; i++) if (this.s.folders[i].id === id) return this.s.folders[i]; return null; };
  S.contact = function (id) { return this.s.contacts[id] || null; };
  S.event = function (id) { for (var i = 0; i < this.s.events.length; i++) if (this.s.events[i].id === id) return this.s.events[i]; return null; };
  S.nextId = function (p) { this.s.seq += 1; return p + this.s.seq; };
  S.tick = function () { this.clock += 1; return OT.data.NOW + this.clock * 60000; };
  S.me = function () { return this.s.contacts[this.s.me]; };
  S.name = function (id) { var c = this.contact(id); return c ? c.name : String(id); };
  S.recipientName = function (r) { return typeof r === 'string' ? this.name(r) : r.name; };
  S.folderName = function (id) { var f = this.folder(id); return f ? f.name : id; };
  S.emit = function (type, data) {
    var ev = data || {}; ev.type = type;
    OT.bus.emit('sim', ev);
  };
  S.rendered = function () { OT.bus.emit('sim-rendered', { sim: this }); };
  S.isDark = function () {
    var c = this.cfg();
    return this.isNew() ? c.theme === 'dark' : (c.officeTheme === 'darkgray' || c.officeTheme === 'black');
  };

  S.folderMessages = function (fid) {
    var isNew = this.isNew();
    return this.s.messages.filter(function (m) {
      if (fid === 'snoozed') return !!m.snoozed;
      if (m.snoozed && isNew) return false;
      return m.folder === fid;
    });
  };
  S.unreadCount = function (fid) {
    return this.folderMessages(fid).filter(function (m) { return !m.read && !m.draft; }).length;
  };
  S.childFolders = function (pid) { return this.s.folders.filter(function (f) { return (f.parent || null) === (pid || null) && !f.sys; }); };
  S.allFoldersFlat = function () {
    var out = [], self = this;
    this.s.folders.filter(function (f) { return f.sys; }).forEach(function (f) {
      out.push({ f: f, depth: 0 });
      (function walk(pid, d) { self.childFolders(pid).forEach(function (c) { out.push({ f: c, depth: d }); walk(c.id, d + 1); }); })(f.id, 1);
    });
    return out;
  };

  S.matchesText = function (m, q) {
    var self = this;
    var hay = (m.subject + ' ' + this.name(m.from) + ' ' + ((this.contact(m.from) || {}).email || '') + ' ' +
      (m.to || []).map(function (r) { return self.recipientName(r); }).join(' ') + ' ' + U.stripHtml(m.body) + ' ' +
      m.attachments.map(function (a) { return a.name; }).join(' ')).toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every(function (t) { return hay.indexOf(t) !== -1; });
  };

  S.searchActive = function () {
    var s = this.ui.search, f = s.filters;
    return !!(s.query.trim() || f.unread || f.attach || f.flagged || f.from || f.date);
  };

  S.listMessages = function () {
    var ui = this.ui, self = this, sr = ui.search, list;
    if (this.searchActive()) {
      var pool = this.s.messages.filter(function (m) { return !m.draft || sr.scope === 'mailbox'; });
      if (sr.scope === 'folder') {
        var fm = this.folderMessages(ui.folder);
        pool = pool.filter(function (m) { return fm.indexOf(m) !== -1; });
      }
      var q = sr.query.trim(), f = sr.filters;
      list = pool.filter(function (m) {
        if (q && !self.matchesText(m, q)) return false;
        if (f.unread && m.read) return false;
        if (f.attach && !m.attachments.length) return false;
        if (f.flagged && !m.flag) return false;
        if (f.from && m.from !== f.from) return false;
        if (f.date === 'week' && m.date < OT.data.NOW - 7 * 86400000) return false;
        if (f.date === 'today' && !U.sameDay(new Date(m.date), new Date(OT.data.NOW))) return false;
        return true;
      });
    } else {
      list = this.folderMessages(ui.folder);
    }
    if (ui.filter === 'unread') list = list.filter(function (m) { return !m.read; });
    if (ui.filter === 'flagged') list = list.filter(function (m) { return !!m.flag; });
    if (ui.filter === 'attach') list = list.filter(function (m) { return m.attachments.length > 0; });
    var s = ui.sort;
    list = list.slice().sort(function (a, b) {
      if (s === 'from') return self.name(a.from).localeCompare(self.name(b.from)) || b.date - a.date;
      if (s === 'subject') return a.subject.localeCompare(b.subject) || b.date - a.date;
      if (s === 'importance') return (b.important ? 1 : 0) - (a.important ? 1 : 0) || b.date - a.date;
      if (s === 'attach') return (b.attachments.length ? 1 : 0) - (a.attachments.length ? 1 : 0) || b.date - a.date;
      return b.date - a.date;
    });
    if (this.isNew() && s === 'date') {
      list = list.filter(function (m) { return m.pinned; }).concat(list.filter(function (m) { return !m.pinned; }));
    }
    return list;
  };

  /* ---------------------------------------------------------------- actions */
  S.setMode = function (mode, variant) {
    if (mode === this.ui.mode) return;
    if (this.ui.compose || this.ui.evform) this.closeCompose(true);
    this.closeMenu();
    this.ui.dialog = null; this.el.dialog.innerHTML = ''; this.el.sim.classList.remove('has-dialog');
    this.ui.settings = null; this.ui.backstage = null;
    this.ui.mode = mode; this.ui.tab = 'home'; this.ui.myday = false;
    this.ui.search.active = false;
    this.ui.inlineFolder = null; this.ui.renaming = null;
    if (mode === 'classic' && this.ui.folder === 'snoozed') this.ui.folder = 'inbox';
    this.ui.drawer = false;
    this.emit('toggle-mode', { mode: mode, variant: variant || null });
    this.render();
  };

  S.gotoApp = function (app) {
    this.closeMenu();
    if (this.ui.compose || this.ui.evform) this.closeCompose(true);
    this.ui.app = app; this.ui.tab = 'home'; this.ui.pane = 'list'; this.ui.drawer = false;
    this.ui.search.active = false;
    this.emit('app', { app: app });
    this.render();
  };

  S.selectFolder = function (id) {
    this.ui.folder = id; this.ui.sel = null; this.ui.pane = 'list'; this.ui.drawer = false;
    this.ui.filter = 'all';
    this.emit('folder-select', { id: id });
    this.render();
  };

  S.openMessage = function (id) {
    var m = this.msg(id); if (!m) return;
    if (m.draft) { this.editDraft(id); return; }
    this.ui.sel = id; this.ui.pane = 'read';
    if (!m.read) m.read = true;
    this.emit('open-message', { id: id });
    this.render();
  };

  S.pushUndo = function (entry) { this.ui.undoStack.push(entry); if (this.ui.undoStack.length > 10) this.ui.undoStack.shift(); };

  S.deleteMessage = function (id) {
    var m = this.msg(id); if (!m) return;
    var from = m.folder;
    if (from === 'deleted') {
      var self = this;
      this.confirm({
        title: 'Permanently delete?', text: 'This message will be permanently deleted from Deleted Items.', ok: 'Delete', cancel: 'Cancel',
        onOk: function () {
          self.s.messages = self.s.messages.filter(function (x) { return x.id !== id; });
          if (self.ui.sel === id) self.ui.sel = null;
          self.emit('delete-permanent', { id: id });
          self.render();
        }
      });
      return;
    }
    m.folder = 'deleted'; m.snoozed = null;
    if (this.ui.sel === id) { this.ui.sel = null; this.ui.pane = 'list'; }
    this.pushUndo({ type: 'delete', id: id, from: from });
    this.emit('delete', { id: id, from: from });
    if (this.isNew()) this.toast('Conversation moved to Deleted Items', { action: { label: 'Undo', act: 'undo' }, ms: 8000 });
    this.render();
  };

  S.moveMessage = function (id, to, via) {
    var m = this.msg(id), f = this.folder(to); if (!m || !f) return;
    var from = m.folder;
    if (from === to) { this.toast('The message is already in ' + f.name + '.'); return; }
    m.folder = to; m.snoozed = null;
    if (this.ui.sel === id && this.ui.folder !== to) { this.ui.sel = null; this.ui.pane = 'list'; }
    this.pushUndo({ type: 'move', id: id, from: from, to: to });
    this.emit('move', { id: id, from: from, to: to, via: via || 'menu' });
    this.toast('Moved to ' + f.name, this.isNew() ? { action: { label: 'Undo', act: 'undo' }, ms: 6000 } : {});
    this.render();
  };

  S.undo = function () {
    var u = this.ui.undoStack.pop();
    if (!u) { this.toast('Nothing to undo.'); return; }
    var m = this.msg(u.id);
    if (m) m.folder = u.from;
    this.emit('undo', { what: u.type, id: u.id, restoredTo: u.from });
    this.toast('Restored to ' + this.folderName(u.from));
    this.render();
  };

  S.toggleFlag = function (id, value) {
    var m = this.msg(id); if (!m) return;
    if (value === undefined) value = m.flag ? false : 'flagged';
    m.flag = value || null;
    this.emit('flag', { id: id, value: m.flag || false });
    this.render();
  };
  S.setRead = function (id, read) {
    var m = this.msg(id); if (!m) return;
    m.read = read;
    this.emit('read', { id: id, read: read });
    this.render();
  };
  S.togglePin = function (id) {
    var m = this.msg(id); if (!m) return;
    m.pinned = !m.pinned;
    this.emit('pin', { id: id, pinned: m.pinned });
    this.render();
  };
  S.setCategory = function (id, cat) {
    var m = this.msg(id); if (!m) return;
    m.category = cat || null;
    this.emit('category', { id: id, category: m.category });
    this.render();
  };
  S.snooze = function (id, label) {
    var m = this.msg(id); if (!m) return;
    m.snoozed = label;
    if (this.ui.sel === id) { this.ui.sel = null; this.ui.pane = 'list'; }
    this.emit('snooze', { id: id, until: label });
    this.toast('Snoozed until ' + label, { action: { label: 'Undo', act: 'unsnooze', id: id }, ms: 6000 });
    this.render();
  };
  S.unsnooze = function (id) {
    var m = this.msg(id); if (!m) return;
    m.snoozed = null;
    this.emit('unsnooze', { id: id });
    this.render();
  };
  S.sweep = function (id, action) {
    var m = this.msg(id); if (!m) return;
    var sender = m.from, self = this, n = 0;
    this.s.messages.forEach(function (x) {
      if (x.folder === 'inbox' && x.from === sender) { x.folder = action === 'delete' ? 'deleted' : 'archive'; n += 1; }
    });
    if (this.ui.sel && this.msg(this.ui.sel).folder !== this.ui.folder) this.ui.sel = null;
    this.emit('sweep', { id: id, action: action, count: n, sender: sender });
    this.toast('Swept ' + U.plural(n, 'message') + ' from ' + self.name(sender));
    this.render();
  };
  S.quickStepDone = function (id) {
    var m = this.msg(id); if (!m) return;
    m.read = true; m.folder = 'archive';
    if (this.ui.sel === id) { this.ui.sel = null; this.ui.pane = 'list'; }
    this.emit('quickstep', { name: 'Done', id: id });
    this.toast('Quick Step "Done": marked as read and moved to Archive');
    this.render();
  };
  S.markAllRead = function (fid) {
    var n = 0;
    this.folderMessages(fid).forEach(function (m) { if (!m.read) { m.read = true; n += 1; } });
    this.emit('mark-all-read', { folder: fid, count: n });
    this.toast(n ? 'Marked ' + U.plural(n, 'message') + ' as read' : 'Nothing to mark as read');
    this.render();
  };

  /* folders */
  S.createFolder = function (name, parent) {
    name = String(name || '').trim();
    if (!name) return { ok: false, error: 'Type a name for the new folder.' };
    var par = parent || 'inbox';
    var dup = this.s.folders.some(function (f) { return !f.sys && (f.parent || 'inbox') === par && f.name.toLowerCase() === name.toLowerCase(); });
    if (dup) return { ok: false, error: 'A folder with that name already exists. Use a different name.' };
    var id = 'f-' + this.nextId('c');
    this.s.folders.push({ id: id, name: name, parent: par });
    this.ui.expanded[par] = true;
    this.ui.drawer = false;
    this.ui.inlineFolder = null;
    this.emit('folder-create', { id: id, name: name, parent: par });
    this.render();
    return { ok: true, id: id };
  };
  S.renameFolder = function (id, name) {
    var f = this.folder(id); name = String(name || '').trim();
    if (!f || f.sys || !name) return false;
    f.name = name;
    this.emit('folder-rename', { id: id, name: name });
    this.render();
    return true;
  };
  S.deleteFolder = function (id) {
    var f = this.folder(id); if (!f || f.sys) return;
    var self = this;
    var ids = [id];
    (function walk(pid) { self.childFolders(pid).forEach(function (c) { ids.push(c.id); walk(c.id); }); })(id);
    this.s.messages.forEach(function (m) { if (ids.indexOf(m.folder) !== -1) m.folder = 'deleted'; });
    this.s.folders = this.s.folders.filter(function (x) { return ids.indexOf(x.id) === -1; });
    if (ids.indexOf(this.ui.folder) !== -1) { this.ui.folder = 'inbox'; this.ui.sel = null; }
    this.emit('folder-delete', { id: id });
    this.toast('Folder deleted. Its messages were moved to Deleted Items.');
    this.render();
  };

  /* search */
  S.runSearch = function (query) {
    this.ui.search.query = query; this.ui.search.active = true;
    this.emit('search', { query: query.trim(), scope: this.ui.search.scope });
    this.render();
  };
  S.setSearchFilter = function (key, value) {
    var f = this.ui.search.filters;
    f[key] = value;
    this.ui.search.active = true;
    this.emit('filter', { key: key, value: value });
    this.render();
  };
  S.closeSearch = function () {
    var s = this.ui.search;
    s.query = ''; s.active = false; s.tab = 'mail';
    s.filters = { unread: false, attach: false, flagged: false, from: null, date: null };
    if (this.ui.tab === 'search') this.ui.tab = this.ui.prevTab || 'home';
    this.emit('search-close', {});
    this.render();
  };
  S.setSearchScope = function (scope) {
    this.ui.search.scope = scope; this.ui.search.active = true;
    this.emit('search-scope', { scope: scope });
    this.render();
  };

  /* calendar */
  S.rsvp = function (eventId, resp, send) {
    var ev = this.event(eventId); if (!ev) return;
    ev.status = resp;
    ev.attendees.forEach(function (a) { if (a.id === 'jordan') a.resp = resp; });
    this.emit('rsvp', { id: eventId, resp: resp, send: send !== false });
    var msgs = { accepted: 'You accepted "' + ev.title + '".', tentative: 'You responded Tentative to "' + ev.title + '".', declined: 'You declined "' + ev.title + '".' };
    this.toast(msgs[resp] + (send === false ? ' No response was sent.' : ''));
    this.render();
  };
  S.deleteEvent = function (id) {
    var ev = this.event(id); if (!ev) return;
    this.s.events = this.s.events.filter(function (e) { return e.id !== id; });
    this.ui.selEvent = null;
    this.emit('event-delete', { id: id });
    this.toast('"' + ev.title + '" was removed from your calendar.');
    this.closeMenu();
    this.render();
  };
  S.calNav = function (dir) {
    var d = new Date(this.ui.calDate);
    var step = this.ui.calView === 'day' ? 1 : 7;
    d.setDate(d.getDate() + dir * step);
    this.ui.calDate = d;
    this.emit('cal-nav', { dir: dir });
    this.render();
  };
  S.calToday = function () {
    this.ui.calDate = new Date(2026, 9, 26);
    this.emit('cal-today', {});
    this.render();
  };
  S.setCalView = function (v) {
    this.ui.calView = v;
    this.emit('cal-view', { view: v });
    this.render();
  };

  /* rules */
  S.addRule = function (r) {
    var rule = { id: this.nextId('rule'), name: r.name, field: r.field, text: r.text, moveTo: r.moveTo, enabled: true };
    this.s.rules.push(rule);
    this.emit('rule-create', { rule: rule });
    this.render();
    return rule;
  };
  S.runRules = function (ruleId) {
    var self = this, moved = 0;
    this.s.rules.filter(function (r) { return r.enabled && (!ruleId || r.id === ruleId); }).forEach(function (r) {
      self.s.messages.forEach(function (m) {
        if (m.folder !== 'inbox') return;
        var hay = r.field === 'from' ? (self.name(m.from) + ' ' + ((self.contact(m.from) || {}).email || '')) : m.subject;
        if (hay.toLowerCase().indexOf(String(r.text).toLowerCase()) !== -1) { m.folder = r.moveTo; moved += 1; }
      });
    });
    this.emit('rule-run', { moved: moved });
    this.toast(moved ? 'Rule ran: moved ' + U.plural(moved, 'message') : 'Rule ran: no matching messages in the Inbox.');
    this.render();
  };

  S.sync = function () {
    var self = this;
    if (this.ui.syncing) return;
    this.ui.syncing = true;
    this.emit('sync', {});
    this.renderStatus();
    this.later(function () {
      self.ui.syncing = false;
      self.renderStatus();
      self.toast('All folders are up to date.');
    }, 900);
  };

  S.setSetting = function (key, value) {
    var c = this.cfg();
    c[key] = value;
    this.emit('setting', { key: key, value: value, scope: this.ui.mode });
    this.render();
  };

  /* -------------------------------------------------------------- menus/toast */
  S.toast = function (text, opts) {
    opts = opts || {};
    var host = this.el.toast, self = this;
    var div = document.createElement('div');
    div.className = 'toast';
    div.innerHTML = '<span>' + U.esc(text) + '</span>' +
      (opts.action ? '<button type="button" class="toast-btn" data-act="' + opts.action.act + '"' + (opts.action.id ? ' data-id="' + opts.action.id + '"' : '') + ' data-t="toast-' + opts.action.act + '">' + U.esc(opts.action.label) + '</button>' : '');
    host.innerHTML = '';
    host.appendChild(div);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(function () { if (div.parentNode) div.parentNode.removeChild(div); }, opts.ms || 3500);
    this.timers.push(this.toastTimer);
    this.rendered();
    return div;
  };

  S.closeMenu = function () {
    if (!this.ui.menu) return;
    var anchor = this.ui.menu.anchor;
    this.ui.menu = null;
    this.el.menu.innerHTML = '';
    if (anchor && anchor.setAttribute) anchor.setAttribute('aria-expanded', 'false');
    this._lastClosed = anchor;
    this.rendered();
  };

  S.openMenu = function (id, anchor, items, opts) {
    opts = opts || {};
    this.closeMenu();
    var host = this.el.menu, root = this.el.sim.getBoundingClientRect();
    var html = '<div class="sim-menu" role="menu" aria-label="' + U.esc(opts.label || id) + '" data-menu-id="' + id + '">';
    items.forEach(function (it) {
      if (it.sep) { html += '<div class="mi-sep" role="separator"></div>'; return; }
      if (it.hdr) { html += '<div class="mi-hdr">' + U.esc(it.hdr) + '</div>'; return; }
      html += '<button type="button" role="menuitem' + (it.checked !== undefined ? 'radio' : '') + '"' +
        (it.checked !== undefined ? ' aria-checked="' + (it.checked ? 'true' : 'false') + '"' : '') +
        ' class="mi' + (it.disabled ? ' is-disabled' : '') + '" data-act="' + (it.act || 'noop') + '"' +
        (it.arg !== undefined ? ' data-arg="' + U.esc(it.arg) + '"' : '') +
        (it.arg2 !== undefined ? ' data-arg2="' + U.esc(it.arg2) + '"' : '') +
        (it.id !== undefined ? ' data-id="' + U.esc(it.id) + '"' : '') +
        (it.t ? ' data-t="' + it.t + '"' : '') + (it.disabled ? ' aria-disabled="true"' : '') + '>' +
        '<span class="mi-ic">' + (it.checked ? I('check', 14) : (it.icon ? I(it.icon, 14) : '')) + '</span>' +
        '<span class="mi-l" style="padding-left:' + ((it.depth || 0) * 12) + 'px">' + U.esc(it.label) + '</span></button>';
    });
    html += '</div>';
    host.innerHTML = html;
    var menu = host.firstChild;
    var x, y;
    if (opts.at) { x = opts.at.x - root.left; y = opts.at.y - root.top; }
    else {
      var r = anchor.getBoundingClientRect();
      x = r.left - root.left; y = r.bottom - root.top + 2;
    }
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
    var mw = menu.offsetWidth, mh = menu.offsetHeight;
    if (x + mw > root.width - 6) menu.style.left = Math.max(6, root.width - mw - 6) + 'px';
    if (y + mh > root.height - 6) menu.style.top = Math.max(6, (opts.at ? y - mh : (anchor.getBoundingClientRect().top - root.top) - mh - 2)) + 'px';
    this.ui.menu = { id: id, anchor: anchor || null };
    if (anchor && anchor.setAttribute) anchor.setAttribute('aria-expanded', 'true');
    var first = menu.querySelector('.mi:not(.is-disabled)');
    if (first && !opts.noFocus) first.focus();
    this.emit('menu-open', { id: id });
    this.rendered();
  };

  S.menuItems = function (id, d) {
    var self = this, ui = this.ui, m = ui.sel ? this.msg(ui.sel) : null, items = [];
    var folders = function (act, exclude, tp) {
      var out = [];
      self.allFoldersFlat().forEach(function (o) {
        if (o.f.id === 'outbox' || o.f.id === exclude) return;
        out.push({ label: o.f.name, act: act, arg: o.f.id, depth: o.depth, icon: 'folder', t: (tp || 'mv-') + o.f.id });
      });
      return out;
    };
    switch (id) {
      case 'new-items':
        return [{ label: 'E-mail Message', act: 'compose-new', icon: 'mail', t: 'mi-newmail' }, { label: 'Meeting', act: 'event-new', icon: 'calendar-add', t: 'mi-newmeeting' }];
      case 'new-mail-arrow':
        return [{ label: 'New mail', act: 'compose-new', icon: 'mail', t: 'mi-newmail' }, { label: 'New event', act: 'event-new', icon: 'calendar-add', t: 'mi-newevent' }];
      case 'move':
        return [{ hdr: 'Move to folder' }].concat(folders('move-to', m ? m.folder : null));
      case 'rules':
        return this.isNew()
          ? [{ label: 'Create rule…', act: 'rule-from-msg', icon: 'filter', t: 'mi-createrule' }, { label: 'Manage rules', act: 'settings-open', arg: 'mail', arg2: 'rules', icon: 'gear', t: 'mi-managerules' }]
          : [{ label: 'Always Move Messages From: sender', act: 'rule-from-msg', icon: 'move', t: 'mi-createrule' }, { sep: true }, { label: 'Manage Rules & Alerts…', act: 'dialog', arg: 'rules', icon: 'gear', t: 'mi-managerules' }];
      case 'categorize':
        var cats = [['red', 'Red category'], ['orange', 'Orange category'], ['green', 'Green category'], ['blue', 'Blue category'], ['purple', 'Purple category']];
        return cats.map(function (c) { return { label: c[1], act: 'categorize', arg: c[0], checked: m && m.category === c[0] ? true : undefined, t: 'cat-' + c[0] }; }).concat([{ sep: true }, { label: 'Clear all categories', act: 'categorize', arg: '', t: 'cat-clear' }]);
      case 'followup':
        return [{ label: 'Today', act: 'flag-set', arg: 'flagged', t: 'fu-today' }, { label: 'Tomorrow', act: 'flag-set', arg: 'flagged' }, { label: 'This Week', act: 'flag-set', arg: 'flagged' }, { label: 'Next Week', act: 'flag-set', arg: 'flagged' }, { label: 'No Date', act: 'flag-set', arg: 'flagged' }, { sep: true }, { label: 'Mark Complete', act: 'flag-set', arg: 'complete', t: 'fu-complete' }, { label: 'Clear Flag', act: 'flag-set', arg: '', t: 'fu-clear' }];
      case 'snooze':
        return [{ hdr: 'Snooze until' }, { label: 'Later today (4:00 PM)', act: 'snooze', arg: 'Today 4:00 PM', t: 'sn-later' }, { label: 'Tomorrow (8:00 AM)', act: 'snooze', arg: 'Tomorrow 8:00 AM', t: 'sn-tomorrow' }, { label: 'This weekend (Sat 9:00 AM)', act: 'snooze', arg: 'Sat 9:00 AM' }, { label: 'Next week (Mon 8:00 AM)', act: 'snooze', arg: 'Mon, Nov 2 8:00 AM' }];
      case 'sweep':
        var sn = m ? this.name(m.from) : 'sender';
        return [{ hdr: 'Sweep messages from ' + sn }, { label: 'Move all from ' + sn + ' to Archive', act: 'sweep', arg: 'archive', t: 'sw-archive' }, { label: 'Delete all from ' + sn, act: 'sweep', arg: 'delete', t: 'sw-delete' }];
      case 'quicksteps':
        return [{ label: 'Done — mark read & move to Archive', act: 'quickstep-done', icon: 'check', t: 'qs-done' }];
      case 'sort':
        var cur = ui.sort;
        return [['date', 'Date'], ['from', 'From'], ['subject', 'Subject'], ['importance', 'Importance'], ['attach', 'Attachments']].map(function (s) { return { label: s[1], act: 'list-sort', arg: s[0], checked: cur === s[0], t: 'sort-' + s[0] }; });
      case 'list-filter':
        return [['all', 'All'], ['unread', 'Unread'], ['flagged', 'Flagged'], ['attach', 'Has files']].map(function (s) { return { label: s[1], act: 'list-filter', arg: s[0], checked: ui.filter === s[0], t: 'lf-' + s[0] }; }).concat([{ sep: true }, { hdr: 'Sort by' }]).concat([['date', 'Date'], ['from', 'From'], ['subject', 'Subject'], ['importance', 'Importance']].map(function (s) { return { label: s[1], act: 'list-sort', arg: s[0], checked: ui.sort === s[0], t: 'sort-' + s[0] }; }));
      case 'changeview':
        return [['compact', 'Compact'], ['cozy', 'Single'], ['roomy', 'Preview']].map(function (s) { return { label: s[1], act: 'setting', arg: 'density', arg2: s[0], checked: self.cfg().density === s[0], t: 'cv-' + s[0] }; });
      case 'density':
        return [['roomy', 'Roomy'], ['cozy', 'Cozy'], ['compact', 'Compact']].map(function (s) { return { label: s[1], act: 'setting', arg: 'density', arg2: s[0], checked: self.cfg().density === s[0], t: 'dn-' + s[0] }; });
      case 'reading':
        return [['right', this.isNew() ? 'Show on the right' : 'Right'], ['bottom', this.isNew() ? 'Show on the bottom' : 'Bottom'], ['off', this.isNew() ? 'Hide' : 'Off']].map(function (s) { return { label: s[1], act: 'setting', arg: 'reading', arg2: s[0], checked: self.cfg().reading === s[0], t: 'rp-' + s[0] }; });
      case 'view-layout':
        return [{ hdr: 'Reading pane' }].concat(this.menuItems('reading')).concat([{ sep: true }, { hdr: 'Folder pane' }, { label: 'Show folder pane', act: 'setting', arg: 'folderPane', arg2: 'true', checked: self.cfg().folderPane, t: 'fp-show' }, { label: 'Hide folder pane', act: 'setting', arg: 'folderPane', arg2: 'false', checked: !self.cfg().folderPane, t: 'fp-hide' }]);
      case 'folderpane':
        return [{ label: 'Normal', act: 'setting', arg: 'folderPane', arg2: 'true', checked: self.cfg().folderPane, t: 'fp-show' }, { label: 'Off', act: 'setting', arg: 'folderPane', arg2: 'false', checked: !self.cfg().folderPane, t: 'fp-hide' }];
      case 'mode-new':
        return [{ hdr: 'Switch to the classic app' }, { label: 'Switch back to classic Outlook', act: 'toggle-mode', arg: 'classic', arg2: 'switch', t: 'mode-switchback' }, { label: 'Use classic Outlook this time', act: 'toggle-mode', arg: 'classic', arg2: 'once', t: 'mode-once' }];
      case 'msg-context':
        var mm = this.msg(d.id);
        var ctx = [{ label: 'Reply', act: 'reply', id: d.id, icon: 'reply' }, { label: 'Reply all', act: 'replyall', id: d.id, icon: 'reply-all' }, { label: 'Forward', act: 'forward', id: d.id, icon: 'forward' }, { sep: true }, { label: mm && mm.read ? 'Mark as unread' : 'Mark as read', act: 'read-toggle', id: d.id }, { label: mm && mm.flag ? 'Clear flag' : 'Flag', act: 'flag-toggle', id: d.id, icon: 'flag' }];
        if (this.isNew()) ctx.push({ label: mm && mm.pinned ? 'Unpin' : 'Pin', act: 'pin', id: d.id, icon: 'pin' });
        ctx.push({ sep: true }, { hdr: 'Move to' });
        folders('move-ctx', mm ? mm.folder : null, 'mc-').forEach(function (f) { f.id = d.id; ctx.push(f); });
        ctx.push({ sep: true }, { label: 'Delete', act: 'delete', id: d.id, icon: 'trash', t: 'ctx-delete' });
        return ctx;
      case 'folder-context':
        var f = this.folder(d.id), fi = [];
        fi.push({ label: this.isNew() ? 'Create new subfolder' : 'New Folder…', act: 'folder-new', arg: d.id, icon: 'folder-plus', t: 'ctx-newfolder' });
        if (f && !f.sys) fi.push({ label: 'Rename', act: 'folder-rename-start', arg: d.id }, { label: 'Delete folder', act: 'folder-delete', arg: d.id, icon: 'trash' });
        fi.push({ sep: true }, { label: 'Mark all as read', act: 'mark-all-read', arg: d.id });
        return fi;
      case 'rsvp-classic':
        return [{ label: 'Edit the Response before Sending', act: 'rsvp', id: d.id, arg: d.resp, arg2: 'edit', t: 'rs-edit' }, { label: 'Send the Response Now', act: 'rsvp', id: d.id, arg: d.resp, arg2: 'send', t: 'rs-send' }, { label: 'Do not Send a Response', act: 'rsvp', id: d.id, arg: d.resp, arg2: 'none', t: 'rs-none' }];
      case 'rsvp-new':
        return [{ label: 'Edit response', act: 'rsvp', id: d.id, arg: d.resp, arg2: 'edit', t: 'rs-edit' }, { label: "Don't send a response", act: 'rsvp', id: d.id, arg: d.resp, arg2: 'none', t: 'rs-none' }];
      case 'att':
        var mt = this.msg(d.id), at = mt && mt.attachments.filter(function (a) { return a.id === d.arg; })[0];
        var list = [{ label: 'Preview', act: 'att-preview', id: d.id, arg: d.arg, icon: 'eye', t: 'att-preview' }];
        if (this.isNew()) list.push({ label: 'Download', act: 'att-download', id: d.id, arg: d.arg, icon: 'download', t: 'att-download' });
        else list.push({ label: 'Save As…', act: 'att-saveas', id: d.id, arg: d.arg, icon: 'download', t: 'att-saveas' });
        if (at && mt.attachments.length > 1) list.push(this.isNew() ? { label: 'Download all', act: 'att-all', id: d.id, icon: 'download', t: 'att-all' } : { label: 'Save All Attachments…', act: 'att-all', id: d.id, icon: 'download', t: 'att-all' });
        return list;
      case 'search-scope':
        return [{ label: 'Current Folder', act: 'search-scope', arg: 'folder', checked: ui.search.scope === 'folder', t: 'ss-folder' }, { label: 'Current Mailbox', act: 'search-scope', arg: 'mailbox', checked: ui.search.scope === 'mailbox', t: 'ss-mailbox' }];
      case 'search-scope-new':
        return [{ label: 'Current folder', act: 'search-scope', arg: 'folder', checked: ui.search.scope === 'folder', t: 'ss-folder' }, { label: 'All folders', act: 'search-scope', arg: 'mailbox', checked: ui.search.scope === 'mailbox', t: 'ss-mailbox' }];
      case 'search-from':
        var seen = {}, out = [{ label: 'Any sender', act: 'search-filter', arg: 'from', arg2: '', t: 'sf-any' }];
        this.s.messages.forEach(function (x) { if (x.folder !== 'sent' && x.from !== 'jordan' && !seen[x.from]) { seen[x.from] = 1; out.push({ label: self.name(x.from), act: 'search-filter', arg: 'from', arg2: x.from, checked: ui.search.filters.from === x.from ? true : undefined, t: 'sf-' + x.from }); } });
        return out;
      case 'search-date':
        return [{ label: 'Any time', act: 'search-filter', arg: 'date', arg2: '' }, { label: 'Today', act: 'search-filter', arg: 'date', arg2: 'today' }, { label: 'This week', act: 'search-filter', arg: 'date', arg2: 'week', t: 'sd-week' }];
      case 'cal-views':
        return [['day', 'Day'], ['workweek', 'Work week'], ['week', 'Week']].map(function (s) { return { label: s[1], act: 'cal-view', arg: s[0], checked: ui.calView === s[0], t: 'cv-' + s[0] }; });
      case 'sendarrow':
        return [{ label: 'Send', act: 'compose-send', icon: 'send' }, { label: 'Schedule send', act: 'schedule-menu', icon: 'clock', t: 'mi-schedule' }];
      case 'schedule':
        return [{ hdr: 'Schedule send' }, { label: 'Tomorrow morning (Tue 8:00 AM)', act: 'compose-schedule', arg: 'Tue, Oct 27 8:00 AM', t: 'sch-tomorrow' }, { label: 'Tomorrow afternoon (Tue 1:00 PM)', act: 'compose-schedule', arg: 'Tue, Oct 27 1:00 PM' }, { label: 'Monday morning (Mon, Nov 2 8:00 AM)', act: 'compose-schedule', arg: 'Mon, Nov 2 8:00 AM' }];
      case 'attach-menu':
        return this.isNew()
          ? [{ label: 'Browse this computer', act: 'attach-pick', arg: 'computer', icon: 'folder', t: 'at-computer' }, { label: 'Browse cloud locations', act: 'attach-pick', arg: 'cloud', icon: 'link', t: 'at-cloud' }, { sep: true }, { hdr: 'Recent files' }].concat(this.s.files.slice(0, 3).map(function (f) { return { label: f.name, act: 'attach-file', arg: f.id, icon: 'file', t: 'at-recent-' + f.id }; }))
          : [{ hdr: 'Recent Items' }].concat(this.s.files.slice(0, 3).map(function (f) { return { label: f.name, act: 'attach-file', arg: f.id, icon: 'file', t: 'at-recent-' + f.id }; })).concat([{ sep: true }, { label: 'Browse This PC…', act: 'attach-pick', arg: 'computer', icon: 'folder', t: 'at-computer' }, { label: 'Browse Web Locations', act: 'attach-pick', arg: 'cloud', icon: 'link', t: 'at-cloud' }]);
      case 'help-new':
        return [];
      default:
        return [];
    }
  };

  /* --------------------------------------------------------------- confirm */
  S.confirm = function (o) {
    this.pendingConfirm = o;
    this.showDialog('confirm', { title: o.title, text: o.text, ok: o.ok || 'OK', cancel: o.cancel || 'Cancel' });
  };

  /* ---------------------------------------------------------------- events */
  S.onClick = function (e) {
    var t = e.target;
    if (!t.closest) return;
    var actEl = t.closest('[data-act]');
    var tEl = t.closest('[data-t]');
    if (this.ui.menu && !t.closest('.sim-menu')) {
      var openAnchor = this.ui.menu.anchor;
      this.closeMenu();
      if (actEl && actEl === openAnchor && actEl.dataset.act === 'menu') { this.emitClickTarget(tEl); return; }
    }
    if (tEl) this.emitClickTarget(tEl);
    if (!actEl) return;
    if (actEl.getAttribute('aria-disabled') === 'true' && !actEl.classList.contains('soft')) { return; }
    var wasMenu = !!actEl.closest('.sim-menu'), before = this.ui.menu;
    this.dispatch(actEl.dataset.act, actEl, e);
    if (wasMenu && this.ui.menu === before) this.closeMenu();
  };
  S.emitClickTarget = function (tEl) {
    if (tEl && tEl.dataset && tEl.dataset.t) this.emit('click-target', { key: tEl.dataset.t });
  };

  S.needMsg = function () {
    if (this.ui.sel && this.msg(this.ui.sel)) return this.ui.sel;
    this.toast('Select a message first.');
    return null;
  };

  S.dispatch = function (act, el, ev) {
    var d = el.dataset || {}, id, self = this;
    switch (act) {
      case 'noop': break;
      case 'menu': this.openMenu(d.menu, el, this.menuItems(d.menu, d), { label: d.label || d.menu }); break;
      case 'toggle-mode':
        if (d.arg) this.setMode(d.arg, d.arg2);
        else if (this.isNew()) this.openMenu('mode-new', el, this.menuItems('mode-new', d), { label: 'Switch to classic Outlook' });
        else this.setMode('new');
        break;
      case 'app': this.gotoApp(d.arg); break;
      case 'tab':
        if (d.arg === 'file') { this.openBackstage('info'); break; }
        this.ui.tab = d.arg; this.ui.prevTab = d.arg === 'search' ? this.ui.prevTab : d.arg;
        this.emit('ribbon-tab', { tab: d.arg }); this.render(); break;
      case 'ribbon-style':
        this.s.settings['new'].ribbon = this.s.settings['new'].ribbon === 'simplified' ? 'classic' : 'simplified';
        this.emit('ribbon-style', { style: this.s.settings['new'].ribbon }); this.render(); break;
      case 'folder': this.selectFolder(d.arg); break;
      case 'folder-toggle': this.ui.expanded[d.arg] = !this.ui.expanded[d.arg]; this.render(); break;
      case 'folder-new':
        if (this.isNew()) { this.ui.inlineFolder = d.arg || 'inbox'; this.ui.expanded[d.arg || 'inbox'] = true; this.ui.drawer = false; this.render(); var inp = this.root.querySelector('#sim-newfolder'); if (inp) inp.focus(); this.emit('folder-new-start', {}); }
        else this.showDialog('newfolder', { parent: d.arg && this.folder(d.arg) ? d.arg : this.ui.folder });
        break;
      case 'folder-rename-start':
        if (this.isNew()) { this.ui.renaming = d.arg; this.render(); var ri = this.root.querySelector('#sim-rename'); if (ri) { ri.focus(); ri.select(); } }
        else this.showDialog('rename', { id: d.arg });
        break;
      case 'folder-delete': this.deleteFolder(d.arg); break;
      case 'mark-all-read': this.markAllRead(d.arg || this.ui.folder); break;
      case 'drawer': this.ui.drawer = !this.ui.drawer; this.render(); break;
      case 'drawer-close': this.ui.drawer = false; this.render(); break;
      case 'open': this.openMessage(d.id); break;
      case 'back': this.ui.pane = 'list'; this.render(); break;
      case 'delete': id = d.id || this.needMsg(); if (id) this.deleteMessage(id); break;
      case 'archive': id = d.id || this.needMsg(); if (id) this.moveMessage(id, 'archive', 'archive'); break;
      case 'junk': id = d.id || this.needMsg(); if (id) this.moveMessage(id, 'junk', 'junk'); break;
      case 'undo': this.undo(); break;
      case 'unsnooze': this.unsnooze(d.id); break;
      case 'move-to': id = this.needMsg(); if (id) this.moveMessage(id, d.arg, 'menu'); break;
      case 'move-ctx': this.moveMessage(d.id, d.arg, 'context'); break;
      case 'flag-toggle': id = d.id || this.needMsg(); if (id) this.toggleFlag(id); break;
      case 'flag-set': id = this.needMsg(); if (id) this.toggleFlag(id, d.arg === '' ? false : d.arg); break;
      case 'read-toggle':
        id = d.id || this.needMsg();
        if (id) this.setRead(id, !this.msg(id).read);
        break;
      case 'pin': id = d.id || this.needMsg(); if (id) this.togglePin(id); break;
      case 'categorize': id = this.needMsg(); if (id) this.setCategory(id, d.arg); break;
      case 'snooze': id = this.needMsg(); if (id) this.snooze(id, d.arg); break;
      case 'sweep': id = this.needMsg(); if (id) this.sweep(id, d.arg); break;
      case 'quickstep-done': id = this.needMsg(); if (id) this.quickStepDone(id); break;
      case 'reply': id = d.id || this.needMsg(); if (id) this.openCompose({ kind: 'reply', source: id }); break;
      case 'replyall': id = d.id || this.needMsg(); if (id) this.openCompose({ kind: 'replyall', source: id }); break;
      case 'forward': id = d.id || this.needMsg(); if (id) this.openCompose({ kind: 'forward', source: id }); break;
      case 'compose-new': this.openCompose({ kind: 'new', to: d.arg ? [d.arg] : [] }); break;
      case 'event-new': this.openEventForm({ attendees: d.arg ? [d.arg] : [] }); break;
      case 'list-filter': this.ui.filter = d.arg; this.emit('list-filter', { value: d.arg }); this.render(); break;
      case 'list-sort': this.ui.sort = d.arg; this.emit('list-sort', { value: d.arg }); this.render(); break;
      case 'search-scope': this.setSearchScope(d.arg); break;
      case 'search-filter': this.setSearchFilter(d.arg, d.arg2 === '' ? null : d.arg2); break;
      case 'search-toggle': this.setSearchFilter(d.arg, !this.ui.search.filters[d.arg]); break;
      case 'search-tab': this.ui.search.tab = d.arg; this.emit('search-tab', { tab: d.arg }); this.render(); break;
      case 'search-clear': this.closeSearch(); break;
      case 'search-go': this.runSearch((this.root.querySelector('#sim-search') || {}).value || ''); break;
      case 'search-suggest-from': this.ui.search.query = ''; this.setSearchFilter('from', d.arg); break;
      case 'sync': this.sync(); break;
      case 'rsvp':
        if (d.arg2) this.doRsvp(d.id, d.arg, d.arg2);
        else this.rsvpClick(el, d.id, d.arg);
        break;
      case 'cal-nav': this.calNav(+d.arg); break;
      case 'cal-today': this.calToday(); break;
      case 'cal-view': this.setCalView(d.arg); break;
      case 'cal-slot': this.openEventForm({ start: +d.start }); break;
      case 'event-open': this.openEventDetails(d.id, el); break;
      case 'event-delete': this.deleteEvent(d.id); break;
      case 'event-close': this.ui.selEvent = null; this.render(); break;
      case 'myday': this.ui.myday = !this.ui.myday; this.emit('myday', { open: this.ui.myday }); this.render(); break;
      case 'people-select': this.ui.peopleSel = d.id; this.emit('people-select', { id: d.id }); this.render(); break;
      case 'people-mail': this.openCompose({ kind: 'new', to: [d.id] }); break;
      case 'people-meet': this.openEventForm({ attendees: [d.id] }); break;
      case 'att': this.openMenu('att', el, this.menuItems('att', d), { label: 'Attachment actions' }); break;
      case 'att-preview': this.openViewer(d.id, d.arg); break;
      case 'att-saveas': this.showDialog('saveas', { msgId: d.id, attId: d.arg }); break;
      case 'att-download': this.saveAttachment(d.id, d.arg, 'Downloads', 'download'); break;
      case 'att-all': this.saveAllAttachments(d.id); break;
      case 'setting':
        var v = d.arg2; if (v === 'true') v = true; if (v === 'false') v = false;
        this.setSetting(d.arg, v); break;
      case 'rule-from-msg': this.showDialog('newrule', { fromMsg: this.ui.sel }); break;
      case 'help': this.showDialog('help', {}); break;
      case 'feedback': this.showDialog('feedback', {}); break;
      case 'whatsnew': this.showDialog('whatsnew', {}); break;
      case 'dialog': this.showDialog(d.arg, d); break;
      case 'dialog-close': this.closeDialog(); break;
      case 'settings-open': this.openSettings(d.arg, d.arg2); break;
      case 'settings-nav': this.ui.settings = { cat: d.arg, page: d.arg2 }; this.emit('settings-page', { cat: d.arg, page: d.arg2 }); this.renderSettings(); break;
      case 'settings-close': this.closeSettings(); break;
      case 'backstage': this.openBackstage(d.arg); break;
      case 'backstage-close': this.closeBackstage(); break;
      default:
        if (this.formAct && this.formAct(act, el, d, ev)) break;
        if (window.console) console.warn('[sim] unhandled action', act);
    }
  };

  S.rsvpClick = function (el, id, resp) {
    if (this.isNew()) {
      // New Outlook responds immediately; the arrow offers "Edit response" / "Don't send".
      this.doRsvp(id, resp, 'send');
    } else {
      this.openMenu('rsvp-classic', el, this.menuItems('rsvp-classic', { id: id, resp: resp }), { label: 'Response options' });
    }
  };
  S.doRsvp = function (id, resp, how) {
    var ev = this.event(id); if (!ev) return;
    if (how === 'edit') { this.openRsvpEdit(id, resp); return; }
    this.rsvp(id, resp, how !== 'none');
  };

  S.onInput = function (e) {
    var t = e.target;
    if (t.id === 'sim-search') {
      var self = this, v = t.value;
      this.ui.search.query = v; this.ui.search.active = true;
      if (this.isNew()) { this.renderSuggestions(); }
      else {
        if (this.searchTimer) clearTimeout(this.searchTimer);
        this.renderRibbon();
        this.renderMain();
        this.searchTimer = setTimeout(function () { self.emit('search', { query: v.trim(), scope: self.ui.search.scope }); }, 450);
        this.timers.push(this.searchTimer);
      }
    }
    if (t.id === 'sim-people-q') { this.ui.peopleQuery = t.value; this.renderMain(); var pi = this.root.querySelector('#sim-people-q'); if (pi) { pi.focus(); pi.setSelectionRange(t.value.length, t.value.length); } }
  };

  S.onFocusIn = function (e) {
    var t = e.target;
    if (t.id === 'sim-search' && !this.ui.search.active && !this.isNew()) {
      // Classic: clicking the search box opens the contextual Search tab.
      this.ui.search.active = true;
      this.ui.prevTab = this.ui.tab === 'search' ? 'home' : this.ui.tab;
      this.ui.tab = 'search';
      this.renderRibbon();
      this.rendered();
    }
  };

  S.onKey = function (e) {
    var t = e.target, key = e.key;
    if (key === 'Escape') {
      if (this.ui.menu) { var a = this.ui.menu.anchor; this.closeMenu(); if (a && a.focus) a.focus(); e.stopPropagation(); return; }
      if (this.ui.dialog) { this.closeDialog(); e.stopPropagation(); return; }
      if (this.ui.settings) { this.closeSettings(); e.stopPropagation(); return; }
      if (this.ui.backstage) { this.closeBackstage(); e.stopPropagation(); return; }
      if (this.ui.compose || this.ui.evform) { this.requestCloseCompose(); e.stopPropagation(); return; }
      if (this.ui.selEvent) { this.ui.selEvent = null; this.render(); return; }
    }
    // Menu keyboard navigation
    if (t.closest && t.closest('.sim-menu')) {
      var items = U.$$('.sim-menu .mi:not(.is-disabled)', this.root), i = items.indexOf(t);
      if (key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
      else if (key === 'ArrowUp') { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
      else if (key === 'Tab') { e.preventDefault(); this.closeMenu(); }
      return;
    }
    if (t.id === 'sim-search') {
      if (key === 'Enter') { e.preventDefault(); this.runSearch(t.value); }
      return;
    }
    if (t.id === 'sim-newfolder') {
      if (key === 'Enter') { e.preventDefault(); this.commitInlineFolder(t.value); }
      else if (key === 'Escape') { this.ui.inlineFolder = null; this.render(); }
      return;
    }
    if (t.id === 'sim-rename') {
      if (key === 'Enter') { e.preventDefault(); this.renameFolder(this.ui.renaming, t.value); this.ui.renaming = null; this.render(); }
      else if (key === 'Escape') { this.ui.renaming = null; this.render(); }
      return;
    }
    // Message list: arrows move focus, Enter opens, Delete deletes
    if (t.classList && t.classList.contains('row')) {
      var rows = U.$$('.sim-main .row', this.root), ri = rows.indexOf(t);
      if (key === 'ArrowDown') { e.preventDefault(); if (rows[ri + 1]) rows[ri + 1].focus(); }
      else if (key === 'ArrowUp') { e.preventDefault(); if (rows[ri - 1]) rows[ri - 1].focus(); }
      else if (key === 'Enter' || key === ' ') { e.preventDefault(); this.openMessage(t.dataset.id); var again = this.root.querySelector('.row[data-id="' + t.dataset.id + '"]'); if (again) again.focus(); }
      else if (key === 'Delete') { e.preventDefault(); this.deleteMessage(t.dataset.id); }
    }
  };

  S.commitInlineFolder = function (name) {
    var res = this.createFolder(name, this.ui.inlineFolder);
    if (res.ok) { this.ui.inlineFolder = null; this.render(); }
    else {
      var err = this.root.querySelector('#sim-newfolder-err');
      if (err) err.textContent = res.error;
      this.emit('folder-create-error', { error: res.error });
    }
  };

  S.onContext = function (e) {
    var t = e.target.closest && e.target.closest('[data-ctx]');
    if (!t) return;
    e.preventDefault();
    var kind = t.dataset.ctx;
    this.openMenu(kind + '-context', t, this.menuItems(kind + '-context', { id: t.dataset.id }), { at: { x: e.clientX, y: e.clientY }, label: kind + ' menu' });
  };

  S.onDragStart = function (e) {
    var t = e.target.closest && e.target.closest('.row[data-id]');
    if (!t) return;
    this.dragId = t.dataset.id;
    try { e.dataTransfer.setData('text/plain', t.dataset.id); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* ignore */ }
  };
  S.onDrop = function (e) {
    var t = e.target.closest && e.target.closest('[data-drop]');
    if (!t || !this.dragId) return;
    e.preventDefault();
    var id = this.dragId; this.dragId = null;
    U.$$('.drop-over', this.root).forEach(function (n) { n.classList.remove('drop-over'); });
    this.moveMessage(id, t.dataset.drop, 'drag');
  };
})();
