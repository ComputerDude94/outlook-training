const {launch}=require('./lib');
(async()=>{
 const {b,pg,errs,url}=await launch(); await pg.goto(url+'#/summary');
 await pg.fill('#who-name','Pat Example');
 const printName=await pg.textContent('#who-print');
 const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('[data-go=download]')]);
 const txt=require('fs').readFileSync(await dl.path(),'utf8');
 const banner=await pg.textContent('.banner.phi');
 const ok=printName==='Pat Example'&&/Learner: Pat Example/.test(txt)&&/Practice only/.test(banner)&&!errs.length;
 console.log(ok?'RESULTS OK':'RESULTS FAIL',{printName,banner:banner.slice(0,30),errs}); await b.close(); process.exit(ok?0:1);
})();
