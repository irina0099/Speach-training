import {validEndpoint} from './core.js';
export async function requestAPI(settings,path,{body,signal}={}) {
  if(!validEndpoint(settings.url)) throw new Error('Открой настройки и укажи HTTPS-адрес подключения.');
  if(!settings.token || settings.token.startsWith('sk-')) throw new Error('Нужен личный код доступа из настройки сервера. Ключ OpenAI сюда не вводится.');
  if(!settings.consent)throw new Error('Разреши обработку речи ИИ в настройках.');
  const headers={Authorization:`Bearer ${settings.token}`};
  const isForm=typeof FormData!=='undefined' && body instanceof FormData;
  if(body&&!isForm)headers['Content-Type']='application/json';
  let res;
  try {res=await fetch(settings.url.replace(/\/$/,'')+path,{method:body?'POST':'GET',headers,body:body?(isForm?body:JSON.stringify(body)):undefined,signal,cache:'no-store',credentials:'omit',redirect:'error'});}catch(e){if(e.name==='AbortError'||signal?.aborted)throw new Error('Ожидание отменено. Текст остается на экране.');throw new Error('Не удалось подключиться. Проверь интернет и адрес в настройках.');}
  let data;try{data=await res.json();}catch{throw new Error('Сервер вернул неожиданный ответ. Проверь адрес подключения.');}
  if(!res.ok)throw new Error(data.error||'Не удалось обработать запрос. Попробуй позже.');
  return data;
}
