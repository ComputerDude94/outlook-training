const {launch}=require('./lib'); const {runLesson}=require('./bot');
let fails=0; const ok=(c,m)=>{ if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
(async()=>{
 const {b,pg,errs,url}=await launch(); await pg.goto(url);
 const L={}; (await pg.evaluate(()=>OT.lessons.map(l=>({id:l.id})))).forEach(l=>L[l.id]=l);
 const fb=async()=>pg.evaluate(()=>(document.querySelector('.coach-fb')||{}).innerText||'');
 const stats=async()=>pg.evaluate(()=>OT.app.runner().stats);

 console.log('Wrong action: send with no recipient (L4 step 4)');
 await runLesson(pg,L.l4,{stopAt:3});
 await pg.click('[data-act="rcpt-remove"]'); await pg.fill('#c-to-input','');
 await pg.click('[data-t="c-send"]'); await pg.waitForTimeout(200);
 ok(/recipient/i.test(await fb()),'feedback mentions recipient: '+(await fb()).replace(/\n/g,' ').slice(0,90));
 ok((await stats()).wrong===1,'mistake counted');
 await pg.click('[data-t="c-send"]'); await pg.waitForTimeout(200);
 ok(/Hint/.test(await pg.innerText('.coach-hint')),'hint auto-shown after 2 mistakes');
 // recover: add recipient then send
 await pg.fill('#c-to-input','Priya'); await pg.press('#c-to-input','Enter'); await pg.click('[data-t="c-send"]'); await pg.waitForTimeout(300);
 ok(await pg.evaluate(()=>OT.app.runner().state)==='done','correct action after mistakes completes the step');

 console.log('Wrong action: Reply instead of Reply All (L5 step 2)');
 await runLesson(pg,L.l5,{stopAt:1});
 await pg.click('[data-t="b-reply"]'); await pg.waitForTimeout(200);
 ok(/Reply All/i.test(await fb()),'feedback explains Reply vs Reply All');
 ok(await pg.evaluate(()=>OT.app.runner().state)==='active','step not completed by wrong action');

 console.log('Wrong action: accept conflicting invite (L11 step 5)');
 await runLesson(pg,L.l11,{stopAt:4});
 await pg.click('[data-t="rsvp-accept"]'); await pg.waitForTimeout(200);
 const menu=await pg.$('[data-t="rs-send"]'); if(menu) await menu.click(); await pg.waitForTimeout(300);
 ok(/double-book/i.test(await fb()),'conflict feedback: '+(await fb()).replace(/\n/g,' ').slice(0,80));
 ok(await pg.evaluate(()=>OT.app.runner().state)==='active','accepting does not complete step');
 await pg.click('[data-t="rsvp-tentative"]'); await pg.click('[data-t="rs-send"]'); await pg.waitForTimeout(300);
 ok(await pg.evaluate(()=>OT.app.runner().state)==='done','tentative completes step');

 console.log('Question step: wrong answers (L1 step 2)');
 await runLesson(pg,L.l1,{stopAt:1});
 let radios=await pg.$$('.coach input[name="q-opt"]'); await radios[0].check(); await pg.click('[data-c="check"]'); await pg.waitForTimeout(100);
 ok(/Not quite/.test(await fb()),'wrong answer feedback');
 radios=await pg.$$('.coach input[name="q-opt"]'); await radios[2].check(); await pg.click('[data-c="check"]'); await pg.waitForTimeout(100);
 ok(await pg.evaluate(()=>!!document.querySelector('.q-opt.right')),'correct answer revealed after 2 misses');
 radios=await pg.$$('.coach input[name="q-opt"]'); await radios[1].check(); await pg.click('[data-c="check"]'); await pg.waitForTimeout(100);
 ok(await pg.evaluate(()=>OT.app.runner().state)==='done','right answer completes');

 console.log('Hint button + idle');
 await runLesson(pg,L.l3,{stopAt:0}); await pg.click('[data-c="hint"]');
 ok(/Hint\./.test(await pg.innerText('.coach-hint')),'hint button shows hint');

 console.log('Mode mismatch banner (toggle away during a New step)');
 await runLesson(pg,L.l3,{stopAt:4});
 ok(await pg.evaluate(()=>OT.app.sim().ui.mode)==='new','part auto-switched the simulator to New');
 await pg.click('[data-t="toggle"]'); await pg.click('[data-t="mode-switchback"]'); await pg.waitForTimeout(500);
 ok(await pg.evaluate(()=>!!document.querySelector('.coach-mode')),'banner offers switching back to New');
 await pg.click('[data-c="mode"]'); await pg.waitForTimeout(200);
 ok(await pg.evaluate(()=>OT.app.sim().ui.mode)==='new','switch button works');

 console.log('Restart lesson resets simulator');
 await pg.click('[data-c="restart"]'); await pg.waitForTimeout(300);
 ok(await pg.evaluate(()=>OT.app.runner().idx)===0 && await pg.evaluate(()=>OT.app.sim().ui.mode)==='classic','restart returns to step 1 in classic');

 console.log('Persistence: complete L1 then reload');
 await pg.goto(url+'#/'); await pg.evaluate(()=>localStorage.clear()); await pg.reload();
 await runLesson(pg,L.l1);
 await pg.reload(); await pg.goto(url+'#/'); await pg.waitForTimeout(200);
 ok(/1\/15/.test(await pg.innerText('.stats')),'dashboard shows 1/15 lessons after reload: '+(await pg.innerText('.stats')).replace(/\n/g,' | '));
 await pg.goto(url+'#/lesson/l1'); await pg.waitForSelector('#start-lesson');
 ok(/again/i.test(await pg.innerText('#start-lesson')),'completed lesson offers practice again');

 console.log('Module quiz: fail then pass');
 await pg.goto(url+'#/quiz/m1'); await pg.waitForSelector('[data-q="begin"]');
 ok(/haven.t finished/i.test(await pg.innerText('#quiz')),'warns when lessons unfinished');
 await pg.click('[data-q="begin"]');
 for(let i=0;i<5;i++){ await pg.waitForSelector('input[name="qa"]'); await pg.locator('input[name="qa"]').first().check(); await pg.click('[data-q="check"]'); await pg.click('[data-q="next"]'); }
 await pg.waitForSelector('.result-h'); const res=await pg.innerText('#quiz');
 const sc=/(\d)\/5/.exec(res); console.log('  first-option score:',sc&&sc[0]);
 const failed=/Not passed/.test(res); console.log('  result:',failed?'not passed':'passed');
 // retry and answer correctly using the real answers
 await pg.click('[data-q="retry"]'); await pg.waitForSelector('input[name="qa"]');
 for(let i=0;i<5;i++){ await pg.waitForSelector('input[name="qa"]'); const idx=await pg.evaluate(()=>{const Z=null;return null;});
   // read correct option text via explanation: pick by evaluating bank
   const qtext=await pg.innerText('.qtext');
   const ans=await pg.evaluate(t=>{const q=OT.quiz.forModule('m1').find(x=>x.q===t);return q.options[q.answer];},qtext);
   const opts=await pg.$$eval('.q-opt',els=>els.map(e=>e.innerText.trim())); const ix=opts.findIndex(t=>t===ans.trim()); await pg.locator('.q-opt').nth(ix>=0?ix:opts.findIndex(t=>t.includes(ans))).locator('input').check(); await pg.click('[data-q="check"]'); await pg.click('[data-q="next"]'); }
 await pg.waitForSelector('.result-h'); ok(/You passed/.test(await pg.innerText('#quiz')),'perfect retry passes');
 const q=await pg.evaluate(()=>OT.progress.data.quizzes.m1); ok(q&&q.attempts===2&&q.best===5&&q.passed,'quiz stored attempts=2 best=5 passed: '+JSON.stringify(q));
 await pg.reload(); ok((await pg.evaluate(()=>OT.progress.data.quizzes.m1.best))===5,'quiz result survives reload');

 console.log('Final assessment');
 await pg.goto(url+'#/final'); await pg.waitForSelector('[data-q="begin"]'); await pg.click('[data-q="begin"]');
 let n=0; while(await pg.$('input[name="qa"]')){ const qt=await pg.innerText('.qtext');
   const ans=await pg.evaluate(t=>{const q=OT.quiz.finalPool().find(x=>x.q===t);return q.options[q.answer];},qt);
   const opts=await pg.$$eval('.q-opt',els=>els.map(e=>e.innerText.trim())); const ix=opts.findIndex(t=>t===ans.trim()); await pg.locator('.q-opt').nth(ix>=0?ix:opts.findIndex(t=>t.includes(ans))).locator('input').check(); await pg.click('[data-q="check"]'); await pg.click('[data-q="next"]'); n++; await pg.waitForTimeout(30); if(n>30)break; }
 ok(n===15,'15 final questions asked ('+n+')');
 await pg.waitForSelector('.result-h'); ok(/You passed/.test(await pg.innerText('#quiz')),'final passed');
 await pg.goto(url+'#/summary'); await pg.waitForSelector('text=best final assessment score'); const sm=await pg.innerText('#main'); if(!/15\/15/.test(sm))console.log(sm.match(/\d+\/\d+ best final/)+'');ok(/best final assessment score/.test(sm)&&/15\/15|15 of 15|15\/15/.test(sm),'summary shows final score');

 console.log('Reset');
 await pg.click('[data-go="reset"]'); await pg.waitForSelector('.modal');
 await pg.click('[data-m="cancel"]'); ok(!(await pg.$('.modal')),'cancel closes modal');
 ok((await pg.evaluate(()=>OT.progress.counts().done))>0,'progress kept after cancel');
 await pg.click('[data-go="reset"]'); await pg.click('[data-m="ok"]'); await pg.waitForTimeout(300);
 ok((await pg.evaluate(()=>OT.progress.counts().done))===0,'reset clears progress');
 ok((await pg.evaluate(()=>localStorage.getItem('outlook-training.progress.v1')))===null,'storage entry removed');
 console.log('page errors:',errs); if(errs.length) fails++;
 console.log(fails?('FAILURES: '+fails):'ALL BEHAVIOR CHECKS PASSED');
 await b.close();
})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
