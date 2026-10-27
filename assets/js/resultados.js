/* Resultados GA4 por campaña y mes · hoja "[Baloto] Fuente de datos", pestaña RESUMEN GENERAL
   Trae registros y compras de GA4 (y los de plataforma, como referencia) agrupados por campaña y
   mes con una consulta de Google Visualization, y los cruza con las nomenclaturas de la hoja de
   seguimiento con la misma clave que usa el cruce de consumo (sin tildes, espacios ni signos).
   Si la hoja no responde usa la copia de data/resultados_baloto.js. */
(function () {
  'use strict';

  const SHEET_ID = '1zEv8npIyHnoaEXKZDRh-vpyo88RU0WmKUgSKwSYzaMU', TAB = 'RESUMEN GENERAL';
  // A Date · B Campaign Name · G Compras · H Registros · P Compras GA4 · Q Registros GA4
  const TQ = "select B, year(A), month(A), sum(P), sum(Q), sum(G), sum(H) where A >= date '2025-01-01' group by B, year(A), month(A)";
  const clave = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const num = v => { const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, '')); return isFinite(n) ? n : 0 };

  // filas [nombre, 'YYYY-MM', compras GA4, registros GA4, compras plataforma, registros plataforma]
  function desdeCsv(txt) {
    const g = Papa.parse(txt).data.slice(1);
    return g.filter(r => r.length >= 7 && r[0]).map(r => {
      const mes = `${r[1]}-${String(num(r[2]) + 1).padStart(2, '0')}`;  // month() de gviz empieza en 0
      return [r[0], mes, num(r[3]), num(r[4]), num(r[5]), num(r[6])];
    });
  }

  async function cargar() {
    try {
      const u = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(TAB)}&headers=1&tq=${encodeURIComponent(TQ)}&_=${Date.now()}`;
      const res = await fetch(u); if (!res.ok) throw new Error(res.status);
      const txt = await res.text(); if (/<html/i.test(txt.slice(0, 200))) throw new Error('sin acceso');
      const filas = desdeCsv(txt); if (!filas.length) throw new Error('vacía');
      return {filas, fuente: 'vivo'};
    } catch (e) {
      const c = window.RESULTADOS_COPIA;
      return {filas: c ? c.filas : [], fuente: c ? 'copia' : 'sin datos', copia: c ? c.fecha : ''};
    }
  }

  // Reparte los resultados de cada campaña entre las filas de la hoja con esa nomenclatura.
  // Si una nomenclatura se repite en el mes, se reparte en proporción al consumo de cada fila.
  function asignar(D, R) {
    D.campanas.forEach(f => { f.reg = 0; f.com = 0; f.regP = 0; f.comP = 0 });
    const porMes = {};
    R.filas.forEach(r => (porMes[r[1]] = porMes[r[1]] || []).push(r));
    const resumen = {};
    D.meses.forEach(mes => {
      const rows = D.campanas.filter(f => f.mes === mes && f.nom !== '(sin nomenclatura)');
      const grupos = {};
      rows.forEach(f => { const k = clave(f.nom); if (k) (grupos[k] = grupos[k] || []).push(f) });
      const keys = Object.keys(grupos);
      const t = {reg: 0, com: 0, regMap: 0, comMap: 0, sinMap: []};
      (porMes[mes] || []).forEach(([nombre, , com, reg, comP, regP]) => {
        if (nombre === '(otros)') return;                         // tráfico que no es de Adcom
        t.reg += reg; t.com += com;
        const k = clave(nombre);
        const hit = grupos[k] ? k : keys.filter(x => x.length > 8 && (k.includes(x) || x.includes(k))).sort((a, b) => b.length - a.length)[0];
        if (!hit) { if (reg || com) t.sinMap.push({nombre, reg, com}); return }
        t.regMap += reg; t.comMap += com;
        const fs = grupos[hit], base = fs.reduce((a, f) => a + f.cons, 0);
        fs.forEach(f => {
          const w = base ? f.cons / base : 1 / fs.length;
          f.reg += reg * w; f.com += com * w; f.regP += regP * w; f.comP += comP * w;
        });
      });
      resumen[mes] = t;
    });
    return resumen;
  }

  window.RES = {cargar, asignar};
})();
