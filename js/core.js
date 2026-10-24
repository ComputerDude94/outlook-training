/* ==========================================================================
   core.js — shared utilities: namespace, event bus, DOM helpers, icons, storage
   Everything lives under the single global `OT` (no build step, no modules,
   so the app runs from file://, SharePoint, or any static host).
   ========================================================================== */
(function () {
  'use strict';
  var OT = (window.OT = window.OT || {});

  /* ---------- Tiny event bus ---------- */
  var handlers = {};
  OT.bus = {
    on: function (name, fn) { (handlers[name] = handlers[name] || []).push(fn); return fn; },
    off: function (name, fn) {
      handlers[name] = (handlers[name] || []).filter(function (f) { return f !== fn; });
    },
    emit: function (name, data) {
      (handlers[name] || []).slice().forEach(function (fn) {
        try { fn(data); } catch (e) { if (window.console) console.error('[OT.bus]', name, e); }
      });
    }
  };

  /* ---------- Utilities ---------- */
  var util = (OT.util = {});

  util.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  util.$ = function (sel, root) { return (root || document).querySelector(sel); };
  util.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  util.clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  var uidCounter = 0;
  util.uid = function (p) { uidCounter += 1; return (p || 'id') + '-' + uidCounter + '-' + Math.random().toString(36).slice(2, 6); };

  util.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  util.DAYS = DAYS; util.DAYS_LONG = DAYS_LONG; util.MONTHS = MONTHS; util.MONTHS_LONG = MONTHS_LONG;

  util.pad = function (n) { return (n < 10 ? '0' : '') + n; };
  util.fmtTime = function (d) {
    var h = d.getHours(), m = d.getMinutes();
    return (h % 12 || 12) + ':' + util.pad(m) + ' ' + (h < 12 ? 'AM' : 'PM');
  };
  util.fmtDate = function (d) { return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); };
  util.fmtShort = function (d) { return DAYS[d.getDay()] + ' ' + MONTHS[d.getMonth()] + ' ' + d.getDate(); };
  util.isoDate = function (d) { return d.getFullYear() + '-' + util.pad(d.getMonth() + 1) + '-' + util.pad(d.getDate()); };
  util.isoTime = function (d) { return util.pad(d.getHours()) + ':' + util.pad(d.getMinutes()); };
  util.sameDay = function (a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  };
  util.dayDiff = function (a, b) {
    var x = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    var y = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((x - y) / 86400000);
  };
  util.parseLocal = function (dateStr, timeStr) {
    var dp = String(dateStr || '').split('-'), tp = String(timeStr || '00:00').split(':');
    if (dp.length !== 3) return null;
    var d = new Date(+dp[0], +dp[1] - 1, +dp[2], +tp[0] || 0, +tp[1] || 0);
    return isNaN(d.getTime()) ? null : d;
  };
  util.fmtSize = function (kb) { return kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB'; };
  util.initials = function (name) {
    var p = String(name).replace(/[^A-Za-z0-9 &]/g, '').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  };
  var PALETTE = ['#0F6CBD', '#8764B8', '#038387', '#C239B3', '#CA5010', '#498205', '#B146C2', '#005B70', '#986F0B', '#4F6BED'];
  util.colorFor = function (s) {
    var h = 0; s = String(s);
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
  };
  util.stripHtml = function (h) { return String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); };
  util.plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); };

  /* ---------- Icons (stroke-based, 24px grid, inherit currentColor) ---------- */
  var P = {
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    'mail-read': '<path d="M3 10l9-6 9 6v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 10l9 6 9-6"/>',
    'mail-unread': '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M3 9l9 6 9-6"/><circle cx="19" cy="5" r="2.5" fill="currentColor" stroke="none"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    'calendar-add': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
    people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3.2-6 6.5-6s6 2 6.5 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14c2.8 0 4.5 1.6 5 4.5"/>',
    apps: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    flag: '<path d="M5 21V4M5 4h13l-2.5 4 2.5 4H5"/>',
    pin: '<path d="M9 3h6l-1 6 3 3H7l3-3zM12 12v9"/>',
    reply: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v4"/>',
    'reply-all': '<path d="M7 14L2 9l5-5"/><path d="M12 14L7 9l5-5"/><path d="M7 9h8a6 6 0 0 1 6 6v4"/>',
    forward: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0-6 6v4"/>',
    attach: '<path d="M20 11l-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7L9.5 17a1.7 1.7 0 0 1-2.4-2.4L14.5 7"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.5l1.4 2.2 2.6-.6.9 2.5 2.5.9-.6 2.6L20.5 12l-2.2 1.4.6 2.6-2.5.9-.9 2.5-2.6-.6L12 20.5l-1.4-2.2-2.6.6-.9-2.5-2.5-.9.6-2.6L3.5 12l2.2-1.4-.6-2.6 2.5-.9.9-2.5 2.6.6z"/>',
    folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    'folder-plus': '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M12 11v5M9.5 13.5h5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    'chev-down': '<path d="M6 9l6 6 6-6"/>',
    'chev-right': '<path d="M9 6l6 6-6 6"/>',
    'chev-left': '<path d="M15 6l-6 6 6 6"/>',
    'chev-up': '<path d="M6 15l6-6 6 6"/>',
    undo: '<path d="M8 5L3 10l5 5"/><path d="M3 10h10a6 6 0 0 1 0 12h-3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
    sort: '<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/>',
    more: '<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11h14V8M10 12h4"/>',
    send: '<path d="M3 12L21 4l-4 17-5-6z"/><path d="M12 15l9-11"/>',
    bell: '<path d="M6 17v-6a6 6 0 0 1 12 0v6l2 2H4zM10 21h4"/>',
    sweep: '<path d="M14 3l7 7"/><path d="M12 5l7 7-5 5-7-7z"/><path d="M7 12l-4 8 8-4"/>',
    move: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 13h6M13 10l3 3-3 3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.7-4.5 4-7 8-7s7.3 2.5 8 7"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
    location: '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M13 4v16"/>',
    density: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    ribbon: '<rect x="3" y="5" width="18" height="6" rx="1"/><path d="M3 15h18M3 19h12"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.2L4 9M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.5 4.2L20 15M20 20v-5h-5"/>',
    printer: '<path d="M7 9V3h10v6M7 17H4v-6h16v6h-3M7 14h10v7H7z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/>',
    puzzle: '<path d="M9 4h4a2 2 0 1 1 4 0h3v5a2 2 0 1 0 0 4v5H4v-5a2 2 0 1 1 0-4V4z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a3 3 0 0 0 4 3M16 6h4v1a3 3 0 0 1-4 3M12 13v4M8 20h8M10 17h4"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    home: '<path d="M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10"/>',
    chart: '<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    spinner: '<path d="M12 3a9 9 0 1 0 9 9" />'
  };
  OT.icon = function (name, size, cls) {
    var s = size || 16;
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (P[name] || P.file) + '</svg>';
  };

  /* ---------- Resilient storage (localStorage with in-memory fallback) ---------- */
  var mem = {};
  var storageOK = (function () {
    try {
      var k = '__ot_test__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();
  OT.storage = {
    persistent: storageOK,
    get: function (key) {
      try { return storageOK ? window.localStorage.getItem(key) : (key in mem ? mem[key] : null); }
      catch (e) { return key in mem ? mem[key] : null; }
    },
    set: function (key, val) {
      mem[key] = val;
      try { if (storageOK) window.localStorage.setItem(key, val); } catch (e) { /* quota or blocked */ }
    },
    remove: function (key) {
      delete mem[key];
      try { if (storageOK) window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  };
})();
