const {chromium:pw}=require('playwright-core');
const fs=require('fs');
const path=require('path');
/* Uses CHROME_PATH, a locally installed Chrome/Edge/Chromium, or the bundled Linux build as a last resort. */
async function findBrowser(){
  const c=[process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge','/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean);
  for(const p of c) if(fs.existsSync(p)) return {executablePath:p,args:[]};
  const sc=require('@sparticuz/chromium'); const chromium=sc.default||sc;
  return {executablePath:await chromium.executablePath(),args:chromium.args};
}
exports.launch=async function(opts={}){
  const br=await findBrowser();
  const b=await pw.launch({executablePath:br.executablePath,args:br.args,headless:true});
  const ctx=await b.newContext({viewport:opts.viewport||{width:1440,height:900}});
  const pg=await ctx.newPage();
  const errs=[];pg.on('pageerror',e=>errs.push('pageerror: '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
  const url=opts.url||('file://'+path.resolve(__dirname,'..',process.env.BUILT?'dist/outlook-training.html':'index.html'));
  return {b,ctx,pg,errs,url};
};
