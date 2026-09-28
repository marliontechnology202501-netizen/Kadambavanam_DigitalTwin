(() => {
  'use strict';
  const data = window.KDV_LIBRARY;
  const app = document.querySelector('#app');
  const dialog = document.querySelector('#viewer');
  const labels = {all: 'All buildings', existing: 'Existing / archive', construction: 'Under construction', future: 'Future / proposed', unverified: 'Status unverified'};
  const relationLabels = {matched: 'Building reference', shared: 'Shared / subtype unverified', candidate: 'Candidate match', context: 'Context only', site: 'Shared site plan', document: 'Historical document'};
  let state = {status: 'all', search: '', tab: 'all', relation: 'all', shown: 40, sourceSearch: '', sourceLimit: 60};
  let gallery = [], viewing = [], imageIndex = 0, lastFocus = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = name => `<i data-lucide="${name}"></i>`;
  const icons = () => window.lucide?.createIcons();
  const badge = b => `<span class="badge ${b.status}">${esc(b.statusLabel)}</span>`;
  const asset = r => data.assets[r.asset];
  const footer = () => `<footer class="footer">Archive review: 28 September 2026. Status is evidence-dated, not a current site survey.<br>11 main modelling families + 2 additional proposals. Repeated buildings and wings are not extra families.</footer>`;
  function refCounts(b) { return {photos:b.refs.filter(r=>asset(r).kind==='photo' && r.relation!=='site').length, drawings:b.refs.filter(r=>['dwg','plan'].includes(asset(r).kind)&&r.relation!=='site').length}; }
  function rows() {
    const results = data.buildings.filter(b => (state.status==='all'||b.status===state.status) && `${b.id} ${b.name} ${b.area}`.toLowerCase().includes(state.search.toLowerCase()));
    document.querySelector('#result-count').textContent = `${results.length} building families`;
    document.querySelector('#register').innerHTML = results.length ? results.map(b => {
      const count=refCounts(b);
      return `<article class="building-row"><img class="thumb" src="${data.assets[b.cover].thumb}" alt="${esc(b.name)} reference" loading="lazy"><div><span class="id">${b.id} / ${b.area}</span><h2>${esc(b.name)}</h2></div><div class="status-cell">${badge(b)}<div class="location-tiny">Plan ${esc(b.location.item)}</div></div><div class="row-count"><strong>${count.photos}</strong> photos<br><strong>${count.drawings}</strong> drawings</div><a class="view-button primary" href="#building/${b.id}" aria-label="View ${esc(b.name)}" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px;border-radius:5px;text-decoration:none">${icon('eye')} View</a></article>`;
    }).join('') : '<p class="empty">No buildings match this selection.</p>';
    icons();
  }
  function buildingsPage() {
    app.innerHTML = `<main class="page"><div class="page-head"><div><div class="eyebrow">Architecture / Evidence Register</div><h1>Building Reference Library</h1><p class="subtle">Drawings, photographs and plan locations for the Kadambavanam digital twin.</p></div><div class="summary"><div><strong>13</strong><span>Building families</span></div><div><strong>${data.coverage.webPhotos}</strong><span>Reference images</span></div><div><strong>11</strong><span>Original DWGs</span></div></div></div><div class="workspace"><aside class="sidebar"><h2>Construction Status</h2><div class="filter-list">${Object.entries(labels).map(([key,label])=>`<button data-status="${key}" class="${state.status===key?'active':''}" aria-pressed="${state.status===key}">${label}<span>${key==='all'?13:data.buildings.filter(b=>b.status===key).length}</span></button>`).join('')}</div><a href="#map"><img src="${data.plan.path}" alt="Kadambavanam supplied site plan"></a><p>Source: supplied concept layout.<br>Dates and uncertain matches are recorded per building.</p></aside><section aria-label="Building list"><div class="toolbar"><label class="search">${icon('search')}<input id="building-search" type="search" placeholder="Search buildings or zones" aria-label="Search buildings" value="${esc(state.search)}"></label><span class="count" id="result-count"></span></div><div class="register" id="register"></div><p class="notice">Construction categories reflect archive evidence. Cottage photographs may be shared between design families pending an exact drawing-to-building match.</p></section></div>${footer()}</main>`;
    rows();
  }
  function detailPage(id) {
    const b=data.buildings.find(x=>x.id===id);
    if(!b){app.innerHTML='<main class="page"><h1>Building not found</h1><p><a href="#buildings">Return to buildings</a></p></main>';return;}
    const count = key => b.refs.filter(r => tabMatches(r,key)).length;
    app.innerHTML = `<main class="page"><div class="breadcrumb"><a href="#buildings">Buildings</a>${icon('chevron-right')}<span>${b.id}</span></div><div class="detail-heading"><div><div class="eyebrow">${b.area} / ${b.scope==='Proposed'?'Additional proposal':'Main documented family'}</div><h1>${esc(b.name)}</h1>${badge(b)}</div><button data-action="print" class="icon-button" title="Print building reference" aria-label="Print building reference">${icon('printer')}</button></div><section class="detail-top" aria-label="Location and status"><div class="location-panel"><figure><button class="image-link" data-location="crop" data-building="${id}" aria-label="Enlarge building location crop"><img src="${b.location.crop}" alt="${esc(b.name)}: cropped location from supplied layout"></button><figcaption>Plan ${esc(b.location.item)} / ${esc(b.location.certainty)}</figcaption></figure><figure><button class="image-link" data-location="overview" data-building="${id}" aria-label="Enlarge full site location"><img src="${b.location.overview}" alt="Full site with ${esc(b.name)} region outlined"></button><figcaption>${esc(b.location.note)}</figcaption></figure></div><div class="facts"><h3>Status Evidence</h3><p>${esc(b.statusNote)}</p><h3>Modelling Scope</h3><p>${esc(b.countingRule)}</p><a href="#map">Open site plan ${icon('arrow-up-right')}</a></div></section><nav class="detail-nav" aria-label="Reference type">${[['all','All references'],['photo','Photos'],['drawing','Drawings'],['site','Site plans'],['document','Documents'],['evidence','Verification']].map(([key,label])=>`<button data-tab="${key}" class="${state.tab===key?'active':''}" aria-pressed="${state.tab===key}">${label}${key==='evidence'?'':` <small>${count(key)}</small>`}</button>`).join('')}</nav><div id="detail-content"></div>${footer()}</main>`;
    renderGallery(b);icons();
  }
  function tabMatches(r,tab){const a=asset(r);if(tab==='all')return true;if(tab==='photo')return a.kind==='photo'&&r.relation!=='site';if(tab==='drawing')return ['dwg','plan'].includes(a.kind)&&r.relation!=='site';if(tab==='site')return r.relation==='site';if(tab==='document')return a.kind==='document'&&r.relation!=='site';return false;}
  function renderGallery(b){
    const node=document.querySelector('#detail-content');
    if(state.tab==='evidence'){
      node.innerHTML=`<div class="proof-list"><div class="proof-line"><h3>Location confidence</h3>${esc(b.location.note)}</div><div class="proof-line"><h3>Source limitations</h3>${esc(b.limitation)}</div><div class="proof-line"><h3>Original evidence locators</h3>${b.evidence.map(e=>`<p><a href="#sources/${e.source_id}">${e.source_id}</a>: ${esc(e.locator)}</p>`).join('')}</div><div class="proof-line"><h3>Current as-built status</h3>Not verified. Historical construction photographs do not establish the present condition.</div></div>`;return;
    }
    gallery=b.refs.filter(r=>tabMatches(r,state.tab)&&(state.relation==='all'||r.relation===state.relation));
    const subset=gallery.slice(0,state.shown);
    node.innerHTML=`<div class="toolbar"><span class="count">${gallery.length} references${gallery.length>state.shown?` / showing ${state.shown}`:''}</span><label><select id="relation-filter" aria-label="Reference confidence">${[['all','All matches'],...Object.entries(relationLabels)].map(([key,label])=>`<option value="${key}" ${state.relation===key?'selected':''}>${label}</option>`).join('')}</select></label></div><div class="gallery">${subset.map((r,i)=>{const a=asset(r);return `<article class="asset"><button class="image-link" data-image="${i}" aria-label="View ${esc(a.title)}"><img src="${a.thumb}" alt="${esc(a.title)}" loading="lazy"></button><div class="asset-body"><h3>${esc(a.title)}</h3><div class="asset-meta"><span>${a.source} / ${a.kind.toUpperCase()}</span><span class="relation">${relationLabels[r.relation]}</span></div><div class="asset-footer"><button class="icon-button" style="width:28px;height:28px" data-image="${i}" title="View reference" aria-label="View ${esc(a.title)}">${icon('eye')}</button><a href="${a.download}" ${a.page?'target="_blank" rel="noopener"':'download'} title="${esc(a.downloadLabel)}">${icon('download')} ${a.kind==='dwg'?'DWG':a.kind==='document'?'PDF':'Image'}</a></div></div></article>`;}).join('')}</div>${!gallery.length?'<div class="empty">No references in this category. Change the reference type or match filter.</div>':''}${gallery.length>state.shown?'<button class="load-more" data-action="more">'+icon('plus')+' Load more</button>':''}`;
    icons();
  }
  function mapPage(){
    app.innerHTML=`<main class="page"><div class="page-head"><div><div class="eyebrow">Campus / Spatial Reference</div><h1>Site Plan</h1><p class="subtle">Supplied concept layout. Outlines and markers are approximate reference regions, not survey boundaries.</p></div></div><div class="map-layout"><div class="site-map"><img src="${data.plan.path}" alt="Kadambavanam campus layout">${data.buildings.map(b=>{const p=b.location.box;return `<a class="map-marker" href="#building/${b.id}" style="left:${(p[0]+p[2])/2/data.plan.width*100}%;top:${(p[1]+p[3])/2/data.plan.height*100}%" title="${esc(b.name)} / ${esc(b.location.certainty)}" aria-label="View ${esc(b.name)}">${b.id}</a>`;}).join('')}</div><div class="map-key">${data.buildings.map(b=>`<a href="#building/${b.id}"><strong>${b.id}</strong><span>${esc(b.name)}<br><span class="subtle">Plan ${esc(b.location.item)}</span></span></a>`).join('')}</div></div><p class="notice">Premium and Pool-view cottage markers show candidate zones. Circular-unit placement is provisional. Pool changing rooms are not separately labelled on this supplied plan. The northern region III is marked Future Expansion; no additional approved building design is inferred from it.</p>${footer()}</main>`;icons();
  }
  function sourceRows(){
    const items=Object.values(data.sources).filter(s=>`${s.id} ${s.path}`.toLowerCase().includes(state.sourceSearch.toLowerCase()));
    document.querySelector('#source-count').textContent=`${items.length} source files`;
    document.querySelector('#source-rows').innerHTML=items.slice(0,state.sourceLimit).map(s=>{const a=data.assets[s.id];return `<tr><td>${s.id}</td><td>${esc(s.path)}<br><span class="subtle">${(s.bytes/1024/1024).toFixed(2)} MB original${s.aliases.length>1?` / ${s.aliases.length} identical archive copies`:''}</span></td><td><code>${s.sha256}</code></td><td>${a?`<a href="${a.download}" ${a.page?'':'download'}>${a.kind==='dwg'?'DWG':a.kind==='document'?'PDF':'Web image'}</a>`:'Evidence source'}</td></tr>`}).join('');
    document.querySelector('#more-sources').hidden=items.length<=state.sourceLimit;
  }
  function sourcesPage(fid){
    if(fid)state.sourceSearch=fid;
    const c=data.coverage;
    app.innerHTML=`<main class="page"><div class="page-head"><div><div class="eyebrow">Provenance / Download Register</div><h1>Source Library</h1><p class="subtle">Original drawings and documents, medium-quality web photographs and source-file hashes.</p></div><a href="data/library.json" download>Download register ${icon('download')}</a></div><div class="source-summary"><div><strong>${c.publishedSourceFiles}</strong><span>Source files used</span></div><div><strong>${c.webPhotos}</strong><span>Web photographs / layouts</span></div><div><strong>${c.originalDWGs}</strong><span>Original DWGs</span></div><div><strong>${c.originalPDFs}</strong><span>Original PDFs</span></div></div><div class="toolbar"><label class="search">${icon('search')}<input id="source-search" type="search" aria-label="Search sources" placeholder="Source ID or original filename" value="${esc(state.sourceSearch)}"></label><span id="source-count" class="count"></span></div><div class="source-scroll"><table class="source-table"><thead><tr><th>ID</th><th>Archive-relative path</th><th>Original SHA256</th><th>Download</th></tr></thead><tbody id="source-rows"></tbody></table></div><button id="more-sources" class="load-more" data-action="more-sources">${icon('plus')} Load more</button><section class="coverage"><h2>Coverage and Evidence Limits</h2><ul>${c.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul><p>Inventory basis: ${c.archiveFiles} archive files. Source hashes verify file identity, not architectural accuracy. Exact duplicate paths are retained in the downloadable register. Original DWG/PDF files are unchanged; photo downloads are web derivatives with metadata stripped.</p></section>${footer()}</main>`;sourceRows();icons();
  }
  function showImage(){
    const r=viewing[imageIndex],a=r.custom||asset(r),s=data.sources[a.source];
    document.querySelector('#viewer-title').textContent=`${a.title} (${imageIndex+1}/${viewing.length})`;
    const image=document.querySelector('#viewer-image');image.src=a.preview;image.alt=a.title;
    document.querySelector('#viewer-meta').innerHTML=`<a class="download" href="${a.download||a.preview}" ${a.page?'target="_blank" rel="noopener"':'download'}>${icon('download')}${esc(a.downloadLabel||'Download image')}</a><p>${esc(r.note||a.note||'')}</p>${s?`<p><strong>${s.id}</strong> / ${esc(s.path)}</p><code>Original SHA256: ${s.sha256}</code>`:'<p>Source: user-supplied concept-layout screenshot.</p>'}`;
    dialog.querySelector('.prev').disabled=viewing.length<2;dialog.querySelector('.next').disabled=viewing.length<2;icons();
  }
  function openImages(items,index){viewing=items;imageIndex=index;lastFocus=document.activeElement;showImage();if(!dialog.open)dialog.showModal();}
  function closeViewer(){dialog.close();if(lastFocus?.isConnected)lastFocus.focus();}
  function currentBuilding(){return data.buildings.find(b=>b.id===location.hash.split('/')[1]);}
  function route(){
    if(dialog.open)closeViewer();
    const [section,id]=(location.hash.slice(1)||'buildings').split('/');
    document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===(section==='building'?'buildings':section)));
    if(section==='building'){state.tab='all';state.relation='all';state.shown=40;detailPage(id);}
    else if(section==='map')mapPage();else if(section==='sources')sourcesPage(id);else buildingsPage();
    window.scrollTo(0,0);
  }
  document.addEventListener('click',event=>{
    const el=event.target.closest('[data-status],[data-tab],[data-image],[data-location],[data-action]');if(!el)return;
    if(el.dataset.status){state.status=el.dataset.status;buildingsPage();}
    else if(el.dataset.tab){state.tab=el.dataset.tab;state.relation='all';state.shown=40;detailPage(currentBuilding().id);}
    else if(el.dataset.image!==undefined)openImages(gallery,Number(el.dataset.image));
    else if(el.dataset.location){const b=data.buildings.find(x=>x.id===el.dataset.building);openImages([{custom:{title:b.name+' / plan location',preview:b.location[el.dataset.location]},note:b.location.note}],0);}
    else switch(el.dataset.action){case 'close-viewer':closeViewer();break;case 'previous-image':imageIndex=(imageIndex-1+viewing.length)%viewing.length;showImage();break;case 'next-image':imageIndex=(imageIndex+1)%viewing.length;showImage();break;case 'more':state.shown+=40;renderGallery(currentBuilding());break;case 'more-sources':state.sourceLimit+=60;sourceRows();break;case 'print':window.print();break;}
  });
  document.addEventListener('input',event=>{if(event.target.id==='building-search'){state.search=event.target.value;rows();}if(event.target.id==='source-search'){state.sourceSearch=event.target.value;state.sourceLimit=60;sourceRows();}});
  document.addEventListener('change',event=>{if(event.target.id==='relation-filter'){state.relation=event.target.value;state.shown=40;renderGallery(currentBuilding());}});
  document.addEventListener('keydown',event=>{if(!dialog.open)return;if(event.key==='ArrowLeft'){imageIndex=(imageIndex-1+viewing.length)%viewing.length;showImage();}if(event.key==='ArrowRight'){imageIndex=(imageIndex+1)%viewing.length;showImage();}});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeViewer();}});
  dialog.addEventListener('cancel',()=>{if(lastFocus?.isConnected)lastFocus.focus();});
  window.addEventListener('hashchange',route);route();
})();
