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
  gewerk: '', fremde: false, erledigte: false, nurOffen: false, detail: null };
const VG_TAGE = 14, VG_VORLAUF = 4; // Beispiel aus der Besprechung (Baumeister-LV), je Einheit änderbar

async function ladeVergabe() {
  vgStil();
  const root = document.getElementById('vergabe-root');
  if (!root) return;
  if (!VG.d) root.replaceChildren(el('div', { class: 'vgleer' }, 'Lade Vergabeterminpläne…'));
  try {
    const d = await restRpc('assistant_vergabe_uebersicht', {});
    if (d?.fehler) { VG.fehler = d.fehler; VG.d = null; }
    else { for (const e of d.einheiten || []) vgLesefassung(e); VG.d = d; VG.fehler = null; }
  } catch (e) { VG.fehler = 'Die Vergabeübersicht ist gerade nicht erreichbar (' + e.message + ').'; }
  renderVergabe();
}

const vgTag = (s) => s ? new Date(s + 'T00:00:00') : null;
const vgPlus = (d, n) => new Date(d.getTime() + n * 86400000);
const vgFmt = (d) => d ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '–';
const vgEuro = (n) => n == null ? '' : n >= 1e6 ? (n / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mio €'
  : Math.round(n / 1000).toLocaleString('de-DE') + ' T€';
const vgKurzProjekt = (p) => String(p).replace(/^\d+\s*-\s*/, '').replace(/^\d{4}\s+/, '');

// Massgeblicher Termin: die Lesefassung laut Plan. Liegt sie mehr als 90 Tage vor der Veroeffentlichung,
// ist die Zelle offensichtlich veraltet (Wenzenbach 29.09.2026: Lesefassung 2025, Veroeffentlichung 2026).
// Dann gilt die Regel des Plans selbst — „Lesefassung 10 KT vor Versendung" — und der Termin ist als
// abgeleitet markiert (hohle Raute, Hinweis im Detail).
function vgLesefassung(e) {
  e.lf = e.lesefassung; e.lf_abgeleitet = false;
  if (e.lesefassung && e.veroeffentlichung && (vgTag(e.veroeffentlichung) - vgTag(e.lesefassung)) / 86400000 > 90) {
    e.lf = vgPlus(vgTag(e.veroeffentlichung), -10).toLocaleDateString('sv-SE');
    e.lf_abgeleitet = true;
  }
}

// Bearbeitungsfenster einer Einheit: [Lesefassung − Bearbeitung − Vorlauf, Lesefassung]
function vgFenster(e) {
  const ende = vgTag(e.lf);
  if (!ende) return null;
  const tage = e.bearbeitung_tage || VG_TAGE, vor = e.vorlauf_tage ?? VG_VORLAUF;
  return { vorlauf: vgPlus(ende, -(tage + vor)), start: vgPlus(ende, -tage), ende };
}

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
  const von = vgPlus(heute, -14);
  const bis = new Date(heute.getFullYear(), heute.getMonth() + VG.monate, heute.getDate());
  const tageGesamt = Math.round((bis - von) / 86400000);
  const pct = (d) => Math.max(0, Math.min(100, (d - von) / 86400000 / tageGesamt * 100));

  const basis = vgEinheiten();
  const imFenster = basis.filter((e) => { const f = vgFenster(e); return f && f.ende >= von && f.vorlauf <= bis; });
  const ohneTermin = basis.filter((e) => !e.lf && !e.erledigt);

  // ---- Werkzeugleiste ----
  const leiste = el('div', { class: 'vgleiste' });
  const seg = (werte, aktiv, setze) => {
    const s = el('div', { class: 'vgseg' });
    for (const [k, t] of werte) s.append(el('button', { class: aktiv === k ? 'an' : '', onclick: () => { setze(k); renderVergabe(); } }, t));
    return s;
  };
  leiste.append(seg([['projekt', 'Projekte'], ['gewerk', 'Gewerke'], ['person', 'Mitarbeiter']], VG.sicht,
    (k) => { VG.sicht = k; VG.offen.clear(); }));
  leiste.append(seg([[3, '3 Monate'], [6, '6 Monate'], [12, '12 Monate']], VG.monate, (k) => { VG.monate = k; }));
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

  // Projektfilter als Chips
  const projekte = [...new Set((VG.d.einheiten || []).map((e) => e.projekt))].sort();
  const chips = el('div', { class: 'vgchips' });
  for (const p of projekte) {
    const an = !VG.projekte || VG.projekte.has(p);
    chips.append(el('button', { class: 'vgchip' + (an ? ' an' : ''), title: an ? 'Ausblenden' : 'Einblenden', onclick: () => {
      const s = VG.projekte ? new Set(VG.projekte) : new Set(projekte);
      s.has(p) ? s.delete(p) : s.add(p);
      VG.projekte = s.size === projekte.length ? null : s;
      renderVergabe();
    } }, el('span', { class: 'vgpunkt', style: 'background:' + projDot(p) }), vgKurzProjekt(p)));
  }

  // ---- Zeitachse ----
  const achse = el('div', { class: 'vgachse' });
  for (let m = new Date(von.getFullYear(), von.getMonth() + 1, 1); m < bis; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    achse.append(el('div', { class: 'vgmonat', style: `left:${pct(m)}%` },
      m.toLocaleDateString('de-DE', { month: 'short', year: m.getMonth() === 0 ? '2-digit' : undefined })));
  }
  const heuteLinie = () => el('div', { class: 'vgheute', style: `left:${pct(heute)}%` });

  // Dichte je Woche: wie viele Einheiten sind gleichzeitig in Bearbeitung („wo zwickt es")
  const wochen = Math.ceil(tageGesamt / 7);
  const dichte = Array(wochen).fill(0);
  for (const e of imFenster) {
    const f = vgFenster(e);
    for (let w = 0; w < wochen; w++) {
      const a = vgPlus(von, w * 7), b = vgPlus(a, 7);
      if (f.vorlauf < b && f.ende >= a) dichte[w]++;
    }
  }
  const maxD = Math.max(1, ...dichte);
  const dichteBand = el('div', { class: 'vgdichte' });
  dichte.forEach((n, w) => dichteBand.append(el('div', {
    class: 'vgdzelle', title: `KW ab ${vgFmt(vgPlus(von, w * 7))}: ${n} Einheit${n === 1 ? '' : 'en'} in Bearbeitung`,
    style: `left:${pct(vgPlus(von, w * 7))}%;width:${100 / wochen}%;opacity:${n ? 0.12 + 0.88 * n / maxD : 0}` }, n ? String(n) : '')));

  // ---- Gruppen ----
  const gruppeVon = (e) => VG.sicht === 'projekt' ? e.projekt : VG.sicht === 'gewerk' ? e.gewerk : (e.person || 'Nicht zugeordnet');
  const gruppen = new Map();
  for (const e of imFenster) { const g = gruppeVon(e); if (!gruppen.has(g)) gruppen.set(g, []); gruppen.get(g).push(e); }
  const reihe = [...gruppen.entries()].sort((a, b) => {
    if (VG.sicht === 'person') { if (a[0] === 'Nicht zugeordnet') return 1; if (b[0] === 'Nicht zugeordnet') return -1; }
    return Math.min(...a[1].map((e) => vgFenster(e).vorlauf)) - Math.min(...b[1].map((e) => vgFenster(e).vorlauf));
  });

  const farbe = (e) => projDot(e.projekt);
  const balken = (e, klein) => {
    const f = vgFenster(e);
    const b = el('div', {
      class: 'vgbalken' + (e.person ? ' zu' : ' frei') + (klein ? ' klein' : ''),
      style: `left:${pct(f.vorlauf)}%;width:${Math.max(0.4, pct(f.ende) - pct(f.vorlauf))}%;--f:${farbe(e)};`
        + `--v:${(pct(f.start) - pct(f.vorlauf)) / Math.max(0.01, pct(f.ende) - pct(f.vorlauf)) * 100}%`,
      title: `${e.gewerk} · ${vgKurzProjekt(e.projekt)}\nLesefassung ${vgFmt(f.ende)}${e.person ? '\nbei ' + e.person : '\nnoch nicht zugeordnet'}`,
      onclick: (ev) => { ev.stopPropagation(); VG.detail = e.schluessel; renderVergabe(); },
    });
    return b;
  };
  // Meilensteine: gleiche Lesefassung im selben Projekt = EIN gemeinsamer Meilenstein (Beschluss 12)
  const meilensteine = (liste) => {
    const m = new Map();
    for (const e of liste) { const k = e.projekt + '|' + e.lf; m.set(k, [...(m.get(k) || []), e]); }
    return [...m.values()].map((l) => el('div', { class: 'vgraute' + (l.every((e) => e.lf_abgeleitet) ? ' abgeleitet' : ''), style: `left:${pct(vgTag(l[0].lf))}%;--f:${farbe(l[0])}`,
      title: `Lesefassung beim Bauherrn ${vgFmt(vgTag(l[0].lf))}${l[0].lf_abgeleitet ? ' (abgeleitet: 10 KT vor Veröffentlichung)' : ''} · ${vgKurzProjekt(l[0].projekt)}\n` + l.map((e) => '· ' + e.leistungsbereich).join('\n') },
    l.length > 1 ? el('span', { class: 'vgrzahl' }, String(l.length)) : null));
  };

  const plan = el('div', { class: 'vgplan' });
  plan.append(el('div', { class: 'vgzeile vgkopfzeile' }, el('div', { class: 'vglabel' }, 'Auslastung je Woche'),
    el('div', { class: 'vgspur' }, achse, dichteBand, heuteLinie())));
  for (const [name, liste] of reihe) {
    const offen = VG.offen.has(name);
    const frei = liste.filter((e) => !e.person).length;
    const kopf = el('div', { class: 'vgzeile vggruppe' + (offen ? ' offen' : ''), onclick: () => {
      offen ? VG.offen.delete(name) : VG.offen.add(name); renderVergabe(); } },
    el('div', { class: 'vglabel' },
      el('span', { class: 'vgpfeil' }, '›'),
      VG.sicht === 'projekt' ? el('span', { class: 'vgpunkt', style: 'background:' + projDot(name) }) : null,
      el('span', { class: 'vgname', title: name }, VG.sicht === 'projekt' ? vgKurzProjekt(name) : name),
      el('span', { class: 'vgzahl', title: frei ? `${frei} noch ohne Mitarbeiter` : 'alle zugeordnet' },
        `${liste.length}${frei ? ' · ' + frei + ' offen' : ''}`)),
    el('div', { class: 'vgspur' }, heuteLinie(), ...liste.map((e) => balken(e, false)), ...meilensteine(liste)));
    plan.append(kopf);
    if (!offen) continue;
    for (const e of [...liste].sort((a, b) => vgFenster(a).ende - vgFenster(b).ende)) {
      const unter = VG.sicht === 'projekt' ? e.gewerk : vgKurzProjekt(e.projekt) + (VG.sicht === 'person' ? ' · ' + e.gewerk : '');
      plan.append(el('div', { class: 'vgzeile vgeinheit' + (VG.detail === e.schluessel ? ' gewaehlt' : ''), onclick: () => { VG.detail = e.schluessel; renderVergabe(); } },
        el('div', { class: 'vglabel' },
          VG.sicht !== 'projekt' ? el('span', { class: 'vgpunkt', style: 'background:' + projDot(e.projekt) }) : null,
          el('span', { class: 'vgname', title: e.leistungsbereich }, unter),
          el('span', { class: 'vgmeta' }, [e.budget_brutto ? vgEuro(e.budget_brutto) : '', e.person ? initialen(e.person) : ''].filter(Boolean).join(' · '))),
        el('div', { class: 'vgspur' }, heuteLinie(), balken(e, true), ...meilensteine([e]))));
    }
  }
  if (!reihe.length) plan.append(el('div', { class: 'vgleer' }, 'Keine Vergabeeinheit mit Lesefassungstermin in diesem Zeitraum und Filter.'));

  // ---- Legende + Datenlage ----
  const legende = el('div', { class: 'vglegende' },
    el('span', {}, el('i', { class: 'vglg voll' }), 'zugeordnet'),
    el('span', {}, el('i', { class: 'vglg leer' }), 'noch offen'),
    el('span', {}, el('i', { class: 'vglg raute' }), 'Lesefassung beim Bauherrn'),
    el('span', {}, el('i', { class: 'vglg raute hohl' }), 'abgeleitet (Planwert veraltet)'),
    el('span', { class: 'vgklein' }, `Balken = geschätzte Bearbeitung ${VG_TAGE} Tage + ${VG_VORLAUF} Tage Vorlauf (Beispiel Baumeister-LV, je Einheit änderbar)`));

  const lage = el('details', { class: 'vglage' });
  lage.append(el('summary', {}, `Datenlage: ${(VG.d.quellen || []).length} Vergabeterminpläne · `
    + `${ohneTermin.length} Einheiten ohne Lesefassungstermin`));
  const tab = el('table', { class: 'vgtab' }, el('tr', {}, el('th', {}, 'Projekt'), el('th', {}, 'Plan'), el('th', {}, 'Stand'),
    el('th', {}, 'GHIW'), el('th', {}, 'ohne Lesefassung')));
  for (const q of VG.d.quellen || []) tab.append(el('tr', {}, el('td', {}, vgKurzProjekt(q.projekt), q.im_board ? '' : el('span', { class: 'vgklein' }, ' (nicht im Board)')),
    el('td', {}, q.url ? el('a', { href: q.url, target: '_blank', rel: 'noopener' }, q.datei) : q.datei),
    el('td', {}, vgFmt(vgTag(q.stand))), el('td', {}, `${q.ghiw} von ${q.gesamt}`),
    el('td', { class: q.ohne_lesefassung ? 'warn' : '' }, String(q.ohne_lesefassung))));
  lage.append(tab, el('div', { class: 'vgklein' }, 'Ohne Lesefassungstermin kann eine Einheit nicht auf der Zeitachse stehen — '
    + 'die Spalte „Versendung LV als Lesefassung an Bauherr" im Vergabeterminplan ausfüllen (Projektleitung).'));
  if (ohneTermin.length) {
    const liste = el('div', { class: 'vgohne' });
    for (const e of ohneTermin.slice(0, 80)) liste.append(el('button', { class: 'vgohnez', onclick: () => { VG.detail = e.schluessel; renderVergabe(); } },
      el('span', { class: 'vgpunkt', style: 'background:' + projDot(e.projekt) }), `${vgKurzProjekt(e.projekt)} · ${e.leistungsbereich}`));
    lage.append(liste);
  }

  const haupt = el('div', { class: 'vghaupt' }, leiste, chips, plan, legende, lage);
  const teile = [haupt];
  const det = VG.detail && (VG.d.einheiten || []).find((e) => e.schluessel === VG.detail);
  if (det) teile.push(vgDetail(det));
  const scroll = root.querySelector('.vghaupt')?.scrollTop || 0;
  root.replaceChildren(...teile);
  haupt.scrollTop = scroll;
}

function vgDetail(e) {
  const f = vgFenster(e);
  const zeile = (k, v, klasse) => v ? el('div', { class: 'vgdz' + (klasse ? ' ' + klasse : '') }, el('span', {}, k), el('b', {}, v)) : null;
  const personen = VG.d.personen || [];
  const liste = el('datalist', { id: 'vg-personen' }, ...personen.map((p) => el('option', { value: p })));
  const pIn = el('input', { class: 'vgin', list: 'vg-personen', placeholder: 'Mitarbeiter wählen oder eintippen', value: e.person || '' });
  const tIn = el('input', { class: 'vgin kurz', type: 'number', min: '1', max: '120', value: String(e.bearbeitung_tage || VG_TAGE) });
  const vIn = el('input', { class: 'vgin kurz', type: 'number', min: '0', max: '60', value: String(e.vorlauf_tage ?? VG_VORLAUF) });
  const speichern = async (entfernen) => {
    const r = await restRpc('assistant_vergabe_zuordnen', { p_schluessel: e.schluessel, p_person: entfernen ? null : pIn.value.trim() || null,
      p_bearbeitung_tage: Number(tIn.value) || null, p_vorlauf_tage: vIn.value === '' ? null : Number(vIn.value), p_entfernen: !!entfernen })
      .catch((err) => ({ fehler: err.message }));
    if (r?.fehler) { uiHinweis(r.fehler); return; }
    await ladeVergabe();
  };
  return el('aside', { class: 'vgdetail' },
    el('div', { class: 'vgdkopf' }, el('span', { class: 'vgpunkt', style: 'background:' + projDot(e.projekt) }),
      el('div', {}, el('div', { class: 'vgdtitel' }, e.leistungsbereich), el('div', { class: 'vgklein' }, vgKurzProjekt(e.projekt) + (e.paket ? ' · Paket ' + e.paket : ''))),
      el('button', { class: 'vgknopf', title: 'Schließen', onclick: () => { VG.detail = null; renderVergabe(); } }, ico('weg'))),
    el('div', { class: 'vgdblock' },
      zeile('Lesefassung beim Bauherrn', e.lf ? vgFmt(vgTag(e.lf)) + (e.lf_abgeleitet ? ' (abgeleitet)' : '') : 'fehlt im Plan', e.lf && !e.lf_abgeleitet ? 'stark' : 'warn'),
      f ? zeile('Bearbeitung (geschätzt)', `${vgFmt(f.start)} – ${vgFmt(f.ende)}, Vorlauf ab ${vgFmt(f.vorlauf)}`) : null,
      e.lf_abgeleitet ? el('div', { class: 'vghinweis' }, `Im Plan steht ${vgFmt(vgTag(e.lesefassung))} — über 90 Tage vor der Veröffentlichung, also veraltet. `
        + 'Angesetzt ist die Regel des Plans: 10 Kalendertage vor der Veröffentlichung. Bitte im Vergabeterminplan nachtragen.') : null,
      zeile('Budget (KB brutto)', e.budget_brutto ? Number(e.budget_brutto).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €' : null),
      zeile('Gewerk', e.gewerk), zeile('Vergabeart', e.vergabeart), zeile('Verantwortlich laut Plan', e.verantwortlich),
      zeile('Bearbeiter laut Plan', e.bearbeiter_plan), zeile('Status laut Plan', e.status)),
    el('div', { class: 'vgdblock' },
      el('div', { class: 'vgdlbl' }, 'Zuordnung'), liste,
      el('label', { class: 'vgfeld' }, 'Mitarbeiter', pIn),
      el('div', { class: 'vgfeldreihe' }, el('label', { class: 'vgfeld' }, 'Bearbeitung (Tage)', tIn), el('label', { class: 'vgfeld' }, 'Vorlauf (Tage)', vIn)),
      el('div', { class: 'vgdknoepfe' }, el('button', { class: 'btn primary', onclick: () => speichern(false) }, 'Speichern'),
        e.person ? el('button', { class: 'btn', onclick: () => speichern(true) }, 'Zuordnung lösen') : null)),
    el('div', { class: 'vgdblock vgklein' },
      zeile('Veröffentlichung', vgFmt(vgTag(e.veroeffentlichung))), zeile('Submission', vgFmt(vgTag(e.submission))),
      zeile('Sitzung', vgFmt(vgTag(e.sitzung))), zeile('Beginn Gewerk', vgFmt(vgTag(e.baubeginn))),
      el('div', { class: 'vgquelle' }, `Einordnung der KI: ${e.ghiw ? 'GHIW schreibt aus' : 'nicht GHIW'} — ${e.ghiw_grund || ''}`),
      el('div', { class: 'vgquelle' }, 'Quelle: ', e.quelle_url ? el('a', { href: e.quelle_url, target: '_blank', rel: 'noopener' }, e.quelle_datei) : e.quelle_datei,
        ` (Stand ${vgFmt(vgTag(e.plan_stand))})`)));
}

let vgStilDa = false;
function vgStil() {
  if (vgStilDa) return; vgStilDa = true;
  document.head.append(el('style', {}, `
#vergabe-root{flex:1;min-height:0;display:flex;gap:0}
#vergabe-root[hidden]{display:none}
#vergabe-root .vghaupt{flex:1;min-width:0;overflow:auto;padding:4px 28px 28px}
#vergabe-root .vgleer{padding:28px;font-size:13.5px;color:#6E6E67}
#vergabe-root .vgleiste{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:6px 0 10px}
#vergabe-root .vgseg{display:inline-flex;background:#E8E8E6;border-radius:8px;padding:2px}
#vergabe-root .vgseg button{padding:5px 11px;border-radius:6px;font-size:12.5px;color:#55554F}
#vergabe-root .vgseg button.an{background:#FFFFFF;color:#1C1C1A;box-shadow:0 1px 2px rgba(28,28,26,.12)}
#vergabe-root .vgsel{font:inherit;font-size:12.5px;padding:5px 8px;border-radius:8px;border:1px solid rgba(28,28,26,.14);background:#FFFFFF}
#vergabe-root .vgcheck{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;color:#55554F;cursor:pointer}
#vergabe-root .vgknopf{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;color:#55554F}
#vergabe-root .vgknopf:hover{background:rgba(28,28,26,.06)}
#vergabe-root .vgchips{display:flex;flex-wrap:wrap;gap:6px;padding:0 0 14px}
#vergabe-root .vgchip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:12px;border:1px solid rgba(28,28,26,.12);color:#8A8A83;background:transparent}
#vergabe-root .vgchip.an{color:#1C1C1A;background:#FFFFFF}
#vergabe-root .vgpunkt{width:8px;height:8px;border-radius:50%;flex:none;display:inline-block}
#vergabe-root .vgplan{background:#FFFFFF;border:1px solid rgba(28,28,26,.10);border-radius:12px;overflow:hidden}
#vergabe-root .vgzeile{display:flex;min-height:34px;border-top:1px solid rgba(28,28,26,.06)}
#vergabe-root .vgkopfzeile{border-top:0;min-height:52px;background:#FAFAF9}
#vergabe-root .vglabel{width:250px;flex:none;display:flex;align-items:center;gap:7px;padding:0 12px;font-size:12.5px;color:#1C1C1A;border-right:1px solid rgba(28,28,26,.06);min-width:0}
#vergabe-root .vgkopfzeile .vglabel{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#8A8A83;align-items:flex-end;padding-bottom:6px}
#vergabe-root .vgname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1}
#vergabe-root .vgzahl,#vergabe-root .vgmeta{font-size:11.5px;color:#8A8A83;white-space:nowrap}
#vergabe-root .vgpfeil{display:inline-block;width:10px;color:#8A8A83;transition:transform .15s ease}
#vergabe-root .vggruppe{cursor:pointer;min-height:40px}
#vergabe-root .vggruppe:hover{background:#FAFAF9}
#vergabe-root .vggruppe .vglabel{font-weight:600}
#vergabe-root .vggruppe.offen .vgpfeil{transform:rotate(90deg)}
#vergabe-root .vgeinheit{cursor:pointer;background:#FCFCFB}
#vergabe-root .vgeinheit .vglabel{padding-left:29px;font-weight:400}
#vergabe-root .vgeinheit:hover,#vergabe-root .vgeinheit.gewaehlt{background:#F3F3F1}
#vergabe-root .vgspur{flex:1;position:relative;min-width:420px}
#vergabe-root .vgachse{position:absolute;inset:0 0 auto 0;height:24px}
#vergabe-root .vgmonat{position:absolute;top:6px;font-size:11px;color:#75756E;padding-left:4px;border-left:1px solid rgba(28,28,26,.15);height:14px;line-height:14px;white-space:nowrap}
#vergabe-root .vgdichte{position:absolute;left:0;right:0;bottom:6px;height:18px}
#vergabe-root .vgdzelle{position:absolute;top:0;bottom:0;background:#4E6117;color:#FFFFFF;font-size:10px;line-height:18px;text-align:center;border-right:1px solid #FAFAF9;box-sizing:border-box}
#vergabe-root .vgheute{position:absolute;top:0;bottom:0;width:0;border-left:1.5px solid #C2410C;opacity:.55;pointer-events:none}
#vergabe-root .vgbalken{position:absolute;top:9px;height:16px;border-radius:4px;cursor:pointer;background:linear-gradient(90deg,transparent 0 var(--v),var(--f) var(--v));opacity:.42;border:1px solid var(--f);box-sizing:border-box;mix-blend-mode:multiply}
#vergabe-root .vggruppe .vgbalken{top:11px}
#vergabe-root .vgbalken.klein{top:10px;height:14px;opacity:.75}
#vergabe-root .vgbalken.frei{background:repeating-linear-gradient(135deg,transparent 0 3px,rgba(255,255,255,.6) 3px 6px),linear-gradient(90deg,transparent 0 var(--v),var(--f) var(--v));border-style:dashed}
#vergabe-root .vgbalken:hover{opacity:1}
#vergabe-root .vgraute{position:absolute;top:50%;width:11px;height:11px;margin:-6px 0 0 -6px;background:#1C1C1A;transform:rotate(45deg);border:2px solid #FFFFFF;box-shadow:0 0 0 1px var(--f);pointer-events:auto}
#vergabe-root .vgraute.abgeleitet{background:#FFFFFF;border:2px solid #B45309;box-shadow:none}
#vergabe-root .vgrzahl{position:absolute;left:10px;top:-12px;transform:rotate(-45deg);font-size:10px;font-weight:600;color:#1C1C1A;background:#FFFFFF;border-radius:6px;padding:0 3px}
#vergabe-root .vglegende{display:flex;flex-wrap:wrap;gap:16px;align-items:center;font-size:12px;color:#55554F;padding:12px 2px}
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
