/* ==========================================================================
   sim-ui.js — Outlook simulator templates (Classic vs New Outlook chrome)
   Controls carry data-t="key" so the lesson engine can highlight them and
   data-act="action" so the simulator can handle them.
   ========================================================================== */
(function () {
  'use strict';
  var OT = window.OT, U = OT.util, I = OT.icon, S = OT.Sim.prototype, esc = U.esc;

  var CAT_COLORS = { red: '#d13438', orange: '#ca5010', green: '#498205', blue: '#0f6cbd', purple: '#8764b8' };
  var CAT_NAMES = { red: 'Red category', orange: 'Orange category', green: 'Green category', blue: 'Blue category', purple: 'Purple category' };

  /* ----------------------------------------------------------------- render */
  S.render = function () {
    var ui = this.ui, cfg = this.cfg(), el = this.el;
    el.sim.setAttribute('data-mode', ui.mode);
    el.sim.setAttribute('data-density', cfg.density);
    el.sim.setAttribute('data-accent', this.isNew() ? cfg.accent : 'blue');
    el.sim.classList.toggle('dark', this.isDark());
    el.sim.classList.toggle('no-folderpane', !cfg.folderPane);
    el.sim.classList.toggle('drawer-open', !!ui.drawer);
    el.sim.classList.toggle('myday-open', !!(ui.myday && this.isNew()));
    el.sim.classList.toggle('narrow', !!ui.narrow);

    var active = document.activeElement, keep = null;
    if (active && this.root.contains(active) && active !== document.body) {
      var zone = active.closest('.sim-titlebar,.sim-ribbon,.sim-rail,.sim-folders,.sim-main,.sim-side');
      if (zone) {
        keep = { id: active.id || null, t: active.dataset && active.dataset.t || null, row: active.dataset && active.classList.contains('row') ? active.dataset.id : null };
        if (active.id === 'sim-search' || active.id === 'sim-newfolder' || active.id === 'sim-rename' || active.id === 'sim-people-q') {
          keep.sel = [active.selectionStart, active.selectionEnd];
        }
      }
    }
    el.titlebar.innerHTML = this.tplTitlebar();
    this.renderRibbon();
    el.rail.innerHTML = this.tplRail();
    el.folders.innerHTML = this.tplFolders();
    this.renderMain();
    el.side.innerHTML = this.tplSide();
    this.renderStatus();
    this.renderSuggestions();
    if (keep) {
      var n = null;
      if (keep.id) n = this.root.querySelector('#' + keep.id);
      else if (keep.row) n = this.root.querySelector('.row[data-id="' + keep.row + '"]');
      else if (keep.t) n = this.root.querySelector('[data-t="' + keep.t + '"]');
      if (n && n.focus) {
        n.focus();
        if (keep.sel && n.setSelectionRange) { try { n.setSelectionRange(keep.sel[0], keep.sel[1]); } catch (e) { /* ignore */ } }
      }
    }
    this.rendered();
  };

  S.renderRibbon = function () { this.el.ribbon.innerHTML = this.tplRibbon(); this.el.sim.classList.toggle('ribbon-simplified', this.isNew() && this.s.settings['new'].ribbon === 'simplified'); };
  S.renderMain = function () {
    var ui = this.ui, html;
    this.el.sim.classList.toggle('single-pane', !!(ui.narrow || this.cfg().reading === 'off'));
    if (ui.app === 'calendar') html = this.tplCalendar();
    else if (ui.app === 'people') html = this.tplPeople();
    else html = this.tplMail();
    this.el.main.innerHTML = html;
  };
  S.renderStatus = function () {
    var ui = this.ui;
    if (this.isNew()) { this.el.status.innerHTML = ''; return; }
    var inbox = this.listMessages();
    this.el.status.innerHTML = ui.app === 'mail'
      ? '<span>Items: ' + inbox.length + '</span><span>Unread: ' + this.unreadCount(ui.folder) + '</span><span class="st-sync">' + (ui.syncing ? 'Updating…' : 'All folders are up to date.') + '</span><span class="st-right">Connected to: Microsoft Exchange (simulated)</span>'
      : '<span class="st-sync">' + (ui.syncing ? 'Updating…' : 'All folders are up to date.') + '</span><span class="st-right">Connected to: Microsoft Exchange (simulated)</span>';
  };

  /* ---------------------------------------------------------------- titlebar */
  S.tplSearchBox = function () {
    var ui = this.ui, q = ui.search.query;
    var ph = this.isNew() ? 'Search' : (ui.app === 'mail' ? 'Search' : 'Search');
    return '<div class="tb-search">' + I('search', 15, 'tb-sic') +
      '<input id="sim-search" type="search" autocomplete="off" spellcheck="false" placeholder="' + ph + '" aria-label="Search mail" data-t="search" value="' + esc(q) + '">' +
      (q || ui.search.active ? '<button type="button" class="tb-clear" data-act="search-clear" data-t="search-clear" aria-label="Clear search">' + I('x', 13) + '</button>' : '') +
      '<div class="suggest-host" id="sim-suggest"></div></div>';
  };

  S.tplTitlebar = function () {
    var ui = this.ui, isNew = this.isNew();
    var folderName = ui.app === 'mail' ? this.folderName(ui.folder) : (ui.app === 'calendar' ? 'Calendar' : 'People');
    var hamb = '<button type="button" class="tb-btn hamb" data-act="drawer" data-t="hamburger" aria-label="Show folders">' + I('menu', 18) + '</button>';
    if (!isNew) {
      var canUndo = ui.undoStack.length > 0;
      return '<div class="tb tb-classic">' +
        '<div class="tb-left">' + hamb + '<span class="app-badge" aria-hidden="true">O</span>' +
        '<button type="button" class="tb-btn qat" data-act="sync" data-t="qat-sync" title="Send/Receive All Folders" aria-label="Send/Receive All Folders">' + I('refresh', 15) + '</button>' +
        '<button type="button" class="tb-btn qat' + (canUndo ? '' : ' dim') + '" data-act="undo" data-t="qat-undo" title="Undo" aria-label="Undo">' + I('undo', 15) + '</button>' +
        '<span class="tb-title">' + esc(folderName) + ' - ' + esc(this.me().email) + ' - Outlook</span></div>' +
        this.tplSearchBox() +
        '<div class="tb-right"><span class="tb-switch-label" id="lbl-toggle">Try the new Outlook</span>' +
        '<button type="button" role="switch" aria-checked="false" aria-labelledby="lbl-toggle" class="switch" data-act="toggle-mode" data-t="toggle"><span class="knob"></span></button></div></div>';
    }
    return '<div class="tb tb-new">' +
      '<div class="tb-left">' + hamb + '<span class="brand">' + I('mail', 17) + '<b>Outlook</b></span></div>' +
      this.tplSearchBox() +
      '<div class="tb-right"><span class="tb-switch-label" id="lbl-toggle">New Outlook</span>' +
      '<button type="button" role="switch" aria-checked="true" aria-haspopup="menu" aria-expanded="false" aria-labelledby="lbl-toggle" class="switch on" data-act="toggle-mode" data-t="toggle"><span class="knob"></span></button>' +
      '<button type="button" class="tb-btn" data-act="myday" data-t="myday" aria-label="My Day" aria-pressed="' + (ui.myday ? 'true' : 'false') + '" title="My Day">' + I('sun', 17) + '</button>' +
      '<button type="button" class="tb-btn" data-act="settings-open" data-t="settings-gear" aria-label="Settings" title="Settings">' + I('gear', 17) + '</button>' +
      '</div></div>';
  };

  S.renderSuggestions = function () {
    var host = this.root.querySelector('#sim-suggest');
    if (!host) return;
    var ui = this.ui, q = ui.search.query.trim();
    var input = this.root.querySelector('#sim-search');
    if (!this.isNew() || !q || !ui.suggest || document.activeElement !== input && !ui.suggestKeep) { host.innerHTML = ''; return; }
    var self = this, people = Object.keys(this.s.contacts).map(function (k) { return self.s.contacts[k]; }).filter(function (c) {
      return c.id !== 'jordan' && c.name.toLowerCase().indexOf(q.toLowerCase()) !== -1;
    }).slice(0, 3);
    var html = '<div class="suggest" role="listbox" aria-label="Search suggestions"><button type="button" role="option" class="sg" data-act="search-go" data-t="suggest-search">' + I('search', 14) + '<span>Search for “' + esc(q) + '”</span></button>';
    people.forEach(function (c) {
      html += '<button type="button" role="option" class="sg" data-act="search-suggest-from" data-arg="' + c.id + '" data-t="suggest-from-' + c.id + '">' + I('user', 14) + '<span>Messages from ' + esc(c.name) + '</span></button>';
    });
    host.innerHTML = html + '</div>';
  };

  /* ------------------------------------------------------------------ ribbon */
  function B(o) {
    var big = o.size === 'l';
    var attrs = ' data-t="' + o.t + '"';
    if (o.menu) attrs += ' data-act="menu" data-menu="' + o.menu + '" aria-haspopup="menu" aria-expanded="false"';
    else attrs += ' data-act="' + o.act + '"';
    if (o.arg !== undefined) attrs += ' data-arg="' + esc(o.arg) + '"';
    if (o.arg2 !== undefined) attrs += ' data-arg2="' + esc(o.arg2) + '"';
    if (o.pressed !== undefined) attrs += ' aria-pressed="' + (o.pressed ? 'true' : 'false') + '"';
    if (o.soft) attrs += ' aria-disabled="true"';
    var cls = 'rb' + (big ? ' rb-l' : ' rb-s') + (o.soft ? ' soft' : '') + (o.pressed ? ' on' : '') + (o.primary ? ' primary' : '') + (o.cls ? ' ' + o.cls : '');
    return '<button type="button" class="' + cls + '"' + attrs + ' aria-label="' + esc(o.aria || o.label) + '" title="' + esc(o.aria || o.label) + '">' +
      I(o.icon, big ? 22 : 16, 'rb-ic') + '<span class="rb-l">' + esc(o.label) + '</span>' + (o.menu ? I('chev-down', 10, 'rb-caret') : '') + '</button>';
  }
  function G(label, items) { return '<div class="rg" role="group" aria-label="' + esc(label) + '"><div class="rg-items">' + items.join('') + '</div><div class="rg-label">' + esc(label) + '</div></div>'; }

  S.tplTabs = function (tabs, active) {
    var html = '<div class="rtabs" role="tablist">';
    tabs.forEach(function (t) {
      html += '<button type="button" role="tab" class="rtab' + (t.id === active ? ' on' : '') + (t.id === 'file' ? ' file' : '') + (t.ctx ? ' ctx' : '') + '" aria-selected="' + (t.id === active) + '" data-act="tab" data-arg="' + t.id + '" data-t="tab-' + t.id + '">' + t.label + '</button>';
    });
    return html;
  };

  S.tplRibbon = function () {
    var ui = this.ui, isNew = this.isNew(), tab = ui.tab, self = this;
    var hasSel = !!(ui.sel && this.msg(ui.sel)), m = hasSel ? this.msg(ui.sel) : null;
    var soft = !hasSel;
    var tabs, panel = '';
    if (!isNew) {
      tabs = [{ id: 'file', label: 'File' }, { id: 'home', label: 'Home' }];
      if (ui.app === 'mail') tabs.push({ id: 'sendreceive', label: 'Send / Receive' }, { id: 'folder', label: 'Folder' });
      tabs.push({ id: 'view', label: 'View' }, { id: 'help', label: 'Help' });
      if (ui.search.active && ui.app === 'mail') tabs.splice(2, 0, { id: 'search', label: 'Search', ctx: true });
      if (!tabs.some(function (t) { return t.id === tab; })) { tab = 'home'; }
    } else {
      tabs = [{ id: 'home', label: 'Home' }, { id: 'view', label: 'View' }, { id: 'help', label: 'Help' }];
      if (!tabs.some(function (t) { return t.id === tab; })) { tab = 'home'; }
    }

    if (ui.app === 'calendar') panel = this.ribbonCalendar(tab);
    else if (ui.app === 'people') panel = this.ribbonPeople(tab);
    else if (tab === 'home') panel = isNew ? this.ribbonHomeNew(soft, m) : this.ribbonHomeClassic(soft, m);
    else if (tab === 'view') panel = this.ribbonView();
    else if (tab === 'sendreceive') panel = G('Send & Receive', [B({ t: 'b-sync', label: 'Send/Receive All Folders', icon: 'refresh', act: 'sync', size: 'l' }), B({ t: 'b-update', label: 'Update Folder', icon: 'mail-read', act: 'sync', size: 'l' })]);
    else if (tab === 'folder') {
      var f = this.folder(ui.folder), custom = f && !f.sys;
      panel = G('New', [B({ t: 'b-newfolder', label: 'New Folder', icon: 'folder-plus', act: 'folder-new', arg: ui.folder, size: 'l' })]) +
        G('Actions', [B({ t: 'b-renamefolder', label: 'Rename Folder', icon: 'folder', act: 'folder-rename-start', arg: ui.folder, soft: !custom }), B({ t: 'b-deletefolder', label: 'Delete Folder', icon: 'trash', act: 'folder-delete', arg: ui.folder, soft: !custom }), B({ t: 'b-markallread', label: 'Mark All as Read', icon: 'mail-read', act: 'mark-all-read', arg: ui.folder })]);
    }
    else if (tab === 'search') panel = this.ribbonSearch();
    else if (tab === 'help') {
      panel = isNew
        ? G('Help', [B({ t: 'b-help', label: 'Help', icon: 'help', act: 'help', size: 'l' }), B({ t: 'b-feedback', label: 'Give feedback', icon: 'sparkle', act: 'feedback', size: 'l' }), B({ t: 'b-whatsnew', label: 'What\'s new', icon: 'star', act: 'whatsnew', size: 'l' })])
        : G('Help', [B({ t: 'b-help', label: 'Help', icon: 'help', act: 'help', size: 'l' })]);
    }

    var right = '';
    if (isNew) {
      right = '<button type="button" class="ribbon-style" data-act="ribbon-style" data-t="ribbon-style" aria-label="Switch to the ' + (this.s.settings['new'].ribbon === 'simplified' ? 'classic' : 'simplified') + ' ribbon" title="Switch between the simplified and classic ribbon">' + I(this.s.settings['new'].ribbon === 'simplified' ? 'chev-down' : 'chev-up', 14) + '</button>';
    }
    return this.tplTabs(tabs, tab) + '</div><div class="rpanel' + (isNew ? ' style-' + this.s.settings['new'].ribbon : '') + '" role="tabpanel">' + panel + right + '</div>';
  };

  S.ribbonHomeClassic = function (soft, m) {
    var read = m ? m.read : true;
    return G('New', [B({ t: 'b-new-mail', label: 'New Email', icon: 'mail', act: 'compose-new', size: 'l' }), B({ t: 'b-new-items', label: 'New Items', icon: 'plus', menu: 'new-items', size: 'l' })]) +
      G('Delete', [B({ t: 'b-delete', label: 'Delete', icon: 'trash', act: 'delete', size: 'l', soft: soft }), B({ t: 'b-archive', label: 'Archive', icon: 'archive', act: 'archive', soft: soft }), B({ t: 'b-junk', label: 'Junk', icon: 'shield', act: 'junk', soft: soft })]) +
      G('Respond', [B({ t: 'b-reply', label: 'Reply', icon: 'reply', act: 'reply', size: 'l', soft: soft }), B({ t: 'b-replyall', label: 'Reply All', icon: 'reply-all', act: 'replyall', size: 'l', soft: soft }), B({ t: 'b-forward', label: 'Forward', icon: 'forward', act: 'forward', size: 'l', soft: soft })]) +
      G('Quick Steps', [B({ t: 'qs-done', label: 'Done', icon: 'check', act: 'quickstep-done', soft: soft, aria: 'Quick Step: Done (mark read and move to Archive)' })]) +
      G('Move', [B({ t: 'b-move', label: 'Move', icon: 'move', menu: 'move', size: 'l', soft: soft }), B({ t: 'b-rules', label: 'Rules', icon: 'filter', menu: 'rules' })]) +
      G('Tags', [B({ t: 'b-unread', label: read ? 'Unread' : 'Read', icon: read ? 'mail-unread' : 'mail-read', act: 'read-toggle', soft: soft, aria: read ? 'Mark as Unread' : 'Mark as Read' }), B({ t: 'b-categorize', label: 'Categorize', icon: 'tag', menu: 'categorize', soft: soft }), B({ t: 'b-followup', label: 'Follow Up', icon: 'flag', menu: 'followup', soft: soft })]) +
      G('Find', [B({ t: 'b-addressbook', label: 'Address Book', icon: 'book', act: 'dialog', arg: 'addressbook' })]) +
      G('Add-ins', [B({ t: 'b-addins', label: 'Get Add-ins', icon: 'puzzle', act: 'dialog', arg: 'addins', size: 'l' })]);
  };

  S.ribbonHomeNew = function (soft, m) {
    var read = m ? m.read : true, pinned = m && m.pinned, flagged = m && m.flag;
    var grp = this.s.settings['new'].ribbon === 'classic';
    var items = {
      newmail: B({ t: 'b-new-mail', label: 'New mail', icon: 'mail', act: 'compose-new', primary: true, size: grp ? 'l' : 's' }) + B({ t: 'b-new-arrow', label: 'More new items', icon: 'chev-down', menu: 'new-mail-arrow', cls: 'arrow-only', aria: 'More new items' }),
      del: B({ t: 'b-delete', label: 'Delete', icon: 'trash', act: 'delete', soft: soft, size: grp ? 'l' : 's' }),
      archive: B({ t: 'b-archive', label: 'Archive', icon: 'archive', act: 'archive', soft: soft }),
      sweep: B({ t: 'b-sweep', label: 'Sweep', icon: 'sweep', menu: 'sweep', soft: soft }),
      move: B({ t: 'b-move', label: 'Move to', icon: 'move', menu: 'move', soft: soft }),
      reply: B({ t: 'b-reply', label: 'Reply', icon: 'reply', act: 'reply', soft: soft }),
      replyall: B({ t: 'b-replyall', label: 'Reply all', icon: 'reply-all', act: 'replyall', soft: soft }),
      forward: B({ t: 'b-forward', label: 'Forward', icon: 'forward', act: 'forward', soft: soft }),
      unread: B({ t: 'b-unread', label: read ? 'Unread' : 'Read', icon: read ? 'mail-unread' : 'mail-read', act: 'read-toggle', soft: soft, aria: read ? 'Mark as unread' : 'Mark as read' }),
      categorize: B({ t: 'b-categorize', label: 'Categorize', icon: 'tag', menu: 'categorize', soft: soft }),
      flag: B({ t: 'b-flag', label: flagged ? 'Unflag' : 'Flag', icon: 'flag', act: 'flag-toggle', soft: soft, pressed: !!flagged }),
      pin: B({ t: 'b-pin', label: pinned ? 'Unpin' : 'Pin', icon: 'pin', act: 'pin', soft: soft, pressed: !!pinned }),
      snooze: B({ t: 'b-snooze', label: 'Snooze', icon: 'bell', menu: 'snooze', soft: soft }),
      rules: B({ t: 'b-rules', label: 'Rules', icon: 'filter', menu: 'rules' }),
      quick: B({ t: 'b-quicksteps', label: 'Quick steps', icon: 'check', menu: 'quicksteps', soft: soft }),
      undo: B({ t: 'b-undo', label: 'Undo', icon: 'undo', act: 'undo' }),
      apps: B({ t: 'b-moreapps', label: 'More apps', icon: 'apps', act: 'dialog', arg: 'addins' })
    };
    if (!grp) {
      return '<div class="rflat">' + [items.newmail, items.del, items.archive, items.sweep, items.move, items.reply, items.replyall, items.forward, items.unread, items.categorize, items.flag, items.pin, items.snooze, items.rules, items.quick, items.undo, items.apps].join('') + '</div>';
    }
    return G('New', [items.newmail]) + G('Delete', [items.del, items.archive, items.sweep]) + G('Respond', [items.reply, items.replyall, items.forward]) +
      G('Move', [items.move, items.rules, items.quick]) + G('Tags', [items.unread, items.categorize, items.flag, items.pin, items.snooze]) + G('Apps', [items.undo, items.apps]);
  };

  S.ribbonView = function () {
    var c = this.cfg();
    if (this.ui.app !== 'mail') {
      return G('Calendar view', [B({ t: 'b-calview-day', label: 'Day', icon: 'calendar', act: 'cal-view', arg: 'day', pressed: this.ui.calView === 'day' }), B({ t: 'b-calview-workweek', label: 'Work Week', icon: 'calendar', act: 'cal-view', arg: 'workweek', pressed: this.ui.calView === 'workweek' }), B({ t: 'b-calview-week', label: 'Week', icon: 'calendar', act: 'cal-view', arg: 'week', pressed: this.ui.calView === 'week' })]);
    }
    if (this.isNew()) {
      return G('Layout', [B({ t: 'b-layout', label: 'Layout', icon: 'layout', menu: 'view-layout', size: 'l' }), B({ t: 'b-density', label: 'Density', icon: 'density', menu: 'density', size: 'l' })]);
    }
    return G('Current View', [B({ t: 'b-changeview', label: 'Change View', icon: 'density', menu: 'changeview', size: 'l' })]) +
      G('Layout', [B({ t: 'b-folderpane', label: 'Folder Pane', icon: 'folder', menu: 'folderpane', size: 'l' }), B({ t: 'b-readingpane', label: 'Reading Pane', icon: 'layout', menu: 'reading', size: 'l' })]);
  };

  S.ribbonSearch = function () {
    var s = this.ui.search, f = s.filters;
    return G('Scope', [B({ t: 'b-scope', label: s.scope === 'folder' ? 'Current Folder' : 'Current Mailbox', icon: 'folder', menu: 'search-scope', size: 'l' })]) +
      G('Refine', [B({ t: 'b-has-attach', label: 'Has Attachments', icon: 'attach', act: 'search-toggle', arg: 'attach', pressed: f.attach, size: 'l' }),
        B({ t: 'b-unread-filter', label: 'Unread', icon: 'mail-unread', act: 'search-toggle', arg: 'unread', pressed: f.unread }),
        B({ t: 'b-flagged-filter', label: 'Flagged', icon: 'flag', act: 'search-toggle', arg: 'flagged', pressed: f.flagged }),
        B({ t: 'b-from-filter', label: 'From', icon: 'user', menu: 'search-from' }),
        B({ t: 'b-thisweek', label: 'This Week', icon: 'calendar', act: 'search-filter', arg: 'date', arg2: 'week', pressed: f.date === 'week' })]) +
      G('Close', [B({ t: 'b-close-search', label: 'Close Search', icon: 'x', act: 'search-clear', size: 'l' })]);
  };

  S.ribbonCalendar = function (tab) {
    var isNew = this.isNew(), v = this.ui.calView;
    if (tab === 'help') return G('Help', [B({ t: 'b-help', label: 'Help', icon: 'help', act: 'help', size: 'l' })].concat(isNew ? [B({ t: 'b-feedback', label: 'Give feedback', icon: 'sparkle', act: 'feedback', size: 'l' }), B({ t: 'b-whatsnew', label: 'What\'s new', icon: 'star', act: 'whatsnew', size: 'l' })] : []));
    if (tab === 'view') return this.ribbonView();
    if (isNew) {
      return '<div class="rflat">' + B({ t: 'b-newevent', label: 'New event', icon: 'calendar-add', act: 'event-new', primary: true }) + B({ t: 'b-today', label: 'Today', icon: 'calendar', act: 'cal-today' }) +
        B({ t: 'b-calviews', label: v === 'day' ? 'Day' : v === 'week' ? 'Week' : 'Work week', icon: 'calendar', menu: 'cal-views' }) + '</div>';
    }
    return G('New', [B({ t: 'b-newevent', label: 'New Appointment', icon: 'calendar-add', act: 'event-new', size: 'l' }), B({ t: 'b-newmeeting', label: 'New Meeting', icon: 'people', act: 'event-new', size: 'l' })]) +
      G('Go To', [B({ t: 'b-today', label: 'Today', icon: 'calendar', act: 'cal-today', size: 'l' })]) +
      G('Arrange', [B({ t: 'b-calview-day', label: 'Day', icon: 'calendar', act: 'cal-view', arg: 'day', pressed: v === 'day' }), B({ t: 'b-calview-workweek', label: 'Work Week', icon: 'calendar', act: 'cal-view', arg: 'workweek', pressed: v === 'workweek' }), B({ t: 'b-calview-week', label: 'Week', icon: 'calendar', act: 'cal-view', arg: 'week', pressed: v === 'week' })]);
  };

  S.ribbonPeople = function (tab) {
    if (tab === 'help') return G('Help', [B({ t: 'b-help', label: 'Help', icon: 'help', act: 'help', size: 'l' })]);
    if (tab === 'view') return this.ribbonView();
    var sel = this.ui.peopleSel;
    var items = [B({ t: 'b-new-mail', label: 'New Email', icon: 'mail', act: 'compose-new', arg: sel || '', size: this.isNew() ? 's' : 'l' }), B({ t: 'b-newmeeting', label: 'New Meeting', icon: 'calendar-add', act: 'event-new', arg: sel || '', size: this.isNew() ? 's' : 'l' })];
    return this.isNew() ? '<div class="rflat">' + items.join('') + '</div>' : G('Communicate', items);
  };

  /* -------------------------------------------------------------------- rail */
  S.tplRail = function () {
    var ui = this.ui, isNew = this.isNew(), unread = this.unreadCount('inbox');
    function r(app, ic, label) {
      return '<button type="button" class="rail-btn' + (ui.app === app ? ' on' : '') + '" data-act="app" data-arg="' + app + '" data-t="rail-' + app + '" aria-label="' + label + '"' + (ui.app === app ? ' aria-current="page"' : '') + ' title="' + label + '">' + I(ic, 20) + '<span class="rail-l">' + label + '</span>' + (app === 'mail' && unread ? '<span class="rail-badge" aria-label="' + unread + ' unread">' + unread + '</span>' : '') + '</button>';
    }
    return r('mail', 'mail', 'Mail') + r('calendar', 'calendar', 'Calendar') + r('people', 'people', 'People') +
      (isNew ? '<button type="button" class="rail-btn" data-act="dialog" data-arg="addins" data-t="rail-apps" aria-label="More apps" title="More apps">' + I('apps', 20) + '<span class="rail-l">Apps</span></button>' : '');
  };

  /* ----------------------------------------------------------------- folders */
  S.tplFolders = function () {
    var ui = this.ui, self = this, isNew = this.isNew();
    if (ui.app === 'calendar') {
      return '<div class="fp-head">Calendar</div><div class="fp-list"><div class="frow"><span class="fname static">' + I('calendar', 15) + '<span>My calendars</span></span></div>' +
        '<div class="frow sub"><span class="fname static"><span class="cal-dot"></span><span>Calendar</span></span></div>' + this.tplMiniMonth() + '</div>';
    }
    if (ui.app === 'people') {
      return '<div class="fp-head">People</div><div class="fp-list"><div class="frow on"><span class="fname static">' + I('people', 15) + '<span>All contacts</span></span></div></div>';
    }
    function row(f, depth, favorite) {
      var kids = self.childFolders(f.id), open = ui.expanded[f.id];
      var cnt = f.id === 'drafts' ? self.folderMessages('drafts').length : self.unreadCount(f.id);
      var html = '<div class="frow' + (ui.folder === f.id && !favorite ? ' on' : '') + (ui.folder === f.id && favorite ? ' on' : '') + '" role="treeitem" aria-selected="' + (ui.folder === f.id) + '" style="--depth:' + depth + '" data-ctx="folder" data-id="' + f.id + '" data-drop="' + f.id + '">';
      html += kids.length || (isNew && ui.inlineFolder === f.id) ? '<button type="button" class="fchev" data-act="folder-toggle" data-arg="' + f.id + '" aria-label="' + (open ? 'Collapse ' : 'Expand ') + esc(f.name) + '" aria-expanded="' + (!!open) + '">' + I(open ? 'chev-down' : 'chev-right', 11) + '</button>' : '<span class="fchev sp"></span>';
      if (ui.renaming === f.id && !favorite) {
        html += '<input id="sim-rename" class="finput" aria-label="Rename folder" value="' + esc(f.name) + '">';
      } else {
        html += '<button type="button" class="fname" data-act="folder" data-arg="' + f.id + '" data-t="' + (favorite ? 'fav-' : 'f-') + f.id + '">' + I(f.id === 'inbox' ? 'mail' : f.id === 'sent' ? 'send' : f.id === 'drafts' ? 'file' : f.id === 'deleted' ? 'trash' : f.id === 'archive' ? 'archive' : f.id === 'junk' ? 'shield' : f.id === 'outbox' ? 'send' : 'folder', 15) + '<span class="fn">' + esc(f.name) + '</span></button>';
      }
      if (cnt) html += '<span class="badge" aria-label="' + cnt + (f.id === 'drafts' ? ' items' : ' unread') + '">' + cnt + '</span>';
      html += '</div>';
      if (!favorite && open) {
        if (isNew && ui.inlineFolder === f.id) {
          html += '<div class="frow sub" style="--depth:' + (depth + 1) + '"><span class="fchev sp"></span><span class="fname static">' + I('folder', 15) + '<input id="sim-newfolder" class="finput" placeholder="Folder name" aria-label="New folder name" data-t="newfolder-input"></span></div><div id="sim-newfolder-err" class="ferr" role="alert"></div>';
        }
        kids.forEach(function (k) { html += row(k, depth + 1); });
      }
      return html;
    }
    var html = '<div class="fp-head">' + (isNew ? 'Favorites' : 'Favorites') + '</div><div class="fp-list" role="tree" aria-label="Favorites">';
    ['inbox', 'sent', 'deleted'].forEach(function (id) { html += row(self.folder(id), 0, true); });
    html += '</div>';
    html += '<div class="fp-head fp-acct"><span>' + (isNew ? 'Folders' : esc(this.me().email)) + '</span>' +
      (isNew ? '<button type="button" class="fp-add" data-act="folder-new" data-arg="inbox" data-t="f-newfolder-btn" aria-label="Create new folder" title="Create new folder">' + I('plus', 14) + '</button>' : '') + '</div>';
    html += '<div class="fp-list" role="tree" aria-label="Folders">';
    this.s.folders.filter(function (f) { return f.sys; }).forEach(function (f) { html += row(f, 0); });
    if (isNew && this.folderMessages('snoozed').length) {
      html += '<div class="frow' + (ui.folder === 'snoozed' ? ' on' : '') + '" style="--depth:0"><span class="fchev sp"></span><button type="button" class="fname" data-act="folder" data-arg="snoozed" data-t="f-snoozed">' + I('bell', 15) + '<span class="fn">Snoozed</span></button><span class="badge">' + this.folderMessages('snoozed').length + '</span></div>';
    }
    html += '</div>';
    return html;
  };

  S.tplMiniMonth = function () {
    var d = this.ui.calDate, y = d.getFullYear(), mo = d.getMonth(), first = new Date(y, mo, 1), days = new Date(y, mo + 1, 0).getDate();
    var html = '<div class="minical" aria-label="' + U.MONTHS_LONG[mo] + ' ' + y + '"><div class="mc-head">' + U.MONTHS_LONG[mo] + ' ' + y + '</div><div class="mc-grid">';
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(function (x) { html += '<span class="mc-dow">' + x + '</span>'; });
    for (var i = 0; i < first.getDay(); i++) html += '<span></span>';
    for (var n = 1; n <= days; n++) {
      var isToday = y === 2026 && mo === 9 && n === 26;
      html += '<span class="mc-d' + (isToday ? ' today' : '') + '">' + n + '</span>';
    }
    return html + '</div></div>';
  };

  /* -------------------------------------------------------------------- mail */
  S.rowDate = function (ts) {
    var d = new Date(ts), now = new Date(OT.data.NOW), diff = U.dayDiff(now, d);
    if (diff <= 0) return U.fmtTime(d);
    if (diff < 7) return this.isNew() ? U.DAYS[d.getDay()] + ' ' + (d.getMonth() + 1) + '/' + d.getDate() : U.DAYS[d.getDay()] + ' ' + U.fmtTime(d);
    return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
  };
  S.groupLabel = function (ts) {
    var diff = U.dayDiff(new Date(OT.data.NOW), new Date(ts));
    if (diff <= 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return 'Earlier this week';
    return 'Older';
  };
  S.recipientsLabel = function (list) {
    var self = this;
    return (list || []).map(function (r) { return self.recipientName(r); }).join('; ');
  };

  S.tplRow = function (m) {
    var ui = this.ui, isNew = this.isNew(), sel = ui.sel === m.id;
    var outgoing = m.folder === 'sent' || m.folder === 'drafts' || m.folder === 'outbox';
    var who = outgoing ? (m.to && m.to.length ? this.recipientsLabel(m.to) : '(no recipient)') : this.name(m.from);
    var prev = U.stripHtml(m.body).slice(0, 110);
    var cat = m.category ? '<span class="cat-dot" style="background:' + CAT_COLORS[m.category] + '" title="' + CAT_NAMES[m.category] + '" aria-label="' + CAT_NAMES[m.category] + '"></span>' : '';
    var icons = '';
    if (m.inviteId) icons += '<span class="ri" title="Meeting invitation">' + I('calendar', 13) + '</span>';
    if (m.attachments.length) icons += '<span class="ri" title="Has attachments" aria-label="Has attachments">' + I('attach', 13) + '</span>';
    if (m.important) icons += '<span class="ri imp" title="High importance" aria-label="High importance">!</span>';
    if (m.scheduledFor) icons += '<span class="ri" title="Scheduled">' + I('clock', 13) + '</span>';
    if (m.deliverAt) icons += '<span class="ri" title="Delayed delivery">' + I('clock', 13) + '</span>';
    var subjLabel = (m.draft ? '[Draft] ' : '') + m.subject;
    var flagBtn = '<button type="button" class="ra flag' + (m.flag ? ' on' : '') + '" data-act="flag-toggle" data-id="' + m.id + '" data-t="row-flag-' + m.id + '" aria-label="' + (m.flag ? 'Clear flag' : 'Flag this message') + '" aria-pressed="' + (!!m.flag) + '">' + I('flag', 14) + '</button>';
    var actions = '';
    if (isNew) {
      actions = '<span class="ra-box">' +
        '<button type="button" class="ra del" data-act="delete" data-id="' + m.id + '" data-t="row-del-' + m.id + '" aria-label="Delete">' + I('trash', 14) + '</button>' +
        '<button type="button" class="ra" data-act="archive" data-id="' + m.id + '" data-t="row-archive-' + m.id + '" aria-label="Archive">' + I('archive', 14) + '</button>' +
        flagBtn +
        '<button type="button" class="ra pin' + (m.pinned ? ' on' : '') + '" data-act="pin" data-id="' + m.id + '" data-t="row-pin-' + m.id + '" aria-label="' + (m.pinned ? 'Unpin' : 'Pin') + '" aria-pressed="' + (!!m.pinned) + '">' + I('pin', 14) + '</button>' +
        '</span>';
    } else {
      actions = flagBtn;
    }
    return '<div class="row' + (m.read ? '' : ' unread') + (sel ? ' sel' : '') + '" role="option" tabindex="0" aria-selected="' + sel + '" data-act="open" data-id="' + m.id + '" data-t="row-' + m.id + '" data-ctx="msg" draggable="true" aria-label="' + esc((m.read ? '' : 'Unread. ') + who + '. ' + subjLabel) + '">' +
      '<span class="r-bar"></span>' +
      '<span class="av" style="background:' + U.colorFor(who) + '" aria-hidden="true">' + esc(U.initials(who)) + '</span>' +
      '<div class="r-main"><div class="r-top"><span class="r-from">' + esc(who) + '</span><span class="r-date">' + this.rowDate(m.date) + '</span></div>' +
      '<div class="r-mid"><span class="r-subj">' + esc(subjLabel) + '</span><span class="r-icons">' + cat + icons + actions + '</span></div>' +
      '<div class="r-prev">' + esc(prev) + '</div></div></div>';
  };

  S.tplMail = function () {
    var ui = this.ui, isNew = this.isNew(), cfg = this.cfg(), self = this;
    var list = this.listMessages(), sr = ui.search;
    var searching = this.searchActive();
    var head = '';
    if (!isNew) {
      head = '<div class="ml-head"><div class="ml-tabs" role="tablist" aria-label="Show">' +
        '<button type="button" role="tab" class="mt' + (ui.filter === 'all' ? ' on' : '') + '" aria-selected="' + (ui.filter === 'all') + '" data-act="list-filter" data-arg="all" data-t="list-all">All</button>' +
        '<button type="button" role="tab" class="mt' + (ui.filter === 'unread' ? ' on' : '') + '" aria-selected="' + (ui.filter === 'unread') + '" data-act="list-filter" data-arg="unread" data-t="list-unread">Unread</button></div>' +
        '<button type="button" class="ml-sort" data-act="menu" data-menu="sort" aria-haspopup="menu" aria-expanded="false" data-t="list-sort">By ' + ({ date: 'Date', from: 'From', subject: 'Subject', importance: 'Importance', attach: 'Attachments' }[ui.sort]) + ' ' + I('chev-down', 11) + '</button></div>';
      if (searching) {
        head += '<div class="sr-info" role="status">Results for “' + esc(sr.query.trim()) + '” in ' + (sr.scope === 'folder' ? 'Current Folder' : 'Current Mailbox') + ' — ' + U.plural(list.length, 'item') + '<button type="button" class="linkbtn" data-act="search-clear" data-t="sr-close">Close search</button></div>';
      }
    } else {
      head = '<div class="ml-head"><h2 class="ml-title">' + (searching ? 'Search results' : esc(this.folderName(ui.folder) === 'Inbox' || ui.folder !== 'snoozed' ? this.folderName(ui.folder) : 'Snoozed')) + '</h2>' +
        '<button type="button" class="ml-filter" data-act="menu" data-menu="list-filter" aria-haspopup="menu" aria-expanded="false" data-t="list-filter">' + I('filter', 14) + '<span>Filter</span>' + (ui.filter !== 'all' ? '<span class="pill">' + ({ unread: 'Unread', flagged: 'Flagged', attach: 'Has files' }[ui.filter]) + '</span>' : '') + I('chev-down', 11) + '</button></div>';
      if (searching) head += this.tplSearchChips(list.length);
    }
    var body = '';
    if (isNew && searching && sr.tab === 'files') {
      var files = [];
      list.forEach(function (m) { m.attachments.forEach(function (a) { files.push({ m: m, a: a }); }); });
      body = files.length ? files.map(function (x) {
        return '<div class="row filerow" role="option" tabindex="0" data-act="open" data-id="' + x.m.id + '" data-t="file-' + x.a.id + '" aria-label="' + esc(x.a.name + ', from ' + self.name(x.m.from)) + '">' + self.fileIcon(x.a.ext) + '<div class="r-main"><div class="r-top"><span class="r-from">' + esc(x.a.name) + '</span><span class="r-date">' + U.fmtSize(x.a.size) + '</span></div><div class="r-prev">From ' + esc(self.name(x.m.from)) + ' · ' + esc(x.m.subject) + '</div></div></div>';
      }).join('') : '<div class="empty">' + I('file', 28) + '<p>No files match your search.</p></div>';
    } else if (!list.length) {
      body = '<div class="empty">' + I('mail-read', 30) + '<p>' + (searching ? 'No results match your search.' : ui.filter !== 'all' ? 'Nothing to show with this filter.' : 'This folder is empty.') + '</p></div>';
    } else {
      var last = null, pinnedHdr = false;
      list.forEach(function (m) {
        if (isNew && m.pinned && ui.sort === 'date') { if (!pinnedHdr) { body += '<div class="grp">Pinned</div>'; pinnedHdr = true; last = 'pinned'; } }
        else if (ui.sort === 'date' && !searching) {
          var g = self.groupLabel(m.date);
          if (g !== last) { body += '<div class="grp">' + g + '</div>'; last = g; }
        } else if (ui.sort === 'date' && searching && last !== 'r') { body += '<div class="grp">' + (isNew ? 'Mail' : 'Results') + '</div>'; last = 'r'; }
        body += self.tplRow(m);
      });
    }
    var m = ui.sel ? this.msg(ui.sel) : null;
    var single = ui.narrow || cfg.reading === 'off';
    var showList = !single || ui.pane === 'list';
    var showRead = !single || ui.pane === 'read';
    var layout = cfg.reading === 'bottom' && !ui.narrow ? 'bottom' : 'right';
    return '<div class="mail layout-' + layout + '">' +
      (showList ? '<section class="ml" aria-label="Message list">' + head + '<div class="ml-rows" role="listbox" aria-label="Messages" data-t="list">' + body + '</div></section>' : '') +
      (showRead ? '<section class="rp" aria-label="Reading pane">' + this.tplReading(m, single) + '</section>' : '') + '</div>';
  };

  S.tplSearchChips = function (n) {
    var sr = this.ui.search, f = sr.filters, self = this;
    return '<div class="sr-bar"><div class="sr-tabs" role="tablist"><button type="button" role="tab" class="mt' + (sr.tab === 'mail' ? ' on' : '') + '" aria-selected="' + (sr.tab === 'mail') + '" data-act="search-tab" data-arg="mail" data-t="sr-tab-mail">Mail</button>' +
      '<button type="button" role="tab" class="mt' + (sr.tab === 'files' ? ' on' : '') + '" aria-selected="' + (sr.tab === 'files') + '" data-act="search-tab" data-arg="files" data-t="sr-tab-files">Files</button><span class="sr-count">' + U.plural(n, 'result') + '</span></div>' +
      '<div class="chips" role="group" aria-label="Search refiners">' +
      '<button type="button" class="chip" data-act="menu" data-menu="search-scope-new" aria-haspopup="menu" aria-expanded="false" data-t="chip-scope">In: ' + (sr.scope === 'folder' ? 'Current folder' : 'All folders') + ' ' + I('chev-down', 10) + '</button>' +
      '<button type="button" class="chip' + (f.from ? ' on' : '') + '" data-act="menu" data-menu="search-from" aria-haspopup="menu" aria-expanded="false" data-t="chip-from">From' + (f.from ? ': ' + esc(this.name(f.from)) : '') + ' ' + I('chev-down', 10) + '</button>' +
      '<button type="button" class="chip' + (f.attach ? ' on' : '') + '" data-act="search-toggle" data-arg="attach" aria-pressed="' + (!!f.attach) + '" data-t="chip-attach">' + I('attach', 12) + ' Has files</button>' +
      '<button type="button" class="chip' + (f.unread ? ' on' : '') + '" data-act="search-toggle" data-arg="unread" aria-pressed="' + (!!f.unread) + '" data-t="chip-unread">Unread</button>' +
      '<button type="button" class="chip' + (f.flagged ? ' on' : '') + '" data-act="search-toggle" data-arg="flagged" aria-pressed="' + (!!f.flagged) + '" data-t="chip-flagged">Flagged</button>' +
      '<button type="button" class="chip' + (f.date ? ' on' : '') + '" data-act="menu" data-menu="search-date" aria-haspopup="menu" aria-expanded="false" data-t="chip-date">Date' + (f.date ? ': ' + (f.date === 'week' ? 'This week' : 'Today') : '') + ' ' + I('chev-down', 10) + '</button>' +
      '<button type="button" class="chip clear" data-act="search-clear" data-t="chip-clear">' + I('x', 11) + ' Clear</button></div></div>';
  };

  S.fileIcon = function (ext) {
    var color = { xlsx: '#107c41', docx: '#185abd', pdf: '#d13438', png: '#8764b8', txt: '#5c5c5c' }[ext] || '#5c5c5c';
    return '<span class="fi" style="background:' + color + '" aria-hidden="true">' + esc(ext.toUpperCase().slice(0, 4)) + '</span>';
  };

  S.conflictsFor = function (ev) {
    return this.s.events.filter(function (o) {
      return o.id !== ev.id && o.status !== 'declined' && o.status !== 'pending' && o.start < ev.end && o.end > ev.start;
    });
  };

  S.tplInvite = function (m) {
    var ev = this.event(m.inviteId), self = this;
    if (!ev) return '';
    var d = new Date(ev.start), e = new Date(ev.end);
    var when = U.fmtDate(d) + ', ' + U.fmtTime(d) + ' – ' + U.fmtTime(e);
    var conf = this.conflictsFor(ev).filter(function () { return ev.status === 'pending' || true; });
    var responded = ev.status !== 'pending';
    var resp = '';
    var respText = { accepted: 'You accepted this meeting.', tentative: 'You responded Tentative to this meeting.', declined: 'You declined this meeting.' }[ev.status];
    if (responded) resp = '<div class="inv-resp" role="status">' + I('check', 14) + ' ' + respText + '</div>';
    var btns = ['accepted', 'tentative', 'declined'].map(function (r) {
      var label = { accepted: 'Accept', tentative: 'Tentative', declined: 'Decline' }[r];
      var t = { accepted: 'rsvp-accept', tentative: 'rsvp-tentative', declined: 'rsvp-decline' }[r];
      return '<button type="button" class="inv-btn ' + r + (ev.status === r ? ' chosen' : '') + '" data-act="rsvp" data-id="' + ev.id + '" data-arg="' + r + '" data-t="' + t + '" aria-haspopup="' + (self.isNew() ? 'false' : 'menu') + '">' + label + (self.isNew() ? '' : ' ' + I('chev-down', 10)) + '</button>';
    }).join('');
    return '<div class="invite" aria-label="Meeting invitation"><div class="inv-title">' + I('calendar', 16) + '<b>' + esc(ev.title) + '</b></div>' +
      '<div class="inv-line">' + I('clock', 13) + ' ' + esc(when) + '</div>' +
      '<div class="inv-line">' + I(ev.teams ? 'video' : 'location', 13) + ' ' + esc(ev.location || 'No location') + '</div>' +
      (conf.length ? '<div class="inv-conf" role="alert">' + I('flag', 13) + ' Conflicts with: ' + conf.map(function (c) { return esc(c.title) + ' (' + U.fmtTime(new Date(c.start)) + '–' + U.fmtTime(new Date(c.end)) + ')'; }).join(', ') + '</div>' : '') +
      '<div class="inv-actions" role="group" aria-label="Respond to meeting">' + btns + '</div>' + resp + '</div>';
  };

  S.tplReading = function (m, single) {
    var self = this, isNew = this.isNew();
    if (!m || m.folder === 'nope') {
      return '<div class="rp-empty">' + I(isNew ? 'mail-read' : 'mail', 40) + '<p>Select an item to read</p><small>Nothing is selected</small></div>';
    }
    var c = this.contact(m.from) || { name: String(m.from), email: '' };
    var outgoing = m.folder === 'sent' || m.folder === 'outbox';
    var to = this.recipientsLabel(m.to), cc = this.recipientsLabel(m.cc);
    var html = '<article class="rp-msg">';
    if (single) html += '<button type="button" class="rp-back" data-act="back" data-t="rp-back">' + I('chev-left', 14) + ' Back to list</button>';
    html += '<header class="rp-head"><h2 class="rp-subj">' + esc(m.subject) + '</h2>' +
      '<div class="rp-meta"><span class="av lg" style="background:' + U.colorFor(c.name) + '" aria-hidden="true">' + esc(U.initials(c.name)) + '</span>' +
      '<div class="rp-who"><div class="rp-name"><b>' + esc(c.name) + '</b> <span class="rp-mail">&lt;' + esc(c.email) + '&gt;</span></div>' +
      '<div class="rp-to">To: ' + esc(to || '—') + (cc ? ' &nbsp; Cc: ' + esc(cc) : '') + '</div></div>' +
      '<div class="rp-date">' + esc(U.fmtDate(new Date(m.date)) + ' ' + U.fmtTime(new Date(m.date))) + '</div></div>';
    html += '<div class="rp-actions" role="toolbar" aria-label="Message actions">' +
      '<button type="button" class="rpb" data-act="reply" data-id="' + m.id + '" data-t="rp-reply" aria-label="Reply">' + I('reply', 16) + '<span>Reply</span></button>' +
      '<button type="button" class="rpb" data-act="replyall" data-id="' + m.id + '" data-t="rp-replyall" aria-label="Reply all">' + I('reply-all', 16) + '<span>Reply all</span></button>' +
      '<button type="button" class="rpb" data-act="forward" data-id="' + m.id + '" data-t="rp-forward" aria-label="Forward">' + I('forward', 16) + '<span>Forward</span></button></div></header>';
    if (m.scheduledFor) html += '<div class="note-banner">' + I('clock', 14) + ' Scheduled to send ' + esc(m.scheduledFor) + '</div>';
    if (m.deliverAt) html += '<div class="note-banner">' + I('clock', 14) + ' Delayed delivery: this message will not be delivered before ' + esc(m.deliverAt) + '. It stays in the Outbox until then.</div>';
    if (m.inviteId) html += this.tplInvite(m);
    if (m.attachments.length) {
      html += '<div class="atts" aria-label="Attachments">' + m.attachments.map(function (a) {
        return '<button type="button" class="att" data-act="att" data-id="' + m.id + '" data-arg="' + a.id + '" data-t="att-' + a.id + '" aria-haspopup="menu" aria-expanded="false" aria-label="Attachment ' + esc(a.name) + ', ' + U.fmtSize(a.size) + '">' + self.fileIcon(a.ext) + '<span class="att-t"><b>' + esc(a.name) + '</b><small>' + U.fmtSize(a.size) + '</small></span>' + I('chev-down', 12) + '</button>';
      }).join('') + '</div>';
    }
    html += '<div class="rp-body">' + m.body + '</div></article>';
    return html;
  };

  /* ---------------------------------------------------------------- calendar */
  S.weekDays = function () {
    var ui = this.ui, d = new Date(ui.calDate), out = [];
    if (ui.calView === 'day') return [new Date(d.getFullYear(), d.getMonth(), d.getDate())];
    var dow = d.getDay(), mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (dow === 0 ? 6 : dow - 1));
    var n = ui.calView === 'week' ? 7 : 5;
    for (var i = 0; i < n; i++) out.push(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i));
    return out;
  };

  S.tplCalendar = function () {
    var ui = this.ui, self = this, days = this.weekDays(), isNew = this.isNew(), cfg = this.cfg();
    var H0 = 7, H1 = 19, HH = 46;
    var first = days[0], last = days[days.length - 1];
    var title = ui.calView === 'day' ? U.fmtDate(first) : U.MONTHS_LONG[first.getMonth()] + ' ' + first.getDate() + ' – ' + (last.getMonth() !== first.getMonth() ? U.MONTHS_LONG[last.getMonth()] + ' ' : '') + last.getDate() + ', ' + last.getFullYear();
    var html = '<div class="cal"><div class="cal-head"><div class="cal-nav"><button type="button" class="cn" data-act="cal-nav" data-arg="-1" data-t="cal-prev" aria-label="Previous ' + (ui.calView === 'day' ? 'day' : 'week') + '">' + I('chev-left', 16) + '</button>' +
      '<button type="button" class="cn" data-act="cal-nav" data-arg="1" data-t="cal-next" aria-label="Next ' + (ui.calView === 'day' ? 'day' : 'week') + '">' + I('chev-right', 16) + '</button>' +
      '<button type="button" class="cn txt" data-act="cal-today" data-t="cal-today">Today</button></div><h2 class="cal-title">' + title + '</h2></div>';
    html += '<div class="cal-scroll"><div class="cal-grid" style="--cols:' + days.length + ';--hh:' + HH + 'px">';
    html += '<div class="cg-corner"></div>';
    days.forEach(function (d) {
      var isToday = U.sameDay(d, new Date(OT.data.NOW));
      html += '<div class="cg-dayhead' + (isToday ? ' today' : '') + '"><span>' + U.DAYS[d.getDay()] + '</span><b>' + d.getDate() + '</b></div>';
    });
    html += '<div class="cg-times">';
    for (var h = H0; h < H1; h++) html += '<div class="cg-time"><span>' + ((h % 12) || 12) + ' ' + (h < 12 ? 'AM' : 'PM') + '</span></div>';
    html += '</div>';
    days.forEach(function (d) {
      html += '<div class="cg-col" role="group" aria-label="' + esc(U.fmtDate(d)) + '">';
      for (var h = H0; h < H1; h++) {
        var work = h >= cfg.workStart && h < cfg.workEnd;
        var start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h).getTime();
        html += '<button type="button" class="slot' + (work ? ' work' : '') + '" data-act="cal-slot" data-start="' + start + '" aria-label="New event ' + esc(U.fmtShort(d) + ' ' + ((h % 12) || 12) + (h < 12 ? ' AM' : ' PM')) + '" tabindex="-1" data-t="slot-' + U.isoDate(d) + '-' + h + '"></button>';
      }
      self.s.events.filter(function (ev) {
        if (!U.sameDay(new Date(ev.start), d)) return false;
        if (ev.status === 'declined') return isNew && cfg.showDeclined;
        return true;
      }).forEach(function (ev) {
        var s = new Date(ev.start), e = new Date(ev.end);
        var top = ((s.getHours() + s.getMinutes() / 60) - H0) * HH, hgt = Math.max(20, ((e - s) / 3600000) * HH - 2);
        html += '<button type="button" class="ev st-' + ev.status + '" style="top:' + top + 'px;height:' + hgt + 'px" data-act="event-open" data-id="' + ev.id + '" data-t="ev-' + ev.id + '" aria-label="' + esc(ev.title + ', ' + U.fmtTime(s) + ' to ' + U.fmtTime(e) + (ev.status === 'pending' ? ', not responded' : ev.status === 'declined' ? ', declined' : '')) + '"><b>' + esc(ev.title) + '</b><span>' + U.fmtTime(s) + '</span></button>';
      });
      html += '</div>';
    });
    html += '</div></div>';
    var sel = ui.selEvent ? this.event(ui.selEvent) : null;
    if (sel) html += this.tplEventDetail(sel);
    return html + '</div>';
  };

  S.tplEventDetail = function (ev) {
    var self = this, s = new Date(ev.start), e = new Date(ev.end), conf = this.conflictsFor(ev);
    var att = ev.attendees.map(function (a) {
      var r = { accepted: 'Accepted', tentative: 'Tentative', declined: 'Declined', none: 'No response' }[a.resp] || a.resp;
      return '<li><span>' + esc(self.name(a.id)) + (a.type === 'optional' ? ' (optional)' : '') + '</span><em>' + r + '</em></li>';
    }).join('');
    var mine = ev.organizer !== 'jordan' && ev.attendees.some(function (a) { return a.id === 'jordan'; });
    var rs = mine ? ['accepted', 'tentative', 'declined'].map(function (r) {
      var label = { accepted: 'Accept', tentative: 'Tentative', declined: 'Decline' }[r];
      return '<button type="button" class="inv-btn ' + r + (ev.status === r ? ' chosen' : '') + '" data-act="rsvp" data-id="' + ev.id + '" data-arg="' + r + '" data-t="rsvp-' + { accepted: 'accept', tentative: 'tentative', declined: 'decline' }[r] + '">' + label + (self.isNew() ? '' : ' ' + I('chev-down', 10)) + '</button>';
    }).join('') : '';
    return '<div class="evd" role="dialog" aria-label="Event details" data-t="event-detail"><div class="evd-h"><b>' + esc(ev.title) + '</b><button type="button" class="x" data-act="event-close" aria-label="Close details" data-t="event-close">' + I('x', 14) + '</button></div>' +
      '<div class="evd-l">' + I('clock', 13) + ' ' + esc(U.fmtDate(s) + ', ' + U.fmtTime(s) + ' – ' + U.fmtTime(e)) + '</div>' +
      '<div class="evd-l">' + I(ev.teams ? 'video' : 'location', 13) + ' ' + esc(ev.location || 'No location') + (ev.teams ? ' <small>(Microsoft Teams meeting)</small>' : '') + '</div>' +
      '<div class="evd-l">' + I('user', 13) + ' Organizer: ' + esc(this.name(ev.organizer)) + '</div>' +
      (conf.length && ev.status !== 'declined' ? '<div class="inv-conf" role="alert">' + I('flag', 13) + ' Conflicts with: ' + conf.map(function (c) { return esc(c.title); }).join(', ') + '</div>' : '') +
      (att ? '<ul class="evd-att" aria-label="Attendees">' + att + '</ul>' : '') +
      (rs ? '<div class="inv-actions">' + rs + '</div>' : '') +
      '<div class="evd-foot"><button type="button" class="btn danger" data-act="event-delete" data-id="' + ev.id + '" data-t="event-delete">' + I('trash', 13) + ' ' + (ev.organizer === 'jordan' ? 'Cancel meeting' : 'Delete') + '</button></div></div>';
  };

  S.openEventDetails = function (id, el) {
    this.ui.selEvent = id;
    this.emit('event-open', { id: id });
    this.render();
  };

  S.tplSide = function () {
    if (!this.isNew() || !this.ui.myday) return '';
    var self = this, today = new Date(OT.data.NOW);
    var evs = this.s.events.filter(function (e) { return U.sameDay(new Date(e.start), today) && e.status !== 'declined'; }).sort(function (a, b) { return a.start - b.start; });
    return '<div class="side-h"><b>My Day</b><button type="button" class="x" data-act="myday" aria-label="Close My Day" data-t="myday-close">' + I('x', 14) + '</button></div><div class="side-d">' + U.fmtDate(today) + '</div>' +
      (evs.length ? '<ul class="side-l">' + evs.map(function (e) { return '<li><span class="t">' + U.fmtTime(new Date(e.start)) + '</span><span>' + esc(e.title) + '</span></li>'; }).join('') + '</ul>' : '<p class="side-e">No events today.</p>');
  };

  /* ------------------------------------------------------------------ people */
  S.tplPeople = function () {
    var ui = this.ui, self = this, q = ui.peopleQuery.toLowerCase();
    var list = Object.keys(this.s.contacts).map(function (k) { return self.s.contacts[k]; }).filter(function (c) { return c.id !== 'jordan' && (!q || (c.name + ' ' + c.email + ' ' + c.title).toLowerCase().indexOf(q) !== -1); }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    var sel = ui.peopleSel ? this.contact(ui.peopleSel) : null;
    var rows = list.map(function (c) {
      return '<button type="button" class="prow' + (sel && sel.id === c.id ? ' on' : '') + '" data-act="people-select" data-id="' + c.id + '" data-t="pp-' + c.id + '"><span class="av" style="background:' + U.colorFor(c.name) + '" aria-hidden="true">' + esc(U.initials(c.name)) + '</span><span class="pr-t"><b>' + esc(c.name) + '</b><small>' + esc(c.title) + '</small></span></button>';
    }).join('');
    var detail = sel ? '<div class="pdet"><span class="av xl" style="background:' + U.colorFor(sel.name) + '" aria-hidden="true">' + esc(U.initials(sel.name)) + '</span><h2>' + esc(sel.name) + '</h2><p>' + esc(sel.title) + (sel.dept ? ' · ' + esc(sel.dept) : '') + '</p><dl><dt>Email</dt><dd>' + esc(sel.email) + '</dd>' + (sel.phone ? '<dt>Phone</dt><dd>' + esc(sel.phone) + '</dd>' : '') + '</dl>' +
      '<div class="pd-act"><button type="button" class="btn primary" data-act="people-mail" data-id="' + sel.id + '" data-t="pd-mail">' + I('mail', 14) + ' Send email</button><button type="button" class="btn" data-act="people-meet" data-id="' + sel.id + '" data-t="pd-meet">' + I('calendar-add', 14) + ' Schedule meeting</button></div></div>'
      : '<div class="rp-empty">' + I('people', 40) + '<p>Select a contact</p><small>Contact details appear here</small></div>';
    return '<div class="people"><section class="plist" aria-label="Contacts"><div class="p-search"><input id="sim-people-q" type="search" placeholder="Search contacts" aria-label="Search contacts" value="' + esc(ui.peopleQuery) + '"></div><div class="p-rows">' + rows + '</div></section><section class="pdetail" aria-label="Contact details">' + detail + '</section></div>';
  };
})();
