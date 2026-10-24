/* ==========================================================================
   quiz.js — knowledge-check questions (module quizzes + final assessment)
   Each question: { id, q, options[], answer (index), why }
   Statements about availability come from Microsoft's "Feature comparison
   between new Outlook and classic Outlook" (see the Reference page for date).
   ========================================================================== */
(function () {
  'use strict';
  var OT = window.OT;
  function Q(id, q, options, answer, why) { return { id: id, q: q, options: options, answer: answer, why: why }; }

  var BANK = {
    m1: [
      Q('m1-1', 'You switch from classic Outlook to new Outlook. What happens to your mail?', ['It is copied and the original is deleted', 'Nothing: both apps open the same mailbox', 'Only the Inbox is available in new Outlook', 'You must re-add your account first'], 1, 'Both apps connect to the same mailbox on the server, so no mail moves.'),
      Q('m1-2', 'Where do you find the File tab in new Outlook?', ['Top-left, same as classic', 'There is no File tab: options are in Settings (gear)', 'Under the Help tab', 'In the folder pane'], 1, 'New Outlook has no File tab. Most options moved to Settings.'),
      Q('m1-3', 'Which of these exists only in new Outlook?', ['My Day side panel', 'File > Options', 'Rules and Alerts dialog', 'Quick Access Toolbar'], 0, 'My Day is a new Outlook panel. The others are classic features.'),
      Q('m1-4', 'You want to leave new Outlook and use classic again. What do you do?', ['Uninstall Outlook', 'Use the switch in the top-right and choose Switch back to classic Outlook', 'Sign out and in', 'Delete your profile'], 1, 'The same switch that turned new Outlook on lets you go back (while classic remains supported).'),
      Q('m1-5', 'You changed the reading pane layout in classic Outlook. What happens in new Outlook?', ['The same layout is applied', 'Nothing: layout is kept separately in each app', 'Outlook asks which one to keep', 'The layout resets in classic'], 1, 'Layout and similar preferences are stored per app, so set them in both.')
    ],
    m2: [
      Q('m2-1', 'A message was sent to ten people with you on Cc. You only want to answer the sender. Which command?', ['Reply', 'Reply All', 'Forward', 'Reply with Meeting'], 0, 'Reply goes only to the sender; Reply All goes to everyone on To and Cc.'),
      Q('m2-2', 'What is different when you write a new message in new Outlook?', ['It opens in its own window with a ribbon', 'It is written in a compose pane inside the main window', 'You must use the Address Book', 'Messages cannot have attachments'], 1, 'New Outlook composes in a pane inside the main window. Classic opens a separate message window.'),
      Q('m2-3', 'You forward a message that has two attachments. What happens to the attachments?', ['They are removed', 'They are included unless you remove them', 'Only the first is kept', 'You must re-attach them'], 1, 'Forwarding keeps attachments by default in both apps.'),
      Q('m2-4', 'In new Outlook, where is the Cc box?', ['It is always visible', 'It appears after you select the Cc link beside To', 'It is only in classic', 'It is under the Options tab'], 1, 'Cc and Bcc appear on demand in new Outlook.'),
      Q('m2-5', 'Which filter shows only the messages you have not read in classic Outlook?', ['Unread at the top of the message list', 'View > Reading Pane', 'File > Info', 'Folder > New Folder'], 0, 'The All/Unread switch sits above the message list. New Outlook uses the Filter button.')
    ],
    m3: [
      Q('m3-1', 'You deleted a message by mistake. What is the fastest fix in both apps?', ['Ctrl+Z (Undo)', 'Restart Outlook', 'Ask IT to restore it', 'Search the Junk folder'], 0, 'Undo works for a delete or move in both apps. After that, check Deleted Items.'),
      Q('m3-2', 'Which feature is available in new Outlook but NOT in classic Outlook?', ['Pin messages', 'Move to folder', 'Categories', 'Reply All'], 0, 'Microsoft lists Pin, Snooze and Sweep as available in new Outlook and not supported in classic.'),
      Q('m3-3', 'Where do you manage rules in new Outlook?', ['Rules and Alerts under File', 'Settings > Mail > Rules', 'Folder tab', 'It is not possible'], 1, 'Settings > Mail > Rules. Rule import and export are not supported.'),
      Q('m3-4', 'You create a rule in new Outlook. Which messages does it apply to?', ['Messages that arrive after you create it (use Run now for existing mail)', 'All mail in the mailbox instantly', 'Only drafts', 'Only messages from this week'], 0, 'Rules act on new messages as they arrive. Use Run now to apply a rule to existing mail.'),
      Q('m3-5', 'What does Save As… do to an attachment in classic Outlook?', ['Lets you choose where to save it', 'Deletes it from the message', 'Forwards it', 'Pins it'], 0, 'Classic uses Save As; new Outlook uses Download.'),
      Q('m3-6', 'Quick Steps in new Outlook are:', ['Identical to classic', 'Partially available', 'Removed forever', 'Available only on the web'], 1, 'Microsoft lists Quick Steps as partially available in new Outlook.'),
      Q('m3-7', 'You search for “invoice” and want to look in every folder. In classic Outlook you use:', ['Search tab > Scope > Current Mailbox', 'View > Change View', 'Home > Move', 'Folder > New Folder'], 0, 'The contextual Search tab holds Scope. In new Outlook, use the scope chip (All folders).')
    ],
    m4: [
      Q('m4-1', 'You open an invitation that overlaps another meeting. What is the best response?', ['Accept without checking', 'Tentative or Decline, or propose a new time', 'Delete the invitation', 'Forward it to the organizer'], 1, 'Both apps warn about conflicts. Respond Tentative/Decline or propose a time instead of double-booking.'),
      Q('m4-2', 'How do you add Teams to a meeting in new Outlook?', ['Install the Teams add-in', 'Turn on the Teams meeting toggle', 'Use Skype', 'You can’t'], 1, 'Teams is built in. The classic Teams add-in is not supported in new Outlook.'),
      Q('m4-3', 'In classic Outlook, what adds the Teams Meeting button to the ribbon?', ['The Teams add-in', 'File > Options', 'Rules', 'Nothing: it is always there'], 0, 'Classic relies on the Teams add-in for the Teams Meeting button.'),
      Q('m4-4', 'What does Settings > Calendar > Events and invitations help with in new Outlook?', ['Keeping declined meetings visible', 'Changing your password', 'Setting up rules', 'Adding add-ins'], 0, 'New Outlook can preserve declined meetings; classic removes them from the calendar.'),
      Q('m4-5', 'You want a side panel with today’s agenda next to your mail. Which app offers My Day?', ['Classic Outlook', 'New Outlook', 'Both', 'Neither'], 1, 'My Day is a new Outlook feature.')
    ],
    m5: [
      Q('m5-1', 'You want to cancel a message just after sending it. Which app has built-in Undo send?', ['Classic Outlook', 'New Outlook', 'Both', 'Neither'], 1, 'Undo send is available in new Outlook and not supported in classic.'),
      Q('m5-2', 'How can you hold a message and send it later from classic Outlook?', ['Schedule send', 'Options > Delay Delivery', 'Undo send', 'Pin'], 1, 'Classic uses Delay Delivery (Outlook must be open). Schedule send is a new Outlook feature.'),
      Q('m5-3', 'Where is the dark mode setting in new Outlook?', ['File > Office Account', 'Settings > General > Appearance', 'View > Density', 'Help tab'], 1, 'Appearance holds light/dark mode and accent colors. Classic uses File > Office Account > Office Theme.'),
      Q('m5-4', 'Which is NOT supported in new Outlook?', ['Web add-ins', 'COM add-ins and VBA macros', 'Signatures', 'Shared mailboxes'], 1, 'COM add-ins and VBA macros are listed as not supported.'),
      Q('m5-5', 'Where do you turn on Automatic Replies in new Outlook?', ['Settings > Mail > Automatic replies', 'File > Info', 'Help tab', 'View tab'], 0, 'Classic uses File > Info > Automatic Replies; new Outlook moved it to Settings.'),
      Q('m5-6', 'Why should you check the feature comparison page before relying on a feature?', ['Availability can vary by account, organization and release, and it changes over time', 'It never changes', 'Only IT can read it', 'It lists keyboard shortcuts'], 0, 'Microsoft updates the comparison regularly and rollouts are gradual.')
    ]
  };

  /* Extra scenario questions that appear only in the final assessment */
  var FINAL_EXTRA = [
    Q('f-1', 'A teammate says: “I clicked Reply All to a big list by mistake!” In new Outlook, what feature may have helped?', ['Undo send, if it was still within the wait time', 'Pin', 'Sweep', 'Quick Steps'], 0, 'Undo send gives a short window to cancel. It is a new Outlook feature only.'),
    Q('f-2', 'You need to find an Out of Office setting you used in classic. Where do you look in new Outlook?', ['Settings > Mail > Automatic replies', 'File > Info', 'Home > Rules', 'View > Layout'], 0, 'Automatic replies moved into Settings.'),
    Q('f-3', 'A colleague wants to keep using a COM add-in for invoices. What do you tell them?', ['It works in new Outlook', 'COM add-ins are not supported in new Outlook, so they should stay on classic or look for a web add-in', 'It will work after a restart', 'Install it twice'], 1, 'Only web add-ins are supported in new Outlook.'),
    Q('f-4', 'Which statement about the toggle is true?', ['It deletes your classic profile', 'It lets you try new Outlook and go back to classic', 'It is only available on the web', 'It changes your mailbox'], 1, 'The toggle switches the app, not the mailbox.'),
    Q('f-5', 'A message you want to deal with later can be hidden until a chosen time in new Outlook using:', ['Snooze', 'Delay Delivery', 'Reply All', 'Rules and Alerts'], 0, 'Snooze is a new Outlook feature (not supported in classic).')
  ];

  OT.quiz = {
    bank: BANK, extra: FINAL_EXTRA,
    forModule: function (id) { return BANK[id] || []; },
    finalPool: function () {
      var all = [];
      Object.keys(BANK).forEach(function (k) { all = all.concat(BANK[k]); });
      return all.concat(FINAL_EXTRA);
    },
    PASS: 0.8, FINAL_COUNT: 15
  };
})();
