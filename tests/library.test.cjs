const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/library.json'),'utf8'));
function exists(url){assert(!/^(?:file:|[A-Z]:|\/)/.test(url),url);assert(fs.existsSync(path.join(root,url.split('#')[0])),url);}
test('14 reference entries, 13 families, 11 original DWGs, 2 PDFs and complete local assets',()=>{
  assert.equal(data.buildings.length,14);assert.equal(data.coverage.referenceEntries,14);assert.equal(data.coverage.documentedFamilies,13);assert.equal(data.coverage.existingPhotoVariants,1);assert.equal(data.coverage.originalDWGs,11);assert.equal(data.coverage.originalPDFs,2);
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
test('all view buttons, filters and search work',()=>{const dom=setup(),d=dom.window.document;assert.equal(d.querySelectorAll('.view-button').length,14);for(const status of ['cottages','existing','construction','future','unverified','all']){d.querySelector(`[data-status="${status}"]`).click();assert.equal(d.querySelectorAll('.building-row').length,status==='all'?14:status==='cottages'?4:data.coverage.statusCounts[status]);}const input=d.querySelector('#building-search');input.value='no-such-building';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert.equal(d.querySelectorAll('.building-row').length,0);assert(d.querySelector('.empty'));dom.window.close();});

test('cottages come first, future proposals last, and the existing G+1 entry is discoverable',async()=>{
  const dom=setup(),w=dom.window,d=w.document;
  const links=()=>[...d.querySelectorAll('.view-button')].map(a=>a.getAttribute('href'));
  assert.deepEqual(links().slice(0,4),['#building/E01','#building/B09','#building/B10','#building/B11']);
  assert.deepEqual(links().slice(-2),['#building/P01','#building/P02']);
  assert.equal(d.querySelector('.priority-heading').textContent,'Priority 1 / Cottages');
  d.querySelector('[data-status="cottages"]').click();
  assert.equal(links().length,4);
  assert.equal(d.querySelectorAll('.priority-heading').length,1);
  d.querySelector('[data-status="existing"]').click();
  assert.equal(links().length,6);assert.equal(links()[0],'#building/E01');
  w.location.hash='building/E01';await new Promise(r=>w.setTimeout(r,0));
  assert.equal(d.querySelector('h1').textContent,'Existing Cottage - G+1');
  assert.match(d.querySelector('.drawing-notice').textContent,/Dedicated drawing match not yet verified/);
  const b=data.buildings.find(b=>b.id==='E01');
  assert.equal(b.status,'existing');assert.equal(b.scope,'Existing photo reference');assert.equal(b.location.showMarker,false);
  for(const fid of ['F0809','F1503'])assert(b.refs.some(r=>r.asset===fid&&data.assets[fid].kind==='photo'));
  assert(!b.refs.some(r=>r.relation!=='site'&&['dwg','plan'].includes(data.assets[r.asset].kind)));
  for(const id of b.drawingCandidates)assert(d.querySelector(`.drawing-notice a[href="#building/${id}"]`));
  d.querySelector('[data-tab="photo"]').click();assert.equal(d.querySelectorAll('.asset').length,12);
  dom.window.close();
});
test('every detail has location crops and working gallery categories',async()=>{const dom=setup(),w=dom.window,d=w.document;for(const b of data.buildings){w.location.hash=`building/${b.id}`;await new Promise(r=>w.setTimeout(r,0));assert.equal(d.querySelector('h1').textContent,b.name);assert.equal(d.querySelectorAll('[data-location]').length,2);for(const tab of ['photo','drawing','site','document','evidence','all']){d.querySelector(`[data-tab="${tab}"]`).click();assert(d.querySelector('#detail-content'));}const view=d.querySelector('[data-image]');assert(view,b.id);view.click();assert(d.querySelector('#viewer').open);assert(d.querySelector('#viewer-image').getAttribute('src'));d.querySelector('[data-action="close-viewer"]').click();assert(!d.querySelector('#viewer').open);}dom.window.close();});
test('map and source routes render; original download links are portable',async()=>{const dom=setup(),w=dom.window,d=w.document;w.location.hash='map';await new Promise(r=>w.setTimeout(r,0));assert.equal(d.querySelectorAll('.map-marker').length,13);w.location.hash='sources/F2020';await new Promise(r=>w.setTimeout(r,0));assert(d.querySelector('#source-rows').textContent.includes('Pool view Units'));assert.equal(d.querySelectorAll('#source-rows tr').length,1);dom.window.close();});
