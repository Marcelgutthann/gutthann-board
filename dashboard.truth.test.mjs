import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./dashboard.js',import.meta.url),'utf8');
function isolate(from,to,args=[]){
  const start=source.indexOf(from),end=source.indexOf(to,start);
  assert.ok(start>=0&&end>start,`missing ${from}`);
  return new Function(...args,source.slice(start,end)+`\nreturn ${from.startsWith('const normLph')?'phasenlage':'kostenAusWahrheit'};`);
}

test('parallel phases do not imply earlier phases completed',()=>{
  const phasenlage=isolate('const normLph=','function phaseEvidence')();
  assert.deepEqual(phasenlage({lph:4,lph_phasen:{aktiv:[5,3,4,4]}}).aktiv,[3,4,5]);
  assert.deepEqual(phasenlage({lph:4,lph_phasen:{aktiv:[4]}}).aktiv,[4]);
});

test('cost truth clears legacy budget, even if RPC fails',()=>{
  const kostenAusWahrheit=isolate('function kostenAusWahrheit','function renderKostenPruefen',['fmtD','STUFE_TXT','STUFE_LPH'])(x=>x,{},{});
  const proj={dashboard:{kosten:{summe_brutto:8800000,budget:9000000}},kennzahlen:{kosten:{budget:{wert:9000000}}}};
  kostenAusWahrheit(proj,null);
  assert.equal(proj.dashboard.kosten.summe_brutto,null);
  assert.equal(proj.dashboard.kosten.budget,null);
  assert.equal(proj.kennzahlen.kosten.budget.wert,null);
});

test('confirmed cost stays a cost stage, not a budget',()=>{
  const kostenAusWahrheit=isolate('function kostenAusWahrheit','function renderKostenPruefen',['fmtD','STUFE_TXT','STUFE_LPH'])(x=>x,{Kostenberechnung:'Kostenberechnung'},{Kostenberechnung:3});
  const proj={dashboard:{},kennzahlen:{kosten:{}}};
  kostenAusWahrheit(proj,{aktuell:{betrag_brutto:8800000,stufe:'Kostenberechnung',stichtag:'2026-10-01',datei:'quelle.pdf'},verlauf:[],zu_pruefen:[]});
  assert.equal(proj.dashboard.kosten.stufe,'Kostenberechnung');
  assert.equal(proj.dashboard.kosten.budget,null);
  assert.equal(proj.kennzahlen.kosten.gesamt_brutto.wert,8800000);
});

test('no misleading dashboard budget comparison remains',()=>{
  assert.doesNotMatch(source,/vs\. Budget|Budgetabweichung|Kosten aktuell/);
  assert.match(source,/Klick ändert nur die Ansicht/);
});

test('identical cost candidates are grouped and cannot be blindly approved',()=>{
  const start=source.indexOf('function renderKostenPruefen'),end=source.indexOf("document.addEventListener('click',async function(e){",start);
  const render=new Function('esc','fmtD','STUFE_TXT',source.slice(start,end)+'\nreturn renderKostenPruefen;')(
    x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;'),x=>x,{Kostenberechnung:'Kostenberechnung'});
  const c={stufe:'Kostenberechnung',stichtag:'2025-10-20',betrag_brutto:16111638.45,datei:'251020_Kostenberechnung Maxhütte.pdf',kg_umfang:'200-700',beleg_stelle:'Originaltext'};
  const html=render({zu_pruefen:[{...c,id:'a'},{...c,id:'b'},{...c,id:'c'}]});
  assert.match(html,/3 gleiche Funde/);
  assert.match(html,/Bestätigung gesperrt/);
  assert.doesNotMatch(html,/data-kk=/);
  assert.equal((html.match(/<summary>/g)||[]).length,1);
});

test('a single cost candidate requires visible evidence review',()=>{
  const start=source.indexOf('function renderKostenPruefen'),end=source.indexOf("document.addEventListener('click',async function(e){",start);
  const render=new Function('esc','fmtD','STUFE_TXT',source.slice(start,end)+'\nreturn renderKostenPruefen;')(String,x=>x,{});
  const html=render({zu_pruefen:[{id:'single',stufe:'Kostenberechnung',stichtag:'2025-10-20',betrag_brutto:42,datei:'x.pdf',beleg_stelle:'Belegtext'}]});
  assert.match(html,/Belegtext/);
  assert.match(html,/data-cost-reviewed="single"/);
  assert.match(html,/data-kk="single"/);
});
