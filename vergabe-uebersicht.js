// ---------- Vergabeübersicht: Sonderboard unter dem VgV-Board (Migration 224) ----------
// Besprechung „Vergabe Übersicht" 05.10.2026 (Benjamin Adam, Julian Neuhoff, Marcel):
// Kein Kanban mehr (Informationsmenge), sondern eine kalenderähnliche Zeitachse über alle Projekte,
// begleitend zur Ausschreibungsrunde. Quelle sind allein die Vergabeterminpläne (db/vergabe-import.mjs).
//  - Massgeblich ist die Lesefassung beim Bauherrn; davor liegt der geschätzte Bearbeitungszeitraum.
//  - Zugeklappt eine Zeile je Projekt (oder Gewerk / Mitarbeiter) als „Morse"-Balken, aufgeklappt
//    die einzelnen Vergabeeinheiten. Überlappung = dichtere Farbe.
//  - Umschalten Projekt / Gewerk / Mitarbeiter, Filter nach Projekt, Gewerk, Zeit; ELT/HLS raus.
//  - Vergabeeinheit einem Mitarbeiter zuordnen; offene bleiben erkennbar (nur Umriss).
// Farben: Projekte zufällig (projDot wie in der Seitenleiste), Gewerkfarben sind zurückgestellt.

const VG = { d: null, fehler: null, sicht: 'projekt', monate: 6, offen: new Set(), projekte: null,
  gewerk: '', fremde: false, erledigte: false, nurOffen: false, detail: null,
  von: null, tage: null }; // sichtbarer Ausschnitt der Zeitachse (Strg/Alt+Mausrad zoomt, Umschalt+Mausrad schiebt)
const VG_TAGE = 14; // Beispiel aus der Besprechung (Baumeister-LV), je Einheit änderbar
const VG_TAG_MS = 86400000;

async function ladeVergabe() {
  vgStil();
  const root = document.getElementById('vergabe-root');
  if (!root) return;
  if (!VG.d) root.replaceChildren(el('div', { class: 'vgleer' }, 'Lade Vergabeterminpläne…'));
  try {
    const d = await restRpc('assistant_vergabe_uebersicht', {});
    if (d?.fehler) { VG.fehler = d.fehler; VG.d = null; }
    else { for (const e of d.einheiten || []) vgLesefassung(e); VG.d = d; VG.fehler = null; VG.uhrVersatz = new Date(d.jetzt) - Date.now(); }
  } catch (e) { VG.fehler = 'Die Vergabeübersicht ist gerade nicht erreichbar (' + e.message + ').'; }
  renderVergabe();
  // Die Zeitangabe „vor X Min." zaehlt im Browser selbst weiter (Marcel 06.10.: „ich will die Zeit nicht
  // ständig neu laden müssen") — alle 15 s, unabhaengig vom Datenabruf.
  if (!VG.uhr) VG.uhr = setInterval(vgTaktText, 15000);
  // Jede Minute still neu laden (Marcel 06.10.), damit niemand auf den Pfeil klicken muss. Nicht, solange
  // jemand tippt, zieht oder der Tab im Hintergrund liegt — sonst raeumt der Neuaufbau die Eingabe weg.
  if (!VG.takt) VG.takt = setInterval(() => {
    if (S.active?.typ !== 'vergabe' || document.hidden || vgZug) return;
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest('#vergabe-root')) return;
    ladeVergabe();
  }, 60000);
}

const vgTag = (s) => s ? new Date(s + 'T00:00:00') : null;
const vgPlus = (d, n) => new Date(d.getTime() + n * 86400000);
const vgFmt = (d) => d ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '–';
const vgEuro = (n) => n == null ? '' : n >= 1e6 ? (n / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mio €'
  : Math.round(n / 1000).toLocaleString('de-DE') + ' T€';
const vgKurzProjekt = (p) => String(p).replace(/^\d+\s*-\s*/, '').replace(/^\d{4}\s+/, '');

// Massgeblich ist allein die Lesefassung, die im Vergabeterminplan steht (Marcel 06.10.: „wenn kein Termin
// drinnen steht, dann darf nichts da stehen — keine Ableitung, keine Rueckrechnung"). Ohne Termin: Hinweis
// „Termin fehlt – kann nicht zugeordnet werden", kein Balken.
function vgLesefassung(e) { e.lf = e.lesefassung || null; }

// Projektfarben deutlich unterscheidbar (Besprechung 06.10.: „ein wenig unterschiedlichere Farben"),
// fest nach Reihenfolge der aufgenommenen Projekte vergeben. Gewerkfarben bleiben bewusst weg.
const VG_PALETTE = ['#4E79A7', '#E8762B', '#59A14F', '#D64550', '#8E6BB8', '#C9A227', '#2A9D8F', '#E377C2', '#8C6D46', '#5B6770', '#1F5F9E', '#A0522D'];
function vgFarbe(projekt) {
  const liste = (VG.d?.projekte || []).filter((p) => p.aufgenommen).map((p) => p.ordner).sort();
  const i = liste.indexOf(projekt);
  return i >= 0 ? VG_PALETTE[i % VG_PALETTE.length] : projDot(projekt);
}

// Bearbeitungsfenster einer Einheit: [Lesefassung − Bearbeitung, Lesefassung]. Den Vorlauf gibt es nicht
// mehr (Marcel 05.10.: ergibt keinen Sinn) — eine alte vorlauf_tage-Angabe in der Datenbank wird ignoriert.
function vgFenster(e) {
  const ende = vgTag(e.lf);
  if (!ende) return null;
  return { start: vgPlus(ende, -(e.bearbeitung_tage || VG_TAGE)), ende };
}

// Ausschnitt auf eine Voreinstellung (3/6/12 Monate ab zwei Wochen vor heute) setzen
function vgAusschnitt(monate) {
  const heute = vgTag(VG.d.heute);
  VG.monate = monate;
  VG.von = vgPlus(heute, -14);
  VG.tage = Math.round((new Date(heute.getFullYear(), heute.getMonth() + monate, heute.getDate()) - VG.von) / VG_TAG_MS);
}

// Alles auf der Zeitachse traegt data-a (und data-b fuer Breiten) als Millisekunden. Zoomen und Schieben
// setzen nur left/width neu — kein Neuaufbau, deshalb laeuft es fluessig wie im Terminplan.
function vgLage(wurzel) {
  const von = VG.von.getTime(), span = VG.tage * VG_TAG_MS;
  for (const n of wurzel.querySelectorAll('[data-a]')) {
    const a = +n.dataset.a;
    n.style.left = ((a - von) / span * 100) + '%';
    if (n.dataset.b) n.style.width = Math.max(0.15, (+n.dataset.b - a) / span * 100) + '%';
  }
}

// Strg/Alt+Mausrad zoomt am Zeiger, Umschalt+Mausrad (oder seitliches Wischen) schiebt, Ziehen mit der
// linken Maustaste auf freier Flaeche schiebt ebenfalls. Vorbild: terminplan/plan.html.
function vgBewegung(plan) {
  let rahmen = 0;
  const zeichne = () => { if (!rahmen) rahmen = requestAnimationFrame(() => { rahmen = 0; vgLage(plan); }); };
  const spur = () => plan.querySelector('.vgspur').getBoundingClientRect();
  const schiebe = (px) => { VG.von = new Date(VG.von.getTime() + px / spur().width * VG.tage * VG_TAG_MS); VG.monate = null; zeichne(); };
  plan.addEventListener('wheel', (ev) => {
    const r = spur();
    if (ev.ctrlKey || ev.altKey || ev.metaKey) {
      ev.preventDefault();
      const anteil = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      const anker = VG.von.getTime() + anteil * VG.tage * VG_TAG_MS;
      const d = ev.deltaMode === 1 ? ev.deltaY * 33 : ev.deltaY;
      VG.tage = Math.max(14, Math.min(1100, VG.tage * Math.exp(d * 0.0015)));
      VG.von = new Date(anker - anteil * VG.tage * VG_TAG_MS);
      VG.monate = null; zeichne();
      vgSegmentAus(plan);
    } else if (ev.shiftKey || Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) {
      ev.preventDefault();
      schiebe(ev.deltaX || ev.deltaY);
      vgSegmentAus(plan);
    }
  }, { passive: false });
  plan.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0 || ev.target.closest('.vgbalken, .vgraute, .vglabel, button, a, input')) return;
    vgZug = { plan, x: ev.clientX, los: false, schiebe };
  });
}
const vgSegmentAus = (plan) => plan.closest('.vghaupt')?.querySelectorAll('.vgseg.zeit button.an').forEach((b) => b.classList.remove('an'));
// Ziehen: EIN Satz Fenster-Lauscher fuer alle Neuaufbauten (sonst saemmelte jeder renderVergabe neue an)
let vgZug = null;
window.addEventListener('mousemove', (ev) => {
  if (!vgZug || !vgZug.plan.isConnected) return;
  const dx = ev.clientX - vgZug.x;
  if (!vgZug.los && Math.abs(dx) < 4) return;
  vgZug.los = true; vgZug.x = ev.clientX; vgZug.plan.classList.add('zieht');
  vgZug.schiebe(-dx); vgSegmentAus(vgZug.plan);
});
window.addEventListener('mouseup', () => {
  if (vgZug?.los) vgZug.plan.addEventListener('click', (ev) => ev.stopPropagation(), { capture: true, once: true });
  vgZug?.plan.classList.remove('zieht'); vgZug = null;
});

function vgEinheiten() {
  const alle = VG.d?.einheiten || [];
  return alle.filter((e) => (VG.fremde || e.ghiw)
    && (VG.erledigte || !e.erledigt)
    && (!VG.projekte || VG.projekte.has(e.projekt))
    && (!VG.gewerk || e.gewerk === VG.gewerk)
    && (!VG.nurOffen || !e.person));
}

function renderVergabe() {
  const root = document.getElementById('vergabe-root');
  if (!root) return;
  if (VG.fehler) { root.replaceChildren(el('div', { class: 'vgleer' }, VG.fehler)); return; }
  if (!VG.d) return;
  const heute = vgTag(VG.d.heute);
  if (!VG.von) vgAusschnitt(VG.monate || 6);
  // Zeilen haengen nicht am Zoom: alles ab zwei Wochen vor heute steht drin, der Ausschnitt waehlt nur den Blick
  const ab = vgPlus(heute, -14);
  const pos = (a, b) => b ? { 'data-a': String(+a), 'data-b': String(+b) } : { 'data-a': String(+a) };

  const basis = vgEinheiten();
  const imFenster = basis.filter((e) => { const f = vgFenster(e); return f && f.ende >= ab; });
  const ohneTermin = basis.filter((e) => !e.lf && !e.erledigt);
  const ohneNach = new Map();
  for (const e of ohneTermin) ohneNach.set(e.projekt, [...(ohneNach.get(e.projekt) || []), e]);

  // ---- Werkzeugleiste ----
  const leiste = el('div', { class: 'vgleiste' });
  const seg = (werte, aktiv, setze, klasse) => {
    const s = el('div', { class: 'vgseg' + (klasse ? ' ' + klasse : '') });
    for (const [k, t] of werte) s.append(el('button', { class: aktiv === k ? 'an' : '', onclick: () => { setze(k); renderVergabe(); } }, t));
    return s;
  };
  leiste.append(seg([['projekt', 'Projekte'], ['gewerk', 'Gewerke'], ['person', 'Mitarbeiter']], VG.sicht,
    (k) => { VG.sicht = k; VG.offen.clear(); }));
  leiste.append(seg([[3, '3 Monate'], [6, '6 Monate'], [12, '12 Monate']], VG.monate, (k) => vgAusschnitt(k), 'zeit'));
  const gewerke = [...new Set((VG.d.einheiten || []).filter((e) => VG.fremde || e.ghiw).map((e) => e.gewerk))].sort((a, b) => a.localeCompare(b, 'de'));
  const gsel = el('select', { class: 'vgsel', onchange: (ev) => { VG.gewerk = ev.target.value; renderVergabe(); } },
    el('option', { value: '' }, 'Alle Gewerke'), ...gewerke.map((g) => el('option', { value: g }, g)));
  gsel.value = VG.gewerk;
  leiste.append(gsel);
  const schalter = (an, text, titel, setze) => el('label', { class: 'vgcheck', title: titel },
    el('input', { type: 'checkbox', ...(an ? { checked: '' } : {}), onchange: (ev) => { setze(ev.target.checked); renderVergabe(); } }), text);
  leiste.append(schalter(VG.nurOffen, 'nur nicht zugeordnete', 'Nur Vergabeeinheiten ohne Mitarbeiter', (v) => { VG.nurOffen = v; }));
  leiste.append(schalter(VG.fremde, 'ELT/HLS & Fachplaner', 'Auch Einheiten, die GHIW nicht selbst ausschreibt (die KI hat sie aussortiert)', (v) => { VG.fremde = v; }));
  leiste.append(schalter(VG.erledigte, 'erledigte', 'Auch bereits vergebene/entfallene Einheiten', (v) => { VG.erledigte = v; }));
  leiste.append(el('button', { class: 'vgknopf', title: 'Neu laden', onclick: () => ladeVergabe() }, ico('refresh')));
  leiste.append(el('button', { class: 'vgtext', title: 'Alle Gruppen auf- oder zuklappen', onclick: () => {
    const alle = [...document.querySelectorAll('#vergabe-root .vggruppe')].map((g) => g.dataset.name);
    if (alle.every((n) => VG.offen.has(n))) VG.offen.clear(); else alle.forEach((n) => VG.offen.add(n));
    renderVergabe();
  } }, 'Alle auf-/zuklappen'));
  // Wann wurde zuletzt in SharePoint nachgesehen (Marcel 06.10.: „ENORM WICHTIG")
  const durchgang = VG.d.letzter_durchgang ? new Date(VG.d.letzter_durchgang) : null;
  const vorMin = durchgang ? Math.max(0, Math.floor((Date.now() + (VG.uhrVersatz || 0) - durchgang) / 60000)) : null;
  leiste.append(el('div', { class: 'vgrechts' },
    el('span', { class: 'vgtakt' + (vorMin != null && vorMin > 12 ? ' warn' : ''), title: 'Der Server sieht alle 5 Minuten in SharePoint nach. Ist eine Datei neu gespeichert, liest er sie im selben Durchgang ein. Diese Ansicht lädt sich jede Minute selbst neu.' },
      durchgang ? `SharePoint geprüft ${durchgang.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} (${vorMin ? 'vor ' + vorMin + ' Min.' : 'gerade eben'}) · alle 5 Min.` : 'SharePoint noch nicht geprüft'),
    el('button', { class: 'btn vgprojbtn', onclick: () => { VG.panel = true; renderVergabe(); } }, ico('plus'), 'Projekte')));

  // Projektfilter als Chips
  const projekte = (VG.d.projekte || []).filter((p) => p.aufgenommen).map((p) => p.ordner).sort();
  const chips = el('div', { class: 'vgchips' });
  for (const p of projekte) {
    const an = !VG.projekte || VG.projekte.has(p);
    chips.append(el('button', { class: 'vgchip' + (an ? ' an' : ''), title: an ? 'Ausblenden' : 'Einblenden', onclick: () => {
      const s = VG.projekte ? new Set(VG.projekte) : new Set(projekte);
      s.has(p) ? s.delete(p) : s.add(p);
      VG.projekte = s.size === projekte.length ? null : s;
      renderVergabe();
    } }, el('span', { class: 'vgpunkt', style: 'background:' + vgFarbe(p) }), vgKurzProjekt(p)));
  }

  // ---- Zeitachse: ueber den ganzen Datenbereich plus Reserve gebaut, damit Zoomen/Schieben nichts nachbauen muss ----
  const fenster = imFenster.map(vgFenster);
  const bereichVon = new Date(Math.min(+vgPlus(heute, -400), ...fenster.map((f) => +f.start)));
  const bereichBis = new Date(Math.max(+vgPlus(heute, 1100), ...fenster.map((f) => +f.ende)));
  const achse = el('div', { class: 'vgachse' });
  for (let m = new Date(bereichVon.getFullYear(), bereichVon.getMonth() + 1, 1); m < bereichBis; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    achse.append(el('div', { class: 'vgmonat', ...pos(m) },
      m.toLocaleDateString('de-DE', { month: 'short', year: m.getMonth() === 0 ? '2-digit' : undefined })));
  }
  const heuteLinie = () => el('div', { class: 'vgheute', ...pos(heute) });

  // Dichte je Kalenderwoche (ab Montag): wie viele Einheiten sind gleichzeitig in Bearbeitung („wo zwickt es")
  const montag0 = vgPlus(bereichVon, -((bereichVon.getDay() + 6) % 7));
  const wochen = Math.ceil((bereichBis - montag0) / VG_TAG_MS / 7);
  const dichte = Array(wochen).fill(0);
  for (const f of fenster) {
    for (let w = 0; w < wochen; w++) {
      const a = vgPlus(montag0, w * 7), b = vgPlus(a, 7);
      if (f.start < b && f.ende >= a) dichte[w]++;
    }
  }
  const maxD = Math.max(1, ...dichte);
  const dichteBand = el('div', { class: 'vgdichte' });
  dichte.forEach((n, w) => { if (n) dichteBand.append(el('div', {
    class: 'vgdzelle', title: `KW ab ${vgFmt(vgPlus(montag0, w * 7))}: ${n} Einheit${n === 1 ? '' : 'en'} in Bearbeitung`,
    ...pos(vgPlus(montag0, w * 7), vgPlus(montag0, w * 7 + 7)), style: `opacity:${0.12 + 0.88 * n / maxD}` }, String(n))); });

  // ---- Gruppen ----
  const gruppeVon = (e) => VG.sicht === 'projekt' ? e.projekt : VG.sicht === 'gewerk' ? e.gewerk : (e.person || 'Nicht zugeordnet');
  const gruppen = new Map();
  for (const e of imFenster) { const g = gruppeVon(e); if (!gruppen.has(g)) gruppen.set(g, []); gruppen.get(g).push(e); }
  // Mitarbeiter-Ansicht: jede Person der Liste (Migration 226) hat eine Zeile, auch ohne Zuordnung —
  // so sieht man freie Kapazitaet. Reihenfolge wie in der Liste, Nicht zugeordnet zuletzt.
  const team = VG.d.personen || [];
  if (VG.sicht === 'person') for (const p of team) if (!gruppen.has(p)) gruppen.set(p, []);
  if (VG.sicht === 'projekt') for (const p of ohneNach.keys()) if (!gruppen.has(p)) gruppen.set(p, []);
  const rang = (n) => n === 'Nicht zugeordnet' ? 1e9 : team.includes(n) ? team.indexOf(n) : 1e6;
  const reihe = [...gruppen.entries()].sort((a, b) => {
    if (VG.sicht === 'person') return rang(a[0]) - rang(b[0]) || a[0].localeCompare(b[0], 'de');
    const st = (l) => l.length ? Math.min(...l.map((e) => +vgFenster(e).start)) : Infinity;
    return (st(a[1]) - st(b[1])) || a[0].localeCompare(b[0], 'de');
  });

  const farbe = (e) => vgFarbe(e.projekt);
  const balken = (e, klein) => {
    const f = vgFenster(e);
    const b = el('div', {
      class: 'vgbalken' + (e.person ? ' zu' : ' frei') + (klein ? ' klein' : ''),
      ...pos(f.start, f.ende), style: `--f:${farbe(e)}`,
      title: `${e.leistungsbereich} · ${vgKurzProjekt(e.projekt)}\nLesefassung ${vgFmt(f.ende)}${e.person ? '\nbei ' + e.person : '\nnoch nicht zugeordnet'}`,
      onclick: (ev) => { ev.stopPropagation(); VG.detail = e.schluessel; renderVergabe(); },
    });
    return b;
  };
  // Meilensteine: gleiche Lesefassung im selben Projekt = EIN gemeinsamer Meilenstein (Beschluss 12)
  const meilensteine = (liste) => {
    const m = new Map();
    for (const e of liste) { const k = e.projekt + '|' + e.lf; m.set(k, [...(m.get(k) || []), e]); }
    return [...m.values()].map((l) => el('div', { class: 'vgraute', ...pos(vgTag(l[0].lf)), style: `--f:${farbe(l[0])}`,
      title: `Lesefassung beim Bauherrn ${vgFmt(vgTag(l[0].lf))} · ${vgKurzProjekt(l[0].projekt)}\n` + l.map((e) => '· ' + e.leistungsbereich).join('\n') },
    l.length > 1 ? el('span', { class: 'vgrzahl' }, String(l.length)) : null));
  };

  const plan = el('div', { class: 'vgplan' });
  plan.append(el('div', { class: 'vgzeile vgkopfzeile' }, el('div', { class: 'vglabel' }, 'Auslastung je Woche'),
    el('div', { class: 'vgspur' }, achse, dichteBand, heuteLinie())));
  for (const [name, liste] of reihe) {
    const offen = VG.offen.has(name);
    const frei = liste.filter((e) => !e.person).length;
    const fehlen = VG.sicht === 'projekt' ? (ohneNach.get(name) || []) : [];
    const kopf = el('div', { class: 'vgzeile vggruppe' + (offen ? ' offen' : ''), 'data-name': name, onclick: () => {
      offen ? VG.offen.delete(name) : VG.offen.add(name); renderVergabe(); } },
    el('div', { class: 'vglabel' },
      el('span', { class: 'vgpfeil' }, '›'),
      VG.sicht === 'projekt' ? el('span', { class: 'vgpunkt', style: 'background:' + vgFarbe(name) }) : null,
      el('span', { class: 'vgname', title: name }, VG.sicht === 'projekt' ? vgKurzProjekt(name) : name),
      el('span', { class: 'vgzahl', title: frei ? `${frei} noch ohne Mitarbeiter` : 'alle zugeordnet' },
        liste.length ? `${liste.length}${frei ? ' · ' + frei + ' offen' : ''}` : (fehlen.length ? '' : 'frei')),
      fehlen.length ? el('span', { class: 'vgfehlt', title: `${fehlen.length} Vergabe(n) ohne Lesefassungstermin im Plan — kann nicht zugeordnet werden` }, `! ${fehlen.length}`) : null),
    el('div', { class: 'vgspur' }, heuteLinie(), ...liste.map((e) => balken(e, false)), ...meilensteine(liste)));
    plan.append(kopf);
    if (!offen) continue;
    for (const e of [...liste].sort((a, b) => vgFenster(a).ende - vgFenster(b).ende)) {
      // Beschriftung = Leistungsbereich wie im Vergabeterminplan (gleich dem Detail rechts), nie die KI-Kategorie
      const unter = VG.sicht === 'projekt' ? e.leistungsbereich : vgKurzProjekt(e.projekt) + ' · ' + e.leistungsbereich;
      plan.append(el('div', { class: 'vgzeile vgeinheit' + (VG.detail === e.schluessel ? ' gewaehlt' : ''), onclick: () => { VG.detail = e.schluessel; renderVergabe(); } },
        el('div', { class: 'vglabel' },
          VG.sicht !== 'projekt' ? el('span', { class: 'vgpunkt', style: 'background:' + vgFarbe(e.projekt) }) : null,
          el('span', { class: 'vgname', title: e.leistungsbereich }, unter),
          el('span', { class: 'vgmeta' }, [e.budget_brutto ? vgEuro(e.budget_brutto) : '', e.person ? initialen(e.person) : ''].filter(Boolean).join(' · '))),
        el('div', { class: 'vgspur' }, heuteLinie(), balken(e, true), ...meilensteine([e]))));
    }
    for (const e of fehlen) {
      plan.append(el('div', { class: 'vgzeile vgeinheit' + (VG.detail === e.schluessel ? ' gewaehlt' : ''), onclick: () => { VG.detail = e.schluessel; renderVergabe(); } },
        el('div', { class: 'vglabel' }, el('span', { class: 'vgname', title: e.leistungsbereich }, e.leistungsbereich),
          el('span', { class: 'vgmeta' }, e.budget_brutto ? vgEuro(e.budget_brutto) : '')),
        el('div', { class: 'vgspur' }, el('span', { class: 'vgtfehlt' }, '! Termin fehlt – kann nicht zugeordnet werden'))));
    }
  }
  if (!projekte.length) plan.append(el('div', { class: 'vgleer' }, 'Noch kein Projekt aufgenommen — oben rechts über „Projekte +" hinzufügen.'));
  else if (!plan.querySelector('.vggruppe')) plan.append(el('div', { class: 'vgleer' }, 'Keine Vergabeeinheit mit Lesefassungstermin in diesem Zeitraum und Filter.'));
  vgLage(plan);
  vgBewegung(plan);

  // ---- Legende ----
  const legende = el('div', { class: 'vglegende' },
    el('span', {}, el('i', { class: 'vglg voll' }), 'zugeordnet'),
    el('span', {}, el('i', { class: 'vglg leer' }), 'noch offen'),
    el('span', {}, el('i', { class: 'vglg raute' }), 'Lesefassung beim Bauherrn (aus dem Plan)'),
    el('span', { class: 'vgklein' }, `Balken = Bearbeitungszeit in Kalendertagen vor der Lesefassung (Standard ${VG_TAGE} Kalendertage, je Einheit einstellbar) · Strg/Alt + Mausrad zoomt, Umschalt + Mausrad oder Ziehen schiebt`));
  // Grosses Ausrufezeichen, wenn Termine fehlen (Besprechung 06.10.: „Achtung, kümmer dich")
  const warnband = ohneTermin.length ? el('div', { class: 'vgwarnband' }, el('b', {}, '!'),
    ` ${ohneTermin.length} Vergabe${ohneTermin.length === 1 ? '' : 'n'} ohne Lesefassungstermin im Vergabeterminplan — kann nicht zugeordnet werden. `
    + 'Bitte die Spalte „Versendung LV als Lesefassung an Bauherr" ausfüllen.') : null;

  const haupt = el('div', { class: 'vghaupt' }, leiste, warnband, chips, plan, legende);
  const teile = [haupt];
  const det = VG.detail && (VG.d.einheiten || []).find((e) => e.schluessel === VG.detail);
  if (det) teile.push(vgDetail(det));
  if (VG.panel) teile.push(vgProjektePanel());
  const scroll = root.querySelector('.vghaupt')?.scrollTop || 0;
  const listScroll = root.querySelector('.vgplist')?.scrollTop || 0;
  root.replaceChildren(...teile);
  haupt.scrollTop = scroll;
  const pl = root.querySelector('.vgplist'); if (pl) pl.scrollTop = listScroll;
}

function vgDetail(e) {
  const f = vgFenster(e);
  const zeile = (k, v, klasse) => v ? el('div', { class: 'vgdz' + (klasse ? ' ' + klasse : '') }, el('span', {}, k), el('b', {}, v)) : null;
  const personen = [...(VG.d.personen || []), ...(VG.d.weitere || [])];
  const liste = el('datalist', { id: 'vg-personen' }, ...personen.map((p) => el('option', { value: p })));
  const pIn = el('input', { class: 'vgin', list: 'vg-personen', placeholder: 'Mitarbeiter wählen oder eintippen', value: e.person || '' });
  const tIn = el('input', { class: 'vgin kurz', type: 'number', min: '1', max: '120', value: String(e.bearbeitung_tage || VG_TAGE) });
  const speichern = async (entfernen) => {
    const r = await restRpc('assistant_vergabe_zuordnen', { p_schluessel: e.schluessel, p_person: entfernen ? null : pIn.value.trim() || null,
      p_bearbeitung_tage: Number(tIn.value) || null, p_entfernen: !!entfernen })
      .catch((err) => ({ fehler: err.message }));
    if (r?.fehler) { uiHinweis(r.fehler); return; }
    await ladeVergabe();
  };
  return el('aside', { class: 'vgdetail' },
    el('div', { class: 'vgdkopf' }, el('span', { class: 'vgpunkt', style: 'background:' + vgFarbe(e.projekt) }),
      el('div', {}, el('div', { class: 'vgdtitel' }, e.leistungsbereich), el('div', { class: 'vgklein' }, vgKurzProjekt(e.projekt) + (e.paket ? ' · Paket ' + e.paket : ''))),
      el('button', { class: 'vgknopf', title: 'Schließen', onclick: () => { VG.detail = null; renderVergabe(); } }, ico('weg'))),
    el('div', { class: 'vgdblock' },
      zeile('Lesefassung beim Bauherrn', e.lf ? vgFmt(vgTag(e.lf)) : '! Termin fehlt – kann nicht zugeordnet werden', e.lf ? 'stark' : 'warn'),
      f ? zeile('Bearbeitung', `${vgFmt(f.start)} – ${vgFmt(f.ende)} (${e.bearbeitung_tage || VG_TAGE} Kalendertage)`) : null,
      zeile('Budget (KB brutto)', e.budget_brutto ? Number(e.budget_brutto).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €' : null),
      zeile('Gewerk', e.gewerk), zeile('Vergabeart', e.vergabeart), zeile('Verantwortlich laut Plan', e.verantwortlich),
      zeile('Bearbeiter laut Plan', e.bearbeiter_plan), zeile('Status laut Plan', e.status)),
    el('div', { class: 'vgdblock' },
      el('div', { class: 'vgdlbl' }, 'Zuordnung'), liste,
      el('label', { class: 'vgfeld' }, 'Mitarbeiter', pIn),
      el('label', { class: 'vgfeld' }, 'Bearbeitungszeit in Kalendertagen', tIn),
      el('div', { class: 'vgdknoepfe' }, el('button', { class: 'btn primary', onclick: () => speichern(false) }, 'Speichern'),
        e.person ? el('button', { class: 'btn', onclick: () => speichern(true) }, 'Zuordnung lösen') : null)),
    el('div', { class: 'vgdblock vgklein' },
      zeile('Veröffentlichung', vgFmt(vgTag(e.veroeffentlichung))), zeile('Submission', vgFmt(vgTag(e.submission))),
      zeile('Sitzung', vgFmt(vgTag(e.sitzung))), zeile('Beginn Gewerk', vgFmt(vgTag(e.baubeginn))),
      e.ghiw_quelle === 'ki'
        ? el('div', { class: 'vghinweis' }, `! Spalte „Verantwortlich" ist leer — ${e.ghiw ? 'als GHIW' : 'als nicht GHIW'} eingeordnet durch die KI. Bitte im Plan eintragen.`)
        : el('div', { class: 'vgquelle' }, e.ghiw_grund || ''),
      el('div', { class: 'vgquelle' }, 'Quelle: ', e.quelle_url ? el('a', { href: e.quelle_url, target: '_blank', rel: 'noopener' }, e.quelle_datei) : e.quelle_datei,
        ` (Stand ${vgFmt(vgTag(e.plan_stand))})`)));
}

// „Projekte +" (Marcel 06.10.): alle SharePoint-Projektordner, was je Projekt da ist, aktiv aufnehmen.
// Zeigt je Projekt: Datei und deren Aenderungszeit, wann zuletzt geprueft, wann eingelesen und wie lange die KI brauchte.
const VG_GRUND = { plan: 'Vergabeterminplan da', mehrere_excel: 'mehrere Excel im Ordner — es gilt die neueste',
  ordner_leer: 'Ordner „Vergabeterminplan" ist leer', kein_vergabeordner: 'kein Ordner „Vergabeterminplan" unter Termine', kein_termine: 'kein Ordner „Termine"' };
function vgProjektePanel() {
  const datum = (t) => t ? new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;
  const uhr = (t) => t ? new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
  const alle = VG.d.projekte || [];
  const hatPlan = (p) => p.status === 'plan' || p.status === 'mehrere_excel';
  const filter = VG.panelFilter || 'plan';
  const such = (VG.panelSuche || '').toLowerCase();
  const zahl = { drin: alle.filter((p) => p.aufgenommen).length, plan: alle.filter(hatPlan).length, alle: alle.length };
  const liste = alle.filter((p) => (filter === 'drin' ? p.aufgenommen : filter === 'plan' ? hatPlan(p) || p.aufgenommen : true)
    && (!such || p.ordner.toLowerCase().includes(such)));
  const durchgang = VG.d.letzter_durchgang ? new Date(VG.d.letzter_durchgang) : null;
  const naechster = durchgang ? new Date(durchgang.getTime() + 5 * 60000) : null;
  const umschalten = async (p, entfernen, knopf) => {
    if (entfernen && !await uiFrage(`„${vgKurzProjekt(p.ordner)}" aus der Vergabeübersicht nehmen? Zuordnungen bleiben gespeichert.`)) return;
    knopf.disabled = true;
    const r = await restRpc('assistant_vergabe_projekt', { p_ordner: p.ordner, p_entfernen: !!entfernen }).catch((e) => ({ fehler: e.message }));
    if (r?.fehler) { knopf.disabled = false; uiHinweis(r.fehler); return; }
    await ladeVergabe();
  };
  // Lesestand eines aufgenommenen Projekts als eine ruhige Marke
  const stand = (p) => {
    if (!p.aufgenommen) return null;
    const neu = p.lese_status === 'ok' && p.datei_geaendert && p.gelesen_geaendert && +new Date(p.datei_geaendert) > +new Date(p.gelesen_geaendert);
    if (neu || p.lese_status === 'wartet') return el('span', { class: 'vgmarke warte' }, `wird gelesen · bis ${uhr(naechster)}`);
    if (p.lese_status === 'ok') return el('span', { class: 'vgmarke ok', title: `Eingelesen ${datum(p.gelesen_at)}, KI ${Math.round((p.ki_dauer_ms || 0) / 1000)} s` },
      `eingelesen ${datum(p.gelesen_at)} · ${Math.round((p.ki_dauer_ms || 0) / 1000)} s`);
    if (p.lese_status === 'keine_datei') return el('span', { class: 'vgmarke warn' }, 'keine Datei');
    return el('span', { class: 'vgmarke warn', title: p.lese_fehler || '' }, 'Fehler beim Lesen');
  };
  const zeilen = liste.map((p) => {
    const nr = (p.ordner.match(/^[\d-]+/) || [''])[0];
    const name = p.ordner.slice(nr.length).trim() || p.ordner;
    const meta = hatPlan(p)
      ? [el('a', { href: p.datei_url, target: '_blank', rel: 'noopener', class: 'vgdatei', title: 'Im SharePoint öffnen' }, ico('file'), p.datei),
          el('span', {}, `gespeichert ${datum(p.datei_geaendert)}`),
          p.status === 'mehrere_excel' ? el('span', { class: 'vgwarntext', title: 'Es gilt die zuletzt gespeicherte. Alte Stände bitte in einen Unterordner „Verlauf" legen.' }, `${p.excel_anzahl} Excel im Ordner`) : null]
      : [el('span', {}, VG_GRUND[p.status] || p.status)];
    const knopf = p.aufgenommen
      ? el('button', { class: 'vgleise', onclick: (ev) => umschalten(p, true, ev.currentTarget) }, 'Entfernen')
      : hatPlan(p) ? el('button', { class: 'btn ghost vgauf', onclick: (ev) => umschalten(p, false, ev.currentTarget) }, ico('plus'), 'Aufnehmen') : null;
    return el('div', { class: 'vgprow' + (p.aufgenommen ? ' drin' : '') + (hatPlan(p) ? '' : ' ohne') },
      el('span', { class: 'vgpunkt', style: p.aufgenommen ? 'background:' + vgFarbe(p.ordner) : '' }),
      el('div', { class: 'vgpkopf' },
        el('div', { class: 'vgpname' }, el('span', { class: 'vgpnr' }, nr), name,
          p.aufgenommen && p.ohne_termin ? el('span', { class: 'vgfehlt', title: 'Vergaben ohne Lesefassungstermin im Plan' }, `! ${p.ohne_termin}`) : null),
        el('div', { class: 'vgpmeta' }, ...meta)),
      el('div', { class: 'vgpstand' }, stand(p)),
      el('div', { class: 'vgpaktion' }, knopf));
  });
  const reiter = el('div', { class: 'vgseg' }, ...[['drin', 'Aufgenommen'], ['plan', 'Mit Vergabeterminplan'], ['alle', 'Alle Ordner']].map(([k, t]) =>
    el('button', { class: filter === k ? 'an' : '', onclick: () => { VG.panelFilter = k; renderVergabe(); } }, t, el('span', { class: 'vgsegzahl' }, String(zahl[k])))));
  const suche = el('input', { class: 'vgin vgsuche', placeholder: 'Projekt suchen', value: VG.panelSuche || '',
    oninput: (ev) => { VG.panelSuche = ev.target.value; const pos2 = ev.target.selectionStart; renderVergabe();
      const n = document.querySelector('#vergabe-root .vgsuche'); if (n) { n.focus(); n.setSelectionRange(pos2, pos2); } } });
  const zu = () => { VG.panel = false; renderVergabe(); };
  return el('div', { class: 'vgpanelgrund', onclick: (ev) => { if (ev.target === ev.currentTarget) zu(); } },
    el('div', { class: 'vgpanel' },
      el('div', { class: 'vgpanelkopf' },
        el('div', {}, el('div', { class: 'vgpaneltitel' }, 'Projekte'),
          el('div', { class: 'vgklein' }, 'Nur aufgenommene Projekte erscheinen in der Vergabeübersicht.')),
        el('button', { class: 'vgknopf', title: 'Schließen', onclick: zu }, ico('weg'))),
      el('div', { class: 'vgpanelleiste' }, reiter, suche),
      el('div', { class: 'vgplist' }, ...(zeilen.length ? zeilen : [el('div', { class: 'vgleer' }, filter === 'drin' ? 'Noch kein Projekt aufgenommen.' : 'Kein Projekt gefunden.')])),
      el('div', { class: 'vgpanelfuss', title: 'Ein Durchgang durch alle Projektordner dauert etwa 25 Sekunden, das Einlesen eines geänderten Plans durch die KI etwa eine Minute.' },
        ico('refresh'), durchgang
          ? `SharePoint zuletzt geprüft ${uhr(durchgang)} · nächste Prüfung ${uhr(naechster)} · eine gespeicherte Änderung erscheint nach höchstens etwa 7 Minuten`
          : 'SharePoint wird alle 5 Minuten geprüft')));
}

function vgTaktText() {
  const n = document.querySelector('#vergabe-root .vgtakt');
  const t = VG.d?.letzter_durchgang ? new Date(VG.d.letzter_durchgang) : null;
  if (!n || !t) return;
  const vor = Math.max(0, Math.floor((Date.now() + (VG.uhrVersatz || 0) - t) / 60000));
  n.textContent = `SharePoint geprüft ${t.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} (${vor ? 'vor ' + vor + ' Min.' : 'gerade eben'}) · alle 5 Min.`;
  n.classList.toggle('warn', vor > 12);
}

let vgStilDa = false;
function vgStil() {
  if (vgStilDa) return; vgStilDa = true;
  document.head.append(el('style', {}, `
#vergabe-root{flex:1;min-height:0;display:flex;gap:0}
#vergabe-root[hidden]{display:none}
#vergabe-root .vghaupt{flex:1;min-width:0;overflow:auto;padding:4px 28px 28px}
#vergabe-root .vgleer{padding:28px;font-size:13.5px;color:#6E6E67}
#vergabe-root .vgleiste{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:4px 0 6px}
#vergabe-root .vgseg{display:inline-flex;background:#E8E8E6;border-radius:8px;padding:2px}
#vergabe-root .vgseg button{padding:5px 11px;border-radius:6px;font-size:12.5px;color:#55554F}
#vergabe-root .vgseg button.an{background:#FFFFFF;color:#1C1C1A;box-shadow:0 1px 2px rgba(28,28,26,.12)}
#vergabe-root .vgsel{font:inherit;font-size:12.5px;padding:5px 8px;border-radius:8px;border:1px solid rgba(28,28,26,.14);background:#FFFFFF}
#vergabe-root .vgcheck{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;color:#55554F;cursor:pointer}
#vergabe-root .vgknopf{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;color:#55554F}
#vergabe-root .vgknopf:hover{background:rgba(28,28,26,.06)}
#vergabe-root .vgtext{font-size:12.5px;color:#55554F;padding:5px 9px;border-radius:8px}
#vergabe-root .vgtext:hover{background:rgba(28,28,26,.06)}
#vergabe-root .vgrechts{margin-left:auto;display:flex;align-items:center;gap:12px}
#vergabe-root .vgtakt{font-size:12px;color:#75756E}
#vergabe-root .vgfehlt{display:inline-block;margin-left:6px;font-size:11px;font-weight:700;color:#FFFFFF;background:#C2410C;border-radius:999px;padding:0 6px;line-height:16px;white-space:nowrap}
#vergabe-root .vgtfehlt{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:11.5px;font-weight:600;color:#C2410C;white-space:nowrap}
#vergabe-root .vgwarnband{display:flex;align-items:center;gap:9px;font-size:12.5px;color:#55554F;background:#FFFFFF;border:1px solid rgba(28,28,26,.10);border-radius:10px;padding:7px 12px;margin:0 0 8px}
#vergabe-root .vgprojbtn{padding:6px 12px;font-size:12.5px}
#vergabe-root .vgprojbtn .ico svg,#vergabe-root .vgauf .ico svg{width:14px;height:14px}
#vergabe-root .vgpanelgrund{position:fixed;inset:0;background:rgba(28,28,26,.32);z-index:50;display:flex;justify-content:center;align-items:flex-start;padding:56px 24px}
#vergabe-root .vgpanel{background:#F3F3F1;border-radius:16px;box-shadow:0 24px 60px rgba(28,28,26,.28);width:min(920px,100%);max-height:calc(100vh - 112px);display:flex;flex-direction:column;overflow:hidden}
#vergabe-root .vgpanelkopf{display:flex;justify-content:space-between;align-items:flex-start;padding:18px 22px 6px}
#vergabe-root .vgpaneltitel{font-size:17px;font-weight:600;color:#1C1C1A;letter-spacing:-.01em}
#vergabe-root .vgpanelleiste{display:flex;align-items:center;gap:10px;padding:8px 22px 12px}
#vergabe-root .vgseg button{white-space:nowrap}
#vergabe-root .vgsegzahl{margin-left:6px;font-size:11px;color:#8A8A83;font-variant-numeric:tabular-nums}
#vergabe-root .vgsuche{margin-left:auto;width:220px;padding:6px 10px;font-size:12.5px}
#vergabe-root .vgplist{overflow:auto;min-height:0;margin:0 14px;background:#FFFFFF;border:1px solid rgba(28,28,26,.08);border-radius:12px}
#vergabe-root .vgprow{display:grid;grid-template-columns:10px minmax(0,1fr) auto 112px;align-items:center;gap:12px;padding:10px 14px;border-top:1px solid rgba(28,28,26,.06)}
#vergabe-root .vgprow:first-child{border-top:0}
#vergabe-root .vgprow:hover{background:#FAFAF9}
#vergabe-root .vgprow .vgpunkt{width:9px;height:9px;box-shadow:inset 0 0 0 1px rgba(28,28,26,.18)}
#vergabe-root .vgprow.drin .vgpunkt{box-shadow:none}
#vergabe-root .vgpname{font-size:13px;font-weight:500;color:#1C1C1A;display:flex;align-items:center;gap:7px;min-width:0}
#vergabe-root .vgpnr{font-size:12px;font-weight:400;color:#8A8A83;font-variant-numeric:tabular-nums;flex:none}
#vergabe-root .vgprow.ohne .vgpname{color:#75756E;font-weight:400}
#vergabe-root .vgpmeta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;margin-top:3px;font-size:11.5px;color:#8A8A83}
#vergabe-root .vgdatei{display:inline-flex;align-items:center;gap:4px;color:#55554F;text-decoration:none;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#vergabe-root .vgdatei:hover{color:#1C1C1A;text-decoration:underline;text-underline-offset:2px}
#vergabe-root .vgdatei .ico svg{width:12px;height:12px}
#vergabe-root .vgwarntext{color:#9A5B13}
#vergabe-root .vgmarke{display:inline-block;font-size:11.5px;padding:2px 8px;border-radius:999px;white-space:nowrap;font-variant-numeric:tabular-nums}
#vergabe-root .vgmarke.ok{background:#EEF3E2;color:#3E4E12}
#vergabe-root .vgmarke.warte{background:#F1F1EE;color:#55554F}
#vergabe-root .vgmarke.warn{background:#FBEEE4;color:#9A3A0C}
#vergabe-root .vgpaktion{display:flex;justify-content:flex-end}
#vergabe-root .vgauf{padding:5px 11px;font-size:12px;font-weight:500}
#vergabe-root .vgleise{font-size:12px;color:#8A8A83;padding:5px 8px;border-radius:8px}
#vergabe-root .vgleise:hover{color:#9A3A0C;background:#FBEEE4}
#vergabe-root .vgpanelfuss{display:flex;align-items:center;gap:7px;padding:12px 22px 16px;font-size:11.5px;color:#8A8A83}
#vergabe-root .vgpanelfuss .ico svg{width:13px;height:13px}
#vergabe-root .vgwarnband b{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:#C2410C;color:#FFFFFF;font-size:12px;flex:none}
#vergabe-root .vgchips{display:flex;flex-wrap:wrap;gap:5px;padding:0 0 8px}
#vergabe-root .vgchip{display:inline-flex;align-items:center;gap:6px;padding:2px 9px;border-radius:999px;font-size:12px;border:1px solid rgba(28,28,26,.12);color:#8A8A83;background:transparent}
#vergabe-root .vgchip.an{color:#1C1C1A;background:#FFFFFF}
#vergabe-root .vgpunkt{width:8px;height:8px;border-radius:50%;flex:none;display:inline-block}
#vergabe-root .vgplan{background:#FFFFFF;border:1px solid rgba(28,28,26,.10);border-radius:12px;overflow:hidden}
#vergabe-root .vgplan.zieht{cursor:grabbing;user-select:none}
#vergabe-root .vgzeile{display:flex;min-height:22px;border-top:1px solid rgba(28,28,26,.06)}
#vergabe-root .vgkopfzeile{border-top:0;min-height:40px;background:#FAFAF9}
#vergabe-root .vglabel{width:300px;flex:none;display:flex;align-items:center;gap:7px;padding:0 12px;font-size:12px;color:#1C1C1A;border-right:1px solid rgba(28,28,26,.06);min-width:0}
#vergabe-root .vgkopfzeile .vglabel{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#8A8A83;align-items:flex-end;padding-bottom:4px}
#vergabe-root .vgname{overflow:hidden;min-width:0;flex:1;line-height:1.3;padding:5px 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
#vergabe-root .vgzahl,#vergabe-root .vgmeta{font-size:11.5px;color:#8A8A83;white-space:nowrap}
#vergabe-root .vgpfeil{display:inline-block;width:10px;color:#8A8A83;transition:transform .15s ease}
#vergabe-root .vggruppe{cursor:pointer;min-height:26px}
#vergabe-root .vggruppe:hover{background:#FAFAF9}
#vergabe-root .vggruppe .vglabel{font-weight:600}
#vergabe-root .vggruppe.offen .vgpfeil{transform:rotate(90deg)}
#vergabe-root .vgeinheit{cursor:pointer;background:#FCFCFB}
#vergabe-root .vgeinheit .vglabel{padding-left:29px;font-weight:400}
#vergabe-root .vgeinheit:hover,#vergabe-root .vgeinheit.gewaehlt{background:#F3F3F1}
#vergabe-root .vgspur{flex:1;position:relative;min-width:420px;overflow-x:clip}
#vergabe-root .vgachse{position:absolute;inset:0 0 auto 0;height:18px}
#vergabe-root .vgmonat{position:absolute;top:3px;font-size:11px;color:#75756E;padding-left:4px;border-left:1px solid rgba(28,28,26,.15);height:14px;line-height:14px;white-space:nowrap}
#vergabe-root .vgdichte{position:absolute;left:0;right:0;bottom:4px;height:16px}
#vergabe-root .vgdzelle{position:absolute;top:0;bottom:0;background:#4E6117;color:#FFFFFF;font-size:10px;line-height:16px;text-align:center;border-right:1px solid #FAFAF9;box-sizing:border-box;overflow:hidden}
#vergabe-root .vgheute{position:absolute;top:0;bottom:0;width:0;border-left:1.5px solid #C2410C;opacity:.55;pointer-events:none}
#vergabe-root .vgbalken{position:absolute;top:50%;height:14px;transform:translateY(-50%);border-radius:4px;cursor:pointer;background:var(--f);opacity:.42;border:1px solid var(--f);box-sizing:border-box;mix-blend-mode:multiply}
#vergabe-root .vgbalken.klein{height:12px;opacity:.75}
#vergabe-root .vgbalken.frei{background:repeating-linear-gradient(135deg,transparent 0 3px,rgba(255,255,255,.6) 3px 6px),var(--f);border-style:dashed}
#vergabe-root .vgbalken:hover{opacity:1}
#vergabe-root .vgraute{position:absolute;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;background:#1C1C1A;transform:rotate(45deg);border:2px solid #FFFFFF;box-shadow:0 0 0 1px var(--f);pointer-events:auto}
#vergabe-root .vgraute.abgeleitet{background:#FFFFFF;border:2px solid #B45309;box-shadow:none}
#vergabe-root .vgrzahl{position:absolute;left:10px;top:-12px;transform:rotate(-45deg);font-size:10px;font-weight:600;color:#1C1C1A;background:#FFFFFF;border-radius:6px;padding:0 3px}
#vergabe-root .vglegende{display:flex;flex-wrap:wrap;gap:16px;align-items:center;font-size:12px;color:#55554F;padding:8px 2px}
#vergabe-root .vglegende span{display:inline-flex;align-items:center;gap:6px}
#vergabe-root .vglg{display:inline-block;width:22px;height:10px;border-radius:3px;background:#8A8A83;opacity:.6}
#vergabe-root .vglg.leer{background:transparent;border:1px dashed #55554F}
#vergabe-root .vglg.raute{width:9px;height:9px;border-radius:0;background:#1C1C1A;transform:rotate(45deg);opacity:1}
#vergabe-root .vglg.raute.hohl{background:#FFFFFF;border:2px solid #B45309;box-sizing:border-box}
#vergabe-root .vgklein{font-size:11.5px;color:#8A8A83;line-height:1.45}
#vergabe-root .vglage{margin-top:8px;font-size:12.5px;color:#55554F}
#vergabe-root .vglage summary{cursor:pointer;padding:6px 2px}
#vergabe-root .vgtab{border-collapse:collapse;margin:6px 0 8px;font-size:12px}
#vergabe-root .vgtab th,#vergabe-root .vgtab td{text-align:left;padding:4px 14px 4px 0;border-bottom:1px solid rgba(28,28,26,.07)}
#vergabe-root .vgtab th{font-weight:600;color:#75756E}
#vergabe-root .warn{color:#B45309}
#vergabe-root .vgohne{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
#vergabe-root .vgohnez{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;border:1px solid rgba(28,28,26,.12);font-size:11.5px;color:#55554F;background:#FFFFFF}
#vergabe-root .vgdetail{width:340px;flex:none;overflow-y:auto;border-left:1px solid rgba(28,28,26,.09);padding:8px 18px 24px;background:#FAFAF9}
#vergabe-root .vgdkopf{display:flex;align-items:flex-start;gap:9px;padding:6px 0 12px}
#vergabe-root .vgdkopf .vgpunkt{margin-top:6px}
#vergabe-root .vgdkopf>div{flex:1;min-width:0}
#vergabe-root .vgdtitel{font-size:14.5px;font-weight:600;color:#1C1C1A;line-height:1.35}
#vergabe-root .vgdblock{background:#FFFFFF;border:1px solid rgba(28,28,26,.10);border-radius:10px;padding:10px 12px;margin:0 0 10px}
#vergabe-root .vgdz{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;padding:3px 0;color:#55554F}
#vergabe-root .vgdz b{font-weight:500;color:#1C1C1A;text-align:right}
#vergabe-root .vgdz.stark b{font-weight:600}
#vergabe-root .vgdz.warn b{color:#B45309}
#vergabe-root .vghinweis{font-size:12px;color:#B45309;padding:4px 0}
#vergabe-root .vgdlbl{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#8A8A83;margin-bottom:6px}
#vergabe-root .vgfeld{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#75756E;margin-bottom:8px;flex:1}
#vergabe-root .vgfeldreihe{display:flex;gap:10px}
#vergabe-root .vgin{font:inherit;font-size:13px;padding:7px 9px;border-radius:8px;border:1px solid rgba(28,28,26,.16);background:#FFFFFF;color:#1C1C1A;width:100%;box-sizing:border-box}
#vergabe-root .vgdknoepfe{display:flex;gap:8px;margin-top:4px}
#vergabe-root .vglage a,#vergabe-root .vgquelle a{color:#4E6117;text-decoration:underline;text-underline-offset:2px}
#vergabe-root .vgquelle{font-size:11.5px;color:#8A8A83;margin-top:6px;line-height:1.45}
`));
}
