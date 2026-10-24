const sc=require('@sparticuz/chromium');const chromium=sc.default||sc;
const {chromium:pw}=require('playwright-core');
const path=require('path');
exports.launch=async function(opts={}){
  const b=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
  const ctx=await b.newContext({viewport:opts.viewport||{width:1440,height:900}});
  const pg=await ctx.newPage();
  const errs=[];pg.on('pageerror',e=>errs.push('pageerror: '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
  const url=opts.url||('file://'+path.resolve(__dirname,'..',process.env.BUILT?'dist/outlook-training.html':'index.html'));
  return {b,ctx,pg,errs,url};
};
