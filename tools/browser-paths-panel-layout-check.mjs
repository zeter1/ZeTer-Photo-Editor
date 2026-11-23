// Real Chromium file:// layout regression: the Paths card must never clip
// its subpath and operation controls behind the History card.
export async function verifyPathsPanelLayout(client, { evaluate, assert, waitFor }) {
  function inspect() {
    const sidebar=document.querySelector('.right-panel');
    const panel=document.querySelector('.paths-panel');
    const history=document.querySelector('.history-panel');
    const list=document.querySelector('#pathsList');
    if(!sidebar||!panel||!history||!list)return null;
    const rect=node=>{const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};};
    const names=['newPathBtn','editPathBtn','applyPathMaskBtn','pathSubpathSelect','pathSubpathOperation'];
    return {panel:rect(panel),history:rect(history),sidebar:rect(sidebar),
      cardClient:panel.clientHeight,cardScroll:panel.scrollHeight,
      sidebarClient:sidebar.clientHeight,sidebarScroll:sidebar.scrollHeight,
      listClient:list.clientHeight,listScroll:list.scrollHeight,
      paths:list.querySelectorAll('.path-row').length,
      controls:names.map(id=>({id,...rect(document.getElementById(id))}))};
  }
  const inspectPage=()=>evaluate(client,'('+inspect.toString()+')()');
  for(const [width,height] of [[1280,768],[960,490],[900,700],[720,500]]) {
    await client.send('Emulation.setDeviceMetricsOverride',
      {width,height,deviceScaleFactor:1,mobile:false});
    await waitFor('Paths panel present',async()=>Boolean(await inspectPage()),6000);
    const view=await inspectPage();
    assert(view.cardScroll<=view.cardClient+2,
      'Paths card contents must not be vertically clipped: '+JSON.stringify({width,height,view}));
    for(const control of view.controls) {
      assert(control.top>=view.panel.top-1 && control.bottom<=view.panel.bottom+1,
        control.id+' must fit inside Paths card: '+JSON.stringify({width,height,view}));
    }
    assert(view.history.top>=view.panel.bottom-1,
      'History must not overlap Paths: '+JSON.stringify({width,height,view}));
    // The outer sidebar must remain scrollable when height cannot fit all cards.
    await evaluate(client,"document.getElementById('pathSubpathOperation').scrollIntoView({block:'nearest'})");
    const visible=await evaluate(client,"(() => { const aside=document.querySelector('.right-panel').getBoundingClientRect(); const operation=document.getElementById('pathSubpathOperation').getBoundingClientRect(); return operation.top>=aside.top-1 && operation.bottom<=aside.bottom+1; })()");
    assert(visible,'operation select must be reachable by sidebar scrolling at '+width+'x'+height);
  }
  await client.send('Emulation.setDeviceMetricsOverride',
    {width:1280,height:768,deviceScaleFactor:1,mobile:false});
  const created=await evaluate(client,"(() => { const create=document.querySelector('#newPathBtn'); if(!create || create.disabled)return 0; for(let i=0;i<12;i++)create.click(); return document.querySelectorAll('#pathsList .path-row').length; })()");
  assert(created===12,'New Saved Path UI creates 12 paths: '+created);
  const many=await inspectPage();
  assert(many.cardScroll<=many.cardClient+2 &&
    many.listScroll>many.listClient && many.listClient<=210,
    'many saved paths must scroll inside list without hiding controls: '+JSON.stringify(many));
  for(const control of many.controls) {
    assert(control.bottom<=many.panel.bottom+1,
      'many paths must not clip '+control.id+': '+JSON.stringify(many));
  }
  console.log('Paths panel controls, history boundary, sidebar scroll and many Saved Paths PASS');
}
