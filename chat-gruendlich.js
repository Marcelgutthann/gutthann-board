// ---------- Chat: gründlicher Weg (06.10.2026, Migration 235) ----------
// Marcel 06.10.: hinter dem Chat hingen keine Agenten, nur Tony. Der Schalter „Gründlich“ über der Eingabe
// schickt Fragen an einen Claude-Code-Lauf auf dem Server (runner/chat-agent.mjs): Absicht erschließen, in
// Runden suchen, gegenprüfen, Ausgabeform wählen (Excel, Dokument im Druckstandard), Unteragenten.
//   Auto (Standard): live-backend „weiche“ entscheidet je Frage; Bedienen, Anlegen, Senden, Smalltalk bleiben bei Tony.
//   An: jede Frage geht den gründlichen Weg.  Aus: immer Tony.
// Dateien im Anhang gehen immer an Tony (der gründliche Weg nimmt noch keine Anhänge).
// Ablauf: gruendlich_starten -> alle 1,5 s gruendlich_stand (Arbeitsweg, Antwort im Entstehen) -> am Ende
// den Chat neu laden (dort steht der fertige Zug mit Dokumentkarten). Stopp/Esc: gruendlich_anhalten.
// Haken in app.js: chatSenden (vorn), chatOeffnen (Felder), chatZeile (Fuß); chat-dokument.js: Chip;
// chat-arbeitsweg.js: Abschnitt „Gründlich“.

const KI_GR_MODI = { auto: 'Auto', an: 'An', aus: 'Aus' };
function chatGrModus() {
  try { const v = localStorage.getItem('kigruendlich'); return KI_GR_MODI[v] ? v : 'auto'; } catch { return 'auto'; }
}
function chatGrChip() {
  const m = chatGrModus();
  const titel = { auto: 'Gründlich: Auto — Fragen, die Recherche, Prüfung oder eine Datei brauchen, gehen an den gründlichen Agenten; alles andere beantwortet Tony.',
    an: 'Gründlich: An — jede Frage geht an den gründlichen Agenten (Minuten statt Sekunden).', aus: 'Gründlich: Aus — Tony antwortet schnell selbst.' }[m];
  return el('button', { class: 'kiwahl kigr ' + m, type: 'button', title: titel + ' Klick: umschalten.',
    onclick: () => { const n = m === 'auto' ? 'an' : m === 'an' ? 'aus' : 'auto'; try { localStorage.setItem('kigruendlich', n); } catch {} renderChat(); } },
    ico('bot'), el('span', {}, 'Gründlich: ' + KI_GR_MODI[m]));
}

// Vorn in chatSenden. true = die Nachricht ist hier übernommen, chatSenden endet.
async function chatGrSenden(ta, text) {
  const k = S.kichat;
  const m = chatGrModus();
  if (m === 'aus' || (k.dateien || []).length) return false;
  if (m === 'auto') {
    k.denkt = true; chatKnopf();
    const verlauf = k.zeilen.filter((z) => z.rolle !== 'fehler').slice(-4).map((z) => ({ rolle: z.rolle, text: String(z.text || '').slice(0, 400), ...(z.gruendlich ? { gruendlich: true } : {}) }));
    const w = await chatAktion('weiche', { aufgabe: text, verlauf, chat_id: k.id }).catch(() => ({ gruendlich: false }));
    k.denkt = false;
    if (!w.gruendlich) return false;
  }
  chatDiktatEnde();
  k.zeilen.push({ rolle: 'nutzer', text, gruendlich: true });
  const z = { rolle: 'assistent', text: '', laeuft: true, tut: 'nimmt die Frage auf', gruendlich: { lauf: null } };
  k.zeilen.push(z);
  ta.value = ''; k.awZu = false; k.denkt = true; k.stopp = new AbortController(); renderChat(); chatKnopf();
  let runId = null;
  try {
    const s = await chatAktion('gruendlich_starten', { aufgabe: text, chat_id: k.id, projekt_id: k.projekt?.id });
    if (s.fehler || s.error || !s.run_id) throw new Error(s.fehler || s.error || 'Lauf nicht angelegt');
    runId = s.run_id; z.gruendlich.run_id = runId;
    if (s.chat_id && k.id !== s.chat_id) { k.id = s.chat_id; ladeChats(); }
    k.stopp.signal.addEventListener('abort', () => { z.tut = 'wird angehalten'; chatLetzte(); chatAktion('gruendlich_anhalten', { run_id: runId }).catch(() => {}); });
    // Nachfragen, bis der Lauf endet (höchstens 40 min; der Dienst bricht nach 25 min selbst ab).
    const bis = Date.now() + 40 * 60000;
    for (;;) {
      await new Promise((r) => setTimeout(r, 1500));
      const j = await chatAktion('gruendlich_stand', { run_id: runId }).catch(() => null);
      if (!j || j.fehler) { if (Date.now() > bis) throw new Error('keine Rückmeldung vom Server'); continue; }
      z.gruendlich.lauf = j.lauf || null; z.gruendlich.still_s = j.still_s; z.gruendlich.status = j.status;
      z.tut = j.status === 'wartet' ? 'wartet auf den Server' : (j.lauf && j.lauf.jetzt) || 'arbeitet';
      if (typeof j.antwort_teil === 'string') z.text = j.antwort_teil;
      if (S.kichat === k && S.active?.typ === 'chat') chatLetzte();
      if (!['wartet', 'running'].includes(j.status)) break;
      if (Date.now() > bis) throw new Error('Zeitlimit im Board erreicht — der Lauf arbeitet vielleicht noch, lade den Chat später neu');
    }
    // Der fertige Zug (Text, Arbeitsweg, Plan, Dokumentkarten, Dauer/Kosten) steht im Chat.
    const c = await chatAktion('laden', { chat_id: k.id }).catch(() => null);
    const fertig = c && Array.isArray(c.verlauf) ? [...c.verlauf].reverse().find((x) => x.rolle === 'assistent' && x.gruendlich && x.gruendlich.run_id === runId) : null;
    if (fertig) Object.assign(z, { text: fertig.text, weg: fertig.weg, plan: fertig.plan, dateien: fertig.dateien, gruendlich: { ...fertig.gruendlich, lauf: z.gruendlich.lauf } });
    else z.text = z.text || '(Der Lauf ist beendet, aber die Antwort ist nicht im Chat angekommen.)';
    if (z.plan) k.plan = z.plan;
    if ((z.dateien || []).some((d) => d.dok_id)) { k.dokWahl = [...z.dateien].reverse().find((d) => d.dok_id).dok_id; k.dokZu = false; chatDokLaden(); }
  } catch (e) {
    k.zeilen.splice(k.zeilen.indexOf(z), 1);
    k.zeilen.push({ rolle: 'fehler', text: 'Der gründliche Weg hat nicht geklappt: ' + (e?.message || e) });
  } finally {
    z.laeuft = false; k.denkt = false; k.stopp = null;
    if (S.active?.typ === 'chat') { renderChat(); chatKnopf(); }
  }
  return true;
}

// Unter der Antwort: Dokumentkarten (öffnen rechts / herunterladen) und ein Fuß mit Dauer und Kosten.
function chatGrFuss(z) {
  if (z.rolle !== 'assistent' || (!z.dateien?.length && !z.gruendlich)) return null;
  const teile = [];
  for (const d of z.dateien || []) {
    const art = d.art === 'excel' ? 'Excel' : d.art === 'dokument' ? 'GHIW Doc' : 'Datei';
    const knoepfe = [];
    if (d.dok_id) knoepfe.push(el('button', { class: 'kichip', type: 'button', onclick: () => { const k = S.kichat; k.dokWahl = d.dok_id; k.dokZu = false; chatDokLaden(); } }, 'Öffnen'));
    if (d.link) knoepfe.push(el('a', { class: 'kichip', href: d.link, target: '_blank', rel: 'noopener' }, d.art === 'dokument' ? 'Öffnen' : 'Herunterladen'));
    if (d.pdf) knoepfe.push(el('a', { class: 'kichip', href: d.pdf, target: '_blank', rel: 'noopener' }, 'PDF'));
    teile.push(el('div', { class: 'kigrdatei' }, ico('file'), el('div', { class: 'kigrdname' }, el('b', {}, d.titel), el('span', {}, art + (d.zeilen ? ' · ' + d.zeilen + ' Zeilen' : ''))), ...knoepfe));
  }
  const g = z.gruendlich || {};
  if (!z.laeuft && (g.dauer_s != null || g.kosten != null)) {
    const min = g.dauer_s >= 60 ? Math.floor(g.dauer_s / 60) + ':' + String(g.dauer_s % 60).padStart(2, '0') + ' min' : (g.dauer_s || 0) + ' s';
    teile.push(el('div', { class: 'kigrfuss' }, 'Gründlich · ' + min + (g.unteragenten ? ' · ' + g.unteragenten + ' Unteragent' + (g.unteragenten === 1 ? '' : 'en') : '') +
      (g.kosten != null ? ' · ' + Number(g.kosten).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $' : '')));
  }
  return teile.length ? el('div', { class: 'kigr' }, ...teile) : null;
}

// Abschnitt im schwebenden Fenster Arbeitsweg (chat-arbeitsweg.js): Plan, Schritte, Unteragenten, Lebenszeichen.
function chatAwGruendlich(inhalt, z) {
  const g = z?.gruendlich;
  const lw = g?.lauf;
  if (!g) return false;
  if (!lw && !z.laeuft) {
    // Aus dem gespeicherten Verlauf (kein Live-Lauf mehr): die Schritte mit Logo der Quelle.
    if (!z.weg?.length) return false;
    inhalt.append(el('div', { class: 'kiawabschnitt' }, 'Gründlich · ' + z.weg.length + ' Schritte'));
    for (const w of z.weg) {
      const q = chatQuelle(w.n);
      inhalt.append(el('div', { class: 'kiwegz' + (w.ok === false ? ' fehl' : '') }, chatLogo(q),
        el('span', {}, (KI_QUELLE[q]?.name ? KI_QUELLE[q].name + ' · ' : '') + chatWerkzeugWort(w.n) + (w.x ? ': ' + w.x : ''))));
    }
    return true;
  }
  const plan = Array.isArray(lw?.plan) ? lw.plan : [];
  const schritte = Array.isArray(lw?.schritte) ? lw.schritte : [];
  const fertig = plan.filter((p) => p.s === 'completed').length;
  inhalt.append(el('div', { class: 'kiawabschnitt' }, 'Gründlich' + (plan.length ? ` · Plan ${fertig} von ${plan.length}` : '') + (lw?.leser ? ` · ${lw.leser} Unteragent${lw.leser === 1 ? '' : 'en'}` : '')));
  if (z.laeuft) inhalt.append(el('div', { class: 'kiawjetzt' + (g.still_s >= 180 ? ' haengt' : '') },
    g.status === 'wartet' ? 'wartet auf den Server …' : g.still_s >= 180 ? `kein Lebenszeichen seit ${Math.floor(g.still_s / 60)} min`
      : (lw?.jetzt || z.tut || 'arbeitet') + (g.still_s != null ? ` · vor ${g.still_s} s` : '')));
  if (plan.length) inhalt.append(el('div', { class: 'kiawplan' }, ...plan.map(chatAwPunkt)));
  if (schritte.length) inhalt.append(el('div', { class: 'kiawschritte' },
    ...schritte.slice(-40).map((x) => el('div', { class: 'kiawschritt' + (x.a === 'leser' ? ' leser' : '') }, el('span', { class: 'kiawzeit' }, mmss(x.s || 0)), el('span', {}, x.t)))));
  return true;
}
