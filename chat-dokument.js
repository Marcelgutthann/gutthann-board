// ---------- Chat: Agent losschicken, Dokument rechts (Migration 201, 29.09.) ----------
// Aus dem Board-Chat laesst sich ein Agent losschicken (Katalog, Migration 204). Sobald der Chat ein Dokument
// hat, rueckt er nach links und das Dokument steht rechts. Der Chat bleibt ein Gespraech mit Tony;
// sagt man ausdruecklich, dass sich das Dokument aendern soll, gibt Tony das an einen Claude-Agenten
// auf dem Buero-PC weiter (Runner 'dokument-aendern'); rechts laedt die neue Fassung.
// Eigene Datei neben app.js, damit parallele Arbeit am Chat nicht in dieselben Zeilen faehrt.
// Einhaengen in app.js: renderChat -> chatDokRender(), chatOeffnen/chatNeu -> chatDokLaden().

// Wird am Ende jedes renderChat gerufen: Agent-Leiste ueber der Eingabe, Zweiteilung, Dokument.
function chatDokRender() {
  const root = document.getElementById('chat-root');
  const k = S.kichat;
  if (!root || !k) return;
  const d = k.dok;
  // Ohne Dokument laesst sich die Zweiteilung ueber den Knopf oben rechts trotzdem oeffnen.
  const zeigen = d ? !k.dokZu : !!k.zweiOffen;
  root.classList.toggle('mitdok', zeigen);
  document.querySelector('.splitbtn')?.classList.toggle('on', zeigen);

  const eing = root.querySelector('.kieingabe');
  if (eing) {
    let leiste = eing.querySelector('.kiagenten');
    if (!leiste) { leiste = el('div', { class: 'kiagenten' }); eing.prepend(leiste); }
    leiste.innerHTML = '';
    leiste.append(el('button', { class: 'kiplus', type: 'button', title: 'Datei, Projekt oder Agent hinzufügen', 'aria-label': 'Hinzufügen',
      onclick: (e) => { e.stopPropagation(); chatPlusMenue(leiste); } }, '+'), ...chatPlusChips());
    // Jede Nachricht geht an Tony (29.09.). Aendern soll sich das Dokument nur, wenn man es
    // ausdruecklich sagt -- das erkennt Tony und gibt es an den Agenten weiter (dokument_aendern_lassen).
    chatDateiZiel(root.querySelector('.kihaupt'));
  }

  let panel = root.querySelector('.kidok');
  const haupt = root.querySelector('.kihaupt');
  if (!zeigen) { panel?.remove(); root.querySelector('.kiteiler')?.remove(); if (haupt) haupt.style.flexBasis = ''; return; }
  if (!panel) { panel = el('div', { class: 'kidok' }); root.append(panel); }
  chatTeiler(root, haupt, panel);
  chatDokPanel(panel, d);
}

// Knopf oben links im Chat: Board-Navigation und Chatverlaeufe zusammen ein-/ausklappen.
// Gilt nur im Chat; renderTopbar setzt die Klasse bei jedem Ansichtswechsel neu.
function chatSeiteZu() {
  try { return localStorage.getItem('kichat.seitezu') === '1'; } catch (_) { return false; }
}
function chatSeitenKnopf() {
  return el('button', { class: 'seitenbtn', type: 'button', title: 'Seitenleiste ein-/ausblenden',
    onclick: () => {
      const zu = !chatSeiteZu();
      try { localStorage.setItem('kichat.seitezu', zu ? '1' : '0'); } catch (_) {}
      document.getElementById('app')?.classList.toggle('seitezu', zu);
    } }, el('span', { class: 'seitenicon' }));
}

// Knopf oben rechts in der Kopfleiste: Chat und Dokument nebeneinander an/aus.
function chatDokKnopf() {
  const k = S.kichat;
  const an = !!k && (k.dok ? !k.dokZu : !!k.zweiOffen);
  return el('button', { class: 'splitbtn' + (an ? ' on' : ''), type: 'button', title: 'Zwei Fenster: Chat und Dokument nebeneinander',
    onclick: () => {
      const k = S.kichat;
      if (!k) return;
      if (k.dok) k.dokZu = !k.dokZu; else k.zweiOffen = !k.zweiOffen;
      renderChat();
    } }, el('span', { class: 'spliticon' }));
}

// Senkrechter Trenner zwischen Chat und Dokument: ziehen aendert die Chatbreite, Doppelklick
// setzt sie zurueck. Die Breite bleibt im Browser gespeichert.
function chatTeiler(root, haupt, panel) {
  if (!haupt) return;
  let t = root.querySelector('.kiteiler');
  if (!t) {
    t = el('div', { class: 'kiteiler', title: 'Ziehen: Breite ändern · Doppelklick: zurücksetzen' });
    t.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      t.setPointerCapture(e.pointerId);
      root.classList.add('ziehen');
      const links = haupt.getBoundingClientRect().left;
      const zug = (ev) => { haupt.style.flexBasis = chatBreite(root, ev.clientX - links) + 'px'; };
      const los = () => {
        t.removeEventListener('pointermove', zug);
        root.classList.remove('ziehen');
        try { localStorage.setItem('kichat.breite', String(parseInt(haupt.style.flexBasis, 10))); } catch (_) {}
      };
      t.addEventListener('pointermove', zug);
      t.addEventListener('pointerup', los, { once: true });
      t.addEventListener('pointercancel', los, { once: true });
    });
    t.addEventListener('dblclick', () => {
      haupt.style.flexBasis = '';
      try { localStorage.removeItem('kichat.breite'); } catch (_) {}
    });
  }
  if (t.nextSibling !== panel) root.insertBefore(t, panel);
  let w = 0;
  try { w = parseInt(localStorage.getItem('kichat.breite'), 10) || 0; } catch (_) {}
  if (w && !root.classList.contains('ziehen')) haupt.style.flexBasis = chatBreite(root, w) + 'px';
}
function chatBreite(root, w) {
  return Math.round(Math.max(300, Math.min(w, root.clientWidth - 360)));
}

// Arbeitsliste des Agenten (Migr. 205): bleibt nach dem Ende stehen, bis man sie mit × ausblendet.
// Gemerkt je Dokument und Lauf im Browser -- der naechste Lauf bringt wieder seine eigene Liste.
function chatDokListeSchluessel(d) { return 'awzu:' + d.id + ':' + ((d.lauf_weg && d.lauf_weg.start) || ''); }
function chatDokListeZu(d) { try { return localStorage.getItem(chatDokListeSchluessel(d)) === '1'; } catch { return false; } }
function chatDokListe(panel, flaeche, d, arbeitet) {
  panel.querySelector('.kidokliste')?.remove();
  const plan = Array.isArray(d.lauf_weg?.plan) ? d.lauf_weg.plan : [];
  // Ohne Dokument zeigt das Wartefeld die Liste selbst -- hier nur, wenn ein Dokument dasteht.
  if (!plan.length || chatDokListeZu(d) || !(d.html || d.anhang_pfad)) return;
  const fertig = plan.filter((p) => p.s === 'completed').length;
  const box = el('div', { class: 'kidokliste' },
    el('div', { class: 'kidoklistekopf' },
      el('span', {}, `Arbeitsliste ${fertig} von ${plan.length}` + (arbeitet ? '' : ' · fertig')),
      el('button', { class: 'kichip', type: 'button', title: 'Arbeitsliste ausblenden', onclick: () => {
        try { localStorage.setItem(chatDokListeSchluessel(d), '1'); } catch { /* ohne Speicher nur fuer jetzt */ }
        box.remove();
      } }, '×')),
    ...plan.map((p) => el('div', { class: 'awp ' + (p.s || 'pending') },
      (p.s === 'completed' ? '✓ ' : p.s === 'in_progress' ? '▸ ' : '○ ') + p.t)));
  panel.insertBefore(box, flaeche);
}

function chatDokPanel(panel, d) {
  if (!d) {
    // Zweiteilung ohne Dokument: leeres Blatt mit Hinweis, wie eins entsteht.
    panel.innerHTML = '';
    panel.append(
      el('div', { class: 'kidokkopf' }, el('div', { class: 'kidoktitel' }, 'Dokument'),
        el('button', { class: 'kichip', type: 'button', title: 'Zweite Ansicht schließen', onclick: () => { S.kichat.zweiOffen = false; renderChat(); } }, '×')),
      el('div', { class: 'kidokflaeche', 'data-pfad': 'leer' }, el('div', { class: 'kidokwarte' },
        'Noch kein Dokument. Schick unten einen Agenten los oder bitte Tony, eins zu schreiben.')));
    return;
  }
  const arbeitet = d.status === 'arbeitet';
  let kopf = panel.querySelector('.kidokkopf');
  if (!kopf) {
    kopf = el('div', { class: 'kidokkopf' });
    panel.append(kopf, el('div', { class: 'kidokflaeche' }));
  }
  kopf.innerHTML = '';
  const wer = d.agent === 'tony' ? 'Tony' : 'Agent';
  const zustand = arbeitet ? (d.version ? wer + ' ändert …' : wer + ' schreibt …') : d.status === 'fehler' ? 'Fehler' : 'Stand ' + (d.version || 1);
  // Arbeitsweg (Migr. 205) auch dann sichtbar, wenn schon ein Dokument steht (Aenderungslauf).
  const weg = arbeitet && d.lauf_weg ? d.lauf_weg : null;
  const wegPlan = weg && Array.isArray(weg.plan) && weg.plan.length ? `${weg.plan.filter((p) => p.s === 'completed').length}/${weg.plan.length}` : '';
  const wegText = !weg ? '' : [wegPlan && 'Arbeitsliste ' + wegPlan, weg.jetzt,
    d.still_s >= 180 ? `kein Lebenszeichen seit ${Math.floor(d.still_s / 60)} min` : d.still_s >= 60 ? `still seit ${Math.floor(d.still_s / 60)}:${String(d.still_s % 60).padStart(2, '0')}` : ''].filter(Boolean).join(' · ');
  kopf.append(
    el('div', { class: 'kidoktitel', title: d.titel }, d.titel),
    el('span', { class: 'kidokzustand' + (arbeitet ? ' laeuft' : ''), title: wegText }, zustand + (wegText && d.html ? ' · ' + wegText : '')),
    // Tonys Seiten haben einen eigenen Druckknopf; von hier aus loest ihn eine Nachricht aus.
    ...(d.html ? [el('button', { class: 'kichip', type: 'button', title: 'Drucken oder als PDF speichern',
      onclick: () => panel.querySelector('.kidokframe')?.contentWindow?.postMessage({ ghiw: 'drucken' }, '*') }, 'PDF'),
      el('button', { class: 'kichip', type: 'button', title: 'In neuem Fenster öffnen',
        onclick: () => window.open(URL.createObjectURL(new Blob([d.html], { type: 'text/html' }))) }, 'Öffnen')] : []),
    ...(d.anhang_pfad ? [el('button', { class: 'kichip', type: 'button', title: 'In neuem Fenster öffnen',
      onclick: () => oeffneAnhaenge([{ pfad: d.anhang_pfad, name: d.name || 'Dokument.html' }]) }, 'Öffnen')] : []),
    ...kiFassungKnopf(d, panel), // fruehere Fassungen (chat-werkstatt.js, Migration 204)
    el('button', { class: 'kichip', type: 'button', title: 'Dokument ausblenden', onclick: () => { S.kichat.dokZu = true; renderChat(); } }, '×'));

  const flaeche = panel.querySelector('.kidokflaeche');
  chatDokListe(panel, flaeche, d, arbeitet);
  if (d.html) {
    // Tonys Seite liegt direkt im Datensatz (Migration 203). Neu laden nur, wenn sich der Inhalt
    // aendert -- nicht schon, weil die Fassungsnummer aus der Datenbank nachkommt.
    let h = 0;
    for (let i = 0; i < d.html.length; i++) h = (h * 31 + d.html.charCodeAt(i)) | 0;
    const schluessel = 'tony:' + d.html.length + ':' + h;
    if (flaeche.dataset.pfad !== schluessel) {
      flaeche.dataset.pfad = schluessel;
      flaeche.innerHTML = '';
      const fr = el('iframe', { class: 'kidokframe', title: d.titel, sandbox: 'allow-scripts allow-modals allow-popups' });
      fr.src = URL.createObjectURL(new Blob([d.html], { type: 'text/html' }));
      flaeche.append(fr);
    }
    flaeche.classList.toggle('arbeitet', arbeitet);
    return;
  }
  if (!d.anhang_pfad) {
    // Noch keine Datei: Fortschritt aus dem Laufprotokoll zeigen, damit sichtbar ist, dass er arbeitet.
    flaeche.dataset.pfad = '';
    flaeche.innerHTML = '';
    const zeilen = String(d.protokoll || '').split('\n').map((z) => z.trim()).filter(Boolean).slice(-10);
    // Arbeitsweg (Migr. 205): hat der Lauf einen (SDK-Agent), Arbeitsliste + letzte Schritte statt Rohlog;
    // sonst (claude -p, schreibt erst am Ende) bleibt das Protokoll. Darueber immer das Lebenszeichen.
    const w = d.lauf_weg || {};
    const plan = Array.isArray(w.plan) && !chatDokListeZu(d) ? w.plan : [];
    const schritte = Array.isArray(w.schritte) ? w.schritte.slice(-6) : [];
    const puls = !arbeitet || d.still_s == null ? ''
      : el('div', { class: 'kidokpuls' + (d.still_s >= 180 ? ' haengt' : '') }, d.still_s >= 180
        ? `Kein Lebenszeichen seit ${Math.floor(d.still_s / 60)} min – nach 10 min wird der Lauf abgebrochen.`
        : `lebt · letzte Rückmeldung vor ${d.still_s} Sek.` + (w.jetzt ? ` · ${w.jetzt}` : ''));
    flaeche.append(el('div', { class: 'kidokwarte' },
      el('div', { class: 'kidokwartetitel' }, arbeitet
        ? d.agent === 'tony' ? 'Tony schreibt das Dokument …' : (d.lauf_status === 'queued' ? 'Wartet auf den Büro-PC …' : 'Der Agent schreibt den Bericht. Das dauert einige Minuten.')
        : (d.antwort || 'Kein Dokument entstanden.')),
      puls,
      plan.length ? el('div', { class: 'kidokplan' }, ...plan.map((p) => el('div', { class: 'awp ' + (p.s || 'pending') },
        (p.s === 'completed' ? '✓ ' : p.s === 'in_progress' ? '▸ ' : '○ ') + p.t))) : '',
      schritte.length ? el('pre', { class: 'kidokprot' }, schritte.map((x) => mmss(x.s || 0) + '  ' + x.t).join('\n'))
        : zeilen.length ? el('pre', { class: 'kidokprot' }, zeilen.join('\n')) : ''));
    return;
  }
  if (flaeche.dataset.pfad !== d.anhang_pfad) {
    flaeche.dataset.pfad = d.anhang_pfad;
    flaeche.innerHTML = '';
    // Der Bericht bringt seinen eigenen Bearbeitungsmodus (Skripte) mit, laeuft aber ohne
    // Zugriff auf die Board-Seite und deren Anmeldung.
    const fr = el('iframe', { class: 'kidokframe', title: d.titel, sandbox: 'allow-scripts allow-modals allow-downloads allow-popups allow-forms' });
    flaeche.append(fr);
    anhangUrl({ pfad: d.anhang_pfad, name: d.name || 'Dokument.html' })
      .then(async (u) => {
        // anhangUrl nimmt den Typ aus der Storage; HTML muss als HTML laufen, nicht als Text.
        const b = await (await fetch(u)).blob();
        fr.src = URL.createObjectURL(new Blob([b], { type: 'text/html' }));
      })
      .catch(() => { flaeche.innerHTML = ''; flaeche.append(el('div', { class: 'kidokwarte' }, 'Dokument nicht abrufbar.')); });
  }
  flaeche.classList.toggle('arbeitet', arbeitet);
}

// ---------- Plus ueber der Eingabe (Marcel, 29.09.) ----------
// Ein „+" statt „Agent losschicken": es schiesst ein Menue nach oben mit Datei, Projekt, Agent.
// Datei: Tony liest sie mit (live-backend gibt sie dem Modell als Anhang). Projekt: hoechstens eins;
// der Chat bezieht sich darauf und liegt danach unter dem Projekt (Migration 207). Nach anderen
// Projekten suchen kann Tony trotzdem. Agent: die Agentenuebersicht, dort startet „+" einen neuen.
const KI_DATEI_MAX = 8 * 1024 * 1024; // alle Dateien einer Nachricht zusammen, der Body geht als JSON

function chatPlusChips() {
  const k = S.kichat;
  const p = chatProjektVon(k);
  const chips = [];
  if (p) chips.push(el('span', { class: 'kiwahl' }, ico('folder'), el('span', {}, p.name),
    // Ein bestehender Chat bleibt bei seinem Projekt; nur vor der ersten Nachricht laesst es sich abnehmen.
    !k.id ? el('button', { type: 'button', title: 'Projekt entfernen', onclick: () => { k.projekt = null; renderChat(); } }, '×') : ''));
  for (const d of k.dateien || []) chips.push(el('span', { class: 'kiwahl' }, el('span', {}, d.name),
    el('button', { type: 'button', title: 'Datei entfernen', onclick: () => { k.dateien = k.dateien.filter((x) => x !== d); renderChat(); } }, '×')));
  return chips;
}
// Projekt des Chats: frisch gewaehlt, sonst das, unter dem der Chat schon liegt.
function chatProjektVon(k) {
  if (k?.projekt) return k.projekt;
  const c = k?.id && (S.kichats || []).find((x) => x.id === k.id);
  return c?.project_id ? { id: c.project_id, name: c.projekt || 'Projekt' } : null;
}

function chatPlusMenue(leiste) {
  const alt = leiste.querySelector('.kiplusmenue');
  if (alt) return chatPlusZu(alt);
  const k = S.kichat;
  const m = el('div', { class: 'kiplusmenue', role: 'menu' });
  const punkt = (icon, txt, sub, tu) => el('button', { type: 'button', role: 'menuitem', onclick: (e) => { e.stopPropagation(); tu(); } },
    el('span', { class: 'kiplusico' }, icon), el('span', { class: 'kipluswas' }, el('b', {}, txt), el('span', {}, sub)));
  const hauptliste = () => {
    m.innerHTML = '';
    m.append(
      punkt(ico('clip'), 'Datei', 'PDF, Bild oder Text – oder einfach in den Chat ziehen', () => { chatPlusZu(m); chatDateiWahl(); }),
      punkt(ico('folder'), 'Projekt', chatProjektVon(k) ? 'Chat bezieht sich auf ' + chatProjektVon(k).name : 'Chat bezieht sich auf ein Projekt', () => {
        if (k.id && chatProjektVon(k)) return uiHinweis('Dieser Chat liegt schon unter ' + chatProjektVon(k).name + '. Für ein anderes Projekt einen neuen Chat anfangen.');
        projektliste();
      }),
      punkt(ico('bot'), 'Agent', 'Agentenübersicht – losschicken oder neu anlegen', () => { chatPlusZu(m); chatAnsicht('agenten'); }));
  };
  const projektliste = () => {
    m.innerHTML = '';
    const such = el('input', { class: 'kiplussuch', type: 'search', placeholder: 'Projekt suchen …', 'aria-label': 'Projekt suchen' });
    const liste = el('div', { class: 'kiplusliste' });
    const zeichne = () => {
      const q = such.value.toLowerCase().trim();
      liste.innerHTML = '';
      for (const p of [...(S.projects || [])].sort((x, y) => String(x.name).localeCompare(String(y.name), 'de'))
        .filter((p) => !q || String(p.name).toLowerCase().includes(q))) {
        liste.append(el('button', { type: 'button', onclick: (e) => { e.stopPropagation(); k.projekt = { id: p.id, name: p.name }; chatPlusZu(m); renderChat(); } }, p.name));
      }
      if (!liste.childElementCount) liste.append(el('div', { class: 'kiplusleer' }, 'Kein Projekt gefunden.'));
    };
    such.addEventListener('input', zeichne);
    such.addEventListener('click', (e) => e.stopPropagation());
    m.append(el('button', { type: 'button', class: 'kipluszurueck', onclick: (e) => { e.stopPropagation(); hauptliste(); } }, '← Projekt wählen'), such, liste);
    zeichne();
    such.focus();
  };
  hauptliste();
  leiste.append(m);
  requestAnimationFrame(() => m.classList.add('auf'));
  const weg = (e) => { if (!m.contains(e.target)) chatPlusZu(m); };
  m._weg = weg;
  setTimeout(() => addEventListener('click', weg));
}
function chatPlusZu(m) {
  if (m._weg) removeEventListener('click', m._weg);
  m.classList.remove('auf');
  setTimeout(() => m.remove(), 160);
}

function chatDateiWahl() {
  const inp = el('input', { type: 'file', multiple: '' });
  inp.addEventListener('change', () => chatDateienNehmen(inp.files));
  inp.click();
}
// Dateien auf die Chatflaeche ziehen (einmal je Element anmelden).
function chatDateiZiel(haupt) {
  if (!haupt || haupt._dateiZiel) return;
  haupt._dateiZiel = true;
  const istDatei = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
  haupt.addEventListener('dragover', (e) => { if (!istDatei(e) || S.kiansicht) return; e.preventDefault(); haupt.classList.add('filedrag'); });
  haupt.addEventListener('dragleave', (e) => { if (!haupt.contains(e.relatedTarget)) haupt.classList.remove('filedrag'); });
  haupt.addEventListener('drop', (e) => {
    haupt.classList.remove('filedrag');
    if (!istDatei(e) || S.kiansicht) return;
    e.preventDefault(); e.stopPropagation();
    chatDateienNehmen(e.dataTransfer.files);
  });
}
async function chatDateienNehmen(dateien) {
  const k = S.kichat;
  if (!k) return;
  k.dateien = k.dateien || [];
  let summe = k.dateien.reduce((s, d) => s + d.groesse, 0);
  for (const f of Array.from(dateien || [])) {
    if (summe + f.size > KI_DATEI_MAX) { uiHinweis(f.name + ' passt nicht mehr dazu – zusammen höchstens 8 MB je Nachricht.'); continue; }
    summe += f.size;
    k.dateien.push({ name: f.name, mime: f.type || 'application/octet-stream', groesse: f.size, base64: await dateiAlsBase64(f) });
  }
  if (S.kichat === k) { renderChat(); document.querySelector('#chat-root .kita')?.focus(); }
}

// Menue aus dem Agenten-Katalog (Migration 204): erst der Agent, dann das Projekt (chat-werkstatt.js).
function chatAgentWahl(e) {
  e.stopPropagation();
  if (S.kichat.denkt) return uiHinweis('Warte kurz, bis die Antwort da ist.');
  kiAgentMenue(e.currentTarget.getBoundingClientRect());
}

// Tony schreibt selbst ein Dokument (Werkzeug dokument_zeigen, Migration 203). Aus dem Stream:
// {t:'w', name:'dokument_zeigen'} -> rechts aufmachen und "schreibt" zeigen; {t:'dok'} -> die
// fertige Seite sofort anzeigen, noch bevor Tony seinen Satz dazu schreibt.
function chatDokStrom(e, z) {
  const k = S.kichat;
  if (e.t === 'w' && e.name === 'dokument_zeigen') {
    z.tut = 'schreibt das Dokument';
    const alt = k.dok?.agent === 'tony' ? k.dok : null;
    k.dok = { ...(alt || { agent: 'tony', titel: 'Dokument', version: 0 }), status: 'arbeitet' };
    k.dokZu = false;
    renderChat();
  } else if (e.t === 'dok') {
    const v = k.dok?.agent === 'tony' ? (k.dok.version || 0) + 1 : 1;
    k.dok = { ...(k.dok?.agent === 'tony' ? k.dok : {}), agent: 'tony', titel: e.titel, html: e.html, status: 'fertig', version: v };
    k.dokZu = false;
    renderChat();
  }
}
// Schluss der Antwort: gespeicherte Fassung (id, Version) uebernehmen.
function chatDokEnde(antwort) {
  const k = S.kichat, d = antwort?.dokument, auftrag = antwort?.dok_auftrag;
  // Tony hat einen Aenderungsauftrag an den Dokument-Agenten weitergegeben: rechts "arbeitet" zeigen und nachfragen.
  if (auftrag && k.dok) {
    if (auftrag.fehler || auftrag.error) k.zeilen.push({ rolle: 'fehler', text: auftrag.fehler || auftrag.error });
    else { k.dok = { ...k.dok, status: 'arbeitet', lauf_status: 'queued' }; k.dokZu = false; chatDokTakt(k); }
  }
  if (!d) {
    // Werkzeug gestartet, aber kein Dokument entstanden: die Wartefläche nicht stehen lassen.
    if (k.dok?.agent === 'tony' && k.dok.status === 'arbeitet') k.dok = k.dok.html ? { ...k.dok, status: 'fertig' } : null;
    return;
  }
  k.dok = { id: d.id, agent: 'tony', titel: d.titel, html: d.html, inhalt: d.inhalt, status: 'fertig', version: d.version || k.dok?.version || 1 };
}

// Beim Oeffnen eines Chats: gehoert ein Dokument dazu?
async function chatDokLaden() {
  const k = S.kichat;
  if (!k?.id) { chatDokRender(); return; }
  // Aus GHIW Docs angeklickt: genau dieses Dokument, nicht das neueste des Chats (Migration 206).
  if (S.kiDokWahl) { k.dokWahl = S.kiDokWahl; S.kiDokWahl = null; }
  const j = await chatAktion('dok_stand', { chat_id: k.id, ...(k.dokWahl ? { dok_id: k.dokWahl } : {}) }).catch(() => ({}));
  if (S.kichat !== k) return;
  k.dok = j.dok || null;
  // Nichts zu zeigen (Agent mit Antwort im Chat, Migration 204): Feld rechts bleibt zu.
  if (k.dok && !k.dok.html && !k.dok.anhang_pfad && k.dok.status !== 'arbeitet') k.dokZu = true;
  if (k.dok?.status === 'arbeitet') chatDokTakt(k); // Tony bleibt ansprechbar, waehrend der Agent arbeitet
  renderChat();
}

// Nachfragen, solange der Agent arbeitet. Ohne Realtime im Board: alle 4 s, hoechstens 40 min.
function chatDokTakt(k) {
  if (k.dokTakt) return;
  const bis = Date.now() + 40 * 60000;
  k.dokTakt = setInterval(async () => {
    if (S.kichat !== k || Date.now() > bis) { clearInterval(k.dokTakt); k.dokTakt = null; return; }
    const j = await chatAktion('dok_stand', { chat_id: k.id, ...(k.dokWahl ? { dok_id: k.dokWahl } : {}) }).catch(() => null);
    if (!j?.dok || S.kichat !== k) return;
    const vorher = k.dok;
    k.dok = j.dok;
    if (j.dok.status !== 'arbeitet') {
      clearInterval(k.dokTakt); k.dokTakt = null;
      if (k.dokZeile) { k.dokZeile.text = j.dok.antwort || 'Fertig.'; k.dokZeile.laeuft = false; k.dokZeile = null; }
      else if (j.dok.antwort && vorher?.status === 'arbeitet') k.zeilen.push({ rolle: 'assistent', text: j.dok.antwort });
      kiLadeAgenten(); // „läuft" in der Seitenleiste nachziehen (chat-werkstatt.js)
    }
    if (S.active?.typ === 'chat') renderChat();
  }, 4000);
}
