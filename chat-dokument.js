// ---------- Chat: Agent losschicken, Dokument rechts (Migration 201, 29.09.) ----------
// Aus dem Board-Chat laesst sich ein Agent losschicken (LPH 2-8). Sobald der Chat ein Dokument
// hat, rueckt er nach links und das Dokument steht rechts. Jede weitere Nachricht geht dann als
// Aenderungsauftrag an einen Claude-Agenten auf dem Buero-PC (Runner 'dokument-aendern'), der
// die Datei bearbeitet; rechts laedt die neue Fassung, links steht seine Antwort.
// Eigene Datei neben app.js, damit parallele Arbeit am Chat nicht in dieselben Zeilen faehrt.
// Einhaengen in app.js: renderChat -> chatDokRender(), chatSenden -> chatDokSenden(),
// chatOeffnen/chatNeu -> chatDokLaden().

const KIDOK_LPH = [[2, 'Vorplanung'], [3, 'Entwurfsplanung'], [4, 'Genehmigungsplanung'], [5, 'Ausführungsplanung'],
  [6, 'Vorbereitung der Vergabe'], [7, 'Mitwirkung bei der Vergabe'], [8, 'Objektüberwachung']];

// Wird am Ende jedes renderChat gerufen: Agent-Leiste ueber der Eingabe, Zweiteilung, Dokument.
function chatDokRender() {
  const root = document.getElementById('chat-root');
  const k = S.kichat;
  if (!root || !k) return;
  const d = k.dok;
  const zeigen = !!d && !k.dokZu;
  root.classList.toggle('mitdok', zeigen);

  const eing = root.querySelector('.kieingabe');
  if (eing) {
    let leiste = eing.querySelector('.kiagenten');
    if (!leiste) { leiste = el('div', { class: 'kiagenten' }); eing.prepend(leiste); }
    leiste.innerHTML = '';
    leiste.append(el('button', { class: 'kichip', type: 'button', onclick: (e) => chatAgentWahl(e) }, '+ Agent losschicken'));
    if (d && k.dokZu) leiste.append(el('button', { class: 'kichip', type: 'button', onclick: () => { k.dokZu = false; renderChat(); } }, 'Dokument zeigen'));
    // Tonys eigene Dokumente aendert Tony selbst; nur Agenten-Dokumente brauchen die Weiche.
    if (zeigen && d.agent !== 'tony') {
      leiste.append(el('span', { class: 'kiziel' }, k.anTony ? 'Nachricht geht an Tony' : 'Nachricht ändert das Dokument'),
        el('button', { class: 'kichip leise', type: 'button', onclick: () => { k.anTony = !k.anTony; renderChat(); } },
          k.anTony ? 'ans Dokument' : 'lieber Tony fragen'));
    }
    const ta = eing.querySelector('.kita');
    if (ta) ta.placeholder = zeigen && (d.agent === 'tony' || !k.anTony) ? 'Was soll im Dokument anders werden?' : 'Frag Tony …';
  }

  let panel = root.querySelector('.kidok');
  if (!zeigen) { panel?.remove(); return; }
  if (!panel) { panel = el('div', { class: 'kidok' }); root.append(panel); }
  chatDokPanel(panel, d);
}

function chatDokPanel(panel, d) {
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
    flaeche.append(el('div', { class: 'kidokwarte' },
      el('div', { class: 'kidokwartetitel' }, arbeitet
        ? d.agent === 'tony' ? 'Tony schreibt das Dokument …' : (d.lauf_status === 'queued' ? 'Wartet auf den Büro-PC …' : 'Der Agent schreibt den Bericht. Das dauert einige Minuten.')
        : (d.antwort || 'Kein Dokument entstanden.')),
      zeilen.length ? el('pre', { class: 'kidokprot' }, zeilen.join('\n')) : ''));
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
  k.dokZu = false; k.anTony = false;
  renderChat();
  ladeChats();
  chatDokTakt(k);
}

// Aus chatSenden: true heisst "erledigt, nicht an Tony".
function chatDokSenden(ta) {
  const k = S.kichat;
  if (!k?.dok || k.dokZu || k.anTony || k.dok.agent === 'tony') return false;
  const text = ta.value.trim();
  if (!text || k.denkt) return true;
  if (k.dok.status === 'arbeitet') { uiHinweis('Der Agent arbeitet noch am Dokument.'); return true; }
  chatDiktatEnde();
  k.zeilen.push({ rolle: 'nutzer', text });
  const z = { rolle: 'assistent', text: '', laeuft: true, tut: 'arbeitet am Dokument' };
  k.zeilen.push(z);
  k.dokZeile = z;
  ta.value = ''; k.denkt = true; renderChat();
  chatAktion('dok_aendern', { dok_id: k.dok.id, anweisung: text }).catch((e) => ({ fehler: e.message })).then((j) => {
    if (j.fehler || j.error) {
      k.zeilen.splice(k.zeilen.indexOf(z), 1);
      k.zeilen.push({ rolle: 'fehler', text: j.fehler || j.error });
      k.denkt = false; k.dokZeile = null;
      if (S.kichat === k) renderChat();
      return;
    }
    k.dok.status = 'arbeitet'; k.dok.lauf_status = 'queued';
    if (S.kichat === k) renderChat();
    chatDokTakt(k);
  });
  return true;
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
  const k = S.kichat, d = antwort?.dokument;
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
  if (k.dok?.status === 'arbeitet') { k.denkt = !!k.dok.version; chatDokTakt(k); }
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
      k.denkt = false;
    }
    if (S.active?.typ === 'chat') renderChat();
  }, 4000);
}
