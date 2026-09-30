export class Recorder {
  constructor({onTick,onState,onStop,onError}) {Object.assign(this,{onTick,onState,onStop,onError});this.parts=[];this.elapsed=0;this.finished=false;}
  async start(){
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('Запись недоступна. Открой HTTPS-сайт в Safari или вставь готовый текст.');
    this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
    if(this.disposed){this.release();return;}
    try{
      const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
      this.rec=new MediaRecorder(this.stream,mime?{mimeType:mime}:undefined);
      this.rec.ondataavailable=e=>{if(e.data.size)this.parts.push(e.data);};
      this.rec.onerror=()=>{this.dispose();this.onError(new Error('Запись прервалась. Попробуй еще раз.'));};
      this.rec.onstop=()=>{if(this.disposed)return;this.finished=true;const blob=new Blob(this.parts,{type:this.rec.mimeType||'audio/mp4'});this.parts=[];this.release();this.onStop(blob,Math.min(300,this.elapsed/1000));};
      this.rec.start(1000);this.since=performance.now();this.onState('recording');
      this.interval=setInterval(()=>{const t=this.seconds();this.onTick(t);if(t>=300)this.stop();},150);
      try {const lock=await navigator.wakeLock?.request('screen');if(this.disposed||this.finished)await lock?.release();else this.lock=lock;} catch{}
    }catch(e){this.release();throw e;}
  }
  seconds(){return (this.elapsed+(this.rec?.state==='recording'?performance.now()-this.since:0))/1000;}
  pause(){if(this.rec?.state!=='recording')return;this.elapsed+=performance.now()-this.since;this.rec.pause();this.onState('paused');}
  resume(){if(this.rec?.state!=='paused')return;this.since=performance.now();this.rec.resume();this.onState('recording');}
  stop(){if(!this.rec||this.rec.state==='inactive')return;if(this.rec.state==='recording')this.elapsed+=performance.now()-this.since;this.rec.stop();clearInterval(this.interval);this.onState('stopping');}
  release(){clearInterval(this.interval);this.stream?.getTracks().forEach(t=>t.stop());this.lock?.release().catch(()=>{});this.lock=null;}
  dispose(){this.disposed=true;if(this.rec?.state&&this.rec.state!=='inactive')this.rec.stop();this.parts=[];this.release();}
}
