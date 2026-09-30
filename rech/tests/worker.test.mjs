import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../worker/index.js';

const origin='https://irina.github.io',token='a'.repeat(48);
const env={ALLOWED_ORIGIN:origin,ACCESS_TOKEN:token,OPENAI_API_KEY:'test-server-only',RATE_LIMITER:{limit:async()=>({success:true})}};
const feedback={headline:'Основная мысль понятна',strengths:['Есть пример.'],improvements:[{quote:'несуществующая цитата',advice:'Добавь итог.'}],rewrite:'Отдых помогает восстановиться.',focus:'Заверши коротким выводом.',structure:[{label:'Тезис',status:'present',comment:'Есть в начале.'}]};
const input={type:'one',topic:'Зачем отдыхать?',source:'',text:'Отдых помогает восстановиться. Например, после прогулки мне легче сосредоточиться.'};
function req(path,body,headers={}){return new Request('https://worker.example'+path,{method:body?'POST':'GET',headers:{Origin:origin,Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});}
const never=()=>{throw new Error('Upstream must not be called');};
test('rejects untrusted origin before calling upstream',async()=>{const r=await createHandler(never)(req('/analyze',input,{Origin:'https://evil.test'}),env);assert.equal(r.status,403);assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);});
test('requires bearer authentication even from permitted site',async()=>{const r=await createHandler(never)(req('/analyze',input,{Authorization:'Bearer wrong'}),env);assert.equal(r.status,401);});
test('fails closed when limiter is missing',async()=>{const r=await createHandler(never)(req('/health'),{...env,RATE_LIMITER:null});assert.equal(r.status,503);});
test('allows preflight only for permitted origin',async()=>{const r=await createHandler(never)(new Request('https://worker.example/analyze',{method:'OPTIONS',headers:{Origin:origin}}),env);assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);});
test('health verifies server setup without a paid upstream call',async()=>{const r=await createHandler(never)(req('/health'),env);assert.equal(r.status,200);assert.equal((await r.json()).ok,true);});
test('rate limit blocks paid requests',async()=>{const r=await createHandler(never)(req('/analyze',input),{...env,RATE_LIMITER:{limit:async()=>({success:false})}});assert.equal(r.status,429);});
test('rejects excessive text and unknown exercise',async()=>{for(const body of [{...input,text:'a'.repeat(12001)},{...input,type:'evil'},null]){const r=await createHandler(never)(req('/analyze',body||{bad:true}),env);assert.equal(r.status,400);}});
test('bounds body even without Content-Length',async()=>{const r=await createHandler(never)(req('/analyze',{...input,text:'a'.repeat(110000)}),env);assert.equal(r.status,413);});
test('uses server model, structured output and store:false; removes invented quotes',async()=>{
  let calls=0;const handler=createHandler(async(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer test-server-only');const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.model,'gpt-4o-mini');assert.equal(body.text.format.strict,true);assert.equal(body.input[0].role,'system');assert.equal(JSON.parse(body.input[1].content).answer,input.text);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(feedback)}]}]});});
  const r=await handler(req('/analyze',{...input,model:'expensive-model',store:true}),env);assert.equal(r.status,200);const data=await r.json();assert.equal(data.analysis.improvements[0].quote,'');assert.equal(calls,1);assert.equal(r.headers.get('Cache-Control'),'no-store');
});
test('surfaces refusal and incomplete response as errors without fabricating feedback',async()=>{for(const [data,status] of [[{output:[{content:[{type:'refusal',refusal:'no'}]}]},422],[{status:'incomplete',output:[]},502],[{output:[]},502]]){const r=await createHandler(async()=>Response.json(data))(req('/analyze',input),env);assert.equal(r.status,status);}});
test('hides upstream error bodies and secrets',async()=>{const r=await createHandler(async()=>new Response('secret private transcript',{status:500}))(req('/analyze',input),env);assert.equal(r.status,502);assert.doesNotMatch(await r.text(),/secret|private/);});
test('forwards supported iPhone audio with generated filename and configured model',async()=>{
  const form=new FormData();form.append('file',new Blob(['audio-bytes'],{type:'audio/mp4'}),'personal-title.mp4');
  const request=new Request('https://worker.example/transcribe',{method:'POST',headers:{Origin:origin,Authorization:`Bearer ${token}`},body:form});
  const response=await createHandler(async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/audio/transcriptions');assert.equal(options.body.get('file').name,'answer.m4a');assert.equal(options.body.get('model'),'gpt-4o-mini-transcribe');assert.equal(options.body.get('language'),'ru');assert.equal(options.body.get('response_format'),'json');return Response.json({text:input.text});})(request,env);
  assert.equal(response.status,200);assert.equal((await response.json()).text,input.text);
});
test('rejects non-audio upload',async()=>{const form=new FormData();form.append('file',new Blob(['<html>'],{type:'text/html'}),'answer.html');const r=await createHandler(never)(new Request('https://worker.example/transcribe',{method:'POST',headers:{Origin:origin,Authorization:`Bearer ${token}`},body:form}),env);assert.equal(r.status,415);});
test('rejects empty transcription',async()=>{const form=new FormData();form.append('file',new Blob(['audio'],{type:'audio/webm'}),'answer.webm');const r=await createHandler(async()=>Response.json({text:''}))(new Request('https://worker.example/transcribe',{method:'POST',headers:{Origin:origin,Authorization:`Bearer ${token}`},body:form}),env);assert.equal(r.status,422);});
