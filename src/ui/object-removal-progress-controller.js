export function createObjectRemovalProgressController({panel,bar,label,elapsed,remaining,now=()=>performance.now(),schedule=callback=>setInterval(callback,1000),unschedule=id=>clearInterval(id),inferenceLabel='Восстановление фона…'}={}) {
  let active=false,timer=null,started=0,inferenceStarted=0,estimate=null;
  function tick(){
    if(!active)return;
    elapsed.textContent=`Прошло: ${Math.floor((now()-started)/1000)} с`;
    if(estimate!==null){
      const seconds=Math.ceil(estimate-(now()-inferenceStarted)/1000);
      remaining.textContent=seconds>0?`Примерно осталось: ${seconds} с`:'Расчёт дольше предыдущего · обработка продолжается';
    }
  }
  function begin(){
    if(active)return;
    active=true;started=now();estimate=null;panel.hidden=false;
    bar.value=0;label.textContent='1 из 3 · Подготовка изображения…';remaining.textContent='Оставшееся время пока неизвестно';
    tick();timer=schedule(tick);
  }
  function update({stage,message,estimatedSeconds}={}){
    if(!active)return;
    if(stage==='initialize'){bar.value=20;label.textContent='1 из 3 · Подготовка нейросети…';}
    else if(stage==='inference'){
      bar.removeAttribute('value');label.textContent=`2 из 3 · ${inferenceLabel}`;inferenceStarted=now();
      estimate=Number.isFinite(estimatedSeconds)&&estimatedSeconds>0?estimatedSeconds:null;
      remaining.textContent=estimate===null?'Первый запуск · оцениваем скорость устройства':'Примерное время по предыдущему удалению';
    }else if(stage==='save'){estimate=null;bar.value=90;label.textContent='3 из 3 · Сохранение результата…';remaining.textContent='Почти готово';}
    else if(message)label.textContent=message;
    tick();
  }
  function finish(){if(!active)return;active=false;unschedule(timer);timer=null;panel.hidden=true;estimate=null;}
  return {begin,update,finish};
}
