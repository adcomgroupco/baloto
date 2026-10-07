/* ============================================================================
   Sistema de diseño Adcom · comportamiento
   ----------------------------------------------------------------------------
   FUENTE DE VERDAD: adcom/sistema/adcom.js. Las copias se generan con sync.ps1.

   Dos cosas, y ninguna es decoración:
     1. El único momento de motion del sistema: el dato se dibuja al entrar
        en pantalla. Sin él, las barras de .grow se quedan en scaleX(0).
     2. Los conteos del índice se derivan del DOM, para que no envejezcan
        cuando alguien agrega un documento y olvida subir el número.

   Se carga con `defer`. No depende de nada.
   ========================================================================= */
(function () {
  'use strict';

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- iconos ---
     Un <symbol> por icono, inyectado una sola vez. Todos en un lienzo de 16 y
     con el mismo trazo, así que se pueden mezclar en una misma línea sin que
     uno pese más que otro.

     Añadir uno: un <symbol id="i-nombre" viewBox="0 0 16 16"> con paths sin
     fill y sin stroke-width (los pone .ico desde el CSS). */
  (function iconos() {
    if (document.getElementById('adcom-iconos')) return;

    var ICONOS = {
      'i-abrir':      '<path d="M4.5 11.5 11.5 4.5M6 4.5h5.5V10"/>',
      'i-bajar':      '<path d="M4.5 4.5 11.5 11.5M11.5 6v5.5H6"/>',
      'i-flecha':     '<path d="M3 8h10M9 4l4 4-4 4"/>',
      'i-arriba':     '<path d="M8 13V3M4 7l4-4 4 4"/>',
      'i-abajo':      '<path d="M8 3v10M4 9l4 4 4-4"/>',
      'i-mas':        '<path d="M8 3.5v9M3.5 8h9"/>',
      'i-menos':      '<path d="M3.5 8h9"/>',
      'i-alerta':     '<path d="M8 2.5 14.8 13.8H1.2zM8 6.6v3.1M8 11.9h.01"/>',
      'i-buscar':     '<path d="M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM10.7 10.7 14 14"/>',
      'i-descargar':  '<path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M2.5 13.5h11"/>',
      'i-imprimir':   '<path d="M4.5 6V2.5h7V6M4.5 11.5h-2V6h11v5.5h-2M4.5 9.5h7v4h-7z"/>',
      'i-cerrar':     '<path d="M4 4l8 8M12 4l-8 8"/>',
      'i-filtro':     '<path d="M2.5 4h11M4.5 8h7M6.5 12h3"/>',
      'i-tabla':      '<path d="M2.5 3.5h11v9h-11zM2.5 7h11M6.5 3.5v9"/>',
      // tipo de documento: la ficha del índice usa uno de estos
      'i-grafico':    '<path d="M2.5 13.5h11M5 11.5V7M8 11.5V3M11 11.5V8.5"/>',
      'i-documento':  '<path d="M3.5 2h5.5l3.5 3.5V14h-9zM9 2v3.5h3.5M5.5 8.5h5M5.5 11h3.5"/>',
      'i-tendencia':  '<path d="M2.5 11.5 6 8l2.5 2.5L13.5 4.5M10 4.5h3.5V8"/>',
      'i-ruta':       '<path d="M4 13.5V6a2.5 2.5 0 0 1 5 0v4a2.5 2.5 0 0 0 5 0V2.5M4 3.5h.01M14 13.5h.01"/>',
      'i-reloj':      '<path d="M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8 5v3.2l2.2 1.3"/>',
      'i-pieza':      '<path d="M2.5 3.5h11v9h-11zM2.5 10l3-2.5 2.5 2 3-3 2.5 2.5M10.5 6h.01"/>'
    };

    var partes = [];
    for (var id in ICONOS) {
      if (!Object.prototype.hasOwnProperty.call(ICONOS, id)) continue;
      partes.push('<symbol id="' + id + '" viewBox="0 0 16 16">' + ICONOS[id] + '</symbol>');
    }

    var host = document.createElement('div');
    host.id = 'adcom-iconos';
    host.setAttribute('aria-hidden', 'true');
    // fuera del flujo, sin ocupar espacio y sin que el lector de pantalla lo vea
    host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + partes.join('') + '</svg>';
    document.body.insertBefore(host, document.body.firstChild);

    // Algunos motores no re-resuelven un <use> cuyo destino aparece DESPUÉS de
    // parsear el HTML. Reasignar el href fuerza a reconstruir el árbol de
    // sombra. Los iconos que inyecta el propio JS ya nacen resueltos.
    Array.prototype.forEach.call(document.querySelectorAll('svg.ico > use'), function (u) {
      var h = u.getAttribute('href') || u.getAttribute('xlink:href');
      if (!h) return;
      u.removeAttribute('href');
      u.setAttribute('href', h);
    });
  })();

  /* ---------------------------------------------------------------- motion ---
     El dato se dibuja cuando su figura entra en pantalla. Una sola vez: se
     deja de observar al disparar. Si el navegador no trae IntersectionObserver,
     o el lector pidió menos movimiento, todo aparece ya dibujado. */
  (function motion() {
    var targets = document.querySelectorAll('.grow');
    if (!targets.length) return;

    if (!('IntersectionObserver' in window) || reduce) {
      Array.prototype.forEach.call(targets, function (t) { t.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.25 });

    Array.prototype.forEach.call(targets, function (t) { io.observe(t); });
  })();

  /* ------------------------------------------------------- conteos del índice ---
     Cada enlace de .categorias apunta a un #grupo. El número que muestra es
     cuántas fichas reales hay dentro de ese grupo, contadas aquí.

     El HTML lleva el número escrito a mano de todos modos: si el JS no corre,
     el índice sigue completo. Esto solo evita que envejezca. */
  (function conteos() {
    var nav = document.querySelector('.categorias, .category-nav');
    if (!nav) return;

    Array.prototype.forEach.call(nav.querySelectorAll('a[href^="#"]'), function (link) {
      var slot = link.querySelector('b, span');
      if (!slot) return;

      var grupo;
      try {
        grupo = document.querySelector(link.getAttribute('href'));
      } catch (e) {
        return;                       // href con un id que no es un selector válido
      }
      if (!grupo) return;

      // una ficha cuenta si es un documento de verdad, no un estado vacío
      var fichas = grupo.querySelectorAll('.card:not(.is-empty), .document-card');
      slot.textContent = String(fichas.length);
    });
  })();

  /* ----------------------------------------------------- el riel lateral ---
     Marca .active en el enlace de la sección visible del app-shell, y pone
     su nombre en .app-topbar-section. Sin IntersectionObserver el riel
     sigue siendo una tabla de contenidos que funciona, solo sin resaltar. */
  (function rielLateral() {
    var nav = document.querySelector('.app-sidebar-nav');
    if (!nav || !('IntersectionObserver' in window)) return;

    var enlaces = {};
    Array.prototype.forEach.call(nav.querySelectorAll('a[href^="#"]'), function (link) {
      enlaces[link.getAttribute('href').slice(1)] = link;
    });

    var secciones = [];
    for (var id in enlaces) {
      if (!Object.prototype.hasOwnProperty.call(enlaces, id)) continue;
      var el = document.getElementById(id);
      if (el) secciones.push(el);
    }
    if (!secciones.length) return;

    var rotulo = document.querySelector('.app-topbar-section');

    var io2 = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var link = enlaces[entry.target.id];
        if (!link) return;
        Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) {
          a.classList.toggle('active', a === link);
        });
        if (rotulo) {
          // El texto del enlace, SIN el número de sección: quitarlo por DOM
          // (clonar y borrar el <small>) es a prueba de números decimales
          // como "5.4.1", donde un regex de "dígitos al final" corta mal.
          var copia = link.cloneNode(true);
          var num = copia.querySelector('small');
          if (num) num.remove();
          rotulo.textContent = copia.textContent.trim();
        }
        if (link.scrollIntoView) {
          link.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      });
    }, { rootMargin: '-15% 0px -70% 0px' });

    secciones.forEach(function (s) { io2.observe(s); });
  })();

  /* ------------------------------------------------- categoría en pantalla ---
     Marca en la navegación qué grupo está leyendo. Es orientación, no adorno:
     en un índice de cinco categorías el lector pierde el sitio al hacer scroll.
     Sin IntersectionObserver simplemente no se marca nada. */
  (function actual() {
    var nav = document.querySelector('.categorias, .category-nav');
    if (!nav || !('IntersectionObserver' in window)) return;

    var links = {};
    Array.prototype.forEach.call(nav.querySelectorAll('a[href^="#"]'), function (link) {
      links[link.getAttribute('href').slice(1)] = link;
    });

    var grupos = document.querySelectorAll('.grupo[id], .document-section[id]');
    if (!grupos.length) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = links[entry.target.id];
        if (!link) return;
        if (entry.isIntersecting) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }, { rootMargin: '-88px 0px -70% 0px' });

    Array.prototype.forEach.call(grupos, function (g) { io.observe(g); });
  })();
})();
