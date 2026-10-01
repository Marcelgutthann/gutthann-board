// ---------- DEV: mit Tony bauen wie in Claude Code (Migration 219, Marcel 01.10.2026) ----------
// "lösch das was auch immer das sein soll -- bau den chatbot Tony ein und dann soll er darüber wie mit
// claude code arbeiten können". Das alte Wunschbuch (Klärer, Fragen, Übergabeknopf) ist weg.
//
// Ein Faden = eine Karte (todos.quelle='dev') = EINE Sitzung des Coding Agents (runner/werkstatt.mjs).
// Der Chatverlauf ist die Kommentarspur der Karte; jede Nachricht geht an dieselbe Sitzung, während
// er arbeitet als Nachtrag in seine laufende Arbeit. Plan und Schritte kommen live aus agent_runs.lauf.
//
// Rechte macht die Datenbank, nicht diese Seite: personen.bau_bereich ('alles' | 'terminplan' | null),
// Trigger werkstatt_baurecht auf jedem Werkstatt-Lauf. Wer nur 'terminplan' hat (Benjamin Adam), baut
// an einer Kopie des Terminplan-Werkzeugs; das Ergebnis ist eine Vorschau, live geht es nur über
// bau_uebernehmen. Die Vorschau läuft mit einem Datenbank-Ersatz, der liest, aber nie schreibt.

const DEV = { ich: null, faden: null, stand: null, offen: [], takt: null, sendet: false, fehler: null, wartend: null, wegOffen: false };

async function ladeDev() {
  try {
    DEV.ich = await restRpc('bau_ich', {});
    DEV.offen = DEV.ich.bereich === 'alles' ? await restRpc('bau_vorschauen_offen', {}) : [];
    DEV.fehler = null;
  } catch (e) { DEV.fehler = 'DEV ist gerade nicht erreichbar (' + e.message + ').'; }
  S.devOffen = (DEV.offen || []).length;
  if (DEV.faden) await devStandLaden(); else renderDev();
  renderSidebar();
  devTakt();
}

async function devStandLaden() {
  if (!DEV.faden) return;
  try {
    const st = await restRpc('bau_stand', { p_todo: DEV.faden });
    if (st && st.fehler) { DEV.faden = null; DEV.stand = null; } else {
      DEV.stand = st;
      // Die eigene Nachricht steht jetzt in der Datenbank -- die vorlaeufige Blase entfaellt.
      if (DEV.wartend && (st.nachrichten || []).some((n) => n.von !== 'agent' && n.text === DEV.wartend)) DEV.wartend = null;
    }
  } catch (e) { /* naechster Takt versucht es wieder */ }
  renderDev();
}

function devLaeuft() {
  const l = DEV.stand && DEV.stand.lauf;
  return !!(l && (l.status === 'queued' || l.status === 'running'));
}

// Nachsehen: alle 1,5 s, solange der Coding Agent arbeitet, sonst alle 20 s. Nur in der DEV-Ansicht.
function devTakt() {
  clearTimeout(DEV.takt);
  if (S.active?.typ !== 'dev' || !DEV.faden) return;
  DEV.takt = setTimeout(async () => {
    if (S.active?.typ !== 'dev') return;
    const vorher = devLaeuft();
    await devStandLaden();
    if (vorher && !devLaeuft()) ladeDev();  // fertig: Fadenliste und Vorschauen auffrischen
    else devTakt();
  }, devLaeuft() || DEV.wartend ? 1500 : 20000);
}

function devOeffnen(id) {
  DEV.faden = id; DEV.stand = null;
  renderDev();
  devStandLaden().then(devTakt);
}

async function devSenden(ta) {
  const text = ta.value.trim();
  if (!text || DEV.sendet) return;
  DEV.sendet = true;
  // Sofort im Verlauf zeigen, wie in jedem Chat -- nicht erst nach der Datenbank-Runde.
  DEV.wartend = text; ta.value = '';
  renderDev();
  try {
    const r = await restRpc('bau_senden', { p_text: text, p_todo: DEV.faden });
    if (r.fehler) { DEV.wartend = null; renderDev(); const t = document.querySelector('#dev-root .dvta'); if (t) t.value = text; alert(r.fehler); return; }
    DEV.faden = r.todo_id;
    await ladeDev();
  } catch (e) { DEV.wartend = null; renderDev(); const t = document.querySelector('#dev-root .dvta'); if (t) t.value = text; alert('Nicht gesendet: ' + e.message); }
  finally { DEV.sendet = false; }
}

function renderDev() {
  const root = document.getElementById('dev-root'); if (!root) return;
  // Tippt jemand gerade, bleibt sein Text stehen, auch wenn der Takt neu zeichnet.
  const alt = root.querySelector('.dvta');
  const entwurf = alt ? alt.value : '';
  const fokus = alt && document.activeElement === alt;
  // Wer hochgescrollt hat und liest, bleibt dort; wer unten war, folgt dem neuen Text.
  const altV = root.querySelector('.dvverlauf');
  const unten = !altV || altV.scrollHeight - altV.scrollTop - altV.clientHeight < 80;
  const altPos = altV ? altV.scrollTop : 0;
  root.innerHTML = '';
  if (DEV.fehler) { root.append(el('div', { class: 'dvleer' }, DEV.fehler)); return; }
  if (!DEV.ich) { root.append(el('div', { class: 'dvleer' }, 'Lädt …')); return; }
  if (!DEV.ich.bereich) {
    root.append(el('div', { class: 'dvleer' }, 'Für dein Konto ist DEV nicht freigeschaltet. Marcel kann Baurechte vergeben.'));
    return;
  }
  root.append(devSeite(), devHaupt(entwurf));
  const ta = root.querySelector('.dvta');
  if (ta && fokus) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  const verlauf = root.querySelector('.dvverlauf');
  if (verlauf) verlauf.scrollTop = unten ? verlauf.scrollHeight : altPos;
}

function devSeite() {
  const s = el('div', { class: 'dvseite' });
  s.append(el('button', { class: 'dvneu', onclick: () => { DEV.faden = null; DEV.stand = null; renderDev(); } }, ico('plus'), 'Neuer Faden'));
  if ((DEV.offen || []).length) {
    s.append(el('div', { class: 'dvlbl' }, 'Zum Übernehmen'));
    for (const v of DEV.offen) {
      s.append(el('div', { class: 'dvvzeile' },
        el('div', { class: 'dvvtitel' }, v.titel.replace(/^DEV: /, '')),
        el('div', { class: 'dvvmeta' }, v.person + ' · ' + devZeit(v.erstellt)),
        el('div', { class: 'dvvknoepfe' },
          el('button', { class: 'btn ghost', onclick: () => devVorschau(v.id) }, 'Ansehen'),
          el('button', { class: 'btn', onclick: () => devUebernehmen(v) }, 'Übernehmen'))));
    }
  }
  s.append(el('div', { class: 'dvlbl' }, 'Fäden'));
  const f = DEV.ich.faeden || [];
  if (!f.length) s.append(el('div', { class: 'dvhinweis' }, 'Noch keine. Schreib rechts, was die Anwendung können soll.'));
  for (const x of f) {
    s.append(el('button', { class: 'dvfaden' + (x.id === DEV.faden ? ' an' : ''), onclick: () => devOeffnen(x.id) },
      el('span', { class: 'dvftitel' }, x.titel.replace(/^DEV: /, '')),
      el('span', { class: 'dvfstand' }, DEV_STATUS[x.status] || '')));
  }
  return s;
}

const DEV_STATUS = { wartet: 'in der Schlange', laeuft: 'arbeitet', fertig: 'fertig', fehlgeschlagen: 'gescheitert' };

function devHaupt(entwurf) {
  const h = el('div', { class: 'dvhaupt' });
  const tp = DEV.ich.bereich === 'terminplan';
  const kopf = el('div', { class: 'dvkopf' },
    el('div', { class: 'dvname' }, 'Tony', el('span', { class: 'dvrolle' }, ' · Coding Agent')),
    el('div', { class: 'dvbereich' }, tp
      ? 'Du baust am Terminplan-Werkzeug. Tony arbeitet an einer Kopie, du siehst das Ergebnis als Vorschau. Live im Board geht es nach Marcels Übernahme.'
      : 'Tony baut im ganzen Agentic OS: liest den Code, ändert, testet, rollt aus. Jede Nachricht geht an dieselbe Sitzung.'));
  h.append(kopf);

  const verlauf = el('div', { class: 'dvverlauf' });
  const st = DEV.stand;
  if (!DEV.faden && !DEV.wartend) {
    verlauf.append(el('div', { class: 'dvstart' }, tp
      ? 'Sag Tony, was das Terminplan-Werkzeug können soll, so wie du es einem Kollegen erklären würdest. Er liest den Code, baut es und zeigt dir eine Vorschau.'
      : 'Sag Tony, was die Anwendung können soll. Er liest den Code, baut es und meldet sich hier.'));
  } else if (DEV.faden && !st) {
    verlauf.append(el('div', { class: 'dvhinweis' }, 'Lädt …'));
  } else {
    const nachr = st.nachrichten || [];
    nachr.forEach((n, i) => {
      const vonAgent = n.von === 'agent';
      const tippt = vonAgent && /^\s*…\s*$/.test(n.text || '');
      if (tippt && !devLaeuft()) return;  // leere Platzhalter alter, abgebrochener Laeufe nicht zeigen
      const blase = el('div', { class: 'dvblase' + (vonAgent ? ' md' : '') + (tippt ? ' tippt' : '') });
      if (tippt) blase.append(el('span', {}), el('span', {}), el('span', {}));
      else if (vonAgent) blase.innerHTML = chatMd(n.text); else blase.textContent = n.text;
      const zeile = el('div', { class: 'dvmsg ' + (vonAgent ? 'agent' : 'nutzer') },
        el('div', { class: 'dvwer' }, vonAgent ? 'Tony' : (n.von === DEV.ich.wer ? 'Du' : n.von)), blase);
      // Der Arbeitsweg gehoert unter die Nachricht, an der Tony gerade schreibt.
      if (vonAgent && devLaeuft() && i === nachr.length - 1) zeile.append(devArbeitsweg(st.lauf));
      verlauf.append(zeile);
    });
    if (devLaeuft() && (!nachr.length || nachr[nachr.length - 1].von !== 'agent')) {
      verlauf.append(el('div', { class: 'dvmsg agent' }, el('div', { class: 'dvwer' }, 'Tony'),
        el('div', { class: 'dvblase tippt' }, el('span', {}), el('span', {}), el('span', {})), devArbeitsweg(st.lauf)));
    }
    if (st.vorschau) verlauf.append(devVorschauKarte(st.vorschau));
  }
  if (DEV.wartend) {
    verlauf.append(el('div', { class: 'dvmsg nutzer' }, el('div', { class: 'dvwer' }, 'Du'), el('div', { class: 'dvblase' }, DEV.wartend)));
    verlauf.append(el('div', { class: 'dvmsg agent' }, el('div', { class: 'dvwer' }, 'Tony'),
      el('div', { class: 'dvblase tippt' }, el('span', {}), el('span', {}), el('span', {}))));
  }
  h.append(verlauf);

  const ta = el('textarea', { class: 'dvta', rows: 3,
    placeholder: DEV.faden ? (devLaeuft() ? 'Schreib dazwischen — Tony nimmt es in die laufende Arbeit auf …' : 'Antworten …')
      : 'Was soll gebaut werden?' });
  ta.value = entwurf || '';
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); devSenden(ta); } });
  h.append(el('div', { class: 'dveingabe' }, ta,
    el('div', { class: 'dvsendezeile' },
      el('span', { class: 'dvhinweis' }, 'Enter sendet · Umschalt+Enter neue Zeile'),
      el('button', { class: 'btn', onclick: () => devSenden(ta) }, DEV.sendet ? 'Sendet …' : 'Senden'))));
  return h;
}

// Was der Coding Agent gerade tut: Plan (Arbeitsliste), aktueller Schritt, die letzten Schritte.
function devArbeitsweg(l) {
  const w = (l && l.weg) || {};
  const box = el('details', { class: 'dvweg' });
  if (DEV.wegOffen) box.open = true;
  box.addEventListener('toggle', () => { DEV.wegOffen = box.open; });
  const plan0 = Array.isArray(w.plan) ? w.plan : [];
  const fertig = plan0.filter((p) => p.s === 'completed').length;
  box.append(el('summary', { class: 'dvwegkopf' }, l.status === 'queued' ? 'wartet, bis der Coding Agent frei ist …'
    : (w.jetzt || 'arbeitet') + (plan0.length ? ' · ' + fertig + '/' + plan0.length : '') + (l.still_s > 90 ? ' · seit ' + l.still_s + ' s still' : '')));
  const plan = Array.isArray(w.plan) ? w.plan : [];
  if (plan.length) {
    const ul = el('ul', { class: 'dvplan' });
    for (const p of plan) ul.append(el('li', { class: 'dvp ' + (p.s || '') },
      el('span', { class: 'dvpz' }, p.s === 'completed' ? '✓' : p.s === 'in_progress' ? '›' : '·'), p.t || ''));
    box.append(ul);
  }
  const sch = Array.isArray(w.schritte) ? w.schritte.slice(-4) : [];
  for (const x of sch) box.append(el('div', { class: 'dvschritt' }, (x.a ? x.a + ': ' : '') + (x.t || '')));
  return box;
}

function devVorschauKarte(v) {
  const k = el('div', { class: 'dvvkarte' },
    el('div', { class: 'dvvtitel' }, 'Vorschau vom ' + devZeit(v.erstellt)),
    el('div', { class: 'dvvmeta' }, v.uebernommen_am ? 'übernommen' : v.uebernahme_run ? 'wird gerade übernommen' : (v.pruefung || '')));
  const kn = el('div', { class: 'dvvknoepfe' }, el('button', { class: 'btn ghost', onclick: () => devVorschau(v.id) }, 'Vorschau öffnen'));
  if (DEV.stand.darf_uebernehmen && !v.uebernahme_run) kn.append(el('button', { class: 'btn', onclick: () => devUebernehmen({ id: v.id, person: DEV.ich.wer }) }, 'Übernehmen'));
  k.append(kn);
  return k;
}

async function devUebernehmen(v) {
  if (!confirm('Vorschau von ' + v.person + ' übernehmen? Tony spielt sie in plan.html ein, testet und rollt das Board aus.')) return;
  const r = await restRpc('bau_uebernehmen', { p_id: v.id }).catch((e) => ({ fehler: e.message }));
  if (r.fehler) { alert(r.fehler); return; }
  DEV.faden = r.todo_id;
  await ladeDev();
}

// Vorschau im Board-Fenster: leere Seite derselben Herkunft, dann die Vorschau-Datei hineinschreiben.
// document.open() setzt die Adresse auf die des Boards; das Ersatz-Skript stellt ?projekt= wieder her,
// bevor plan.html location.search liest. Vorher hängt
// ein Datenbank-Ersatz davor: Lesen geht an die echte Datenbank, Schreiben wird verschluckt.
async function devVorschau(id) {
  let datei;
  try { datei = await restRpc('bau_vorschau', { p_id: id }); } catch (e) { alert('Vorschau nicht ladbar: ' + e.message); return; }
  if (!datei) { alert('Vorschau nicht gefunden.'); return; }
  const projekte = (S.projects || []).filter((p) => /pentling/i.test(p.name || ''));
  const p = projekte[0] || (S.projects || [])[0];
  if (!p) { alert('Kein Projekt für die Vorschau gefunden.'); return; }
  const ersatz = `<script>(function(){
  var U=${JSON.stringify(SUPA)},K=${JSON.stringify(ANON)};
  // document.open() gibt dem Dokument die Adresse des Boards -- ?projekt= neu setzen, bevor plan.html sie liest.
  try{history.replaceState(null,'',location.pathname.replace(/[^\/]*$/,'')+'terminplan/vorschau.html?'+'projekt='+encodeURIComponent(${JSON.stringify(p.id)})+'&name='+encodeURIComponent(${JSON.stringify(p.name)}));}catch(e){}
  window.__VORSCHAU=true;
  window.__dbMock=async function(pfad,opt){opt=opt||{};var m=(opt.method||'GET').toUpperCase();
    if(m==='GET'){var s=null;try{s=JSON.parse(localStorage.getItem('gb_session'))}catch(e){}
      var r=await fetch(U+'/rest/v1/'+pfad,{headers:{apikey:K,Authorization:'Bearer '+((s&&s.access_token)||'')}});
      if(!r.ok)throw new Error('Datenbank '+r.status);return r.json();}
    return m==='POST'&&!/^rpc\\//.test(pfad)?[]:null;};
  addEventListener('DOMContentLoaded',function(){var b=document.createElement('div');
    b.textContent='Vorschau · Änderungen werden nicht gespeichert';
    b.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:10px;z-index:99999;background:#1C1C1A;color:#fff;font:12px Inter,sans-serif;padding:6px 12px;border-radius:7px;opacity:.85;pointer-events:none';
    document.body.appendChild(b);});
})();<\/script>`;
  const html = /<head[^>]*>/i.test(datei) ? datei.replace(/<head[^>]*>/i, (m) => m + ersatz) : ersatz + datei;
  const huelle = el('div', { class: 'dvvorschau' });
  const zu = () => huelle.remove();
  const f = el('iframe', { class: 'dvvframe', src: 'terminplan/vorschau.html?projekt=' + encodeURIComponent(p.id) + '&name=' + encodeURIComponent(p.name) });
  f.addEventListener('load', () => { const d = f.contentDocument; if (!d || d.__geschrieben) return; d.open(); d.write(html); d.close(); d.__geschrieben = true; }, { once: true });
  huelle.append(el('div', { class: 'dvvleiste' },
    el('span', {}, 'Vorschau Terminplanung · ' + p.name),
    el('button', { class: 'btn ghost', onclick: zu }, 'Schließen')), f);
  document.body.append(huelle);
}

function devZeit(t) {
  const d = new Date(t);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
