import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const sb=createClient('https://lzrfyxejlejxfpvqpket.supabase.co','sb_publishable_adwNO1cSP6M2OmOV-8t_1g_lmGuj40V');
const el=id=>document.getElementById(id),esc=s=>(s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const short=n=>(n||'').replace(/^\d+\s*-\s*/,'').replace(/^\d+\s+/,''),slug=s=>(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-'),today=()=>new Date().toISOString().slice(0,10),prioN=p=>({P1:1,P2:2,P3:3}[p]||3);
// Status-Codes bleiben in Daten/Vergleichen ASCII (z.B. 'ueberfaellig'); fuer die Anzeige in echtes Deutsch uebersetzen:
const stL=s=>({ueberfaellig:'überfällig',vollstaendig:'vollständig',geprueft:'geprüft',geklaert:'geklärt',laeuft:'läuft'}[s])||s||'';
const fmtD=d=>d?new Date(d).toLocaleDateString('de-DE'):'—';
const LPH=['Grundlagen','Vorentwurf','Entwurf','Genehmigung','Ausführung','Vergabe-Vorb.','Vergabe','Objekt-ÜW','Gewährl.'];
// Phasen-Titel fuer das LPH-Katalog-Fenster (deckungsgleich mit LPH_KATALOG_DEF im Runner)
const LPH_KAT_TITEL={1:'Grundlagenermittlung',2:'Vorplanung',3:'Entwurfsplanung',4:'Genehmigungsplanung',5:'Ausführungsplanung',6:'Vorbereitung der Vergabe',7:'Mitwirkung bei der Vergabe',8:'Objektüberwachung',9:'Objektbetreuung'};
// ── Glossar & Erklärbarkeit: ein Außenstehender muss erklären können, was abgeht ──
const GLOSS={
 'LPH':'Leistungsphase nach HOAI (1–9) — Stufe der Planung bzw. Ausführung. „Aktive Phase" = woran gerade gearbeitet wird.',
 'KG':'Kostengruppe nach DIN 276 — z. B. KG 300 Bauwerk-Baukonstruktion, KG 400 Technische Anlagen.',
 'DIN 276':'Norm zur Gliederung der Baukosten in Kostengruppen (KG 100–700).',
 'Zwangspunkt':'Unverrückbarer Termin oder Abhängigkeit, der den Ablauf zwingt (z. B. Frist Bauamt, Liefertermin). Davon wird rückwärts terminiert.',
 'Puffer':'Zeitreserve in Wochen, bis dieser Zwangspunkt kritisch wird. 0–2 Wochen = eng (rot).',
 'Rückwärtsterminierung':'Vom Fixtermin aus rückwärts gerechnet, wann spätestens begonnen werden muss.',
 'Phasen-Reife':'Wie weit die Grundleistungen der aktiven LPH abgeschlossen sind (0–100 %).',
 'Nachhaken':'Offener Vorgang, auf dessen Antwort/Erledigung gewartet wird — wird überfällig, wenn die Frist verstreicht.',
 'Schnittstelle':'Übergabepunkt zwischen Beteiligten (z. B. Architekt → Statiker). „Stillstand" = wie lange dort nichts passiert ist.',
 'P1':'Priorität 1 — kritisch, sofort handeln.',
 'P2':'Priorität 2 — wichtig, zeitnah.',
 'P3':'Priorität 3 — normal, planbar.'
};
const glAttr=t=>esc(t||'').replace(/"/g,'&quot;');
const gl=(term,def)=>'<span class="gl" data-gl="'+glAttr(def||GLOSS[term]||'')+'">'+esc(term)+'</span>';
function posTip(g,tip){const r=g.getBoundingClientRect();tip.style.left='-999px';tip.style.top='0px';const tw=tip.offsetWidth,th=tip.offsetHeight;let x=r.left+r.width/2-tw/2;x=Math.max(8,Math.min(x,innerWidth-tw-8));let y=r.top-th-9;if(y<8)y=r.bottom+9;tip.style.left=Math.round(x)+'px';tip.style.top=Math.round(y)+'px';}
function initTips(){if(el('gtip'))return;const tip=document.createElement('div');tip.id='gtip';tip.className='gtip';document.body.appendChild(tip);let cur=null;
 document.addEventListener('mouseover',e=>{const g=e.target.closest?e.target.closest('[data-gl]'):null;if(g&&g!==cur){cur=g;tip.textContent=g.getAttribute('data-gl');tip.classList.add('on');posTip(g,tip);}});
 document.addEventListener('mouseout',e=>{const g=e.target.closest?e.target.closest('[data-gl]'):null;if(g&&cur){cur=null;tip.classList.remove('on');}});
 window.addEventListener('scroll',()=>{if(cur){cur=null;tip.classList.remove('on');}},true);}
function openGloss(){let o=el('gmodal');if(o){o.remove();return;}
 const row=(t,d)=>'<div class="gm-row"><div class="gm-t">'+esc(t)+'</div><div class="gm-d">'+esc(d)+'</div></div>';
 const card='<div class="gm-card"><div class="gm-head"><span>Glossar &amp; Legende</span><button class="gm-x" id="gmx">×</button></div>'+
  '<div class="gm-sec-h">Status-Farben</div><div class="gm-legend"><span><i class="gm-dot d"></i>kritisch · überfällig · eng</span><span><i class="gm-dot w"></i>bald · Achtung</span><span><i class="gm-dot o"></i>ok · erledigt</span></div>'+
  '<div class="gm-sec-h">Prioritäten</div>'+row('P1','kritisch, sofort handeln')+row('P2','wichtig, zeitnah')+row('P3','normal, planbar')+
  '<div class="gm-sec-h">Begriffe &amp; Abkürzungen</div>'+['LPH','KG','DIN 276','Zwangspunkt','Puffer','Rückwärtsterminierung','Phasen-Reife','Nachhaken','Schnittstelle'].map(k=>row(k,GLOSS[k])).join('')+
  '<div class="gm-note">Alle analysierten Zahlen beziehen sich auf den <strong>Analyse-Stand</strong> (oben rechts im Projekt-Header). Quelle je Wert steht — wo vorhanden — direkt am Eintrag.</div></div>';
 o=document.createElement('div');o.id='gmodal';o.className='gmodal';o.innerHTML=card;document.body.appendChild(o);
 o.onclick=e=>{if(e.target===o||e.target.id==='gmx')o.remove();};
 document.addEventListener('keydown',function esc2(ev){if(ev.key==='Escape'){const m=el('gmodal');if(m)m.remove();document.removeEventListener('keydown',esc2);}});}
const AGENT_GROUPS=[
  {h:'Doku & Analyse',items:[
    {id:'dashboard-analyse',ic:'◎',doku:true,t:'Doku-Agent · Analyse',s:'Vorausschau, Kosten, Beschlüsse aus der Wissensbasis'},
    {id:'scan',ic:'⟳',t:'Ganzes Projekt scannen',s:'Alle Dokumente voll einlesen (Outlook/Word, unbegrenzt)'},
    {id:'ingest',ic:'↑',t:'Schnell-Sync',s:'DB aus letztem Scan aktualisieren'}]},
  {h:'Verfolgung',items:[
    {id:'nachhaken',ic:'⏰',t:'Nachhaken-Prüfung',s:'Überfällige Vorgänge markieren'}]},
  {h:'LPH-Berichte',items:[
    {id:'lph3',ic:'3',t:'LPH 3 · Entwurf',s:'Entwurfsbericht erzeugen'},
    {id:'lph4',ic:'4',t:'LPH 4 · Genehmigung',s:'Genehmigungsbericht'},
    {id:'lph5',ic:'5',t:'LPH 5 · Ausführung',s:'Ausführungsbericht'}]}];
const AGENT_VIEWS=[
  {id:'aktivitaet',key:'aktivitaet',ico:'mail',kicker:'Agent · E-Mail-Wissensbasis',title:'Aktivität seit letztem Stand',desc:'Neue Mails & Vorgänge seit dem letzten Dashboard-Stand — chronologisch aus der Mail-Wissensbasis.'},
  {id:'fachplaner',key:'fachplaner',ico:'users',kicker:'Agent · Multi-Persona-Analyse',title:'Fachplaner & Schnittstellen',desc:'Alle beteiligten Fachplaner und Büro-Schnittstellen mit aktuellem Status.'},
  {id:'angebote',key:'angebote',ico:'euro',kicker:'Agent · Vergabe & Honorar',title:'Angebote / Nachträge',desc:'Angebotsvergleich je Vergabeeinheit (aus den Mail-Anhängen), fehlende Angebote, Nachträge und Honorar-Vorgänge.'},
  {id:'bericht',key:null,ico:'doc',kicker:'Agent · Berichtswesen',title:'Projektbericht',desc:'Projektakte, Lagebericht (letzte 3 Monate) und Zielpfad — der ehrliche Blick aufs Projekt, nur für intern.'},
  {id:'doku',key:'dokumentationen',ico:'doc',kicker:'Agent · Dokumenten-Volltext',title:'Dokumentationen',desc:'Die wichtigsten Dokumente je Kategorie — plus Volltextsuche über alle Dateien.'},
  {id:'historie',key:'historie',ico:'clock',kicker:'Agent · Wissensbasis chronologisch',title:'Projekt-Historie',desc:'Zeitstrahl der Meilensteine — chronologisch aus Protokollen und Mails.'},
  {id:'termine',key:null,ico:'cal',kicker:'Agent · Zeitpläne & Zwangspunkte',title:'Termine & Fristen',desc:'Soll-Ist-Abgleich der LPH-Zeitpläne gegen Vertrag & tatsächlichen Stand — plus Zwangspunkte und anstehende Fristen.'}];
function icoPath(n){return({grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',users:'<circle cx="9" cy="8" r="3"/><path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M16 6a3 3 0 010 6M20.5 20c0-2-1-3.7-2.8-4.4"/>',euro:'<circle cx="12" cy="12" r="9"/><path d="M15.5 9a4 4 0 100 6M7.5 11h6M7.5 13.5h5"/>',doc:'<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h5"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',cog:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'}[n]||'');}
function navIco(n){return '<svg viewBox="0 0 24 24">'+icoPath(n)+'</svg>';}
function navItem(id,label,ic,badge){return '<button class="sb-nav'+(pview===id?' active':'')+'" data-pview="'+id+'"><span class="ni">'+ic+'</span><span class="nt">'+esc(label)+'</span>'+(badge?'<span class="nb">'+badge+'</span>':'')+'</button>';}
const AL={ingest:'Schnell-Sync',scan:'Voll-Scan','auto-sync':'Auto-Sync',nachhaken:'Nachhaken',ping:'KI-Test','email-draft':'Outlook-Entwurf','dashboard-analyse':'Dashboard-Analyse','lph-katalog':'LPH-Katalog',projektbericht:'Projektbericht','termin-check':'Termin-Abgleich','angebote-check':'Angebots-Check',lph2:'LPH 2',lph3:'LPH 3',lph4:'LPH 4',lph5:'LPH 5',lph6:'LPH 6',lph7:'LPH 7',lph8:'LPH 8'};
let view='cockpit',current=null,currentName='',pview='dashboard',lastD={},lastStand=null,started=false,openRun=null,tab='alle',prioFilters=new Set(),openWin=null;
let selTask=null,taskMap={},peopleMail={},lastChecklist={},openCl=new Set(),lastL1=null;
let fbClosed={},fbUid=0,lastKat=null,lastKatLph=1,lastKz=null,lastKzName='';
// ---- Projektbericht (ersetzt den Nachtrag-Chat; Konzept: PROJEKTBERICHT-KONZEPT.md) ----
let berTyp='lagebericht',berSel=null,berPollTimer=null;
// Beteiligtenliste: betL = flacher Baum aus beteiligte_liste(), betEdit = offenes Formular,
// betRollen = Vorschlagsliste fuers Rollenfeld, betSel = eingeklappte Gruppen.
let betL=[],betEdit=null,betRollen=[],betZu=new Set();
// Ein Projekt kann mehrere Listen haben: betListen = alle, betListe = die offene.
let betListen=[],betListeId=null,betVorlagen=[],betNeueListe=null;
// PDF-Import: betPdfFunde = erkannte Zeilen der hochgeladenen Datei (null = keine Vorschau offen)
let betPdfFunde=null,betPdfName='';
// CRM-Auswahl: Filter, letzte Eingabe, Trefferliste; betCrmFirma/betCrmMit halten
// die geoeffnete Firma samt ihren Ansprechpartnern.
let betCrmFilter=null,betCrmQ='',betCrmTr=[],betCrmOffen=false,betCrmFirma=null,betCrmMit=[];
// Rolle bleibt ueber mehrere Klicks in derselben Firma erhalten
let betMitRolle='';
// id der Zeile, fuer die gerade die Loeschfrage im Arbeitsbereich steht
let betLoeschFrage=null;
// betSel = angeklickte Zeile (Detail rechts), betFilter = Schnellfilter der Liste
let betSel=null,betFilter='';
const BER_TYPEN=[['lagebericht','Lagebericht','letzte 3 Monate'],['projektakte','Projektakte','ganzes Projekt'],['zielpfad','Zielpfad','Ausblick']];
const BER_DIM={kosten:'Kosten',termine:'Termine',planung:'Planung',bauherr:'Bauherr',team:'Team',dokumentation:'Doku/Risiko'};
const berCls=s=>s==='danger'||s==='ueberfaellig'?'d':s==='warn'?'w':'o';
const BER_LBL={offen:'OFFEN',laeuft:'LÄUFT',erledigt:'ERLEDIGT',ueberfaellig:'ÜBERFÄLLIG',problemquelle:'VERZÖGERT',leistungstraeger:'VERLÄSSLICH',neutral:'NEUTRAL'};
const berLbl=s=>BER_LBL[s]||String(s||'').toUpperCase();
const berEur=n=>n!=null?Number(n).toLocaleString('de-DE',{maximumFractionDigits:0})+' €':null;
async function renderBericht(proj){el('crumb').textContent=short(proj.name||currentName)+' · Projektbericht';
  const[{data:list},{data:runs}]=await Promise.all([
    sb.from('berichte').select('id,typ,von,bis,created_at').eq('project_id',current).order('created_at',{ascending:false}).limit(60),
    sb.from('agent_runs').select('id,status,meta').eq('project_id',current).eq('agent','projektbericht').in('status',['queued','running'])]);
  const busy=!!(runs&&runs.length);
  const mine=(list||[]).filter(b=>b.typ===berTyp);
  if(berSel&&!mine.some(b=>b.id===berSel))berSel=null;
  if(!berSel&&mine.length)berSel=mine[0].id;
  let h='<h1 class="page">Projektbericht</h1><div class="page-sub">Der ungeschönte Blick aufs Projekt: Projektakte (ganzes Projekt), Lagebericht (letzte 3 Monate) und Zielpfad (Ausblick). Nur für den internen Gebrauch.</div>';
  h+='<div class="ber-bar"><div class="ber-tabs">'+BER_TYPEN.map(t=>'<button class="ber-tab'+(t[0]===berTyp?' sel':'')+'" data-btyp="'+t[0]+'">'+t[1]+'<span>'+t[2]+'</span></button>').join('')+'</div>';
  h+='<div class="ber-actions">';
  if(mine.length>1)h+='<select id="ber-hist">'+mine.map(b=>'<option value="'+b.id+'"'+(b.id===berSel?' selected':'')+'>Stand '+fmtD(b.created_at)+'</option>').join('')+'</select>';
  h+='<button class="btn-sm" id="ber-neu" '+(busy?'disabled':'')+'>'+(busy?'⏳ Bericht läuft…':'▶ Neu erzeugen')+'</button></div></div>';
  h+='<div id="ber-body"></div>';
  el('main').innerHTML=h;
  el('main').querySelectorAll('button[data-btyp]').forEach(b=>b.onclick=()=>{berTyp=b.dataset.btyp;berSel=null;renderBericht(proj);});
  const hs=el('ber-hist');if(hs)hs.onchange=()=>{berSel=hs.value;renderBericht(proj);};
  el('ber-neu').onclick=async()=>{const{error}=await sb.from('agent_runs').insert({project_id:current,agent:'projektbericht',status:'queued',meta:{typ:berTyp,trigger:'app'}});
    if(error&&error.code!=='23505'){alert('Konnte nicht starten: '+error.message);return;}renderBericht(proj);};
  const body=el('ber-body');
  if(!berSel){body.innerHTML='<div class="empty" style="padding:34px">'+(busy?'Der Bericht wird gerade erstellt — das dauert ein paar Minuten.':'Noch kein '+((BER_TYPEN.find(t=>t[0]===berTyp)||[])[1]||'Bericht')+' vorhanden. Klick „▶ Neu erzeugen".')+'</div>'+berZieleCard(proj);}
  else{const{data:ber}=await sb.from('berichte').select('*').eq('id',berSel).single();body.innerHTML=(ber?berHtml(ber):'<div class="empty">Bericht nicht ladbar.</div>')+berZieleCard(proj);}
  wireZiele(proj);
  clearTimeout(berPollTimer);
  if(busy)berPollTimer=setTimeout(()=>{if(view==='project'&&pview==='bericht')renderBericht(proj);},5000);}
function berCard(title,inner,cls){return inner?'<section class="ber-card'+(cls?' '+cls:'')+'"><div class="ber-h">'+title+'</div>'+inner+'</section>':'';}
const berLis=a=>(a&&a.length)?a.map(x=>'<div class="ber-li">'+x+'</div>').join(''):'';
function berHtml(ber){const j=ber.inhalt||{};let h='';
  const amp=(j.summary&&j.summary.ampeln)||[];
  if(amp.length)h+='<div class="ber-amp">'+amp.map(a=>'<div class="ber-amp-c '+berCls(a.status)+'"><div class="ber-amp-d">'+esc(BER_DIM[a.dimension]||a.dimension||'')+'</div><div class="ber-amp-s">'+esc(a.satz||'')+'</div></div>').join('')+'</div>';
  if(j.summary&&j.summary.top_punkt)h+='<div class="ber-top">⚠ '+esc(j.summary.top_punkt)+'</div>';
  {const all=j.gf_entscheidungsbedarf||[],zu=all.filter(g=>g&&fbClosed[fbKey('bericht-gf',g.punkt)]),off=all.filter(g=>g&&!fbClosed[fbKey('bericht-gf',g.punkt)]);
   h+=berCard('Entscheidungsbedarf',berLis(off.map(g=>{const fb=fbUI('bericht-gf',g.punkt||'');return '<strong>'+esc(g.punkt||'')+'</strong> '+fb.btn+'<div class="ber-sub">'+esc(g.warum_nur_gf||'')+(g.vorschlag?' · Vorschlag: '+esc(g.vorschlag):'')+'</div>'+fb.form;}))+fbDoneSec(zu.map(g=>({title:g.punkt,kommentar:(fbClosed[fbKey('bericht-gf',g.punkt)]||{}).kommentar}))),'gf');}
  const dl=j.delta||{};const dHas=['neu','verschaerft','entschaerft','erledigt'].some(k=>(dl[k]||[]).length);
  if(dHas)h+=berCard('Seit dem letzten Bericht',['neu','verschaerft','entschaerft','erledigt'].map(k=>(dl[k]||[]).map(x=>'<div class="ber-li"><span class="ber-tag '+(k==='verschaerft'?'d':k==='neu'?'w':'o')+'">'+({neu:'NEU',verschaerft:'VERSCHÄRFT',entschaerft:'ENTSCHÄRFT',erledigt:'ERLEDIGT'})[k]+'</span>'+esc(x)+'</div>').join('')).join(''));
  const kh=j.kosten_honorar||{};
  if(kh.lage||kh.kostenstand!=null)h+=berCard('Kosten & Honorar',(kh.lage?'<div class="ber-li">'+esc(kh.lage)+'</div>':'')
    +berLis([kh.kostenstand!=null?'Kostenstand: <strong>'+berEur(kh.kostenstand)+'</strong>'+(kh.budget!=null?' · Budget '+berEur(kh.budget):''):null,
      kh.abweichung_hinweis?esc(kh.abweichung_hinweis):null,kh.nachtraege?'Nachträge: '+esc(kh.nachtraege):null,
      kh.honorar_hinweis?'<strong>Honorar:</strong> '+esc(kh.honorar_hinweis):null].filter(Boolean)));
  const tm=j.termine||{};
  if(tm.lage||(tm.zwangspunkte||[]).length||(tm.verschiebungen||[]).length)h+=berCard('Termine & Zwangspunkte',(tm.lage?'<div class="ber-li">'+esc(tm.lage)+'</div>':'')
    +berLis((tm.zwangspunkte||[]).map(z=>'<span class="ber-tag '+berCls(z.status)+'">'+(z.puffer_wochen!=null?z.puffer_wochen+' Wo.':'—')+'</span><strong>'+esc(z.name||'')+'</strong> · Frist '+esc(z.frist||'—'))
      .concat((tm.verschiebungen||[]).map(v=>'<span class="ber-tag w">VERSCHOBEN</span>'+esc(v.was||'')+' — '+esc(v.von||'?')+' → '+esc(v.auf||'offen')+' ('+esc(v.wer||'?')+')'+(v.beleg?'<div class="ber-sub">Beleg: '+esc(v.beleg)+'</div>':'')))));
  {const all=j.konfliktherde||[],zu=all.filter(k=>k&&fbClosed[fbKey('bericht-konflikt',k.thema)]),off=all.filter(k=>k&&!fbClosed[fbKey('bericht-konflikt',k.thema)]);
   h+=berCard('Konfliktherde & Schwachstellen',berLis(off.map(k=>{const fb=fbUI('bericht-konflikt',k.thema||'');return '<strong>'+esc(k.thema||'')+'</strong>'+(k.seit?' <span class="ber-sub">seit '+esc(k.seit)+'</span>':'')+' '+fb.btn+'<div class="ber-sub">'+esc(k.stand||'')+((k.beteiligte||[]).length?' · Beteiligte: '+esc(k.beteiligte.join(', ')):'')+(k.beleg?' · '+esc(k.beleg):'')+'</div>'+(k.eigenanteil?'<div class="ber-sub"><strong>Unser Anteil:</strong> '+esc(k.eigenanteil)+'</div>':'')+fb.form;}))+fbDoneSec(zu.map(k=>({title:k.thema,kommentar:(fbClosed[fbKey('bericht-konflikt',k.thema)]||{}).kommentar}))));}
  {const all=j.beteiligten_bilanz||[],pk=b=>fbKey('bericht-person',b.name||b.firma),zu=all.filter(b=>b&&fbClosed[pk(b)]),off=all.filter(b=>b&&!fbClosed[pk(b)]);
   h+=berCard('Beteiligten-Bilanz <span class="ber-sub">(belegbasiert · nur intern)</span>',berLis(off.map(b=>{const fb=fbUI('bericht-person',b.name||b.firma||'');return '<span class="ber-tag '+(b.einstufung==='problemquelle'?'d':b.einstufung==='leistungstraeger'?'o':'w')+'">'+esc(berLbl(b.einstufung||'neutral'))+'</span><strong>'+esc(b.name||b.firma||'')+'</strong>'+(b.name&&b.firma?' · '+esc(b.firma):'')+(b.rolle?' <span class="ber-sub">('+esc(b.rolle)+')</span>':'')+' '+fb.btn+'<div class="ber-sub">'+esc(b.befund||'')+(b.beleg?' · '+esc(b.beleg):'')+'</div>'+fb.form;}))+fbDoneSec(zu.map(b=>({title:b.name||b.firma,kommentar:(fbClosed[pk(b)]||{}).kommentar}))));}
  const en=j.entscheidungen||{};
  if((en.getroffen||[]).length||(en.offen||[]).length)h+=berCard('Entscheidungslage',
    berLis((en.offen||[]).map(o=>'<span class="ber-tag w">OFFEN</span><strong>'+esc(o.thema||'')+'</strong> — '+esc(o.wer||'?')+(o.seit?' <span class="ber-sub">seit '+esc(o.seit)+'</span>':'')+(o.blockiert?'<div class="ber-sub">Blockiert: '+esc(o.blockiert)+'</div>':''))
      .concat((en.getroffen||[]).map(g=>'<span class="ber-tag o">BESCHLUSS</span>'+esc(g.datum||'')+' — '+esc(g.text||'')+(g.quelle?'<div class="ber-sub">'+esc(g.quelle)+'</div>':'')))));
  h+=berCard('Was gut läuft',berLis((j.gut_gelaufen||[]).map(esc)));
  h+=berCard('Zielpfad — was laufen muss',(j.zielpfad||[]).map(z=>'<div class="ber-ziel-blk"><div class="ber-li"><strong>'+esc(z.ziel||'')+'</strong>'+(z.termin?' <span class="mono ber-sub">bis '+esc(z.termin)+'</span>':'')+'</div>'
    +berLis((z.voraussetzungen||[]).map(v=>'<span class="ber-tag '+(v.status==='ueberfaellig'?'d':v.status==='erledigt'?'o':'w')+'">'+esc(berLbl(v.status||'offen'))+'</span>'+esc(v.was||'')+' — '+esc(v.wer||'?')+(v.bis?' bis '+esc(v.bis):'')))
    +(z.risiko?'<div class="ber-sub" style="margin-top:4px"><strong>Risiko:</strong> '+esc(z.risiko)+'</div>':'')
    +(z.plan_b?'<div class="ber-sub"><strong>Plan B:</strong> '+esc(z.plan_b)+'</div>':'')+'</div>').join(''));
  h+=berCard('Chronologie',berLis((j.chronologie||[]).map(c=>'<span class="mono ber-sub">'+esc(c.datum||'')+'</span> '+(c.wendepunkt?'<span class="ber-tag d">WENDEPUNKT</span>':'')+esc(c.ereignis||''))));
  h+=berCard('Belege — „wir haben es schriftlich"',berLis((j.belege||[]).map(b=>esc(b.aussage||'')+'<div class="ber-sub">📄 '+esc(b.datei||'')+(b.fundstelle?' · '+esc(b.fundstelle):'')+'</div>')));
  h+='<div class="ber-meta">Erstellt '+fmtD(ber.created_at)+(ber.von?' · Zeitraum '+fmtD(ber.von)+' – '+fmtD(ber.bis):'')+' · nur für den internen Gebrauch'+(ber.html_pfad?'<br>📄 Druckfassung (intern + extern) im Projektordner: <span class="mono">'+esc(ber.html_pfad)+'</span>':'')+'</div>';
  return h;}
function berZieleCard(proj){const z=Array.isArray(proj.ziele)?proj.ziele:[];
  let h='<details class="ber-ziele"'+(z.length?'':' open')+'><summary>🎯 Projektziele ('+z.length+') — Vorgaben für den Zielpfad</summary><div class="ber-ziele-b">';
  h+=z.map((g,i)=>'<div class="ber-ziel"><span class="ber-ziel-t">'+esc(g.titel||'')+'</span>'+(g.termin?'<span class="mono ber-ziel-d">'+esc(g.termin)+'</span>':'')+(g.kontext?'<span class="ber-ziel-k">'+esc(g.kontext)+'</span>':'')+'<button class="ber-ziel-x" data-zdel="'+i+'" title="Ziel löschen">×</button></div>').join('');
  h+='<div class="ber-ziel-add"><input id="zt" placeholder="Ziel (z.B. Bauantrag eingereicht)"><input id="zd" type="date" title="Termin"><input id="zk" placeholder="Kontext (optional)"><button class="btn-sm" id="zadd">+ Ziel</button></div>';
  h+='</div></details>';return h;}
async function saveZiele(proj,z){proj.ziele=z;const{error}=await sb.from('projects').update({ziele:z}).eq('id',current);if(error)alert('Ziele nicht gespeichert: '+error.message);renderBericht(proj);}
function wireZiele(proj){const z=Array.isArray(proj.ziele)?proj.ziele:[];
  el('main').querySelectorAll('button[data-zdel]').forEach(b=>b.onclick=()=>{const c=[...z];c.splice(Number(b.dataset.zdel),1);saveZiele(proj,c);});
  const add=el('zadd');if(add)add.onclick=()=>{const t=(el('zt').value||'').trim();if(!t)return;const g={titel:t};const d=el('zd').value;if(d)g.termin=d;const k=(el('zk').value||'').trim();if(k)g.kontext=k;saveZiele(proj,[...z,g]);};}

// In der fusionierten App bringt die Huelle (Board) die Anmeldung mit: sie reicht
// die Sitzung herein und sagt, welches Projekt zu zeigen ist. Eigenes
// Login-Formular und Abmelde-Knopf entfallen hier -- beides steht in der Huelle.
function showAuthed(s){el('shell').hidden=!s;if(s){const ue=el('useremail');if(ue)ue.textContent=s.user.email;boot();}else started=false;}

// Von der Huelle aufgerufen, sobald ein Projekt-Dashboard gezeigt werden soll.
window.dashStart=async function(tokens,projektId){
  if(!sb.auth.getSession||!tokens){return;}
  const{data:{session}}=await sb.auth.getSession();
  if(!session){
    const{data,error}=await sb.auth.setSession({access_token:tokens.access_token,refresh_token:tokens.refresh_token});
    if(error){console.error('Dashboard-Sitzung abgelehnt:',error.message);return;}
    showAuthed(data.session);
  }else if(el('shell').hidden){showAuthed(session);}
  if(projektId)go('project',projektId);
};
window.dashProjekt=function(projektId){go('project',projektId);};
{const gb=el('glossbtn');if(gb)gb.addEventListener('click',openGloss);}initTips();
function setDrawer(open){const s=document.querySelector('.sidebar'),b=el('sbbackdrop');if(s)s.classList.toggle('open',open);if(b)b.classList.toggle('open',open);}
function boot(){if(started){render();return;}started=true;render();loadRuns();
  const mb=el('menubtn'),bd=el('sbbackdrop');
  if(mb)mb.onclick=()=>setDrawer(!document.querySelector('.sidebar').classList.contains('open'));
  if(bd)bd.onclick=()=>setDrawer(false);
  setInterval(()=>loadRuns(),15000);  // Runner-Status + Läufe regelmäßig auffrischen
  sb.channel('os-rt').on('postgres_changes',{event:'*',schema:'public',table:'agent_runs'},()=>loadRuns())
   .on('postgres_changes',{event:'*',schema:'public',table:'tasks'},()=>{if(view==='project')render();})
   .on('postgres_changes',{event:'*',schema:'public',table:'communications'},()=>render())
   .on('postgres_changes',{event:'*',schema:'public',table:'projects'},()=>{if(view==='project')render();})
   .subscribe(st=>{if(st==='SUBSCRIBED')el('runlive').textContent='● live';});}
function go(v,id){view=v;current=id||null;openWin=null;document.body.style.overflow='';if(v==='project'){pview='dashboard';tab='alle';prioFilters.clear();}setDrawer(false);render();}
async function render(){renderSidebar();if(view==='cockpit')await renderCockpit();else if(view==='project'&&pview==='system')await renderSystemPanel();else await renderProject();}
function timeAgo(d){if(!d)return '—';const s=(Date.now()-new Date(d).getTime())/1000;if(s<90)return 'gerade';if(s<5400)return 'vor '+Math.round(s/60)+' min';if(s<172800)return 'vor '+Math.round(s/3600)+' h';return 'vor '+Math.round(s/86400)+' d';}
async function queueAgentFor(projectId,agent,btn){if(btn){btn.disabled=true;btn.textContent='…';}const{error}=await sb.from('agent_runs').insert({project_id:projectId,agent,status:'queued',meta:{trigger:'manuell'}});const dup=error&&error.code==='23505';if(error&&!dup)alert('Konnte nicht starten: '+error.message);if(btn){btn.textContent=dup?'läuft bereits':'…';setTimeout(()=>{btn.disabled=false;btn.textContent='Aktualisieren';},1600);}loadRuns();}
async function renderSystemPanel(){
  el('crumb').innerHTML='<a id="toC">Cockpit</a><span class="sep">›</span>System & Automatik';
  const[{data:hb},{data:projs},{data:runs}]=await Promise.all([
    sb.from('runner_heartbeat').select('last_seen,host').eq('id',1),
    sb.from('projects').select('id,name,lph,dashboard_stand,last_sync').order('name'),
    sb.from('agent_runs').select('agent,status,result,meta,created_at,projects(name)').order('created_at',{ascending:false}).limit(18)]);
  const lastSeen=hb&&hb[0]?hb[0].last_seen:null,active=lastSeen&&(Date.now()-new Date(lastSeen).getTime()<20000);
  let h='<section class="av-panel active"><div class="av-hero"><div class="av-hero-ico">'+navIco('cog')+'</div><div><div class="av-hero-kicker">System · Automatik</div><div class="av-hero-title">Steuerung & Selbstlauf</div><div class="av-hero-desc">Der Manager-Loop hält alle Projekte automatisch aktuell (alle 6 h, max 3 Jobs/Durchlauf). Hier siehst du den Status — und kannst jedes Projekt jederzeit selbst aktualisieren.</div></div><div class="av-hero-side"><span class="rstatus '+(active?'on':'off')+'" style="display:inline-flex"><span class="d"></span>'+(active?'Runner aktiv':'Runner aus')+'</span><div class="av-lastrun">'+(lastSeen?'Heartbeat '+timeAgo(lastSeen):'kein Heartbeat')+(hb&&hb[0]&&hb[0].host?' · '+esc(hb[0].host):'')+'</div></div></div>';
  h+='<div class="av-secrow">Projekte · Aktualität</div><table class="av-table"><tr><th>Projekt</th><th>Phase</th><th>Analyse</th><th>Letzter Scan</th><th></th></tr>';
  for(const p of (projs||[]))h+='<tr><td>'+esc(short(p.name))+'</td><td>'+(p.lph?'LPH '+p.lph:'—')+'</td><td>'+(p.dashboard_stand?timeAgo(p.dashboard_stand):'<span style="color:var(--c-danger)">nie</span>')+'</td><td>'+(p.last_sync?timeAgo(p.last_sync):'—')+'</td><td style="text-align:right"><button class="btn-sm" data-refresh="'+p.id+'">Aktualisieren</button></td></tr>';
  h+='</table>';
  h+='<div class="av-secrow">Letzte Agenten-Läufe · Nachweise (Control Plane)</div><table class="av-table"><tr><th>Projekt</th><th>Agent</th><th>Auslöser</th><th>Status</th><th>Ergebnis</th><th>Zeit</th></tr>';
  for(const r of (runs||[])){const trg=(r.meta&&r.meta.trigger)||'manuell';h+='<tr><td>'+esc(short(r.projects?r.projects.name:''))+'</td><td>'+esc(AL[r.agent]||r.agent)+'</td><td><span class="av-tag '+(trg==='manager'?'ok':'offen')+'">'+esc(trg)+'</span></td><td><span class="rst '+r.status+'">'+r.status+'</span></td><td style="font-size:11px;color:var(--c-slate-600)">'+esc((r.result||'').slice(0,60))+'</td><td class="mono" style="font-size:10px;white-space:nowrap">'+timeAgo(r.created_at)+'</td></tr>';}
  h+='</table></section>';
  el('main').innerHTML=h;
  const tc=el('toC');if(tc)tc.onclick=()=>go('cockpit');
  el('main').querySelectorAll('button[data-refresh]').forEach(b=>b.onclick=()=>queueAgentFor(b.dataset.refresh,'scan',b));
}
function renderSidebar(){
  const box=el('sbagents'),lbl=el('sbproj');if(!box)return;
  if(view!=='project'||!current){
    if(lbl)lbl.textContent='Agentic OS · Cockpit';
    box.innerHTML='<div class="sb-group"><div class="sb-group-h">Agenten<span class="ln"></span></div><div class="empty" style="padding:10px 8px;font-size:11px;text-align:left">Wähle im Cockpit ein Projekt, um Agenten darauf zu starten.</div></div>';
    return;
  }
  if(lbl)lbl.innerHTML='Projekt<br><span style="color:var(--c-navy-900);font-size:12px;text-transform:none;letter-spacing:0">'+esc(short(currentName))+'</span>';
  const D=lastD||{};
  let h='<div class="sb-group"><div class="sb-group-h">Ansicht<span class="ln"></span></div>';
  h+=navItem('dashboard','Dashboard',navIco('grid'),null);
  for(const v of AGENT_VIEWS){let cnt=v.key&&D[v.key]?D[v.key].length:0;if(v.id==='termine'&&D.vorausschau)cnt=(D.vorausschau.zwangspunkte||[]).length+(D.vorausschau.diese_woche||[]).length;h+=navItem(v.id,v.title,navIco(v.ico),cnt||null);}
  h+=navItem('system','System & Automatik',navIco('cog'),null);
  h+='</div>';
  h+='<div class="sb-group"><div class="sb-group-h">Werkzeuge<span class="ln"></span></div>';
  for(const g of AGENT_GROUPS)for(const a of g.items)h+='<button class="sb-ag'+(a.doku?' doku':'')+'" data-agent="'+a.id+'"><span class="ai">'+a.ic+'</span><span class="sb-ag-tx"><span class="at">'+esc(a.t)+'</span><span class="as">'+esc(a.s)+'</span></span></button>';
  h+='</div><div class="page-sub" style="font-size:10px;padding:0 2px 10px;line-height:1.4">Läuft, wenn der <strong>Runner</strong> aktiv ist (Status oben rechts).</div>';
  box.innerHTML=h;
  box.querySelectorAll('.sb-nav').forEach(b=>b.onclick=()=>{pview=b.dataset.pview;openWin=null;document.body.style.overflow='';setDrawer(false);renderSidebar();render();window.scrollTo(0,0);});
  box.querySelectorAll('button[data-agent]').forEach(b=>b.onclick=()=>queueAgent(b.dataset.agent,{},b));
}

async function renderCockpit(){el('crumb').textContent='Cockpit';
  const[{data:ps},{data:ts},{data:cs}]=await Promise.all([sb.from('projects').select('id,name,lph,unc_path').order('name'),sb.from('tasks').select('project_id,status,prio,title,due_date'),sb.from('communications').select('project_id,status,frist,betreff')]);
  const m={};(ps||[]).forEach(p=>m[p.id]={name:p.name,lph:p.lph,offen:0,p1:0,od:0});
  (ts||[]).forEach(t=>{const b=m[t.project_id];if(b&&t.status!=='erledigt'){b.offen++;if(t.prio==='P1')b.p1++;}});
  const td=today();(cs||[]).forEach(c=>{const b=m[c.project_id];if(b&&(c.status==='ueberfaellig'||(c.frist&&c.frist<td&&!['beantwortet','erledigt'].includes(c.status))))b.od++;});
  let h='<h1 class="page">Cockpit</h1><div class="page-sub">'+(ps||[]).length+' Projekte · klick für das Projekt-Dashboard</div>';
  const byJahr={};
  for(const p of(ps||[])){const jm=(p.unc_path||'').match(/[\\/](?:_ )?(\d{2}) - /);const j=jm?jm[1]:'';(byJahr[j]=byJahr[j]||[]).push(p);}
  const jahre=Object.keys(byJahr).sort((a,b)=>(b||'0')-(a||'0'));
  for(const j of jahre){
  h+='<div class="jahrrow"><div class="jahr">'+(j||'···')+'</div><div class="grid">';
  for(const p of byJahr[j]){const b=m[p.id];const nr=(p.name.match(/\d{3,4}/)||[''])[0];h+='<div class="pcard'+(b.od?' alert':'')+'" data-id="'+p.id+'">'+(nr?'<div class="pcard-nr">'+nr+'</div>':'')+'<div class="pn">'+esc(short(p.name))+'</div><div class="plph">'+(b.lph?'LPH '+b.lph+' aktiv':'Phase offen')+'</div><div class="pk"><div><div class="v">'+dm(b.offen,2.5,'var(--c-navy-900)')+'</div><div class="k">offen</div></div><div><div class="v">'+dm(b.p1,2.5,b.p1?'var(--c-danger)':'var(--c-navy-900)')+'</div><div class="k">P1</div></div><div><div class="v">'+dm(b.od,2.5,b.od?'var(--c-danger)':'var(--c-navy-900)')+'</div><div class="k">überfällig</div></div></div></div>';}
  h+='</div></div>';
  }
  el('main').innerHTML=h;
  el('main').querySelectorAll('.pcard').forEach(c=>c.onclick=()=>go('project',c.dataset.id));}

async function renderProject(){
  const td=today();
  const[{data:proj},{data:tasks},{data:comms},{count:docCount},{data:recent},{data:folders},{data:costDocs},{data:fbRows}]=await Promise.all([
    sb.from('projects').select('id,name,lph,dashboard,dashboard_stand,doku_check,checklist,lph1,lph1_stand,lph_kataloge,angebote_check,angebote_stand,termin_check,termin_stand,ziele,kennzahlen,kennzahlen_stand').eq('id',current).single(),
    sb.from('tasks').select('id,title,status,prio,kategorie,assignee,due_date,meta').eq('project_id',current).order('prio'),
    sb.from('communications').select('id,typ,betreff,empfaenger,empfaenger_email,status,frist,betrag,meta').eq('project_id',current),
    sb.from('documents').select('id',{count:'exact',head:true}).eq('project_id',current),
    sb.from('documents').select('filename,doctype,modified_at').eq('project_id',current).not('modified_at','is',null).order('modified_at',{ascending:false}).limit(12),
    sb.rpc('folder_stats',{pid:current}),
    sb.from('documents').select('filename,modified_at').eq('project_id',current).or('filename.ilike.%kosten%,filename.ilike.%din%276%,filename.ilike.%honorar%,filename.ilike.%angebot%,filename.ilike.%nachtrag%').order('modified_at',{ascending:false}).limit(15),
    sb.from('item_feedback').select('item_type,item_title,kommentar').eq('project_id',current).order('created_at')]);
  if(!proj){go('cockpit');return;}
  await betLaden();
  currentName=proj.name;lastD=proj.dashboard||{};lastStand=proj.dashboard_stand;lastChecklist=proj.checklist||{};lastL1=proj.lph1||null;renderSidebar();
  fbClosed={};(fbRows||[]).forEach(r=>{fbClosed[fbKey(r.item_type,r.item_title)]=r;});
  el('crumb').innerHTML='<a id="toC">Cockpit</a><span class="sep">›</span>'+esc(short(proj.name));
  const T=tasks||[],C=comms||[],D=proj.dashboard||null;
  peopleMail={};((D&&D.beteiligte)||[]).forEach(p=>{if(p&&p.name&&p.email)peopleMail[String(p.name).toLowerCase().trim()]=p.email;});
  (C||[]).forEach(c=>{if(c.empfaenger&&c.empfaenger_email)peopleMail[String(c.empfaenger).toLowerCase().trim()]=c.empfaenger_email;});
  const AL=getAufgaben(D,T);
  const offen=AL.filter(t=>t.status!=='erledigt').length,p1=AL.filter(t=>t.status!=='erledigt'&&t.prio==='P1').length;
  const cOpen=C.filter(c=>!['beantwortet','erledigt'].includes(c.status)).length,cOver=C.filter(c=>c.status==='ueberfaellig'||(c.frist&&c.frist<td&&!['beantwortet','erledigt'].includes(c.status))).length;
  const nr=(proj.name.match(/(\d{4})/)||[])[1]||'',lph=proj.lph||0;
  const kostenVal=D&&D.kosten&&D.kosten.summe_brutto?D.kosten.summe_brutto:null;
  const honVal=D&&D.honorare?D.honorare:null;
  if(pview==='bericht'){await renderBericht(proj);return;}
  if(pview!=='dashboard'){renderAgentPanel(pview,D,{recent:recent||[],costDocs:costDocs||[],folders:folders||[],docCount:docCount||0,dokuCheck:proj.doku_check,angeboteCheck:proj.angebote_check,angeboteStand:proj.angebote_stand,terminCheck:proj.termin_check,terminStand:proj.termin_stand,lph:proj.lph||0});return;}

  let h='<header class="hdr"><div><div class="hdr-brand">Gutthann HIW · Projekt-Dashboard · Live</div><h1 class="hdr-title">'+esc(short(proj.name))+'</h1>'+
    '<div class="hdr-meta">'+(nr?'<span><strong>Nr.</strong> '+nr+'</span>':'')+'<span><strong>Phase</strong> '+(lph?'LPH '+lph:'—')+'</span><span><strong>Dokumente</strong> '+(docCount||0)+'</span><span><strong>Aufgaben</strong> '+offen+' offen</span></div></div>'+
    '<div class="hdr-status">'+(D?'Analyse-Stand':'Stand')+'<span class="stamp">'+(proj.dashboard_stand?fmtD(proj.dashboard_stand):fmtD(today()))+'</span></div></header>';
  const kk=D&&D.kosten,kBudget=(kk&&kk.budget!=null&&!isNaN(+kk.budget)&&+kk.budget>0)?+kk.budget:null;
  let kostenSub=kostenVal?('brutto'+(kk&&kk.stand?' · Stand '+esc(kk.stand):' · Stand lt. Analyse')):'Tiefenanalyse nötig',kostenBar='';
  if(kostenVal&&kBudget){const dlt=kostenVal-kBudget;kostenSub=(dlt>0?'<span class="up">+':'<span class="okc">−')+Math.abs(Math.round(dlt/1000)).toLocaleString('de-DE')+' T€</span> vs. Budget '+(kBudget/1e6).toLocaleString('de-DE',{maximumFractionDigits:2})+' Mio €';kostenBar='<div class="kpi-bar"><i class="'+(dlt>0?'over':'')+'" style="width:'+Math.min(100,Math.round(kostenVal/kBudget*100))+'%"></i></div>';}
  h+='<div class="kpi-strip">'+kpi('accent','Aktive Phase',lph?gl('LPH')+' '+lph:'—','','HOAI § 34')+
    kpi(kostenVal?'':'','Kosten aktuell',kostenVal?(kostenVal/1e6).toLocaleString('de-DE',{maximumFractionDigits:2}):'—',kostenVal?'Mio €':'',kostenSub,kostenBar)+
    kpi(cOver?'alert':'','Überfällige Vorgänge',cOver,'',cOver?'Nachhaken nötig · '+cOpen+' offen gesamt':(cOpen?cOpen+' offen · nichts überfällig':'nichts offen'))+
    kzKpi(proj.kennzahlen,kostenVal)+'</div>';
  h+='<nav class="pilgrim"><div class="pilgrim-label">Leistungsphasen HOAI · klick zum Setzen der aktiven Phase</div><div class="pilgrim-track"><div class="pilgrim-line"></div><div class="pilgrim-line-progress" style="width:'+(lph?((lph-1)/8*89+5.5):0)+'%"></div>';
  for(let i=1;i<=9;i++){const cl=lph&&i<lph?'done':lph&&i===lph?'active':'';h+='<div class="pilgrim-station '+cl+'" data-lph="'+i+'"><div class="pilgrim-dot">'+i+'</div><div class="pilgrim-labelset">'+LPH[i-1]+'</div></div>';}
  h+='</div></nav>';
  // Aura-Fenster: Phasen-Reife + engster Zwangspunkt-Puffer (echte Analyse-Werte) + „Diese Woche" —
  // alle drei sind Einstiege in dasselbe Vorausschau-Fenster (Termin-Radar, Reife, Jour-Fixe …)
  {const vs=(D&&D.vorausschau)||{};
   const pr=(vs.phasen_reife&&vs.phasen_reife.pct!=null)?Math.max(0,Math.min(100,Math.round(+vs.phasen_reife.pct))):null;
   const zps=(vs.zwangspunkte||[]).filter(z=>z&&z.puffer_wochen!=null).sort((a,b)=>(+a.puffer_wochen)-(+b.puffer_wochen));
   const wk=(vs.diese_woche||[]).slice(0,3);
   {let ar='<section class="win" data-sec="vorausschau"><div class="aurarow">';
    if(pr!=null){const cl=pr>=66?'green':'amber';const fe=((vs.phasen_reife&&vs.phasen_reife.fehlend)||[]).slice(0,2).map(f=>f&&f.text).filter(Boolean);
     ar+='<button class="aura '+cl+'" data-winopen title="Fenster öffnen: Termine & Vorausschau"><div class="aura-bg"></div><div class="aura-dots"></div><div class="aura-c"><span class="aura-l">'+(lph?'LPH '+lph+' · ':'')+gl('Fortschritt',GLOSS['Phasen-Reife'])+'</span><span class="aura-v">'+dm(pr,6.5,'#fff')+'<span class="aura-pct">%</span></span><span class="aura-s">der Grundleistungen abgeschlossen</span>'+(fe.length?'<div class="aura-foot"><span>fehlt: '+esc(fe.join(' · '))+'</span></div>':'')+'</div></button>';}
    ar+='<button class="aura '+(p1?'amber':'green')+'" data-openwin="aufgaben" title="Fenster öffnen: Aufgaben-Zentrale"><div class="aura-bg"></div><div class="aura-dots"></div><div class="aura-c"><span class="aura-l">Offene Aufgaben</span><span class="aura-v">'+dm(offen,6.5,'#fff')+'</span><span class="aura-s">'+p1+' kritisch · P1</span></div></button>';
    let zfoot='';if(zps.length){const z=zps[0],pw=Math.max(0,Math.round(+z.puffer_wochen));zfoot='<div class="aura-side-foot"><span class="pdot '+(pw<=6?'warn':'ok')+'"></span><span class="asf-t">'+gl('Puffer')+' <strong>'+pw+' Wo</strong> · '+esc(z.name||'')+'</span>'+(z.frist?'<span class="asf-f">'+fmtFrist(z.frist)+'</span>':'')+'</div>';}
    ar+='<button class="aura-side" data-winopen title="Fenster öffnen: Termine & Vorausschau"><div class="aura-side-h">Diese Woche<span class="cnt">'+wk.length+'</span></div>'+(wk.length?wk.map(a=>'<div class="aura-week'+(a.dringlichkeit==='bald'?' soon':'')+'"><span class="dot"></span><div class="aura-week-t">'+esc(a.titel||'')+'</div>'+(a.frist?'<span class="aura-week-f">'+fmtFrist(a.frist)+'</span>':'')+'</div>').join(''):'<div class="empty" style="padding:14px">Keine fixen Fristen in den nächsten 2 Wochen.</div>')+zfoot+'</button>';
    ar+='</div><div class="win-ov" hidden><div class="win-card"><header class="win-head"><span class="win-ico">◔</span><div class="win-head-tx"><div class="win-title">Termine & Vorausschau</div><div class="win-sum">Zwangspunkte, '+gl('Phasen-Reife')+', Wochen-Fokus — aus der Analyse</div></div><div class="win-meta"><span class="stat">'+(vs.zwangspunkte||[]).length+' '+gl('Zwangspunkt')+(((vs.zwangspunkte||[]).length)===1?'':'e')+'</span></div><button class="win-x" title="Fenster schließen">✕</button></header><div class="win-bd"><div class="vs-inner">'+renderVorausschau(vs)+'</div></div></div></div></section>';
    h+=ar;}}
  h+='<div class="winboard">';
  // Projekt-Kennzahlen (Hardfacts) — Größe, Kosten-Kennwerte, Auftrag/Honorar, Nutzung, Termine.
  // Einstieg ist die KPI-Karte oben (data-openwin="kennzahlen"); hier das volle Fenster + Referenzblatt.
  {const KZ=proj.kennzahlen||null;lastKz=KZ;lastKzName=proj.name;
   const tKz=KZ?(kzTeaser(KZ)):tz('warn','Noch nicht erfasst — der Agent zieht die Hardfacts aus Flächenermittlung, Bauantrag und Kostenberechnung','');
   const nBel=KZ?kzCount(KZ):0;
   h+=sec('kennzahlen','prominent','▤','Projekt-Kennzahlen',KZ?('Hardfacts · Stand '+(proj.kennzahlen_stand?fmtD(proj.kennzahlen_stand):'—')):'Flächen, Kubatur, Kennwerte, Auftrag',
     (KZ?'<span class="stat ok">'+nBel+' Werte</span>':'<span class="stat warn">offen</span>'),renderKennzahlen(KZ,D,proj.name),tKz);}
  // LPH-Katalog der AKTIVEN Phase — Fragenkatalog + Abschnitts-Stand je LPH (LPH 1 = Grundlagen inkl. Raumprogramm, Fallback lph1-Spalte)
  {const kLph=lph||1;const kat=(proj.lph_kataloge&&proj.lph_kataloge[String(kLph)])||(kLph===1?(proj.lph1||null):null);
    lastKat=kat;lastKatLph=kLph;
    const frOff=kat?((kat.fragenkatalog||[]).filter(x=>x&&!fbClosed[fbKey('frage',x.frage)])):[];
    const muss=frOff.filter(x=>x.prioritaet==='muss').length;
    const absL=kat?(kat.abschnitte||[]):[];const gekl=absL.filter(a=>a.status==='geklaert').length;
    const tL1=kat?(tz(null,'Abschnitte geklärt',gekl+'/'+absL.length)+'<span class="win-bar"><i style="width:'+(absL.length?Math.round(gekl/absL.length*100):0)+'%"></i></span>'+tz(muss?'bad':'ok','Muss-Fragen offen',''+muss)):tz('warn','Noch nicht erfasst — der Agent zieht den Katalog aus den Unterlagen','');
    h+=sec('lph1','prominent daily','◔','LPH '+kLph+' · '+(LPH_KAT_TITEL[kLph]||'')+' · Fragenkatalog',kat?('Stand '+(kat.stand?fmtFrist(kat.stand):(kLph===1&&proj.lph1_stand?fmtD(proj.lph1_stand):'—'))):'Katalog der aktiven Phase aus den Unterlagen erfassen',(kat?'<span class="stat'+(muss?' alert':' ok')+'">'+muss+' Muss-Fragen</span>':'<span class="stat warn">offen</span>'),renderLph1(kat,kLph),tL1);}
  // Vorausschau lebt jetzt in der Ansicht „Termine & Fristen" (Marcel: umziehen statt doppeltem Block auf dem Dashboard).
  // Aufgaben-Zentrale
  const cats={};AL.forEach(t=>{if(t.status!=='erledigt'){const k=t.kategorie||'sonstige';cats[k]=(cats[k]||0)+1;}});
  const tabsRow='<nav class="tasks-tabs">'+tabBtn('alle','Alle',offen)+Object.keys(cats).sort((a,b)=>cats[b]-cats[a]).map(k=>tabBtn(slug(k),k,cats[k])).join('')+'</nav>';
  const filtRow='<div class="tasks-filters"><span class="filter-label">Priorität</span><button class="fc s1" data-p="P1">P1</button><button class="fc s2" data-p="P2">P2</button><button class="fc" data-p="P3">P3</button><span style="flex:1"></span><button class="btn-sm ghost" id="addtaskbtn" style="margin:0;padding:5px 11px">+ Aufgabe</button></div>';
  const aufgHero=ovHero([ovK(p1?'bad':'ok',p1,'P1 kritisch'),ovK('',offen,'offen gesamt'),ovK('ok',AL.length-offen,'erledigt')]);
  const aufgBody=aufgHero+tabsRow+filtRow+addTaskForm()+(AL.length?renderAufgSplit(AL):'<div class="empty" style="padding:24px">Noch keine Aufgaben — lege oben eine an, oder die Analyse zieht sie aus den Protokollen.</div>');
  const topT=AL.filter(t=>t.status!=='erledigt').sort((a,b)=>prioN(a.prio)-prioN(b.prio)).slice(0,3);
  const tAufg=(topT.length?topT.map(t=>{const m=t.meta||{};return tz('p'+prioN(t.prio),esc(t.title),m.frist?fmtFrist(m.frist):'');}).join(''):tz('ok','Keine offenen Aufgaben',''))+(offen>3?tz(null,'+ '+(offen-3)+' weitere offen','','tz-more'):'');
  h+=sec('aufgaben','prominent daily','⚡','Aufgaben-Zentrale',offen+' offen · '+p1+' kritisch','<span class="stat'+(p1?' alert':'')+'">'+p1+' P1</span>',aufgBody,tAufg);
  // Vorgänge / Nachhaken — Täglich-Fenster, dringendste zuerst
  {const cOL=C.filter(c=>!['beantwortet','erledigt'].includes(c.status)).sort((a,b)=>{const ao=(a.status==='ueberfaellig'||(a.frist&&a.frist<td))?0:1,bo=(b.status==='ueberfaellig'||(b.frist&&b.frist<td))?0:1;return ao-bo||((a.frist||'9999')<(b.frist||'9999')?-1:1);});
   const tVorg=(cOL.length?cOL.slice(0,3).map(c=>{const od=c.status==='ueberfaellig'||(c.frist&&c.frist<td);return tz(od?'bad':'warn',esc(c.betreff)+(c.empfaenger?' · '+esc(c.empfaenger):''),od?'überfällig':(c.frist?fmtFrist(c.frist):esc(stL(c.status))));}).join(''):tz('ok','Nichts offen — alle Vorgänge beantwortet',''))+(cOL.length>3?tz(null,'+ '+(cOL.length-3)+' weitere offen','','tz-more'):'');
   h+=sec('vorgaenge','prominent daily','✉',gl('Nachhaken')+' & Vorgänge','Worauf gewartet wird — Antworten, Fristen, Angebote','<span class="stat'+(cOver?' alert':'')+'">'+cOver+' überfällig</span>',renderComms(C),tVorg);}
  // Kosten (Pflicht) — groß & präsent
  {let tKost='';const k=D&&D.kosten;
   if(k&&k.summe_brutto){tKost='<span class="win-big">'+dm((k.summe_brutto/1e6).toLocaleString('de-DE',{maximumFractionDigits:2}),3.2,'var(--c-navy-900)')+'<span class="win-big-u">Mio € brutto'+(k.stand?' · Stand '+esc(k.stand):'')+'</span></span>';
    if(k.budget!=null&&!isNaN(+k.budget)&&+k.budget>0){const dlt=k.summe_brutto-(+k.budget);tKost+=tz(dlt>0?'bad':'ok','vs. '+gl('Budget','Vom Bauherrn vorgegebener Kostenrahmen.')+' '+((+k.budget)/1e6).toLocaleString('de-DE',{maximumFractionDigits:2})+' Mio €','<span style="color:'+(dlt>0?'var(--c-danger)':'var(--c-success)')+'">'+(dlt>0?'+':'−')+Math.abs(Math.round(dlt/1000)).toLocaleString('de-DE')+' T€</span>');}
    if(honVal&&honVal.offene_nachtraege)tKost+=tz('warn','Offene Nachträge',''+honVal.offene_nachtraege);
   }else tKost=tz('warn','Noch keine Kostenwerte — Tiefenanalyse starten','');
   h+=sec('kosten','prominent','€','Kosten-Übersicht',k?'DIN 276 · aus Tiefenanalyse':'noch nicht analysiert',(k?'<span class="stat ok">analysiert</span>':'<span class="stat warn">offen</span>'),'<div class="inner">'+renderKosten(D,costDocs||[])+'</div>',tKost);}
  // LPH-Bewertung
  {const lb=(D&&D.lph_bewertung)||[];const cN=s=>lb.filter(r=>r.status===s).length;
   const tLb=lb.length?(tz('ok','vollständig',''+cN('vollstaendig'))+tz('warn','teilweise',''+cN('teilweise'))+tz('bad','fehlend',''+cN('fehlend'))):tz('warn','Noch nicht bewertet — kommt aus der Tiefenanalyse','');
   h+=sec('lphbew','','✓','LPH-Bewertung',(lph?'LPH '+lph+' Grundleistungen':'Grundleistungen'),'','<div class="inner">'+renderLphBew(D)+'</div>',tLb);}
  // LPH-Checkliste (HOAI-Grundleistungen + Vergabe/ZVB) — abhakbar, persistent
  {const cdone=clCounts(lastChecklist);const clPct=cdone.total?Math.round(cdone.done/cdone.total*100):0;
   h+=sec('checkliste','','☑','LPH-Checkliste','HOAI-Grundleistungen + Vergabe/ZVB je Phase','<span class="stat">'+cdone.done+'/'+cdone.total+'</span>','<div class="inner">'+renderChecklist(lph)+'</div>',tz(null,'Abgehakt über alle Phasen',cdone.done+'/'+cdone.total)+'<span class="win-bar"><i style="width:'+clPct+'%"></i></span>');}
  // Offene Entscheidungen (getrennt von gefassten Beschlüssen) — mit Kommentar abgeschlossene zählen nicht mehr als offen
  const eoAll=(D&&D.entscheidungen_offen)||[];
  const eo=eoAll.filter(e=>e&&!fbClosed[fbKey('entscheidung',e.thema||e.titel||e.text||'')]);
  if(eo.length)h+=sec('entscheidungen','','◇','Offene Entscheidungen',eo.length+' anstehend · noch nicht getroffen','<span class="stat warn">'+eo.length+'</span>','<div class="inner">'+renderEntscheidungen(eoAll)+'</div>',eo.slice(0,2).map(e=>tz('warn',esc(e.titel||e.text||''),e.frist?fmtFrist(e.frist):'')).join('')+(eo.length>2?tz(null,'+ '+(eo.length-2)+' weitere','','tz-more'):''));
  // Beschlüsse
  {const bs=(D&&D.beschluesse)||[];
   h+=sec('beschluesse','','§','Wesentliche Beschlüsse',bs.length?'aus Protokollen & Mails':'noch nicht analysiert','','<div class="inner">'+renderBeschluesse(D)+'</div>',bs.length?(bs.slice(0,2).map(b=>tz(null,esc(b.text||''),esc(b.datum||''))).join('')+(bs.length>2?tz(null,'+ '+(bs.length-2)+' weitere','','tz-more'):'')):tz('warn','Noch keine Beschlüsse extrahiert',''));}
  // Aktivität
  h+=sec('aktivitaet','','◷','Aktivität (zuletzt geändert)','neueste Dateien & Mails','<span class="stat">'+(recent||[]).length+'</span>','<div class="inner">'+renderAktivitaet(recent||[])+'</div>',(recent&&recent.length?recent.slice(0,3).map(d=>tz(null,esc(d.filename),fmtD(d.modified_at))).join(''):tz(null,'Keine datierten Dateien','')));
  // Mängel & Abnahmen (LPH 8 — Baustelle) — mit Kommentar abgeschlossene zählen nicht mehr als offen
  const mgAll=(D&&D.maengel)||[];
  const mg=mgAll.filter(x=>x&&!fbClosed[fbKey('mangel',x.beschreibung||'')]);
  if(mg.length){const mgOpen=mg.filter(x=>x.status!=='behoben'&&x.status!=='abgenommen');const offenM=mgOpen.length;
   h+=sec('maengel','','⚠',gl('Mängel','Dokumentierte Baumängel und offene Abnahme-Punkte (LPH 8 Objektüberwachung) mit Beseitigungsfrist.')+' & Abnahmen',mg.length+' erfasst','<span class="stat'+(offenM?' alert':' ok')+'">'+offenM+' offen</span>',renderMaengel(mgAll),(mgOpen.length?mgOpen.slice(0,2).map(m=>tz('bad',esc(m.beschreibung||''),m.frist?fmtFrist(m.frist):'')).join('')+(offenM>2?tz(null,'+ '+(offenM-2)+' weitere offen','','tz-more'):''):tz('ok','Alle Mängel behoben','')));}
  // Beteiligtenliste — selbst gepflegt (Tabelle beteiligte). Analyse liefert nur Vorschlaege.
  {const eintr=betL.filter(r=>r.art==='eintrag');
   // Platzhalter sind noch keine Beteiligten — sonst meldet ein frisches Projekt
   // "36 Beteiligte", obwohl keine einzige Firma feststeht.
   const besetzt=eintr.filter(r=>r.firma||r.nachname);
   const bh=besetzt.find(r=>r.ist_bauherr);
   const firmen=new Set(besetzt.map(r=>r.firma).filter(Boolean)).size;
   const offenN=eintr.filter(r=>r.status==='offen').length;
   const vorschlag=((D&&D.beteiligte)||[]).length;
   const tBet=besetzt.length
     ?((bh?tz(null,'<strong>Bauherr:</strong> '+esc(bh.firma||betName(bh)||''),''):'')
       +tz(null,besetzt.length+' Beteiligte'+(firmen?' · '+firmen+' Firmen':''),'')
       +(offenN?tz('warn',offenN+' noch nicht vergeben',''):''))
     :(betL.length?tz('warn','Gerüst steht — '+offenN+' Rollen noch zu besetzen','')
                  :tz('warn','Noch keine Liste angelegt'+(vorschlag?' · '+vorschlag+' Vorschläge aus der Analyse':''),''));
   h+=sec('beteiligte','prominent weit','👤','Beteiligtenliste','gegliederte Projektbeteiligte — frei bearbeitbar',
          '<span class="stat'+(besetzt.length?'':' warn')+'">'+besetzt.length+'</span>',renderBet(),tBet);}
  // Projektstruktur
  h+=sec('struktur','','📁','Projekt-Struktur',(folders||[]).length+' Top-Ordner · '+(docCount||0)+' Dokumente','','<div class="inner">'+renderFolders(folders||[],docCount||1)+'</div>',(folders&&folders.length?folders.slice(0,3).map(f=>tz(null,esc(f.ordner||'(Wurzel)'),''+f.anzahl)).join(''):''));
  // Dokument-Suche
  h+=sec('suche','','🔍','Dokument-Volltextsuche','durchsucht '+(docCount||0)+' Dokumente','','<div class="inner"><div class="search-box"><input id="docq" placeholder="z. B. Brandschutz, Sporthalle, Statik …"><button id="docgo">Suchen</button></div><div id="sres"></div></div>','<span class="win-search">🔍 z. B. Brandschutz, Statik, Förderung …</span>'+tz(null,'Volltext + Dateinamen · Treffer mit Fundstelle',''+(docCount||0)));
  h+='</div>';
  el('main').innerHTML=h;wire(T,C);
}
// Kennzahlen als normale Ziffern; size skaliert die Schrifthöhe (10px je Einheit, entspricht der früheren Rasterhöhe)
function dm(val,size,color){return '<span class="dm" style="font-family:var(--f-disp);font-size:'+Math.round(size*10)+'px;font-weight:600;line-height:.95;letter-spacing:-.02em;color:'+color+'">'+esc(String(val))+'</span>';}
function kpi(cl,label,val,unit,sub,extra){const col=cl==='alert'?'var(--c-danger)':cl==='warn'?'var(--c-warning)':'var(--c-navy-900)';
  const v=/^[0-9][0-9.,-]*$/.test(String(val))?dm(val,3.1,col):val;
  return '<div class="kpi '+cl+'"><div class="kpi-label">'+label+'</div><div class="kpi-value">'+v+(unit?'<span class="kpi-unit">'+unit+'</span>':'')+'</div><div class="kpi-sub">'+sub+'</div>'+(extra||'')+'</div>';}
// ---------- Projekt-Kennzahlen (Hardfacts, Migration 47) ----------
// Jedes Feld hat die Form {wert, quelle, stand, status}. kzW() holt den Wert, kzF() formatiert.
function kzW(g,k){const f=g&&g[k];return f&&typeof f==='object'&&f.wert!==null&&f.wert!==undefined&&f.wert!==''?f:null;}
function kzNum(g,k){const f=kzW(g,k);const n=f?+f.wert:NaN;return isNaN(n)?null:n;}
function kzZ(n,dez){return n==null?'—':Number(n).toLocaleString('de-DE',{minimumFractionDigits:dez||0,maximumFractionDigits:dez==null?0:dez});}
// Eine Zeile im Kennzahlen-Fenster: Label · Wert+Einheit · Quelle/Stand als Tooltip, Status als Punkt
function kzRow(g,k,label,einheit,dez){const f=kzW(g,k);
  const roh=f?f.wert:null;const num=typeof roh==='number'?roh:(typeof roh==='string'&&/^-?[0-9.]+$/.test(roh)?+roh:null);
  const txt=f?(num!=null?kzZ(num,dez):esc(String(roh))):'—';
  const st=f?(f.status==='belegt'?'ok':f.status==='geschaetzt'?'warn':'bad'):'';
  const q=f&&(f.quelle||f.stand)?esc([f.quelle,f.stand].filter(Boolean).join(' · ')):'';
  return '<div class="kz-row'+(f?'':' leer')+'" title="'+(q||'nicht belegt')+'"><span class="kz-l">'+esc(label)+'</span>'+
    '<span class="kz-v">'+txt+(f&&einheit?'<span class="kz-u">'+esc(einheit)+'</span>':'')+'</span>'+
    (st?'<span class="pdot '+st+'"></span>':'<span class="kz-dot-leer"></span>')+'</div>';}
function kzCount(KZ){let n=0;['groesse','kosten','auftrag','nutzung','termine'].forEach(b=>{const g=KZ[b]||{};Object.keys(g).forEach(k=>{if(kzW(g,k))n++;});});return n;}
// KPI-Karte oben: die drei meistgebrauchten Zahlen; Klick öffnet das Kennzahlen-Fenster.
function kzKpi(KZ,kostenVal){
  const g=(KZ&&KZ.groesse)||{},ko=(KZ&&KZ.kosten)||{};
  const bgf=kzNum(g,'bgf_m2'),nuf=kzNum(g,'nuf_m2');
  let eur=kzNum(ko,'eur_pro_m2_bgf');
  if(eur==null&&bgf&&kostenVal)eur=kostenVal/bgf;   // Notnagel: aus Gesamtkosten, klar als ca. gekennzeichnet
  const sub=[eur!=null?kzZ(Math.round(eur))+' €/m² BGF':null,nuf!=null?'NUF '+kzZ(nuf)+' m²':null].filter(Boolean).join(' · ')||
    (KZ?'weitere Kennzahlen im Fenster':'Hardfacts noch nicht erfasst');
  const v=bgf!=null?dm(kzZ(bgf),3.1,'var(--c-navy-900)'):'—';
  return '<div class="kpi kz-kpi" data-openwin="kennzahlen" title="Fenster öffnen: Projekt-Kennzahlen">'+
    '<div class="kpi-label">Kennzahlen<span class="kz-kpi-o">⤢</span></div>'+
    '<div class="kpi-value">'+v+(bgf!=null?'<span class="kpi-unit">m² BGF</span>':'')+'</div>'+
    '<div class="kpi-sub">'+esc(sub)+'</div></div>';}
function kzTeaser(KZ){const g=KZ.groesse||{},ko=KZ.kosten||{},nu=KZ.nutzung||{};
  const bgf=kzNum(g,'bgf_m2'),bri=kzNum(g,'bri_m3'),kg=kzNum(ko,'kg300_400_brutto'),bw=kzW(nu,'bauweise');
  return (bgf!=null?tz('ok','BGF',kzZ(bgf,2)+' m²'):tz('bad','BGF','—'))+
    (bri!=null?tz('ok','BRI',kzZ(bri)+' m³'):tz('bad','BRI','—'))+
    (kg!=null?tz('ok','KG 300+400 brutto',(kg/1e6).toLocaleString('de-DE',{maximumFractionDigits:2})+' Mio €'):'')+
    (bw?tz(null,esc(String(bw.wert)),''):'');}
// Fenster-Inhalt: fünf Blöcke nebeneinander + Referenzblatt-Knopf
function renderKennzahlen(KZ,D,pname){
  if(!KZ)return '<div class="empty" style="padding:26px">Die Hardfacts sind für dieses Projekt noch nicht erfasst.<br>Der Kennzahlen-Agent zieht sie automatisch aus Flächenermittlung (DIN 277), Bauantragsberechnung und Kostenberechnung (DIN 276) — meist innerhalb eines Tages nach der Grundlagen-Analyse.</div>';
  const g=KZ.groesse||{},ko=KZ.kosten||{},au=KZ.auftrag||{},nu=KZ.nutzung||{},te=KZ.termine||{},rf=KZ.referenz||{};
  const bgf=kzNum(g,'bgf_m2'),nuf=kzNum(g,'nuf_m2');
  const eff=(bgf&&nuf)?Math.round(nuf/bgf*100):null;
  const hero=ovHero([
    ovK('',bgf!=null?kzZ(bgf,2)+'<span class="ov-k-u">m² BGF</span>':'—','Bruttogrundfläche'),
    ovK('',kzNum(g,'bri_m3')!=null?kzZ(kzNum(g,'bri_m3'))+'<span class="ov-k-u">m³</span>':'—','Bruttorauminhalt'),
    ovK('',kzNum(ko,'eur_pro_m2_bgf')!=null?kzZ(Math.round(kzNum(ko,'eur_pro_m2_bgf')))+'<span class="ov-k-u">€/m²</span>':'—','Kostenkennwert BGF'),
    ovK(eff!=null?(eff>=60?'ok':'warn'):'',eff!=null?eff+'<span class="ov-k-u">%</span>':'—','Flächeneffizienz NUF/BGF')]);
  const blk=(titel,rows)=>'<div class="kz-block"><div class="kz-h">'+titel+'</div>'+rows.join('')+'</div>';
  const B=[];
  B.push(blk('Größe & Kubatur',[
    kzRow(g,'bgf_m2','BGF (DIN 277)','m²',2),kzRow(g,'bri_m3','BRI','m³',0),kzRow(g,'nuf_m2','Nutzfläche NUF','m²',2),
    (eff!=null?'<div class="kz-row"><span class="kz-l">Effizienz NUF/BGF</span><span class="kz-v">'+eff+'<span class="kz-u">%</span></span><span class="pdot warn"></span></div>':''),
    kzRow(g,'grundstueck_m2','Grundstück','m²',0),kzRow(g,'grz','GRZ','',2),kzRow(g,'gfz','GFZ','',2),
    kzRow(g,'geschosse','Geschosse',''),kzRow(g,'hoehe_m','Gebäudehöhe','m',2),kzRow(g,'gebaeude_n','Gebäude / Bauabschnitte','',0)]));
  B.push(blk('Kosten & Kennwerte',[
    kzRow(ko,'gesamt_brutto','Baukosten gesamt','€',0),kzRow(ko,'kg300_400_brutto','KG 300+400 brutto','€',0),
    kzRow(ko,'kg300_brutto','davon KG 300','€',0),kzRow(ko,'kg400_brutto','davon KG 400','€',0),
    kzRow(ko,'budget','Budget Bauherr','€',0),kzRow(ko,'eur_pro_m2_bgf','€ / m² BGF','€',0),
    kzRow(ko,'eur_pro_m3_bri','€ / m³ BRI','€',0),kzRow(ko,'kostenstufe','Kostenstufe',''),kzRow(ko,'kostenstand','Kostenstand','')]));
  B.push(blk('Auftrag & Honorar',[
    kzRow(au,'bauherr','Bauherr',''),kzRow(au,'ag_typ','Auftraggeber-Typ',''),kzRow(au,'lph_umfang','Leistungsphasen',''),
    kzRow(au,'rolle','Rolle',''),kzRow(au,'honorarzone','Honorarzone',''),kzRow(au,'anrechenbare_kosten','Anrechenbare Kosten','€',0),
    kzRow(au,'honorar_netto','Honorar netto','€',0),
    (D&&D.honorare?'<div class="kz-row" title="aus der Tiefenanalyse"><span class="kz-l">Verträge / offene Nachträge</span><span class="kz-v">'+(D.honorare.anzahl_vertraege!=null?D.honorare.anzahl_vertraege:'—')+'<span class="kz-u">/ '+(D.honorare.offene_nachtraege||0)+'</span></span><span class="pdot '+((D.honorare.offene_nachtraege||0)?'warn':'ok')+'"></span></div>':'')]));
  B.push(blk('Nutzung & Konstruktion',[
    kzRow(nu,'nutzungsart','Nutzung',''),kzRow(nu,'zuegigkeit','Zügigkeit / Gruppen',''),kzRow(nu,'einheiten','Klassen / Einheiten','',0),
    kzRow(nu,'nutzer_n','Nutzer (Schüler/Kinder)','',0),kzRow(nu,'bauweise','Bauweise',''),kzRow(nu,'energiestandard','Energiestandard',''),
    kzRow(nu,'dachform','Dachform',''),kzRow(nu,'gebaeudeklasse','Gebäudeklasse (Brandschutz)','',0),
    kzRow(nu,'stellplaetze','Stellplätze','',0),kzRow(nu,'bestand','Maßnahmenart',''),kzRow(nu,'barrierefrei','Barrierefreiheit','')]));
  B.push(blk('Termine',[
    kzRow(te,'baubeginn','Baubeginn',''),kzRow(te,'fertigstellung','Fertigstellung',''),kzRow(te,'bauzeit_monate','Bauzeit','Monate',0)]));
  let ref='';
  {const kt=kzW(rf,'kurztext'),kat=kzW(rf,'kategorie'),hw=kzW(rf,'hinweis');
   ref='<div class="kz-ref"><div class="kz-h">Referenzblatt (VgV-Bewerbung)</div>'+
     (kt?'<div class="kz-ref-t">'+esc(String(kt.wert))+'</div>':'')+
     (kat?'<div class="kz-ref-m">Kategorie: <strong>'+esc(String(kat.wert))+'</strong></div>':'')+
     (hw?'<div class="kz-ref-m warn">Vor Verwendung prüfen: '+esc(String(hw.wert))+'</div>':'')+
     '<button class="btn-sm" id="kzcopy" style="margin-top:10px">Für Referenzblatt kopieren</button>'+
     '<span class="kz-ref-h" id="kzcopyh"></span></div>';}
  return hero+'<div class="kz-wrap">'+B.join('')+ref+'</div>';}
// Zwischenablage-Text im Format der Referenzdatenbank
function kzRefText(){const KZ=lastKz;if(!KZ)return '';
  const g=KZ.groesse||{},ko=KZ.kosten||{},au=KZ.auftrag||{},nu=KZ.nutzung||{},te=KZ.termine||{},rf=KZ.referenz||{};
  const z=(f,e,d)=>{const v=f?f.wert:null;if(v==null||v==='')return 'nicht belegt';
    return (typeof v==='number'?kzZ(v,d):String(v))+(e?' '+e:'');};
  const L=['Projekt: '+lastKzName,
    'Kategorie: '+z(kzW(rf,'kategorie')),
    'Bauherr: '+z(kzW(au,'bauherr'))+' ('+z(kzW(au,'ag_typ'))+')',
    'Maßnahme: '+z(kzW(nu,'bestand'))+' · '+z(kzW(nu,'nutzungsart')),
    'BGF: '+z(kzW(g,'bgf_m2'),'m²',2)+' | BRI: '+z(kzW(g,'bri_m3'),'m³')+' | NUF: '+z(kzW(g,'nuf_m2'),'m²',2),
    'Baukosten KG 300+400 brutto: '+z(kzW(ko,'kg300_400_brutto'),'€'),
    'Baukosten gesamt brutto: '+z(kzW(ko,'gesamt_brutto'),'€')+' (Stand '+z(kzW(ko,'kostenstand'))+', '+z(kzW(ko,'kostenstufe'))+')',
    'Kennwert: '+z(kzW(ko,'eur_pro_m2_bgf'),'€/m² BGF'),
    'Leistungsphasen: '+z(kzW(au,'lph_umfang'))+' | Rolle: '+z(kzW(au,'rolle'))+' | Honorarzone: '+z(kzW(au,'honorarzone')),
    'Bauweise: '+z(kzW(nu,'bauweise'))+' | Energiestandard: '+z(kzW(nu,'energiestandard')),
    'Umfang: '+z(kzW(nu,'zuegigkeit'))+', '+z(kzW(nu,'einheiten'))+' Einheiten, '+z(kzW(nu,'nutzer_n'))+' Nutzer',
    'Termine: Baubeginn '+z(kzW(te,'baubeginn'))+' | Fertigstellung '+z(kzW(te,'fertigstellung'))+' | Bauzeit '+z(kzW(te,'bauzeit_monate'),'Monate'),
    kzW(rf,'kurztext')?'Kurzbeschreibung: '+String(kzW(rf,'kurztext').wert):''];
  return L.filter(Boolean).join('\n');}
// Fenster-Kachel: Kopf (Icon+Titel) + Teaser (Ausschnitt dessen, was drinnen zu erledigen ist) + Status-Pille.
// Klick öffnet das zugehörige Overlay-Fenster. extra: 'prominent' = groß (span 2), zusätzlich 'daily' = Täglich-Badge.
function sec(id,extra,icon,title,summary,meta,body,teaser){const badge=extra.indexOf('daily')>=0?'<span class="win-badge">Täglich</span>':'';
  return '<section class="win '+extra+'" data-sec="'+id+'"><button class="win-tile">'+
    '<span class="win-tile-head"><span class="win-ico">'+icon+'</span><span class="win-tx"><span class="win-title">'+title+'</span><span class="win-sub">'+esc(summary)+'</span></span>'+badge+'<span class="win-open">⤢</span></span>'+
    (teaser?'<span class="win-teaser">'+teaser+'</span>':'')+
    '<span class="win-meta">'+meta+'</span></button>'+
    '<div class="win-ov" hidden><div class="win-card"><header class="win-head"><span class="win-ico">'+icon+'</span><div class="win-head-tx"><div class="win-title">'+title+'</div><div class="win-sum">'+esc(summary)+'</div></div><div class="win-meta">'+meta+'</div><button class="win-x" title="Fenster schließen">✕</button></header><div class="win-bd">'+body+'</div></div></div></section>';}
// Fenster-Hero: Status-gefärbte Großzahlen oben im Overlay (Datum-Muster). val darf HTML enthalten (Einheit via .ov-k-u).
function ovK(cl,val,label){return '<div class="ov-k'+(cl?' '+cl:'')+'"><span class="ov-k-v">'+val+'</span><span class="ov-k-l">'+esc(label)+'</span></div>';}
function ovHero(cells){cells=cells.filter(Boolean);return cells.length?'<div class="ov-hero">'+cells.join('')+'</div>':'';}
// Eine Teaser-Zeile: optionaler Status-Punkt, Text (ellipsiert), rechts Mono-Wert
function tz(dot,text,right,cls){return '<span class="tz'+(cls?' '+cls:'')+'">'+(dot?'<span class="pdot '+dot+'"></span>':'')+'<span class="tz-t">'+text+'</span>'+(right!=null&&right!==''?'<span class="tz-r">'+right+'</span>':'')+'</span>';}
function tabBtn(id,label,cnt){return '<button class="tab-btn'+(tab===id?' active':'')+'" data-tab="'+id+'">'+esc(label)+'<span class="tab-count">'+cnt+'</span></button>';}
function chevT(){return '<svg class="task-chevron" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>';}
function getAufgaben(D,T){
  // Quelle der Wahrheit = geteilte tasks-Tabelle (vom Agenten befuellt + manuelle); team-weit, realtime, Abhaken persistent.
  return (T||[]).map(t=>({key:'t'+t.id,id:t.id,source:'T',title:t.title,status:t.status,prio:t.prio||'P3',kategorie:t.kategorie||'sonstige',assignee:t.assignee||'',meta:Object.assign({},t.meta||{},t.due_date?{frist:t.due_date}:{})}));
}
function addTaskForm(){const inp='font:inherit;font-size:12px;padding:6px 9px;border:1px solid var(--c-slate-300);border-radius:var(--r-md);background:#fff';
  return '<form id="addtaskform" hidden>'+
    '<input id="nt-title" placeholder="Neue Aufgabe…" required style="flex:1;min-width:220px;'+inp+'">'+
    '<select id="nt-kat" style="'+inp+'"><option value="intern">intern</option><option value="bauherr">Bauherr</option><option value="behoerde">Behörde</option><option value="nachhaken">Nachhaken</option><option value="technisch">technisch</option></select>'+
    '<select id="nt-prio" style="'+inp+'"><option>P1</option><option selected>P2</option><option>P3</option></select>'+
    '<input id="nt-assignee" placeholder="Verantwortlich" style="width:130px;'+inp+'">'+
    '<input id="nt-frist" type="date" title="Frist" style="'+inp+'">'+
    '<button class="btn-sm" type="submit" style="margin:0">Anlegen</button></form>';
}
async function createTask(){const title=el('nt-title').value.trim();if(!title)return;
  const{error}=await sb.from('tasks').insert({project_id:current,title,prio:el('nt-prio').value,kategorie:el('nt-kat').value,assignee:el('nt-assignee').value.trim()||null,due_date:el('nt-frist').value||null,status:'offen',meta:{source:'manuell'}});
  if(error){alert('Konnte Aufgabe nicht anlegen: '+error.message);return;}
  el('nt-title').value='';el('nt-assignee').value='';el('addtaskform').hidden=true;}
// ── Kommentar-Abschluss (item_feedback): generierte Einträge mit Begründung schließen — die Korrektur ist für die nächste Analyse verbindlich ──
function fbKey(type,title){return type+'|'+String(title||'').trim().toLowerCase();}
function fbUI(type,title,extra,label){const id=++fbUid;
  return{btn:'<button type="button" class="fb-open'+(label?' lbl':'')+'" data-fbopen="'+id+'" title="Mit Kommentar abschließen — der Punkt wird ausgeblendet und die nächste Analyse legt ihn nicht neu an">✕'+(label?' mit Kommentar abschließen':'')+'</button>',
  form:'<div class="fb-form" id="fbf-'+id+'" hidden><textarea rows="2" placeholder="Warum erledigt/hinfällig? Der Kommentar fließt als Korrektur in die nächste Analyse ein."></textarea><div class="fb-form-a"><button type="button" class="btn-sm" style="margin:0" data-fbsave="'+id+'" data-fbtype="'+esc(type)+'" data-fbtitle="'+glAttr(title)+'"'+(extra||'')+'>Abschließen</button><button type="button" class="btn-sm ghost" style="margin:0" data-fbcancel="'+id+'">Abbrechen</button></div></div>'};}
function fbDoneSec(items){if(!items.length)return '';
  return '<details class="fb-done"><summary class="fb-done-sum">✕ Mit Kommentar abgeschlossen <span class="done-cnt">'+items.length+'</span></summary><div class="fb-done-body">'+items.map(x=>'<div class="fb-done-row"><span class="fb-done-t">'+esc(x.title||'')+'</span><span class="fb-done-k">'+esc(x.kommentar||'—')+'</span></div>').join('')+'</div></details>';}
async function fbSave(btn){const f=el('fbf-'+btn.dataset.fbsave),ta=f?f.querySelector('textarea'):null,kom=ta?ta.value.trim():'';
  if(!kom){if(ta)ta.focus();return;}
  btn.disabled=true;btn.textContent='…';
  const{error}=await sb.from('item_feedback').insert({project_id:current,item_type:btn.dataset.fbtype,item_title:btn.dataset.fbtitle,feedback:'mit Kommentar abgeschlossen',kommentar:kom});
  if(error){btn.disabled=false;btn.textContent='Abschließen';alert('Konnte Feedback nicht speichern: '+error.message);return;}
  if(btn.dataset.fbtask)await sb.from('tasks').update({status:'erledigt',done_at:new Date().toISOString()}).eq('id',btn.dataset.fbtask);
  if(btn.dataset.fbcomm)await sb.from('communications').update({status:'erledigt'}).eq('id',btn.dataset.fbcomm);
  if(view==='project')render();}
// Aufgabe als Karte ins Kanban-Board legen (Board-Fusion): laeuft ueber die lotse-Aktion
// todo_aus_aufgabe — legt NIE einen Agenten-Lauf los (delegiert=false) und dedupliziert
// serverseitig (schon_da bei zweitem Klick, auch aus anderer Sitzung).
async function toBoard(b){if(b.disabled)return;b.disabled=true;const o=b.textContent;b.textContent='…';
  try{const j=await window.lotse('todo_aus_aufgabe',{task_id:b.dataset.toboard});
    if(j&&j.ok){b.textContent=j.schon_da?'✓ Schon im Board':'✓ Im Board';}
    else{b.disabled=false;b.textContent=o;alert('Ins Board legen fehlgeschlagen: '+((j&&(j.fehler||j.error))||'unbekannt'));}
  }catch(e2){b.disabled=false;b.textContent=o;alert('Ins Board legen fehlgeschlagen: '+e2.message);}}
document.addEventListener('click',function(e){
  var tb=e.target.closest&&e.target.closest('[data-toboard]');if(tb){e.preventDefault();e.stopPropagation();toBoard(tb);return;}
  var o=e.target.closest&&e.target.closest('[data-fbopen]');if(o){e.preventDefault();e.stopPropagation();const f=el('fbf-'+o.dataset.fbopen);if(f){f.hidden=!f.hidden;const ta=f.querySelector('textarea');if(!f.hidden&&ta)ta.focus();}return;}
  var c=e.target.closest&&e.target.closest('[data-fbcancel]');if(c){e.preventDefault();const f=el('fbf-'+c.dataset.fbcancel);if(f)f.hidden=true;return;}
  var s=e.target.closest&&e.target.closest('[data-fbsave]');if(s){e.preventDefault();fbSave(s);}});
function taskCard(t){const done=t.status==='erledigt',pn=prioN(t.prio),m=t.meta||{},mail=m.email_entwurf;
  const chk=t.source==='D'?('data-key="'+t.key+'"'):('data-task="'+t.id+'"');
  const fb=t.id?fbUI('task',t.title,' data-fbtask="'+t.id+'"',1):null;
  return '<article class="task-card'+(done?' done':'')+'" data-category="'+slug(t.kategorie||'sonstige')+'" data-priority="'+pn+'"><div class="task-head"><input type="checkbox" class="tcheck" '+chk+(done?' checked':'')+'><div><div class="task-title">'+esc(t.title)+'</div><div class="task-meta-row">'+(t.kategorie?'<span class="task-chip">'+esc(t.kategorie)+'</span>':'')+(m.quelle?'<span>Quelle: '+esc(m.quelle)+'</span>':'')+(m.frist?'<span class="mono">Frist '+esc(fmtFrist(m.frist))+'</span>':'')+'</div></div><span class="task-prio p'+pn+'">'+(t.prio||'P3')+'</span>'+chevT()+'</div><div class="task-body">'+
    (m.problem?'<div class="task-section"><h4>Problem</h4><div class="task-context-box">'+esc(m.problem)+'</div></div>':'')+
    (m.zu_tun?'<div class="task-section"><h4>Zu tun</h4><div class="task-context-box" style="background:var(--c-slate-50);border-color:var(--c-slate-200)">'+esc(m.zu_tun)+'</div></div>':'')+
    (mail?'<div class="task-section"><h4>E-Mail-Entwurf</h4><div class="task-context-box">Betreff: '+esc(mail.betreff||'')+'\n\n'+esc(mail.text||'')+'</div><button class="btn-sm" data-mail="'+t.id+'">→ Outlook-Entwurf anlegen</button></div>':'')+
    '<div class="task-resp"><strong>Verantwortlich:</strong> '+esc(t.assignee||'—')+((m.kontakt&&m.kontakt.email)?' · '+esc(m.kontakt.name||'')+' ('+esc(m.kontakt.email)+')':'')+(m.source==='manuell'?' · <span style="color:var(--c-slate-400)">manuell</span>':'')+'</div>'+
    (t.id?'<button class="btn-sm ghost" data-toboard="'+t.id+'" style="margin-top:10px" title="Als Karte ins Kanban-Board legen — ohne Delegation, der Agent startet nicht">→ Ins Board</button>':'')+
    (m.source==='manuell'?'<button class="btn-sm ghost" data-deltask="'+t.id+'" style="margin-top:10px">Löschen</button>':'')+
    (fb?'<div style="margin-top:10px">'+fb.btn+'</div>'+fb.form:'')+'</div></article>';
}
function renderTasks(list){
  const open=list.filter(t=>t.status!=='erledigt').sort((a,b)=>prioN(a.prio)-prioN(b.prio));
  const done=list.filter(t=>t.status==='erledigt');
  let h=open.length?open.map(taskCard).join(''):'<div class="empty">Keine offenen Aufgaben — alles erledigt oder noch nichts angelegt.</div>';
  if(done.length)h+='<details class="done-sec"><summary class="done-sum"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg> Erledigt <span class="done-cnt">'+done.length+'</span><span style="flex:1"></span><span class="mono" style="font-size:10px;color:var(--c-slate-400)">auf-/zuklappen</span></summary><div class="done-body">'+done.map(taskCard).join('')+'</div></details>';
  return h;}
function taskNeedsMail(t){const m=t.meta||{},k=(t.kategorie||'').toLowerCase();return !!(m.email_entwurf||k==='nachhaken'||k==='bauherr'||k==='behoerde'||(m.kontakt&&m.kontakt.email));}
function composeMail(t){const m=t.meta||{};
  const recName=(m.kontakt&&m.kontakt.name)||t.assignee||m.an||'';
  const recMail=(m.kontakt&&m.kontakt.email)||(recName&&peopleMail[String(recName).toLowerCase().trim()])||'';
  const proj=short(currentName||'');
  const L=['Sehr geehrte Damen und Herren,','','im Projekt „'+proj+'" ist folgender Punkt offen'+(m.quelle?' ('+m.quelle+')':'')+':','',(m.problem||t.title)];
  if(m.zu_tun)L.push('','konkret bitte ich Sie um Folgendes: '+m.zu_tun);
  if(m.frist)L.push('','Über eine Rückmeldung bis zum '+fmtFrist(m.frist)+' würde ich mich freuen.');
  L.push('','Vielen Dank vorab und freundliche Grüße');
  return {an:recName,email:recMail,betreff:'['+proj+'] '+t.title,text:L.join('\n'),generated:true};}
function taskRow(t){const pn=prioN(t.prio),m=t.meta||{},id=t.id||t.key,sel=(id===selTask);
  return '<div class="task-row'+(sel?' sel':'')+(t.status==='erledigt'?' done':'')+'" data-trow="'+id+'" data-category="'+slug(t.kategorie||'sonstige')+'" data-priority="'+pn+'"><input type="checkbox" class="tcheck" '+(t.source==='D'?'data-key="'+t.key+'"':'data-task="'+t.id+'"')+(t.status==='erledigt'?' checked':'')+'><span class="task-prio p'+pn+'">'+(t.prio||'P3')+'</span><div class="tr-main"><div class="tr-title">'+esc(t.title)+'</div><div class="tr-meta">'+(t.kategorie?esc(t.kategorie):'')+(m.frist?' · Frist '+esc(fmtFrist(m.frist)):'')+(t.assignee?' · '+esc(t.assignee):'')+'</div></div>'+(m.gegencheck?'<span class="tr-warn" title="Evtl. bereits vorhanden: '+esc(m.gegencheck.datei||'')+'">⚠</span>':taskNeedsMail(t)?'<span class="tr-mail" title="E-Mail vorformuliert">✉</span>':'')+'</div>';}
function taskEditForm(t){const m=t.meta||{};const inp='font:inherit;font-size:12px;padding:5px 8px;border:1px solid var(--c-slate-300);border-radius:var(--r-sm);background:#fff';
  const pr=t.prio||'P3',as=t.assignee||'',fr=(m.frist||'');const opt=p=>'<option'+(pr===p?' selected':'')+'>'+p+'</option>';
  return '<div class="det-editform" id="ef'+t.id+'" hidden><div class="ef-row"><label>Priorität</label><select id="efp'+t.id+'" style="'+inp+'">'+opt('P1')+opt('P2')+opt('P3')+'</select></div><div class="ef-row"><label>Verantwortlich</label><input id="efa'+t.id+'" value="'+esc(as)+'" placeholder="Name/Stelle" style="flex:1;'+inp+'"></div><div class="ef-row"><label>Frist</label><input id="eff'+t.id+'" type="date" value="'+esc(fr)+'" style="'+inp+'"></div><div class="ef-actions"><button class="btn-sm" data-savetask="'+t.id+'">Speichern</button><button class="btn-sm ghost" data-canceledit="'+t.id+'">Abbrechen</button></div><div class="ef-hint">Geänderte Felder bleiben bei der nächsten Re-Analyse erhalten (🔒).</div></div>';}
function renderTaskDetail(t){if(!t)return '<div class="empty" style="padding:34px">← Aufgabe links wählen</div>';
  const pn=prioN(t.prio),m=t.meta||{},done=t.status==='erledigt';
  const mail=m.gegencheck?null:(m.email_entwurf||(taskNeedsMail(t)?composeMail(t):null));
  const locked=m.locked||[];const lk=f=>locked.indexOf(f)>=0?' <span class="lockico" title="manuell gesetzt — bleibt bei Re-Analyse erhalten">🔒</span>':'';
  let h='<div class="det-head"><span class="task-prio p'+pn+'">'+(t.prio||'P3')+'</span><h3 class="det-title">'+esc(t.title)+'</h3>'+(t.id?'<button class="det-edit" data-edit="'+t.id+'" title="Aufgabe bearbeiten">✎</button>':'')+'</div>';
  h+='<div class="det-meta">'+(t.kategorie?'<span class="task-chip">'+esc(t.kategorie)+'</span>':'')+(t.assignee?'<span><strong>Verantw.:</strong> '+esc(t.assignee)+lk('assignee')+'</span>':'')+(m.frist?'<span class="mono">Frist '+esc(fmtFrist(m.frist))+lk('due_date')+'</span>':'')+(locked.indexOf('prio')>=0?'<span class="mono">Prio '+esc(t.prio||'P3')+lk('prio')+'</span>':'')+(m.quelle?'<span>Quelle: '+esc(m.quelle)+'</span>':'')+'</div>';
  if(m.gegencheck)h+='<div class="det-warn">⚠ <strong>Vermutlich bereits vorhanden:</strong> '+esc(m.gegencheck.dok)+' liegt in den Projektunterlagen (Datei: <span class="mono">'+esc(m.gegencheck.datei)+'</span>). Bitte zuerst diese Datei prüfen, bevor etwas angefordert oder beauftragt wird — die automatische E-Mail wurde deshalb zurückgehalten.</div>';
  if(t.id)h+=taskEditForm(t);
  if(m.problem)h+='<div class="det-sec"><h4>Problem</h4><p>'+esc(m.problem)+'</p></div>';
  if(m.zu_tun)h+='<div class="det-sec"><h4>Zu tun</h4><p>'+esc(m.zu_tun)+'</p></div>';
  if(mail&&t.id)h+='<div class="det-sec"><h4>E-Mail-Entwurf'+(mail.an?' · an '+esc(mail.an):'')+'</h4>'+(mail.generated?'<div class="mail-gen">Automatisch aus Problem &amp; nächstem Schritt vorformuliert — vor dem Senden bitte prüfen.</div>':'')+'<div class="mail-box">'+((mail.an||mail.email)?'<div class="mail-line"><span>An:</span> '+esc(mail.an||'')+(mail.email?' &lt;'+esc(mail.email)+'&gt;':' <em class="mail-noaddr">(Adresse prüfen)</em>')+'</div>':'')+'<div class="mail-line"><span>Betreff:</span> '+esc(mail.betreff||'')+'</div><div class="mail-body">'+esc(mail.text||'')+'</div></div><div class="mail-actions"><button class="btn-sm ghost" data-mailcopy="'+t.id+'">Text kopieren</button><button class="btn-sm" data-mail="'+t.id+'">✉ In Outlook öffnen</button></div><div class="mail-hint">Öffnet eine neue Mail in <em>deinem</em> Outlook — der Text oben, deine eigene Signatur fügt Outlook automatisch darunter ein.</div></div>';
  const fb=t.id?fbUI('task',t.title,' data-fbtask="'+t.id+'"',1):null;
  h+='<div class="det-actions"><button class="btn-sm'+(done?' ghost':'')+'" data-done="'+(t.id||t.key)+'">'+(done?'↺ Wieder öffnen':'✓ Erledigt')+'</button>'+(t.id?'<button class="btn-sm ghost" data-toboard="'+t.id+'" title="Als Karte ins Kanban-Board legen — ohne Delegation, der Agent startet nicht">→ Ins Board</button>':'')+(fb?fb.btn:'')+(m.source==='manuell'?'<button class="btn-sm ghost" data-deltask="'+t.id+'">Löschen</button>':'')+'</div>'+(fb?fb.form:'');
  return h;}
function renderAufgSplit(list){
  const zu=list.filter(t=>fbClosed[fbKey('task',t.title)]);list=list.filter(t=>!fbClosed[fbKey('task',t.title)]);
  taskMap={};list.forEach(t=>{taskMap[t.id||t.key]=t;});
  const open=list.filter(t=>t.status!=='erledigt').sort((a,b)=>prioN(a.prio)-prioN(b.prio));
  const done=list.filter(t=>t.status==='erledigt');
  if(!selTask||!taskMap[selTask])selTask=open[0]?(open[0].id||open[0].key):(list[0]?(list[0].id||list[0].key):null);
  let listH=open.length?open.map(taskRow).join(''):'<div class="empty" style="padding:18px">Keine offenen Aufgaben.</div>';
  if(done.length)listH+='<details class="done-sec"><summary class="done-sum"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg> Erledigt <span class="done-cnt">'+done.length+'</span></summary><div class="done-body">'+done.map(taskRow).join('')+'</div></details>';
  listH+=fbDoneSec(zu.map(t=>({title:t.title,kommentar:(fbClosed[fbKey('task',t.title)]||{}).kommentar})));
  return '<div class="aufg-split"><div class="aufg-list">'+listH+'</div><div class="aufg-detail" id="aufgdetail">'+renderTaskDetail(taskMap[selTask])+'</div></div>';}
function wireDetail(){const d=el('aufgdetail');if(!d)return;
  d.querySelectorAll('button[data-mail]').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.mail,t=taskMap[id];if(!t)return;const m=t.meta||{};const mail=m.email_entwurf||composeMail(t);openMailto(mail);});
  d.querySelectorAll('button[data-mailcopy]').forEach(b=>b.onclick=e=>{e.stopPropagation();const t=taskMap[b.dataset.mailcopy];if(!t)return;const m=t.meta||{},mail=m.email_entwurf||composeMail(t);const txt='An: '+(mail.an||'')+(mail.email?' <'+mail.email+'>':'')+'\nBetreff: '+(mail.betreff||'')+'\n\n'+(mail.text||'');const done=()=>{const o=b.textContent;b.textContent='✓ kopiert';setTimeout(()=>b.textContent=o,1500);};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done,()=>done());}else{const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(_){}ta.remove();done();}});
  d.querySelectorAll('button[data-done]').forEach(b=>b.onclick=()=>toggleDoneBtn(b.dataset.done));
  d.querySelectorAll('button[data-edit]').forEach(b=>b.onclick=()=>{const f=el('ef'+b.dataset.edit);if(f)f.hidden=!f.hidden;});
  d.querySelectorAll('button[data-canceledit]').forEach(b=>b.onclick=()=>{const f=el('ef'+b.dataset.canceledit);if(f)f.hidden=true;});
  d.querySelectorAll('button[data-savetask]').forEach(b=>b.onclick=async()=>{const id=b.dataset.savetask,t=taskMap[id];if(!t)return;const m=t.meta||{};
    const np=el('efp'+id).value,na=el('efa'+id).value.trim(),nf=el('eff'+id).value||null;
    const op=t.prio||'P3',oa=t.assignee||'',of=(m.frist||null);
    const ls=new Set(m.locked||[]);if(np!==op)ls.add('prio');if(na!==oa)ls.add('assignee');if((nf||null)!==(of||null))ls.add('due_date');
    const base=Object.assign({},m);delete base.frist;base.locked=[...ls];
    b.disabled=true;b.textContent='…';const{error}=await sb.from('tasks').update({prio:np,assignee:na||null,due_date:nf,meta:base}).eq('id',id);
    if(error){b.disabled=false;b.textContent='Speichern';alert('Speichern fehlgeschlagen: '+error.message);}});
  d.querySelectorAll('button[data-deltask]').forEach(b=>b.onclick=async()=>{if(confirm('Aufgabe löschen?')){const{error}=await sb.from('tasks').delete().eq('id',b.dataset.deltask);if(error)alert('Fehler: '+error.message);}});}
async function toggleDoneBtn(id){const t=taskMap[id];if(!t||!t.id)return;const nd=t.status!=='erledigt';const{error}=await sb.from('tasks').update({status:nd?'erledigt':'offen',done_at:nd?new Date().toISOString():null}).eq('id',t.id);if(error)alert('Fehler: '+error.message);}
function fmtFrist(d){if(!d)return '—';const m=String(d).match(/(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+'.'+m[2]+'.'+m[1]:String(d);}
function copyToClip(txt,b){const ok=()=>{const o=b.textContent;b.textContent='✓ kopiert';setTimeout(()=>{b.textContent=o;},1500);};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(ok,ok);}else{const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(_){}ta.remove();ok();}}
// E-Mail im EIGENEN Outlook des Nutzers oeffnen (mailto): generierter Text oben, die persoenliche
// Outlook-Signatur (Name/Firma/Logo) fuegt Outlook automatisch darunter ein -> jeder bekommt seine eigene.
function openMailto(mail){const body=(mail.text||'').replace(/\r?\n/g,'\r\n');window.location.href='mailto:'+(mail.email||'')+'?subject='+encodeURIComponent(mail.betreff||'')+'&body='+encodeURIComponent(body);}
function jfBriefingText(){const D=lastD||{};const vs=D.vorausschau||{};const jf=vs.jour_fixe||{};
  const L=['Jour-Fixe-Vorbereitung · '+short(currentName||'')+(jf.datum?' · '+fmtFrist(jf.datum):''),''];
  if(jf.punkte&&jf.punkte.length){L.push('AGENDA / OFFENE PUNKTE:');jf.punkte.forEach(p=>L.push('• '+p));L.push('');}
  const eo=D.entscheidungen_offen||[];if(eo.length){L.push('ZU ENTSCHEIDEN:');eo.forEach(e=>L.push('• '+(e.thema||'')+(e.wer?' ('+e.wer+')':'')+(e.bis?' — bis '+fmtFrist(e.bis):'')));L.push('');}
  const zp=(vs.zwangspunkte||[]).filter(z=>z.status==='danger');if(zp.length){L.push('KRITISCH (Termin/Frist):');zp.forEach(z=>L.push('• '+(z.name||'')+(z.frist?' — Frist '+fmtFrist(z.frist):'')));L.push('');}
  const wk=(vs.diese_woche||[]).filter(w=>w.dringlichkeit==='jetzt');if(wk.length){L.push('DIESE WOCHE:');wk.forEach(w=>L.push('• '+(w.titel||'')+(w.frist?' — '+fmtFrist(w.frist):'')));L.push('');}
  return L.join('\n').trim();}
function icoClock(){return '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';}
function icoCheck(){return '<svg class="ico" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>';}
function icoLink(){return '<svg class="ico" viewBox="0 0 24 24"><path d="M9 15l6-6M10 6l1-1a4 4 0 015 5l-1 1M14 18l-1 1a4 4 0 01-5-5l1-1"/></svg>';}
function icoFire(){return '<svg class="ico" viewBox="0 0 24 24"><path d="M12 3c1 3 4 4 4 8a4 4 0 01-8 0c0-2 1-3 2-4 0 2 2 2 2 0 0-2-2-2-2-4z"/></svg>';}
function renderAgentPanel(viewId,D,ex){
  const cfg=AGENT_VIEWS.find(v=>v.id===viewId);
  if(!cfg){pview='dashboard';renderProject();return;}
  const hasD=D&&Object.keys(D).length;
  const side=(viewId==='angebote'?'<button class="av-run" data-agent="angebote-check">▶ Angebote prüfen</button> ':'')+(viewId==='termine'?'<button class="av-run" data-agent="termin-check">▶ Zeitpläne abgleichen</button> ':'')+'<button class="av-run" data-agent="dashboard-analyse">▶ Aktualisieren</button><div class="av-lastrun">'+(hasD?'Stand <strong>'+fmtD(lastStand||today())+'</strong>':'noch nicht analysiert')+'</div>';
  const body=hasD?panelBody(viewId,D,ex):panelCTA();
  el('main').innerHTML='<section class="av-panel active"><div class="av-hero"><div class="av-hero-ico">'+navIco(cfg.ico)+'</div><div><div class="av-hero-kicker">'+esc(cfg.kicker)+'</div><div class="av-hero-title">'+esc(cfg.title)+'</div><div class="av-hero-desc">'+esc(cfg.desc)+'</div></div><div class="av-hero-side">'+side+'</div></div>'+body+'</section>';
  el('main').querySelectorAll('button[data-agent]').forEach(b=>b.onclick=()=>queueAgent(b.dataset.agent,{},b));
  const dq=el('docq'),dg=el('docgo');if(dg)dg.onclick=docSearch;if(dq)dq.onkeydown=e=>{if(e.key==='Enter')docSearch();};
  const tc=el('toC');if(tc)tc.onclick=()=>go('cockpit');
}
function panelCTA(){return '<div class="cta" style="margin-top:18px"><p>Dieser Agent füllt sich aus der <strong>Dashboard-Analyse</strong>. Sie ist für dieses Projekt noch nicht gelaufen.</p><button class="btn-sm" data-agent="dashboard-analyse">Analyse starten</button></div>';}
function dcCls(s){return s==='vollstaendig'?'ok':s==='teilweise'?'warn':s==='fehlend'?'bad':'off';}
function renderDokuCheck(dc){
  if(!dc||!dc.phasen||!dc.phasen.length)return null;
  const phasen=dc.phasen.slice().sort((a,b)=>(a.lph||0)-(b.lph||0));
  let h='<div class="dc-strip">'+phasen.map(p=>'<div class="dc-chip '+dcCls(p.status)+'" title="LPH '+p.lph+' · '+esc(stL(p.status||''))+'">'+p.lph+'</div>').join('')+'</div>';
  h+='<div class="dc-list">'+phasen.map(p=>{
    const gl=p.grundleistungen||[],vorh=gl.filter(g=>g.status==='vorhanden').length,cls=dcCls(p.status);
    const open=(p.status==='teilweise'||p.status==='fehlend')?' open':'';
    return '<details class="dc-ph '+cls+'"'+open+'><summary class="dc-sum"><span class="dc-lph">LPH '+p.lph+'</span><span class="dc-name">'+esc(p.titel||'')+'</span><span class="dc-badge '+cls+'">'+esc(stL(p.status||''))+'</span>'+(gl.length?'<span class="dc-counts">'+vorh+'/'+gl.length+' da</span>':'')+'</summary><div class="dc-body">'+
      (gl.length?gl.map(g=>{const ic=g.status==='vorhanden'?'ok':g.status==='teilweise'?'warn':'bad',sym=g.status==='vorhanden'?'✓':g.status==='teilweise'?'~':'✗';return '<div class="dc-gl"><span class="dc-ic '+ic+'">'+sym+'</span><span class="dc-soll">'+esc(g.soll||'')+'</span>'+(g.beleg?'<span class="dc-beleg" title="'+esc(g.beleg)+'">'+esc(g.beleg)+'</span>':'<span class="dc-beleg fehlt">— fehlt —</span>')+'</div>';}).join(''):'<div class="empty" style="padding:6px">—</div>')+
      ((p.luecken&&p.luecken.length)?'<div class="dc-luecken"><div class="dc-luecken-h">Fehlende Zusammenhänge</div>'+p.luecken.map(l=>'<div class="dc-luecke">'+esc(l)+'</div>').join('')+'</div>':'')+
      '</div></details>';
  }).join('')+'</div>';
  return h;
}
// ---- Termin-Agent: Soll-Ist-Abgleich der LPH-Zeitplaene gegen Vertrag + tatsaechlichen Stand ----
const TC_LBL={ok:'im Plan',kritisch:'wird kritisch',verzug:'Verzug',unklar:'unklar','im-plan':'Plan deckt sich mit Ist',abweichung:'Plan weicht vom Ist ab',abgeschlossen:'abgeschlossen',laufend:'läuft',geplant:'geplant',eingehalten:'eingehalten',offen:'offen',ueberschritten:'überschritten',rahmen:'Rahmenterminplan',planung:'Planungsterminplan',bauzeit:'Bauzeitenplan',vergabe:'Vergabeterminplan',sonstig:'Zeitplan'};
const tcL=s=>TC_LBL[s]||s||'';
const tcCls=p=>p==='ok'?'ok':p==='kritisch'?'warn':p==='verzug'?'bad':'off';
// Zeitbalken: eine Gantt-Leiste je LPH auf gemeinsamer Zeitachse, Heute-Marker, Farbe = Prognose.
// soll_start kann fehlen (aeltere Laeufe): dann Kette ueber das Ende der Vorphase, erste Phase als
// Fade-in-Balken (Klasse 'est' = Beginn unbekannt).
function renderTerminBalken(ph){
  const pd=s=>{const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?Date.parse(m[0]):null;};
  const rows=[];let prevEnd=null;
  for(const p of ph){
    const end=pd(p.soll_ende);let start=pd(p.soll_start),est=false;
    if(!end&&!start)continue;
    if(!start){start=prevEnd;est=true;}
    if(end)prevEnd=end;
    rows.push({p,start,end:end||start,est});
  }
  if(rows.length<2)return '';
  const today=Date.now(),W=864e5*7;
  let min=today,max=today;
  for(const r of rows){if(r.start)min=Math.min(min,r.start);if(r.end)max=Math.max(max,r.end);}
  const span0=Math.max(max-min,W*8);
  for(const r of rows)if(!r.start){r.start=r.end-span0*.14;r.est=true;}
  min=Math.min(min,...rows.map(r=>r.start));
  const pad=(max-min)*.03+W;min-=pad;max+=pad;
  const span=max-min,x=t=>Math.max(0,Math.min(100,(t-min)/span*100));
  let h='<div class="tb"><div class="tb-grid">';
  for(const r of rows){
    const p=r.p,done=p.status==='abgeschlossen',cls=(done?'done':tcCls(p.prognose))+(r.est?' est':'');
    const l=x(r.start),w=Math.max(.6,x(r.end)-l);
    const tip='LPH '+p.lph+' '+(p.titel||'')+(p.soll_start?' · ab '+fmtFrist(p.soll_start):'')+(p.soll_ende?' · fertig bis '+fmtFrist(p.soll_ende):'')+' · '+(done?'abgeschlossen':tcL(p.prognose||'unklar'))+(p.abweichung_wochen?' ('+(p.abweichung_wochen>0?'+':'')+p.abweichung_wochen+' Wo)':'');
    const endLbl=p.soll_ende?'<span class="tb-end" style="'+(l+w>84?'right:'+(100-l)+'%;padding-right:6px':'left:'+(l+w)+'%;padding-left:6px')+'">'+fmtFrist(p.soll_ende)+'</span>':'';
    h+='<div class="tb-row"><span class="tb-lbl" title="'+esc(p.titel||'')+'">LPH '+p.lph+'</span><div class="tb-track"><div class="tb-bar '+cls+'" style="left:'+l+'%;width:'+w+'%" title="'+esc(tip)+'"></div>'+endLbl+'</div></div>';
  }
  const tx=x(today);
  h+='<div class="tb-today" style="left:calc(70px + (100% - 70px)*'+(tx/100).toFixed(4)+')"></div><div class="tb-today-l" style="left:calc(70px + (100% - 70px)*'+(tx/100).toFixed(4)+')">heute</div>';
  h+='</div><div class="tb-axis">';
  for(let y=new Date(min).getFullYear()+1;y<=new Date(max).getFullYear();y++){const t=Date.parse(y+'-01-01');if(t>min&&t<max)h+='<div class="tb-tick" style="left:'+x(t)+'%">'+y+'</div>';}
  h+='</div><div class="tb-legend"><span><span class="tb-dot" style="background:var(--c-slate-400)"></span>abgeschlossen</span><span><span class="tb-dot" style="background:var(--c-success)"></span>im Plan</span><span><span class="tb-dot" style="background:var(--c-warning)"></span>wird kritisch</span><span><span class="tb-dot" style="background:var(--c-danger)"></span>Verzug</span><span><span class="tb-dot" style="background:linear-gradient(90deg,rgba(169,169,163,0),var(--c-slate-400))"></span>Beginn geschätzt</span></div></div>';
  return h;
}
function renderTerminCheck(ex){
  const tc=ex.terminCheck;
  if(!tc)return '<div class="cta" style="margin:14px 0"><p>Der <strong>Termin-Agent</strong> liest die Zeitpläne aus dem Termine-Ordner (Rahmen-/Planungs-/Bauzeiten-/Vergabeterminplan), zieht die Fristen aus dem <strong>Vertrag</strong> und gleicht beides mit dem <strong>tatsächlichen Projektstand</strong> ab: Was muss noch erledigt werden, bis die Leistungsphase fertig ist? Wann muss sie fertig sein? Schaffen wir das — oder wird es kritisch? Noch nicht gelaufen.</p><button class="btn-sm" data-agent="termin-check">Zeitpläne abgleichen</button></div>';
  const ph=(tc.phasen||[]).slice().sort((a,b)=>(a.lph||0)-(b.lph||0)),zp=tc.zeitplaene||[],vt=tc.vertragstermine||[];
  const krit=ph.filter(p=>p.prognose==='kritisch').length,verz=ph.filter(p=>p.prognose==='verzug').length;
  let h='<div class="av-secrow">Soll-Ist-Abgleich · Zeitpläne vs. Vertrag vs. tatsächlicher Stand'+(ex.terminStand?' · Stand '+fmtD(ex.terminStand):'')+'</div>';
  if(tc.hinweis)h+='<div class="vf-banner"><span class="vf-tag">Termine</span>'+esc(tc.hinweis)+'</div>';
  h+=ovHero([ovK('',ph.length,'Phasen abgeglichen'),verz?ovK('bad',verz,'in Verzug'):null,ovK(krit?'warn':'ok',krit,'kritisch'),zp.length?ovK('',zp.length,'Zeitpläne gelesen'):null]);
  if(ph.length){
    h+=renderTerminBalken(ph);
    h+='<div class="dc-list">'+ph.map(p=>{
      const done=p.status==='abgeschlossen',cls=done?'ok':tcCls(p.prognose),rp=p.restpunkte||[];
      const open=!done&&(p.status==='laufend'||p.prognose==='kritisch'||p.prognose==='verzug')?' open':'';
      let sum='<span class="dc-lph">LPH '+p.lph+'</span><span class="dc-name">'+esc(p.titel||'')+'</span><span class="dc-badge '+cls+'">'+esc(done?'abgeschlossen':tcL(p.prognose||'unklar'))+'</span>';
      if(p.soll_ende)sum+='<span class="dc-counts">fertig bis '+fmtFrist(p.soll_ende)+(p.abweichung_wochen?' · '+(p.abweichung_wochen>0?'+':'')+p.abweichung_wochen+' Wo':'')+'</span>';
      let bd='';
      if(p.ist_hinweis)bd+='<div class="av-act-c" style="margin-bottom:6px"><strong>Ist-Stand:</strong> '+esc(p.ist_hinweis)+'</div>';
      if(p.abgleich&&p.abgleich!=='unklar')bd+='<div class="av-act-c" style="margin-bottom:6px"><strong>Gantt vs. Wirklichkeit:</strong> '+esc(tcL(p.abgleich))+(p.soll_quelle?' · Soll aus '+esc(p.soll_quelle):'')+'</div>';
      if(p.begruendung)bd+='<div class="av-act-c" style="margin-bottom:8px"><strong>Prognose:</strong> '+esc(p.begruendung)+'</div>';
      if(rp.length)bd+='<div class="dc-luecken-h" style="margin-top:4px">Noch zu erledigen bis Phasen-Abschluss · '+rp.length+'</div>'+rp.map(r=>'<div class="dc-gl"><span class="dc-ic warn">→</span><span class="dc-soll">'+esc(r.was||'')+(r.wer?' <span style="color:var(--c-slate-500)">('+esc(r.wer)+')</span>':'')+'</span>'+(r.frist?'<span class="dc-beleg">bis '+fmtFrist(r.frist)+'</span>':(r.quelle?'<span class="dc-beleg" title="'+esc(r.quelle)+'">'+esc(r.quelle)+'</span>':''))+'</div>').join('');
      if(!bd)bd='<div class="empty" style="padding:6px">Keine Details erfasst.</div>';
      return '<details class="dc-ph '+cls+'"'+open+'><summary class="dc-sum">'+sum+'</summary><div class="dc-body">'+bd+'</div></details>';
    }).join('')+'</div>';
  }
  if(zp.length){h+='<div class="av-secrow" style="margin-top:18px">Maßgebliche Zeitpläne · '+zp.length+'</div><table class="av-table"><tr><th>Plan</th><th>Stand</th><th>Kernaussage</th><th>Datei</th></tr>'+zp.map(z=>'<tr><td>'+esc(tcL(z.typ||'sonstig'))+'</td><td>'+fmtFrist(z.stand)+'</td><td>'+esc(z.kernaussage||'')+(z.verschoben_hinweis?' <span class="stat warn">verschoben: '+esc(z.verschoben_hinweis)+'</span>':'')+'</td><td style="font-size:11px">'+esc(z.datei||'')+'</td></tr>').join('')+'</table>';}
  if(vt.length){h+='<div class="av-secrow" style="margin-top:18px">Vertragliche Termine & Fristen · '+vt.length+'</div><table class="av-table"><tr><th>Termin</th><th>Frist</th><th>Status</th><th>Quelle</th></tr>'+vt.map(v=>'<tr><td>'+esc(v.name||'')+'</td><td>'+fmtFrist(v.frist)+'</td><td><span class="stat '+(v.status==='eingehalten'?'ok':v.status==='ueberschritten'?'alert':'warn')+'">'+esc(tcL(v.status||'unklar'))+'</span></td><td style="font-size:11px">'+esc(v.quelle||'')+'</td></tr>').join('')+'</table>';}
  return h;
}
function renderAngeboteCheck(ex){
  const ac=ex.angeboteCheck,ves=(ac&&ac.vergabeeinheiten)||[];
  if(!ves.length)return '<div class="cta" style="margin:14px 0"><p>Der <strong>Angebots-Agent</strong> lädt Angebots-Anhänge aus den Projekt-Mails herunter, bündelt sie je Vergabeeinheit (LV/Gewerk), vergleicht die Bieter und legt für fehlende Angebote Nachhak-Aufgaben mit fertigem Mail-Entwurf an.'+(ac?' Aktuell keine Vergabeeinheiten erkannt.':' Noch nicht gelaufen.')+'</p><button class="btn-sm" data-agent="angebote-check">Angebote prüfen</button></div>';
  let h='<div class="av-secrow">Angebotsvergleich je Vergabeeinheit · '+ves.length+(ex.angeboteStand?' · Stand '+fmtD(ex.angeboteStand):'')+'</div>';
  if(ac.hinweis)h+='<div class="vf-banner"><span class="vf-tag">Vergabe</span>'+esc(ac.hinweis)+'</div>';
  for(const ve of ves){
    const ang=ve.angebote||[],feh=ve.fehlend||[],vg=ve.vergleich||{},st=ve.status||'laeuft';
    h+='<div class="av-card" style="margin-bottom:14px">';
    h+='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px"><strong>'+esc(ve.titel||'Vergabeeinheit')+'</strong><span class="av-tag '+slug(st)+'">'+esc(stL(st))+'</span>'+(ve.submission?'<span class="page-sub">Submission '+fmtFrist(ve.submission)+'</span>':'')+(feh.length?'<span class="stat alert">'+feh.length+' Angebot'+(feh.length>1?'e':'')+' ausstehend</span>':(st==='laeuft'&&ang.length?'<span class="stat">vollzählig</span>':''))+'</div>';
    if(ang.length){h+='<table class="av-table"><tr><th>Bieter</th><th style="text-align:right">netto</th><th style="text-align:right">brutto</th><th>Datum</th><th>Status</th><th>Datei / Hinweis</th></tr>'+ang.map(x=>{const best=vg.guenstigster&&x.firma===vg.guenstigster;return '<tr><td>'+(best?'<strong>★ ':'')+esc(x.firma||'')+(best?'</strong>':'')+'</td><td class="num">'+(x.betrag_netto!=null?Number(x.betrag_netto).toLocaleString('de-DE')+' €':'—')+'</td><td class="num">'+(x.betrag_brutto!=null?Number(x.betrag_brutto).toLocaleString('de-DE')+' €':'—')+'</td><td>'+fmtFrist(x.datum)+'</td><td><span class="av-tag '+slug(x.status||'eingegangen')+'">'+esc(stL(x.status||'eingegangen'))+'</span></td><td style="font-size:11px">'+esc(x.datei||'')+(x.hinweis?(x.datei?' · ':'')+esc(x.hinweis):'')+'</td></tr>';}).join('')+'</table>';}
    else h+='<div class="empty">Noch kein Angebot eingegangen.</div>';
    if(feh.length)h+=feh.map(f=>'<div class="av-act"><div class="av-act-date">'+(f.tage_offen!=null?f.tage_offen+' Tg. offen':'—')+'</div><div><div class="av-act-t">Fehlt: '+esc(f.firma||'')+(f.angefragt_am?' — angefragt am '+fmtFrist(f.angefragt_am):'')+'</div><div class="av-act-c">Nachhak-Aufgabe mit Mail-Entwurf liegt in den Aufgaben.</div></div></div>').join('');
    if(vg.bewertung)h+='<div class="av-act-c" style="margin-top:8px">'+esc(vg.bewertung)+(vg.spanne_pct!=null?' (Preisspanne '+esc(String(vg.spanne_pct))+' %)':'')+'</div>';
    h+='</div>';
  }
  return h;
}
function panelBody(id,D,ex){
  if(id==='aktivitaet'){const a=(D.aktivitaet&&D.aktivitaet.length)?D.aktivitaet:null;
    if(a)return '<div class="av-secrow">Chronologie · neueste zuerst · '+a.length+' Einträge</div>'+a.map(x=>'<div class="av-act"><div class="av-act-date">'+esc(fmtFrist(x.datum))+'</div><div><div class="av-act-t">'+esc(x.titel||'')+'</div>'+(x.kontext?'<div class="av-act-c">'+esc(x.kontext)+'</div>':'')+'</div></div>').join('');
    return '<div class="av-secrow">Zuletzt geänderte Dateien</div>'+(ex.recent.length?ex.recent.map(d=>'<div class="av-act"><div class="av-act-date">'+esc(fmtD(d.modified_at))+'</div><div><div class="av-act-t">'+esc(d.filename)+'</div><div class="av-act-c">'+esc(d.doctype||'')+'</div></div></div>').join(''):'<div class="empty">Keine Aktivität erfasst.</div>');
  }
  if(id==='fachplaner'){return renderFachplaner(D);}
  if(id==='angebote'){const a=(D.angebote&&D.angebote.length)?D.angebote:null;const vf=D.vergabe_fokus||null,lph=ex.lph||0;
    const hc=renderAngeboteCheck(ex);
    if(!a)return hc+'<div class="av-secrow">Gefundene Kosten-/Vergabe-Dokumente</div>'+(ex.costDocs.length?ex.costDocs.map(d=>'<div class="av-act"><div class="av-act-date">'+esc(fmtD(d.modified_at))+'</div><div class="av-act-t">'+esc(d.filename)+'</div></div>').join(''):'<div class="empty">Keine Angebote/Nachträge erfasst.</div>');
    const groups={'fachplaner-honorar':[],'bau-lv':[],'nachtrag':[],'sonstige':[]};
    a.forEach(x=>{const art=(x.art&&groups[x.art]!==undefined)?x.art:'sonstige';groups[art].push(x);});
    const labels={'fachplaner-honorar':'Fachplaner & Honorar (KG 700)','bau-lv':'Leistungsverzeichnisse & Bauangebote','nachtrag':'Nachträge & Mehrkosten','sonstige':'Sonstiges'};
    const schwerMap={'fachplaner':'fachplaner-honorar','lv':'bau-lv','nachtraege':'nachtrag'};
    const focusGrp=vf&&schwerMap[vf.schwerpunkt]?schwerMap[vf.schwerpunkt]:null;
    let h=hc;
    if(vf&&vf.hinweis)h+='<div class="vf-banner"><span class="vf-tag">Fokus LPH '+(lph||'?')+'</span>'+esc(vf.hinweis)+'</div>';
    const order=Object.keys(groups).sort((g1,g2)=>(g1===focusGrp?0:1)-(g2===focusGrp?0:1));
    for(const g of order){if(!groups[g].length)continue;const isF=g===focusGrp;
      h+='<div class="av-secrow'+(isF?' vf-focus':'')+'">'+esc(labels[g])+(isF?'<span class="vf-now">jetzt relevant</span>':'')+' · '+groups[g].length+'</div>';
      h+='<table class="av-table"><tr><th>Gegenstand</th><th>Bieter / Firma</th><th>KG</th><th>Status</th><th style="text-align:right">Betrag</th><th>Datum</th></tr>'+groups[g].map(x=>'<tr><td>'+esc(x.gegenstand||'')+'</td><td>'+esc(x.firma||'')+'</td><td class="mono" style="font-size:10.5px">'+(x.kg?'KG '+esc(''+x.kg):'—')+'</td><td><span class="av-tag '+slug(x.status||'offen')+'">'+esc(stL(x.status||'offen'))+'</span></td><td class="num">'+(x.betrag!=null?Number(x.betrag).toLocaleString('de-DE')+' €':'—')+'</td><td>'+esc(fmtFrist(x.datum))+'</td></tr>').join('')+'</table>';
    }
    return h;
  }
  if(id==='doku'){const docs=(D.dokumentationen&&D.dokumentationen.length)?D.dokumentationen:null;
    const dc=ex.dokuCheck,dcHtml=renderDokuCheck(dc);
    let h='<div class="av-secrow">Doku-Check · Vollständigkeit über alle LPH</div><div style="margin-bottom:14px"><button class="btn-sm" data-agent="doku-check">▶ Vollständigkeit prüfen (alle LPH)</button>'+(dc&&dc.stand?'<span class="page-sub" style="margin-left:10px">Stand '+esc(fmtFrist(dc.stand))+'</span>':'')+'</div>';
    h+=dcHtml||'<div class="cta" style="margin-bottom:16px"><p>Der <strong>Doku-Check</strong> scannt alle Leistungsphasen: was <em>vorhanden</em> ist, was <em>passt</em>, was <em>fehlt</em> und wo <em>Zusammenhänge fehlen</em>. Noch nicht geprüft.</p></div>';
    h+='<div class="av-secrow">Volltextsuche über alle Dokumente</div><div class="search-box"><input id="docq" placeholder="z. B. Brandschutz, Statik, Förderung …"><button id="docgo">Suchen</button></div><div id="sres"></div>';
    if(docs)h+='<div class="av-secrow">Wichtigste Dokumente · '+docs.length+'</div><div class="av-grid">'+docs.map(d=>'<div class="av-card"><div class="av-card-role">'+esc(d.kategorie||'Dokument')+'</div><div class="av-card-name" style="font-size:12px">'+esc(d.name||'')+'</div><div class="av-card-foot"><span>'+esc(fmtFrist(d.datum))+'</span></div></div>').join('')+'</div>';
    return h;
  }
  if(id==='historie'){const hh=(D.historie&&D.historie.length)?D.historie:((D.beschluesse||[]).map(b=>({datum:b.datum,ereignis:b.text})));
    if(!hh.length)return '<div class="empty">Keine Historie erfasst.</div>';
    return '<div class="av-secrow">Meilensteine · chronologisch · '+hh.length+'</div><div class="av-tl">'+hh.map(x=>'<div class="av-tl-item"><div class="av-tl-date">'+esc(fmtFrist(x.datum))+'</div><div class="av-tl-text">'+esc(x.ereignis||'')+'</div></div>').join('')+'</div>';
  }
  if(id==='termine'){const vs=D.vorausschau;
    let h=renderTerminCheck(ex);
    if(vs&&((vs.zwangspunkte||[]).length||(vs.diese_woche||[]).length))h+='<div class="av-secrow" style="margin-top:22px">Vorausschau · Zwangspunkte & Wochen-Fokus</div><div class="vs-inner" style="padding:6px 0 0">'+renderVorausschau(vs)+'</div>';
    return h||'<div class="empty">Keine Termine/Fristen analysiert.</div>';
  }
  return '<div class="empty">—</div>';
}
function renderVorausschauSection(D){
  const vs=D&&D.vorausschau?D.vorausschau:null;
  const has=vs&&((vs.zwangspunkte&&vs.zwangspunkte.length)||(vs.schnittstellen&&vs.schnittstellen.length)||(vs.diese_woche&&vs.diese_woche.length)||(vs.hotspots&&vs.hotspots.length)||(vs.phasen_reife&&vs.phasen_reife.pct!=null));
  let meta='',body='';
  if(has){
    const eng=(vs.zwangspunkte||[]).filter(z=>z.status==='danger').length;
    const blk=(vs.schnittstellen||[]).length;
    meta=(eng?'<span class="stat alert">'+eng+' Zwangspunkt'+(eng>1?'e':'')+' eng</span>':'')+(blk?'<span class="stat warn">'+blk+' Blockade'+(blk>1?'n':'')+'</span>':'');
    body='<div class="vs-inner">'+renderVorausschau(vs)+'</div>';
  }else{
    meta='<span class="stat warn">offen</span>';
    body='<div class="inner"><div class="cta"><p><strong>Vorausschau</strong> leitet aus Terminen, Protokollen &amp; der Mail-Wissensbasis ab, <em>was als Nächstes kritisch wird — bevor es eintritt</em>: Termin-Radar mit Rückwärtsterminierung, Phasen-Reife, Schnittstellen-Stillstand und Themen-Hotspots. Noch nicht berechnet.</p><button class="btn-sm" data-agent="dashboard-analyse">Vorausschau berechnen</button></div></div>';
  }
  return sec('vorausschau','prominent','◎','Vorausschau · denkt voraus','was als Nächstes kritisch wird — bevor es eintritt',meta,body);
}
function renderVorausschau(vs){
  let h='';
  const zp=vs.zwangspunkte||[],reife=vs.phasen_reife||null,week=vs.diese_woche||[],jf=vs.jour_fixe||null,sst=vs.schnittstellen||[],hot=vs.hotspots||[];
  const engst=zp.filter(z=>z&&z.puffer_wochen!=null).slice().sort((a,b)=>(+a.puffer_wochen)-(+b.puffer_wochen))[0];
  h+=ovHero([reife&&reife.pct!=null?ovK('',Math.max(0,Math.min(100,Math.round(+reife.pct)))+'<span class="ov-k-u"> %</span>','Grundleistungen abgeschlossen'):null,ovK(zp.length?'':'mut',zp.length,'Zwangspunkte'),engst?ovK(Math.round(+engst.puffer_wochen)<=6?'warn':'ok',Math.max(0,Math.round(+engst.puffer_wochen))+'<span class="ov-k-u"> Wo</span>','engster Puffer'):null,week.length?ovK('',week.length,'diese Woche'):null]);
  let left='';
  if(zp.length){
    left='<div class="vs-block-c"><div class="vs-h">'+icoClock()+'Termin-Radar · '+gl('Rückwärtsterminierung')+'<span class="vs-tag">'+zp.length+' '+gl('Zwangspunkt')+(zp.length>1?'e':'')+'</span></div>';
    for(const z of zp){const st=z.status||'warn',pw=Math.max(0,+z.puffer_wochen||0),fill=Math.min(98,Math.max(6,Math.round((26-pw)/26*100)));
      left+='<div class="vs-zp-wrap"><div class="vs-zp"><div><div class="vs-zp-name">'+esc(z.name||'')+'</div><div class="vs-zp-sub">'+esc(z.quelle||'')+'</div></div><div><div class="vs-track"><div class="vs-track-fill '+st+'" style="width:'+fill+'%"></div><div class="vs-track-need" style="left:'+fill+'%"></div></div><div class="vs-track-labels"><span>heute</span><span>Frist '+esc(fmtFrist(z.frist))+'</span></div></div><div class="vs-puffer '+st+'"><div class="vs-puffer-d">'+pw+' Wo</div><div class="vs-puffer-l">'+gl('Puffer')+'</div></div></div>'+(z.erlaeuterung?'<div class="vs-zp-erl">'+esc(z.erlaeuterung)+'</div>':'')+'</div>';}
    left+='</div>';
  }
  let right='';
  if(reife&&reife.pct!=null){const pct=Math.max(0,Math.min(100,Math.round(+reife.pct)));
    right='<div class="vs-block-c"><div class="vs-h">'+icoCheck()+gl('Phasen-Reife')+'</div><div class="vs-reife"><div class="vs-ring" style="background:conic-gradient(var(--c-blue-600) '+pct+'%,var(--c-slate-200) 0)"><div class="vs-ring-v"><div class="vs-ring-pct">'+pct+'%</div><div class="vs-ring-l">reif</div></div></div><div class="vs-reife-side">'+(reife.hinweis?'<div class="vs-prog">'+esc(reife.hinweis)+'</div>':'')+(reife.fehlend&&reife.fehlend.length?'<ul class="vs-miss">'+reife.fehlend.map(f=>'<li><span class="dot'+(f.status==='teilweise'?' part':'')+'"></span>'+esc(f.text)+'</li>').join('')+'</ul>':'')+'</div></div></div>';
  }
  if(left||right)h+='<div class="vs-row">'+(left||'<div></div>')+(right||'<div></div>')+'</div>';
  if(week.length||(jf&&((jf.punkte&&jf.punkte.length)||jf.datum))){
    let acts='<div class="vs-block-c"><div class="vs-h">'+icoClock()+'Diese & nächste Woche</div><div class="vs-acts">';
    if(week.length)acts+=week.map(a=>'<div class="vs-act'+(a.dringlichkeit==='bald'?' soon':'')+'"><div class="vs-act-w">'+(a.dringlichkeit==='bald'?'bald':'jetzt')+' · '+esc(fmtFrist(a.frist))+'</div><div class="vs-act-t">'+esc(a.titel||'')+'</div>'+(a.meta?'<div class="vs-act-m">'+esc(a.meta)+'</div>':'')+'</div>').join('');
    else acts+='<div class="vs-act-m" style="grid-column:1/-1">Keine fixen Fristen in den nächsten 2 Wochen.</div>';
    acts+='</div></div>';
    let jfh='';
    if(jf&&((jf.punkte&&jf.punkte.length)||jf.datum))jfh='<div class="vs-jf"><div class="vs-jf-h">Nächster Jour-Fixe</div><div class="vs-jf-d">'+esc(jf.datum?fmtFrist(jf.datum):'Termin offen')+'</div>'+(jf.punkte&&jf.punkte.length?'<ul class="vs-jf-l">'+jf.punkte.map(p=>'<li>'+esc(p)+'</li>').join('')+'</ul>':'')+'<button class="vs-jf-copy" data-jfcopy="1">📋 Agenda kopieren</button></div>';
    h+='<div class="vs-week-grid">'+acts+(jfh||'<div></div>')+'</div>';
  }
  let s3l='';
  if(sst.length){s3l='<div class="vs-block-c"><div class="vs-h">'+icoLink()+gl('Schnittstellen-Stillstand',GLOSS['Schnittstelle'])+'</div>';
    for(const s of sst)s3l+='<div class="vs-block-row"><div class="vs-idle '+(s.status==='danger'?'':'warn')+'"><div class="vs-idle-d">'+(+s.tage_still||0)+'</div><div class="vs-idle-l">Tage</div></div><div class="vs-block-main"><div class="vs-block-name">'+esc(s.name||'')+'</div><div class="vs-chain">'+esc(s.kette||'')+'</div></div></div>';
    s3l+='</div>';
  }
  let s3r='';
  if(hot.length){const max=Math.max(...hot.map(t=>+t.anzahl||0),1);s3r='<div class="vs-block-c"><div class="vs-h">'+icoFire()+'Themen-Hotspots</div>';
    for(const t of hot){const w=Math.round((+t.anzahl||0)/max*100);s3r+='<div class="vs-topic"><div class="vs-topic-n">'+esc(t.thema||'')+(t.flag?'<span class="vs-flag">'+esc(t.flag)+'</span>':'')+'</div><div class="vs-bar"><div class="vs-bar-f'+(t.trend==='up'?' hot':'')+'" style="width:'+w+'%"></div></div><div class="vs-topic-v">'+(+t.anzahl||0)+(t.trend==='up'?' <span class="up">▲</span>':'')+'</div></div>';}
    s3r+='</div>';
  }
  if(s3l||s3r)h+='<div class="vs-row">'+(s3l||'<div></div>')+(s3r||'<div></div>')+'</div>';
  return h;
}
function eur(n){return (Number(n)||0).toLocaleString('de-DE')+' €';}
function renderKostenTrend(k){
  const v=(k.verlauf||[]).filter(s=>s&&s.betrag!=null).slice().sort((a,b)=>(a.lph||0)-(b.lph||0));
  const budget=(k.budget!=null&&!isNaN(+k.budget))?+k.budget:null;
  if(!v.length&&budget==null)return '';
  let h='<div class="kt"><div class="kt-h">'+gl('Kosten-Verlauf','Die HOAI-Kostenstufen über die Zeit: Kostenrahmen → Schätzung → Berechnung → Anschlag → Feststellung. Zeigt, ob das Projekt im Budget bleibt.')+' · Schätzung → Feststellung</div>';
  if(budget!=null)h+='<div class="kt-budget"><span class="kt-budget-l">'+gl('Budget','Vom Bauherrn vorgegebener Kostenrahmen, an dem die Stufen gemessen werden.')+' / Kostenrahmen</span><span class="kt-budget-v mono">'+eur(budget)+'</span></div>';
  if(v.length){h+='<div class="kt-steps">';
    for(const s of v){let cls='',dlt='';if(budget!=null&&budget>0){const over=+s.betrag-budget;cls=over>budget*0.02?'over':over<-budget*0.02?'under':'on';dlt=' · <span class="kt-delta '+cls+'">'+(over>=0?'+':'')+eur(over)+' vs. Budget</span>';}
      h+='<div class="kt-step '+cls+'"><div class="kt-step-top"><span class="kt-stufe">'+esc(s.stufe||'')+'</span>'+(s.lph?'<span class="kt-lph">LPH '+esc(''+s.lph)+'</span>':'')+'</div><div class="kt-betrag mono">'+eur(s.betrag)+'</div><div class="kt-foot">'+(s.stand?esc(fmtFrist(s.stand)):'')+dlt+(s.quelle?'<div class="kt-q">Quelle: '+esc(s.quelle)+'</div>':'')+'</div></div>';}
    h+='</div>';}
  return h+'</div>';
}
function renderHonorar(D){const ho=D&&D.honorare?D.honorare:null;if(!ho)return '';
  const hasNum=ho.summe!=null||ho.abgerechnet!=null||ho.offen!=null;
  const vt=(ho.vertraege||[]).filter(x=>x&&(x.gegenstand||x.partei));
  if(!hasNum&&!vt.length&&!ho.anzahl_vertraege)return '';
  let h='<div class="hon"><div class="kt-h">Honorar &amp; Verträge</div><div class="hon-sum">';
  if(ho.summe!=null)h+='<div class="hon-cell"><div class="hon-v mono">'+eur(ho.summe)+'</div><div class="hon-l">Gesamthonorar</div></div>';
  if(ho.abgerechnet!=null)h+='<div class="hon-cell"><div class="hon-v mono">'+eur(ho.abgerechnet)+'</div><div class="hon-l">abgerechnet</div></div>';
  if(ho.offen!=null)h+='<div class="hon-cell"><div class="hon-v mono r">'+eur(ho.offen)+'</div><div class="hon-l">noch offen</div></div>';
  if(ho.offene_nachtraege)h+='<div class="hon-cell"><div class="hon-v mono">'+esc(''+ho.offene_nachtraege)+'</div><div class="hon-l">offene Nachträge</div></div>';
  h+='</div>';
  if(vt.length)h+='<div class="hon-list">'+vt.map(x=>'<div class="hon-row"><div class="hon-row-m"><div class="hon-geg">'+esc(x.gegenstand||'')+'</div>'+(x.partei?'<div class="hon-partei">'+esc(x.partei)+'</div>':'')+'</div>'+(x.summe!=null?'<div class="hon-betr mono">'+eur(x.summe)+'</div>':'')+'<span class="stat '+(x.status==='beauftragt'?'ok':x.status==='offen'?'warn':'')+'">'+esc(x.status||'')+'</span></div>').join('')+'</div>';
  return h+'</div>';
}
function renderKosten(D,costDocs){
  if(D&&D.kosten){const k=D.kosten;let h='';
    if(k.summe_brutto){const bud=(k.budget!=null&&!isNaN(+k.budget)&&+k.budget>0)?+k.budget:null,ho=D.honorare||null,dlt=bud!=null?k.summe_brutto-bud:null;
      h+=ovHero([ovK('',(k.summe_brutto/1e6).toLocaleString('de-DE',{maximumFractionDigits:2})+'<span class="ov-k-u"> Mio € brutto</span>','Stand '+(k.stand||'?')),dlt!=null?ovK(dlt>0?'bad':'ok',(dlt>0?'+':'−')+Math.abs(Math.round(dlt/1000)).toLocaleString('de-DE')+'<span class="ov-k-u"> T€</span>','vs. Budget '+(bud/1e6).toLocaleString('de-DE',{maximumFractionDigits:2})+' Mio €'):null,ho&&ho.offene_nachtraege?ovK('warn',ho.offene_nachtraege,'offene Nachträge'):null]);}
    h+=renderKostenTrend(k);
    if(k.kg&&k.kg.length){h+='<div class="kt-h" style="margin-top:14px">Kostengruppen · DIN 276</div><table class="kg-table"><tr><th>'+gl('KG','Kostengruppe nach DIN 276 — z. B. KG 300 Bauwerk, KG 400 Technik.')+' (DIN 276)</th><th style="text-align:right">Betrag</th></tr>'+k.kg.map(r=>'<tr><td>KG '+esc(''+r.kg)+'</td><td class="n">'+(Number(r.betrag)||0).toLocaleString('de-DE')+' €</td></tr>').join('')+'</table>';}
    h+=renderHonorar(D);
    if(k.quelle)h+='<div class="page-sub" style="margin-top:10px">Quelle: '+esc(k.quelle)+'</div>';
    return h||'<div class="empty">Analyse ohne Kostenwerte.</div>';}
  let h='<div class="cta"><p>Kosten (KG 200–700), Verträge und Trend werden von der <strong>Dashboard-Analyse</strong> aus deinen Kosten-Dokumenten ermittelt. Noch nicht gelaufen.</p><button class="btn-sm" data-agent="dashboard-analyse">Tiefenanalyse starten</button></div>';
  if(costDocs.length)h+='<h4 style="font-family:var(--f-mono);font-size:9.5px;text-transform:uppercase;color:var(--c-slate-500);letter-spacing:.6px;margin:16px 0 6px">Gefundene Kosten-Dokumente ('+costDocs.length+')</h4>'+costDocs.map(d=>'<div class="act-row"><span class="af">'+esc(d.filename)+'</span><span class="ad">'+fmtD(d.modified_at)+'</span></div>').join('');
  return h;}
function renderLph1(L,kLph){kLph=kLph||1;
  if(!L)return '<div class="inner"><div class="cta">'+(kLph===1
    ?'<p>Ein <strong>erfahrener Architekt</strong> füllt aus deinen Unterlagen den LPH-1-Grundlagenkatalog vor (Aufgabenstellung, Rahmenbedingungen, Bauordnung, Standort, Raumprogramm …), beurteilt das Raumprogramm und leitet die offenen <strong>Bauherren-Fragen</strong> ab — damit niemand zeichnet, bevor die Grundlagen klar sind.</p><button class="btn-sm" data-agent="lph1-grundlagen">Grundlagen jetzt erfassen</button>'
    :'<p>Ein <strong>erfahrener Architekt</strong> erfasst aus deinen Unterlagen den Stand der <strong>'+esc(LPH_KAT_TITEL[kLph]||'Phase')+'</strong> (LPH '+kLph+'), bewertet ihn fachlich und leitet aus allen offenen Punkten den <strong>Fragenkatalog</strong> an Bauherrn &amp; Beteiligte ab.</p><button class="btn-sm" data-agent="lph-katalog" data-lph="'+kLph+'">Katalog jetzt erfassen</button>')+'</div></div>';
  const abs=L.abschnitte||[],rp=L.raumprogramm||{};
  const frAlle=L.fragenkatalog||[],frZu=frAlle.filter(f=>f&&fbClosed[fbKey('frage',f.frage)]),fragen=frAlle.filter(f=>f&&!fbClosed[fbKey('frage',f.frage)]);
  const geklN=abs.filter(a=>a.status==='geklaert').length,mussN=fragen.filter(f=>f.prioritaet==='muss').length;
  let h='<div class="inner">'+ovHero([ovK(mussN?'bad':'ok',mussN,'Muss-Fragen offen'),ovK('',geklN+'/'+abs.length,'Abschnitte geklärt'),ovK(fragen.length?'':'mut',fragen.length,'Fragen gesamt')]);
  if(fragen.length||frZu.length){const grp={muss:[],soll:[],kann:[]};fragen.forEach(f=>{(grp[f.prioritaet]||grp.kann).push(f);});
    const tl={muss:kLph===1?'Muss vor Planungsbeginn geklärt sein':'Muss für den Fortgang der Phase geklärt sein',soll:'Sollte geklärt werden',kann:'Optional / später'};
    h+='<div class="l1-frag"><div class="l1-frag-h"><span>'+(kLph===1?'Bauherren-Fragenkatalog':'Fragenkatalog an Bauherrn & Beteiligte')+' · '+fragen.length+' offene Punkte</span><button class="btn-sm ghost" data-fragcopy="1">Katalog kopieren</button></div>';
    ['muss','soll','kann'].forEach(p=>{if(grp[p].length)h+='<div class="l1-fg '+p+'"><div class="l1-fg-h">'+tl[p]+' ('+grp[p].length+')</div>'+grp[p].map(f=>{const fb=fbUI('frage',f.frage||'');return '<div class="l1-frage"><span class="l1-frage-dot"></span><span class="l1-frage-t">'+esc(f.frage||'')+'</span>'+(f.abschnitt?'<span class="l1-frage-a">'+esc(f.abschnitt)+'</span>':'')+fb.btn+'</div>'+fb.form;}).join('')+'</div>';});
    h+=fbDoneSec(frZu.map(f=>({title:f.frage||'',kommentar:(fbClosed[fbKey('frage',f.frage)]||{}).kommentar})))+'</div>';}
  if(rp.manager||((rp.raeume||[]).length)){h+='<div class="l1-rp"><div class="l1-rp-h">Raumprogramm</div>';
    if((rp.raeume||[]).length)h+=renderRaumGrafik(rp);
    if(rp.manager){const m=rp.manager;h+='<div class="l1-rpm">'+(m.gesamtbewertung?'<div class="l1-rpm-ges">'+esc(m.gesamtbewertung)+'</div>':'')+rpmList('Schwächen / Probleme',m.schwaechen,'bad')+rpmList('Tatsächliche Bedarfe',m.bedarfe,'warn')+rpmList('Vorschläge',m.vorschlaege,'ok')+'</div>';}
    h+='</div>';}
  if(L.manager&&kLph>1){const m=L.manager;h+='<div class="l1-rp"><div class="l1-rp-h">Fachliche Bewertung · Phasen-Stand</div><div class="l1-rpm">'+(m.gesamtbewertung?'<div class="l1-rpm-ges">'+esc(m.gesamtbewertung)+'</div>':'')+rpmList('Schwächen / Probleme',m.schwaechen,'bad')+rpmList('Tatsächliche Bedarfe',m.bedarfe,'warn')+rpmList('Vorschläge',m.vorschlaege,'ok')+'</div></div>';}
  h+='<div class="l1-kat-h">'+(kLph===1?'Grundlagen-Katalog':'Phasen-Katalog')+' '+geklN+'/'+abs.length+' geklärt</div>';
  abs.forEach(a=>{const fel=a.felder||[];const cls=a.status==='geklaert'?'ok':a.status==='teilweise'?'warn':'bad';const op=a.status!=='geklaert';
    h+='<details class="l1-sec"'+(op?' open':'')+'><summary class="l1-sec-sum"><span class="l1-sec-dot '+cls+'"></span><span class="l1-sec-t">'+esc(a.titel||a.id||'')+'</span><span class="l1-sec-st '+cls+'">'+esc(stL(a.status||''))+'</span></summary><div class="l1-sec-b">'+
      (fel.length?fel.map(f=>{const fc=f.status==='geklaert'?'ok':f.status==='unklar'?'warn':'bad';return '<div class="l1-feld"><span class="l1-feld-dot '+fc+'"></span><span class="l1-feld-l">'+esc(f.label||'')+'</span><span class="l1-feld-w'+(f.wert==null||f.wert===''?' leer':'')+'">'+(f.wert==null||f.wert===''?'— offen —':esc(''+f.wert))+'</span>'+(f.quelle?'<span class="l1-feld-q">'+esc(f.quelle)+'</span>':'')+'</div>';}).join(''):'<div class="empty" style="padding:8px">—</div>')+
      '</div></details>';});
  return h+'</div>';
}
function rpmList(t,arr,cls){if(!arr||!arr.length)return '';return '<div class="l1-rpm-grp"><div class="l1-rpm-gh '+cls+'">'+esc(t)+'</div><ul class="l1-rpm-ul">'+arr.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>';}
function renderRaumGrafik(rp){const raeume=(rp.raeume||[]).filter(r=>r&&r.name&&(+r.flaeche_m2>0));if(!raeume.length)return '';
  // Funktionsdiagramm: jeder Raum = Rechteck, Flaeche masstaeblich zur EINZELRAUM-m2 (flaeche_m2 ist Gesamtflaeche der anzahl Raeume).
  const per=r=>(+r.flaeche_m2||0)/Math.max(1,+r.anzahl||1);
  // Skala robust: 85%-Perzentil als Bezug, damit grosse Sammel-/Verkehrsflaechen nicht alles plattdruecken
  const pers=raeume.map(per).sort((a,b)=>a-b);const cap=Math.max(pers[Math.min(pers.length-1,Math.floor(pers.length*0.85))]||1,1);
  const k=112/Math.sqrt(cap); // px je sqrt(m2)
  const cl={};raeume.forEach(r=>{const c=r.cluster||'Sonstige';(cl[c]=cl[c]||[]).push(r);});
  const pal=['#5FA8B5','#5FA86F','#9B6FA0','#B57C7C','#E3E36F','#8A9C7C','#E08A8A','#E0B85F','#6FA89B','#B5C9C2'];let ci=0;
  let h='<div class="rg2">';
  for(const c in cl){const col=pal[ci%pal.length];ci++;
    const sum=cl[c].reduce((s,r)=>s+(+r.flaeche_m2||0),0);
    const names=[...new Set(cl[c].map(r=>r.name))];
    h+='<div class="rg2-cl"><div class="rg2-cl-h">'+esc(c)+' <span class="rg2-cl-sum">'+Math.round(sum)+' m²</span></div><div class="rg2-boxes">';
    cl[c].forEach(r=>{const n=Math.max(1,Math.min(+r.anzahl||1,40));const pa=per(r);const side=Math.max(22,Math.min(128,Math.round(Math.sqrt(Math.min(pa,cap*1.25))*k)));
      const br=(0.80+(names.indexOf(r.name)%5)*0.09).toFixed(2);
      for(let i=0;i<n;i++)h+='<div class="rg2-box" style="width:'+side+'px;height:'+side+'px;background:'+col+';filter:brightness('+br+')" title="'+esc(r.name)+' · ~'+Math.round(pa)+' m²/Raum'+(n>1?' (Raum '+(i+1)+'/'+n+', '+Math.round(+r.flaeche_m2)+' m² gesamt)':'')+'"></div>';});
    h+='</div></div>';}
  return h+'</div>'+(rp.summe_nf_m2?'<div class="rg-total">Summe Nutzfläche: <strong>'+Math.round(rp.summe_nf_m2).toLocaleString('de-DE')+' m²</strong> · Blöcke flächen­maßstäblich (Einzelraum), Hover zeigt Details</div>':'<div class="rg-total" style="border:none">Blöcke flächenmaßstäblich · Hover zeigt Details</div>');
}
function lph1FragenText(){const L=lastKat||lastL1||{};const f=(L.fragenkatalog||[]).filter(x=>x&&!fbClosed[fbKey('frage',x.frage)]);
  const lines=['Fragenkatalog · '+short(currentName||'')+' · LPH '+lastKatLph+' '+(LPH_KAT_TITEL[lastKatLph]||''),''];
  const grp={muss:[],soll:[],kann:[]};f.forEach(x=>{(grp[x&&x.prioritaet]||grp.kann).push(x);});
  const tl={muss:lastKatLph===1?'MUSS vor Planungsbeginn geklärt sein:':'MUSS für den Fortgang der Phase geklärt sein:',soll:'Sollte geklärt werden:',kann:'Optional / später:'};
  ['muss','soll','kann'].forEach(p=>{if(grp[p].length){lines.push(tl[p]);grp[p].forEach(x=>lines.push('• '+(x.frage||'')));lines.push('');}});
  return lines.join('\n').trim();
}
function renderFachplaner(D){
  const f=(D.fachplaner&&D.fachplaner.length)?D.fachplaner:(D.beteiligte||[]).map(b=>({rolle:b.rolle,name:b.name,firma:b.firma}));
  const koll=D.kollisionspruefung||null;const td=today();let h='';
  if(koll&&(koll.hinweis||(koll.benoetigt&&koll.benoetigt.length)||koll.status)){
    const kst=koll.status||'offen';const kcls=kst==='abgeschlossen'?'ok':kst==='laeuft'?'warn':kst==='nicht-relevant'?'off':'bad';
    h+='<div class="koll '+kcls+'"><div class="koll-h">'+icoLink()+gl('Kollisionsprüfung','Abgleich der Fachplanungen (Tragwerk/TGA/Elektro …) auf räumliche Konflikte. Braucht die aktuellen Pläne aller Gewerke.')+' · Plan-Koordination <span class="koll-st '+kcls+'">'+esc(stL(kst))+'</span></div>';
    if(koll.hinweis)h+='<div class="koll-hint">'+esc(koll.hinweis)+'</div>';
    if(koll.benoetigt&&koll.benoetigt.length)h+='<div class="koll-need-h">Dafür gebraucht:</div>'+koll.benoetigt.map(b=>{const ov=!b.vorhanden&&b.frist&&b.frist<td;return '<div class="koll-need"><span class="koll-dot'+(b.vorhanden?' ok':ov?' bad':'')+'"></span><span class="koll-what">'+esc(b.was||'')+'</span><span class="koll-from">'+esc(b.von||'')+'</span>'+(b.frist?'<span class="mono'+(ov?' over':'')+'">'+esc(fmtFrist(b.frist))+'</span>':'')+(b.vorhanden?'<span class="koll-have-l">liegt vor</span>':'<span class="koll-open-l">offen</span>')+'</div>';}).join('');
    h+='</div>';
  }
  if(!f.length)return h||'<div class="empty">Keine Fachplaner erfasst.</div>';
  h+='<div class="av-secrow">'+f.length+' Fachplaner / Schnittstellen</div><div class="fp-grid">';
  for(const p of f){const zl=(p.zulieferungen||[]).filter(z=>z&&z.was);const offen=zl.filter(z=>z.status!=='geliefert').length;
    h+='<div class="fp-card'+(p.status==='ruht'?' ruht':'')+'"><div class="fp-top"><div><div class="fp-role">'+esc(p.rolle||'Beteiligte')+'</div><div class="fp-name">'+esc(p.name||'—')+(p.firma?' · '+esc(p.firma):'')+'</div></div>'+(p.status?'<span class="av-tag '+slug(p.status)+'">'+esc(p.status)+'</span>':'')+'</div>';
    if(p.arbeitet_an)h+='<div class="fp-work"><span class="fp-work-l">arbeitet an</span> '+esc(p.arbeitet_an)+'</div>';
    if(zl.length){h+='<div class="fp-zl-h">Zulieferung an dich'+(offen?' <span class="fp-zl-cnt">'+offen+' offen</span>':'')+'</div>';
      h+=zl.map(z=>{const st=z.status||'offen';const ov=st==='ueberfaellig'||(st!=='geliefert'&&z.frist&&z.frist<td);const cls=st==='geliefert'?'ok':ov?'bad':st==='zugesagt'?'warn':'';
        return '<div class="fp-zl'+(ov?' over':'')+'"><div class="fp-zl-m"><div class="fp-zl-was">'+esc(z.was||'')+(z.verschoben?' <span class="fp-versch">↻ verschoben</span>':'')+'</div>'+(z.fuer?'<div class="fp-zl-fuer">für '+esc(z.fuer)+'</div>':'')+(z.verschoben&&z.verschoben_hinweis?'<div class="fp-versch-h">'+esc(z.verschoben_hinweis)+'</div>':'')+'</div><div class="fp-zl-r">'+(z.frist?'<span class="mono'+(ov?' over':'')+'">'+esc(fmtFrist(z.frist))+'</span>':'<span class="mono off">o. Frist</span>')+'<span class="fp-zl-st '+cls+'">'+esc(stL(st))+'</span></div></div>';}).join('');
    }
    if(p.schnittstellen_themen&&p.schnittstellen_themen.length)h+='<div class="fp-themen">'+p.schnittstellen_themen.map(t=>'<span class="fp-thema">'+esc(t)+'</span>').join('')+'</div>';
    if(p.letzter_kontakt&&!zl.length&&!p.arbeitet_an)h+='<div class="fp-foot">zuletzt '+esc(fmtFrist(p.letzter_kontakt))+'</div>';
    h+='<div style="margin-top:8px"><button data-mails="'+esc((((p.name||'')+' '+(p.firma||'')).trim()||(p.rolle||''))).split('"').join('')+'" style="font-size:11px;font-weight:700;color:#BE4D2C;background:transparent;border:1px solid #E4DFD5;border-radius:7px;padding:4px 9px;cursor:pointer">📧 zugehörige E-Mails</button></div>';
    h+='</div>';
  }
  return h+'</div>';
}
const LPH_CL={
 1:['Aufgabenstellung/Bedarf geklärt (Raumprogramm)','Ortsbesichtigung / Bestandsaufnahme','Beratung zum gesamten Leistungsbedarf','Ergebnisse zusammengefasst & dokumentiert'],
 2:['Planungskonzept / Vorentwurf erarbeitet','Variantenuntersuchung','Kostenschätzung nach DIN 276','Terminrahmen aufgestellt','Vorabstimmung mit Behörden','Vorentwurf mit Bauherr abgestimmt'],
 3:['Entwurfszeichnungen (M 1:100)','Objekt-/Baubeschreibung','Kostenberechnung nach DIN 276','Fachplaner integriert (Tragwerk/TGA/BS/Bauphysik)','Terminplan fortgeschrieben','Entwurf vom Bauherrn freigegeben'],
 4:['Bauantrag / Bauvorlagen erstellt','Standsicherheitsnachweis','Brandschutznachweis','GEG-/Energienachweis','Antrag eingereicht','Auflagen erfasst & eingearbeitet'],
 5:['Ausführungs-/Detailpläne erstellt','Schlitz-/Durchbruchspläne mit TGA','Raumbuch','Pläne mit Fachplanern kollisionsgeprüft'],
 6:['Leistungsverzeichnisse je Gewerk','Mengenermittlung','Vergabeterminplan','AVB/ZVB den Vergabeunterlagen beigefügt','Vergabeart festgelegt (z. B. VOB/A)'],
 7:['Angebote eingeholt','Preisspiegel / Angebotsprüfung','Bietergespräche / Verhandlung','Vergabevorschlag & -vermerk','Auftrag erteilt / Vertrag geschlossen'],
 8:['Bautagebuch geführt','Terminplan überwacht','Aufmaße geprüft','Abnahmen mit Protokoll durchgeführt','Mängel erfasst & verfolgt','Kostenfeststellung nach DIN 276','Übergabe & Dokumentation an Bauherrn'],
 9:['Begehung zur Mängelbeseitigung','Gewährleistungsfristen überwacht','Objektdokumentation übergeben']};
function clKey(l,i){return 'L'+l+'-'+i;}
function clCounts(cl){cl=cl||{};let d=0,t=0;for(const l in LPH_CL){LPH_CL[l].forEach((_,i)=>{t++;if(cl[clKey(l,i)])d++;});}return{done:d,total:t};}
function renderChecklist(activeLph){
  let h='<div class="cl-note">HOAI §34-Grundleistungen je Leistungsphase, ergänzt um Vergabe-/Vertrags-Prüfpunkte (AVB/ZVB). Abhaken wird teamweit gespeichert. <em>Annahme zu „Havkom/ZVB": Standard-Prüfpunkte — sag Bescheid, wenn du ein bestimmtes Regelwerk gemappt haben willst.</em></div>';
  for(let l=1;l<=9;l++){const items=LPH_CL[l]||[];const op=openCl.has(l)||l===activeLph;const done=items.filter((_,i)=>lastChecklist[clKey(l,i)]).length;
    const cls=items.length&&done===items.length?'ok':done>0?'part':'';
    h+='<details class="cl-ph"'+(op?' open':'')+' data-cllph="'+l+'"><summary class="cl-sum"><span class="cl-lph '+cls+'">LPH '+l+'</span><span class="cl-name">'+esc(LPH[l-1])+(l===activeLph?' · aktiv':'')+'</span><span class="cl-prog">'+done+'/'+items.length+'</span></summary><div class="cl-body">'+
      items.map((it,i)=>{const k=clKey(l,i),ck=!!lastChecklist[k];return '<label class="cl-item'+(ck?' done':'')+'"><input type="checkbox" class="cl-cb" data-clkey="'+k+'"'+(ck?' checked':'')+'><span>'+esc(it)+'</span></label>';}).join('')+'</div></details>';}
  return h;}
async function toggleChecklist(key,val){const nc=Object.assign({},lastChecklist);if(val)nc[key]=true;else delete nc[key];lastChecklist=nc;const{error}=await sb.from('projects').update({checklist:nc}).eq('id',current);if(error)alert('Fehler beim Speichern: '+error.message);}
function renderLphBew(D){if(D&&D.lph_bewertung&&D.lph_bewertung.length)return D.lph_bewertung.map(r=>'<div class="lrow"><span>'+esc(r.leistung)+'</span><span class="ls '+slug(r.status)+'">'+esc(stL(r.status))+'</span></div>').join('');
  return '<div class="cta"><p>Die Bewertung der HOAI-Grundleistungen (vollständig / teilweise / fehlend) kommt aus der Dashboard-Analyse.</p><button class="btn-sm" data-agent="dashboard-analyse">Tiefenanalyse starten</button></div>';}
function renderBeschluesse(D){if(D&&D.beschluesse&&D.beschluesse.length)return D.beschluesse.map(b=>'<div class="vrow"><div style="flex:1"><div class="vtitle">'+esc(b.text)+'</div><div class="vmeta"><span class="mono">'+esc(b.datum||'')+'</span>'+(b.quelle?'<span>'+esc(b.quelle)+'</span>':'')+'</div></div></div>').join('');
  return '<div class="cta"><p>Wesentliche Beschlüsse (Varianten, Vergaben, Freigaben) werden aus Protokollen und Mails extrahiert.</p><button class="btn-sm" data-agent="dashboard-analyse">Tiefenanalyse starten</button></div>';}
function renderMaengel(mg){const td=today();const order={offen:0,'in-behebung':1,behoben:2,abgenommen:3};
  const zu=mg.filter(m=>m&&fbClosed[fbKey('mangel',m.beschreibung||'')]),rest=mg.filter(m=>m&&!fbClosed[fbKey('mangel',m.beschreibung||'')]);
  const list=rest.slice().sort((a,b)=>((order[a.status]==null?9:order[a.status])-(order[b.status]==null?9:order[b.status]))||((a.frist||'9999')<(b.frist||'9999')?-1:1));
  return '<div class="inner"><div class="mg-list">'+list.map(m=>{const st=m.status||'offen';const ov=st!=='behoben'&&st!=='abgenommen'&&m.frist&&m.frist<td;const cls=(st==='behoben'||st==='abgenommen')?'ok':st==='in-behebung'?'warn':'bad';const fb=fbUI('mangel',m.beschreibung||'');
    return '<div class="mg-row '+cls+(ov?' overdue':'')+'"><div class="mg-main"><div class="mg-desc">'+esc(m.beschreibung||'')+'</div><div class="mg-meta">'+(m.gewerk?'<span class="task-chip">'+esc(m.gewerk)+'</span>':'')+(m.verantwortlich?'<span>'+esc(m.verantwortlich)+'</span>':'')+(m.frist?'<span class="mono'+(ov?' over':'')+'">Frist '+esc(fmtFrist(m.frist))+'</span>':'')+'</div></div><span class="mg-status '+cls+'">'+esc(st)+'</span>'+fb.btn+'</div>'+fb.form;}).join('')+fbDoneSec(zu.map(m=>({title:m.beschreibung||'',kommentar:(fbClosed[fbKey('mangel',m.beschreibung||'')]||{}).kommentar})))+'</div></div>';}
function renderEntscheidungen(eo){const td=today();const eKey=e=>fbKey('entscheidung',e.thema||e.titel||e.text||'');
  const zu=eo.filter(e=>e&&fbClosed[eKey(e)]),open=eo.filter(e=>e&&!fbClosed[eKey(e)]);
  return open.map(e=>{const ov=e.bis&&e.bis<td;const fb=fbUI('entscheidung',e.thema||e.titel||e.text||'');return '<div class="vrow'+(ov?' overdue':'')+'"><div style="flex:1"><div class="vtitle">'+esc(e.thema||'')+'</div>'+(e.kontext?'<div class="ent-ctx">'+esc(e.kontext)+'</div>':'')+'<div class="vmeta">'+(e.wer?'<span class="task-chip">'+esc(e.wer)+'</span>':'')+(e.bis?'<span class="mono'+(ov?'':'')+'">bis '+esc(fmtFrist(e.bis))+'</span>':'<span class="mono" style="color:var(--c-slate-400)">Termin offen</span>')+'</div></div>'+fb.btn+'</div>'+fb.form;}).join('')+fbDoneSec(zu.map(e=>({title:e.thema||e.titel||e.text||'',kommentar:(fbClosed[eKey(e)]||{}).kommentar})));}
function renderAktivitaet(recent){if(!recent.length)return '<div class="empty">Keine datierten Dateien.</div>';return recent.map(d=>'<div class="act-row"><span class="af">'+esc(d.filename)+'</span><span class="ad">'+esc(d.doctype||'')+' · '+fmtD(d.modified_at)+'</span></div>').join('');}
// ---------------------------------------------------------------------------
// Beteiligtenliste — gepflegte Liste (Tabelle beteiligte), nicht der Analyse-Output.
// Gliederungsbaum wie ein LV: 'gruppe' = Ueberschrift, 'eintrag' = Beteiligter.
// Die Analyse ist nur noch Zulieferer ueber den Knopf "Aus Analyse".
// ---------------------------------------------------------------------------
const BET_KONTAKTARTEN=[['telefon','Telefon'],['mobil','Mobil'],['fax','Fax'],['email','E-Mail'],['web','Web']];
const BET_KONTEXTE=[['arbeit','Arbeit'],['zentrale','Zentrale'],['privat','Privat']];
const betName=r=>[r.anrede,r.namenstitel,r.vorname,r.nachname].filter(Boolean).join(' ').trim();
const betAdr=r=>[r.strasse,[r.plz,r.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
const betKont=r=>Array.isArray(r.kontakte)?r.kontakte:(r.kontakte?JSON.parse(r.kontakte):[]);
// Eine Zeile haelt die "Firmenposition", wenn sie direkt unter einer Gruppe
// (oder ganz oben) steht — dort gehoert die Firma hin, die Personen darunter.
const betIstFirmenzeile=r=>{if(!r.parent_id)return true;
  const v=betL.find(x=>x.id===r.parent_id);return !v||v.art==='gruppe';};
function betKontZeile(k){const art=(BET_KONTAKTARTEN.find(a=>a[0]===k.art)||['','?'])[1];
  const ico=k.art==='email'?'✉':k.art==='fax'?'📠':k.art==='web'?'🌐':k.art==='mobil'?'📱':'☎';
  const wert=k.art==='email'?'<a href="mailto:'+esc(k.wert)+'">'+esc(k.wert)+'</a>':esc(k.wert);
  return '<span class="bet-k" title="'+esc(art+(k.kontext?' ('+k.kontext+')':''))+'">'+ico+' '+wert+'</span>';}

// Vollbild-Ansicht: links die Liste (eine Zeile je Beteiligtem), rechts ein
// Arbeitsbereich, der je nach Lage Details, Formular, CRM-Auswahl oder den
// PDF-Import zeigt. Vorher stand alles untereinander in einer schmalen Spalte --
// bei 68 Eintraegen unbrauchbar.
function renderBet(){
  const L=betL||[];
  let h='<div class="bet-shell">';
  // Listenreiter: ein Projekt kann mehrere Listen haben (Projektbeteiligte,
  // Fachplaner, Gewerke-Empfehlungen ...). Der aktive Reiter bestimmt, welche
  // Zeilen unten stehen.
  h+='<div class="bet-tabs">'+
     betListen.map(l=>'<button class="bet-tab'+(l.id===betListeId?' an':'')+'" data-betlist="'+l.id+'">'+
       esc(l.name)+
       (l.lph?'<span class="tab-meta">LPH '+esc(String(l.lph))+'</span>':'')+
       (l.bauabschnitt?'<span class="tab-meta">'+esc(l.bauabschnitt)+'</span>':'')+
       '</button>').join('')+
     '<button class="bet-tab neu" data-bet="liste-neu" title="Neue Liste aus einer Vorlage anlegen">+ Liste</button>'+
     (betListeId?'<span class="bet-tabs-rechts">'+
       '<button class="bet-t" data-bet="liste-links" title="Reiter nach links">◂</button>'+
       '<button class="bet-t" data-bet="liste-rechts" title="Reiter nach rechts">▸</button>'+
       '<button class="bet-t" data-bet="liste-umbenennen" title="Liste umbenennen">✎</button>'+
       '<button class="bet-t" data-bet="liste-vorlage" title="Diese Liste als Vorlage sichern — Gruppen und Rollen, ohne Firmen">Als Vorlage</button>'+
       '<button class="bet-t del" data-bet="liste-loeschen" title="Diese Liste löschen">🗑</button></span>':'')+
     '</div>';
  h+='<div class="bet-bar">'+
     '<button class="btn-sm" data-bet="neu-eintrag" title="Öffnet das Adressbuch und legt die gewählte Firma bzw. Person in der ersten Gruppe an. Danach lässt sie sich mit den Pfeilen verschieben.">+ Firma / Person</button>'+
     '<button class="btn-sm ghost" data-bet="neu-gruppe" title="Legt eine neue Überschrift auf oberster Ebene an">+ Gruppe</button>'+
     '<span class="bet-bar-sep"></span>'+
     '<button class="btn-sm'+(betAnalyseAn?'':' ghost')+'" data-bet="analyse" title="'+
       (betAnalyseAn?'Vorschläge der Tiefenanalyse wieder entfernen (von Hand Ergänztes bleibt)'
                   :'Beteiligte aus der Tiefenanalyse übernehmen, mit dem CRM abgeglichen')+'">'+
       (betAnalyseAn?'Analyse ✕':'Aus Analyse')+'</button>'+
     '<button class="btn-sm ghost" data-bet="pdf">PDF einlesen</button>'+
     '<input type="file" id="bet_pdf" accept="application/pdf,.pdf" hidden>'+
     '<span class="bet-bar-sep"></span>'+
     '<button class="btn-sm ghost" data-bet="verteiler">Verteiler</button>'+
     '<button class="btn-sm ghost" data-bet="druck">Als PDF drucken</button>'+
     '<span class="bet-hint" id="bethint"></span>'+
     '<span class="bet-filter"><input id="bet_q" placeholder="in der Liste filtern …" value="'+esc(betFilter||'')+'">'+
     (betFilter?'<button class="bet-t" data-bet="filter-weg" title="Filter aufheben">✕</button>':'')+'</span>'+
     '</div>';
  h+='<div class="bet-split"><div class="bet-liste">'+betListe(L)+'</div>'+
     '<aside class="bet-seite">'+betSeite()+'</aside></div></div>';
  return h;
}

function betListe(L){
  if(!L.length)return '<div class="bet-leer">'+(betListeId
    ?'Diese Liste ist noch leer.<br>Mit „+ Firma / Person“ füllen, ein bestehendes PDF einlesen '+
     'oder „+ Gruppe“ für eine eigene Überschrift.'
    :'Für dieses Projekt ist noch keine Liste angelegt.<br>Oben auf „+ Liste“ — dort lässt sich eine Vorlage wählen, '+
     'die die Gruppen gleich mitbringt.')+'</div>';
  const f=(betFilter||'').toLowerCase().trim();
  const passt=r=>!f||[r.titel,r.firma,betName(r),r.ort,r.nummer].filter(Boolean).join(' ').toLowerCase().includes(f);
  // Beim Filtern verschwinden Gruppen ohne Treffer; ohne Filter gilt das Ein-/Ausklappen.
  const zu=id=>betZu.has(id);
  const versteckt=new Set();
  if(!f)L.forEach(r=>{if(r.parent_id&&(versteckt.has(r.parent_id)||zu(r.parent_id)))versteckt.add(r.id);});
  const hatTreffer={};
  if(f){const merken=id=>{let x=L.find(r=>r.id===id);while(x){hatTreffer[x.id]=true;x=L.find(r=>r.id===x.parent_id);}};
        L.forEach(r=>{if(r.art==='eintrag'&&passt(r))merken(r.id);});}
  let h='',gezeigt=0;
  L.forEach(r=>{
    if(f?!hatTreffer[r.id]:versteckt.has(r.id))return;
    if(r.art==='gruppe'){
      const kinder=L.filter(x=>x.parent_id===r.id);
      const n=kinder.filter(x=>x.art==='eintrag').length;
      h+='<div class="bet-g t'+Math.min(r.tiefe,2)+'" data-betfold="'+r.id+'">'+
         '<span class="bet-g-nr">'+(kinder.length?(zu(r.id)&&!f?'▸ ':'▾ '):'')+esc(r.nummer)+'</span>'+
         '<span class="bet-g-t">'+esc(r.titel||'(ohne Titel)')+'</span>'+
         (n?'<span class="bet-g-n">'+n+'</span>':'')+
         '<button class="bet-t" data-betadd="'+r.id+'" title="Beteiligten in dieser Gruppe anlegen">+</button></div>';
      return;}
    gezeigt++;
    const K=betKont(r),nm=betName(r);
    const mail=K.find(k=>k.art==='email'),tel=K.find(k=>k.art==='telefon'||k.art==='mobil');
    // Firmenzeile = die Zeile, die unter einer Gruppe die Firma haelt. Sie wird
    // wie im Buero-Ausdruck als Balken gesetzt; die Personen darunter zeigen den
    // Firmennamen nicht noch einmal (steht ja eine Zeile hoeher).
    const istFirma=betIstFirmenzeile(r);
    const vater=r.parent_id?L.find(x=>x.id===r.parent_id):null;
    const firmaGleich=vater&&vater.art==='eintrag'&&
      (vater.firma||'').trim().toLowerCase()===(r.firma||'').trim().toLowerCase();
    h+='<div class="bet-z t'+Math.min(r.tiefe,3)+(betSel===r.id?' sel':'')+
       (istFirma?' firmenzeile':'')+
       (r.status==='offen'?' offen':'')+(r.status==='ausgeschieden'?' raus':'')+'" data-betrow="'+r.id+'">'+
       '<span class="z-nr">'+esc(r.nummer)+'</span>'+
       '<span class="z-rolle">'+esc(r.titel||'—')+'</span>'+
       '<span class="z-firma">'+esc(firmaGleich?'':(r.firma||(r.status==='offen'?'— noch nicht vergeben —':'')))+'</span>'+
       '<span class="z-person">'+esc(nm)+(r.funktion?' <span class="z-funk">'+esc(r.funktion)+'</span>':'')+'</span>'+
       '<span class="z-kon">'+(tel?'<i title="'+esc(tel.wert)+'">☎</i>':'')+(mail?'<i title="'+esc(mail.wert)+'">✉</i>':'')+'</span>'+
       '<span class="z-tags">'+
         (r.ist_bauherr?'<span class="bet-tag bh">BH</span>':'')+
         (r.ist_intern?'<span class="bet-tag in">intern</span>':'')+
         (r.quelle==='crm'?'<span class="bet-tag crm">CRM</span>':'')+
         (r.quelle==='pdf'?'<span class="bet-tag pdf">PDF</span>':'')+
         (r.quelle==='analyse'?'<span class="bet-tag an">Analyse</span>':'')+
       '</span></div>';});
  if(f&&!gezeigt)h='<div class="bet-leer">Kein Eintrag passt zu „'+esc(betFilter)+'“.</div>';
  return h;
}

// Was rechts steht, richtet sich nach der Lage: laufender Import zuerst,
// dann offenes Formular, dann CRM-Auswahl, sonst die angeklickte Zeile.
function betSeite(){
  if(betNeueListe)return betListeForm();
  if(betLoeschFrage==='LISTE'){
    const l=betListen.find(x=>x.id===betListeId)||{};
    const n=betL.filter(r=>r.art==='eintrag').length;
    return '<div class="bet-p"><div class="bet-p-kopf">Liste löschen?'+
      '<button class="bet-t" data-bet="del-nein">✕</button></div>'+
      '<div class="bet-p-titel">'+esc(l.name||'')+'</div>'+
      '<div class="bet-warnbox">Die Liste und ihre '+n+' Einträge werden gelöscht. '+
      'Andere Listen dieses Projekts bleiben unberührt.</div>'+
      '<div class="bet-p-akt"><button class="btn-sm rot" data-bet="liste-loeschen-ok">Endgültig löschen</button>'+
      '<button class="btn-sm ghost" data-bet="del-nein">Abbrechen</button></div></div>';}
  if(betLoeschFrage){const r=betL.find(x=>x.id===betLoeschFrage);
    if(r)return betLoeschPanel(r);betLoeschFrage=null;}
  if(betPdfFunde)return betPdfVorschau();
  // Adressbuch geht vor dem Formular: beim Anlegen sucht man zuerst jemanden.
  // Nach der Uebernahme schliesst betUebernehmen() das Adressbuch, dann steht
  // das ausgefuellte Formular da.
  if(betCrmOffen)return betCrmPanel();
  if(betEdit)return betForm(betEdit);
  const r=betL.find(x=>x.id===betSel);
  if(r)return betDetail(r);
  return betUebersicht();
}

// --- Listen anlegen, umbenennen, sichern, loeschen --------------------------
// betNeueListe: {modus:'neu'|'umbenennen'|'vorlage'} — steuert, was das Panel zeigt.
function betListeForm(){
  const m=betNeueListe.modus;
  const aktuelle=betListen.find(l=>l.id===betListeId);
  if(m==='umbenennen')
    return '<div class="bet-p"><div class="bet-p-kopf">Liste umbenennen'+
      '<button class="bet-t" data-bet="liste-abbrechen">✕</button></div>'+
      '<div class="bet-fgrid">'+
      '<label class="bf w2">Name<input id="bl_name" value="'+esc(aktuelle?aktuelle.name:'')+'"></label>'+
      '<label class="bf">Leistungsphase<input id="bl_lph" value="'+esc(aktuelle&&aktuelle.lph?String(aktuelle.lph):'')+'" placeholder="z. B. 8"></label>'+
      '<label class="bf">Bauabschnitt<input id="bl_ba" value="'+esc(aktuelle&&aktuelle.bauabschnitt?aktuelle.bauabschnitt:'')+'" placeholder="z. B. BA 1"></label>'+
      '</div><div class="bet-p-akt">'+
      '<button class="btn-sm" data-bet="liste-speichern">Speichern</button>'+
      '<button class="btn-sm ghost" data-bet="liste-abbrechen">Abbrechen</button></div></div>';
  if(m==='vorlage')
    return '<div class="bet-p"><div class="bet-p-kopf">Als Vorlage sichern'+
      '<button class="bet-t" data-bet="liste-abbrechen">✕</button></div>'+
      '<p class="bet-imp-p">Gesichert werden die <b>Gruppen und Rollen</b> dieser Liste — '+
      'keine Firmen und keine Personen. Die Vorlage steht danach beim Anlegen jeder neuen Liste zur Wahl.</p>'+
      '<div class="bet-fgrid">'+
      '<label class="bf w2">Name der Vorlage<input id="bl_name" value="'+esc(aktuelle?aktuelle.name:'')+'" placeholder="z. B. Fachplaner"></label>'+
      '<label class="bf w2">Beschreibung<input id="bl_besch" placeholder="wofür ist sie gedacht?"></label>'+
      '</div><div class="bet-p-akt">'+
      '<button class="btn-sm" data-bet="liste-speichern">Vorlage anlegen</button>'+
      '<button class="btn-sm ghost" data-bet="liste-abbrechen">Abbrechen</button></div></div>';
  // Neue Liste
  return '<div class="bet-p"><div class="bet-p-kopf">Neue Liste'+
    '<button class="bet-t" data-bet="liste-abbrechen">✕</button></div>'+
    '<div class="bet-fgrid">'+
    '<label class="bf w2">Name<input id="bl_name" placeholder="z. B. Fachplaner, Estrich-Angebote"></label>'+
    '<label class="bf w2">Vorlage<select id="bl_vorlage">'+
      '<option value="">— leer, ohne Gruppen —</option>'+
      betVorlagen.map(v=>'<option value="'+v.id+'">'+esc(v.name)+'</option>').join('')+
    '</select></label>'+
    (betVorlagen.length?'<div class="bf w2"><span class="bf-lab">'+
      esc((betVorlagen[0]||{}).beschreibung||'')+'</span></div>':'')+
    '<label class="bf">Leistungsphase<input id="bl_lph" placeholder="optional"></label>'+
    '<label class="bf">Bauabschnitt<input id="bl_ba" placeholder="optional"></label>'+
    '</div><div class="bet-p-akt">'+
    '<button class="btn-sm" data-bet="liste-speichern">Liste anlegen</button>'+
    '<button class="btn-sm ghost" data-bet="liste-abbrechen">Abbrechen</button></div></div>';
}

async function betListeSpeichern(){
  const M=el('main');
  const wert=id=>{const e=M.querySelector('#'+id);return e?e.value.trim():'';};
  const name=wert('bl_name');
  const m=betNeueListe.modus;
  if(!name){betHinweis('Bitte einen Namen angeben.');return;}
  if(m==='umbenennen'){
    const{error}=await sb.from('beteiligten_listen').update({
      name,lph:wert('bl_lph')?Number(wert('bl_lph')):null,
      bauabschnitt:wert('bl_ba')||null}).eq('id',betListeId);
    if(error){betHinweis('Nicht gespeichert: '+betFehler(error));return;}
  }else if(m==='vorlage'){
    const{error}=await sb.rpc('liste_als_vorlage',
      {p_liste:betListeId,p_name:name,p_beschreibung:wert('bl_besch')||null});
    if(error){betHinweis('Nicht gesichert: '+betFehler(error));return;}
    betNeueListe=null;await betNeuZeichnen();
    betHinweis('Vorlage „'+name+'“ angelegt — sie steht jetzt beim Anlegen zur Wahl.');
    return;
  }else{
    const{data,error}=await sb.rpc('liste_anlegen',{
      p_projekt:current,p_name:name,p_vorlage:wert('bl_vorlage')||null,
      p_lph:wert('bl_lph')?Number(wert('bl_lph')):null,p_bauabschnitt:wert('bl_ba')||null});
    if(error){betHinweis('Nicht angelegt: '+betFehler(error));return;}
    betListeId=data;                       // direkt in die neue Liste wechseln
  }
  betNeueListe=null;betSel=null;await betNeuZeichnen();
  betHinweis(m==='umbenennen'?'Umbenannt.':'Liste „'+name+'“ angelegt.');
}

async function betListeLoeschen(){
  const l=betListen.find(x=>x.id===betListeId);if(!l)return;
  const{error}=await sb.from('beteiligten_listen').delete().eq('id',betListeId);
  if(error){betHinweis('Nicht gelöscht: '+betFehler(error));return;}
  betListeId=null;betSel=null;betLoeschFrage=null;
  await betNeuZeichnen();betHinweis('Liste „'+l.name+'“ gelöscht.');
}
// Reiter verschieben: die Nachbarn tauschen den Platz. Danach wird die ganze
// Reihe neu durchnummeriert (10, 20, 30 …), damit doppelte pos-Werte aus
// frueheren Anlagen nicht zu einer zufaelligen Reihenfolge fuehren.
async function betListeSchieben(richtung){
  const i=betListen.findIndex(x=>x.id===betListeId);
  const j=i+richtung;
  if(i<0||j<0||j>=betListen.length){betHinweis('Der Reiter ist schon ganz außen.');return;}
  const R=betListen.slice();R.splice(j,0,R.splice(i,1)[0]);
  for(let k=0;k<R.length;k++){
    const{error}=await sb.from('beteiligten_listen').update({pos:(k+1)*10}).eq('id',R[k].id);
    if(error){betHinweis('Nicht verschoben: '+betFehler(error));return;}
  }
  await betNeuZeichnen();
}

function betUebersicht(){
  const A=betL.filter(r=>r.art==='eintrag');
  if(!A.length)return '<div class="bet-p"><div class="bet-p-kopf">Beteiligtenliste</div>'+
    '<p class="bet-imp-p">Noch keine Einträge. Über „+ Beteiligter“ aus dem Adressbuch übernehmen, '+
    'oder eine bestehende Liste als PDF einlesen.</p></div>';
  // Nur besetzte Zeilen zaehlen als Beteiligte; Platzhalter sind offene Punkte.
  const E=A.filter(r=>r.firma||r.nachname);
  const z={hand:0,analyse:0,crm:0,pdf:0};E.forEach(r=>{z[r.quelle]=(z[r.quelle]||0)+1;});
  const firmen=new Set(E.map(r=>r.firma).filter(Boolean)).size;
  const offen=A.filter(r=>r.status==='offen').length;
  const bh=E.find(r=>r.ist_bauherr);
  const letzte=E.map(r=>r.geaendert_am).filter(Boolean).sort().pop();
  const dateien=[...new Set(E.map(r=>r.importiert_aus).filter(Boolean))];
  const zeile=(l,w)=>'<div class="bet-p-sub"><b>'+w+'</b> '+l+'</div>';
  return '<div class="bet-p"><div class="bet-p-kopf">Stand der Liste</div>'+
    zeile('Beteiligte',E.length)+zeile('Firmen',firmen)+
    (offen?zeile('Gewerke noch nicht vergeben',offen):'')+
    (bh?'<div class="bet-p-adr">Bauherr: '+esc(bh.firma||betName(bh))+'</div>':
        '<div class="bet-p-adr" style="color:#b45309">Kein Bauherr gekennzeichnet</div>')+
    '<div class="bet-p-adr">Herkunft: '+
      [z.hand?z.hand+'× selbst erfasst':'',z.crm?z.crm+'× CRM':'',z.pdf?z.pdf+'× PDF':'',z.analyse?z.analyse+'× Analyse':'']
      .filter(Boolean).join(' · ')+
      (letzte?'<br>zuletzt geändert '+esc(fmtD(letzte)):'')+
      (dateien.length?'<br>Quelle: '+esc(dateien.join(', ')):'')+'</div>'+
    '<p class="bet-imp-p" style="margin-top:14px">Eine Zeile anklicken, um sie anzusehen oder zu bearbeiten.</p></div>';
}

function betDetail(r){
  const K=betKont(r),nm=betName(r),adr=betAdr(r);
  const ico=k=>k.art==='email'?'✉':k.art==='fax'?'📠':k.art==='web'?'🌐':k.art==='mobil'?'📱':'☎';
  return '<div class="bet-p">'+
    '<div class="bet-p-kopf"><span>'+esc(r.nummer)+(r.art==='gruppe'?' · Gruppe':'')+'</span>'+
      '<span class="bet-move">'+
        '<button class="bet-t" data-betup="'+r.id+'" title="nach oben">↑</button>'+
        '<button class="bet-t" data-betdown="'+r.id+'" title="nach unten">↓</button>'+
        '<button class="bet-t" data-betout="'+r.id+'" title="ausrücken">←</button>'+
        '<button class="bet-t" data-betin="'+r.id+'" title="einrücken">→</button></span></div>'+
    '<div class="bet-p-titel">'+esc(r.titel||'—')+'</div>'+
    (r.firma?'<div class="bet-p-sub">'+esc(r.firma)+'</div>':'')+
    (nm?'<div class="bet-p-sub">'+esc(nm)+(r.funktion?' · '+esc(r.funktion):'')+'</div>':'')+
    (adr?'<div class="bet-p-adr">'+esc(adr)+'</div>':'')+
    (K.length?'<div class="bet-p-kon">'+K.map(k=>k.art==='email'
        ?'<a href="mailto:'+esc(k.wert)+'">'+ico(k)+' '+esc(k.wert)+'</a>'
        :'<span>'+ico(k)+' '+esc(k.wert)+'</span>').join('')+'</div>':'')+
    (r.notiz?'<div class="bet-p-adr">'+esc(r.notiz)+'</div>':'')+
    (r.quelle==='pdf'&&r.importiert_aus?'<div class="bet-p-adr">aus '+esc(r.importiert_aus)+
       (r.importiert_am?', eingelesen '+esc(fmtD(r.importiert_am)):'')+'</div>':'')+
    '<div class="bet-p-akt">'+
      (r.art==='eintrag'
        ? '<button class="btn-sm" data-betfill="'+r.id+'" title="Öffnet das Adressbuch. Die gewählte Person wird als weitere Zeile unter dieser Firma angelegt — nichts wird überschrieben.">'+
          (r.firma?'+ Ansprechpartner dieser Firma':'+ Firma zuweisen')+'</button>'
        : '<button class="btn-sm" data-betadd="'+r.id+'" title="Legt eine neue Zeile in dieser Gruppe an">+ Zeile in dieser Gruppe</button>')+
      // Nur sinnvoll, wenn die Zeile selbst die Firmenposition innehat (haengt
      // direkt unter einer Gruppe) und trotzdem eine Person traegt. Bei Zeilen,
      // die schon unter einer Firma stehen, waere der Knopf Unsinn.
      (r.art==='eintrag'&&r.firma&&(r.nachname||r.vorname)&&betIstFirmenzeile(r)
        ? '<button class="btn-sm ghost" data-betrunter="'+r.id+'" title="Firma bleibt oben stehen, die Person rückt eine Ebene tiefer">Person nach unten</button>':'')+
      '<button class="btn-sm ghost" data-betedit="'+r.id+'">Bearbeiten</button>'+
      (r.crm_company_id?'<button class="btn-sm ghost" data-betfirma="'+r.crm_company_id+'" title="Zeigt alle im CRM hinterlegten Ansprechpartner dieser Firma zum Anklicken">Alle Personen dieser Firma</button>':'')+
      '<button class="btn-sm ghost" data-betdel="'+r.id+'">Löschen</button>'+
    '</div></div>';
}

// Formular: alle Felder eines Knotens. Ohne id wird angelegt, sonst geaendert.
function betForm(e){
  const isG=e.art==='gruppe',K=e.kontakte||[];
  const opt=(list,val)=>list.map(o=>'<option value="'+o[0]+'"'+(o[0]===val?' selected':'')+'>'+o[1]+'</option>').join('');
  let h='<div class="bet-p"><div class="bet-p-kopf">'+(e.id?'Bearbeiten':(isG?'Neue Gruppe':'Neuer Beteiligter'))+
        '<button class="bet-t" data-bet="abbrechen" title="schließen">✕</button></div>';
  h+='<div class="bet-fgrid">';
  h+='<label class="bf w2">'+(isG?'Gruppentitel':'Rolle im Projekt')+
     '<input id="bf_titel" list="bf_rollen" value="'+esc(e.titel||'')+'" placeholder="'+(isG?'z. B. Ausführende Firmen':'z. B. Fachplanung Statik')+'"></label>';
  h+='<datalist id="bf_rollen">'+betRollen.map(r=>'<option value="'+esc(r.rolle)+'">').join('')+'</datalist>';
  h+='<label class="bf">Nummer<input id="bf_nummer" value="'+esc(e.nummer_manuell||'')+'" placeholder="'+esc(e.nummer||'automatisch')+'"></label>';
  if(!isG){
    h+='<label class="bf">Status<select id="bf_status">'+opt([['aktiv','aktiv'],['offen','noch offen'],['ausgeschieden','ausgeschieden']],e.status||'aktiv')+'</select></label>';
    h+='<label class="bf w2">Firma / Stelle<input id="bf_firma" value="'+esc(e.firma||'')+'"></label>';
    h+='<label class="bf">Anrede<input id="bf_anrede" value="'+esc(e.anrede||'')+'" placeholder="Herr"></label>';
    h+='<label class="bf">Titel<input id="bf_namenstitel" value="'+esc(e.namenstitel||'')+'" placeholder="Dipl.-Ing."></label>';
    h+='<label class="bf">Vorname<input id="bf_vorname" value="'+esc(e.vorname||'')+'"></label>';
    h+='<label class="bf">Nachname<input id="bf_nachname" value="'+esc(e.nachname||'')+'"></label>';
    h+='<label class="bf w2">Position in der Firma<input id="bf_funktion" value="'+esc(e.funktion||'')+'"></label>';
    h+='<label class="bf w2">Straße<input id="bf_strasse" value="'+esc(e.strasse||'')+'"></label>';
    h+='<label class="bf">PLZ<input id="bf_plz" value="'+esc(e.plz||'')+'"></label>';
    h+='<label class="bf">Ort<input id="bf_ort" value="'+esc(e.ort||'')+'"></label>';
    h+='<label class="bf w2">Notiz<input id="bf_notiz" value="'+esc(e.notiz||'')+'"></label>';
    h+='<div class="bf w2"><span class="bf-lab">Kontaktwege</span><div id="bf_konts">';
    (K.length?K:[{art:'telefon',kontext:'arbeit',wert:''}]).forEach((k,i)=>{
      h+='<div class="bf-k" data-ki="'+i+'"><select class="bf-kart">'+opt(BET_KONTAKTARTEN,k.art)+'</select>'+
         '<select class="bf-kctx">'+opt(BET_KONTEXTE,k.kontext||'arbeit')+'</select>'+
         '<input class="bf-kval" value="'+esc(k.wert||'')+'" placeholder="Nummer / Adresse">'+
         '<button class="bet-t del" data-bfkdel="'+i+'" title="entfernen">🗑</button></div>';});
    h+='</div><button class="btn-sm ghost" data-bet="kont-plus">+ Kontaktweg</button></div>';
    h+='<label class="bf ck"><input type="checkbox" id="bf_bh"'+(e.ist_bauherr?' checked':'')+'> Bauherrenseite</label>';
    h+='<label class="bf ck"><input type="checkbox" id="bf_int"'+(e.ist_intern?' checked':'')+'> eigenes Büro</label>';
  }
  h+='</div>';
  h+='<div class="bet-p-akt"><button class="btn-sm" data-bet="speichern">Speichern</button>'+
     (!isG?'<button class="btn-sm ghost" data-bet="crm-auf">Aus Adressbuch füllen</button>':'')+
     '<button class="btn-sm ghost" data-bet="abbrechen">Abbrechen</button></div></div>';
  return h;
}
// --- Beteiligtenliste: laden, speichern, umsortieren ------------------------
// true, wenn gerade Zeilen aus der Analyse in der Liste stehen (Schalterzustand)
let betAnalyseAn=false;
async function betLaden(){
  // Listen des Projekts zuerst — ohne sie weiss man nicht, welche Zeilen gelten.
  const{data:LI}=await sb.from('beteiligten_listen')
    .select('id,name,vorlage_id,lph,bauabschnitt,pos').eq('project_id',current).order('pos');
  betListen=LI||[];
  if(!betListen.some(x=>x.id===betListeId))betListeId=betListen.length?betListen[0].id:null;
  const[{data:L},{data:R},{data:V}]=await Promise.all([
    betListeId?sb.rpc('beteiligte_liste',{p_liste:betListeId}):Promise.resolve({data:[]}),
    betRollen.length?Promise.resolve({data:betRollen}):sb.from('beteiligten_rollen').select('rolle,bereich').order('bereich').order('pos'),
    sb.from('listen_vorlagen').select('id,name,beschreibung').order('pos')]);
  betL=L||[];betRollen=R||[];betVorlagen=V||[];
  betAnalyseAn=betL.some(r=>r.art==='eintrag'&&(r.quelle==='analyse'||r.analyse_befuellt));
}
// Datenbankfehler in einen Satz uebersetzen, mit dem man etwas anfangen kann.
// Haeufigster Fall: das Projekt wurde inzwischen geloescht oder umbenannt, die
// offene Seite zeigt noch die alte Kennung -- dann hilft nur neu laden.
function betFehler(e){
  const m=String((e&&e.message)||e||'');
  if(/beteiligte_project_id_fkey|violates foreign key/i.test(m))
    return 'Dieses Projekt gibt es nicht mehr (oder die Seite ist veraltet). Bitte die Seite neu laden.';
  if(/row-level security|permission denied/i.test(m))
    return 'Keine Berechtigung — bist du noch mit dem Büro-Konto angemeldet?';
  if(/duplicate key/i.test(m))
    return 'Dieser Eintrag steht schon in der Liste.';
  return m;
}
function betHinweis(t){const e=el('main').querySelector('#bethint');if(e){e.textContent=t;if(t)setTimeout(()=>{if(e.textContent===t)e.textContent='';},3500);}}
// Nur den Fensterinhalt neu zeichnen — ein voller render() wuerde das Formular schliessen.
async function betNeuZeichnen(){await betLaden();const bd=el('main').querySelector('.win[data-sec="beteiligte"] .win-bd');
  if(!bd){render();return;}bd.innerHTML=renderBet();wireBet();}

function betFormLesen(){
  const g=id=>{const e=el('main').querySelector('#'+id);return e?e.value.trim():'';};
  const ck=id=>{const e=el('main').querySelector('#'+id);return !!(e&&e.checked);};
  const konts=[];el('main').querySelectorAll('#bf_konts .bf-k').forEach(z=>{
    const w=z.querySelector('.bf-kval').value.trim();
    if(w)konts.push({art:z.querySelector('.bf-kart').value,kontext:z.querySelector('.bf-kctx').value,wert:w});});
  const isG=betEdit&&betEdit.art==='gruppe';
  const d={art:isG?'gruppe':'eintrag',titel:g('bf_titel')||null,nummer_manuell:g('bf_nummer')||null};
  if(!isG)Object.assign(d,{firma:g('bf_firma')||null,anrede:g('bf_anrede')||null,namenstitel:g('bf_namenstitel')||null,
    vorname:g('bf_vorname')||null,nachname:g('bf_nachname')||null,funktion:g('bf_funktion')||null,
    strasse:g('bf_strasse')||null,plz:g('bf_plz')||null,ort:g('bf_ort')||null,notiz:g('bf_notiz')||null,
    status:g('bf_status')||'aktiv',ist_bauherr:ck('bf_bh'),ist_intern:ck('bf_int'),kontakte:konts});
  return d;
}
async function betSpeichern(){
  const d=betFormLesen();
  if(!d.titel&&!d.firma){betHinweis('Bitte mindestens Rolle oder Firma angeben.');return;}
  if(betEdit.id){
    const{error}=await sb.from('beteiligte').update(d).eq('id',betEdit.id);
    if(error){betHinweis('Nicht gespeichert: '+betFehler(error));return;}
  }else{
    // ans Ende des Zielzweigs
    const gesch=betL.filter(r=>(r.parent_id||null)===(betEdit.parent_id||null));
    const pos=gesch.length?Math.max(...gesch.map((_,i)=>i))*10+10:10;
    const{error}=await sb.from('beteiligte').insert(Object.assign({project_id:current,listen_id:betListeId,parent_id:betEdit.parent_id||null,
      pos:pos+10,quelle:betEdit.quelle||'hand'},d,betEdit.crm||{}));
    if(error){betHinweis('Nicht angelegt: '+betFehler(error));return;}
  }
  betEdit=null;await betNeuZeichnen();betHinweis('Gespeichert.');
}
// Loeschen wird im Arbeitsbereich rechts bestaetigt, nicht ueber den
// Browser-Dialog: der reisst den Fokus aus der App und sieht fremd aus.
async function betLoeschen(id){
  const{error}=await sb.from('beteiligte').delete().eq('id',id);
  if(error){betHinweis('Nicht gelöscht: '+betFehler(error));return;}
  betLoeschFrage=null;if(betSel===id)betSel=null;
  await betNeuZeichnen();betHinweis('Gelöscht.');
}
// Rueckfrage vor dem Loeschen — als Panel, mit Hinweis auf Unterzeilen.
function betLoeschPanel(r){
  const kinder=betL.filter(x=>x.parent_id===r.id).length;
  const was=r.art==='gruppe'?'Gruppe':'Eintrag';
  return '<div class="bet-p"><div class="bet-p-kopf">'+was+' löschen?'+
    '<button class="bet-t" data-bet="del-nein" title="abbrechen">✕</button></div>'+
    '<div class="bet-p-titel">'+esc(r.titel||r.firma||'—')+'</div>'+
    (r.firma&&r.titel?'<div class="bet-p-sub">'+esc(r.firma)+'</div>':'')+
    (kinder?'<div class="bet-warnbox">Dazu gehören '+kinder+' untergeordnete Zeile'+(kinder===1?'':'n')+
      ' — sie werden mitgelöscht.</div>':'')+
    '<div class="bet-p-akt"><button class="btn-sm rot" data-betdelok="'+r.id+'">Endgültig löschen</button>'+
    '<button class="btn-sm ghost" data-bet="del-nein">Abbrechen</button></div></div>';
}
// Eine Person aus der Firmenzeile in eine Unterzeile schieben: oben bleibt die
// Firma, darunter steht der Ansprechpartner. So sieht die Papierliste aus.
async function betPersonRunter(id){
  const r=betL.find(x=>x.id===id);if(!r||!(r.nachname||r.vorname))return;
  const kinder=betL.filter(x=>x.parent_id===id).length;
  const{error:e1}=await sb.from('beteiligte').insert({
    project_id:current,listen_id:betListeId,parent_id:id,art:'eintrag',pos:(kinder+1)*10,
    titel:r.titel,firma:r.firma,anrede:r.anrede,namenstitel:r.namenstitel,
    vorname:r.vorname,nachname:r.nachname,funktion:r.funktion,
    strasse:r.strasse,plz:r.plz,ort:r.ort,kontakte:betKont(r),
    quelle:r.quelle,crm_company_id:r.crm_company_id,crm_person_id:r.crm_person_id});
  if(e1){betHinweis('Nicht verschoben: '+betFehler(e1));return;}
  // Oben bleiben Rolle und Firma stehen; Personendaten und persoenliche
  // Kontakte wandern mit nach unten.
  const{error:e2}=await sb.from('beteiligte').update({
    anrede:null,namenstitel:null,vorname:null,nachname:null,funktion:null,
    kontakte:[],crm_person_id:null}).eq('id',id);
  if(e2){betHinweis('Nicht verschoben: '+betFehler(e2));return;}
  await betNeuZeichnen();betHinweis('Person steht jetzt unter der Firma.');
}
// Umsortieren: pos der Geschwister neu vergeben (10,20,30 …) und tauschen.
async function betVerschieben(id,richtung){
  const r=betL.find(x=>x.id===id);if(!r)return;
  const gesch=betL.filter(x=>(x.parent_id||null)===(r.parent_id||null));
  const i=gesch.findIndex(x=>x.id===id),j=i+(richtung==='up'?-1:1);
  if(j<0||j>=gesch.length)return;
  const neu=gesch.slice();neu.splice(j,0,neu.splice(i,1)[0]);
  await Promise.all(neu.map((x,k)=>sb.from('beteiligte').update({pos:(k+1)*10}).eq('id',x.id)));
  await betNeuZeichnen();
}
// Einruecken: unter die vorhergehende Geschwisterzeile haengen. Ausruecken: eine Ebene hoeher.
async function betEbene(id,rein){
  const r=betL.find(x=>x.id===id);if(!r)return;
  let ziel;
  if(rein){
    const gesch=betL.filter(x=>(x.parent_id||null)===(r.parent_id||null));
    const i=gesch.findIndex(x=>x.id===id);
    if(i<=0){betHinweis('Zum Einrücken muss eine Zeile darüber stehen.');return;}
    ziel=gesch[i-1].id;
  }else{
    if(!r.parent_id){betHinweis('Diese Zeile ist bereits auf oberster Ebene.');return;}
    ziel=(betL.find(x=>x.id===r.parent_id)||{}).parent_id||null;
  }
  const{error}=await sb.from('beteiligte').update({parent_id:ziel,pos:9999}).eq('id',id);
  if(error){betHinweis('Nicht verschoben: '+betFehler(error));return;}
  await betNeuZeichnen();
}
// "Aus Analyse" ist ein Schalter: einmal holt die Vorschlaege, nochmal nimmt sie
// wieder heraus. Von Hand Ergaenztes bleibt dabei stehen (siehe Migration 92).
async function betAusAnalyse(){
  if(!betL.length){betHinweis('Erst die Gliederung anlegen, dann übernehmen.');return;}
  if(betAnalyseAn){
    const{data,error}=await sb.rpc('beteiligte_analyse_entfernen',{p_liste:betListeId});
    if(error){betHinweis('Fehler: '+betFehler(error));return;}
    await betNeuZeichnen();
    betHinweis(data?(data+' Zeile(n) aus der Analyse wieder entfernt.'):'Nichts zu entfernen.');
    return;}
  const{data,error}=await sb.rpc('beteiligte_aus_analyse',{p_liste:betListeId});
  if(error){betHinweis('Fehler: '+betFehler(error));return;}
  await betNeuZeichnen();
  betHinweis(data?(data+' Beteiligte übernommen — mit dem CRM abgeglichen.'):'Nichts Neues in der Analyse gefunden.');
}
async function betVerteiler(){
  const mails=[];betL.forEach(r=>{if(r.art!=='eintrag'||r.status==='ausgeschieden')return;
    betKont(r).forEach(k=>{if(k.art==='email'&&k.wert&&!mails.includes(k.wert))mails.push(k.wert);});});
  if(!mails.length){betHinweis('Keine E-Mail-Adressen in der Liste.');return;}
  try{await navigator.clipboard.writeText(mails.join('; '));betHinweis(mails.length+' Adressen kopiert.');}
  catch(e){betHinweis('Kopieren nicht möglich: '+e.message);}
}
// Druckfassung im Layout der Papierliste: Nummer rechts, Beteiligte links, Kontakte in eigener Spalte.
// --- PDF-Import: bestehende Beteiligtenlisten einlesen -----------------------
// Das Buero-Formular hat drei Spalten (Beteiligte | Tel./Fax/E-Mail | Nummer).
// Deshalb wird nicht der Fliesstext gelesen, sondern jeder Textschnipsel mit
// seiner Position: die Nummern rechts markieren das Ende je Eintrag, alles
// darueber gehoert dazu. Faellt das Raster aus (fremdes Layout), greift der
// Zeilen-Rueckfall in betPdfBloecke().
let betPdfLib=null;
async function betPdfLaden(){
  if(betPdfLib)return betPdfLib;
  const v='4.7.76';
  const m=await import('https://esm.sh/pdfjs-dist@'+v+'/build/pdf.min.mjs');
  m.GlobalWorkerOptions.workerSrc='https://esm.sh/pdfjs-dist@'+v+'/build/pdf.worker.min.mjs';
  betPdfLib=m;return m;
}
async function betPdfSchnipsel(datei){
  const pdfjs=await betPdfLaden();
  const buf=await datei.arrayBuffer();
  const doc=await pdfjs.getDocument({data:buf}).promise;
  const seiten=[];
  for(let s=1;s<=doc.numPages;s++){
    const p=await doc.getPage(s),vp=p.getViewport({scale:1}),tc=await p.getTextContent();
    const items=tc.items.filter(i=>(i.str||'').trim()).map(i=>({
      text:i.str.trim(),x:i.transform[4],y:vp.height-i.transform[5],breite:vp.width}));
    seiten.push(items);
  }
  return seiten;
}
// Das Buero-Formular setzt die Gliederungsnummer LINKS neben den Eintrag und
// rueckt sie je Ebene um ~20 pt ein (56 / 76 / 96). Daraus faellt die komplette
// Hierarchie ab: Nummer = Anfang eines Blocks, x = Tiefe, Text bei ~156,
// Kontakte bei ~331. Bloecke werden je Seite gebildet (y zaehlt je Seite neu)
// und danach zu einer Liste verkettet.
function betPdfBloecke(seiten){
  const alle=[];
  seiten.forEach(items=>{
    const breite=(items[0]||{}).breite||595;
    const gText=breite*0.24,gKon=breite*0.5;
    // Kopf- und Fusszeile des Formulars ausklammern
    const hoehe=Math.max(...items.map(i=>i.y),0);
    const nutz=items.filter(i=>i.y>110&&i.y<hoehe-8);
    const anker=nutz.filter(i=>i.x<gText&&/^\d+(\.\d+)*$/.test(i.text)).sort((a,b)=>a.y-b.y);
    if(!anker.length){
      // Fremdes Layout ohne Nummernspalte: alles der Seite als ein Block anbieten
      if(nutz.length)alle.push({nummer:'',x:0,links:nutz.filter(i=>i.x<gKon).sort((a,b)=>a.y-b.y).map(i=>i.text),
        kontakte:nutz.filter(i=>i.x>=gKon).sort((a,b)=>a.y-b.y).map(i=>i.text)});
      return;}
    anker.forEach((n,idx)=>{
      const vonY=n.y-6,bisY=idx+1<anker.length?anker[idx+1].y-6:Infinity;
      const drin=nutz.filter(i=>i.y>=vonY&&i.y<bisY&&i.x>=gText);
      alle.push({nummer:n.text,x:n.x,
        links:drin.filter(i=>i.x<gKon).sort((a,b)=>a.y-b.y||a.x-b.x).map(i=>i.text),
        kontakte:drin.filter(i=>i.x>=gKon).sort((a,b)=>a.y-b.y||a.x-b.x).map(i=>i.text)});});
    // Zeilen oberhalb der ersten Nummer sind die Fortsetzung des letzten Blocks
    // der Vorseite (z. B. die Anschrift, die umgebrochen ist).
    const rest=nutz.filter(i=>i.y<anker[0].y-6&&i.x>=gText);
    if(rest.length&&alle.length>anker.length){
      const vor=alle[alle.length-anker.length-1];
      rest.sort((a,b)=>a.y-b.y).forEach(i=>{(i.x<gKon?vor.links:vor.kontakte).push(i.text);});}
  });
  // Ebene aus der Einrueckung; Gruppentitel = ohne Kontakte und der naechste Block liegt tiefer
  const xs=[...new Set(alle.map(b=>b.x).filter(x=>x>0))].sort((a,b)=>a-b);
  alle.forEach(b=>{b.ebene=Math.max(0,xs.indexOf(b.x));});
  alle.forEach((b,i)=>{const n=alle[i+1];
    b.istGruppe=!b.kontakte.length&&b.links.length<=1&&!!n&&n.ebene>b.ebene;});
  return alle;
}
const BET_PLZ=/^([A-Z]{1,2}-)?\d{4,5}\s+\S/;
const BET_KONT=/^(Telefon|Mobiltelefon|Mobil|E-?Mail|Fax|URL|Web)\s*\(?([^)]*)\)?\s*:\s*(.+)$/i;
function betPdfEintrag(b){
  const e={titel:null,firma:null,anrede:null,vorname:null,nachname:null,namenstitel:null,
           strasse:null,plz:null,ort:null,kontakte:[],status:'aktiv'};
  // Kontaktspalte
  [...b.kontakte,...b.links].forEach(t=>{
    const m=t.match(BET_KONT);if(!m)return;
    const a=m[1].toLowerCase(),k=(m[2]||'').toLowerCase(),wert=m[3].trim();
    if(!wert)return;
    const art=a.startsWith('e')?'email':a==='fax'?'fax':(a==='url'||a==='web')?'web'
              :(a.startsWith('mobil')||k.includes('mobil'))?'mobil':'telefon';
    const kontext=k.includes('privat')?'privat':k.includes('zentral')?'zentrale':'arbeit';
    if(!e.kontakte.some(x=>x.wert===wert))e.kontakte.push({art,kontext,wert});});
  // Linke Spalte: Rolle, Firma (ggf. mehrzeilig), Person, Anschrift
  const rest=b.links.filter(t=>!BET_KONT.test(t));
  const firma=[];let personDa=false;
  rest.forEach((t,i)=>{
    if(i===0){e.titel=t;return;}
    const plz=t.match(BET_PLZ);
    if(plz){const p=t.match(/^([A-Z]{1,2}-)?(\d{4,5})\s+(.+)$/);
      if(p){e.plz=p[2];e.ort=p[3].trim();}
      // die Zeile davor war die Strasse, nicht der Firmenname
      if(firma.length&&/\d/.test(firma[firma.length-1]))e.strasse=firma.pop();
      return;}
    const per=t.match(/^(Herr|Frau)\s+(.*)$/);
    if(per){e.anrede=per[1];personDa=true;
      let n=per[2].trim();
      const tit=n.match(/^((?:Dipl\.?[-\w.()]*|Prof\.?|Dr\.?|Ing\.?|\(FH\))(?:\s+(?:Dipl\.?[-\w.()]*|Prof\.?|Dr\.?|Ing\.?|\(FH\)))*)\s+(.+)$/);
      if(tit){e.namenstitel=tit[1].trim();n=tit[2].trim();}
      const teile=n.split(/\s+/);
      e.nachname=teile.pop()||null;e.vorname=teile.join(' ')||null;
      return;}
    // Steht die Person schon fest, ist die naechste freie Zeile die Fortsetzung
    // des Namens (im Formular brechen lange Namen um: "… Thomas" / "Scheuerer"),
    // nicht ein zweiter Firmenname.
    if(personDa){e.vorname=[e.vorname,e.nachname].filter(Boolean).join(' ')||null;e.nachname=t;return;}
    firma.push(t);});
  if(firma.length)e.firma=firma.join(' ').replace(/\s+/g,' ').trim();
  // Personennamen, die ohne Herr/Frau am Stueck stehen, bleiben im Firmenfeld —
  // lieber sichtbar falsch zugeordnet als still verschluckt; der Mensch korrigiert.
  if(!e.titel&&!e.firma&&!e.nachname)return null;
  return e;
}
async function betPdfImport(datei){
  const box=el('main').querySelector('#bet_pdfres');
  if(box)box.innerHTML='<div class="empty">Lese '+esc(datei.name)+' …</div>';
  let seiten;
  try{seiten=await betPdfSchnipsel(datei);}
  catch(e){if(box)box.innerHTML='<div class="empty">PDF nicht lesbar: '+esc(e.message)+'</div>';return;}
  const gefunden=[];
  betPdfBloecke(seiten).forEach(b=>{
    const e=betPdfEintrag(b);
    if(!e)return;
    if(/^(Projekt-?Beteiligte|Beteiligte|Nummer|Projekt|Tel\.?\/Fax)/i.test(e.titel||''))return;
    e.nummer=b.nummer;e.ebene=b.ebene;e.istGruppe=b.istGruppe;
    // Zeile ohne Firma, Person und Kontakte = noch nicht vergebenes Gewerk
    if(!e.istGruppe&&!e.firma&&!e.nachname&&!e.kontakte.length)e.status='offen';
    gefunden.push(e);});
  betPdfFunde=gefunden;betPdfName=datei.name;
  betEdit=null;betCrmOffen=false;betCrmFirma=null;
  betNurSeite();
}
// Vorschau: was steckt in der Datei, was ist davon neu?
function betPdfVorschau(){
  if(!betPdfFunde)return '';
  const F=betPdfFunde;
  if(!F.length)return '<div class="bet-imp"><div class="bet-imp-head">Keine Beteiligten erkannt</div>'+
    '<p class="bet-imp-p">In „'+esc(betPdfName||'')+'“ war das gewohnte Spaltenraster nicht zu finden. '+
    'Bitte eine Liste im Büro-Format hochladen oder die Zeilen von Hand anlegen.</p>'+
    '<div class="bet-form-foot"><button class="btn-sm ghost" data-bet="pdf-abbrechen">Schließen</button></div></div>';
  const da=e=>!e.istGruppe&&betL.some(r=>r.art==='eintrag'
    &&(r.firma||'').toLowerCase().trim()===(e.firma||'').toLowerCase().trim()
    &&(r.nachname||'').toLowerCase().trim()===(e.nachname||'').toLowerCase().trim());
  const neu=F.filter(e=>!da(e)).length,gruppen=F.filter(e=>e.istGruppe).length;
  const mitGliederung=F.some(e=>e.ebene>0);
  let h='<div class="bet-imp"><div class="bet-imp-head">'+esc(betPdfName||'PDF')+' — '+F.length+
    ' Zeilen erkannt, davon '+neu+' neu<button class="bet-t" data-bet="pdf-abbrechen" title="schließen">✕</button></div>'+
    '<p class="bet-imp-p">Haken setzen, was übernommen werden soll. Was schon in der Liste steht, ist vorentfernt. '+
    (mitGliederung?'Die Gliederung des PDFs ('+gruppen+' Gruppen) wird mit übernommen — die Zeilen hängen danach so untereinander wie im Ausdruck. ':'')+
    'Die Gliederungsnummern werden dabei neu und lückenlos vergeben; die alten stehen hier zum Vergleich. '+
    'Alles Übernommene trägt die Herkunft „PDF“ mit Dateinamen.</p>'+
    '<label class="bet-imp-ziel">Einhängen unter <select id="bet_imp_ziel">'+
    '<option value="">— oberste Ebene —</option>'+
    betL.filter(r=>r.art==='gruppe').map(g=>'<option value="'+g.id+'">'+esc(g.nummer+' '+(g.titel||''))+'</option>').join('')+
    '</select></label><div class="bet-imp-list">';
  F.forEach((e,i)=>{
    const vorhanden=da(e);
    const nm=[e.anrede,e.namenstitel,e.vorname,e.nachname].filter(Boolean).join(' ');
    h+='<label class="bet-imp-row'+(vorhanden?' da':'')+(e.istGruppe?' grp':'')+'" style="--ilvl:'+(e.ebene||0)+'">'+
       '<input type="checkbox" data-impi="'+i+'"'+(vorhanden?'':' checked')+'>'+
       '<span class="bet-imp-tx"><b>'+(e.nummer?'<span class="nr">'+esc(e.nummer)+'</span> ':'')+esc(e.titel||'—')+
       (e.istGruppe?'<span class="bet-tag an">Gruppe</span>':'')+
       (e.status==='offen'?'<span class="bet-tag off">noch offen</span>':'')+'</b>'+
       (e.firma?'<span>'+esc(e.firma)+'</span>':'')+
       (nm?'<span>'+esc(nm)+'</span>':'')+
       ((e.plz||e.ort)?'<span class="q">'+esc([e.strasse,[e.plz,e.ort].filter(Boolean).join(' ')].filter(Boolean).join(', '))+'</span>':'')+
       (e.kontakte.length?'<span class="q">'+esc(e.kontakte.map(k=>k.wert).join(' · '))+'</span>':'')+
       (vorhanden?'<span class="q da">steht schon in der Liste</span>':'')+'</span></label>';});
  h+='</div><div class="bet-form-foot"><button class="btn-sm" data-bet="pdf-uebernehmen">Ausgewählte übernehmen</button>'+
     '<button class="btn-sm ghost" data-bet="pdf-abbrechen">Abbrechen</button></div></div>';
  return h;
}
// Uebernahme in Ebenen: erst die oberste Ebene anlegen, dann deren Kinder unter
// die frisch vergebenen IDs. Eine ausgelassene Gruppe wuerde ihre Kinder mitnehmen,
// deshalb haengen verwaiste Zeilen an den naechsten vorhandenen Vorfahren.
async function betPdfUebernehmen(){
  const bd=el('main').querySelector('.win[data-sec="beteiligte"] .win-bd');
  const wurzel=(bd.querySelector('#bet_imp_ziel')||{}).value||null;
  const gewaehlt=new Set([...bd.querySelectorAll('[data-impi]')].filter(c=>c.checked).map(c=>+c.dataset.impi));
  if(!gewaehlt.size){betHinweis('Nichts ausgewählt.');return;}
  const stempel=new Date().toISOString();
  const F=betPdfFunde;
  const elternFuer=[];           // Elternteil je Ebene, waehrend wir durchlaufen
  const zuTun=[];                // {index, ebene, vater}
  // Nicht jede Ebene ist im Ausdruck besetzt: "2.1.1 Architekt" springt von
  // Ebene 0 ("2 Gesamtplanung") direkt auf Ebene 2, weil die Zwischengruppe 2.1
  // nie gedruckt wird. Darum immer den naechsten VORHANDENEN Vorfahren suchen,
  // sonst rutschen solche Zeilen auf die oberste Ebene.
  const vorfahr=eb=>{for(let k=eb-1;k>=0;k--)if(elternFuer[k]!==undefined)return elternFuer[k];return undefined;};
  F.forEach((e,i)=>{
    const eb=e.ebene||0;
    elternFuer.length=eb;        // tiefere Ebenen sind mit diesem Knoten hinfaellig
    if(gewaehlt.has(i))zuTun.push({i,eb,vater:vorfahr(eb)});
    elternFuer[eb]=gewaehlt.has(i)?i:vorfahr(eb);
  });
  const idVon={};                // PDF-Index -> neue Datenbank-ID
  const ebenen=[...new Set(zuTun.map(z=>z.eb))].sort((a,b)=>a-b);
  let angelegt=0;
  const basis=betL.filter(r=>(r.parent_id||null)===(wurzel||null)).length;
  for(const eb of ebenen){
    const stapel=zuTun.filter(z=>z.eb===eb);
    const zeilen=stapel.map(z=>{const e=F[z.i];
      const vater=z.vater!==undefined?idVon[z.vater]:undefined;
      // pos aus der Position im PDF: so bleibt die Reihenfolge des Ausdrucks erhalten
      return{project_id:current,listen_id:betListeId,parent_id:vater!==undefined?vater:wurzel,
        art:e.istGruppe?'gruppe':'eintrag',pos:(basis+1)*10+z.i*10,
        titel:e.titel,firma:e.istGruppe?null:e.firma,anrede:e.anrede,namenstitel:e.namenstitel,
        vorname:e.vorname,nachname:e.nachname,strasse:e.strasse,plz:e.plz,ort:e.ort,
        kontakte:e.istGruppe?[]:e.kontakte,status:e.istGruppe?'aktiv':(e.status||'aktiv'),
        ist_bauherr:/bauherr|auftraggeber/i.test(e.titel||''),
        quelle:'pdf',importiert_aus:betPdfName,importiert_am:stempel};});
    const{data,error}=await sb.from('beteiligte').insert(zeilen).select('id');
    if(error){betHinweis('Nicht übernommen: '+betFehler(error));return;}
    (data||[]).forEach((r,k)=>{idVon[stapel[k].i]=r.id;});
    angelegt+=zeilen.length;
  }
  betPdfFunde=null;betPdfName='';
  await betNeuZeichnen();betHinweis(angelegt+' Zeilen aus dem PDF übernommen.');
}

// --- Adressbuch (Poool-Spiegel) ---------------------------------------------
// Zwei Ebenen: erst Firmen und Personen, dann eine Firma mit allen Mitarbeitern.
// Aus der Firmenansicht lassen sich mehrere Personen auf einmal uebernehmen --
// genau der Fall "ich brauche von dem Buero noch zwei weitere Leute".
function betCrmPanel(){
  if(betCrmFirma)return betCrmFirmaPanel();
  const f=(id,label)=>'<button class="bet-crm-f'+(betCrmFilter===id?' an':'')+'" data-crmfilter="'+(id||'')+'">'+label+'</button>';
  let h='<div class="bet-p"><div class="bet-p-kopf">Adressbuch'+
    '<span>'+(betEdit?'<button class="bet-t" data-bet="crm-zu" title="ohne Adressbuch weiter">von Hand eintragen ›</button>':'')+
    '<button class="bet-t" data-bet="abbrechen" title="schließen">✕</button></span></div>'+
    '<div class="bet-crm-box"><input id="bf_crmq" placeholder="Firma, Nachname oder Ort" value="'+esc(betCrmQ||'')+'">'+
    '<button class="btn-sm" data-bet="crm-suche">Suchen</button></div>'+
    '<div class="bet-crm-filter">'+f(null,'Alle')+f('lieferant','Firmen &amp; Planer')+f('kunde','Auftraggeber')+f('intern','Eigenes Büro')+'</div>'+
    '<div id="bf_crmres" class="bet-crm-res"></div></div>';
  return h;
}

// Ergebnisliste zeichnen (ohne das ganze Panel neu zu bauen — das Eingabefeld
// soll den Fokus behalten).
function betCrmTreffer(T){
  if(!T.length)return '<div class="bet-leer">'+(betCrmQ
    ?'Nichts gefunden zu „'+esc(betCrmQ)+'“.'
    :'Keine Einträge — läuft der Abgleich? (node runner/poool_sync.mjs)')+'</div>';
  return T.map((r,i)=>{
    if(r.art==='firma')
      return '<button class="bet-crm-hit'+(r.grund?' merk':'')+'" data-crmfirma="'+r.crm_id+'">'+
        '<span class="ico">🏢</span><span class="tx">'+
        '<span class="h1">'+esc(r.firma||'—')+'</span>'+
        '<span class="h2">'+esc([r.plz,r.ort].filter(Boolean).join(' ')||'Firma')+'</span>'+
        (r.grund?'<span class="h3">★ '+esc(r.grund)+'</span>':'')+
        '</span><span class="pfeil">›</span></button>';
    // Der Hinweis "schon beauftragt" gilt der FIRMA. An jeder einzelnen Person
    // wiederholt faerbte er fast die ganze Liste gruen und sagte nichts aus.
    const nm=[r.anrede,r.namenstitel,r.vorname,r.nachname].filter(Boolean).join(' ');
    return '<button class="bet-crm-hit" data-crmi="'+i+'">'+
      '<span class="ico">👤</span><span class="tx">'+
      '<span class="h1">'+esc(nm||'—')+'</span>'+
      '<span class="h2">'+esc([r.firma||'ohne Firma',r.funktion].filter(Boolean).join(' · '))+'</span>'+
      '</span></button>';}).join('');
}

// Firmenansicht: Kopf mit Anschrift, darunter alle Mitarbeiter zum Ankreuzen.
// Firmenansicht: Kopf mit Anschrift, darunter alle Ansprechpartner. Ein Klick
// auf eine Person legt sie SOFORT an -- die Ansicht bleibt stehen, damit man
// mehrere hintereinander wegklicken kann. Wer schon in der Liste steht, ist
// abgehakt und nicht mehr anklickbar.
function betCrmFirmaPanel(){
  const F=betCrmFirma,M=betCrmMit||[];
  const adr=[F.strasse,[F.plz,F.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const drin=new Set(betL.filter(r=>r.crm_person_id).map(r=>r.crm_person_id));
  const offenN=M.filter(p=>!drin.has(p.crm_id)).length;
  let h='<div class="bet-p">'+
    '<button class="bet-crm-zurueck" data-bet="crm-zurueck">‹ zurück zum Adressbuch</button>'+
    '<div class="bet-firma-kopf"><div class="n">'+esc(F.firma||'—')+'</div>'+
    (adr?'<div class="a">'+esc(adr)+'</div>':'')+
    '<div class="bet-p-akt" style="margin-top:9px;padding-top:9px">'+
      '<button class="btn-sm ghost" data-bet="crm-firma-uebernehmen">Nur die Firma</button></div></div>';
  if(!M.length){
    h+='<div class="bet-leer">Zu dieser Firma sind im CRM keine Ansprechpartner hinterlegt.</div></div>';
    return h;}
  // Eine Rolle fuer alle, die von hier uebernommen werden.
  h+='<label class="bf w2" style="margin-bottom:6px">Rolle für die Übernahme'+
     '<input id="bf_mitrolle" list="bf_rollen" value="'+esc((betEdit&&betEdit.titel)||betMitRolle||'')+'" placeholder="z. B. Fachplanung Statik"></label>'+
     '<datalist id="bf_rollen">'+betRollen.map(r=>'<option value="'+esc(r.rolle)+'">').join('')+'</datalist>';
  h+='<div class="bet-mit-kopf"><span>'+M.length+' Ansprechpartner — anklicken fügt hinzu</span>'+
     (offenN>1?'<button class="bet-t" data-bet="mit-alle-sofort">alle '+offenN+'</button>':'')+'</div>'+
     '<div class="bet-mit-liste">';
  M.forEach((p,i)=>{
    const nm=[p.anrede,p.namenstitel,p.vorname,p.nachname].filter(Boolean).join(' ');
    const mail=(p.kontakte||[]).find(k=>k.art==='email');
    const tel=(p.kontakte||[]).find(k=>k.art==='telefon'||k.art==='mobil');
    const da=drin.has(p.crm_id);
    h+='<button class="bet-mit'+(da?' da':'')+'"'+(da?' disabled':' data-mitadd="'+i+'"')+'>'+
       '<span class="zeichen">'+(da?'✓':'+')+'</span>'+
       '<span class="tx"><span class="n">'+esc(nm||'—')+'</span>'+
       '<span class="f">'+esc([p.funktion,mail?mail.wert:(tel?tel.wert:'')].filter(Boolean).join(' · '))+'</span></span>'+
       (da?'<span class="hin">in der Liste</span>':'')+'</button>';});
  h+='</div><div class="bet-p-akt">'+
     '<button class="btn-sm ghost" data-bet="crm-zurueck">Fertig</button></div></div>';
  return h;
}

// Vorschlaege holen. Die Rolle aus dem Formular steuert die Reihenfolge:
// Firmen, die im Buero schon einmal so beauftragt waren, stehen oben.
async function betCrmSuche(){
  const box=el('main').querySelector('#bf_crmres');if(!box)return;
  const feld=el('main').querySelector('#bf_crmq');
  betCrmQ=feld?feld.value.trim():'';
  const rolle=(betEdit&&betEdit.titel)||(el('main').querySelector('#bf_titel')||{}).value||'';
  box.innerHTML='<div class="bet-leer">Einen Moment …</div>';
  const{data,error}=await sb.rpc('crm_vorschlaege',
    {p_suche:betCrmQ||null,p_rolle:rolle.trim()||null,p_filter:betCrmFilter||null,p_limit:60});
  if(error){box.innerHTML='<div class="bet-leer">Adressbuch nicht erreichbar: '+esc(error.message)+'</div>';return;}
  betCrmTr=data||[];
  box.innerHTML=betCrmTreffer(betCrmTr);
  wireBetCrm();
}

// Firma oeffnen: Stammsatz + alle Personen dieser Firma laden.
async function betCrmFirmaOeffnen(companyId){
  const seite=el('main').querySelector('.bet-seite');
  if(seite)seite.innerHTML='<div class="bet-leer">Lade Firma …</div>';
  const[{data:F},{data:P}]=await Promise.all([
    sb.from('crm_firmen').select('crm_id,name,strasse,plz,ort,kontakte').eq('crm_id',companyId).maybeSingle(),
    sb.from('crm_personen').select('crm_id,crm_company_id,anrede,namenstitel,vorname,nachname,funktion,kontakte,strasse,plz,ort,firma_name')
      .eq('crm_company_id',companyId).order('nachname')]);
  if(!F){betHinweis('Firma nicht im Spiegel gefunden.');betCrmFirma=null;betNurSeite();return;}
  betCrmFirma={crm_id:F.crm_id,firma:F.name,strasse:F.strasse,plz:F.plz,ort:F.ort,kontakte:F.kontakte||[]};
  betCrmMit=P||[];
  betNurSeite();
}

// Mehrere Personen auf einmal anlegen — alle unter dieselbe Gruppe wie der
// gerade bearbeitete Eintrag, mit der Rolle aus dem Formular.
// Eine Person sofort in die Liste holen. Kern der Bedienung: die Firmenansicht
// bleibt offen, damit man den naechsten Ansprechpartner direkt wegklicken kann.
// Der erste Klick besetzt einen offenen Platzhalter (wenn von dort gestartet),
// weitere haengen als Unterzeilen darunter -- 2.3 / 2.3.1 wie auf dem Papier.
// Personen aus der Firmenansicht in die Liste holen.
// GRUNDREGEL (Marcel 11.08.): oben steht die FIRMA, die Mitarbeiter stehen
// darunter. Also besetzt die Firma die Rolle (2.1) und jede Person bekommt eine
// eigene Unterzeile (2.1.1, 2.1.2 ...) -- nie die Person in die Rollenzeile.
// Die Firmenansicht bleibt offen, damit man mehrere hintereinander wegklickt.
async function betPersonHinzu(indizes){
  const M=(betCrmMit||[]).filter((_,i)=>indizes.includes(i));
  if(!M.length)return;
  const feld=el('main').querySelector('#bf_mitrolle');
  const rolle=(feld?feld.value.trim():'')||betMitRolle||(betEdit&&betEdit.titel)||'';
  betMitRolle=rolle;
  const F=betCrmFirma||{};

  // 1) Firmenzeile bestimmen: der offene Platzhalter, von dem aus geoeffnet
  //    wurde, sonst eine schon vorhandene Zeile dieser Firma.
  let firmenId=null;
  const platz=betEdit&&betEdit.id?betL.find(x=>x.id===betEdit.id):null;
  if(platz&&!platz.firma){
    const{error}=await sb.from('beteiligte').update({
      status:'aktiv',titel:rolle||platz.titel,firma:F.firma||null,
      strasse:F.strasse,plz:F.plz,ort:F.ort,kontakte:F.kontakte||[],
      quelle:'crm',crm_company_id:F.crm_id}).eq('id',platz.id);
    if(error){betHinweis('Nicht übernommen: '+betFehler(error));return;}
    firmenId=platz.id;betEdit=null;
  }else if(platz&&platz.firma){
    firmenId=platz.id;
  }else{
    const da=betL.find(r=>r.art==='eintrag'&&r.crm_company_id===F.crm_id&&!r.crm_person_id);
    if(da)firmenId=da.id;
  }
  // 2) Ohne Firmenzeile: eine anlegen, damit die Personen darunter Platz haben.
  if(!firmenId){
    const ziel=(betEdit&&betEdit.parent_id)||(betL.find(r=>r.art==='gruppe')||{}).id||null;
    const gesch=betL.filter(r=>(r.parent_id||null)===(ziel||null)).length;
    const{data,error}=await sb.from('beteiligte').insert({
      project_id:current,listen_id:betListeId,parent_id:ziel,art:'eintrag',pos:(gesch+1)*10,
      titel:rolle||null,firma:F.firma||null,strasse:F.strasse,plz:F.plz,ort:F.ort,
      kontakte:F.kontakte||[],quelle:'crm',crm_company_id:F.crm_id}).select('id');
    if(error){betHinweis('Nicht angelegt: '+betFehler(error));return;}
    firmenId=(data||[])[0]?.id;betEdit=null;
  }
  // 3) Jede Person als Unterzeile der Firma.
  const kinder=betL.filter(r=>r.parent_id===firmenId).length;
  const zeilen=M.map((p,k)=>({project_id:current,listen_id:betListeId,parent_id:firmenId,art:'eintrag',
    pos:(kinder+k+1)*10,titel:rolle||null,firma:p.firma_name||F.firma||null,
    anrede:p.anrede,namenstitel:p.namenstitel,vorname:p.vorname,nachname:p.nachname,
    funktion:p.funktion,strasse:p.strasse||F.strasse,plz:p.plz||F.plz,ort:p.ort||F.ort,
    kontakte:p.kontakte||[],quelle:'crm',crm_company_id:p.crm_company_id,crm_person_id:p.crm_id}));
  const{error}=await sb.from('beteiligte').insert(zeilen);
  if(error){betHinweis('Nicht übernommen: '+betFehler(error));return;}

  await betLaden();betNurListe();betNurSeite();
  betHinweis(M.length===1?'Hinzugefügt.':M.length+' Personen hinzugefügt.');
}

// Nur die Firma (ohne Ansprechpartner) ins Formular uebernehmen.
// Nur die Firma setzen (ohne Ansprechpartner) — legt sofort an und bleibt in der
// Firmenansicht, damit danach die Personen dazugeklickt werden koennen.
async function betFirmaUebernehmen(){
  const F=betCrmFirma;if(!F)return;
  const feld=el('main').querySelector('#bf_mitrolle');
  const rolle=(feld?feld.value.trim():'')||betMitRolle||(betEdit&&betEdit.titel)||'';
  betMitRolle=rolle;
  const d={firma:F.firma,strasse:F.strasse,plz:F.plz,ort:F.ort,
           kontakte:F.kontakte||[],quelle:'crm',crm_company_id:F.crm_id};
  const platz=betEdit&&betEdit.id?betEdit:null;
  if(platz){
    const{error}=await sb.from('beteiligte')
      .update(Object.assign({status:'aktiv'},d,rolle?{titel:rolle}:{})).eq('id',platz.id);
    if(error){betHinweis('Nicht übernommen: '+betFehler(error));return;}
    betEdit=null;
  }else{
    const ziel=(betL.find(r=>r.art==='gruppe')||{}).id||null;
    const gesch=betL.filter(r=>(r.parent_id||null)===(ziel||null)).length;
    const{error}=await sb.from('beteiligte').insert(Object.assign(
      {project_id:current,parent_id:ziel,art:'eintrag',pos:(gesch+1)*10,titel:rolle||null},d));
    if(error){betHinweis('Nicht angelegt: '+betFehler(error));return;}
  }
  await betLaden();betNurListe();betNurSeite();
  betHinweis('Firma übernommen — Ansprechpartner können jetzt dazugeklickt werden.');
}
// Uebernahme fuellt nur das Formular — gespeichert wird erst mit "Speichern".
function betUebernehmen(d){
  // Wird aus dem Adressbuch uebernommen, ist das Formular gar nicht gezeichnet --
  // betFormLesen() liefert dann lauter Leerwerte. Was in betEdit steht (etwa die
  // Rolle der Firmenzeile), darf davon nicht ueberschrieben werden.
  const roh=betFormLesen();
  const cur={};Object.keys(roh).forEach(k=>{
    const v=roh[k];if(v!==''&&v!==null&&!(Array.isArray(v)&&!v.length))cur[k]=v;});
  betEdit=Object.assign({},betEdit,cur,{
    titel:cur.titel||betEdit.titel||betMitRolle||null,
    firma:d.firma||cur.firma,anrede:d.anrede||cur.anrede,namenstitel:d.namenstitel||cur.namenstitel,
    vorname:d.vorname||cur.vorname,nachname:d.nachname||cur.nachname,funktion:d.funktion||cur.funktion,
    strasse:d.strasse||cur.strasse,plz:d.plz||cur.plz,ort:d.ort||cur.ort,
    kontakte:(d.kontakte&&d.kontakte.length)?d.kontakte:cur.kontakte,
    quelle:'crm',crm:{crm_company_id:d.crm_company_id||null,crm_person_id:d.crm_person_id||null}});
  betCrmOffen=false;betCrmFirma=null;
  betNurSeite();
  betHinweis('Aus dem Adressbuch übernommen — noch nicht gespeichert.');
}

// Nur den rechten Arbeitsbereich neu zeichnen — die Liste (und ihre Scrollhoehe)
// bleibt stehen. Ein voller Neuaufbau wuerde bei jedem Klick nach oben springen.
function betNurSeite(){
  const s=el('main').querySelector('.bet-seite');
  if(!s){const bd=el('main').querySelector('.win[data-sec="beteiligte"] .win-bd');
    if(bd){bd.innerHTML=renderBet();wireBet();}return;}
  s.innerHTML=betSeite();wireBet();
  if(betCrmOffen&&!betCrmFirma){const r=el('main').querySelector('#bf_crmres');
    if(r&&!r.dataset.geladen){r.dataset.geladen='1';betCrmSuche();}}
}
// Nur die Liste neu zeichnen (Auswahl, Filter, Ein-/Ausklappen).
function betNurListe(){
  const l=el('main').querySelector('.bet-liste');
  if(!l)return betNurSeite();
  l.innerHTML=betListe(betL||[]);wireBet();
}

function wireBet(){
  const M=el('main');
  const neuZeichnen=()=>{const bd=M.querySelector('.win[data-sec="beteiligte"] .win-bd');
    if(bd){bd.innerHTML=renderBet();wireBet();}};
  M.querySelectorAll('[data-bet]').forEach(b=>b.onclick=async()=>{
    const a=b.dataset.bet;
    if(a==='neu-gruppe'){betEdit={art:'gruppe',parent_id:null};betCrmOffen=false;betSel=null;}
    else if(a==='neu-eintrag'){
      const g=betL.find(r=>r.art==='gruppe'&&r.id===(betL.find(x=>x.id===betSel)||{}).parent_id)
             ||betL.find(r=>r.id===betSel&&r.art==='gruppe')||betL.find(r=>r.art==='gruppe');
      betEdit={art:'eintrag',parent_id:g?g.id:null,kontakte:[]};betCrmOffen=true;betCrmFirma=null;betSel=null;}
    else if(a==='abbrechen'){betEdit=null;betCrmOffen=false;betCrmFirma=null;}
    else if(a==='speichern'){await betSpeichern();return;}
    else if(a==='analyse'){await betAusAnalyse();return;}
    else if(a==='verteiler'){await betVerteiler();return;}
    else if(a==='druck'){betDruck();return;}
    else if(a==='pdf'){const f=M.querySelector('#bet_pdf');if(f)f.click();return;}
    else if(a==='pdf-uebernehmen'){await betPdfUebernehmen();return;}
    else if(a==='pdf-abbrechen'){betPdfFunde=null;betPdfName='';}
    else if(a==='crm-auf'){betCrmOffen=true;betCrmFirma=null;betNurSeite();return;}
    else if(a==='crm-zu'){betCrmOffen=false;betCrmFirma=null;betNurSeite();return;}
    else if(a==='del-nein'){betLoeschFrage=null;betNurSeite();return;}
    else if(a==='liste-neu'){betNeueListe={modus:'neu'};betEdit=null;betCrmOffen=false;betSel=null;}
    else if(a==='liste-umbenennen'){betNeueListe={modus:'umbenennen'};betEdit=null;betCrmOffen=false;}
    else if(a==='liste-vorlage'){betNeueListe={modus:'vorlage'};betEdit=null;betCrmOffen=false;}
    else if(a==='liste-abbrechen'){betNeueListe=null;}
    else if(a==='liste-speichern'){await betListeSpeichern();return;}
    else if(a==='liste-loeschen'){betLoeschFrage='LISTE';betNeueListe=null;betEdit=null;betCrmOffen=false;}
    else if(a==='liste-loeschen-ok'){await betListeLoeschen();return;}
    else if(a==='liste-links'){await betListeSchieben(-1);return;}
    else if(a==='liste-rechts'){await betListeSchieben(1);return;}
    else if(a==='crm-suche'){await betCrmSuche();return;}
    else if(a==='crm-zurueck'){betCrmFirma=null;betCrmMit=[];betMitRolle='';betNurSeite();return;}
    else if(a==='crm-firma-uebernehmen'){await betFirmaUebernehmen();return;}
    else if(a==='mit-alle-sofort'){
      const drin=new Set(betL.filter(r=>r.crm_person_id).map(r=>r.crm_person_id));
      const offen=(betCrmMit||[]).map((p,i)=>drin.has(p.crm_id)?-1:i).filter(i=>i>=0);
      await betPersonHinzu(offen);return;}
    else if(a==='filter-weg'){betFilter='';neuZeichnen();return;}
    else if(a==='kont-plus'){const cur=betFormLesen();betEdit=Object.assign({},betEdit,cur);
      betEdit.kontakte=(cur.kontakte||[]).concat([{art:'telefon',kontext:'arbeit',wert:''}]);}
    betNurSeite();
    const f=M.querySelector('#bf_titel');if(f&&betEdit&&!betEdit.id)f.focus();
  });
  // Listenreiter wechseln
  M.querySelectorAll('[data-betlist]').forEach(b=>b.onclick=async()=>{
    if(b.dataset.betlist===betListeId)return;
    betListeId=b.dataset.betlist;betSel=null;betEdit=null;betCrmOffen=false;
    betNeueListe=null;betLoeschFrage=null;betFilter='';
    await betNeuZeichnen();});
  // Zeile anklicken -> Details rechts. Von dort geht es per Knopf weiter ins
  // Adressbuch; kein automatisches Aufklappen, damit der Weg vorhersehbar bleibt.
  M.querySelectorAll('[data-betrow]').forEach(z=>z.onclick=()=>{
    betSel=z.dataset.betrow;betEdit=null;betCrmOffen=false;betCrmFirma=null;betMitRolle='';
    M.querySelectorAll('[data-betrow]').forEach(x=>x.classList.toggle('sel',x===z));
    betNurSeite();});
  // "Firma / Person hinzufügen" an einer Rolle: Adressbuch mit dieser Zeile als Ziel.
  // Ansprechpartner hinzufuegen: die neue Person wird ANGEHAENGT, nicht die
  // angeklickte Zeile ueberschrieben. Deshalb bekommt betEdit KEINE id --
  // vorher wurde damit die bestehende Zeile bearbeitet und die Person darin
  // ersetzt. Ziel ist immer die Firmenzeile: steht man auf einer Person, ist
  // das deren Elternteil, sonst die Zeile selbst.
  // ZWEI FAELLE, die vorher verwechselt wurden:
  //  a) Die Rolle ist noch LEER -> die gewaehlte Firma besetzt GENAU DIESE Zeile
  //     (betEdit MIT id = Aenderung). Sonst entsteht eine zweite Zeile daneben.
  //  b) Die Rolle traegt schon eine Firma -> die gewaehlte Person wird als
  //     Unterzeile ANGEHAENGT (betEdit OHNE id = Neuanlage).
  // Steht man auf einer Person, ist die Firmenzeile immer deren Elternteil.
  M.querySelectorAll('[data-betfill]').forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const r=betL.find(x=>x.id===b.dataset.betfill);if(!r)return;
    const vater=r.parent_id?betL.find(x=>x.id===r.parent_id):null;
    const aufPerson=!!(r.nachname||r.vorname)&&vater&&vater.art==='eintrag';
    const firmenzeile=aufPerson?vater:r;
    if(!firmenzeile.firma){
      betEdit=Object.assign({},firmenzeile,{kontakte:betKont(firmenzeile)});
    }else{
      betEdit={art:'eintrag',parent_id:firmenzeile.id,titel:firmenzeile.titel||'',
               firma:firmenzeile.firma,kontakte:[]};
    }
    betMitRolle=firmenzeile.titel||r.titel||'';
    betCrmOffen=true;betCrmFirma=null;betNurSeite();});
  M.querySelectorAll('[data-betedit]').forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const r=betL.find(x=>x.id===b.dataset.betedit);if(!r)return;
    betEdit=Object.assign({},r,{kontakte:betKont(r)});betCrmOffen=false;betNurSeite();
    const f=M.querySelector('#bf_titel');if(f)f.focus();});
  M.querySelectorAll('[data-betadd]').forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    betEdit={art:'eintrag',parent_id:b.dataset.betadd,kontakte:[]};betCrmOffen=true;betCrmFirma=null;betSel=null;
    betNurSeite();});
  M.querySelectorAll('[data-betdel]').forEach(b=>b.onclick=e=>{
    e.stopPropagation();betLoeschFrage=b.dataset.betdel;betEdit=null;betCrmOffen=false;betNurSeite();});
  M.querySelectorAll('[data-betdelok]').forEach(b=>b.onclick=e=>{e.stopPropagation();betLoeschen(b.dataset.betdelok);});
  M.querySelectorAll('[data-betrunter]').forEach(b=>b.onclick=e=>{e.stopPropagation();betPersonRunter(b.dataset.betrunter);});
  M.querySelectorAll('[data-betup]').forEach(b=>b.onclick=e=>{e.stopPropagation();betVerschieben(b.dataset.betup,'up');});
  M.querySelectorAll('[data-betdown]').forEach(b=>b.onclick=e=>{e.stopPropagation();betVerschieben(b.dataset.betdown,'down');});
  M.querySelectorAll('[data-betin]').forEach(b=>b.onclick=e=>{e.stopPropagation();betEbene(b.dataset.betin,true);});
  M.querySelectorAll('[data-betout]').forEach(b=>b.onclick=e=>{e.stopPropagation();betEbene(b.dataset.betout,false);});
  M.querySelectorAll('[data-betfold]').forEach(g=>g.onclick=e=>{
    if(e.target.closest('[data-betadd]'))return;
    const id=g.dataset.betfold;betZu.has(id)?betZu.delete(id):betZu.add(id);betNurListe();});
  M.querySelectorAll('[data-betfirma]').forEach(b=>b.onclick=e=>{
    e.stopPropagation();betCrmOffen=true;betCrmFirmaOeffnen(+b.dataset.betfirma);});
  M.querySelectorAll('[data-bfkdel]').forEach(b=>b.onclick=()=>{
    const cur=betFormLesen();betEdit=Object.assign({},betEdit,cur);
    betEdit.kontakte=(cur.kontakte||[]).filter((_,k)=>k!==+b.dataset.bfkdel);betNurSeite();});
  // Schnellfilter der Liste
  const q=M.querySelector('#bet_q');
  if(q&&!q.dataset.wired){q.dataset.wired='1';
    q.oninput=()=>{betFilter=q.value;betNurListe();};
    q.onkeydown=e=>{if(e.key==='Escape'){betFilter='';q.value='';betNurListe();}};}
  const dz=M.querySelector('#bet_pdf');
  if(dz)dz.onchange=async()=>{const f=dz.files&&dz.files[0];if(f){await betPdfImport(f);dz.value='';}};
  wireBetCrm();
}

// Treffer im Adressbuch: Firma oeffnet die Mitarbeiteransicht, Person wird direkt
// ins Formular uebernommen.
function wireBetCrm(){
  const M=el('main');
  M.querySelectorAll('[data-crmfirma]').forEach(b=>b.onclick=()=>betCrmFirmaOeffnen(+b.dataset.crmfirma));
  M.querySelectorAll('[data-crmi]').forEach(b=>b.onclick=()=>{
    const r=(betCrmTr||[])[+b.dataset.crmi];if(!r)return;
    betUebernehmen({firma:r.firma,anrede:r.anrede,namenstitel:r.namenstitel,vorname:r.vorname,
      nachname:r.nachname,funktion:r.funktion,strasse:r.strasse,plz:r.plz,ort:r.ort,
      kontakte:r.kontakte||[],crm_company_id:r.crm_company_id,crm_person_id:r.crm_id});});
  M.querySelectorAll('[data-mitadd]').forEach(b=>b.onclick=()=>betPersonHinzu([+b.dataset.mitadd]));
  M.querySelectorAll('[data-crmfilter]').forEach(b=>b.onclick=()=>{
    betCrmFilter=b.dataset.crmfilter||null;
    M.querySelectorAll('[data-crmfilter]').forEach(x=>x.classList.toggle('an',x===b));
    betCrmSuche();});
  const q=M.querySelector('#bf_crmq');
  if(q&&!q.dataset.wired){q.dataset.wired='1';
    q.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();betCrmSuche();}};}
}
// Druckfassung aus der Vorlage vorlagen/beteiligte-druck.html.
// Die Vorlage haelt Layout, Masse und Logo (nachgebaut aus dem Buero-Ausdruck);
// hier wird nur der Inhalt erzeugt und in die Platzhalter gesetzt. Wer das
// Aussehen aendern will, aendert die Vorlage -- nicht diesen Code.
// Kontaktsymbole als Inline-SVG: Unicode-Zeichen fuer Telefon/Fax werden je
// nach installierter Schrift als Emoji oder als durchgestrichenes Telefon
// gezeichnet -- im Ausdruck unbrauchbar.
const BET_SVG=(d,extra)=>'<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.7" '+
  'stroke-linecap="round" stroke-linejoin="round">'+d+(extra||'')+'</svg>';
const BET_KON_ICON={
  telefon:BET_SVG('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8.1 9.7a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z"/>'),
  mobil:BET_SVG('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'),
  fax:BET_SVG('<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 17h10v4H7z"/>'),
  email:BET_SVG('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 6 10 7 10-7"/>'),
  web:BET_SVG('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>')};
let betDruckVorlage=null,betLogo=null;

async function betVorlageLaden(){
  if(betDruckVorlage&&betLogo)return;
  const basis=location.pathname.replace(/[^/]*$/,'');
  // Der Kopfkommentar der Vorlage beschreibt die Platzhalter und enthaelt sie
  // deshalb selbst — er muss vor dem Ersetzen raus, sonst landet der Inhalt
  // zusaetzlich im Kommentar.
  if(!betDruckVorlage)betDruckVorlage=(await (await fetch(basis+'vorlagen/beteiligte-druck.html')).text())
    .replace(/^\s*<!--[\s\S]*?-->\s*/,'');
  if(!betLogo){
    // Typ selbst setzen: der lokale Vorschauserver liefert PNG sonst als
    // text/plain, und der data-URI waere im Druckfenster kein Bild mehr.
    const roh=await (await fetch(basis+'vorlagen/ghiw-logo.png')).arrayBuffer();
    const blob=new Blob([roh],{type:'image/png'});
    betLogo=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(blob);});
  }
}

// Kontaktspalte: Symbol, Kontext in Klammern, Wert -- wie im Original.
function betDruckKontakte(r){
  const K=betKont(r);
  if(!K.length)return '';
  const gross=t=>t?t.charAt(0).toUpperCase()+t.slice(1):'Arbeit';
  return '<table class="kon">'+K.map(k=>
    '<tr><td class="ki">'+(BET_KON_ICON[k.art]||'&#9679;')+'</td>'+
    '<td class="kk">('+esc(gross(k.kontext))+')</td>'+
    '<td class="kw">'+esc(k.wert)+'</td></tr>').join('')+'</table>';
}

function betDruckInhalt(){
  const L=betL||[];
  const adr=r=>[r.strasse,[r.plz,r.ort].filter(Boolean).join(' ')].filter(Boolean);
  // Der Ausdruck zeigt nur, was wirklich besetzt ist. Unbesetzte Rollen fallen
  // weg -- und mit ihnen jede Gruppe, in der danach nichts mehr uebrig waere
  // (sonst stuenden leere Ueberschriften wie "Rohbau" ohne Inhalt da).
  const besetzt=r=>r.art==='eintrag'&&r.status!=='ausgeschieden'&&
    !!(r.firma||betName(r)||betKont(r).length);
  const traegtInhalt={};
  for(let i=L.length-1;i>=0;i--){const r=L[i];
    const eigen=besetzt(r)||L.some(k=>k.parent_id===r.id&&traegtInhalt[k.id]);
    traegtInhalt[r.id]=eigen;}
  let h='';
  L.forEach(r=>{
    if(!traegtInhalt[r.id])return;
    const nr='<span class="nr">'+esc(r.nummer)+'</span>';
    if(r.art==='gruppe'){
      h+='<div class="balken e'+Math.min(r.tiefe,2)+'">'+nr+esc(r.titel||'')+'</div>';
      return;}
    const vater=r.parent_id?L.find(x=>x.id===r.parent_id):null;
    const unterFirma=vater&&vater.art==='eintrag';
    const nm=betName(r);
    if(!unterFirma){
      // Firmenposition: eigener Balken mit Nummer und Rolle, darunter der Satz
      h+='<div class="balken e'+Math.min(r.tiefe,2)+'">'+nr+esc(r.titel||'')+'</div>';
      h+='<table class="satz"><tr><td class="li">'+
        (r.firma?'<div class="firma">'+esc(r.firma)+'</div>':'')+
        (nm?'<div>'+esc(nm)+'</div>':'')+
        (r.funktion?'<div class="funktion">'+esc(r.funktion)+'</div>':'')+
        adr(r).map(z=>'<div>'+esc(z)+'</div>').join('')+
        '</td><td class="re">'+betDruckKontakte(r)+'</td></tr></table>';
      return;}
    // Person unter der Firma: Firmenname und -anschrift stehen eine Zeile
    // hoeher und werden hier weggelassen.
    const eigeneAdr=(r.strasse||r.ort)&&
      ((r.strasse||'')!==(vater.strasse||'')||(r.ort||'')!==(vater.ort||''));
    h+='<table class="satz"><tr><td class="li">'+
      '<div class="kopfzeile">'+nr+esc(r.titel||'')+'</div>'+
      (nm?'<div>'+esc(nm)+'</div>':'')+
      (r.funktion?'<div class="funktion">'+esc(r.funktion)+'</div>':'')+
      (eigeneAdr?adr(r).map(z=>'<div>'+esc(z)+'</div>').join(''):'')+
      '</td><td class="re">'+betDruckKontakte(r)+'</td></tr></table>';
  });
  return h;
}

async function betDruck(){
  betHinweis('Druckfassung wird aufgebaut …');
  try{await betVorlageLaden();}
  catch(e){betHinweis('Druckvorlage nicht gefunden: '+e.message);return;}
  const heute=new Date().toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
  // Kopf und Ueberschrift kommen aus der gedruckten Liste, nicht mehr fest
  // "Beteiligtenliste"/"Projektbeteiligte" — sonst steht auf einer Gewerke-
  // Empfehlung der falsche Dokumenttyp.
  const liste=betListen.find(l=>l.id===betListeId)||{},
        kopf=liste.name||'Beteiligtenliste',
        titel=[liste.lph?'LPH '+liste.lph:'',liste.bauabschnitt||'',heute].filter(Boolean).join(' · ');
  const html=betDruckVorlage
    .replace(/\{\{KOPF\}\}/g,esc(kopf))
    .replace(/\{\{PROJEKT\}\}/g,esc(currentName||''))
    .replace(/\{\{TITEL\}\}/g,esc(titel))
    .replace(/\{\{DATUM\}\}/g,heute)
    .replace(/\{\{LOGO\}\}/g,betLogo||'')
    .replace(/\{\{INHALT\}\}/g,betDruckInhalt());
  // Das Druckfenster bekommt eine eigene Blob-Adresse statt document.write.
  // Grund: ein per window.open('') erzeugtes Fenster teilt sich den Prozess mit
  // dieser Seite -- der Druckdialog blockiert dann BEIDE, und das Board haengt,
  // bis man das Fenster schliesst. Mit eigener Adresse laeuft es getrennt, und
  // der Druckdialog wird im Dokument selbst ausgeloest.
  const seite='<!doctype html><html lang="de"><head><meta charset="utf-8">'+
    '<title>'+esc(kopf)+' '+esc(currentName||'')+'</title></head><body>'+html+
    '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},250);});'+
    'window.addEventListener("afterprint",function(){setTimeout(function(){window.close();},150);});'+
    '<\/script></body></html>';
  const adresse=URL.createObjectURL(new Blob([seite],{type:'text/html;charset=utf-8'}));
  const w=window.open(adresse,'_blank');
  if(!w){URL.revokeObjectURL(adresse);betHinweis('Bitte Pop-ups für diese Seite erlauben.');return;}
  // Adresse erst freigeben, wenn das Fenster sie geladen hat.
  setTimeout(()=>URL.revokeObjectURL(adresse),60000);
  betHinweis('Druckfenster geöffnet.');
}
function renderFolders(F,total){if(!F.length)return '<div class="empty">Keine Ordner.</div>';const max=Math.max(...F.map(f=>+f.anzahl));return F.map(f=>'<div class="fld-row"><div><div>'+esc(f.ordner||'(Wurzel)')+'</div><div class="fld-bar"><i style="width:'+Math.round(+f.anzahl/max*100)+'%"></i></div></div><div class="fc2">'+f.anzahl+'</div></div>').join('');}
function renderComms(C){if(!C.length)return '<div class="inner"><div class="empty">Keine Vorgänge erfasst.</div></div>';const td=today();
  const zu=C.filter(c=>fbClosed[fbKey('vorgang',c.betreff)]),CC=C.filter(c=>!fbClosed[fbKey('vorgang',c.betreff)]);
  const list=CC.slice().sort((a,b)=>(a.frist||'9999')<(b.frist||'9999')?-1:1);
  const off=CC.filter(c=>!['beantwortet','erledigt'].includes(c.status)),ovC=off.filter(c=>c.status==='ueberfaellig'||(c.frist&&c.frist<td)).length;
  let h=ovHero([ovK(ovC?'bad':'ok',ovC,'überfällig'),ovK('',off.length,'offen · wartet auf Antwort'),ovK('ok',CC.length-off.length,'beantwortet')])+'<div class="inner">';
  for(const c of list){const m=c.meta||{};const od=(c.status==='ueberfaellig')||(c.frist&&c.frist<td&&!['beantwortet','erledigt'].includes(c.status));const st=c.status==='beantwortet'?'<span class="stat ok">beantwortet</span>':od?'<span class="stat alert">überfällig</span>':'<span class="stat warn">'+esc(stL(c.status))+'</span>';
    const fb=c.id?fbUI('vorgang',c.betreff||'',' data-fbcomm="'+c.id+'"'):null;
    h+='<div class="vrow'+(od?' overdue':'')+'"><div style="flex:1"><div class="vtitle">'+esc(c.betreff)+'</div><div class="vmeta"><span class="task-chip">'+esc(c.typ)+'</span>'+st+(c.empfaenger?'<span>→ '+esc(c.empfaenger)+'</span>':'')+(m.tage_offen!=null?'<span class="mono">'+m.tage_offen+' T offen</span>':'')+(c.frist?'<span class="mono">Frist '+esc(fmtFrist(c.frist))+'</span>':'')+(m.quelle?'<span>Quelle: '+esc(m.quelle)+'</span>':'')+'</div></div>'+(fb?fb.btn:'')+'</div>'+(fb?fb.form:'');}
  h+=fbDoneSec(zu.map(c=>({title:c.betreff||'',kommentar:(fbClosed[fbKey('vorgang',c.betreff)]||{}).kommentar})));
  return h+'</div>';}
function wire(T,C){
  const tc=el('toC');if(tc)tc.onclick=()=>go('cockpit');
  el('main').querySelectorAll('[data-jfcopy]').forEach(b=>b.onclick=()=>copyToClip(jfBriefingText(),b));
  el('main').querySelectorAll('[data-fragcopy]').forEach(b=>b.onclick=()=>copyToClip(lph1FragenText(),b));
  el('main').querySelectorAll('.cl-cb').forEach(cb=>cb.onchange=()=>toggleChecklist(cb.dataset.clkey,cb.checked));
  el('main').querySelectorAll('.cl-ph').forEach(d=>d.addEventListener('toggle',()=>{const l=+d.dataset.cllph;d.open?openCl.add(l):openCl.delete(l);}));
  // Fenster öffnen/schließen — openWin merkt sich das offene Fenster über Realtime-Re-Renders hinweg
  el('main').querySelectorAll('.win-tile,[data-winopen]').forEach(t=>t.onclick=()=>{const s=t.closest('.win'),o=s.querySelector('.win-ov');if(o){openWin=s.dataset.sec;o.hidden=false;document.body.style.overflow='hidden';}});
  el('main').querySelectorAll('[data-openwin]').forEach(t=>t.onclick=()=>{const s=el('main').querySelector('.win[data-sec="'+t.dataset.openwin+'"]'),o=s&&s.querySelector('.win-ov');if(o){openWin=s.dataset.sec;o.hidden=false;document.body.style.overflow='hidden';}});
  el('main').querySelectorAll('.win-ov').forEach(o=>o.addEventListener('click',e=>{if(e.target===o||e.target.closest('.win-x')){openWin=null;o.hidden=true;document.body.style.overflow='';}}));
  if(openWin){const o=el('main').querySelector('.win[data-sec="'+openWin+'"] .win-ov');if(o){o.hidden=false;document.body.style.overflow='hidden';}else{openWin=null;document.body.style.overflow='';}}
  {const cb=el('main').querySelector('#kzcopy');if(cb)cb.onclick=async()=>{
    try{await navigator.clipboard.writeText(kzRefText());const h=el('main').querySelector('#kzcopyh');if(h){h.textContent='kopiert ✓';setTimeout(()=>{h.textContent='';},2500);}}
    catch(e){alert('Kopieren nicht möglich: '+e.message);}};}
  el('main').querySelectorAll('.pilgrim-station').forEach(st=>st.onclick=async()=>{await sb.from('projects').update({lph:+st.dataset.lph}).eq('id',current);render();});
  el('main').querySelectorAll('.task-row').forEach(r=>r.onclick=e=>{if(e.target.classList.contains('tcheck'))return;selTask=r.dataset.trow;el('main').querySelectorAll('.task-row').forEach(x=>x.classList.toggle('sel',x.dataset.trow===selTask));const d=el('aufgdetail');if(d){d.innerHTML=renderTaskDetail(taskMap[selTask]);wireDetail();}});
  el('main').querySelectorAll('.tcheck').forEach(cb=>cb.onchange=()=>toggleTask(cb.dataset.task,cb));
  wireDetail();
  wireBet();
  el('main').querySelectorAll('button[data-agent]').forEach(b=>b.onclick=()=>queueAgent(b.dataset.agent,b.dataset.lph?{lph:+b.dataset.lph}:{},b));
  el('main').querySelectorAll('.tab-btn').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;applyTaskFilter();el('main').querySelectorAll('.tab-btn').forEach(x=>x.classList.toggle('active',x===b));});
  el('main').querySelectorAll('.fc').forEach(f=>f.onclick=()=>{const p=f.dataset.p;prioFilters.has(p)?prioFilters.delete(p):prioFilters.add(p);f.classList.toggle('active');applyTaskFilter();});
  const dq=el('docq'),dg=el('docgo');if(dg)dg.onclick=docSearch;if(dq)dq.onkeydown=e=>{if(e.key==='Enter')docSearch();};
  const atb=el('addtaskbtn'),atf=el('addtaskform');
  if(atb&&atf)atb.onclick=()=>{atf.hidden=!atf.hidden;if(!atf.hidden)el('nt-title').focus();};
  if(atf)atf.onsubmit=e=>{e.preventDefault();createTask();};
  el('main').querySelectorAll('button[data-deltask]').forEach(b=>b.onclick=async e=>{e.stopPropagation();if(confirm('Aufgabe löschen?')){const{error}=await sb.from('tasks').delete().eq('id',b.dataset.deltask);if(error)alert('Fehler: '+error.message);}});
  applyTaskFilter();
}
function applyTaskFilter(){el('main').querySelectorAll('.task-row').forEach(c=>{let show=true;if(tab!=='alle'&&c.dataset.category!==tab)show=false;if(prioFilters.size&&!prioFilters.has('P'+c.dataset.priority))show=false;c.classList.toggle('hide',!show);});}
let _sres=[],_sfilter='';
async function docSearch(){const q=el('docq').value.trim();const box=el('sres');if(!q){box.innerHTML='';_sres=[];return;}box.innerHTML='<div class="empty">Suche…</div>';
  const{data,error}=await sb.rpc('search_documents',{pid:current,q});
  if(error){box.innerHTML='<div class="empty">'+esc(error.message)+'</div>';return;}
  _sres=data||[];_sfilter='';renderSearchResults();}
function renderSearchResults(){const box=el('sres');if(!box)return;const all=_sres;
  if(!all.length){box.innerHTML='<div class="empty">Nichts gefunden.</div>';return;}
  const types={};all.forEach(d=>{const t=d.doctype||'?';types[t]=(types[t]||0)+1;});
  const list=_sfilter?all.filter(d=>(d.doctype||'?')===_sfilter):all;
  let h='<div class="sres-bar"><span class="sres-cnt">'+all.length+' Treffer · nach Relevanz</span>'+Object.keys(types).sort((a,b)=>types[b]-types[a]).map(t=>'<button class="sres-chip'+(_sfilter===t?' on':'')+'" data-stype="'+esc(t)+'">'+esc(t)+' '+types[t]+'</button>').join('')+(_sfilter?'<button class="sres-chip clr" data-stype="">alle</button>':'')+'</div>';
  h+=list.map(d=>{const parts=(d.unc_path||'').split(/[\\/]/);const folder=parts.length>1?parts[parts.length-2]:'';
    const snip=d.snippet?('<div class="sres-snip">'+esc(d.snippet).split('⟦H⟧').join('<mark>').split('⟦/H⟧').join('</mark>')+'</div>'):'<div class="sres-snip nomatch">Treffer im Dateinamen</div>';
    return '<div class="sres-item"><div class="sres-head"><span class="sres-fn">'+esc(d.filename)+'</span><span class="sres-dt">'+esc(d.doctype||'')+'</span></div>'+snip+'<div class="sres-foot">'+(folder?'<span class="sres-folder">📁 '+esc(folder)+'</span>':'')+(d.modified_at?'<span class="mono">'+fmtD(d.modified_at)+'</span>':'')+'<span style="flex:1"></span><button class="sres-copy" data-copypath="'+esc(d.unc_path||'').replace(/"/g,'&quot;')+'">Pfad kopieren</button></div></div>';}).join('');
  box.innerHTML=h;
  box.querySelectorAll('[data-stype]').forEach(b=>b.onclick=()=>{_sfilter=b.dataset.stype;renderSearchResults();});
  box.querySelectorAll('[data-copypath]').forEach(b=>b.onclick=()=>copyToClip(b.dataset.copypath,b));}
async function mailsFor(q){
  q=(q||'').trim(); if(!q)return;
  let ov=el('mailov'); if(!ov){ov=document.createElement('div');ov.id='mailov';document.body.appendChild(ov);}
  ov.setAttribute('style','position:fixed;inset:0;background:rgba(20,18,15,.45);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px');
  ov.innerHTML='<div style="background:#FBFAF7;border:1px solid #E4DFD5;border-radius:14px;max-width:640px;width:100%;max-height:80vh;overflow:auto;padding:16px 18px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b>Zugehörige E-Mails &amp; Dokumente · „'+esc(q)+'"</b><button onclick="el(\'mailov\').remove()" style="border:none;background:transparent;font-size:18px;cursor:pointer;color:#73706a">✕</button></div><div id="mailovb"><div class="empty">Suche…</div></div></div>';
  ov.onclick=function(e){if(e.target===ov)ov.remove();};
  const r=await sb.rpc('search_documents',{pid:current,q:q});
  const body=el('mailovb'); if(!body)return;
  if(r.error){body.innerHTML='<div class="empty">'+esc(r.error.message)+'</div>';return;}
  const rows=(r.data||[]).slice().sort(function(a,b){return ((a.doctype==='email')?0:1)-((b.doctype==='email')?0:1);});
  if(!rows.length){body.innerHTML='<div class="empty">Nichts gefunden zu „'+esc(q)+'".</div>';return;}
  body.innerHTML=rows.slice(0,25).map(function(d){var snip=d.snippet?('<div class="sres-snip">'+esc(d.snippet).split('⟦H⟧').join('<mark>').split('⟦/H⟧').join('</mark>')+'</div>'):'';return '<div class="sres-item"><div class="sres-head"><span class="sres-fn">'+(d.doctype==='email'?'📧 ':'📄 ')+esc(d.filename)+'</span><span class="sres-dt">'+esc(d.doctype||'')+'</span></div>'+snip+'<div class="sres-foot"><span style="flex:1"></span><button class="sres-copy" data-copypath="'+esc(d.unc_path||'').split('"').join('&quot;')+'">Pfad kopieren</button></div></div>';}).join('');
  body.querySelectorAll('[data-copypath]').forEach(function(b){b.onclick=function(){copyToClip(b.dataset.copypath,b);};});
}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-mails]');if(b){e.preventDefault();mailsFor(b.dataset.mails);}});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){var o=document.querySelector('.win-ov:not([hidden])');if(o){openWin=null;o.hidden=true;document.body.style.overflow='';}}});
async function toggleTask(id,cb){const ck=cb.checked;const{error}=await sb.from('tasks').update({status:ck?'erledigt':'offen',done_at:ck?new Date().toISOString():null}).eq('id',id);if(error){cb.checked=!ck;alert('Fehler: '+error.message);}}
async function queueAgent(agent,meta,btn){const lbl=btn?btn.textContent:'';if(btn){btn.disabled=true;btn.textContent='… eingereiht';}const{error}=await sb.from('agent_runs').insert({project_id:current,agent,status:'queued',meta});if(error){if(error.code==='23505'){if(btn)btn.textContent='läuft bereits';loadRuns();if(btn)setTimeout(()=>{btn.disabled=false;btn.textContent=lbl;},1600);return;}alert('Konnte Agent nicht starten: '+error.message);if(btn){btn.disabled=false;btn.textContent=lbl;}return;}loadRuns();if(btn)setTimeout(()=>{btn.disabled=false;btn.textContent=lbl;},1600);}
async function loadRuns(){const[{data,error},{data:hb}]=await Promise.all([
    sb.from('agent_runs').select('id,agent,status,result,log,started_at,project_id,projects(name)').order('created_at',{ascending:false}).limit(14),
    sb.from('runner_heartbeat').select('last_seen').eq('id',1)]);
  // Echter Runner-Status aus dem Heartbeat (nicht geraten)
  const hbAge=hb&&hb[0]?Date.now()-new Date(hb[0].last_seen).getTime():9e12;
  const runnerOn=hbAge<20000;
  const rs=el('rstatus');if(rs){rs.className='rstatus '+(runnerOn?'on':'off');el('rstext').textContent=runnerOn?'Runner aktiv':'Runner offline';}
  // Banner: läuft gerade ein Agent? ODER Runner offline + Aufträge warten?
  const bn=el('runbanner');
  if(bn){const live=(view==='project'&&current)?(data||[]).find(r=>r.project_id===current&&(r.status==='running'||r.status==='queued')):null;
    const waiting=(data||[]).filter(r=>r.status==='queued').length;
    if(live&&runnerOn){bn.hidden=false;bn.className='runbanner';bn.innerHTML='<span class="pulse"></span>Agent läuft: <strong>'+esc(AL[live.agent]||live.agent)+'</strong> · '+(live.status==='queued'?'in Warteschlange…':'arbeitet…')+' <span class="mono">live · Fortschritt links in der Agenten-Leiste</span>';}
    else if(!runnerOn&&waiting){bn.hidden=false;bn.className='runbanner off';bn.innerHTML='<span style="font-size:14px">⚠</span> <strong>Runner offline</strong> — '+waiting+' Auftrag/Aufträge warten und laufen automatisch, sobald der Büro-PC aktiv ist. <span class="mono">Daten im Dashboard bleiben sichtbar.</span>';}
    else bn.hidden=true;}
  if(error){el('runs').innerHTML='<div class="empty">'+esc(error.message)+'</div>';return;}
  if(!data.length){el('runs').innerHTML='<div class="empty">Noch keine Agenten-Läufe.</div>';return;}
  let h='';for(const r of data){const pn=r.projects?short(r.projects.name):'';h+='<div class="run" data-run="'+r.id+'"><div class="rh">'+(r.status==='running'?'<span class="pulse"></span>':'')+'<span class="ra">'+esc(AL[r.agent]||r.agent)+'</span><span class="rst '+r.status+'">'+r.status+'</span></div><div class="rp">'+esc(pn)+(r.result?' · '+esc(r.result):'')+'</div>'+(openRun===r.id&&r.log?'<pre>'+esc(r.log)+'</pre>':'')+'</div>';}
  el('runs').innerHTML=h;el('runs').querySelectorAll('.run').forEach(d=>d.onclick=()=>{openRun=openRun===d.dataset.run?null:d.dataset.run;loadRuns();});}
