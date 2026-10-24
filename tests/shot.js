const {launch}=require('./lib');
(async()=>{
 const {b,pg,errs,url}=await launch();
 await pg.goto(url);
 await pg.screenshot({path:'shots/dash.png',fullPage:false});
 await pg.goto(url+'#/lesson/l4'); await pg.waitForTimeout(300);
 await pg.screenshot({path:'shots/l4-intro.png'});
 await pg.click('#start-lesson'); await pg.waitForTimeout(500);
 await pg.screenshot({path:'shots/l4-start.png'});
 await pg.click('[data-t="b-new-mail"]'); await pg.waitForTimeout(400);
 await pg.screenshot({path:'shots/l4-compose.png'});
 console.log(errs);
 await b.close();
})();
