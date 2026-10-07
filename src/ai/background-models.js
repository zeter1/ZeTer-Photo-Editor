import { createSamEngine } from './sam-runtime.js';

export const BACKGROUND_MODELS=Object.freeze([
  Object.freeze({id:'sam2',name:'SAM 2.1 Tiny',size:97,prefix:'qualityBackgroundModel',square:true,description:'Более сильная модель для сложных границ. Рекомендуется для автомобилей, животных и нескольких объектов в кадре.'}),
]);

// Each vetted model owns a separate fixed-key cache. Existing SlimSAM installs
// survive; switching choice never redirects a command already in progress.
export function createBackgroundModels({gpu,storage=globalThis.localStorage,engineFactory=createSamEngine}={}){
  const key='zeter-background-removal-choice-v1',engines=new Map(BACKGROUND_MODELS.map(model=>[model.id,engineFactory({gpu,square:model.square})]));
  let selected='sam2';try{const saved=storage?.getItem(key);if(engines.has(saved))selected=saved;}catch{}
  const selectedModel=()=>BACKGROUND_MODELS.find(model=>model.id===selected),getEngine=id=>engines.get(id);
  const facade={models:BACKGROUND_MODELS,selectedId:()=>selected,selectedModel,getEngine,
    select(id){if(!engines.has(id))throw new Error('Неизвестная нейросеть');selected=id;try{storage?.setItem(key,id);}catch{}},
    capture:()=>({engine:getEngine(selected),model:selectedModel()}),
  };
  for(const method of ['isReady','isBusy','isStored','prepare','remove','run'])facade[method]=(...args)=>getEngine(selected)[method](...args);
  return facade;
}
