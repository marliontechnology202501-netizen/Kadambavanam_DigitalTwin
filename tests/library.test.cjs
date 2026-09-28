const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/library.json'),'utf8'));
function exists(url){assert(!/^(?:file:|[A-Z]:|\/)/.test(url),url);assert(fs.existsSync(path.join(root,url.split('#')[0])),url);}
test('13 families, 11 original DWGs, 2 PDFs and complete local assets',()=>{
  assert.equal(data.buildings.length,13);assert.equal(data.coverage.originalDWGs,11);assert.equal(data.coverage.originalPDFs,2);
  exists(data.plan.path);
  for(const a of Object.values(data.assets)){exists(a.preview);exists(a.thumb);exists(a.download);assert(data.sources[a.source]);}
  for(const b of data.buildings){exists(b.location.crop);exists(b.location.overview);assert.equal(b.statusCurrentVerified,false);assert(data.assets[b.cover]);assert(b.refs.length>0);for(const r of b.refs)assert(data.assets[r.asset]);}
});
test('no source files above GitHub limit; download originals retain source hash',()=>{
  const crypto=require('node:crypto');
  for(const a of Object.values(data.assets).filter(a=>a.kind==='dwg'||(a.kind==='document'&&!a.page))){
    const bytes=fs.readFileSync(path.join(root,a.download));assert(bytes.length<100*1024*1024);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),data.sources[a.source].sha256);
  }
});
function setup(){const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://example.test/Kadambavanam_DigitalTwin/',runScripts:'outside-only'});const w=dom.window;w.scrollTo=()=>{};w.print=()=>{};w.lucide={createIcons:()=>{}};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.KDV_LIBRARY=data;w.eval(fs.readFileSync(path.join(root,'app.js'),'utf8'));return dom;}
test('all view buttons, filters and search work',()=>{const dom=setup(),d=dom.window.document;assert.equal(d.querySelectorAll('.view-button').length,13);for(const status of ['existing','construction','future','unverified','all']){d.querySelector(`[data-status="${status}"]`).click();assert.equal(d.querySelectorAll('.building-row').length,status==='all'?13:data.coverage.statusCounts[status]);}const input=d.querySelector('#building-search');input.value='no-such-building';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert.equal(d.querySelectorAll('.building-row').length,0);assert(d.querySelector('.empty'));dom.window.close();});
test('every detail has location crops and working gallery categories',async()=>{const dom=setup(),w=dom.window,d=w.document;for(const b of data.buildings){w.location.hash=`building/${b.id}`;await new Promise(r=>w.setTimeout(r,0));assert.equal(d.querySelector('h1').textContent,b.name);assert.equal(d.querySelectorAll('[data-location]').length,2);for(const tab of ['photo','drawing','site','document','evidence','all']){d.querySelector(`[data-tab="${tab}"]`).click();assert(d.querySelector('#detail-content'));}const view=d.querySelector('[data-image]');assert(view,b.id);view.click();assert(d.querySelector('#viewer').open);assert(d.querySelector('#viewer-image').getAttribute('src'));d.querySelector('[data-action="close-viewer"]').click();assert(!d.querySelector('#viewer').open);}dom.window.close();});
test('map and source routes render; original download links are portable',async()=>{const dom=setup(),w=dom.window,d=w.document;w.location.hash='map';await new Promise(r=>w.setTimeout(r,0));assert.equal(d.querySelectorAll('.map-marker').length,13);w.location.hash='sources/F2020';await new Promise(r=>w.setTimeout(r,0));assert(d.querySelector('#source-rows').textContent.includes('Pool view Units'));assert.equal(d.querySelectorAll('#source-rows tr').length,1);dom.window.close();});
