/* ==========================================================================
   lessons.js — lesson content and step validation rules (data only)

   Step fields
     id      unique within the lesson
     part    'classic' | 'new'   (the simulator is switched to this mode when the step starts)
     title   short label
     do      instruction (HTML allowed)
     target  data-t keys to highlight. An array is a path: the LAST key currently on screen is
             highlighted (e.g. ['tab-view','b-readingpane','rp-bottom']). May be a function(sim).
     callout short bubble text next to the highlight
     done    function(event, sim) -> true when the learner really performed the action
             (also polled with event === null so state-based checks work)
     wrong   function(event, sim) -> feedback string when a recognisable mistake happens
     hint    shown on request (and automatically after 2 mistakes or ~25s idle)
     why     "what to remember" shown after success; steps without it advance automatically
     auto    function(sim) run once when the step starts (used to pre-fill a message)
     free    true = do not force the part's mode (used by the toggle lesson)
   Question steps: { type:'q', q, options:[...], answer:index, why }
   ========================================================================== */
(function () {
  'use strict';
  var OT = window.OT;

  /* ----------------------------------------------------------------- helpers */
  function ev(type, pred) { return function (e, sim) { return !!e && e.type === type && (!pred || pred(e, sim)); }; }
  function val(sim, sel) { var n = sim.root.querySelector(sel); return n ? n.value : ''; }
  function hasR(list, id) { return (list || []).some(function (r) { return r.id === id || r.email === id; }); }
  function comp(sim) { return sim.ui.compose; }
  function evf(sim) { return sim.ui.evform; }
  function folderByName(sim, re) { return sim.s.folders.filter(function (f) { return !f.sys && re.test(f.name); })[0] || null; }
  function pre(sim, to, subject, body) {
    sim.openCompose({ kind: 'new', restore: { to: to.map(function (t) { return sim.rcptFor(t); }), subject: subject, body: body } });
  }
  /* state-aware targets: guide the learner through prerequisites (open folder, select message, ribbon tab) */
  function pick(id, path, tab) {
    return function (sim) {
      var m = sim.msg(id); if (!m) return path;
      if (sim.ui.menu || sim.ui.dialog) return path;
      if (sim.ui.app !== 'mail') return ['rail-mail'];
      if (!sim.ui.search.active && sim.ui.folder !== m.folder) return ['f-' + m.folder];
      if (sim.ui.sel !== id) return ['row-' + id];
      if (tab && sim.ui.tab !== tab && !sim.ui.menu) return ['tab-' + tab];
      return path;
    };
  }
  function inTab(tab, path) { return function (sim) { return (sim.ui.menu || sim.ui.tab === tab) ? path : ['tab-' + tab]; }; }
  function dlgOpen(sim, id) { return sim.ui.dialog && sim.ui.dialog.id === id; }
  function rcptTarget(field, who, inputKey, sugKey, then) {
    return function (sim) { var c = comp(sim) || evf(sim); if (c && hasR(c[field], who)) return then; return [inputKey, sugKey]; };
  }
  function q(text, options, answer, why) { return { type: 'q', title: 'Quick check', q: text, options: options, answer: answer, why: why }; }

  var MODULES = [
    { id: 'm1', title: 'Getting started', blurb: 'Switch between the two apps and learn where the main controls live.' },
    { id: 'm2', title: 'Reading and writing mail', blurb: 'Read, compose, reply and forward in each app.' },
    { id: 'm3', title: 'Organizing your mailbox', blurb: 'Delete and recover, search, folders and rules, flags, pins and attachments.' },
    { id: 'm4', title: 'Calendar and meetings', blurb: 'Respond to invitations and schedule a Teams meeting.' },
    { id: 'm5', title: 'Settings and finding features', blurb: 'Send later, personalize the app, and find what moved.' }
  ];

  var LESSONS = [];

  /* =========================================================== 1. The toggle */
  LESSONS.push({
    id: 'l1', module: 'm1', title: 'Switching between Classic and New Outlook', mins: 4,
    objective: 'Turn the new Outlook on, understand what stays the same, and switch back to classic.',
    intro: 'Both apps open the same mailbox. The switch in the top-right corner of the window moves you between them, so you can try new Outlook without losing classic.',
    compare: [
      ['Where is the switch?', 'Top-right corner, labelled “Try the new Outlook”.', 'Top-right corner, labelled “New Outlook”. Selecting it shows how to go back.', 'moved'],
      ['Your mail, calendar, contacts', 'Stored in your mailbox on the server.', 'The same mailbox: nothing is moved or deleted when you switch.', 'same'],
      ['App settings (layout, theme, ribbon)', 'Kept in classic Outlook.', 'Kept separately in new Outlook, so you may need to set preferences twice.', 'different'],
      ['Availability', 'Your organization can control whether the toggle appears.', 'Some features are still rolling out or are not supported, see the Reference page.', 'partial']
    ],
    steps: [
      { id: 's1', part: 'classic', mode: 'classic', free: true, title: 'Find the switch', callout: 'Turn this on',
        do: 'You are in <b>classic Outlook</b>. In the top-right corner, turn on <b>Try the new Outlook</b>.',
        target: ['toggle'], done: ev('toggle-mode', function (e) { return e.mode === 'new'; }),
        hint: 'Look at the very top-right of the window for a switch next to the words “Try the new Outlook”.',
        why: 'The switch looks the same in every build, but whether you see it depends on your organization’s settings. Your mailbox itself is unchanged.' },
      q('You just switched apps. What happened to your messages, calendar and contacts?',
        ['They were copied to a new mailbox', 'Nothing: both apps show the same mailbox', 'They were moved and are gone from classic', 'Only the inbox was kept'], 1,
        'Both apps connect to the same mailbox on the server. Only the app on your PC changes. (App-level preferences such as layout and theme are kept per app.)'),
      { id: 's3', part: 'new', mode: 'new', free: true, title: 'See the way back', callout: 'Select the switch',
        do: 'You are now in <b>new Outlook</b>. Select the <b>New Outlook</b> switch again to see your options for returning to classic.',
        target: ['toggle'], done: ev('menu-open', function (e) { return e.id === 'mode-new'; }),
        hint: 'The same switch in the top-right corner. Select it once.' },
      { id: 's4', part: 'new', mode: 'new', free: true, title: 'Go back to classic', callout: 'Switch back',
        do: 'Choose <b>Switch back to classic Outlook</b>.',
        target: ['toggle', 'mode-switchback'], done: ev('toggle-mode', function (e) { return e.mode === 'classic'; }),
        wrong: function (e) { return (e.type === 'toggle-mode' && e.mode === 'classic' && e.variant === 'once') ? 'That option opens classic just this time. Choose “Switch back to classic Outlook” to make the change stay.' : null; },
        hint: 'Open the switch menu and pick the first option, “Switch back to classic Outlook”.',
        why: 'Switching back is always possible while classic Outlook is supported, so trying new Outlook is low-risk. “Use classic Outlook this time” only opens classic once.' }
    ]
  });

  /* ====================================================== 2. Getting around */
  LESSONS.push({
    id: 'l2', module: 'm1', title: 'Finding your way around', mins: 5,
    objective: 'Recognize the ribbon, the navigation rail, Settings and My Day in each app.',
    intro: 'Classic Outlook has a File tab and a full ribbon. New Outlook has no File tab: it uses a simplified ribbon and a Settings gear.',
    compare: [
      ['Ribbon', 'Tabs: File, Home, Send / Receive, Folder, View, Help.', 'Home, View and Help. A simplified ribbon is the default; you can switch to the classic ribbon layout.', 'different'],
      ['File tab / Options', 'File tab opens Info, Office Account and Options.', 'No File tab. Settings (gear icon) holds options such as Appearance, Mail rules and Automatic replies.', 'moved'],
      ['Switching apps', 'Navigation bar at the left (Mail, Calendar, People).', 'App bar at the left with Mail, Calendar and People.', 'same'],
      ['My Day', 'Not available.', 'A side panel with your agenda and tasks.', 'new']
    ],
    steps: [
      { id: 's1', part: 'classic', mode: 'classic', title: 'Tour the ribbon tabs', callout: 'Open this tab',
        do: 'In <b>classic Outlook</b>, select the <b>Send / Receive</b> tab on the ribbon.',
        target: ['tab-sendreceive'], done: ev('ribbon-tab', function (e) { return e.tab === 'sendreceive'; }),
        hint: 'The tab strip is just above the buttons: File, Home, Send / Receive, Folder, View, Help.' },
      { id: 's2', part: 'classic', mode: 'classic', title: 'Open the File tab', callout: 'File tab',
        do: 'Select the <b>File</b> tab. In classic Outlook this opens the “backstage” area with Info, Office Account and Options.',
        target: ['tab-file'], done: ev('backstage-open'),
        hint: 'File is the first tab on the left of the ribbon.',
        why: 'The File tab is classic-only. In new Outlook those options live in Settings (the gear).' },
      { id: 's3', part: 'classic', mode: 'classic', title: 'Return to your mail', callout: 'Back',
        do: 'Select the <b>back arrow</b> to leave the File tab.',
        target: ['bs-back'], done: ev('backstage-close'), hint: 'The arrow at the top-left of the File screen.' },
      { id: 's4', part: 'classic', mode: 'classic', title: 'Open the Calendar', callout: 'Calendar',
        do: 'Use the navigation bar at the left and select <b>Calendar</b>.',
        target: ['rail-calendar'], done: ev('app', function (e) { return e.app === 'calendar'; }),
        hint: 'The left navigation bar has icons for Mail, Calendar and People. Hover to see the names.' },
      { id: 's5', part: 'new', mode: 'new', title: 'Try the classic ribbon layout', callout: 'Switch ribbon',
        do: 'You are now in <b>new Outlook</b>. At the right end of the ribbon, select the control that switches to the <b>classic ribbon</b>.',
        target: ['tab-home', 'ribbon-style'], done: ev('ribbon-style', function (e) { return e.style === 'classic'; }),
        hint: 'Go back to Mail first if needed. The ribbon-style control is the small button at the right end of the ribbon.',
        wrong: function (e, sim) { return e.type === 'ribbon-style' && e.style === 'simplified' ? 'That switched back to the simplified ribbon. Select the control once more to get the classic ribbon layout.' : null; },
        why: 'New Outlook starts with a simplified ribbon (a single compact row). The classic ribbon layout shows labelled groups like classic Outlook, but the commands are the new Outlook ones.' },
      { id: 's6', part: 'new', mode: 'new', title: 'Open Settings', callout: 'Settings',
        do: 'Select the <b>Settings</b> gear in the top-right corner.',
        target: ['settings-gear'], done: ev('settings-open'),
        hint: 'The gear icon sits at the top-right, left of nothing else, right of My Day.',
        why: 'Settings replaces most of what classic put behind File &gt; Options.' },
      { id: 's7', part: 'new', mode: 'new', title: 'Close Settings', callout: 'Close',
        do: 'Close the Settings window.', target: ['settings-close'], done: ev('settings-close'), hint: 'Use the X at the top-right of the Settings window.' },
      { id: 's8', part: 'new', mode: 'new', title: 'Open My Day', callout: 'My Day',
        do: 'Select <b>My Day</b> (the sun icon) to see today’s agenda beside your mail.',
        target: ['myday'], done: ev('myday', function (e) { return e.open; }),
        hint: 'The sun icon in the top-right corner, next to the gear.',
        why: 'My Day is a new Outlook panel. Classic has no equivalent; there you open the Calendar or the To-Do Bar.' }
    ]
  });

  /* ============================================================ 3. Reading */
  LESSONS.push({
    id: 'l3', module: 'm2', title: 'Reading mail and the message list', mins: 6,
    objective: 'Open messages, change read status, filter unread mail and change the reading pane.',
    intro: 'The reading pane and the message list behave the same way in both apps, but the commands for filtering, density and layout live in different places.',
    compare: [
      ['Show only unread', 'Message list header: All | Unread.', 'Filter button above the list (All, Unread, Flagged, Has files).', 'moved'],
      ['Reading pane position', 'View &gt; Reading Pane (Right, Bottom, Off).', 'View &gt; Layout &gt; Reading pane (Show on the right, Show on the bottom, Hide).', 'moved'],
      ['List size', 'View &gt; Change View (Compact, Single, Preview).', 'View &gt; Density (Roomy, Cozy, Compact).', 'different'],
      ['Mark read / unread', 'Home &gt; Unread/Read.', 'Home &gt; Read / Unread.', 'same']
    ],
    steps: [
      { id: 's1', part: 'classic', mode: 'classic', title: 'Open a message', callout: 'Select this',
        do: 'In classic Outlook, select the unread message from <b>Priya Nair</b>: “Q4 budget review – numbers attached”.',
        target: ['row-m1'], done: ev('open-message', function (e) { return e.id === 'm1'; }),
        hint: 'Unread messages are shown in bold. Look for Priya Nair near the top of the Inbox.' },
      { id: 's2', part: 'classic', mode: 'classic', title: 'Mark it unread again', callout: 'Unread',
        do: 'You have read it, so it is no longer bold. Use <b>Home &gt; Unread/Read</b> to mark it unread again.',
        target: ['tab-home', 'b-unread'], done: ev('read', function (e) { return e.id === 'm1' && e.read === false; }),
        hint: 'On the Home tab, in the Tags group, the button reads “Unread” when the message is read.',
        why: 'Marking mail unread is a good reminder to return to it. In classic Outlook the same command is in the Tags group.' },
      { id: 's3', part: 'classic', mode: 'classic', title: 'Show unread mail only', callout: 'Unread',
        do: 'Above the message list, select <b>Unread</b> to hide everything you have already read.',
        target: ['list-unread'], done: ev('list-filter', function (e) { return e.value === 'unread'; }),
        hint: 'At the top of the message list there are two links: All and Unread.' },
      { id: 's4', part: 'classic', mode: 'classic', title: 'Move the reading pane', callout: 'Reading Pane',
        do: 'Open <b>View &gt; Reading Pane</b> and choose <b>Bottom</b>.',
        target: ['tab-view', 'b-readingpane', 'rp-bottom'], done: ev('setting', function (e) { return e.key === 'reading' && e.value === 'bottom'; }),
        hint: 'Select the View tab, then the Reading Pane button in the Layout group, then Bottom.',
        why: 'Layout settings are saved per app. Changing the pane in classic does not change it in new Outlook.' },
      { id: 's5', part: 'new', mode: 'new', title: 'Open a message in new Outlook', callout: 'Select this',
        do: 'Now in <b>new Outlook</b>, select the message from <b>Marcus Chen</b>: “Warehouse walkthrough – Wednesday 2:30 PM”.',
        target: ['row-m10'], done: ev('open-message', function (e) { return e.id === 'm10'; }),
        hint: 'Marcus Chen’s message is in bold in the list.' },
      { id: 's6', part: 'new', mode: 'new', title: 'Filter the list', callout: 'Filter',
        do: 'Use the <b>Filter</b> button above the message list and choose <b>Unread</b>.',
        target: ['list-filter', 'lf-unread'], done: ev('list-filter', function (e) { return e.value === 'unread'; }),
        hint: 'The Filter button is at the top of the list, to the right of the folder name.',
        why: 'The Filter menu also holds Flagged and Has files, and Sort by lives in the same menu.' },
      { id: 's7', part: 'new', mode: 'new', title: 'Change the layout', callout: 'Layout',
        do: 'Open <b>View &gt; Layout</b> and choose <b>Show on the bottom</b> for the reading pane.',
        target: ['tab-view', 'b-layout', 'rp-bottom'], done: ev('setting', function (e) { return e.key === 'reading' && e.value === 'bottom'; }),
        hint: 'View tab, then Layout, then “Show on the bottom”.' }
    ]
  });

  /* ========================================================== 4. Compose */
  LESSONS.push({
    id: 'l4', module: 'm2', title: 'Writing a new message', mins: 7,
    objective: 'Start a message, add recipients, subject and text, and send it, in both apps.',
    intro: 'The steps are the same, but the screen is not: classic opens a message in its own window with its own ribbon; new Outlook writes in a pane inside the main window.',
    compare: [
      ['Where you write', 'A separate message window with Message, Insert, Options tabs.', 'A compose pane inside the main window.', 'different'],
      ['Adding recipients', 'Type in To, or choose the To… button to open the Address Book.', 'Type a name in To and pick a suggestion. Cc is a link on the right.', 'different'],
      ['Sending', 'Send button at the left of the message window.', 'Send button; the arrow beside it holds Schedule send.', 'moved'],
      ['After you send', 'Message goes to Sent Items immediately.', 'By default a short “Undo” window holds the message (Undo send, new Outlook only).', 'new']
    ],
    steps: [
      { id: 's1', part: 'classic', mode: 'classic', title: 'Start a new email', callout: 'New Email',
        do: 'In <b>classic Outlook</b>, select <b>Home &gt; New Email</b>.', target: ['b-new-mail'],
        done: ev('compose-open', function (e) { return e.kind === 'new'; }), hint: 'The big New Email button is the first button on the Home tab.' },
      { id: 's2', part: 'classic', mode: 'classic', title: 'Add a recipient', callout: 'To',
        do: 'In the <b>To</b> box, type <b>Priya</b> and choose <b>Priya Nair</b> from the suggestions (or press Enter).',
        target: ['c-to-input', 'sug-priya'], poll: true,
        done: function (e, sim) { return comp(sim) && hasR(comp(sim).to, 'priya'); },
        wrong: function (e) { return e && e.type === 'compose-error' ? 'Outlook cannot send without a recipient. Type a name in the To box first.' : null; },
        hint: 'Click in the To box and type the first few letters of her name. A suggestion list appears under the box.' },
      { id: 's3', part: 'classic', mode: 'classic', title: 'Add a subject and text', callout: 'Subject',
        do: 'Type a <b>Subject</b> (for example “Lunch on Friday”) and write a line of text in the message body.',
        target: function (sim) { return val(sim, '#c-subject').trim().length < 3 ? ['c-subject'] : ['c-body']; }, poll: true,
        done: function (e, sim) { return comp(sim) && val(sim, '#c-subject').trim().length >= 3 && val(sim, '#c-body').trim().length >= 3; },
        hint: 'The Subject box is under the To line. The large area below it is the message body.' },
      { id: 's4', part: 'classic', mode: 'classic', title: 'Send it', callout: 'Send',
        do: 'Select <b>Send</b>.', target: ['c-send'],
        done: ev('compose-send', function (e) { return e.delivery === 'immediate' && e.to.indexOf('priya') !== -1; }),
        wrong: function (e) { return e && e.type === 'compose-error' ? 'The message has no recipient. Add Priya to the To box, then send.' : null; },
        hint: 'The Send button is at the left of the message window.',
        why: 'In classic Outlook the message is delivered right away. Closing the window instead would keep a draft in the Drafts folder.' },
      { id: 's5', part: 'new', mode: 'new', title: 'Start a new message', callout: 'New mail',
        do: 'Now in <b>new Outlook</b>, select <b>New mail</b>.', target: ['b-new-mail'],
        done: ev('compose-open', function (e) { return e.kind === 'new'; }), hint: 'New mail is the highlighted button at the left of the Home ribbon.' },
      { id: 's6', part: 'new', mode: 'new', title: 'Add To and Cc', callout: 'To',
        do: 'Add <b>Marcus Chen</b> to <b>To</b>. Then select <b>Cc</b> and add <b>Sam Okafor</b> there.',
        target: function (sim) { var c = comp(sim); if (!c || !hasR(c.to, 'marcus')) return ['c-to-input', 'sug-marcus']; return ['c-showcc', 'c-cc-input', 'sug-sam']; }, poll: true,
        done: function (e, sim) { return comp(sim) && hasR(comp(sim).to, 'marcus') && hasR(comp(sim).cc, 'sam'); },
        hint: 'Type “Marcus” in To and pick the suggestion. Cc is a link at the right end of the To line; after you select it, a Cc row appears.',
        why: 'In new Outlook the Cc and Bcc boxes appear only when you ask for them.' },
      { id: 's7', part: 'new', mode: 'new', title: 'Subject, text and Send', callout: 'Send',
        do: 'Type a <b>subject</b> and some text, then select <b>Send</b>.',
        target: function (sim) { if (val(sim, '#c-subject').trim().length < 3) return ['c-subject']; if (val(sim, '#c-body').trim().length < 3) return ['c-body']; return ['c-send']; },
        done: ev('compose-send', function (e) { return e.to.indexOf('marcus') !== -1 && e.cc.indexOf('sam') !== -1; }),
        wrong: function (e) { return e && e.type === 'compose-error' ? 'Add at least one recipient before you send.' : null; },
        hint: 'Click the Subject line, then the body, then Send at the left of the pane.',
        why: 'You may notice a message at the bottom with an Undo button. That is “Undo send”, which classic Outlook does not have. You will practice it later.' }
    ]
  });

  /* ======================================================= 5. Reply/forward */
  LESSONS.push({
    id: 'l5', module: 'm2', title: 'Reply, Reply All and Forward', mins: 7,
    objective: 'Choose the right response, check who will receive it, and keep attachments when you forward.',
    intro: 'The three response commands exist in both apps. The difference is where you find them and how the reply window appears.',
    compare: [
      ['Where are the commands?', 'Home &gt; Respond group (Reply, Reply All, Forward).', 'Home ribbon, and buttons in the reading pane header.', 'moved'],
      ['Reply window', 'Opens in a message window in this simulator; real classic Outlook can also reply inline, depending on your options.', 'Opens inline in the reading pane, with a pop-out button.', 'different'],
      ['Forwarding attachments', 'Attachments are included.', 'Attachments are included.', 'same']
    ],
    steps: [
      { id: 's1', part: 'classic', mode: 'classic', title: 'Open the thread', callout: 'Select this',
        do: 'In classic Outlook, select Dana Whitfield’s message <b>Re: Atlas rollout – open risks</b>.', target: ['row-m11'],
        done: ev('open-message', function (e) { return e.id === 'm11'; }), hint: 'It is further down the Inbox. Look for the sender name Dana Whitfield.' },
      { id: 's2', part: 'classic', mode: 'classic', title: 'Reply to everyone', callout: 'Reply All',
        do: 'This message went to Priya and Marcus, with Sam on Cc. Select <b>Reply All</b> so everyone sees your answer.',
        target: pick('m11', ['b-replyall'], 'home'), done: ev('compose-open', function (e) { return e.kind === 'replyall'; }),
        wrong: function (e) { return e && e.type === 'compose-open' && (e.kind === 'reply' || e.kind === 'forward') ? 'That is ' + (e.kind === 'reply' ? 'Reply, which goes only to the sender' : 'Forward, which starts a new message') + '. Close that window and choose Reply All to include everyone.' : null; },
        hint: 'On the Home tab, in the Respond group, choose Reply All (not Reply).' },
      { id: 's3', part: 'classic', mode: 'classic', title: 'Check the recipients and send', callout: 'Send',
        do: 'Check the <b>To</b> and <b>Cc</b> boxes: Dana, Priya and Marcus are on To and Sam is on Cc. Add a line of text and select <b>Send</b>.',
        target: ['c-send'], done: ev('compose-send', function (e) { return e.kind === 'replyall' && e.to.indexOf('priya') !== -1 && e.cc.indexOf('sam') !== -1; }),
        hint: 'Type something in the body, then use the Send button at the left of the window.',
        why: 'Reply All sends to everyone on the original To and Cc lines. Check the list before sending, especially for large distribution lists.' },
      { id: 's4', part: 'classic', mode: 'classic', title: 'Forward with attachments', callout: 'Forward',
        do: 'Select Luis Herrera’s <b>Bluebird Foods proposal</b>, choose <b>Forward</b>, address it to <b>Aisha Rahman</b>, and send. Notice that the two attachments come along.',
        target: function (sim) { if (!comp(sim)) return pick('m6', ['b-forward'], 'home')(sim); return hasR(comp(sim).to, 'aisha') ? ['c-send'] : ['c-to-input', 'sug-aisha']; },
        done: ev('compose-send', function (e) { return e.kind === 'forward' && e.to.indexOf('aisha') !== -1 && e.attachments.length >= 2; }),
        wrong: function (e) { return e && e.type === 'compose-send' && e.kind === 'forward' && e.attachments.length < 2 ? 'The attachments were removed before sending. Forward the original again and leave the attachments in place.' : null; },
        hint: 'Select the message first. Then Home &gt; Forward. Type Aisha in To and press Send.' },
      { id: 's5', part: 'new', mode: 'new', title: 'Reply All in new Outlook', callout: 'Reply all',
        do: 'Now in <b>new Outlook</b>, select <b>Luis Herrera’s</b> message about the Bluebird proposal (Priya is on Cc), then choose <b>Reply all</b>.',
        target: pick('m6', ['b-replyall', 'rp-replyall'], 'home'), done: ev('compose-open', function (e) { return e.kind === 'replyall' && e.source === 'm6'; }),
        wrong: function (e) { return e && e.type === 'compose-open' && e.kind === 'reply' ? 'That is Reply, which goes only to the sender. Choose Reply all to include Priya.' : null; },
        hint: 'Select the message, then use Reply all on the ribbon or in the reading pane header.' },
      { id: 's6', part: 'new', mode: 'new', title: 'Send the reply', callout: 'Send',
        do: 'The reply opens <b>inside the reading pane</b>. Add a line of text and select <b>Send</b>.',
        target: ['c-send'], done: ev('compose-send', function (e) { return e.kind === 'replyall' && e.cc.indexOf('priya') !== -1; }),
        hint: 'Click in the body of the reply, type, then Send.' },
      { id: 's7', part: 'new', mode: 'new', title: 'Forward in new Outlook', callout: 'Forward',
        do: 'Select Aisha Rahman’s <b>Riverside Print renewal</b> message, choose <b>Forward</b>, send it to <b>Carla Mendes</b>.',
        target: function (sim) { if (!comp(sim)) return pick('m7', ['b-forward'], 'home')(sim); return hasR(comp(sim).to, 'carla') ? ['c-send'] : ['c-to-input', 'sug-carla']; },
        done: ev('compose-send', function (e) { return e.kind === 'forward' && e.to.indexOf('carla') !== -1 && e.attachments.length >= 1; }),
        hint: 'Select the message, choose Forward, type Carla, then Send.' }
    ]
  });

  /* =============================================== 6. Delete, undo, recover */
  LESSONS.push({
    id: 'l6', module: 'm3', title: 'Deleting, undoing and recovering mail', mins: 6,
    objective: 'Delete a message, undo it, and bring a deleted message back from Deleted Items.',
    intro: 'Deleted messages go to Deleted Items in both apps, so you can usually recover them. The undo command is in a different place.',
    compare: [
      ['Undo a delete', 'Quick Access Toolbar Undo, or Ctrl+Z.', 'Undo on the ribbon or the Undo message that appears; Ctrl+Z also works.', 'moved'],
      ['Recover a deleted message', 'Open Deleted Items and move it back.', 'Open Deleted Items and move it back.', 'same'],
      ['Permanent delete', 'Deleting from Deleted Items asks you to confirm.', 'Deleting from Deleted Items asks you to confirm.', 'same']
    ],
    steps: [
      { id: 's1', part: 'classic', mode: 'classic', title: 'Delete a message', callout: 'Delete',
        do: 'In classic Outlook, select the “Logistics Weekly” newsletter and choose <b>Home &gt; Delete</b>.', target: pick('m15', ['b-delete'], 'home'),
        done: ev('delete', function (e) { return e.id === 'm15'; }), hint: 'Select the message (digest@logisticsweekly) then use the Delete button in the Delete group.' },
      { id: 's2', part: 'classic', mode: 'classic', title: 'Undo it', callout: 'Undo',
        do: 'Changed your mind? Select <b>Undo</b> in the Quick Access Toolbar at the top-left.', target: ['qat-undo'],
        done: ev('undo', function (e) { return e.id === 'm15'; }), hint: 'The curved-arrow button at the very top-left of the window.',
        why: 'Ctrl+Z also undoes a delete or a move in both apps.' },
      { id: 's3', part: 'classic', mode: 'classic', title: 'Delete another message', callout: 'Delete',
        do: 'Select Sam Okafor’s <b>Password expiry reminder</b> and delete it.', target: pick('m16', ['b-delete'], 'home'),
        done: ev('delete', function (e) { return e.id === 'm16'; }), hint: 'Select the message, then Delete.' },
      { id: 's4', part: 'classic', mode: 'classic', title: 'Open Deleted Items', callout: 'Deleted Items',
        do: 'Open the <b>Deleted Items</b> folder in the folder pane.', target: ['hamburger', 'f-deleted'],
        done: ev('folder-select', function (e) { return e.id === 'deleted'; }), hint: 'On a narrow window use the menu button to show the folders.' },
      { id: 's5', part: 'classic', mode: 'classic', title: 'Recover the message', callout: 'Move',
        do: 'Select the password message and use <b>Home &gt; Move &gt; Inbox</b> to put it back.', target: pick('m16', ['b-move', 'mv-inbox'], 'home'),
        done: ev('move', function (e) { return e.id === 'm16' && e.to === 'inbox'; }), hint: 'Select the message, open Move, then pick Inbox.' },
      { id: 's6', part: 'new', mode: 'new', title: 'Delete in new Outlook', callout: 'Delete',
        do: 'In <b>new Outlook</b>, select the <b>Parking lot repaving</b> message and delete it.', target: pick('m13', ['b-delete'], 'home'),
        done: ev('delete', function (e) { return e.id === 'm13'; }), hint: 'Select Tom Becker’s message and use Delete on the ribbon.' },
      { id: 's7', part: 'new', mode: 'new', title: 'Undo with the message bar', callout: 'Undo',
        do: 'A message appears at the bottom with an <b>Undo</b> button. Select it.', target: ['toast-undo', 'b-undo'],
        done: ev('undo', function (e) { return e.id === 'm13'; }), hint: 'The Undo button appears for a few seconds. You can also use Undo on the ribbon, or Ctrl+Z.' },
      { id: 's8', part: 'new', mode: 'new', title: 'Delete and recover', callout: 'Deleted Items',
        do: 'Delete the <b>Lunch Friday?</b> message from Priya, open <b>Deleted Items</b>, and move it back to the Inbox.',
        target: function (sim) { return sim.msg('m14').folder === 'deleted' ? pick('m14', ['b-move', 'mv-inbox'], 'home')(sim) : pick('m14', ['b-delete'], 'home')(sim); },
        done: ev('move', function (e) { return e.id === 'm14' && e.to === 'inbox'; }), hint: 'Delete it, open Deleted Items, select it there, then Move &gt; Inbox.',
        why: 'Deleted Items is a safety net. An organization can set rules for how long items are kept there.' }
    ]
  });

  /* =========================================================== 7. Search */
  LESSONS.push({
    id: 'l7', module: 'm3', title: 'Searching and filtering', mins: 6,
    objective: 'Find a message with search, widen the scope, and filter results.',
    intro: 'Both apps use the search box at the top. Classic adds a Search tab on the ribbon; new Outlook shows suggestions and filter chips.',
    compare: [
      ['Where do filters live?', 'The contextual Search tab on the ribbon (Scope, Has Attachments, Unread, This Week).', 'Filter chips under the search box (Unread, Flagged, From, Date, Has files).', 'moved'],
      ['Search scope', 'Current Folder or Current Mailbox (Search tab &gt; Scope).', 'Current folder or All folders (scope chip).', 'different'],
      ['Search suggestions', 'Search tab only appears after you start a search.', 'Suggestions appear as you type, including “Messages from” a person.', 'new']
    ],
    steps: [
      { id: 's1', part: 'classic', mode: 'classic', title: 'Run a search', callout: 'Search',
        do: 'In classic Outlook, click the search box, type <b>invoice</b> and press Enter.', target: ['search'],
        done: ev('search', function (e) { return /invoice/i.test(e.query); }), hint: 'The search box is at the top of the window. Press Enter after you type.' },
      { id: 's2', part: 'classic', mode: 'classic', title: 'Open the result', callout: 'Open',
        do: 'Open <b>Invoice #4471 – Riverside Print</b> from the results.', target: ['row-m8'],
        done: ev('open-message', function (e) { return e.id === 'm8'; }), hint: 'Only one message contains the word “invoice”.' },
      { id: 's3', part: 'classic', mode: 'classic', title: 'Widen the scope', callout: 'Scope',
        do: 'A <b>Search</b> tab appeared on the ribbon. Open <b>Scope</b> and choose <b>Current Mailbox</b> so Outlook searches every folder.', target: ['tab-search', 'b-scope', 'ss-mailbox'],
        done: ev('search-scope', function (e) { return e.scope === 'mailbox'; }), hint: 'Select the new Search tab, then the Scope button.' },
      { id: 's4', part: 'classic', mode: 'classic', title: 'Filter by attachment', callout: 'Has Attachments',
        do: 'On the Search tab, turn on <b>Has Attachments</b>.', target: ['b-has-attach'],
        done: ev('filter', function (e) { return e.key === 'attach' && e.value; }), hint: 'It is in the Refine group on the Search tab.' },
      { id: 's5', part: 'classic', mode: 'classic', title: 'Close the search', callout: 'Close Search',
        do: 'Select <b>Close Search</b> (or the X in the search box).', target: ['b-close-search', 'search-clear'],
        done: ev('search-close'), hint: 'Use the X at the right end of the search box.' },
      { id: 's6', part: 'new', mode: 'new', title: 'Search in new Outlook', callout: 'Search',
        do: 'In <b>new Outlook</b>, type <b>Atlas</b> in the search box and press Enter.', target: ['search'],
        done: ev('search', function (e) { return /atlas/i.test(e.query); }), hint: 'Click the search box at the top and press Enter after typing.' },
      { id: 's7', part: 'new', mode: 'new', title: 'Filter by sender', callout: 'From',
        do: 'Under the search box, use the <b>From</b> chip to show only messages from <b>Dana Whitfield</b>.', target: ['chip-from', 'sf-dana'],
        done: ev('filter', function (e) { return e.key === 'from' && e.value === 'dana'; }), hint: 'The filter chips appear above the results. Select From, then Dana Whitfield.',
        why: 'The chips narrow the current results. Remove a chip, or use Clear, to widen them again.' },
      { id: 's8', part: 'new', mode: 'new', title: 'Search all folders', callout: 'Scope',
        do: 'Use the <b>scope</b> chip to search <b>All folders</b>.', target: ['chip-scope', 'ss-mailbox'],
        done: ev('search-scope', function (e) { return e.scope === 'mailbox'; }), hint: 'Select the scope chip (it shows the current folder) and choose All folders.' }
    ]
  });

  /* ===================================================== 8. Folders & rules */
  LESSONS.push({
    id: 'l8', module: 'm3', title: 'Folders and rules', mins: 8,
    objective: 'Create a folder, move a message into it, and create a rule that does it automatically.',
    intro: 'Folders are the same idea in both apps. Creating them and managing rules are in different places.',
    compare: [
      ['Create a folder', 'Folder tab &gt; New Folder, or right-click a folder &gt; New Folder.', 'Right-click a folder &gt; Create new subfolder, or the New folder button in the folder pane.', 'moved'],
      ['Create a rule from a message', 'Home &gt; Rules &gt; Always Move Messages From.', 'Rules from the ribbon, or Settings &gt; Mail &gt; Rules.', 'moved'],
      ['Manage rules', 'Rules and Alerts dialog (Home &gt; Rules &gt; Manage Rules &amp; Alerts).', 'Settings &gt; Mail &gt; Rules. Rules apply to new messages; use Run now for existing mail.', 'moved'],
      ['Limits', 'Rules that run only on your PC may not run in new Outlook.', 'Rule import and export are not supported.', 'partial']
    ],
    steps: [
      { id: 's1', part: 'classic', mode: 'classic', title: 'Create a folder', callout: 'New Folder',
        do: 'In classic Outlook, open <b>Folder &gt; New Folder</b>, name it <b>Atlas Project</b> and keep it under the Inbox.', target: function (sim) { if (dlgOpen(sim, 'newfolder')) return val(sim, '#dlg-name').trim() ? ['nf-ok'] : ['nf-name']; return ['tab-folder', 'b-newfolder']; },
        done: ev('folder-create', function (e) { return /atlas/i.test(e.name); }),
        wrong: function (e) { return e && e.type === 'folder-create-error' ? 'Outlook could not create the folder: ' + e.error : null; },
        hint: 'Select the Folder tab, then New Folder. Type the name and select OK.' },
      { id: 's2', part: 'classic', mode: 'classic', title: 'Move a message into it', callout: 'Move',
        do: 'Select Dana’s <b>Atlas rollout: kickoff agenda</b> message and use <b>Home &gt; Move</b> to put it in <b>Atlas Project</b>. (Dragging it onto the folder works too.)',
        target: function (sim) { var f = folderByName(sim, /atlas/i); return pick('m2', ['b-move', f ? 'mv-' + f.id : 'b-move'], 'home')(sim); },
        done: ev('move', function (e, sim) { var f = folderByName(sim, /atlas/i); return e.id === 'm2' && f && e.to === f.id; }),
        hint: 'Select the message, open Move, and choose Atlas Project from the list.' },
      { id: 's3', part: 'classic', mode: 'classic', title: 'Create a rule', callout: 'Rules',
        do: 'Select the message from <b>Carla Mendes</b>, open <b>Home &gt; Rules &gt; Always Move Messages From</b>, send those messages to <b>Atlas Project</b> and select OK.',
        target: function (sim) { if (dlgOpen(sim, 'newrule')) { var f = folderByName(sim, /atlas/i); return val(sim, '#dlg-move') === (f && f.id) ? ['rule-ok'] : ['rule-move']; } return pick('m8', ['b-rules', 'mi-createrule'], 'home')(sim); },
        done: ev('rule-create'), hint: 'Select Carla’s message, then Rules &gt; “Always Move Messages From”. In the dialog pick the folder and select Finish.',
        why: 'In classic Outlook, rules are managed in the Rules and Alerts dialog (Rules &gt; Manage Rules &amp; Alerts).' },
      { id: 's4', part: 'new', mode: 'new', title: 'Create a folder in new Outlook', callout: 'New folder',
        do: 'In <b>new Outlook</b>, select the <b>New folder</b> button in the folder pane (or right-click Inbox &gt; Create new subfolder). Name it <b>Vendors</b> and press Enter.',
        target: ['f-newfolder-btn', 'newfolder-input'], done: ev('folder-create', function (e) { return /vendor/i.test(e.name); }),
        hint: 'The folder pane has a “New folder” button near the top. Type the name and press Enter.' },
      { id: 's5', part: 'new', mode: 'new', title: 'Move a message', callout: 'Move',
        do: 'Move Aisha Rahman’s <b>Riverside Print renewal</b> message to <b>Vendors</b> using the Move button.',
        target: function (sim) { var f = folderByName(sim, /vendor/i); return pick('m7', ['b-move', f ? 'mv-' + f.id : 'b-move'], 'home')(sim); },
        done: ev('move', function (e, sim) { var f = folderByName(sim, /vendor/i); return e.id === 'm7' && f && e.to === f.id; }), hint: 'Select the message, then Move.' },
      { id: 's6', part: 'new', mode: 'new', title: 'Create a rule', callout: 'Rules',
        do: 'Select Carla Mendes’s invoice message, open <b>Rules</b> on the ribbon, choose <b>Create rule…</b>, and move her messages to <b>Vendors</b>.',
        target: function (sim) { if (dlgOpen(sim, 'newrule')) { var f = folderByName(sim, /vendor/i); return val(sim, '#dlg-move') === (f && f.id) ? ['rule-ok'] : ['rule-move']; } return pick('m8', ['b-rules', 'mi-createrule'], 'home')(sim); }, done: ev('rule-create', function (e, sim) { var f = folderByName(sim, /vendor/i); return f && e.rule.moveTo === f.id; }),
        hint: 'Select the message, then Rules &gt; Create rule. In the dialog choose Vendors and select Save.',
        why: 'New Outlook rules apply to messages that arrive after you create the rule. Use “Run now” in Settings &gt; Mail &gt; Rules to apply a rule to existing mail.' }
    ]
  });

  /* =========================================== 9. Flags, categories, pin etc. */
  LESSONS.push({
    id: 'l9', module: 'm3', title: 'Flags, categories, pins and snooze', mins: 7,
    objective: 'Mark messages that need attention in each app, and use the new-Outlook-only Pin, Snooze and Sweep.',
    intro: 'Flags and categories exist in both apps. Pin, Snooze and Sweep are available in new Outlook and not in classic.',
    compare: [
      ['Follow up', 'Home &gt; Follow Up (Today, Tomorrow, Mark Complete…).', 'Flag button on the message row or ribbon.', 'different'],
      ['Categories', 'Home &gt; Categorize.', 'Categorize on the ribbon. Category colors are available in new Outlook.', 'same'],
      ['Quick Steps', 'Quick Steps group on Home.', 'Partially available: not the same Quick Steps gallery.', 'partial'],
      ['Pin messages', 'Not supported.', 'Available: pinned messages stay at the top of the list.', 'new'],
      ['Snooze', 'Not supported.', 'Available: hide a message until later.', 'new'],
      ['Sweep', 'Not supported.', 'Available: move or delete all messages from a sender.', 'new']
    ],
    steps: [
      { id: 's1', part: 'classic', mode: 'classic', title: 'Flag for follow-up', callout: 'Follow Up',
        do: 'In classic Outlook, select Marcus Chen’s <b>Warehouse walkthrough</b> message and use <b>Follow Up &gt; Today</b>.', target: pick('m10', ['b-followup', 'fu-today'], 'home'),
        done: ev('flag', function (e) { return e.id === 'm10' && e.value === 'flagged'; }), hint: 'Select the message, then Follow Up in the Tags group.' },
      { id: 's2', part: 'classic', mode: 'classic', title: 'Mark it complete', callout: 'Mark Complete',
        do: 'The task is done. Choose <b>Follow Up &gt; Mark Complete</b>.', target: pick('m10', ['b-followup', 'fu-complete'], 'home'),
        done: ev('flag', function (e) { return e.id === 'm10' && e.value === 'complete'; }), hint: 'Open the same Follow Up menu again.' },
      { id: 's3', part: 'classic', mode: 'classic', title: 'Categorize', callout: 'Categorize',
        do: 'Use <b>Categorize</b> to give the message the <b>Red category</b>.', target: pick('m10', ['b-categorize', 'cat-red'], 'home'),
        done: ev('category', function (e) { return e.id === 'm10' && e.category === 'red'; }), hint: 'Categorize is next to Follow Up.' },
      { id: 's4', part: 'classic', mode: 'classic', title: 'Run a Quick Step', callout: 'Done',
        do: 'Select Elena’s <b>Open enrollment reminder</b> and run the <b>Done</b> Quick Step. It marks the message read and moves it to Archive.',
        target: pick('m9', ['qs-done'], 'home'), done: ev('quickstep'), hint: 'The Quick Steps group is in the middle of the Home tab.',
        why: 'Quick Steps are only “partially available” in new Outlook, so check what you rely on before moving over.' },
      { id: 's5', part: 'new', mode: 'new', title: 'Flag in new Outlook', callout: 'Flag',
        do: 'In <b>new Outlook</b>, flag Marcus Chen’s <b>Warehouse walkthrough</b> message (the flag icon on its row, or Flag on the ribbon).', target: pick('m10', ['b-flag', 'row-flag-m10'], 'home'),
        done: ev('flag', function (e) { return e.id === 'm10' && e.value; }), hint: 'Hover over the message row and select the flag.' },
      { id: 's6', part: 'new', mode: 'new', title: 'Pin it to the top', callout: 'Pin',
        do: 'Now <b>pin</b> the message so it stays at the top of the Inbox.', target: pick('m10', ['b-pin'], 'home'),
        done: ev('pin', function (e) { return e.id === 'm10' && e.pinned; }), hint: 'Select Pin on the ribbon or the pin icon on the row.',
        why: 'Pin is a new Outlook feature. Classic Outlook does not support it.' },
      { id: 's7', part: 'new', mode: 'new', title: 'Snooze a message', callout: 'Snooze',
        do: 'Select Sam’s <b>Password expiry reminder</b> and <b>snooze</b> it until <b>Tomorrow</b>.', target: pick('m16', ['b-snooze', 'sn-tomorrow'], 'home'),
        done: ev('snooze', function (e) { return e.id === 'm16'; }), hint: 'Select the message, then Snooze in the ribbon.',
        why: 'Snoozed messages leave the Inbox and come back at the time you choose. Look in the Snoozed folder to see them.' },
      { id: 's8', part: 'new', mode: 'new', title: 'Sweep a sender', callout: 'Sweep',
        do: 'Select the <b>Logistics Weekly</b> newsletter and use <b>Sweep</b> to move all messages from that sender to the Archive.', target: pick('m15', ['b-sweep', 'sw-archive'], 'home'),
        done: ev('sweep', function (e) { return e.action === 'archive'; }), hint: 'Sweep is on the Home ribbon. Pick “Move all … to Archive”.' }
    ]
  });

  /* ===================================================== 10. Attachments */
  LESSONS.push({
    id: 'l10', module: 'm3', title: 'Working with attachments', mins: 6,
    objective: 'Preview, save and add attachments in each app.',
    intro: 'Attachments appear in the reading pane in both apps. Saving uses “Save As” in classic and “Download” in new Outlook.',
    compare: [
      ['Save an attachment', 'Attachment menu &gt; Save As… (choose a folder).', 'Attachment menu &gt; Download (goes to your Downloads folder).', 'different'],
      ['Save all', 'Save All Attachments…', 'Download all', 'moved'],
      ['Attach a file', 'Message window: Attach File.', 'Compose pane: Attach, with computer and cloud options.', 'different']
    ],
    steps: [
      { id: 's1', part: 'classic', mode: 'classic', title: 'Preview an attachment', callout: 'Preview',
        do: 'In classic Outlook, open Priya’s <b>Q4 budget review</b> message, select the attachment, and choose <b>Preview</b>.', target: pick('m1', ['att-a-budget', 'att-preview']),
        done: ev('attachment-preview', function (e) { return e.msgId === 'm1'; }), hint: 'The attachment chip is under the message header. Select it to open its menu.' },
      { id: 's2', part: 'classic', mode: 'classic', title: 'Save the file', callout: 'Save As',
        do: 'Close the preview, open the attachment menu again, choose <b>Save As…</b>, pick <b>Desktop</b> and select Save.', target: function (sim) {
          if (dlgOpen(sim, 'viewer')) return ['dlg-ok'];
          if (dlgOpen(sim, 'saveas')) { var r = sim.dq('input[name=sa-folder]:checked'); return r && r.value === 'Desktop' ? ['sa-ok'] : ['sa-desktop']; }
          return ['att-a-budget', 'att-saveas'];
        },
        done: ev('attachment-save', function (e) { return e.how === 'saveas' && e.folder === 'Desktop'; }), hint: 'The attachment menu has Preview and Save As. Choose Desktop in the dialog.',
        why: 'In real classic Outlook, Save As opens your computer’s file dialog. Here it is simulated, nothing is written to disk.' },
      { id: 's3', part: 'classic', mode: 'classic', title: 'Attach a file', callout: 'Attach',
        do: 'Start a <b>New Email</b>, then in the message window choose <b>Attach File</b> and pick <b>Expense-Report-Oct.xlsx</b> from Recent Items.', target: function (sim) { return comp(sim) ? ['c-attach', 'at-recent-f3'] : ['b-new-mail']; },
        done: ev('attach-add', function (e) { return /Expense/i.test(e.name); }), hint: 'The Attach File button is on the Message tab of the message window.' },
      { id: 's4', part: 'classic', mode: 'classic', title: 'Close the message', callout: 'Close',
        do: 'Close the message window. Outlook asks whether to save a draft; choose <b>Don’t Save</b>.', target: function (sim) { return dlgOpen(sim, 'savechanges') ? ['dlg-nosave'] : ['c-close']; },
        done: function (e, sim) { return !comp(sim) && !sim.ui.dialog; }, poll: true, hint: 'Use the X at the top-right of the message window.' },
      { id: 's5', part: 'new', mode: 'new', title: 'Download an attachment', callout: 'Download',
        do: 'In <b>new Outlook</b>, open the <b>Bluebird Foods proposal</b> message and download the <b>proposal PDF</b> from its attachment menu.', target: pick('m6', ['att-a-proposal', 'att-download']),
        done: ev('attachment-save', function (e) { return e.how === 'download' && /Proposal/i.test(e.name); }), hint: 'Select the attachment chip and choose Download.' },
      { id: 's6', part: 'new', mode: 'new', title: 'Download all', callout: 'Download all',
        do: 'This message has two attachments. Open an attachment menu and choose <b>Download all</b>.', target: ['att-a-pricing', 'att-all'],
        done: ev('attachment-saveall'), hint: 'The attachment menu shows Download all when there is more than one file.' },
      { id: 's7', part: 'new', mode: 'new', title: 'Attach a file in new Outlook', callout: 'Attach',
        do: 'Start <b>New mail</b>, choose <b>Attach</b> &gt; <b>Browse this computer</b> and pick <b>Meeting-Notes.txt</b>.', target: function (sim) { if (!comp(sim)) return ['b-new-mail']; return dlgOpen(sim, 'filepicker') ? ['fp-f2'] : ['c-attach', 'at-computer']; },
        done: ev('attach-add', function (e) { return /Meeting-Notes/i.test(e.name); }), hint: 'Attach is in the compose toolbar. A list of fictional files appears.' }
    ]
  });

  /* ================================================ 11. Calendar & invitations */
  LESSONS.push({
    id: 'l11', module: 'm4', title: 'The calendar and meeting invitations', mins: 7,
    objective: 'Change calendar views, spot conflicts, and respond to invitations.',
    intro: 'Both apps use the same calendar data. Views and responses are in different places, and declined meetings can be kept visible in new Outlook.',
    compare: [
      ['Change view', 'Home or View tab: Day, Work Week, Week.', 'Calendar view drop-down on the ribbon.', 'moved'],
      ['Respond to an invitation', 'Accept, Tentative, Decline in the reading pane or Home ribbon; choose whether to send a response.', 'Accept, Tentative, Decline in the invitation; a drop-down lets you edit or skip the response.', 'different'],
      ['Declined meetings', 'Removed from your calendar.', 'Can be preserved: Settings &gt; Calendar &gt; Events and invitations.', 'new']
    ],
    steps: [
      { id: 's1', part: 'classic', mode: 'classic', title: 'Open the Calendar', callout: 'Calendar',
        do: 'In classic Outlook, open the <b>Calendar</b>.', target: ['rail-calendar'], done: ev('app', function (e) { return e.app === 'calendar'; }), hint: 'Use the left navigation bar.' },
      { id: 's2', part: 'classic', mode: 'classic', title: 'Switch to Week view', callout: 'Week',
        do: 'Select <b>Week</b> to show all seven days.', target: ['b-calview-week'], done: ev('cal-view', function (e) { return e.view === 'week'; }), hint: 'The Arrange group has Day, Work Week and Week.' },
      { id: 's3', part: 'classic', mode: 'classic', title: 'Look at next week', callout: 'Next',
        do: 'Move to <b>next week</b>, then select <b>Today</b> to come back.', target: ['cal-next', 'b-today'],
        done: ev('cal-today'), hint: 'Use the arrows in the calendar header, then Today.' },
      { id: 's4', part: 'classic', mode: 'classic', title: 'Open an invitation', callout: 'Open',
        do: 'Return to <b>Mail</b> and open Tom Becker’s invitation <b>Safety training refresh</b>. Notice the warning: it overlaps with your Warehouse walkthrough.', target: pick('m5', ['row-m5']),
        done: ev('open-message', function (e) { return e.id === 'm5'; }), hint: 'The message is in the Inbox, marked with a calendar icon.' },
      { id: 's5', part: 'classic', mode: 'classic', title: 'Respond sensibly', callout: 'Respond',
        do: 'The meeting conflicts with another one. Respond with <b>Tentative</b> or <b>Decline</b> (do not accept).', target: ['rsvp-tentative', 'rsvp-decline', 'rs-send'],
        done: ev('rsvp', function (e) { return e.id === 'e5' && (e.resp === 'tentative' || e.resp === 'declined'); }),
        wrong: function (e) { return e && e.type === 'rsvp' && e.id === 'e5' && e.resp === 'accepted' ? 'Accepting would double-book you on Wednesday afternoon. Change your response to Tentative or Decline.' : null; },
        hint: 'Use the buttons in the invitation. Classic asks how to send the response; “Send the Response Now” is fine.',
        why: 'The conflict banner appears in both apps. Responding is only the first step; propose a new time to the organizer if the meeting matters.' },
      { id: 's6', part: 'new', mode: 'new', title: 'Open an invitation in new Outlook', callout: 'Open',
        do: 'In <b>new Outlook</b>, open Dana’s invitation <b>Atlas Kickoff</b>.', target: pick('m4', ['row-m4']), done: ev('open-message', function (e) { return e.id === 'm4'; }), hint: 'Go to Mail first if you are in the calendar.' },
      { id: 's7', part: 'new', mode: 'new', title: 'Accept', callout: 'Accept',
        do: 'There is no conflict on Thursday morning. Select <b>Accept</b>.', target: ['rsvp-accept'], done: ev('rsvp', function (e) { return e.id === 'e4' && e.resp === 'accepted'; }), hint: 'The response buttons are in the invitation.' },
      { id: 's8', part: 'new', mode: 'new', title: 'Check My Day', callout: 'My Day',
        do: 'Open <b>My Day</b> to see today’s meetings next to your mail.', target: ['myday'], done: ev('myday', function (e) { return e.open; }), hint: 'The sun icon at the top-right.' }
    ]
  });

  /* =================================================== 12. Schedule meeting */
  LESSONS.push({
    id: 'l12', module: 'm4', title: 'Scheduling a Teams meeting', mins: 6,
    objective: 'Create a meeting with attendees and a Teams link in each app.',
    intro: 'Teams is built into new Outlook. In classic Outlook, the Teams Meeting button comes from the Teams add-in.',
    compare: [
      ['Add a Teams link', 'Teams Meeting button in the meeting window (Teams add-in).', 'Teams meeting toggle in the event form (built in; the classic Teams add-in is not supported).', 'different'],
      ['Invite people', 'Required and Optional boxes; the To… button opens the Address Book.', 'Invite attendees box with an Optional link.', 'different'],
      ['Check conflicts', 'Scheduling Assistant.', 'A conflict note appears under the time (Scheduling Assistant is also available).', 'partial']
    ],
    steps: [
      { id: 's1', part: 'classic', mode: 'classic', title: 'Open the Calendar', callout: 'Calendar',
        do: 'In classic Outlook, go to the <b>Calendar</b> and select <b>New Meeting</b>.', target: ['rail-calendar', 'b-newmeeting'],
        done: ev('event-form-open'), hint: 'New Meeting is on the Home tab of the calendar.' },
      { id: 's2', part: 'classic', mode: 'classic', title: 'Fill in the details', callout: 'Details',
        do: 'Add <b>Priya Nair</b> as a Required attendee, give the meeting the title <b>Vendor review</b>.', target: function (sim) { var f = evf(sim); if (!f || !hasR(f.req, 'priya')) return ['c-req-input', 'sug-priya']; return ['ev-title']; }, poll: true,
        done: function (e, sim) { var f = evf(sim); return f && hasR(f.req, 'priya') && val(sim, '#ev-title').trim().length >= 3; },
        hint: 'Type Priya in Required and pick the suggestion, then fill in the Subject.' },
      { id: 's3', part: 'classic', mode: 'classic', title: 'Add Teams', callout: 'Teams Meeting',
        do: 'Select <b>Teams Meeting</b> in the ribbon to add an online link.', target: ['c-teams'], done: ev('event-teams', function (e) { return e.on; }), hint: 'The Teams Meeting button is on the Meeting tab.' },
      { id: 's4', part: 'classic', mode: 'classic', title: 'Send the invitation', callout: 'Send',
        do: 'Select <b>Send</b>.', target: ['ev-send'], done: ev('event-send', function (e) { return e.teams && e.hasAttendees; }),
        wrong: function (e) { return e && e.type === 'event-error' ? e.error : null; }, hint: 'Send is at the left of the meeting window.' },
      { id: 's5', part: 'new', mode: 'new', title: 'Create an event', callout: 'New event',
        do: 'In <b>new Outlook</b>, open the <b>Calendar</b> and select <b>New event</b>.', target: ['rail-calendar', 'b-newevent'], done: ev('event-form-open'), hint: 'The New event button is at the left of the calendar ribbon.' },
      { id: 's6', part: 'new', mode: 'new', title: 'Add title and attendee', callout: 'Details',
        do: 'Title the event <b>Route planning</b> and invite <b>Marcus Chen</b>.', target: function (sim) { var f = evf(sim); if (!f || !hasR(f.req, 'marcus')) return ['c-req-input', 'sug-marcus']; return ['ev-title']; }, poll: true,
        done: function (e, sim) { var f = evf(sim); return f && hasR(f.req, 'marcus') && val(sim, '#ev-title').trim().length >= 3; }, hint: 'Type the title, then start typing Marcus in the attendee box.' },
      { id: 's7', part: 'new', mode: 'new', title: 'Turn on Teams', callout: 'Teams meeting',
        do: 'Turn on the <b>Teams meeting</b> toggle and then select <b>Send</b>.', target: function (sim) { var f = evf(sim); return f && f.teams ? ['ev-send'] : ['c-teams']; }, done: ev('event-send', function (e) { return e.teams && e.hasAttendees; }),
        wrong: function (e) { return e && e.type === 'event-error' ? e.error : null; }, hint: 'The toggle is in the event toolbar.',
        why: 'Teams is integrated into new Outlook, so no add-in is needed. The classic Teams add-in is not supported in new Outlook.' }
    ]
  });

  /* ============================================ 13. Send later & undo send */
  LESSONS.push({
    id: 'l13', module: 'm5', title: 'Send later and undo send', mins: 7,
    objective: 'Delay or schedule a message, and recall a message with Undo send.',
    intro: 'Classic Outlook can hold a message with a delay rule or Delay Delivery. New Outlook has Schedule send and Undo send built in.',
    compare: [
      ['Undo send', 'Not supported.', 'Available. Choose how long it waits (Settings &gt; Mail &gt; Compose and reply).', 'new'],
      ['Schedule send', 'Not supported. Use Delay Delivery.', 'Available: Send arrow &gt; Schedule send.', 'new'],
      ['Delay delivery', 'Options &gt; Delay Delivery (message waits in Outbox; Outlook must be open).', 'Partially available: the delay-send rule.', 'partial']
    ],
    steps: [
      { id: 's1', part: 'classic', mode: 'classic', title: 'Open a prepared message', callout: 'Options',
        auto: function (sim) { sim.setMode('classic'); sim.gotoApp('mail'); pre(sim, ['priya'], 'Status update', 'Hi Priya,\n\nHere is this week’s update.\n\nJordan'); },
        do: 'We opened a message to Priya for you. Go to the <b>Options</b> tab of the message window.', target: ['c-tab-options'], poll: true,
        done: function (e, sim) { return comp(sim) && comp(sim).tab === 'options'; }, hint: 'The tabs in the message window are Message, Insert and Options.' },
      { id: 's2', part: 'classic', mode: 'classic', title: 'Choose Delay Delivery', callout: 'Delay Delivery',
        do: 'Select <b>Delay Delivery</b>, tick <b>Do not deliver before</b> and close the dialog.', target: function (sim) { if (dlgOpen(sim, 'delay')) { var c = sim.dq('#dl-on'); return c && c.checked ? ['dl-close'] : ['dl-on']; } return ['c-delay']; },
        done: ev('delay-set', function (e) { return e.on; }), hint: 'Tick the box in the Properties dialog before you close it.' },
      { id: 's3', part: 'classic', mode: 'classic', title: 'Send it', callout: 'Send',
        do: 'Select <b>Send</b>. The message waits in the <b>Outbox</b>.', target: ['c-send'], done: ev('delay-delivery'), hint: 'Send is at the left of the window.',
        why: 'The message stays in the Outbox until the time you chose, and Outlook has to be running to send it. Classic Outlook has no Undo send.' },
      { id: 's4', part: 'new', mode: 'new', title: 'Open a prepared message', callout: 'Send arrow',
        auto: function (sim) { sim.setMode('new'); sim.gotoApp('mail'); pre(sim, ['marcus'], 'Delivery plan', 'Hi Marcus,\n\nPlease see the plan for Friday.\n\nJordan'); },
        do: 'We prepared a message to Marcus. Select the <b>arrow beside Send</b> and choose <b>Schedule send</b>.', target: ['c-send-arrow', 'mi-schedule', 'sch-tomorrow'],
        done: ev('schedule-send'), hint: 'The small arrow sits at the right edge of the Send button. Choose “Tomorrow morning”.',
        why: 'A scheduled message is kept in Drafts until it is sent.' },
      { id: 's5', part: 'new', mode: 'new', title: 'Set Undo send', callout: 'Undo send',
        do: 'Open <b>Settings &gt; Mail &gt; Compose and reply</b> and set <b>Undo send</b> to <b>20 seconds</b>.', target: ['settings-gear', 's-cat-mail', 's-nav-compose', 's-undo'],
        done: ev('setting', function (e) { return e.key === 'undoSend' && e.value === 20; }), hint: 'Open Settings, choose Mail, then Compose and reply.' },
      { id: 's6', part: 'new', mode: 'new', title: 'Send and undo', callout: 'Undo',
        auto: function (sim) { sim.closeSettings(); pre(sim, ['sam'], 'Reminder', 'Hi Sam,\n\nA reminder about Saturday.\n\nJordan'); },
        do: 'Settings are saved. We prepared another message. Select <b>Send</b>, then select <b>Undo</b> in the message bar before it disappears.', target: ['c-send', 'toast-undo-send'],
        done: ev('undo-send'), hint: 'After you send, an Undo button appears at the bottom for the number of seconds you chose.',
        why: 'Undo send gives you a short window to cancel. It is not a recall of a message that has already left.' }
    ]
  });

  /* ============================================ 14. Settings & customization */
  LESSONS.push({
    id: 'l14', module: 'm5', title: 'Settings and customization', mins: 6,
    objective: 'Change the theme, density and calendar options in each app.',
    intro: 'Customization is a good example of what moved. Classic spreads it over File &gt; Options, File &gt; Office Account and the View tab. New Outlook centralizes much of it in Settings.',
    compare: [
      ['Theme / dark mode', 'File &gt; Office Account &gt; Office Theme.', 'Settings &gt; General &gt; Appearance (light, dark, accent color).', 'moved'],
      ['List density', 'View &gt; Change View.', 'View &gt; Density.', 'moved'],
      ['Declined meetings', 'Removed from the calendar.', 'Settings &gt; Calendar &gt; Events and invitations.', 'new'],
      ['Customize the ribbon', 'Right-click the ribbon &gt; Customize.', 'The ribbon can be switched between simplified and classic; per-command customization is more limited.', 'partial']
    ],
    steps: [
      { id: 's1', part: 'classic', mode: 'classic', title: 'Open Office Account', callout: 'File',
        do: 'In classic Outlook, open <b>File &gt; Office Account</b>.', target: ['tab-file', 'bs-account'], done: ev('backstage-open', function (e) { return e.page === 'account'; }), poll: true,
        hint: 'File tab, then Office Account on the left.' },
      { id: 's1b', part: 'classic', mode: 'classic', title: 'Choose a theme', callout: 'Office Theme',
        do: 'Set the <b>Office Theme</b> to <b>Dark Gray</b>.', target: ['bs-account', 'bs-theme'], done: ev('setting', function (e) { return e.key === 'officeTheme' && e.value === 'darkgray'; }),
        hint: 'Use the drop-down under Office Theme.' },
      { id: 's2', part: 'classic', mode: 'classic', title: 'Make the list compact', callout: 'Change View',
        auto: function (sim) { sim.closeBackstage(); },
        do: 'Go to <b>View &gt; Change View</b> and choose <b>Compact</b>.', target: ['tab-view', 'b-changeview', 'cv-compact'], done: ev('setting', function (e) { return e.key === 'density' && e.value === 'compact'; }),
        hint: 'View tab, Change View, Compact.' },
      { id: 's3', part: 'new', mode: 'new', title: 'Turn on dark mode', callout: 'Appearance',
        do: 'In <b>new Outlook</b>, open <b>Settings &gt; General &gt; Appearance</b> and choose <b>Dark</b>.', target: ['settings-gear', 's-theme-dark'],
        done: ev('setting', function (e) { return e.key === 'theme' && e.value === 'dark'; }), hint: 'Select the gear, then choose Dark.' },
      { id: 's4', part: 'new', mode: 'new', title: 'Pick an accent color', callout: 'Accent',
        do: 'Choose the <b>teal</b> accent color.', target: ['s-accent-teal'], done: ev('setting', function (e) { return e.key === 'accent' && e.value === 'teal'; }), hint: 'The colored circles on the Appearance page.' },
      { id: 's5', part: 'new', mode: 'new', title: 'Keep declined meetings', callout: 'Calendar',
        do: 'Open <b>Calendar &gt; Events and invitations</b> and turn on <b>Show declined meetings</b>.', target: ['s-cat-calendar', 's-nav-events', 's-declined'],
        done: ev('setting', function (e) { return e.key === 'showDeclined' && e.value === true; }), hint: 'In the Settings list choose Calendar, then Events and invitations.' },
      { id: 's6', part: 'new', mode: 'new', title: 'Change the density', callout: 'Density',
        auto: function (sim) { sim.closeSettings(); },
        do: 'Close Settings, then use <b>View &gt; Density</b> and choose <b>Compact</b>.', target: ['tab-view', 'b-density', 'dn-compact'], done: ev('setting', function (e) { return e.key === 'density' && e.value === 'compact'; }),
        hint: 'View tab, then Density.', why: 'Settings are stored per app: the classic theme you set earlier did not change in new Outlook.' }
    ]
  });

  /* ============================================= 15. Where did it go? */
  LESSONS.push({
    id: 'l15', module: 'm5', title: 'Where did it go?', mins: 8,
    objective: 'Find where common classic features live in new Outlook, and know which ones changed or are not supported.',
    intro: 'This lesson is a scavenger hunt. Each task names a feature from classic Outlook; you find it in new Outlook. Check the Reference page for the full list; availability changes as Microsoft updates new Outlook.',
    compare: [
      ['Rules and Alerts dialog', 'Home &gt; Rules &gt; Manage Rules &amp; Alerts.', 'Settings &gt; Mail &gt; Rules.', 'moved'],
      ['Automatic Replies (Out of Office)', 'File &gt; Info &gt; Automatic Replies.', 'Settings &gt; Mail &gt; Automatic replies.', 'moved'],
      ['COM / VSTO add-ins and VBA macros', 'Supported.', 'Not supported (web add-ins only).', 'missing'],
      ['Teams Meeting add-in', 'Add-in.', 'Built in; add-in not supported.', 'different']
    ],
    steps: [
      { id: 's1', part: 'new', mode: 'new', title: 'Find Rules', callout: 'Rules',
        do: 'In classic Outlook you used <i>Rules and Alerts</i>. In <b>new Outlook</b>, find where you manage rules.', target: ['settings-gear', 's-cat-mail', 's-nav-rules'],
        done: function (e) { return !!e && (e.type === 'settings-open' || e.type === 'settings-page') && e.page === 'rules'; },
        hint: 'Settings (gear) &gt; Mail &gt; Rules.', why: 'Settings &gt; Mail &gt; Rules. Rule import and export are not supported in new Outlook.' },
      { id: 's2', part: 'new', mode: 'new', title: 'Find Automatic replies', callout: 'Automatic replies',
        do: 'Classic put <i>Automatic Replies</i> under File &gt; Info. Find it in new Outlook.', target: ['s-cat-mail', 's-nav-autoreply'],
        done: function (e) { return !!e && (e.type === 'settings-open' || e.type === 'settings-page') && e.page === 'autoreply'; }, hint: 'Same Settings window, Mail section.' },
      { id: 's3', part: 'new', mode: 'new', title: 'Find Add-ins', callout: 'Add apps',
        auto: function (sim) { sim.closeSettings(); },
        do: 'Close Settings. Where do you add apps (add-ins) in new Outlook? Open the add-ins dialog.', target: ['b-addins', 'b-moreapps'],
        done: ev('dialog-open', function (e) { return e.id === 'addins'; }), hint: 'Look on the Home ribbon for an add-in button.',
        why: 'New Outlook supports web add-ins only.' },
      q('Which of these is NOT supported in new Outlook?', ['Pin messages', 'Undo send', 'COM add-ins and VBA macros', 'Snooze'], 2, 'COM add-ins and VBA macros are listed as not supported in new Outlook. Pin, Snooze and Undo send are new Outlook features.'),
      q('How does a Teams meeting get created in new Outlook?', ['With the Teams Meeting add-in you install', 'With the built-in Teams meeting toggle', 'It cannot be done', 'Only from the Teams app'], 1, 'Teams is integrated into new Outlook, and the classic Teams add-in is not supported there.'),
      q('Your colleague relies on Quick Steps in classic Outlook. What should you tell them?', ['They work identically in new Outlook', 'They are completely removed', 'They are partially available in new Outlook, so check the ones they use', 'They now only work in Teams'], 2, 'Microsoft lists Quick Steps as partially available in new Outlook. Check the specific ones you rely on.'),
      q('You want to hold a message and send it later from classic Outlook. What is available?', ['Schedule send', 'Undo send', 'Delay Delivery (Options tab) or a delay-send rule', 'Nothing'], 2, 'Schedule send and Undo send are new Outlook features. Classic uses Delay Delivery or a rule that delays sending.')
    ]
  });

  OT.modules = MODULES;
  OT.lessons = LESSONS;
})();
