const NAME='rech-local-v1'; let dbPromise;
function db() {return dbPromise ||= new Promise((resolve,reject)=>{
  const req=indexedDB.open(NAME,1);
  req.onupgradeneeded=()=>req.result.createObjectStore('sessions',{keyPath:'id'});
  req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result);};
  req.onerror=()=>reject(new Error('Хранилище недоступно. Открой приложение вне приватного режима.'));
});}
async function transaction(mode,fn){const d=await db();return new Promise((resolve,reject)=>{
  const t=d.transaction('sessions',mode); let value;const s=t.objectStore('sessions');
  try {fn(s,v=>value=v);}catch(e){t.abort();reject(e);return;}
  t.oncomplete=()=>resolve(value);t.onerror=()=>reject(new Error('Не удалось сохранить изменения. Проверь свободное место на iPhone.'));t.onabort=()=>reject(new Error('Изменения не сохранены.'));
});}
export const allSessions=()=>transaction('readonly',(s,done)=>{const r=s.getAll();r.onsuccess=()=>done(r.result.sort((a,b)=>b.date.localeCompare(a.date)));});
export const putSession=row=>transaction('readwrite',s=>s.put(row));
export const deleteSessions=ids=>transaction('readwrite',s=>ids.forEach(id=>s.delete(id)));
export const restoreSessions=rows=>transaction('readwrite',s=>rows.forEach(r=>s.put(r)));
export const clearSessions=()=>transaction('readwrite',s=>s.clear());
export async function mergeSessions(rows){return transaction('readwrite',(s,done)=>{let count=0;for(const row of rows){const r=s.get(row.id);r.onsuccess=()=>{if(!r.result){s.add(row);count++;}done(count);};}if(!rows.length)done(0);});}
export function readSettings(){try {return {...{url:'',token:'',consent:false},...JSON.parse(localStorage.getItem('rech-settings')||'{}')};}catch{return {url:'',token:'',consent:false};}}
export function saveSettings(settings){localStorage.setItem('rech-settings',JSON.stringify(settings));}
