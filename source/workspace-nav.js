/* Solar Sandbox task navigation.
 * UI-only transformation: keeps existing element IDs, event handlers, math and state.
 * No code or styles are reused from the external example project.
 */
(function(){
  "use strict";
  const sim=document.getElementById("sim");
  if(!sim || sim.dataset.workspaceReady==="1") return;
  const nav=sim.querySelector(":scope > .tabs");
  const build=document.getElementById("pane-build");
  if(!nav || !build || !window.SIM) return;
  sim.dataset.workspaceReady="1";
  const get=id=>document.getElementById(id);
  const pane=(id,title,description)=>{
    const p=document.createElement("div");
    p.className="pane ss-work-pane";
    p.id="pane-"+id;
    p.innerHTML='<div class="ss-head"><h2>'+title+'</h2><p>'+description+"</p></div>";
    sim.appendChild(p);
    return p;
  };
  const overview=pane("overview","Live solar system",
    "See generation, battery charge and household demand together. The controls above run the same simulation as before.");
  overview.innerHTML+='<div class="ss-actions">'+
    '<button type="button" data-ss-go="build">Configure system</button>'+
    '<button type="button" data-ss-go="loads">Edit appliances</button>'+
    '<button type="button" data-ss-go="missions">Run a scenario</button>'+
    '<button type="button" data-ss-go="score">Review results</button>'+
    '<button type="button" data-ss-go="shop">Parts and costs</button></div>';
  const shop=pane("shop","Parts, prices and shopping",
    "Existing prices are dated October 30–31, 2026. They are not live stock or checkout quotes. The partial parts total excludes tax, shipping and unpriced items.");
  const reference=pane("reference","Sources and model details",
    "Detailed equations, source documents, limitations and further reading are kept here, instead of filling the main page.");

  // Relocate the actual price/parts elements, not clones: existing renderCost()
  // continues to update the same IDs and original input listeners survive.
  const rootChild=(element,root)=>{
    if(!element)return null;
    let node=element;
    while(node.parentElement && node.parentElement!==root)node=node.parentElement;
    return node.parentElement===root?node:null;
  };
  const costStart=rootChild(get("costTop"),build);
  const checkRoot=rootChild(get("checks"),build);
  const costEnd=checkRoot && [...build.children].find(n=>
    n.classList.contains("group")&&n.textContent.trim().startsWith("Design check")) || checkRoot;
  if(costStart&&costEnd){
    let node=costStart;
    for(let guard=0;node&&node!==costEnd&&guard<32;guard++){
      const next=node.nextElementSibling;
      shop.appendChild(node);
      node=next;
    }
  }
  // Split the previously enormous Build form by the actual task a person
  // wants to accomplish. Move original DOM nodes (and their listeners) once.
  const heading=(value)=>[...build.children].find(n=>
    n.classList.contains("group")&&n.textContent.trim().startsWith(value));
  const groupSpecs=[
    {id:"solar",name:"Panels & MPPT",start:build.firstElementChild},
    {id:"battery",name:"Battery & backup",start:rootChild(get("bpar"),build)},
    {id:"site",name:"Site & weather",start:heading("Panel mount")},
    {id:"wiring",name:"Wiring & protection",start:heading("Wiring")},
    {id:"projects",name:"Save & share",start:heading("Save and share")},
    {id:"checks",name:"Design checks",start:heading("Design check")}
  ];
  if(groupSpecs.every(x=>x.start)&&
     new Set(groupSpecs.map(x=>x.start)).size===groupSpecs.length){
    const subsections=[];
    for(let i=0;i<groupSpecs.length;i++){
      const spec=groupSpecs[i], nextStart=groupSpecs[i+1]?.start||null;
      const section=document.createElement("section");
      section.className="ss-builder-section";
      section.dataset.ssBuilderSection=spec.id;
      section.id="ss-builder-panel-"+spec.id;
      section.setAttribute("role","tabpanel");
      section.setAttribute("aria-labelledby","ss-builder-tab-"+spec.id);
      section.hidden=i!==0;
      const h=document.createElement("h3");
      h.textContent=spec.name;
      section.appendChild(h);
      let n=spec.start;
      for(let guard=0;n&&n!==nextStart&&guard<100;guard++){
        const next=n.nextElementSibling;
        section.appendChild(n);
        n=next;
      }
      subsections.push(section);
    }
    // A product-oriented editor must not bury batteries in the PV menu or
    // position/irradiance controls in the electrical-device menu.
    const solarSection=subsections.find(p=>p.dataset.ssBuilderSection==="solar");
    const batterySection=subsections.find(p=>p.dataset.ssBuilderSection==="battery");
    const siteSection=subsections.find(p=>p.dataset.ssBuilderSection==="site");
    const batteryAnchor=batterySection.children[1]||null;
    for(const element of [get("btype"),get("sysV"),solarSection.querySelector(".qB")]){
      const top=rootChild(element,solarSection);
      if(top)batterySection.insertBefore(top,batteryAnchor);
    }
    const coldRow=rootChild(get("cold"),batterySection);
    if(coldRow)siteSection.insertBefore(coldRow,siteSection.children[1]||null);
    for(const element of [get("shade"),get("horBox")]){
      const top=rootChild(element,solarSection);
      if(top)siteSection.appendChild(top);
    }
    const header=document.createElement("div");
    header.className="ss-head";
    header.innerHTML="<h2>Configure your solar system</h2>"+
      "<p>Choose a topic below. Existing settings, safety notes and electrical checks remain available.</p>";
    const sectionNav=document.createElement("nav");
    sectionNav.className="ss-builder-nav";
    sectionNav.setAttribute("aria-label","System builder topics");
    sectionNav.setAttribute("role","tablist");
    function selectBuilder(id){
      sectionNav.querySelectorAll("button[data-ss-builder]").forEach(b=>{
        const on=b.dataset.ssBuilder===id;
        b.classList.toggle("on",on);
        b.setAttribute("aria-selected",String(on));
        b.tabIndex=on?0:-1;
      });
      subsections.forEach(p=>p.hidden=p.dataset.ssBuilderSection!==id);
    }
    for(const spec of groupSpecs){
      const b=document.createElement("button");
      b.type="button";
      b.textContent=spec.name;
      b.dataset.ssBuilder=spec.id;
      b.id="ss-builder-tab-"+spec.id;
      b.setAttribute("role","tab");
      b.setAttribute("aria-controls","ss-builder-panel-"+spec.id);
      b.onclick=()=>selectBuilder(spec.id);
      sectionNav.appendChild(b);
    }
    sectionNav.addEventListener("keydown",event=>{
      const tabs=[...sectionNav.querySelectorAll("button[data-ss-builder]")];
      const index=tabs.indexOf(document.activeElement);
      if(index<0)return;
      let next;
      if(event.key==="ArrowRight"||event.key==="ArrowDown")next=(index+1)%tabs.length;
      else if(event.key==="ArrowLeft"||event.key==="ArrowUp")next=(index-1+tabs.length)%tabs.length;
      else if(event.key==="Home")next=0;
      else if(event.key==="End")next=tabs.length-1;
      else return;
      event.preventDefault();
      tabs[next].click();
      tabs[next].focus();
    });
    build.appendChild(header);
    build.appendChild(sectionNav);
    for(const section of subsections)build.appendChild(section);
    selectBuilder("solar");
  }
  // Documentation formerly came after the simulator as a second, unbounded
  // page. Keep everything, in its original order, inside Reference.
  const wrap=sim.parentElement;
  if(wrap){
    let sibling=sim.nextElementSibling;
    for(let guard=0;sibling&&guard<64;guard++){
      const next=sibling.nextElementSibling;
      reference.appendChild(sibling);
      sibling=next;
    }
  }
  for(const id of ["partsList","srcParts"]){
    const element=get(id);
    const details=element&&element.closest("details");
    if(details){
      if(!get("ss-shop-detail-title")){
        const h=document.createElement("h3");
        h.id="ss-shop-detail-title";
        h.textContent="Product specifications and source links";
        shop.appendChild(h);
      }
      shop.appendChild(details);
    }
  }
  const sourceHeader=reference.querySelector("h2");
  if(sourceHeader)sourceHeader.textContent="Model documentation";
  const oldDocHeader=[...reference.querySelectorAll("h2")].find(h=>h!==sourceHeader&&
    h.textContent.trim()==="How the model works");
  if(oldDocHeader)oldDocHeader.remove();

  function addTab(id,label,position){
    const b=document.createElement("button");
    b.type="button";
    b.dataset.tab=id;
    b.textContent=label;
    b.onclick=()=>{
      nav.querySelectorAll("button[data-tab]").forEach(x=>x.classList.toggle("on",x===b));
      sim.querySelectorAll(".pane").forEach(p=>p.classList.toggle("on",p.id==="pane-"+id));
    };
    if(position==="first")nav.insertBefore(b,nav.firstElementChild);
    else nav.appendChild(b);
    return b;
  }
  const overviewTab=addTab("overview","Overview","first");
  addTab("shop","Shop & Compare","last");
  addTab("reference","Sources & Help","last");
  const textByTab={build:"System Builder",loads:"Loads",missions:"Scenarios",score:"Results"};
  nav.querySelectorAll("button[data-tab]").forEach(b=>{
    if(textByTab[b.dataset.tab])b.textContent=textByTab[b.dataset.tab];
    b.type="button";
    b.setAttribute("role","tab");
    b.id="ss-tab-"+b.dataset.tab;
    b.setAttribute("aria-controls","pane-"+b.dataset.tab);
    const target=get("pane-"+b.dataset.tab);
    if(target){
      target.setAttribute("role","tabpanel");
      target.setAttribute("aria-labelledby",b.id);
    }
  });
  nav.setAttribute("aria-label","Solar Sandbox main navigation");
  const brand=document.createElement("div");
  brand.className="ss-brand";
  brand.textContent="SOLAR SANDBOX";
  nav.insertBefore(brand,nav.firstElementChild);
  nav.addEventListener("keydown",event=>{
    const tabs=[...nav.querySelectorAll("button[data-tab]")];
    const index=tabs.indexOf(document.activeElement);
    if(index<0)return;
    let next;
    if(event.key==="ArrowRight"||event.key==="ArrowDown")next=(index+1)%tabs.length;
    else if(event.key==="ArrowLeft"||event.key==="ArrowUp")next=(index-1+tabs.length)%tabs.length;
    else if(event.key==="Home")next=0;
    else if(event.key==="End")next=tabs.length-1;
    else return;
    event.preventDefault();
    tabs[next].click();
    tabs[next].focus();
  });

  // Move navigation before the live diagram: on mobile the menu must never be
  // hidden beneath a 1050-unit-high visualization.
  sim.insertBefore(nav,sim.firstElementChild);
  const liveSelectors=["quick","stage","faults"];
  const liveControls=[...sim.querySelectorAll(":scope > .ctl")];
  // One workspace body enables a genuine desktop side rail without
  // re-creating the controls or changing their existing event listeners.
  const workspaceBody=document.createElement("div");
  workspaceBody.className="ss-workspace-body";
  for(const child of [...sim.children]){
    if(child!==nav)workspaceBody.appendChild(child);
  }
  sim.appendChild(workspaceBody);
  function synchronize(view){
    const live=view==="overview";
    for(const id of liveSelectors){
      const n=get(id);
      if(n){if(live)n.removeAttribute("hidden");else n.setAttribute("hidden","");}
    }
    for(const n of liveControls){if(live)n.removeAttribute("hidden");else n.setAttribute("hidden","");}
    nav.querySelectorAll("button[data-tab]").forEach(b=>{
      const active=b.dataset.tab===view;
      b.setAttribute("aria-selected",String(active));
      b.tabIndex=active?0:-1;
      b.classList.toggle("on",active);
    });
    sim.setAttribute("data-workspace",view);
  }
  // Existing core registers onclick for Build, Loads, Missions and Score.
  // Bubble event runs AFTER their original handler; do not reimplement the
  // core's chart/render functions or change any simulation data.
  nav.addEventListener("click",event=>{
    const b=event.target.closest("button[data-tab]");
    if(b&&nav.contains(b)){
      synchronize(b.dataset.tab);
      sim.scrollIntoView({block:"start",behavior:"auto"});
    }
  });
  overview.addEventListener("click",event=>{
    const b=event.target.closest("button[data-ss-go]");
    if(!b)return;
    const target=nav.querySelector('button[data-tab="'+b.dataset.ssGo+'"]');
    if(target)target.click();
  });
  if(get("qLoads"))get("qLoads").onclick=()=>{
    nav.querySelector('button[data-tab="loads"]').click();
  };
  if(get("qCost"))get("qCost").onclick=()=>{
    nav.querySelector('button[data-tab="shop"]').click();
  };

  const style=document.createElement("style");
  style.textContent=
    "#sim.ss-work-ready{overflow:visible}"+
    "#sim.ss-work-ready .ss-workspace-body{min-width:0}"+
    "#sim.ss-work-ready .tabs{position:sticky;top:0;z-index:30;display:flex;"+
      "gap:5px;overflow-x:auto;padding:8px;background:var(--sc);"+
      "border:1px solid var(--sr);border-radius:12px 12px 0 0;"+
      "scrollbar-width:thin;overscroll-behavior-x:contain}"+
    "#sim.ss-work-ready .ss-brand{display:block;font-size:12px;font-weight:800;"+
      "letter-spacing:.12em;padding:7px 8px;color:var(--sm)}"+
    "#sim.ss-work-ready .tabs button{flex:none;white-space:nowrap;"+
      "border:1px solid var(--sr);border-radius:9px;min-height:44px;"+
      "padding:9px 14px;background:var(--sg);font-weight:600}"+
    "#sim.ss-work-ready .tabs button.on{border-color:var(--si);"+
      "background:var(--si);color:var(--sc)}"+
    "#sim.ss-work-ready .tabs button:focus-visible,"+
      "#sim.ss-work-ready .ss-builder-nav button:focus-visible,"+
      "#sim.ss-work-ready .ss-actions button:focus-visible{outline:3px solid #3b82f6;outline-offset:2px}"+
    "#sim.ss-work-ready [hidden]{display:none!important}"+
    "#sim.ss-work-ready svg.stage{height:auto;max-height:none;"+
      "width:100%;max-width:600px;margin:0 auto;object-fit:contain}"+
    "#sim.ss-work-ready .ss-work-pane{padding:20px;max-width:960px;margin:auto}"+
    "#sim.ss-work-ready .ss-head h2{font-size:21px;margin:0 0 4px}"+
    "#sim.ss-work-ready .ss-head p{font-size:13px;color:var(--sm);"+
      "line-height:1.5;margin:0 0 14px}"+
    "#sim.ss-work-ready .ss-actions{display:grid;"+
      "grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:14px 0}"+
    "#sim.ss-work-ready .ss-actions button{min-height:44px;font-weight:600}"+
    "#sim.ss-work-ready .ss-builder-nav{display:flex;flex-wrap:wrap;gap:6px;"+
      "margin:12px 0;padding:6px 0;border-bottom:1px solid var(--sr)}"+
    "#sim.ss-work-ready .ss-builder-nav button{min-height:44px;font-weight:600}"+
    "#sim.ss-work-ready .ss-builder-nav button.on{background:var(--si);color:var(--sc)}"+
    "#sim.ss-work-ready .ss-builder-section{padding:4px 0 14px}"+
    "#sim.ss-work-ready .ss-builder-section h3{font-size:16px;margin:9px 0 12px}"+
    "#sim.ss-work-ready #pane-shop .costs{max-width:100%}"+
    "#sim.ss-work-ready #pane-reference>details,"+
      "#sim.ss-work-ready #pane-shop>details{margin:10px 0}"+
    "#sim.ss-work-ready #pane-reference details>summary,"+
      "#sim.ss-work-ready #pane-shop details>summary{display:list-item;"+
      "padding:10px 12px;border:1px solid var(--sr);border-radius:9px;"+
      "cursor:pointer;line-height:1.35}"+
    "#sim.ss-work-ready #pane-reference details>summary b,"+
      "#sim.ss-work-ready #pane-shop details>summary b{display:inline-block;margin-right:6px}"+
    "#sim.ss-work-ready #pane-reference details>summary span,"+
      "#sim.ss-work-ready #pane-shop details>summary span{display:block;"+
      "color:var(--sm);font-weight:400;font-size:12px;margin-top:4px}"+
    "@media(min-width:901px){"+
      "#sim.ss-work-ready{display:grid;grid-template-columns:208px minmax(0,1fr);align-items:start}"+
      "#sim.ss-work-ready .tabs{grid-column:1;grid-row:1;display:flex;flex-direction:column;"+
        "position:sticky;top:12px;align-self:start;max-height:calc(100vh - 24px);"+
        "overflow-y:auto;overflow-x:hidden;border:0;border-right:1px solid var(--sr);"+
        "border-radius:0;padding:12px 10px}"+
      "#sim.ss-work-ready .tabs button{width:100%;text-align:left;white-space:normal}"+
      "#sim.ss-work-ready .ss-workspace-body{grid-column:2;grid-row:1}"+
    "}"+
    "@media(max-width:900px){"+
      "#sim.ss-work-ready .ss-brand{grid-column:1/-1;padding:0 5px;font-size:11px}"+
      "#sim.ss-work-ready .tabs{position:sticky;top:0;display:grid;"+
        "grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;overflow:visible;padding:6px}"+
      "#sim.ss-work-ready .tabs button{white-space:normal;min-width:0;"+
        "min-height:48px;padding:7px 5px;line-height:1.2;font-size:12px}"+
      "#sim.ss-work-ready .ss-work-pane{padding:12px}"+
      "#sim.ss-work-ready svg.stage{height:auto;max-height:none;max-width:600px}"+
    "}";
  document.head.appendChild(style);
  sim.classList.add("ss-work-ready");
  overviewTab.click();
})();