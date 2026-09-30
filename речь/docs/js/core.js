export const MAX_TEXT=12000;
export function escapeHTML(value='') { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function wordCount(text='') { return (text.match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu)||[]).length; }
export function clock(seconds=0) { const t=Math.max(0,Math.floor(seconds)); return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`; }
export function validEndpoint(value) { try { const u=new URL(value); if(u.username||u.password||u.search||u.hash) return false; return (u.protocol==='https:' || (u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname))) && u.pathname==='/'; } catch {return false;} }
function str(v,max) {return typeof v==='string' && v.length<=max;}
export function validAnalysis(a) {
  return a && str(a.headline,300) && Array.isArray(a.strengths) && a.strengths.length<=2 && a.strengths.every(x=>str(x,1500)) &&
    Array.isArray(a.improvements) && a.improvements.length<=2 && a.improvements.every(x=>x&&str(x.quote,1500)&&str(x.advice,2000)) &&
    str(a.rewrite,6000) && str(a.focus,2000) && Array.isArray(a.structure) && a.structure.length<=6 &&
    a.structure.every(x=>x&&str(x.label,100)&&['present','unclear','missing'].includes(x.status)&&str(x.comment,1500));
}
export function normalizeSession(r) {
  if(!r || !str(r.id,80) || !/^[\w-]+$/.test(r.id) || !['one','retell','free','short','lesson','story'].includes(r.type) ||
    !str(r.topic,500)||!str(r.source,6000)||!str(r.text,MAX_TEXT)||!r.text.trim()||!Number.isFinite(Date.parse(r.date))||
    !Number.isFinite(r.duration)||r.duration<0||r.duration>301||!(r.analysis===null||validAnalysis(r.analysis))) throw new Error('В файле есть неподдерживаемая запись. Импорт отменен.');
  return {id:r.id,type:r.type,topic:r.topic,source:r.source,text:r.text,date:new Date(r.date).toISOString(),
    duration:r.duration,recorded:r.recorded===true,analysis:r.analysis,status:r.analysis?'done':'draft',
    parentId:typeof r.parentId==='string'&&/^[\w-]{1,80}$/.test(r.parentId)?r.parentId:null};
}
export function parseBackup(text) {
  let d; try {d=JSON.parse(text);}catch {throw new Error('Не удалось прочитать файл JSON.');}
  if(d?.app!=='rech'||d.version!==1||!Array.isArray(d.sessions)||d.sessions.length>1000) throw new Error('Нужна резервная копия приложения «Речь» (до 1000 тренировок).');
  const rows=d.sessions.map(normalizeSession); if(new Set(rows.map(r=>r.id)).size!==rows.length)throw new Error('В файле повторяются идентификаторы записей.');
  return rows;
}
