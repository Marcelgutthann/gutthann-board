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
