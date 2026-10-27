/* Seguimientos de presupuesto · motor compartido
   Lee una pestaña de la hoja de seguimiento, la normaliza en campañas por mes y calcula
   esperado, pacing y alertas. Lo usan index.html y cada seguimiento-<cuenta>.html.

   Cada pestaña tiene un bloque por mes: un título (OCTUBRE, abril, enero 2026...), una fila de
   encabezados con Nomenclatura y Estado, y las campañas. Los bloques sin mes en el título
   (Top Feed, CRM, Branding...) pertenecen al mes anterior. */
(function () {
  'use strict';

  const SHEET_ID = '1VhrT6JiqnJGDxiZ6Qsz4zR4ejXrSf2Ugq9Y8eTUcx94';
  const MESES_L = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const MES_N = {ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6, JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12};
  const ESTADOS = ['Activado', 'Pendiente', 'Detenido', 'Finalizado'];
  const ETAPAS = ['AWARENESS', 'CONSIDERATION', 'ACQUISITION', 'ACTIVATION', 'CONVERSION', 'RETENTION', 'OTRA'];
  const ET_LBL = {AWARENESS: 'Awareness', CONSIDERATION: 'Consideración', ACQUISITION: 'Adquisición', ACTIVATION: 'Activación', CONVERSION: 'Conversión', RETENTION: 'Retención', OTRA: 'Sin etapa'};
  // medios que tienen API en el repo; X, programática y otros solo existen en la hoja
  const MEDIOS_API = {Meta: 'meta', Google: 'google', TikTok: 'tiktok'};

  const norm = s => String(s || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function marcaBaloto(s) {
    const n = norm(s);
    if (/COLOR/.test(n) && /MILOTO/.test(n)) return 'Miloto y Colorloto';
    if (/COLOR/.test(n)) return 'Colorloto';
    if (/MILOTO/.test(n)) return 'Miloto';
    if (/TRILOTO/.test(n)) return 'Triloto';
    if (/GENERAL/.test(n)) return 'General';
    return 'Baloto';
  }
  const titulo = s => { const t = String(s || '').trim().toLowerCase(); return t ? t[0].toUpperCase() + t.slice(1) : '' };

  // Particularidades de cada pestaña. mesPor: 'titulo' usa el mes del título del bloque;
  // 'fechas' usa el mes en que inician sus campañas (UPB reutiliza bloques sin renombrarlos).
  const CUENTAS = {
    baloto: {
      nombre: 'Baloto', sub: 'Baloto, Miloto y Colorloto', gid: '1156637178', moneda: 'COP', mesPor: 'titulo',
      dim: {label: 'Marca', col: 'INICIATIVA', fn: (v, r) => marcaBaloto(v || r[0])},
      bloque: t => { const n = norm(t); return n === 'TOP FEED' ? 'Top Feed' : /INFLUENCER|CRUCERO/.test(n) ? 'Influencers' : 'CRM' },
      hist: 'hoja',
      nota: 'La hoja suma X, programática, Top Feed e influencers, que no están en las APIs; por eso el histórico se toma de la hoja.'
    },
    megaloto: {
      nombre: 'Megaloto', sub: 'Mega Loto Paraguay', gid: '993244039', moneda: 'USD', mesPor: 'titulo',
      dim: null, hist: 'hoja',
      // los bloques de TikTok en COP repiten en pesos las filas de TikTok en USD
      omitir: f => f.ppto >= 100000 || f.cons >= 100000,
      nota: 'Valores en USD. Los bloques de TikTok en COP repiten las filas en USD y no se suman. En las APIs, TikTok se convierte con TRM 3.500 y Meta solo incluye la cuenta Megaloto 4, así que el histórico se toma de la hoja.'
    },
    lasalle: {
      nombre: 'La Salle', sub: 'La Salle Pereira Bilingual School', gid: '1257480593', moneda: 'COP', mesPor: 'titulo',
      dim: null, hist: 'api',
      nota: 'En los meses cerrados la hoja repite el consumo del mes en curso, así que el consumo histórico se toma de Meta y Google Ads.'
    },
    upb: {
      nombre: 'UPB', sub: 'UPB Virtual y Open', gid: '66960802', moneda: 'COP', mesPor: 'fechas',
      dim: {label: 'Cuenta', col: 'CUENTA', fn: v => titulo(v) || 'Sin cuenta'}, hist: 'api',
      nota: 'La pestaña reutiliza bloques sin cambiarles el título, así que el mes se toma de las fechas de las campañas. El consumo histórico viene de Meta y Google Ads porque la hoja no lo guarda al cierre.'
    },
    corpas: {
      nombre: 'Corpas', sub: 'Fundación Universitaria Juan N. Corpas', gid: '1972183735', moneda: 'COP', mesPor: 'titulo',
      dim: {label: 'Modalidad', col: 'MODALIDAD', fn: v => { const n = norm(v); return /PRAGRADO|PREGRADO/.test(n) ? 'Pregrado' : /POSGRADO|MBA/.test(n) ? 'Posgrado' : /BRANDING/.test(n) ? 'Branding' : 'Otra' }},
      hist: 'api',
      nota: 'Los bloques de cohorte (presupuesto semestral) no se suman a los meses. El consumo histórico viene de Meta, Google Ads y TikTok porque la hoja no lo guarda al cierre.'
    }
  };

  // ── Formato ──────────────────────────────────────────────────────────────
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  function fmt(moneda) {
    const usd = moneda === 'USD', sym = usd ? 'US$' : '$';
    const full = n => (n && isFinite(n)) ? (n < 0 ? '−' : '') + sym + Math.abs(Math.round(n)).toLocaleString('es-CO') : '—';
    const corto = n => {
      if (!n || !isFinite(n)) return '—';
      if (usd) return full(n);
      const a = Math.abs(n), s = n < 0 ? '−$' : '$';
      return a >= 1e6 ? s + (a / 1e6).toLocaleString('es-CO', {maximumFractionDigits: 1}) + ' M' : s + Math.round(a / 1e3).toLocaleString('es-CO') + ' mil';
    };
    return {full, corto, eje: v => usd ? sym + Math.round(v).toLocaleString('es-CO') : '$' + v.toLocaleString('es-CO') + ' M', escala: usd ? 1 : 1e6};
  }
  const fP = n => (n === null || n === undefined || !isFinite(n)) ? '—' : (n * 100).toLocaleString('es-CO', {maximumFractionDigits: 0}) + '%';
  const div = (a, b) => b ? a / b : null;
  const pace = p => p === null ? 'p-off' : Math.abs(p - 1) <= .1 ? 'p-pos' : Math.abs(p - 1) <= .25 ? 'p-mid' : 'p-neg';
  const paceCol = p => p === null ? 'var(--gray-200)' : Math.abs(p - 1) <= .1 ? 'var(--c-pos)' : Math.abs(p - 1) <= .25 ? 'var(--c-mid)' : 'var(--c-neg)';
  const mesLbl = m => m ? MESES_L[+m.slice(5, 7)] + ' ' + m.slice(0, 4) : '';
  const mesCorto = m => MESES_L[+m.slice(5, 7)].slice(0, 3) + ' ' + m.slice(2, 4);
  const fDate = s => s ? `${+s.slice(8, 10)}/${+s.slice(5, 7)}` : '';
  const dias = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;
  const finMes = m => { const [y, mm] = m.split('-').map(Number); return new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10) };
  const hoyISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) };

  // Acepta "$1.234.567", " $4.500.000", "$2,182,620", "60,97%" y "1234.5"
  function num(v) {
    let s = String(v ?? '').replace(/[$\s%]|US/g, '');
    if (!s || s[0] === '#') return 0;
    const neg = /^[-−]/.test(s); s = s.replace(/^[-−]/, '');
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');          // 2,182,620
    else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // 1.234.567,8
    else s = s.replace(',', '.');                                                 // 60,97 · 1234.5
    const n = parseFloat(s) || 0;
    return neg ? -n : n;
  }
  function isoD(v) {
    const m = String(v || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
  }
  function medio(s, nom) {
    const n = norm(s), k = norm(nom);
    if (/TIK/.test(n) || /TIKTOK/.test(k)) return 'TikTok';
    if (/^(META|FB|FACEBOOK|FACEEBOOK|INSTAGRAM)/.test(n)) return 'Meta';
    if (/^(GOOGLE|GG|YOUTUBE|SEARCH|PMAX|DEMAND|DGEN)/.test(n)) return 'Google';
    if (/^(PROG|BASIS|CTV)/.test(n)) return 'Programática';
    if (n === 'X' || /TWITTER/.test(n)) return 'X';
    return s ? titulo(s) : 'Otro';
  }
  function etapa(s) {
    const n = norm(s);
    if (/AWA/.test(n)) return 'AWARENESS';
    if (/CONSI/.test(n)) return 'CONSIDERATION';
    if (/ACQ|ADQ/.test(n)) return 'ACQUISITION';
    if (/ACT/.test(n)) return 'ACTIVATION';
    if (/CONV/.test(n)) return 'CONVERSION';
    if (/RET/.test(n)) return 'RETENTION';
    return 'OTRA';
  }
  function mesDeTitulo(t) {
    for (const w of String(t).split(/[^A-Za-zÁÉÍÓÚáéíóú]+/)) if (MES_N[norm(w)]) return MES_N[norm(w)];
    const d = isoD(t); return d ? +d.slice(5, 7) : null;
  }
  const moda = arr => { const c = {}; arr.forEach(x => c[x] = (c[x] || 0) + 1); return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] };

  // ── Lectura ──────────────────────────────────────────────────────────────
  function parse(key, grid) {
    const cfg = CUENTAS[key];
    const g = grid.map(r => r.map(c => String(c ?? '').trim()));
    let corte = '';
    for (const r of g.slice(0, 8)) { for (const c of r) { const d = isoD(c); if (d) { corte = d; break } } if (corte) break }

    const bloques = []; let col = null, cur = null, seccion = null;
    g.forEach((r, ix) => {
      const n = r.map(norm);
      if (n.includes('NOMENCLATURA') && n.includes('ESTADO')) {
        col = {}; n.forEach((k, i) => { if (!(k in col)) col[k] = i });
        let t = '';
        for (let k = 1; k <= 3 && !t; k++) t = (g[ix - k] || []).slice(0, 3).filter(Boolean).join(' ');
        const mes = mesDeTitulo(t);
        cur = {titulo: t, mes, adgroups: n.includes('ADGROUP'), cohorte: /COHO?RTE|SEMESTRE/.test(norm(t)), filas: []};
        if (mes) seccion = cur; else cur.padre = seccion;
        bloques.push(cur); return;
      }
      if (!col || !cur) return;
      const est = r[col.ESTADO];
      if (!ESTADOS.includes(est)) return;
      const pc = col.PRESUPUESTO ?? col['PRESUPUESTO 1'], cc = col.CONSUMO ?? col.CONSUMO1;
      const ppto = num(r[pc]), cons = num(r[cc]);
      if (!ppto && !cons) return;
      const nom = r[col.NOMENCLATURA] || '';
      const f = {est, ppto, cons, nom: nom || '(sin nomenclatura)',
        ini: isoD(r[col['FECHA INICIO']]), fin: isoD(r[col['FECHA FIN']]),
        medio: medio(r[col.MEDIO], nom), etapa: 'ETAPA' in col ? etapa(r[col.ETAPA]) : null,
        dim: cfg.dim ? cfg.dim.fn(r[col[cfg.dim.col]], r) : null,
        programa: 'PROGRAMA' in col ? r[col.PROGRAMA] : ''};
      if (cfg.omitir && cfg.omitir(f)) return;
      cur.filas.push(f);
    });

    // mes de cada bloque, sin adgroups, cohortes ni bloques repetidos
    const vistos = new Set(), out = [];
    bloques.forEach(b => {
      if (b.adgroups || b.cohorte || !b.filas.length) return;
      const firma = b.filas.map(f => f.nom + '|' + f.ppto + '|' + f.cons + '|' + f.ini).join('§');
      if (vistos.has(firma)) return; vistos.add(firma);
      const inis = b.filas.map(f => f.ini).filter(Boolean);
      let mes;
      if (cfg.mesPor === 'fechas' && inis.length) mes = moda(inis.map(d => d.slice(0, 7)));
      else {
        const base = b.mes ? b : b.padre;
        if (!base) return;
        const y = moda(inis.map(d => d.slice(0, 4))) || (base.filas.find(f => f.ini)?.ini || '2026').slice(0, 4);
        mes = `${y}-${String(base.mes).padStart(2, '0')}`;
      }
      const etiqueta = b.mes ? (titulo(b.titulo.replace(/\d{4}|\d{1,2}\/\d{1,2}\/\d{4}/g, '').split(/\s+/).filter(w => !MES_N[norm(w)]).join(' ')) || 'Pauta del mes')
        : (cfg.bloque ? cfg.bloque(b.titulo) : titulo(b.titulo));
      b.filas.forEach(f => { f.mes = mes; f.bloque = etiqueta; out.push(f) });
    });
    return {campanas: out, corte: corte || hoyISO()};
  }

  // Esperado a la fecha de corte, igual que en el seguimiento de Baloto
  function calc(f, corte) {
    const d = f.ini && f.fin ? Math.max(1, dias(f.ini, f.fin)) : 0;
    let t = !d ? 1 : corte < f.ini ? 0 : corte >= f.fin ? d : dias(f.ini, corte);
    if (f.est === 'Finalizado') t = d || 1;
    f.diasTot = d; f.diasTr = t; f.diasRest = Math.max(0, d - t);
    f.esp = d ? f.ppto * t / d : f.ppto;
    f.rem = f.ppto - f.cons;
    f.pc = div(f.cons, f.ppto);
    f.pace = f.esp ? f.cons / f.esp : null;
    f.diario = f.est === 'Activado' && f.diasRest ? Math.max(0, f.rem) / f.diasRest : null;
    return f;
  }
  function suma(rows) {
    const t = {ppto: 0, cons: 0, esp: 0, n: rows.length};
    rows.forEach(f => { t.ppto += f.ppto; t.cons += f.cons; t.esp += f.esp });
    t.rem = t.ppto - t.cons; t.pc = div(t.cons, t.ppto); t.pace = t.esp ? t.cons / t.esp : null;
    return t;
  }

  async function cargar(key) {
    const cfg = CUENTAS[key];
    try {
      const u = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${cfg.gid}&_=${Date.now()}`;
      const res = await fetch(u); if (!res.ok) throw new Error(res.status);
      const txt = await res.text(); if (/<html/i.test(txt.slice(0, 200))) throw new Error('sin acceso');
      return {grid: Papa.parse(txt).data, fuente: 'vivo'};
    } catch (e) {
      const c = (window.HOJA_COPIA || {})[key];
      return {grid: c ? Papa.parse(c.csv).data : [], fuente: 'copia', copia: c ? c.fecha : ''};
    }
  }

  async function leer(key) {
    const {grid, fuente, copia} = await cargar(key);
    const {campanas, corte} = parse(key, grid);
    campanas.forEach(f => calc(f, corte));
    const meses = [...new Set(campanas.map(f => f.mes))].sort();
    return {key, cfg: CUENTAS[key], campanas, corte, meses, fuente, copia, api: apiCuenta(key)};
  }

  // ── Consumo de plataformas (data/consumo_plataformas.js) ─────────────────
  function apiCuenta(key) {
    const d = window.SPEND_DATA, c = d && d.clients && d.clients[key];
    if (!c) return null;
    return {hasta: d.until, generado: d.generated_at, mensual: c.spend || {}, cuentas: c.accounts || [], errores: c.errors || []};
  }
  const apiMes = (api, mes) => {
    const m = api && api.mensual[mes] || {};
    return {total: Object.values(m).reduce((a, b) => a + b, 0), por: m};
  };

  // ── Cruce por campaña: hoja frente a plataforma ──────────────────────────
  // Cada campaña con consumo en la plataforma se busca en las nomenclaturas del mes en la hoja:
  // primero por nombre exacto (sin tildes, espacios ni signos) y luego por contención.
  const clave = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const PLAT_LBL = {meta: 'Meta', google: 'Google', tiktok: 'TikTok'};
  function cruce(D, mes) {
    const camps = (window.SPEND_DATA && window.SPEND_DATA.clients[D.key] && window.SPEND_DATA.clients[D.key].campaigns || {})[mes];
    if (!camps) return null;
    const rows = D.campanas.filter(f => f.mes === mes);
    const grupos = {};
    rows.forEach(f => {
      const k = clave(f.nom); if (!k || f.nom === '(sin nomenclatura)') return;
      const g = grupos[k] = grupos[k] || {nom: f.nom, hoja: 0, plat: 0, filas: 0, campanas: [], medio: f.medio};
      g.hoja += f.cons; g.filas++;
    });
    const keys = Object.keys(grupos), sinMapear = [];
    let total = 0, mapeado = 0;
    camps.forEach(([plat, id, nombre, valor]) => {
      total += valor;
      const k = clave(nombre);
      const hit = grupos[k] ? k : keys.filter(x => x.length > 8 && (k.includes(x) || x.includes(k))).sort((a, b) => b.length - a.length)[0];
      if (hit) { mapeado += valor; grupos[hit].plat += valor; grupos[hit].campanas.push(nombre) }
      else sinMapear.push({plat: PLAT_LBL[plat] || plat, id, nombre, valor});
    });
    const lista = Object.values(grupos).map(g => ({...g, dif: g.hoja - g.plat}));
    return {total, mapeado, sinMap: total - mapeado, pc: div(mapeado, total), sinMapear, grupos: lista,
      sinPlataforma: lista.filter(g => !g.plat && g.hoja > 0)};
  }
  const umbral = moneda => moneda === 'USD' ? 20 : 50000;

  // ── Alertas del mes de corte ─────────────────────────────────────────────
  // sev: 3 crítica · 2 atención · 1 informativa
  function alertas(D) {
    const F = fmt(D.cfg.moneda), mes = D.corte.slice(0, 7), out = [];
    const rows = D.campanas.filter(f => f.mes === mes), T = suma(rows);
    const atraso = dias(D.corte, hoyISO()) - 1;
    if (!rows.length) {
      out.push({sev: 3, tipo: 'Sin presupuesto', txt: `La hoja no tiene bloque de ${mesLbl(mes).toLowerCase()} con campañas.`});
      return {mes, T, lista: out, estado: estado(out)};
    }
    if (D.fuente !== 'vivo') out.push({sev: 2, tipo: 'Hoja sin respuesta', txt: `Se muestra la copia guardada del ${fDate(D.copia)}.`});
    if (atraso >= 3) out.push({sev: 2, tipo: 'Corte atrasado', txt: `La hoja está cortada al ${fDate(D.corte)}: ${atraso} días sin actualizar.`});

    const restan = Math.max(0, dias(D.corte, finMes(mes)) - 1);
    if (T.pace !== null && T.pace > 1.1) {
      out.push({sev: T.pace > 1.25 ? 3 : 2, tipo: 'Sobreconsumo', txt: `Va al ${fP(T.pace)} del ritmo: ${F.corto(T.cons - T.esp)} por encima de lo esperado al ${fDate(D.corte)}.` + (T.rem > 0 && restan ? ` Para cerrar en presupuesto, bajar a ${F.corto(T.rem / restan)} diarios.` : '')});
    } else if (T.pace !== null && T.pace < 0.9) {
      out.push({sev: T.pace < 0.75 ? 3 : 2, tipo: 'Subejecución', txt: `Va al ${fP(T.pace)} del ritmo: faltan ${F.corto(T.esp - T.cons)} frente a lo esperado.` + (restan ? ` Quedan ${F.corto(T.rem)} en ${restan} días (${F.corto(T.rem / restan)} diarios).` : '')});
    }
    if (T.rem < 0) out.push({sev: 3, tipo: 'Presupuesto superado', txt: `El consumo del mes ya pasó el presupuesto en ${F.corto(-T.rem)}.`});

    const pasadas = rows.filter(f => f.ppto > 0 && f.cons > f.ppto * 1.02);
    const exceso = pasadas.reduce((a, f) => a + f.cons - f.ppto, 0);
    // un exceso menor al 2% del presupuesto del mes se avisa, pero no marca la cuenta en rojo
    if (pasadas.length) out.push({sev: exceso > T.ppto * 0.02 ? 3 : 2, tipo: 'Campañas pasadas', txt: `${pasadas.length} ${pasadas.length === 1 ? 'campaña pasó' : 'campañas pasaron'} su presupuesto por ${F.corto(exceso)}.`, campanas: pasadas.map(f => f.nom)});

    const dia = +D.corte.slice(8, 10);
    const pend = rows.filter(f => f.est === 'Pendiente' && f.ppto > 0 && (!f.ini || f.ini <= D.corte));
    if (pend.length && dia >= 5) out.push({sev: 2, tipo: 'Sin iniciar', txt: `${pend.length} ${pend.length === 1 ? 'campaña pendiente' : 'campañas pendientes'} con ${F.corto(pend.reduce((a, f) => a + f.ppto, 0))} que ya debían estar corriendo.`});

    // hoja frente a plataformas, solo en los medios que tienen API
    const am = apiMes(D.api, mes);
    if (am.total > 0) {
      const medios = Object.keys(MEDIOS_API).filter(m => (am.por[MEDIOS_API[m]] || 0) > 0);
      const hoja = rows.filter(f => medios.includes(f.medio)).reduce((a, f) => a + f.cons, 0);
      const plat = medios.reduce((a, m) => a + (am.por[MEDIOS_API[m]] || 0), 0);
      const dif = div(hoja - plat, plat);
      if (dif !== null && Math.abs(dif) > 0.1 && Math.abs(hoja - plat) > (D.cfg.moneda === 'USD' ? 200 : 500000))
        out.push({sev: 2, tipo: 'Hoja vs plataformas', txt: `En ${medios.join(', ')} la hoja registra ${F.corto(hoja)} y las plataformas ${F.corto(plat)} (${dif > 0 ? '+' : ''}${fP(dif)}) al ${fDate(D.api.hasta)}.`});
    }
    // campañas que gastan en la plataforma y no están en la hoja
    const X = cruce(D, mes);
    if (X && X.sinMap > umbral(D.cfg.moneda)) {
      const n = X.sinMapear.length;
      out.push({sev: X.sinMap > X.total * 0.02 ? 3 : 2, tipo: 'Consumo sin mapear',
        txt: `${n} ${n === 1 ? 'campaña gasta' : 'campañas gastan'} en plataforma sin estar en la hoja: ${F.corto(X.sinMap)} (${fP(div(X.sinMap, X.total))} del consumo del mes).`,
        campanas: X.sinMapear.map(c => `${c.plat} · ${c.nombre}`)});
    }
    if (!out.some(a => a.sev >= 2)) out.push({sev: 1, tipo: 'En ritmo', txt: `Consumo al ${fP(T.pace)} de lo esperado al ${fDate(D.corte)}; ${F.corto(T.rem)} por consumir.`});
    out.sort((a, b) => b.sev - a.sev);
    return {mes, T, lista: out, estado: estado(out), cruce: X};
  }
  function estado(lista) {
    const s = Math.max(...lista.map(a => a.sev));
    return s >= 3 ? {cls: 'p-neg', txt: 'Revisar'} : s === 2 ? {cls: 'p-mid', txt: 'Atención'} : {cls: 'p-pos', txt: 'En ritmo'};
  }

  window.SEG = {CUENTAS, ETAPAS, ET_LBL, ESTADOS, MEDIOS_API, esc, fmt, fP, div, pace, paceCol, mesLbl, mesCorto, fDate, dias, finMes, hoyISO, suma, leer, alertas, apiMes, cruce, umbral};
})();
