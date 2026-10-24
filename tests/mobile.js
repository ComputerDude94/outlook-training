const {launch}=require('./lib'); const {runLesson}=require('./bot');
(async()=>{
 const vp=process.argv[3]==='tablet'?{width:820,height:1100}:{width:390,height:844};
 const {b,pg,errs,url}=await launch({viewport:vp}); await pg.goto(url);
 const ids=(await pg.evaluate(()=>OT.lessons.map(l=>l.id))); let bad=0;
 for(const id of ids){ if(process.argv[2]&&process.argv[2]!=='all'&&id!==process.argv[2]) continue;
   const r=await runLesson(pg,{id}); const done=await pg.evaluate(i=>OT.progress.lessonDone(i),id);
   const hscroll=await pg.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
   console.log(id,'completed:',done,'page h-scroll:',hscroll); r.problems.forEach(p=>{console.log('  !',p);bad++}); if(!done)bad++; }
 console.log('errors',errs, bad?'FAIL '+bad:'ALL OK'); await b.close();
})();
