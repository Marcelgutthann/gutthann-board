// ---------- Chat: Routinen, Agenten, GHIW Docs, Projekte (Migration 204, 29.09.) ----------
// Marcel: „Agenten, Routinen und Artefakte in der Seitenleiste, schön clean." Seine Skizze (29.09.):
// unter „+ Neuer Chat" Routinen, Agenten, GHIW Docs; dann die Verläufe; darunter die Projekte.
// Die Mitte zeigt statt des Verlaufs die gewaehlte Ansicht.
//   Agenten    Katalog (eingebaute + eigene), Agent ansehen/losschicken, Agent bauen/bearbeiten
//   Routinen   Agent + Eingaben + Wochentage + Uhrzeit; pg_cron startet sie (agenten_takt)
//   GHIW Docs  alle Dokumente der Person (intern: Artefakte); Klick oeffnet den Chat mit dem Dokument
//   Projekte   GHIW Docs eines Projekts, Agent fuer das Projekt losschicken
// Eigene Datei, damit parallele Arbeit am Chat nicht in dieselben Zeilen faehrt. Haken in app.js:
// chatSeite -> chatNav()/kiChatsSichtbar()/chatProjekteNav(), renderChat -> chatAnsichtRender(),
// chatSenden -> chatWerkstattEnde(), chatZeile -> kwAgentKachel();
// in chat-dokument.js: chatAgentWahl -> kiAgentMenue(), Dokumentkopf -> kiFassungKnopf().

// Strich-Icons wie in der Board-Seitenleiste (ICO/ico in app.js); hier nur, was dort noch fehlt.
Object.assign(ICO, {
  uhr: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  vergleich: '<path d="M4 7h16M4 12h10M4 17h7"/><path d="m15 16 2 2 4-4"/>',
  pruefung: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 12 2 2 4-4"/>',
});
const KW_SYMBOL = { agent: 'bot', bericht: 'file', vergleich: 'vergleich', pruefung: 'pruefung', termin: 'calendar',
  tony: 'chat', projekt: 'folder', artefakt: 'file', routine: 'uhr', neu: 'plus' };
function kwIcon(name) { return ico(KW_SYMBOL[name] || name); }
const KW_TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const KW_FAEH = [['projektwissen', 'Projektunterlagen'], ['karten', 'Board-Karten'], ['lv', 'Büro-LVs und Preise'],
  ['internet', 'Internet'], ['crm', 'CRM (Poool)'], ['ausschreibungen', 'Ausschreibungen']];
const kwDatum = (t) => { try { return new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ''); } catch { return ''; } };
function kwTage(t) {
  const s = [...(t || [])].sort();
  if (s.join() === '1,2,3,4,5') return 'Mo–Fr';
  if (s.length === 7) return 'täglich';
  return s.map((d) => KW_TAGE[d - 1]).join(', ');
}
function kwAnsicht() { return S.kiansicht || null; }
function kiImChat() { return !S.kiansicht; }

// ---------- Seitenleiste ----------
function chatNav(seite) {
  const v = kwAnsicht();
  const a = v?.art;
  const laeuft = (S.kiagenten?.agenten || []).reduce((n, x) => n + (x.laeuft || 0), 0);
  const aktiveRoutinen = (S.kiroutinen || []).filter((r) => r.aktiv).length;
  const an = (art) => art === 'artefakte' ? a === 'artefakte' && !v.projekt
    : a === art || (art === 'agenten' && ['agent', 'bauen'].includes(a)) || (art === 'routinen' && a === 'routine');
  const nav = (art, icon, text, extra) => el('div', { class: 'row' + (an(art) ? ' active' : ''), onclick: () => chatAnsicht(art) },
    kwIcon(icon), el('span', { class: 'kititel' }, text), extra || '');
  seite.append(
    el('div', { class: 'row kineu' + (kiImChat() && !S.kichat?.id ? ' active' : ''), onclick: () => chatNeu() }, ico('plus'), 'Neuer Chat'),
    nav('routinen', 'routine', 'Routinen', aktiveRoutinen ? el('span', { class: 'zahl' }, String(aktiveRoutinen)) : ''),
    nav('agenten', 'agent', 'Agenten', laeuft ? el('span', { class: 'kwlauf' }, laeuft + ' läuft') : ''),
    nav('artefakte', 'artefakt', 'GHIW Docs'),
  );
  if (S.kiagenten == null) kiLadeAgenten();
  if (S.kiroutinen == null) kiLadeRoutinen();
}

// Verlaeufe: die letzten zwoelf, der Rest hinter „Alle Verläufe". Sonst schiebt eine lange Liste
// die Projekte aus dem Blick.
const KW_VERLAEUFE = 12;
function kiChatsSichtbar() { return (S.kichats || []).slice(0, S.kiAlleChats ? undefined : KW_VERLAEUFE); }
// Marcel 29.09. (Skizze): die Projektliste steht nicht mehr doppelt in der Chat-Spalte. Gewaehlt wird
// links in der Hauptleiste, dort ist das Projekt markiert; hier unten steht dann sein Verlauf.
function kiProjektGewaehlt() {
  const v = kwAnsicht();
  if (v?.art === 'projekt') return v.id;
  if (v?.art === 'karte') return v.projekt;
  return S.kichat?.projekt?.id || S.kiProjekt || null;
}
function kiProjektKlick(id) { S.kiProjekt = id; chatAnsicht('projekt', { id }); }
function chatProjekteNav(seite) {
  const n = (S.kichats || []).length;
  if (n > KW_VERLAEUFE) seite.append(el('div', { class: 'row addrow', onclick: () => { S.kiAlleChats = !S.kiAlleChats; chatSeite(); } },
    el('span', { class: 'kititel' }, S.kiAlleChats ? 'Weniger zeigen' : 'Alle Verläufe (' + n + ')')));
  const pid = kiProjektGewaehlt();
  if (pid) S.kiProjekt = pid;
  // Hauptleiste nur neu zeichnen, wenn sich das gewaehlte Projekt aendert (renderChat laeuft oft).
  if (S.kiSbProjekt !== pid) { S.kiSbProjekt = pid; renderSidebar(); }
  const p = (S.projects || []).find((x) => x.id === pid);
  if (!p) { seite.append(el('div', { class: 'kilbl' }, 'Projekt'), el('div', { class: 'kihinweis' }, 'Links ein Projekt wählen — hier steht dann sein Verlauf.')); return; }
  const k = S.kichat;
  seite.append(el('div', { class: 'kilbl', title: p.name }, 'Verlauf · ' + p.name));
  seite.append(el('div', { class: 'row addrow', onclick: () => kiProjektChatNeu(p) }, ico('plus'), el('span', { class: 'kititel' }, 'Neuer Chat im Projekt')));
  const chats = (S.kichats || []).filter((c) => c.project_id === p.id);
  if (!chats.length && S.kichats != null) seite.append(el('div', { class: 'kihinweis' }, 'Noch kein Chat zu diesem Projekt.'));
  for (const c of chats) seite.append(el('div', {
    class: 'row' + (c.id === k?.id && kiImChat() ? ' active' : ''), title: c.titel,
    onclick: () => chatOeffnen(c.id),
    oncontextmenu: (e) => { e.preventDefault(); chatMenu(e, c); },
  }, ico('chat'), el('span', { class: 'kititel' }, c.titel)));
}

function chatAnsicht(art, extra = {}) {
  if (S.kichat?.denkt && art !== 'chat') { /* Antwort laeuft weiter und landet im Verlauf */ }
  chatDiktatEnde();
  S.kiansicht = art === 'chat' ? null : { art, ...extra };
  if (art === 'artefakte' || art === 'projekt') kiLadeArtefakte();
  if (art === 'projekt') { const p = (S.projects || []).find((x) => x.id === extra.id); if (p && S.kiprojBoard?.[p.id]) kiLadeProjektBoard(p); }
  if (art === 'karte' && S.kikarte?.id !== extra.id) S.kikarte = null;
  if (art === 'agenten' || art === 'agent') kiLadeAgenten();
  if (art === 'routinen') kiLadeRoutinen();
  renderChat();
}

// Aus renderChat: true = eine Ansicht statt des Chats ist offen (renderChat macht dann nichts weiter).
function chatAnsichtRender(root) {
  const haupt = root.querySelector('.kihaupt');
  let box = haupt.querySelector('.kwansicht');
  const v = kwAnsicht();
  haupt.querySelector('.kiverlauf').hidden = !!v;
  haupt.querySelector('.kieingabe').hidden = !!v;
  if (!v) { box?.remove(); kiChatProjektKopf(root); return false; }
  haupt.querySelector('.kwchatprojekt')?.remove();
  root.classList.remove('mitdok');
  root.querySelector('.kidok')?.remove(); root.querySelector('.kiteiler')?.remove();
  haupt.style.flexBasis = '';
  if (!box) { box = el('div', { class: 'kwansicht' }); haupt.prepend(box); }
  const scroll = box.scrollTop;
  box.innerHTML = '';
  const bau = { agenten: kwAgenten, agent: kwAgent, bauen: kwBauen, routinen: kwRoutinen, routine: kwRoutineForm,
    artefakte: kwArtefakte, projekt: kwProjekt, karte: kwKarte }[v.art];
  if (bau) bau(box, v);
  const schluessel = v.art + ':' + (v.id || v.projekt || '');
  if (schluessel === box.dataset.art) box.scrollTop = scroll;
  box.dataset.art = schluessel;
  return true;
}

// ---------- Daten ----------
async function kiLadeAgenten() {
  if (S.kiagentenLaedt) return; S.kiagentenLaedt = true;
  try { const j = await chatAktion('agenten_liste'); S.kiagenten = { agenten: j.agenten || [], zur_freigabe: j.zur_freigabe || [], leitung: !!j.leitung }; }
  catch (e) { S.kiagenten = S.kiagenten || { agenten: [], zur_freigabe: [], leitung: false, fehler: e.message }; }
  S.kiagentenLaedt = false;
  if (S.active?.typ === 'chat') renderChat();
}
async function kiLadeRoutinen() {
  if (S.kiroutinenLaedt) return; S.kiroutinenLaedt = true;
  try { S.kiroutinen = (await chatAktion('routinen_liste')).routinen || []; } catch { S.kiroutinen = S.kiroutinen || []; }
  S.kiroutinenLaedt = false;
  if (S.active?.typ === 'chat') renderChat();
}
async function kiLadeArtefakte() {
  if (S.kiartefakteLaedt) return; S.kiartefakteLaedt = true;
  try { S.kiartefakte = (await chatAktion('artefakte_liste')).artefakte || []; } catch { S.kiartefakte = S.kiartefakte || []; }
  S.kiartefakteLaedt = false;
  if (S.active?.typ === 'chat' && S.kiansicht) renderChat();
}
function kwAgentVon(id) { return [...(S.kiagenten?.agenten || []), ...(S.kiagenten?.zur_freigabe || [])].find((a) => a.id === id); }

// ---------- Bausteine ----------
function kwKopf(titel, unter, ...rechts) {
  return el('div', { class: 'kwkopf' }, el('div', { class: 'kwkopftext' }, el('h2', {}, titel), unter ? el('p', {}, unter) : ''),
    rechts.length ? el('div', { class: 'kwkopfrechts' }, ...rechts) : '');
}
const kwKnopf = (text, onclick, art = '') => el('button', { class: 'kwknopf' + (art ? ' ' + art : ''), type: 'button', onclick }, text);
function kwFilter(werte, aktiv, setze) {
  return el('div', { class: 'kwfilter' }, ...werte.map(([w, text]) =>
    el('button', { class: 'kwf' + (w === aktiv ? ' an' : ''), type: 'button', onclick: () => setze(w) }, text)));
}
const kwChip = (text, art = '') => el('span', { class: 'kwchip' + (art ? ' ' + art : '') }, text);
function kwLeer(text) { return el('div', { class: 'kwleer' }, text); }
function kwLaedt(box) { box.append(kwLeer('lädt …')); }

function kwZustandChips(a) {
  const c = [];
  if (a.bauart === 'eingebaut') c.push(kwChip('Büro'));
  else if (a.zustand === 'entwurf') c.push(kwChip('Entwurf', 'amber'));
  else if (a.sichtbar === 'buero' && a.freigegeben) c.push(kwChip(a.mein ? 'Fürs Büro freigegeben' : 'Von ' + (a.besitzer_name || a.besitzer)));
  else if (a.sichtbar === 'buero') c.push(kwChip('Wartet auf Freigabe', 'amber'));
  else c.push(kwChip('Nur ich'));
  return c;
}

// ---------- Agenten ----------
function kwAgenten(box, v) {
  const d = S.kiagenten;
  const filter = v.filter || 'alle';
  box.append(kwKopf('Agenten', 'Agenten arbeiten gründlicher als der Chat: sie lesen die Projektunterlagen und liefern ein Dokument. Sie laufen mit Claude auf dem Büro-PC.',
    kwKnopf('+ Agent bauen', () => chatAnsicht('bauen'), 'voll')));
  if (!d) return kwLaedt(box);
  const f = [['alle', 'Alle'], ['buero', 'Büro'], ['meine', 'Meine']];
  if (d.leitung && d.zur_freigabe.length) f.push(['freigabe', 'Zur Freigabe · ' + d.zur_freigabe.length]);
  box.append(kwFilter(f, filter, (w) => chatAnsicht('agenten', { filter: w })));
  const liste = filter === 'freigabe' ? d.zur_freigabe
    : d.agenten.filter((a) => filter === 'alle' || (filter === 'meine' ? a.mein : !a.mein));
  if (!liste.length) {
    box.append(kwLeer(filter === 'meine' ? 'Du hast noch keinen eigenen Agenten. Bau einen über „+ Agent bauen“, oder schreib im Chat: „Bau mir einen Agenten, der …“.' : 'Keine Agenten.'));
    return;
  }
  const raster = el('div', { class: 'kwraster' });
  for (const a of liste) {
    const fuss = a.laeuft ? el('span', { class: 'kwlauf' }, 'läuft')
      : a.letzter_lauf ? el('span', { class: 'kwleise' }, (a.letzter_lauf.status === 'failed' ? 'zuletzt gescheitert · ' : 'zuletzt ') + kwDatum(a.letzter_lauf.zeit)) : el('span');
    raster.append(el('button', { class: 'kwkarte', type: 'button', onclick: () => chatAnsicht('agent', { id: a.id }) },
      el('div', { class: 'kwkartekopf' }, el('span', { class: 'kwsym' }, kwIcon(a.symbol)), el('h3', {}, a.name)),
      el('p', {}, a.beschreibung || (a.anweisung ? a.anweisung.slice(0, 160) : '')),
      el('div', { class: 'kwkartefuss' }, el('span', { class: 'kwchips' }, ...kwZustandChips(a)), fuss)));
  }
  box.append(raster);
}

function kwAgent(box, v) {
  const a = kwAgentVon(v.id);
  if (!a) { box.append(kwKopf('Agent'), S.kiagenten ? kwLeer('Diesen Agenten gibt es nicht mehr.') : kwLeer('lädt …')); return; }
  const leitung = !!S.kiagenten?.leitung;
  const darfAendern = a.bauart === 'eigen' && (a.mein || leitung);
  const zurueck = el('button', { class: 'kwzurueck', type: 'button', onclick: () => chatAnsicht('agenten') }, '← Agenten');
  box.append(zurueck, kwKopf(a.name, a.beschreibung, ...kwZustandChips(a)));

  // Losschicken
  const start = el('section', { class: 'kwblatt' }, el('h4', {}, 'Losschicken'));
  const werte = {};
  const felder = el('div', { class: 'kwform' });
  for (const e of a.eingaben || []) {
    const id = 'kwe-' + a.id.slice(0, 8) + '-' + e.feld;
    const label = el('label', { for: id }, (e.label || e.feld) + (e.pflicht ? '' : ' (optional)'));
    let feld;
    if (e.art === 'projekt') {
      feld = el('select', { id, class: 'kwfeld' }, el('option', { value: '' }, e.pflicht ? 'Projekt wählen …' : 'ohne Projekt'),
        ...[...(S.projects || [])].sort((x, y) => String(x.name).localeCompare(String(y.name), 'de')).map((p) => el('option', { value: p.id }, p.name)));
      feld.addEventListener('change', () => { werte.projekt = feld.value; });
    } else {
      feld = el('textarea', { id, class: 'kwfeld', rows: '2' });
      feld.addEventListener('input', () => { werte[e.feld] = feld.value; });
    }
    felder.append(el('div', { class: 'kwfeldzeile' }, label, feld));
  }
  if (!(a.eingaben || []).length) felder.append(el('p', { class: 'kwleise' }, 'Dieser Agent braucht keine Eingaben.'));
  start.append(felder, el('div', { class: 'kwaktionen' },
    kwKnopf(a.zustand === 'entwurf' ? 'Probelauf starten' : 'Losschicken', async (ev) => {
      const knopf = ev.currentTarget;
      knopf.disabled = true;
      const { projekt, ...rest } = werte;
      await kiAgentLosschicken(a, projekt || null, rest, false);
      knopf.disabled = false;
    }, 'voll'),
    el('span', { class: 'kwleise' }, a.ergebnis === 'artefakt' ? 'Öffnet einen neuen Chat, das Ergebnis erscheint rechts.' : 'Öffnet einen neuen Chat, die Antwort erscheint dort.')));
  box.append(start);

  if (a.bauart === 'eigen') {
    const info = el('section', { class: 'kwblatt' }, el('h4', {}, 'So arbeitet er'),
      el('div', { class: 'kwanweisung' }, a.anweisung || ''),
      el('dl', { class: 'kwdl' },
        el('dt', {}, 'Darf'), el('dd', {}, el('span', { class: 'kwchips' }, ...(a.faehigkeiten.length ? a.faehigkeiten.map((f) => kwChip((KW_FAEH.find((x) => x[0] === f) || [f, f])[1])) : [kwChip('nur Allgemeinwissen')]))),
        el('dt', {}, 'Stufe'), el('dd', {}, a.stufe === 'entwurf' ? 'Liest und legt Karten an (höchstens fünf je Lauf)' : 'Liest nur'),
        el('dt', {}, 'Ergebnis'), el('dd', {}, a.ergebnis === 'artefakt' ? 'Dokument rechts neben dem Chat' : 'Antwort im Chat'),
        el('dt', {}, 'Gebaut von'), el('dd', {}, a.besitzer_name || a.besitzer || '—')));
    box.append(info);

    const akt = el('div', { class: 'kwaktionen' });
    if (darfAendern) akt.append(kwKnopf('Bearbeiten', () => chatAnsicht('bauen', { id: a.id })));
    if (a.mein && a.zustand === 'entwurf') {
      akt.append(kwKnopf('Aktivieren', async () => {
        const j = await chatAktion('agent_speichern', { agent: { id: a.id, aktivieren: true } }).catch((e) => ({ fehler: e.message }));
        if (j.fehler) return uiHinweis(j.fehler);
        uiHinweis('Aktiv. Er steht jetzt unter Meine.', 'ok'); await kiLadeAgenten();
      }, a.probelauf_ok ? 'voll' : ''));
      if (!a.probelauf_ok) akt.append(el('span', { class: 'kwleise' }, 'Aktivieren geht nach einem fertigen Probelauf.'));
    }
    if (a.mein && a.zustand === 'aktiv' && a.sichtbar === 'ich') akt.append(kwKnopf('Fürs Büro freigeben lassen', async () => {
      const j = await chatAktion('agent_speichern', { agent: { id: a.id, sichtbar: 'buero' } }).catch((e) => ({ fehler: e.message }));
      if (j.fehler) return uiHinweis(j.fehler);
      uiHinweis('Die Leitung sieht ihn jetzt unter „Zur Freigabe“.', 'ok'); await kiLadeAgenten();
    }));
    if (leitung && a.zustand === 'aktiv' && a.sichtbar === 'buero' && !a.freigegeben) akt.append(kwKnopf('Fürs Büro freigeben', async () => {
      const j = await chatAktion('agent_freigeben', { agent_id: a.id }).catch((e) => ({ fehler: e.message }));
      if (j.fehler) return uiHinweis(j.fehler);
      uiHinweis('Freigegeben. Das ganze Büro sieht ihn.', 'ok'); await kiLadeAgenten();
    }, 'voll'));
    if (leitung && a.sichtbar === 'buero' && !a.mein) akt.append(kwKnopf(a.freigegeben ? 'Freigabe zurücknehmen' : 'Zurückgeben', async () => {
      const j = await chatAktion('agent_freigeben', { agent_id: a.id, freigeben: false }).catch((e) => ({ fehler: e.message }));
      if (j.fehler) return uiHinweis(j.fehler);
      await kiLadeAgenten();
    }));
    if (darfAendern) akt.append(kwKnopf('Archivieren', async () => {
      if (!await uiFrage('„' + a.name + '“ archivieren? Seine Routinen werden pausiert, seine Dokumente bleiben.', { ok: 'Archivieren', gefahr: true })) return;
      const j = await chatAktion('agent_archivieren', { agent_id: a.id, wirklich: true }).catch((e) => ({ fehler: e.message }));
      if (j.fehler) return uiHinweis(j.fehler);
      await kiLadeAgenten(); chatAnsicht('agenten');
    }, 'leise'));
    if (akt.childNodes.length) box.append(akt);
  }
  if (a.letzter_lauf) box.append(el('p', { class: 'kwleise kwunten' },
    'Letzter Lauf ' + kwDatum(a.letzter_lauf.zeit) + ': ' + ({ done: 'fertig', failed: 'gescheitert', running: 'läuft', queued: 'wartet' }[a.letzter_lauf.status] || a.letzter_lauf.status)
    + (a.letzter_lauf.ergebnis ? ' — ' + a.letzter_lauf.ergebnis : '')));
}

// Agent bauen oder bearbeiten. Gespeichert wird immer als Entwurf; aktiv nach Probelauf.
function kwBauen(box, v) {
  const alt = v.id ? kwAgentVon(v.id) : null;
  const f = v.entwurf || (v.entwurf = alt ? {
    name: alt.name, beschreibung: alt.beschreibung, anweisung: alt.anweisung || '', faehigkeiten: [...alt.faehigkeiten],
    stufe: alt.stufe, ergebnis: alt.ergebnis, sichtbar: alt.sichtbar,
    projekt: (alt.eingaben || []).find((e) => e.art === 'projekt') || null,
    texte: (alt.eingaben || []).filter((e) => e.art !== 'projekt').map((e) => ({ ...e })),
  } : { name: '', beschreibung: '', anweisung: '', faehigkeiten: ['projektwissen'], stufe: 'lesen', ergebnis: 'artefakt', sichtbar: 'ich',
        projekt: { feld: 'projekt', art: 'projekt', label: 'Projekt', pflicht: true }, texte: [] });
  box.append(el('button', { class: 'kwzurueck', type: 'button', onclick: () => chatAnsicht(alt ? 'agent' : 'agenten', alt ? { id: alt.id } : {}) }, '← ' + (alt ? alt.name : 'Agenten')),
    kwKopf(alt ? 'Agent bearbeiten' : 'Agent bauen', alt ? 'Nach einer Änderung braucht er einen neuen Probelauf, und eine Büro-Freigabe fällt weg.'
      : 'Beschreib, was er tun soll. Du kannst ihn auch im Chat beschreiben: „Bau mir einen Agenten, der …“.'));

  const text = (id, label, wert, setze, opt = {}) => {
    const feld = el(opt.gross ? 'textarea' : 'input', { id, class: 'kwfeld' + (opt.gross ? ' gross' : ''), placeholder: opt.platz || '', ...(opt.gross ? { rows: '7' } : {}) });
    feld.value = wert || '';
    feld.addEventListener('input', () => setze(feld.value));
    return el('div', { class: 'kwfeldzeile' }, el('label', { for: id }, label), feld, opt.hilfe ? el('p', { class: 'kwhilfe' }, opt.hilfe) : '');
  };
  const wahl = (name, werte, aktiv, setze) => el('div', { class: 'kwwahl', role: 'radiogroup' }, ...werte.map(([w, t, h]) =>
    el('button', { class: 'kwwahlk' + (w === aktiv ? ' an' : ''), type: 'button', role: 'radio', 'aria-checked': String(w === aktiv),
      onclick: () => { setze(w); renderChat(); } }, el('b', {}, t), h ? el('span', {}, h) : '')));

  const blatt1 = el('section', { class: 'kwblatt' }, el('h4', {}, 'Was er tut'),
    text('kwb-name', 'Name', f.name, (x) => { f.name = x; }, { platz: 'z. B. Nachtragsprüfung' }),
    text('kwb-beschr', 'Kurzbeschreibung', f.beschreibung, (x) => { f.beschreibung = x; }, { platz: 'Ein Satz, der auf seiner Karte steht' }),
    text('kwb-anw', 'Anweisung', f.anweisung, (x) => { f.anweisung = x; }, { gross: true,
      platz: 'Prüfe den Nachtrag Punkt für Punkt gegen das beauftragte LV und den Vertrag. Belege jede Aussage mit Datei und Position. Schreib eine Stellungnahme im Büro-Stil.',
      hilfe: 'Ziel, Vorgehen, Quellen und die Form des Ergebnisses. Je konkreter, desto besser.' }));

  const eingaben = el('section', { class: 'kwblatt' }, el('h4', {}, 'Fragt beim Start'));
  const projektAn = !!f.projekt;
  eingaben.append(el('label', { class: 'kwhaken' },
    el('input', { type: 'checkbox', ...(projektAn ? { checked: '' } : {}), onchange: (e) => { f.projekt = e.target.checked ? { feld: 'projekt', art: 'projekt', label: 'Projekt', pflicht: true } : null; renderChat(); } }),
    'nach einem Projekt'));
  if (projektAn) eingaben.append(el('label', { class: 'kwhaken eingerueckt' },
    el('input', { type: 'checkbox', ...(f.projekt.pflicht ? { checked: '' } : {}), onchange: (e) => { f.projekt.pflicht = e.target.checked; } }), 'Projekt ist Pflicht'));
  f.texte.forEach((t, i) => {
    const inp = el('input', { class: 'kwfeld', value: t.label || '', placeholder: 'z. B. Gewerk oder Frage' });
    inp.addEventListener('input', () => { t.label = inp.value; });
    eingaben.append(el('div', { class: 'kwtextfeld' }, inp,
      el('label', { class: 'kwhaken' }, el('input', { type: 'checkbox', ...(t.pflicht ? { checked: '' } : {}), onchange: (e) => { t.pflicht = e.target.checked; } }), 'Pflicht'),
      el('button', { class: 'kwknopf leise', type: 'button', onclick: () => { f.texte.splice(i, 1); renderChat(); } }, 'Entfernen')));
  });
  eingaben.append(el('div', {}, kwKnopf('+ Textfeld', () => { f.texte.push({ label: '', art: 'text', pflicht: false }); renderChat(); }, 'leise')));

  const darf = el('section', { class: 'kwblatt' }, el('h4', {}, 'Darf'),
    el('div', { class: 'kwhakenraster' }, ...KW_FAEH.map(([w, t]) => el('label', { class: 'kwhaken' },
      el('input', { type: 'checkbox', ...(f.faehigkeiten.includes(w) ? { checked: '' } : {}),
        onchange: (e) => { f.faehigkeiten = e.target.checked ? [...new Set([...f.faehigkeiten, w])] : f.faehigkeiten.filter((x) => x !== w); } }), t))),
    el('h5', {}, 'Stufe'),
    wahl('stufe', [['lesen', 'Nur lesen', 'sieht nach und schreibt ein Ergebnis'], ['entwurf', 'Karten anlegen', 'darf zusätzlich bis zu fünf Aufgabenkarten anlegen']], f.stufe, (w) => { f.stufe = w; }),
    el('p', { class: 'kwhilfe' }, 'Senden, verschieben oder löschen kann ein eigener Agent nie.'),
    el('h5', {}, 'Ergebnis'),
    wahl('ergebnis', [['artefakt', 'Dokument', 'rechts neben dem Chat, im Büro-Layout, als PDF druckbar'], ['antwort', 'Antwort', 'als Nachricht im Chat']], f.ergebnis, (w) => { f.ergebnis = w; }),
    el('h5', {}, 'Wer sieht ihn'),
    wahl('sichtbar', [['ich', 'Nur ich'], ['buero', 'Das Büro', 'nach Freigabe durch die Leitung']], f.sichtbar, (w) => { f.sichtbar = w; }));

  box.append(blatt1, eingaben, darf, el('div', { class: 'kwaktionen' },
    kwKnopf(alt ? 'Speichern' : 'Als Entwurf speichern', async (ev) => {
      const knopf = ev.currentTarget;
      const slug = (s) => String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/[^a-z]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'feld';
      const texte = f.texte.filter((t) => String(t.label || '').trim());
      const genommen = new Set(['projekt']);
      const eing = [...(f.projekt ? [f.projekt] : []), ...texte.map((t) => {
        let s = slug(t.label); while (genommen.has(s) || s.length < 2) s = (s + '_x').slice(0, 30); genommen.add(s);
        return { feld: s, art: 'text', label: String(t.label).trim(), pflicht: !!t.pflicht };
      })];
      knopf.disabled = true;
      const j = await chatAktion('agent_speichern', { agent: { ...(alt ? { id: alt.id } : {}), name: f.name, beschreibung: f.beschreibung, anweisung: f.anweisung,
        faehigkeiten: f.faehigkeiten, stufe: f.stufe, ergebnis: f.ergebnis, sichtbar: f.sichtbar, eingaben: eing } }).catch((e) => ({ fehler: e.message }));
      knopf.disabled = false;
      if (j.fehler) return uiHinweis(j.fehler);
      await kiLadeAgenten();
      chatAnsicht('agent', { id: j.agent.id });
      uiHinweis(alt ? 'Gespeichert. Starte einen Probelauf, dann lässt er sich wieder aktivieren.' : 'Entwurf gespeichert. Starte jetzt einen Probelauf.', 'ok');
    }, 'voll'),
    kwKnopf('Abbrechen', () => chatAnsicht(alt ? 'agent' : 'agenten', alt ? { id: alt.id } : {}), 'leise')));
}

// ---------- Losschicken ----------
// imChat: im offenen Chat (Knopf ueber der Eingabe) oder in einem neuen Chat (Agentenseite).
async function kiAgentLosschicken(a, projekt, eingaben, imChat) {
  const k = S.kichat;
  const j = await chatAktion('agent_starten', { agent: a.id, projekt: projekt || null, eingaben: eingaben || {}, chat_id: imChat ? k.id : null })
    .catch((e) => ({ fehler: e.message }));
  if (j.fehler || j.error) { uiHinweis(j.fehler || j.error); return false; }
  kiLadeAgenten();
  if (imChat) {
    if (!k.id) k.id = j.chat_id;
    k.zeilen.push({ rolle: 'assistent', text: '„' + a.name + '“ ist losgeschickt. ' + (a.ergebnis === 'artefakt' ? 'Das Ergebnis erscheint rechts, sobald er fertig ist.' : 'Ich melde mich hier, sobald er fertig ist.') });
    k.dok = { id: j.dok_id, titel: j.titel, status: 'arbeitet', version: 0, lauf_status: 'queued', agent: 'agent' };
    k.dokZu = a.ergebnis === 'antwort'; k.dokWahl = null; // Antwort-Agenten brauchen kein Feld rechts
    renderChat(); ladeChats(); chatDokTakt(k);
  } else {
    await ladeChats();
    S.kiansicht = null;
    S.kichat = null;
    await chatOeffnen(j.chat_id);
    if (a.ergebnis === 'antwort' && S.kichat) { S.kichat.dokZu = true; renderChat(); }
  }
  return true;
}

// Knopf „+ Agent losschicken" ueber der Eingabe: Katalog als Menue; braucht der Agent nur ein
// Projekt, folgt die Projektwahl, sonst oeffnet die Agentenseite mit dem Startformular.
async function kiAgentMenue(r) {
  if (!S.kiagenten) await kiLadeAgenten();
  const alle = (S.kiagenten?.agenten || []).filter((a) => a.zustand === 'aktiv' || a.mein);
  const eintrag = (a) => ({ txt: a.name + (a.zustand === 'entwurf' ? ' (Entwurf)' : ''), do: () => {
    const e = a.eingaben || [];
    const nurProjekt = e.every((x) => x.art === 'projekt' || !x.pflicht) && e.some((x) => x.art === 'projekt');
    if (!e.length) return kiAgentLosschicken(a, null, {}, true);
    if (!nurProjekt) return chatAnsicht('agent', { id: a.id });
    setTimeout(() => ctxMenu(r.left, r.top - 8, [{ note: a.name + ' für welches Projekt?' },
      ...[...(S.projects || [])].sort((x, y) => String(x.name).localeCompare(String(y.name), 'de'))
        .map((p) => ({ txt: p.name, do: () => kiAgentLosschicken(a, p.id, {}, true) }))]));
  } });
  const buero = alle.filter((a) => !a.mein), meine = alle.filter((a) => a.mein);
  ctxMenu(r.left, r.top - 8, [
    ...(buero.length ? [{ note: 'Büro' }, ...buero.map(eintrag)] : []),
    ...(meine.length ? [{ note: 'Meine' }, ...meine.map(eintrag)] : []),
    { note: '' }, { txt: 'Alle Agenten ansehen …', do: () => chatAnsicht('agenten') },
  ]);
}

// Schluss einer Tony-Antwort: Entwurf gespeichert oder Agent losgeschickt (live-backend, Migration 204).
function chatWerkstattEnde(antwort) {
  const k = S.kichat;
  if (antwort?.agent_entwurf) {
    kiLadeAgenten();
    if (antwort.agent_entwurf.fehler) k.zeilen.push({ rolle: 'fehler', text: 'Agent nicht gespeichert: ' + antwort.agent_entwurf.fehler });
    else if (antwort.agent_entwurf.agent) k.zeilen.push({ rolle: 'assistent', text: '', agentLink: antwort.agent_entwurf.agent });
  }
  const st = antwort?.agent_start;
  if (st) {
    if (st.fehler) k.zeilen.push({ rolle: 'fehler', text: 'Agent nicht losgeschickt: ' + st.fehler });
    else if (st.dok_id) {
      k.zeilen.push({ rolle: 'assistent', text: '„' + (st.agent || 'Agent') + '“ ist losgeschickt. Das Ergebnis erscheint rechts.' });
      k.dok = { id: st.dok_id, titel: st.titel, status: 'arbeitet', version: 0, lauf_status: 'queued', agent: 'agent' };
      k.dokZu = (S.kiagenten?.agenten || []).find((a) => a.name === st.agent)?.ergebnis === 'antwort'; k.dokWahl = null;
      kiLadeAgenten();
      setTimeout(() => chatDokTakt(k), 0);
    }
  }
  // LPH-Bericht oder Doku-Check, von Tony losgeschickt (Migration 213): rechts arbeiten lassen, Ergebnis kommt hierher.
  const ds = antwort?.dok_start;
  if (ds) {
    if (ds.fehler || ds.error) k.zeilen.push({ rolle: 'fehler', text: 'Nicht losgeschickt: ' + (ds.fehler || ds.error) });
    else if (ds.dok_id) {
      k.zeilen.push({ rolle: 'assistent', text: ds.lief_schon ? ds.titel + ' lief schon — ich zeige rechts denselben Lauf.'
        : ds.titel + ' ist losgeschickt. Rechts steht, was der Agent gerade tut; das Ergebnis kommt hierher.' });
      k.dok = { id: ds.dok_id, titel: ds.titel, status: 'arbeitet', version: 0, lauf_status: 'queued', agent: 'agent' };
      k.dokZu = false; k.dokWahl = null;
      setTimeout(() => chatDokTakt(k), 0);
    }
  }
}
// Kachel unter Tonys Antwort, wenn er einen Agenten entworfen hat (chatZeile in app.js).
function kwAgentKachel(a) {
  return el('button', { class: 'kwkarte klein', type: 'button', onclick: () => chatAnsicht('agent', { id: a.id }) },
    el('div', { class: 'kwkartekopf' }, el('span', { class: 'kwsym' }, kwIcon(a.symbol)), el('h3', {}, a.name)),
    el('p', {}, a.beschreibung || 'Neuer Agent'), el('div', { class: 'kwkartefuss' }, el('span', { class: 'kwchips' }, kwChip('Entwurf', 'amber')), el('span', { class: 'kwleise' }, 'Öffnen und Probelauf starten →')));
}

// ---------- Routinen ----------
function kwRoutinen(box) {
  box.append(kwKopf('Routinen', 'Ein Agent, der zu festen Zeiten von selbst läuft. Das Ergebnis landet in einem eigenen Chat; scheitert ein Lauf, steht es dort.',
    kwKnopf('+ Routine', () => chatAnsicht('routine'), 'voll')));
  const l = S.kiroutinen;
  if (l == null) return kwLaedt(box);
  if (!l.length) { box.append(kwLeer('Noch keine Routinen. Zum Beispiel: jeden Montag um 7 Uhr „Angebote prüfen“ für ein Projekt in der Vergabe.')); return; }
  const liste = el('div', { class: 'kwliste' });
  for (const r of l) {
    const stand = !r.aktiv ? kwChip('pausiert') : r.letzter_status === 'fehler' ? kwChip('zuletzt gescheitert', 'rot')
      : r.letzter_status === 'laeuft' ? kwChip('läuft', 'oliv') : kwChip('aktiv', 'oliv');
    liste.append(el('div', { class: 'kwzeile' },
      el('button', { class: 'kwzeiletext', type: 'button', title: r.chat_id ? 'Chat der Routine öffnen' : '', onclick: () => r.chat_id ? chatOeffnenAus(r.chat_id) : chatAnsicht('routine', { id: r.id }) },
        el('b', {}, r.titel), el('span', {}, [r.agent, r.projekt].filter(Boolean).join(' · ')
          + (r.naechster_lauf && r.aktiv ? ' · nächster Lauf ' + kwDatum(r.naechster_lauf) : '')
          + (r.letzte_meldung && r.letzter_status === 'fehler' ? ' · ' + r.letzte_meldung : ''))),
      kwChip(kwTage(r.tage) + ' ' + r.uhrzeit), stand,
      el('button', { class: 'kwmehr', type: 'button', 'aria-label': 'Aktionen', onclick: (e) => {
        e.stopPropagation(); const b = e.currentTarget.getBoundingClientRect();
        ctxMenu(b.left - 150, b.bottom + 4, [
          { txt: 'Jetzt ausführen', do: async () => { const j = await chatAktion('routine_jetzt', { routine_id: r.id }).catch((x) => ({ fehler: x.message }));
            if (j.fehler) return uiHinweis(j.fehler); uiHinweis('Läuft. Das Ergebnis kommt in den Chat der Routine.', 'ok'); kiLadeRoutinen(); } },
          { txt: 'Bearbeiten', do: () => chatAnsicht('routine', { id: r.id }) },
          { txt: r.aktiv ? 'Pausieren' : 'Wieder aktivieren', do: async () => { await chatAktion('routine_speichern', { routine: { id: r.id, aktiv: !r.aktiv } }); kiLadeRoutinen(); } },
          { txt: 'Löschen', danger: true, do: async () => {
            if (!await uiFrage('Routine „' + r.titel + '“ löschen? Ihr Chat und ihre Dokumente bleiben.', { ok: 'Löschen', gefahr: true })) return;
            await chatAktion('routine_loeschen', { routine_id: r.id, wirklich: true }); kiLadeRoutinen(); } },
        ]);
      } }, '⋯')));
  }
  box.append(liste);
}
async function chatOeffnenAus(chatId) { S.kiansicht = null; if (S.kichat?.id === chatId) return renderChat(); await chatOeffnen(chatId); }

function kwRoutineForm(box, v) {
  const alt = v.id ? (S.kiroutinen || []).find((r) => r.id === v.id) : null;
  if (!S.kiagenten) { kiLadeAgenten(); return kwLaedt(box); }
  const agenten = S.kiagenten.agenten.filter((a) => a.zustand === 'aktiv');
  const f = v.form || (v.form = alt ? { agent_id: alt.agent_id, projekt: alt.projekt_id || '', eingaben: { ...alt.eingaben }, tage: [...alt.tage], uhrzeit: alt.uhrzeit, titel: alt.titel }
    : { agent_id: agenten[0]?.id || '', projekt: '', eingaben: {}, tage: [1, 2, 3, 4, 5], uhrzeit: '07:00', titel: '' });
  const a = agenten.find((x) => x.id === f.agent_id);
  box.append(el('button', { class: 'kwzurueck', type: 'button', onclick: () => chatAnsicht('routinen') }, '← Routinen'),
    kwKopf(alt ? 'Routine bearbeiten' : 'Neue Routine'));
  const blatt = el('section', { class: 'kwblatt' });
  const sel = el('select', { id: 'kwr-agent', class: 'kwfeld' }, ...agenten.map((x) => el('option', { value: x.id, ...(x.id === f.agent_id ? { selected: '' } : {}) }, x.name)));
  sel.addEventListener('change', () => { f.agent_id = sel.value; f.eingaben = {}; renderChat(); });
  blatt.append(el('div', { class: 'kwfeldzeile' }, el('label', { for: 'kwr-agent' }, 'Agent'), sel));
  for (const e of a?.eingaben || []) {
    const id = 'kwr-' + e.feld;
    if (e.art === 'projekt') {
      const p = el('select', { id, class: 'kwfeld' }, el('option', { value: '' }, e.pflicht ? 'Projekt wählen …' : 'ohne Projekt'),
        ...[...(S.projects || [])].sort((x, y) => String(x.name).localeCompare(String(y.name), 'de')).map((x) => el('option', { value: x.id, ...(x.id === f.projekt ? { selected: '' } : {}) }, x.name)));
      p.addEventListener('change', () => { f.projekt = p.value; });
      blatt.append(el('div', { class: 'kwfeldzeile' }, el('label', { for: id }, e.label || 'Projekt'), p));
    } else {
      const t = el('textarea', { id, class: 'kwfeld', rows: '2' }); t.value = f.eingaben[e.feld] || '';
      t.addEventListener('input', () => { f.eingaben[e.feld] = t.value; });
      blatt.append(el('div', { class: 'kwfeldzeile' }, el('label', { for: id }, (e.label || e.feld) + (e.pflicht ? '' : ' (optional)')), t));
    }
  }
  const tage = el('div', { class: 'kwtage' }, ...KW_TAGE.map((t, i) => el('button', { class: 'kwf' + (f.tage.includes(i + 1) ? ' an' : ''), type: 'button',
    'aria-pressed': String(f.tage.includes(i + 1)), onclick: () => { f.tage = f.tage.includes(i + 1) ? f.tage.filter((x) => x !== i + 1) : [...f.tage, i + 1]; renderChat(); } }, t)));
  const zeit = el('input', { id: 'kwr-zeit', class: 'kwfeld schmal', type: 'time', value: f.uhrzeit });
  zeit.addEventListener('input', () => { f.uhrzeit = zeit.value; });
  const titel = el('input', { id: 'kwr-titel', class: 'kwfeld', value: f.titel, placeholder: a ? a.name : '' });
  titel.addEventListener('input', () => { f.titel = titel.value; });
  blatt.append(el('div', { class: 'kwfeldzeile' }, el('label', {}, 'Wochentage'), tage),
    el('div', { class: 'kwfeldzeile' }, el('label', { for: 'kwr-zeit' }, 'Uhrzeit'), zeit),
    el('div', { class: 'kwfeldzeile' }, el('label', { for: 'kwr-titel' }, 'Name (optional)'), titel));
  box.append(blatt, el('div', { class: 'kwaktionen' },
    kwKnopf('Speichern', async (ev) => {
      const knopf = ev.currentTarget;
      knopf.disabled = true;
      const j = await chatAktion('routine_speichern', { routine: { ...(alt ? { id: alt.id } : {}), agent_id: f.agent_id, projekt: f.projekt || '',
        eingaben: f.eingaben, tage: f.tage, uhrzeit: f.uhrzeit, titel: f.titel } }).catch((e) => ({ fehler: e.message }));
      knopf.disabled = false;
      if (j.fehler) return uiHinweis(j.fehler);
      await kiLadeRoutinen(); chatAnsicht('routinen');
      uiHinweis('Gespeichert. Nächster Lauf ' + kwDatum(j.routine.naechster_lauf) + '.', 'ok');
    }, 'voll'),
    kwKnopf('Abbrechen', () => chatAnsicht('routinen'), 'leise'),
    !agenten.length ? el('span', { class: 'kwleise' }, 'Es gibt noch keinen aktiven Agenten.') : ''));
}

// ---------- Artefakte ----------
function kwArtefaktZeile(d) {
  const wann = kwDatum(d.geaendert);
  return el('button', { class: 'kwzeile knopf', type: 'button', onclick: () => kiArtefaktOeffnen(d) },
    el('span', { class: 'kwsym' }, kwIcon(d.agent === 'tony' ? 'tony' : d.symbol)),
    el('span', { class: 'kwzeiletext' }, el('b', {}, d.titel),
      el('span', {}, ['von ' + d.von, d.projekt, d.version > 1 ? 'Fassung ' + d.version : ''].filter(Boolean).join(' · '))),
    d.status === 'arbeitet' ? kwChip('in Arbeit', 'oliv') : d.status === 'fehler' ? kwChip('Fehler', 'rot') : el('span'),
    el('span', { class: 'kwleise' }, wann));
}
async function kiArtefaktOeffnen(d) {
  S.kiansicht = null;
  S.kiDokWahl = d.id;
  if (S.kichat?.id !== d.chat_id) { S.kichat = null; await chatOeffnen(d.chat_id); return; }
  S.kichat.dokZu = false;
  renderChat();
  await chatDokLaden();
}
function kwArtefakte(box, v) {
  const alle = S.kiartefakte;
  const filter = v.filter || 'alle';
  const projekt = v.projekt ? (S.projects || []).find((p) => p.id === v.projekt) : null;
  box.append(projekt
    ? kwKopf(projekt.name, 'GHIW Docs zu diesem Projekt. Ein Klick öffnet den Chat, das Dokument steht rechts.',
        kwKnopf('Agent losschicken', (e) => kiProjektAgent(e.currentTarget.getBoundingClientRect(), projekt), 'voll'))
    : kwKopf('GHIW Docs', 'Alles, was Tony oder ein Agent für dich geschrieben hat, im Büro-Layout. Ein Klick öffnet den Chat, das Dokument steht rechts.'));
  const such = el('input', { class: 'kwfeld kwsuchfeld', type: 'search', placeholder: 'Titel, Projekt oder Agent', value: v.q || '', 'aria-label': 'GHIW Docs durchsuchen' });
  such.addEventListener('input', () => { v.q = such.value; zeichne(); });
  const f = [['alle', 'Alle'], ['tony', 'Von Tony'], ['agenten', 'Von Agenten']];
  box.append(el('div', { class: 'kwleiste' }, kwFilter(f, filter, (w) => chatAnsicht('artefakte', { ...v, filter: w })), such));
  const liste = el('div', { class: 'kwliste' });
  box.append(liste);
  function zeichne() {
    liste.innerHTML = '';
    if (alle == null) return liste.append(kwLeer('lädt …'));
    const q = String(v.q || '').toLowerCase().trim();
    const treffer = alle.filter((d) => (filter === 'alle' || (filter === 'tony') === (d.agent === 'tony'))
      && (!v.projekt || d.project_id === v.projekt)
      && (!q || [d.titel, d.projekt, d.von].some((x) => String(x || '').toLowerCase().includes(q))));
    if (!treffer.length) return liste.append(kwLeer(q ? 'Nichts gefunden.' : projekt ? 'Zu diesem Projekt gibt es noch keine GHIW Docs. Schick oben einen Agenten los.' : 'Noch keine GHIW Docs. Bitte Tony um eine Übersicht, oder schick einen Agenten los.'));
    for (const d of treffer) liste.append(kwArtefaktZeile(d));
  }
  zeichne();
}

// Fassungen im Kopf des Dokuments (chat-dokument.js): Menue mit allen Fassungen; eine alte Fassung
// wird zur Ansicht gezeigt und laesst sich zuruecksetzen (nur Dokumente mit Inhalt in der Zeile).
function kiFassungKnopf(d, panel) {
  if (!d?.id || !(d.version > 1)) return [];
  return [el('button', { class: 'kichip', type: 'button', title: 'Frühere Fassungen', onclick: async (e) => {
    const b = e.currentTarget.getBoundingClientRect();
    const j = await chatAktion('artefakt_versionen', { dok_id: d.id }).catch(() => ({ versionen: [] }));
    const vs = Array.isArray(j.versionen) ? j.versionen : [];
    ctxMenu(b.left, b.bottom + 4, [{ note: 'Fassungen' }, ...vs.map((x) => ({
      txt: 'Fassung ' + x.version + ' · ' + kwDatum(x.erstellt) + (x.version === d.version ? ' (aktuell)' : ''),
      do: () => x.version !== d.version && kiFassungZeigen(d, x.version, panel),
    }))]);
  } }, 'Fassung ' + d.version)];
}
async function kiFassungZeigen(d, version, panel) {
  const j = await chatAktion('artefakt_versionen', { dok_id: d.id, version }).catch((e) => ({ fehler: e.message }));
  const v = j.versionen;
  const flaeche = panel.querySelector('.kidokflaeche');
  if (!v || !flaeche) return uiHinweis(j.fehler || 'Fassung nicht gefunden.');
  flaeche.innerHTML = ''; flaeche.dataset.pfad = 'fassung:' + version;
  const leiste = el('div', { class: 'kwfassungleiste' }, el('span', {}, 'Fassung ' + version + ' vom ' + kwDatum(v.erstellt) + ' — nur zur Ansicht'),
    v.html ? kwKnopf('Diese Fassung wiederherstellen', async () => {
      const w = await chatAktion('artefakt_wiederherstellen', { dok_id: d.id, version }).catch((e) => ({ fehler: e.message }));
      if (w.fehler) return uiHinweis(w.fehler);
      uiHinweis('Wiederhergestellt als Fassung ' + w.version + '.', 'ok'); chatDokLaden();
      const k = S.kichat; k.zeilen.push({ rolle: 'assistent', text: 'Fassung ' + version + ' ist wiederhergestellt (jetzt Fassung ' + w.version + ').' });
    }, 'voll') : el('span', { class: 'kwleise' }, 'Berichtsdatei auf dem Büro-PC, lässt sich hier nur ansehen'),
    kwKnopf('Zur aktuellen Fassung', () => { flaeche.dataset.pfad = ''; chatDokRender(); }, 'leise'));
  const fr = el('iframe', { class: 'kidokframe', title: 'Fassung ' + version, sandbox: 'allow-scripts allow-popups' });
  flaeche.append(leiste, fr);
  if (v.html) fr.src = URL.createObjectURL(new Blob([v.html], { type: 'text/html' }));
  else if (v.anhang_pfad) anhangUrl({ pfad: v.anhang_pfad, name: 'Fassung.html' }).then(async (u) => { fr.src = URL.createObjectURL(new Blob([await (await fetch(u)).blob()], { type: 'text/html' })); }).catch(() => {});
}

// ---------- Projekt: Agent losschicken ----------
async function kiProjektAgent(r, p) {
  if (!S.kiagenten) await kiLadeAgenten();
  const passend = (S.kiagenten?.agenten || []).filter((a) => (a.zustand === 'aktiv' || a.mein) && (a.eingaben || []).some((e) => e.art === 'projekt')
    && (a.eingaben || []).every((e) => e.art === 'projekt' || !e.pflicht));
  ctxMenu(r.left, r.bottom + 4, [{ note: 'Für ' + p.name }, ...passend.map((a) => ({ txt: a.name + (a.zustand === 'entwurf' ? ' (Entwurf)' : ''), do: () => kiAgentLosschicken(a, p.id, {}, false) })),
    { note: '' }, { txt: 'Anderer Agent …', do: () => chatAnsicht('agenten') }]);
}


// ---------- Projektbereich (Migration 207, Marcel 29.09.) ----------
// „Warum hat man in den Projekten selber keinen Chat?" Klick auf ein Projekt links: Aufgaben,
// Chats und GHIW Docs dieses Projekts. Klick auf eine Aufgabe: Gespraech mit dem Karten-Agenten.
async function kiLadeProjektBoard(p) {
  S.kiprojBoard = S.kiprojBoard || {};
  try { S.kiprojBoard[p.id] = await lotse('board', { projekt: p.name }); }
  catch (e) { S.kiprojBoard[p.id] = { fehler: e.message }; }
  const v = kwAnsicht();
  if (S.active?.typ === 'chat' && v?.art === 'projekt' && v.id === p.id) renderChat();
}
function kiProjektChatNeu(p) {
  chatNeu();
  S.kichat.projekt = { id: p.id, name: p.name };
  renderChat();
  document.querySelector('#chat-root .kita')?.focus();
}
function kwAufgabeZeile(t, spalte, p) {
  const f = fmtDatum(t.faellig);
  const st = statusVon(t);
  return el('button', { class: 'kwzeile knopf', type: 'button', onclick: () => chatAnsicht('karte', { id: t.id, projekt: p.id }) },
    el('span', { class: 'kwzeiletext' }, el('b', {}, t.titel || '(ohne Titel)'),
      el('span', {}, spalte || '', f && spalte ? ' · ' : '', f ? el('span', { class: f.urgent ? 'kwdringend' : '' }, (f.urgent ? '' : 'fällig ') + f.txt) : '')),
    st === 'arbeitet' ? kwChip('Agent arbeitet', 'oliv') : st === 'rueckfrage' ? kwChip('Rückfrage', 'amber') : el('span'));
}
function kwProjekt(box, v) {
  const p = (S.projects || []).find((x) => x.id === v.id);
  if (!p) { box.append(kwLeer('Projekt nicht gefunden.')); return; }
  box.append(kwKopf(p.name, (p.lph ? 'Leistungsphase ' + p.lph + ' · ' : '') + 'Aufgaben, Chats und GHIW Docs dieses Projekts. Ein Klick auf eine Aufgabe öffnet das Gespräch mit ihrem Agenten.',
    kwKnopf('Agent losschicken', (e) => kiProjektAgent(e.currentTarget.getBoundingClientRect(), p)),
    kwKnopf('Neuer Chat im Projekt', () => kiProjektChatNeu(p), 'voll')));
  const raster = el('div', { class: 'kwprojekt' });
  // Aufgaben: offene Karten des Projekt-Boards in Spaltenreihenfolge.
  const aufgaben = el('section', { class: 'kwblatt' }, el('h4', {}, 'Aufgaben'));
  const b = S.kiprojBoard?.[p.id];
  if (!b) { aufgaben.append(kwLeer('lädt …')); kiLadeProjektBoard(p); }
  else if (b.fehler) aufgaben.append(kwLeer('Aufgaben nicht geladen: ' + b.fehler));
  else {
    const spalten = b.spalten || [];
    const offen = (b.todos || []).filter((t) => t.status !== 'erledigt' && !t.spiegel);
    const name = (t) => spalten.find((s) => s.id === t.spalte_id)?.name || spalten[0]?.name || '';
    const rang = (t) => { const i = spalten.findIndex((s) => s.id === t.spalte_id); return i < 0 ? 0 : i; };
    offen.sort((x, y) => rang(x) - rang(y) || String(x.faellig || '9').localeCompare(String(y.faellig || '9')));
    if (!offen.length) aufgaben.append(kwLeer('Keine offenen Aufgaben.'));
    else aufgaben.append(el('div', { class: 'kwliste' }, ...offen.map((t) => kwAufgabeZeile(t, name(t), p))));
  }
  const rechts = el('div', { class: 'kwspalte' });
  const chats = (S.kichats || []).filter((c) => c.project_id === p.id);
  rechts.append(el('section', { class: 'kwblatt' }, el('h4', {}, 'Chats'),
    chats.length ? el('div', { class: 'kwliste' }, ...chats.map((c) => el('button', { class: 'kwzeile knopf', type: 'button', onclick: () => chatOeffnenAus(c.id) },
      el('span', { class: 'kwzeiletext' }, el('b', {}, c.titel), el('span', {}, kwDatum(c.geaendert))))))
      : kwLeer('Noch kein Chat zu diesem Projekt.')));
  const docs = (S.kiartefakte || []).filter((d) => d.project_id === p.id);
  if (S.kiartefakte == null) kiLadeArtefakte();
  rechts.append(el('section', { class: 'kwblatt' }, el('h4', {}, 'GHIW Docs'),
    docs.length ? el('div', { class: 'kwliste' }, ...docs.slice(0, 12).map(kwArtefaktZeile)) : kwLeer(S.kiartefakte == null ? 'lädt …' : 'Noch keine GHIW Docs.')));
  raster.append(aufgaben, rechts);
  box.append(raster);
}

// Gespraech mit dem Karten-Agenten: die Kommentare der Karte als Chat. Was man schreibt, geht als
// @agent-Zuruf an die Karte (kommentar-auftrag, Agent SDK); er kennt Karte, Verlauf und Unterlagen.
async function kiLadeKarte(id) {
  try { const d = await lotse('todo_detail', { todo_id: id }); if (!d.fehler) S.kikarte = d; }
  catch { /* naechster Takt versucht es wieder */ }
  const v = kwAnsicht();
  if (S.active?.typ === 'chat' && v?.art === 'karte' && v.id === id) renderChat();
}
// Nachfragen, bis der Agent geantwortet hat. Der Zuruf-Agent legt sofort einen Platzhalter
// („Bin dran: …") an und ersetzt dessen Text am Ende; fertig ist es erst, wenn es mehr
// Agenten-Kommentare gibt als beim Absenden, der letzte kein Platzhalter mehr ist und die
// Karte nicht mehr „arbeitet".
function kiKarteTakt(id) {
  if (S.kikarteTakt?.id === id) return;
  clearInterval(S.kikarteTakt?.h);
  const bis = Date.now() + 13 * 60000;
  const stopp = () => { clearInterval(h); if (S.kikarteTakt?.h === h) S.kikarteTakt = null; };
  const h = setInterval(async () => {
    const v = kwAnsicht();
    if (v?.art !== 'karte' || v.id !== id || Date.now() > bis) return stopp();
    await kiLadeKarte(id);
    const d = S.kikarte;
    if (!d || d.id !== id) return;
    const agent = (d.kommentare || []).filter((k) => k.von === 'agent');
    const z = S.kizuruf;
    if (z && z.id === id && agent.length > z.nAgent && !/^Bin dran:/.test(agent.at(-1).text || '') && statusVon(d) !== 'arbeitet') S.kizuruf = null;
    if (z && Date.now() - z.seit > 13 * 60000) S.kizuruf = null;
    if (!(S.kizuruf && S.kizuruf.id === id) && statusVon(d) !== 'arbeitet') { stopp(); renderChat(); }
  }, 4000);
  S.kikarteTakt = { id, h };
}
function kwKarte(box, v) {
  const d = S.kikarte && S.kikarte.id === v.id ? S.kikarte : null;
  const p = (S.projects || []).find((x) => x.id === v.projekt);
  box.append(el('button', { class: 'kwzurueck', type: 'button', onclick: () => p ? chatAnsicht('projekt', { id: p.id }) : chatAnsicht('agenten') }, '← ' + (p ? p.name : 'zurück')));
  if (!d) {
    box.append(kwLeer('lädt …'));
    if (!S.kikarteLaedt) { S.kikarteLaedt = true; kiLadeKarte(v.id).finally(() => { S.kikarteLaedt = false; if (statusVon(S.kikarte || {}) === 'arbeitet') kiKarteTakt(v.id); }); }
    return;
  }
  const f = fmtDatum(d.faellig);
  const pname = d.projekt && typeof d.projekt === 'object' ? d.projekt.name : d.projekt;
  box.append(kwKopf(d.titel, [pname, f ? 'fällig ' + f.txt : ''].filter(Boolean).join(' · ') || 'Aufgabe',
    kwKnopf('Karte öffnen', () => openCard(d.id))));
  const verlauf = el('div', { class: 'kwkartechat' });
  const kom = d.kommentare || [];
  if (!kom.length) verlauf.append(kwLeer('Frag den Agenten dieser Aufgabe. Er kennt Titel, Notiz, Unterpunkte, Dateien und den Verlauf der Karte und liest bei Bedarf in den Projektunterlagen nach. Eine Antwort dauert meist ein bis drei Minuten.'));
  for (const k of kom) {
    const agent = k.von === 'agent';
    const text = k.meiner ? String(k.text || '').replace(/^\s*@agent\b\s*/i, '') : String(k.text || '');
    const blase = el('div', { class: 'kiblase' + (agent ? ' md' : '') });
    if (agent) blase.innerHTML = chatMd(text); else blase.textContent = text;
    const wer = agent ? 'Agent · ' : k.meiner ? '' : k.von + ' · ';
    verlauf.append(el('div', { class: 'kizeile ' + (k.meiner ? 'nutzer' : 'assistent') },
      el('div', { class: 'kwkom' }, el('span', { class: 'kwwer' }, wer + kwDatum(k.am)), blase)));
  }
  const wartet = S.kizuruf && S.kizuruf.id === d.id;
  if (statusVon(d) === 'arbeitet' || wartet) verlauf.append(el('div', { class: 'kizeile assistent' },
    el('div', { class: 'kiblase kidenkt' }, 'Agent arbeitet …' + (d.agent_fortschritt ? ' ' + d.agent_fortschritt : ''))));
  const ta = el('textarea', { class: 'kwfeld', rows: '2', placeholder: 'Nachricht an den Agenten dieser Aufgabe …', 'aria-label': 'Nachricht an den Agenten' });
  ta.value = S.kikarteEntwurf?.[d.id] || '';
  ta.addEventListener('input', () => { S.kikarteEntwurf = { ...(S.kikarteEntwurf || {}), [d.id]: ta.value }; });
  const senden = async () => {
    const t = ta.value.trim(); if (!t) return;
    ta.value = ''; S.kikarteEntwurf = { ...(S.kikarteEntwurf || {}), [d.id]: '' };
    S.kizuruf = { id: d.id, seit: Date.now(), nAgent: kom.filter((k) => k.von === 'agent').length };
    d.kommentare = [...kom, { von: '', meiner: true, text: t, am: new Date().toISOString() }];
    renderChat();
    const r = await mut('kommentar_anlegen', { todo_id: d.id, text: /@agent\b/i.test(t) ? t : '@agent ' + t });
    if (r && r.fehler) S.kizuruf = null;
    await kiLadeKarte(d.id);
    if (S.kikarteTakt?.id !== d.id) kiKarteTakt(d.id);
  };
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); senden(); } });
  box.append(verlauf, el('div', { class: 'kwkarteeingabe' }, ta, kwKnopf('Senden', senden, 'voll')));
  setTimeout(() => { box.scrollTop = box.scrollHeight; });
}

// Kopfzeile ueber einem Chat, der zu einem Projekt gehoert (Migration 207).
function kiChatProjektKopf(root) {
  const haupt = root.querySelector('.kihaupt');
  let kopf = haupt.querySelector('.kwchatprojekt');
  const p = S.kichat?.projekt;
  if (!p || S.kiansicht) { kopf?.remove(); return; }
  if (!kopf) { kopf = el('div', { class: 'kwchatprojekt' }); haupt.prepend(kopf); }
  kopf.innerHTML = '';
  kopf.append(el('button', { class: 'kwzurueck', type: 'button', onclick: () => chatAnsicht('projekt', { id: p.id }) }, '← ' + p.name),
    el('span', { class: 'kwleise' }, 'Chat in diesem Projekt · Tony kennt es'));
}
function kiChatProjekt(chatId) {
  const c = (S.kichats || []).find((x) => x.id === chatId);
  return c && c.project_id ? { id: c.project_id, name: c.projekt || (S.projects || []).find((p) => p.id === c.project_id)?.name } : null;
}
