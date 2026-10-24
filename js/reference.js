/* ==========================================================================
   reference.js — comparison data for the Reference page
   Source for availability: Microsoft Support, "Feature comparison between
   new Outlook and classic Outlook" (page last updated September 23, 2026).
   ========================================================================== */
(function () {
  'use strict';
  var OT = window.OT;

  var SOURCE = {
    title: 'Feature comparison between new Outlook and classic Outlook',
    url: 'https://support.microsoft.com/office/feature-comparison-between-new-outlook-and-classic-outlook-de453583-1e76-48bf-975a-2e9cd2ee16dd',
    checked: 'October 24, 2026',
    pageUpdated: 'September 23, 2026'
  };

  /* [feature, availability in new Outlook, status key, note] */
  var MATRIX = [
    ['Undo send', 'Available', 'avail', 'Not supported in classic Outlook.'],
    ['Schedule send', 'Available', 'avail', 'Not supported in classic Outlook.'],
    ['Delay delivery', 'Partially available', 'partial', 'Listed as the delay-send rule in new Outlook. Classic uses Options > Delay Delivery.'],
    ['Pin messages', 'Available', 'avail', 'Not supported in classic Outlook.'],
    ['Snooze', 'Available', 'avail', 'Not supported in classic Outlook.'],
    ['Sweep', 'Available', 'avail', 'Not supported in classic Outlook.'],
    ['Quick Steps', 'Partially available', 'partial', 'Check the Quick Steps you rely on.'],
    ['Rules', 'Partially available', 'partial', 'Rule import and export are not supported. Rules created in classic that run only on your PC may not run.'],
    ['Categories', 'Available', 'avail', 'Category colors and category favorites are available.'],
    ['Search folders', 'Partially available', 'partial', ''],
    ['COM add-ins', 'Not supported', 'no', 'New Outlook supports web add-ins.'],
    ['VBA macros', 'Not supported', 'no', ''],
    ['Custom forms', 'Not supported', 'no', ''],
    ['Teams add-in', 'Not supported', 'no', 'Teams is built into new Outlook, so you don’t need the add-in.'],
    ['Archive', 'Available', 'avail', 'Includes online archive.'],
    ['Automatic replies', 'Available', 'avail', 'Settings > Mail > Automatic replies.'],
    ['Signatures', 'Available', 'avail', ''],
    ['Dark mode and themes', 'Available', 'avail', ''],
    ['Preserve declined meetings', 'Available', 'avail', 'Settings > Calendar > Events and invitations.'],
    ['Shared mailboxes', 'Available', 'avail', 'As accounts and as resources.'],
    ['Delegate access', 'Partially available', 'partial', 'Shared mailbox delegate access is partial; calendar delegate access is available.'],
    ['Offline support', 'Partially available', 'partial', 'Mail and calendar offline support is partial.'],
    ['Notes', 'Partially available', 'partial', ''],
    ['Tasks', 'Available', 'avail', 'Tasks module; links to Microsoft To Do.'],
    ['Public folders', 'Partially available', 'partial', ''],
    ['Favorite folders', 'Available', 'avail', '']
  ];

  /* Where did it go? [task, classic path, new path, tag] */
  var MAP = [
    ['Switch between the apps', 'Switch in the top-right: Try the new Outlook', 'Switch in the top-right: New Outlook (choose Switch back to classic Outlook)', 'same'],
    ['Open options', 'File > Options', 'Settings (gear icon)', 'moved'],
    ['Change theme / dark mode', 'File > Office Account > Office Theme', 'Settings > General > Appearance', 'moved'],
    ['Manage rules', 'Home > Rules > Manage Rules & Alerts', 'Settings > Mail > Rules', 'moved'],
    ['Automatic replies', 'File > Info > Automatic Replies', 'Settings > Mail > Automatic replies', 'moved'],
    ['Show only unread mail', 'All | Unread above the message list', 'Filter button above the message list', 'moved'],
    ['Reading pane position', 'View > Reading Pane', 'View > Layout', 'moved'],
    ['List density', 'View > Change View', 'View > Density', 'moved'],
    ['Create a folder', 'Folder > New Folder', 'Right-click Inbox > Create new subfolder, or New folder in the folder pane', 'moved'],
    ['Undo delete', 'Quick Access Toolbar Undo / Ctrl+Z', 'Undo on the ribbon or message bar / Ctrl+Z', 'moved'],
    ['Save an attachment', 'Attachment menu > Save As…', 'Attachment menu > Download', 'different'],
    ['Search filters', 'Search tab > Scope, Has Attachments, Unread', 'Filter chips under the search box', 'moved'],
    ['Add a Teams link to a meeting', 'Teams Meeting button (add-in)', 'Teams meeting toggle (built in)', 'different'],
    ['Hold a message and send later', 'Options > Delay Delivery', 'Send arrow > Schedule send', 'different'],
    ['Cancel a message after sending', 'Not supported', 'Undo send (Settings > Mail > Compose and reply)', 'new'],
    ['Keep a message at the top of the list', 'Not supported', 'Pin', 'new'],
    ['Hide a message until later', 'Not supported', 'Snooze', 'new'],
    ['Clear out a sender’s messages', 'Not supported', 'Sweep', 'new'],
    ['Today’s agenda beside mail', 'Calendar or To-Do Bar', 'My Day', 'new'],
    ['Customize the Quick Access Toolbar', 'Quick Access Toolbar', 'No Quick Access Toolbar. A simplified or classic ribbon layout is available', 'different'],
    ['Install a COM add-in or run VBA', 'Supported', 'Not supported (web add-ins only)', 'missing']
  ];

  var CAVEATS = [
    'Features and wording differ by account type (Microsoft 365 work or school, Outlook.com, Gmail and others), by your organization’s policies, and by the Outlook version you run.',
    'New Outlook is updated frequently and features roll out gradually. Treat the status labels here as a snapshot and verify on the Microsoft page above before you make decisions.',
    'This simulator simplifies the real apps. Menus and dialogs are modeled on the real ones, but names, layout and exact behavior can differ slightly.',
    'All people, messages, files and meetings in this training are fictional. Nothing is ever sent, saved to your computer, or connected to a real mailbox.'
  ];

  OT.reference = { SOURCE: SOURCE, MATRIX: MATRIX, MAP: MAP, CAVEATS: CAVEATS };
})();
