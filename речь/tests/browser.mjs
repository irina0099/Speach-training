// Run with a local server on :8080. API calls are mocked; no secrets or billing.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const server=process.env.AUTO_SERVER?spawn(process.execPath,['scripts/serve.mjs'],{stdio:['ignore','pipe','inherit']}):null;
if(server){process.on('exit',()=>server.kill());await once(server.stdout,'data');}
const require=createRequire(import.meta.url);
const pw=process.env.PLAYWRIGHT_MODULE?require(process.env.PLAYWRIGHT_MODULE):process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright'):require('playwright');
const {chromium,webkit}=pw;
const token='x'.repeat(64),origin='https://rech-api.example.workers.dev';
const answer='Иногда отдых кажется чем-то, что нужно заслужить. Например, сложно остановиться, пока не закончены все дела. Можно заранее выбрать время для паузы.';
const review={headline:'У ответа есть понятная основа',strengths:['Ты назвала основную мысль и привела пример.'],improvements:[{quote:'Можно заранее выбрать время для паузы.',advice:'Свяжи вывод с первой мыслью.'}],rewrite:'Отдых бывает трудно разрешить себе, когда кажется, что его нужно заслужить. Например, сложно остановиться, пока не закончены дела. Заранее выбранное время для паузы может помочь.',focus:'В следующем ответе свяжи вывод с тезисом.',structure:[{label:'Тезис',status:'present',comment:'Есть в начале.'},{label:'Вывод',status:'unclear',comment:'Можно связать с тезисом.'}]};
await mkdir('test-results',{recursive:true});
for(const name of (process.env.BROWSERS||'chromium,webkit').split(',')){
  const browser=await ({chromium,webkit}[name]).launch({headless:true,...(name==='chromium'?{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'],...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})}:{})});
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,acceptDownloads:true});
    if(name==='chromium')await ctx.grantPermissions(['microphone'],{origin:'http://localhost:8080'});
    let analysisCalls=0,failNext=false,transcribeCalls=0;
    await ctx.route(origin+'/**',async route=>{
      const req=route.request();if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'http://localhost:8080','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type'}});return;}
      assert.equal(req.headers().authorization,'Bearer '+token);
      const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'http://localhost:8080'};
      if(req.url().endsWith('/health'))return route.fulfill({headers,body:JSON.stringify({ok:true})});
      if(req.url().endsWith('/transcribe')){transcribeCalls++;assert.ok(req.postDataBuffer().length>20);return route.fulfill({headers,body:JSON.stringify({text:answer})});}
      analysisCalls++;assert.ok(req.postDataJSON().text.length>15);
      if(failNext){failNext=false;return route.fulfill({status:502,headers,body:JSON.stringify({error:'Тестовая ошибка сервиса'})});}
      return route.fulfill({headers,body:JSON.stringify({analysis:review})});
    });
    const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://localhost:8080'+(process.env.PREVIEW_BASE||'')+'/');await page.getByRole('heading',{name:'Практика',exact:true}).waitFor();
    assert.equal(await page.locator('.exercise-card').count(),6);
    await page.screenshot({path:`test-results/${name}-home.png`,fullPage:true,animations:'disabled'});
    await page.getByRole('button',{name:'Настройки',exact:true}).click();
    await page.locator('#api-url').fill(origin);await page.locator('#api-token').fill(token);await page.locator('#api-consent').check();await page.getByRole('button',{name:'Сохранить подключение',exact:true}).click();
    await page.getByRole('button',{name:'Проверить подключение',exact:true}).click();await page.getByRole('button',{name:'Проверить подключение',exact:true}).waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.querySelector('[data-action="check-connection"]').disabled);
    await page.getByRole('button',{name:'Назад',exact:true}).click();await page.getByRole('button',{name:'Начать тренировку',exact:true}).click();
    await page.screenshot({path:`test-results/${name}-practice.png`,fullPage:true,animations:'disabled'});
    await page.getByRole('button',{name:'Вставить готовый текст',exact:true}).click();await page.locator('#modal-input').fill(answer);await page.locator('#modal-yes').click();await page.locator('#transcript').waitFor();
    failNext=true;await page.getByRole('button',{name:'Получить разбор',exact:true}).click();await page.getByRole('alert').filter({hasText:'Тестовая ошибка'}).waitFor();assert.equal(await page.locator('#transcript').inputValue(),answer);
    await page.getByRole('button',{name:'Получить разбор',exact:true}).click();await page.getByRole('heading',{name:review.headline,exact:true}).waitFor();
    await page.screenshot({path:`test-results/${name}-result.png`,fullPage:true,animations:'disabled'});
    await page.getByRole('button',{name:'Открыть историю',exact:true}).click();assert.equal(await page.locator('.history-row').count(),1);
    await page.reload();await page.getByRole('button',{name:'История',exact:true}).click();assert.equal(await page.locator('.history-row').count(),1);
    await page.getByRole('button',{name:'Удалить тренировку',exact:true}).click();await page.locator('#modal-yes').click();await page.getByRole('heading',{name:'Здесь появится твоя практика'}).waitFor();
    await page.locator('#toast [data-action="undo"]').click();await page.locator('.history-row').waitFor();
    await page.getByRole('button',{name:'Выбрать',exact:true}).click();await page.locator('.history-check').check();await page.getByRole('button',{name:'Удалить выбранные (1)',exact:true}).click();await page.locator('#modal-yes').click();await page.getByRole('heading',{name:'Здесь появится твоя практика'}).waitFor();await page.locator('#toast [data-action="undo"]').click();await page.locator('.history-row').waitFor();
    await page.getByRole('button',{name:'Настройки',exact:true}).click();
    await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true});});
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Сохранить резервную копию',exact:true}).click();const download=await downloadPromise;const backup=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(backup.sessions.length,1);assert.ok(!JSON.stringify(backup).includes(token));assert.ok(!('audio' in backup.sessions[0]));
    await page.getByRole('button',{name:'Очистить всю историю',exact:true}).click();await page.locator('#modal-yes').click();
    const chooserPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Восстановить из файла',exact:true}).click();const chooser=await chooserPromise;await chooser.setFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.locator('#modal-yes').click();await page.getByText('Добавлено тренировок: 1.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Назад',exact:true}).click();await page.getByRole('button',{name:'История',exact:true}).click();assert.equal(await page.locator('.history-row').count(),1);
    await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();
    await ctx.setOffline(true);await page.reload();await page.getByRole('heading',{name:'Практика',exact:true}).waitFor();await page.getByRole('button',{name:'История',exact:true}).click();assert.equal(await page.locator('.history-row').count(),1);await ctx.setOffline(false);
    if(name==='chromium'){
      await page.getByRole('button',{name:'Практика',exact:true}).click();await page.getByRole('button',{name:'Начать тренировку',exact:true}).click();await page.getByRole('button',{name:'Начать запись',exact:true}).click();await page.getByRole('button',{name:'Пауза',exact:true}).waitFor();await page.waitForTimeout(1200);await page.getByRole('button',{name:'Пауза',exact:true}).click();await page.getByRole('button',{name:'Продолжить запись',exact:true}).click();await page.waitForTimeout(1100);await page.getByRole('button',{name:'Завершить',exact:true}).click();await page.getByRole('heading',{name:'Запись готова'}).waitFor();await page.getByRole('button',{name:'Расшифровать ответ',exact:true}).click();await page.locator('#transcript').waitFor();assert.equal(transcribeCalls,1);assert.equal(await page.locator('audio').count(),0);await page.getByRole('button',{name:'Получить разбор',exact:true}).click();await page.getByRole('heading',{name:review.headline,exact:true}).waitFor();
    }
    assert.ok(analysisCalls>=2);assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    console.log(name+': PASS — exercises, settings, error/retry, local persistence, delete/undo, bulk delete, backup export/import, offline'+(name==='chromium'?', microphone pause/resume/transcription':''));
    await ctx.close();
  }finally{await browser.close();}
}
server?.kill();
