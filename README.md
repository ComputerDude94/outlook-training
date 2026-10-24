# Classic vs New Outlook for Windows: Interactive Training

A standalone, browser-based training app. Employees practice in a realistic Outlook simulator (Classic and New, with a toggle) through 15 guided lessons, 5 module quizzes and a final assessment. No backend, no real email, no network calls. All people, messages, files and meetings are fictional.

## Run it

**Easiest:** open `dist/outlook-training.html` in any modern browser (Edge, Chrome, Firefox, Safari). It is one self-contained file (CSS and JS inlined) and works from `file://`.

**From source:** open `index.html`. It loads `css/styles.css` and the `js/*.js` files with plain script tags (no modules, no bundler).

Rebuild the single file after editing source:

```
node tools/build.js      # writes dist/outlook-training.html
```

## Deploy

- **Internal web server / IIS / nginx / Netlify:** upload `dist/outlook-training.html` (or the whole folder). It needs no server-side code. Rename to `index.html` if you want it to be the default page.
- **SharePoint:** upload `dist/outlook-training.html` to a document library. SharePoint often forces `.html` files to download instead of rendering them. If that happens, either host the file on an internal web server and link to it from SharePoint, or embed it from the hosting location with the Embed web part. Check your tenant's policy on custom script.
- **LMS:** it is not SCORM-packaged. Link to it from your LMS. Progress is stored in each learner's own browser, so it is not reported centrally.

## Tests

```
cd tests && npm install && npm test
```

The tests drive a headless browser. They use Chrome, Edge or Chromium if one is installed (set `CHROME_PATH` to point at a specific one), and fall back to a bundled Linux build.

## What it covers

| Module | Lessons |
|---|---|
| 1 Getting started | Switching between Classic and New; finding your way around |
| 2 Reading and writing mail | Reading mail; writing a message; reply, reply all, forward |
| 3 Organizing your mailbox | Delete, undo, recover; search and filters; folders and rules; flags, pin, snooze, sweep; attachments |
| 4 Calendar | Responding to invitations; scheduling a Teams meeting |
| 5 Settings and customizing | Schedule send and undo send; settings; "Where did it go?" |

Each lesson has one task per step, a highlighted control with instructions, validation of the action actually performed in the simulator, hints and feedback on mistakes, and a "what changed and where is it now" summary. Also included: a Practice mailbox (free play), a Reference page (availability matrix and "where did it go" map, with a filter), a results summary (printable, with copy/download of the results) and a reset button.

Progress (completed lessons, quiz scores, final score) is saved in the browser's `localStorage` under `outlook-training.progress.v1`. Pass mark is 80%. If a browser blocks storage, the app still works and shows a notice that progress lasts only for the tab. A reload in the middle of a lesson restarts that lesson (completed lessons stay completed).

## Accuracy notes

Feature availability and menu locations were checked against Microsoft's page [Feature comparison between new Outlook and classic Outlook](https://support.microsoft.com/office/feature-comparison-between-new-outlook-and-classic-outlook-de453583-1e76-48bf-975a-2e9cd2ee16dd) (page last updated September 23, 2026; checked October 24, 2026). Data is in `js/reference.js`.

- Outlook changes often. Features roll out gradually and differ by account type, organization policy and version. Re-check the Microsoft page before each rollout and update `js/reference.js`, the lesson text and the quiz.
- The simulator simplifies the real apps. Layout, names and exact behavior can differ slightly. It was built from documentation, not from a side-by-side test against live Outlook.
- Things that are unavailable or different in New Outlook are labeled as such (for example COM add-ins, VBA macros and custom forms are not supported; Delay Delivery becomes Schedule send; Teams is built in rather than an add-in).

## Structure

```
index.html            page shell and script order
css/styles.css        all styling (light/dark, narrow layout, print)
js/core.js            helpers, event bus, icons, storage wrapper
js/data.js            fictional contacts, messages, events, files
js/sim.js             simulator state and actions
js/sim-ui.js          Classic/New chrome rendering
js/sim-forms.js       compose, meeting form, dialogs, settings, File backstage
js/lessons.js         modules and lessons (steps, targets, validators)
js/engine.js          lesson runner: highlighting, validation, hints, feedback
js/quiz.js            module quiz and final assessment questions
js/reference.js       availability matrix, where-did-it-go map
js/app.js             router, dashboard, progress, results, reset
tools/build.js        inlines everything into dist/outlook-training.html
tests/                headless-browser tests
```

### Add or change a lesson

Edit `js/lessons.js`. Each step has `text`, `target` (the `data-t` key(s) to highlight, or a function of the simulator state), `done(event, sim)` (returns true when the real action happened), optional `wrong(event, sim)` returning feedback, `hint`, and `part` (`classic` or `new`). Add questions to `js/quiz.js` and run the tests.

## Accessibility

Keyboard-operable controls, visible focus, ARIA roles/labels on navigation, progress bars, dialogs and quizzes, a skip link, reduced-motion support, light/dark via system setting, and a layout that works from phone width up. It has not been tested with a screen reader on real devices.

## Tests

```
cd tests && npm install
npm test                 # all lessons end to end, behaviors, phone layout
npm run test:built       # same lessons and behaviors against dist/
node mobile.js all tablet
```

The tests drive real headless Chromium (Playwright with `@sparticuz/chromium`). A bot follows each lesson's highlighted control and performs the action, for all 15 lessons. Separate checks cover wrong actions and feedback, hints, question steps, quiz fail/retry/pass, the final assessment, persistence across reload, and reset. Lessons are also completed at phone (390px) and tablet (820px) widths with no horizontal page scroll.
