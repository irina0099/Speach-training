import test from 'node:test';
import assert from 'node:assert/strict';
import {wordCount,clock,escapeHTML,parseBackup,validEndpoint} from '../docs/js/core.js';
const row={id:'test-1',type:'one',topic:'Отдых',source:'',text:'Я объясняю одну мысль.',date:'2026-09-30T00:00:00Z',duration:58,analysis:null,recorded:true};
test('counts Russian words and handles empty text',()=>{assert.equal(wordCount('Что-то новое, 2 раза.'),4);assert.equal(wordCount(''),0);assert.equal(clock(65),'01:05');});
test('escapes transcript markup before rendering',()=>{assert.equal(escapeHTML('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');});
test('backup import whitelists record fields, drops audio and token',()=>{const rows=parseBackup(JSON.stringify({app:'rech',version:1,sessions:[{...row,audio:'secret',token:'secret'}]}));assert.equal(rows[0].audio,undefined);assert.equal(rows[0].token,undefined);assert.equal(rows[0].status,'draft');});
test('invalid import rejected before merge',()=>{for(const sessions of [[{...row,duration:9999}],[{...row,analysis:{bad:true}}],[row,row],[{...row,id:'<script>'}],[{...row,text:'a'.repeat(12001)}]])assert.throws(()=>parseBackup(JSON.stringify({app:'rech',version:1,sessions})));});
test('connection accepts secure origin only, with local development exception',()=>{assert.ok(validEndpoint('https://api.example'));assert.ok(validEndpoint('http://localhost:8787'));for(const value of ['http://api.example','javascript:alert(1)','https://user:password@api.example','https://api.example?token=secret','https://api.example/path'])assert.equal(validEndpoint(value),false);});
