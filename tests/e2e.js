const {launch}=require('./lib'); const {runLesson}=require('./bot');
(async()=>{
 const {b,pg,errs,url}=await launch(); await pg.goto(url);
 const lessons=await pg.evaluate(()=>OT.lessons.map(l=>({id:l.id,n:l.steps.length})));
 const only=process.argv[2];
 let bad=0;
 for(const L of lessons){ if(only && L.id!==only) continue;
   const r=await runLesson(pg,L); const done=await pg.evaluate(id=>OT.progress.lessonDone(id),L.id);
   console.log(L.id,'steps visited',r.steps+'/'+L.n,'completed:',done); r.problems.forEach(p=>{console.log('  !',p);bad++}); if(!done) bad++; }
 console.log('page errors:',errs); console.log(bad?'FAIL '+bad:'ALL OK');
 await b.close();
})();
