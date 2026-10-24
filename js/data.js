/* ==========================================================================
   data.js — 100% fictional training data (Harborview Partners, *.example domains)
   OT.data.create() returns a fresh, independent mailbox every time a lesson
   starts, so exercises are deterministic and learners can always retry.
   ========================================================================== */
(function () {
  'use strict';
  var OT = window.OT;

  // The simulator has its own fixed clock so the training never goes stale.
  var NOW = new Date(2026, 9, 26, 9, 12).getTime(); // Monday, Oct 26, 2026 9:12 AM
  function ago(h) { return NOW - h * 3600000; }
  function at(dayOffset, h, m) { return new Date(2026, 9, 26 + dayOffset, h, m || 0).getTime(); }

  var CONTACTS = {
    jordan: { id: 'jordan', name: 'Jordan Rivera', email: 'jordan.rivera@harborview.example', title: 'Operations Analyst', dept: 'Operations', phone: '+1 555 0100' },
    priya: { id: 'priya', name: 'Priya Nair', email: 'priya.nair@harborview.example', title: 'Finance Director', dept: 'Finance', phone: '+1 555 0111' },
    marcus: { id: 'marcus', name: 'Marcus Chen', email: 'marcus.chen@harborview.example', title: 'Operations Manager', dept: 'Operations', phone: '+1 555 0112' },
    elena: { id: 'elena', name: 'Elena Petrova', email: 'elena.petrova@harborview.example', title: 'HR Business Partner', dept: 'People', phone: '+1 555 0113' },
    sam: { id: 'sam', name: 'Sam Okafor', email: 'sam.okafor@harborview.example', title: 'IT Service Desk Lead', dept: 'IT', phone: '+1 555 0114' },
    dana: { id: 'dana', name: 'Dana Whitfield', email: 'dana.whitfield@harborview.example', title: 'Project Manager, Atlas Rollout', dept: 'PMO', phone: '+1 555 0115' },
    luis: { id: 'luis', name: 'Luis Herrera', email: 'luis.herrera@harborview.example', title: 'Sales Lead', dept: 'Sales', phone: '+1 555 0116' },
    aisha: { id: 'aisha', name: 'Aisha Rahman', email: 'aisha.rahman@harborview.example', title: 'Legal Counsel', dept: 'Legal', phone: '+1 555 0117' },
    tom: { id: 'tom', name: 'Tom Becker', email: 'tom.becker@harborview.example', title: 'Facilities Coordinator', dept: 'Facilities', phone: '+1 555 0118' },
    meilin: { id: 'meilin', name: 'Mei Lin Zhao', email: 'meilin.zhao@harborview.example', title: 'Marketing Manager', dept: 'Marketing', phone: '+1 555 0119' },
    carla: { id: 'carla', name: 'Carla Mendes', email: 'carla.mendes@riversideprint.example', title: 'Accounts, Riverside Print Co.', dept: 'External', phone: '+1 555 0150' },
    digest: { id: 'digest', name: 'Logistics Weekly', email: 'digest@logisticsweekly.example', title: 'Newsletter', dept: 'External', phone: '' },
    prize: { id: 'prize', name: 'Prize Center', email: 'claim@win-now-prizes.example', title: 'Unknown sender', dept: 'External', phone: '' },
    all: { id: 'all', name: 'All Staff', email: 'allstaff@harborview.example', title: 'Distribution list', dept: 'Company-wide', phone: '' }
  };

  function att(id, name, kb, preview) { return { id: id, name: name, size: kb, ext: name.split('.').pop().toLowerCase(), preview: preview }; }

  var A = {
    budget: att('a-budget', 'Q4-Budget-Review.xlsx', 84, { kind: 'table', title: 'Q4 Budget Review (fictional)', rows: [['Line item', 'Budget', 'Forecast', 'Variance'], ['Warehouse labor', '$412,000', '$428,500', '+$16,500'], ['Freight & carriers', '$268,000', '$259,200', '-$8,800'], ['Packaging', '$74,500', '$77,100', '+$2,600'], ['Facilities', '$51,000', '$50,400', '-$600'], ['Total', '$805,500', '$815,200', '+$9,700']] }),
    agenda: att('a-agenda', 'Atlas-Kickoff-Agenda.docx', 36, { kind: 'text', title: 'Atlas Rollout — Kickoff Agenda', lines: ['1. Welcome and goals (10 min)', '2. Scope and timeline (15 min)', '3. Roles and responsibilities (15 min)', '4. Risks and dependencies (15 min)', '5. Next steps and owners (5 min)'] }),
    proposal: att('a-proposal', 'Bluebird-Proposal-v3.pdf', 1240, { kind: 'text', title: 'Bluebird Foods — Proposal v3', lines: ['Executive summary', 'Scope of services: regional cold-chain distribution', 'Service levels: 98.5% on-time delivery', 'Term: 24 months with annual review', 'Pricing: see attached summary'] }),
    pricing: att('a-pricing', 'Pricing-Summary.xlsx', 52, { kind: 'table', title: 'Pricing Summary (fictional)', rows: [['Service tier', 'Monthly fee', 'Included pallets'], ['Standard', '$14,200', '400'], ['Priority', '$18,900', '650'], ['Dedicated', '$27,300', '1,000']] }),
    renewal: att('a-renewal', 'Riverside-Renewal.pdf', 610, { kind: 'text', title: 'Riverside Print — Renewal Terms', lines: ['Term: 12 months from Jan 1', 'Price change: +3.5% on unit rates', 'Termination: 60 days written notice', 'Open item: delivery SLA wording (section 6)'] }),
    invoice: att('a-invoice', 'Invoice-4471.pdf', 140, { kind: 'table', title: 'Invoice #4471 (fictional)', rows: [['Description', 'Qty', 'Amount'], ['Quarterly brochure print run', '2,500', '$3,125.00'], ['Delivery', '1', '$180.00'], ['Total due', '', '$3,305.00']] }),
    news: att('a-news', 'Oct-Newsletter-Draft.docx', 48, { kind: 'text', title: 'October Newsletter — Draft', lines: ['Welcome from the leadership team', 'Atlas rollout: what to expect', 'Safety reminder: walkthroughs this week', 'Team spotlight: Warehouse crew'] }),
    photo: att('a-photo', 'Team-Photo.png', 2200, { kind: 'image', title: 'Team photo (fictional placeholder)', color: '#5b9bd5' })
  };

  function body() { return Array.prototype.slice.call(arguments).map(function (p) { return '<p>' + p + '</p>'; }).join(''); }

  function messages() {
    return [
      { id: 'm1', folder: 'inbox', from: 'priya', to: ['jordan'], cc: [], subject: 'Q4 budget review – numbers attached', date: ago(1), read: false, important: true, attachments: [A.budget],
        body: body('Hi Jordan,', 'Attached are the latest Q4 numbers. Could you check the warehouse line items before Tuesday\'s budget sync?', 'Thanks,<br>Priya') },
      { id: 'm2', folder: 'inbox', from: 'dana', to: ['jordan', 'marcus'], cc: [], subject: 'Atlas rollout: kickoff agenda', date: ago(2), read: false, attachments: [A.agenda],
        body: body('Hello team,', 'The draft agenda for Thursday\'s kickoff is attached. Please add anything your group needs covered.', 'Dana') },
      { id: 'm3', folder: 'inbox', from: 'sam', to: ['all'], cc: [], subject: 'Scheduled maintenance this Saturday', date: ago(3), read: false, attachments: [],
        body: body('Hi everyone,', 'The mail and file servers will be unavailable Saturday from 11 PM to 2 AM for routine maintenance. No action is needed.', 'IT Service Desk') },
      { id: 'm4', folder: 'inbox', from: 'dana', to: ['jordan', 'priya', 'marcus'], cc: [], subject: 'Invitation: Atlas Kickoff', date: ago(4), read: false, attachments: [], inviteId: 'e4',
        body: body('You are invited to the Atlas Rollout kickoff meeting.', 'Please respond so I can finalize room and Teams details.') },
      { id: 'm5', folder: 'inbox', from: 'tom', to: ['jordan'], cc: [], subject: 'Invitation: Safety training refresh', date: ago(5), read: false, attachments: [], inviteId: 'e5',
        body: body('Annual safety refresher for the operations team, Wednesday at 3 PM in Training Room B.', 'Attendance is recorded.') },
      { id: 'm6', folder: 'inbox', from: 'luis', to: ['jordan'], cc: ['priya'], subject: 'Bluebird Foods proposal – draft v3', date: ago(20), read: true, attachments: [A.proposal, A.pricing],
        body: body('Jordan,', 'Draft v3 of the Bluebird proposal and the pricing summary are attached. Let me know if the service levels look realistic from the operations side.', 'Luis') },
      { id: 'm7', folder: 'inbox', from: 'aisha', to: ['jordan'], cc: [], subject: 'Riverside Print renewal – contract review', date: ago(22), read: true, attachments: [A.renewal],
        body: body('Hi Jordan,', 'I\'ve reviewed the renewal terms. One open item on delivery SLA wording — details in the attached PDF.', 'Aisha') },
      { id: 'm8', folder: 'inbox', from: 'carla', to: ['jordan'], cc: [], subject: 'Invoice #4471 – Riverside Print', date: ago(26), read: true, attachments: [A.invoice],
        body: body('Hello Jordan,', 'Please find our latest invoice attached. Payment terms are net 30.', 'Carla Mendes<br>Riverside Print Co.') },
      { id: 'm9', folder: 'inbox', from: 'elena', to: ['all'], cc: [], subject: 'Open enrollment reminder', date: ago(30), read: true, attachments: [],
        body: body('Reminder: benefits open enrollment closes on Friday, November 6.', 'Contact People Operations if you have questions.') },
      { id: 'm10', folder: 'inbox', from: 'marcus', to: ['jordan'], cc: [], subject: 'Warehouse walkthrough – Wednesday 2:30 PM', date: ago(28), read: false, attachments: [],
        body: body('Hi Jordan,', 'Thanks for confirming Wednesday. Please bring the safety checklist and a hard hat.', 'Marcus') },
      { id: 'm11', folder: 'inbox', from: 'dana', to: ['jordan', 'priya', 'marcus'], cc: ['sam'], subject: 'Re: Atlas rollout – open risks', date: ago(48), read: true, attachments: [],
        body: body('Team,', 'Here are the three risks I want to review before kickoff: timeline for hardware delivery, training capacity, and the cutover weekend.', 'Please reply with anything I\'ve missed.', 'Dana') },
      { id: 'm12', folder: 'inbox', from: 'meilin', to: ['jordan'], cc: [], subject: 'October newsletter – please review', date: ago(50), read: true, attachments: [A.news, A.photo],
        body: body('Hi Jordan,', 'Could you review the operations section of the newsletter and let me know about any corrections?', 'Mei Lin') },
      { id: 'm13', folder: 'inbox', from: 'tom', to: ['all'], cc: [], subject: 'Parking lot repaving next week', date: ago(52), read: true, attachments: [],
        body: body('Heads up: the east parking lot will be repaved Tuesday through Thursday next week. Please use the west lot.', 'Tom') },
      { id: 'm14', folder: 'inbox', from: 'priya', to: ['jordan'], cc: [], subject: 'Lunch Friday?', date: ago(60), read: true, attachments: [],
        body: body('Are you free for lunch on Friday around noon? There\'s a new place by the station.', 'Priya') },
      { id: 'm15', folder: 'inbox', from: 'digest', to: ['jordan'], cc: [], subject: 'Logistics Weekly: 5 trends shaping Q4', date: ago(70), read: false, attachments: [],
        body: body('This week: cold-chain capacity, port congestion updates, and what carriers are signalling for the holiday peak.', 'You are receiving this newsletter because you subscribed (fictional).') },
      { id: 'm16', folder: 'inbox', from: 'sam', to: ['jordan'], cc: [], subject: 'Password expiry reminder', date: ago(90), read: true, attachments: [],
        body: body('Your network password expires in 10 days. You can change it from the company portal.', 'IT Service Desk') },
      { id: 's1', folder: 'sent', from: 'jordan', to: ['priya'], cc: [], subject: 'Re: Quarterly forecast', date: ago(30), read: true, attachments: [],
        body: body('Thanks Priya — the updated forecast looks right to me.', 'Jordan') },
      { id: 's2', folder: 'sent', from: 'jordan', to: ['marcus'], cc: [], subject: 'Delivery schedule for next week', date: ago(52), read: true, attachments: [],
        body: body('Marcus, here is the delivery schedule for next week. Shout if anything needs to move.', 'Jordan') },
      { id: 'd1', folder: 'drafts', from: 'jordan', to: [], cc: [], subject: 'Notes for Thursday', date: ago(40), read: true, attachments: [], draft: true,
        body: body('Draft: key points to raise at Thursday\'s kickoff…') },
      { id: 'x1', folder: 'deleted', from: 'digest', to: ['jordan'], cc: [], subject: 'Last chance: webinar seats', date: ago(100), read: true, attachments: [],
        body: body('Seats for the cold-chain webinar are almost gone (fictional promotion).') },
      { id: 'r1', folder: 'archive', from: 'elena', to: ['jordan'], cc: [], subject: 'Benefits summary 2026', date: ago(400), read: true, attachments: [],
        body: body('Here is the benefits summary for the current plan year.') },
      { id: 'j1', folder: 'junk', from: 'prize', to: ['jordan'], cc: [], subject: 'You have been selected for a reward!', date: ago(80), read: true, attachments: [],
        body: body('Click here to claim your reward now! (This is a fictional example of a suspicious message that landed in Junk Email.)') }
    ];
  }

  function events() {
    function att2(id, type, resp) { return { id: id, type: type || 'required', resp: resp || 'none' }; }
    return [
      { id: 'e1', title: 'Team standup', start: at(0, 9, 30), end: at(0, 9, 45), organizer: 'jordan', status: 'organizer', location: 'Room 2B', teams: false, attendees: [att2('marcus', 'required', 'accepted'), att2('priya', 'optional', 'tentative')] },
      { id: 'e8', title: 'Deep work block', start: at(1, 9, 0), end: at(1, 11, 0), organizer: 'jordan', status: 'organizer', location: '', teams: false, attendees: [] },
      { id: 'e2', title: 'Budget sync with Priya', start: at(1, 14, 0), end: at(1, 14, 30), organizer: 'priya', status: 'accepted', location: 'Finance huddle room', teams: false, attendees: [att2('priya', 'required', 'accepted'), att2('jordan', 'required', 'accepted')] },
      { id: 'e7', title: '1:1 with Marcus', start: at(0, 15, 0), end: at(0, 15, 30), organizer: 'marcus', status: 'accepted', location: 'Microsoft Teams Meeting', teams: true, attendees: [att2('marcus', 'required', 'accepted'), att2('jordan', 'required', 'accepted')] },
      { id: 'e3', title: 'Warehouse walkthrough', start: at(2, 14, 30), end: at(2, 15, 30), organizer: 'marcus', status: 'accepted', location: 'Dock 3', teams: false, attendees: [att2('marcus', 'required', 'accepted'), att2('jordan', 'required', 'accepted')] },
      { id: 'e5', title: 'Safety training refresh', start: at(2, 15, 0), end: at(2, 16, 0), organizer: 'tom', status: 'pending', location: 'Training Room B', teams: false, attendees: [att2('tom', 'required', 'accepted'), att2('jordan', 'required', 'none')], inviteMsg: 'm5' },
      { id: 'e4', title: 'Atlas Kickoff', start: at(3, 10, 0), end: at(3, 11, 0), organizer: 'dana', status: 'pending', location: 'Microsoft Teams Meeting', teams: true, attendees: [att2('dana', 'required', 'accepted'), att2('jordan', 'required', 'none'), att2('priya', 'required', 'none'), att2('marcus', 'required', 'none')], inviteMsg: 'm4' },
      { id: 'e6', title: 'Lunch with Priya', start: at(4, 12, 0), end: at(4, 13, 0), organizer: 'priya', status: 'accepted', location: 'Station Street Cafe', teams: false, attendees: [att2('priya', 'required', 'accepted'), att2('jordan', 'required', 'accepted')] }
    ];
  }

  var FILES = [
    { id: 'f1', name: 'Team-Photo.png', size: 2200, folder: 'Pictures', preview: A.photo.preview },
    { id: 'f2', name: 'Meeting-Notes.txt', size: 4, folder: 'Documents', preview: { kind: 'text', title: 'Meeting-Notes.txt', lines: ['Weekly ops sync notes (fictional)', '- Freight volumes steady', '- Two open headcount requests'] } },
    { id: 'f3', name: 'Expense-Report-Oct.xlsx', size: 61, folder: 'Documents', preview: { kind: 'table', title: 'Expense report (fictional)', rows: [['Date', 'Category', 'Amount'], ['Oct 6', 'Travel', '$212.40'], ['Oct 14', 'Meals', '$48.10']] } },
    { id: 'f4', name: 'Project-Charter.docx', size: 29, folder: 'Documents', preview: { kind: 'text', title: 'Project charter (fictional)', lines: ['Purpose: modernize warehouse scheduling', 'Sponsor: Operations', 'Success measure: 10% faster dock turnaround'] } }
  ];

  OT.data = {
    NOW: NOW,
    CONTACTS: CONTACTS,
    create: function () {
      return {
        me: 'jordan',
        contacts: OT.util.clone(CONTACTS),
        folders: [
          { id: 'inbox', name: 'Inbox', sys: true },
          { id: 'drafts', name: 'Drafts', sys: true },
          { id: 'sent', name: 'Sent Items', sys: true },
          { id: 'deleted', name: 'Deleted Items', sys: true },
          { id: 'junk', name: 'Junk Email', sys: true },
          { id: 'archive', name: 'Archive', sys: true },
          { id: 'outbox', name: 'Outbox', sys: true }
        ],
        messages: messages(),
        events: events(),
        files: OT.util.clone(FILES),
        downloads: [],
        rules: [{ id: 'rule1', name: 'Newsletters to Archive', field: 'from', text: 'logisticsweekly', moveTo: 'archive', enabled: true }],
        autoReply: { on: false, text: '' },
        // Classic and New Outlook are separate apps with separate settings.
        settings: {
          classic: { officeTheme: 'colorful', density: 'cozy', reading: 'right', folderPane: true, signature: '', workStart: 8, workEnd: 17 },
          'new': { theme: 'light', accent: 'blue', density: 'cozy', reading: 'right', folderPane: true, ribbon: 'simplified', undoSend: 10, showDeclined: false, signature: '', workStart: 8, workEnd: 17 }
        },
        seq: 100
      };
    }
  };
})();
