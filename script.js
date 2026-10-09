let N=16; // cantidad de pasos (se cambia desde el selector)
const $=id=>document.getElementById(id);
let ac,master,noiseBuf;
const drums=[
  {id:'kick',name:'Bombo',steps:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,1],vol:.9,mute:false},
  {id:'snare',name:'Caja',steps:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],vol:.7,mute:false},
  {id:'clap',name:'Palmas',steps:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],vol:.5,mute:false},
  {id:'hat',name:'Hi-hat',steps:[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,1],vol:.45,mute:false}
];
const ROWS=13; // C5 abajo hasta C4
const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
let roll=Array.from({length:ROWS},()=>Array(N).fill(0));
[[0,0],[3,2],[7,4],[3,6],[10,8],[7,10],[5,12],[7,14]].forEach(([semi,s])=>roll[12-semi][s]=1);
// semitono (0..12) -> fila = 12-semi
function initAudio(){
  if(ac)return;
  ac=new (window.AudioContext||window.webkitAudioContext)();
  master=ac.createGain();master.gain.value=$('master').value/100;
  const comp=ac.createDynamicsCompressor();
  master.connect(comp);comp.connect(ac.destination);
  noiseBuf=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);
  const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
}
function noise(t,dur,type,freq,g){
  const s=ac.createBufferSource();s.buffer=noiseBuf;
  const f=ac.createBiquadFilter();f.type=type;f.frequency.value=freq;
  const e=ac.createGain();e.gain.setValueAtTime(g,t);e.gain.exponentialRampToValueAtTime(.001,t+dur);
  s.connect(f);f.connect(e);e.connect(master);s.start(t);s.stop(t+dur+.02);
}
const voices={
  kick(t,v){const o=ac.createOscillator(),e=ac.createGain();
    o.frequency.setValueAtTime(160,t);o.frequency.exponentialRampToValueAtTime(42,t+.13);
    e.gain.setValueAtTime(v,t);e.gain.exponentialRampToValueAtTime(.001,t+.4);
    o.connect(e);e.connect(master);o.start(t);o.stop(t+.42)},
  snare(t,v){noise(t,.18,'highpass',1500,v);
    const o=ac.createOscillator(),e=ac.createGain();o.type='triangle';o.frequency.setValueAtTime(220,t);o.frequency.exponentialRampToValueAtTime(130,t+.08);
    e.gain.setValueAtTime(v*.6,t);e.gain.exponentialRampToValueAtTime(.001,t+.12);o.connect(e);e.connect(master);o.start(t);o.stop(t+.14)},
  clap(t,v){[0,.012,.026].forEach(d=>noise(t+d,.05,'bandpass',1400,v));noise(t+.04,.16,'bandpass',1400,v*.8)},
  hat(t,v){noise(t,.06,'highpass',7500,v)}
};
function synth(semi,t,dur){
  const f=261.63*Math.pow(2,semi/12);
  const o=ac.createOscillator(),fl=ac.createBiquadFilter(),e=ac.createGain();
  o.type=$('wave').value;o.frequency.value=f;
  fl.type='lowpass';fl.frequency.setValueAtTime(+$('cut').value,t);fl.frequency.exponentialRampToValueAtTime(300,t+dur*1.6);
  const v=$('syv').value/100*.35;
  e.gain.setValueAtTime(0,t);e.gain.linearRampToValueAtTime(v,t+.01);e.gain.exponentialRampToValueAtTime(.001,t+dur*1.6);
  o.connect(fl);fl.connect(e);e.connect(master);o.start(t);o.stop(t+dur*1.7);
}

let playing=false,step=0,nextT=0,timer,queue=[],lastStep=-1;

// ---------- UI ----------
const rack=$('rack'),rollEl=$('roll');
let cellsByStep=[];
function mkCell(i,on,cb){
  const b=document.createElement('button');b.className='cell'+(on?' on':'')+(Math.floor(i/4)%2?' g':'');
  b.setAttribute('aria-pressed',on?'true':'false');
  b.onclick=()=>{const v=cb();b.classList.toggle('on',!!v);b.setAttribute('aria-pressed',v?'true':'false');
    return v};
  cellsByStep[i].push(b);return b;
}
function addGap(wrap,i){if(i%4===3&&i<N-1){const s=document.createElement('span');s.className='sep';wrap.appendChild(s)}}

// Dibuja de nuevo rack y piano roll segun el valor actual de N
function build(){
  rack.innerHTML='';rollEl.innerHTML='';
  cellsByStep=Array.from({length:N},()=>[]);
  drums.forEach(d=>{
    const r=document.createElement('div');r.className='row';
    const lab=document.createElement('div');lab.className='lab';
    lab.innerHTML=`<i class="led" id="led-${d.id}"></i><span>${d.name}</span>`;
    const m=document.createElement('button');m.className='mute'+(d.mute?' m':'');m.textContent='M';m.title='Silenciar';
    m.onclick=()=>{d.mute=!d.mute;m.classList.toggle('m',d.mute)};
    const vol=document.createElement('input');vol.type='range';vol.min=0;vol.max=100;vol.value=d.vol*100;vol.style.width='60px';
    vol.setAttribute('aria-label','Volumen '+d.name);vol.oninput=()=>d.vol=vol.value/100;
    lab.append(m,vol);r.appendChild(lab);
    const st=document.createElement('div');st.className='steps';
    for(let i=0;i<N;i++){st.appendChild(mkCell(i,d.steps[i],()=>(d.steps[i]=d.steps[i]?0:1)));addGap(st,i)}
    r.appendChild(st);rack.appendChild(r);
  });
  for(let row=0;row<ROWS;row++){
    const semi=12-row,nm=names[semi%12]+(semi===12?'5':'4');
    const blk=names[semi%12].includes('#');
    const r=document.createElement('div');r.className='row'+(blk?' blk':'');
    const k=document.createElement('div');k.className='key'+(blk?' b':'');k.textContent=nm;r.appendChild(k);
    const st=document.createElement('div');st.className='steps';
    for(let i=0;i<N;i++){
      const c=mkCell(i,roll[row][i],()=>(roll[row][i]=roll[row][i]?0:1));
      const toggle=c.onclick;
      c.onclick=()=>{if(toggle()){initAudio();synth(semi,ac.currentTime,.25)}};
      st.appendChild(c);addGap(st,i);
    }
    r.appendChild(st);rollEl.appendChild(r);
  }
}

// Cambia la cantidad de pasos conservando lo que ya habias escrito
function setSteps(n){
  N=n;
  const fit=a=>{a.length=N;for(let i=0;i<N;i++)a[i]=a[i]||0;return a};
  drums.forEach(d=>fit(d.steps));
  roll.forEach(fit);
  if(step>=N)step=0;
  queue=[];lastStep=-1;
  build();
}

// ---------- Secuenciador ----------

function stepDur(){return 60/$('bpm').value/4}
function schedule(){
  while(nextT<ac.currentTime+.12){
    const sw=($('swing').value/100)*stepDur()*.5;
    const t=nextT+(step%2?sw:0);
    drums.forEach(d=>{if(d.steps[step]&&!d.mute)voices[d.id](t,d.vol)});
    for(let r=0;r<ROWS;r++)if(roll[r][step])synth(12-r,t,stepDur());
    queue.push({step,t});
    nextT+=stepDur();step=(step+1)%N;
  }
}
function draw(){
  if(!playing)return;
  while(queue.length&&queue[0].t<=ac.currentTime){
    const q=queue.shift();
    if(lastStep>=0)cellsByStep[lastStep].forEach(c=>c.classList.remove('play'));
    if(!cellsByStep[q.step])continue;
    cellsByStep[q.step].forEach(c=>c.classList.add('play'));
    drums.forEach(d=>{const l=$('led-'+d.id);l.classList.toggle('on',!!d.steps[q.step]&&!d.mute)});
    lastStep=q.step;
  }
  requestAnimationFrame(draw);
}
function start(){initAudio();ac.resume();playing=true;step=0;lastStep=-1;queue=[];nextT=ac.currentTime+.05;
  timer=setInterval(schedule,25);draw();$('play').textContent='■ Detener';$('play').classList.add('on')}
function stop(){playing=false;clearInterval(timer);
  document.querySelectorAll('.play').forEach(c=>c.classList.remove('play'));
  document.querySelectorAll('.led').forEach(l=>l.classList.remove('on'));
  $('play').textContent='▶ Reproducir';$('play').classList.remove('on')}
$('play').onclick=()=>playing?stop():start();
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();$('play').click()}});
build();
$('steps').onchange=()=>setSteps(+$('steps').value);
$('master').oninput=()=>{if(master)master.gain.value=$('master').value/100};
$('bpm').onchange=()=>{const v=Math.min(200,Math.max(60,+$('bpm').value||120));$('bpm').value=v};
$('clear').onclick=()=>{
  drums.forEach(d=>d.steps.fill(0));roll.forEach(r=>r.fill(0));
  document.querySelectorAll('.cell.on').forEach(c=>{c.classList.remove('on');c.setAttribute('aria-pressed','false')});
};
