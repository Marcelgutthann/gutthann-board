// ---------- Chat: Agent losschicken, Dokument rechts (Migration 201, 29.09.) ----------
// Aus dem Board-Chat laesst sich ein Agent losschicken (LPH 2-8). Sobald der Chat ein Dokument
// hat, rueckt er nach links und das Dokument steht rechts. Der Chat bleibt ein Gespraech mit Tony;
// sagt man ausdruecklich, dass sich das Dokument aendern soll, gibt Tony das an einen Claude-Agenten
// auf dem Buero-PC weiter (Runner 'dokument-aendern'); rechts laedt die neue Fassung.
// Eigene Datei neben app.js, damit parallele Arbeit am Chat nicht in dieselben Zeilen faehrt.
// Einhaengen in app.js: renderChat -> chatDokRender(), chatOeffnen/chatNeu -> chatDokLaden().

const KIDOK_LPH = [[2, 'Vorplanung'], [3, 'Entwurfsplanung'], [4, 'Genehmigungsplanung'], [5, 'Ausführungsplanung'],
  [6, 'Vorbereitung der Vergabe'], [7, 'Mitwirkung bei der Vergabe'], [8, 'Objektüberwachung']];

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
    leiste.append(el('button', { class: 'kichip', type: 'button', onclick: (e) => chatAgentWahl(e) }, '+ Agent losschicken'));
    // Jede Nachricht geht an Tony (29.09.). Aendern soll sich das Dokument nur, wenn man es
    // ausdruecklich sagt -- das erkennt Tony und gibt es an den Agenten weiter (dokument_aendern_lassen).
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
  kopf.append(
    el('div', { class: 'kidoktitel', title: d.titel }, d.titel),
    el('span', { class: 'kidokzustand' + (arbeitet ? ' laeuft' : '') }, zustand),
    // Tonys Seiten haben einen eigenen Druckknopf; von hier aus loest ihn eine Nachricht aus.
    ...(d.html ? [el('button', { class: 'kichip', type: 'button', title: 'Drucken oder als PDF speichern',
      onclick: () => panel.querySelector('.kidokframe')?.contentWindow?.postMessage({ ghiw: 'drucken' }, '*') }, 'PDF'),
      el('button', { class: 'kichip', type: 'button', title: 'In neuem Fenster öffnen',
        onclick: () => window.open(URL.createObjectURL(new Blob([d.html], { type: 'text/html' }))) }, 'Öffnen')] : []),
    ...(d.anhang_pfad ? [el('button', { class: 'kichip', type: 'button', title: 'In neuem Fenster öffnen',
      onclick: () => oeffneAnhaenge([{ pfad: d.anhang_pfad, name: d.name || 'Dokument.html' }]) }, 'Öffnen')] : []),
    el('button', { class: 'kichip', type: 'button', title: 'Dokument ausblenden', onclick: () => { S.kichat.dokZu = true; renderChat(); } }, '×'));

  const flaeche = panel.querySelector('.kidokflaeche');
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
    const plan = Array.isArray(w.plan) ? w.plan : [];
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

// Menue: erst die Leistungsphase, dann das Projekt (wie die Projektwahl an der Karte).
function chatAgentWahl(e) {
  e.stopPropagation();
  const k = S.kichat;
  if (k.denkt) return uiHinweis('Warte kurz, bis die Antwort da ist.');
  const r = e.currentTarget.getBoundingClientRect();
  ctxMenu(r.left, r.top - 8, [{ note: 'Bericht schreiben lassen' }, ...KIDOK_LPH.map(([n, name]) => ({
    txt: 'LPH ' + n + ' · ' + name,
    do: () => setTimeout(() => ctxMenu(r.left, r.top - 8, [{ note: 'LPH ' + n + ' für welches Projekt?' },
      ...[...(S.projects || [])].sort((a, b) => String(a.name).localeCompare(String(b.name), 'de'))
        .map((p) => ({ txt: p.name, do: () => chatAgentStarten(n, p) }))])),
  }))]);
}

async function chatAgentStarten(lph, p) {
  const k = S.kichat;
  const j = await chatAktion('dok_starten', { chat_id: k.id, projekt: p.id, lph }).catch((e) => ({ fehler: e.message }));
  if (j.chat_id && !k.id) k.id = j.chat_id;
  if (j.fehler || j.error) { uiHinweis(j.fehler || j.error); return; }
  k.zeilen.push({ rolle: 'assistent', text: 'Agent LPH ' + lph + ' für ' + p.name + ' ist losgeschickt. Das Dokument erscheint rechts, sobald er fertig ist.' });
  k.dok = { id: j.dok_id, titel: j.titel, status: 'arbeitet', version: 0, lauf_status: 'queued' };
  k.dokZu = false;
  renderChat();
  ladeChats();
  chatDokTakt(k);
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
  const j = await chatAktion('dok_stand', { chat_id: k.id }).catch(() => ({}));
  if (S.kichat !== k) return;
  k.dok = j.dok || null;
  if (k.dok?.status === 'arbeitet') chatDokTakt(k); // Tony bleibt ansprechbar, waehrend der Agent arbeitet
  renderChat();
}

// Nachfragen, solange der Agent arbeitet. Ohne Realtime im Board: alle 4 s, hoechstens 40 min.
function chatDokTakt(k) {
  if (k.dokTakt) return;
  const bis = Date.now() + 40 * 60000;
  k.dokTakt = setInterval(async () => {
    if (S.kichat !== k || Date.now() > bis) { clearInterval(k.dokTakt); k.dokTakt = null; return; }
    const j = await chatAktion('dok_stand', { chat_id: k.id }).catch(() => null);
    if (!j?.dok || S.kichat !== k) return;
    const vorher = k.dok;
    k.dok = j.dok;
    if (j.dok.status !== 'arbeitet') {
      clearInterval(k.dokTakt); k.dokTakt = null;
      if (k.dokZeile) { k.dokZeile.text = j.dok.antwort || 'Fertig.'; k.dokZeile.laeuft = false; k.dokZeile = null; }
      else if (j.dok.antwort && vorher?.status === 'arbeitet') k.zeilen.push({ rolle: 'assistent', text: j.dok.antwort });
    }
    if (S.active?.typ === 'chat') renderChat();
  }, 4000);
}
