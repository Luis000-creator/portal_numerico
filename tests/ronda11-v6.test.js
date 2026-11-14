'use strict';
// ============================================================================
// Tests de la ronda 11 (13-nov): "Portal Numérico — Correcciones v6" sobre la
// base "Ronda 10" (405b493) + "Ronda 10b" (7cf1230). Cubre:
//   P0-1 halo con max(100vw, 2000px) centrado (el brillo no desaparece al
//       hacer scroll en móvil)
//   P0-2 pastillas de la gráfica de Taylor sujetas al lienzo y separadas
//   P1-3 logo del header: sin cambio (se verifica en un teléfono real)
//   P1-4 visor de Apuntes: la tarjeta se expande a las 2 columnas y la
//       tipografía del Markdown vive en CSS (.visor-documento)
//   Cierre: bump ?v=10 en las 4 páginas
// Ejecutar con:  node --test tests/*.test.js
// ============================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cargarModulos } = require('./helpers/env');

const RAIZ = path.join(__dirname, '..');
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

// Bloques @media (max-width: Npx) con balanceo de llaves (comentarios fuera)
function bloquesMediaMax(css) {
    const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const salida = [];
    const re = /@media\s*\(max-width:\s*([\d.]+)px\)\s*\{/g;
    let m;
    while ((m = re.exec(limpio))) {
        let i = re.lastIndex;
        let nivel = 1;
        while (i < limpio.length && nivel > 0) {
            if (limpio[i] === '{') nivel += 1;
            else if (limpio[i] === '}') nivel -= 1;
            i += 1;
        }
        salida.push({ ancho: Number(m[1]), cuerpo: limpio.slice(re.lastIndex, i - 1) });
    }
    return salida;
}

// Canvas falso que registra texto (fillText) y pastillas (fillRect). El ancho
// depende de #grafica-container: si sigue oculto devuelve 0, igual que en el
// navegador, de modo que la prueba también comprueba que se mide ya visible.
function lienzoFalso(env, ancho) {
    const eventos = [];
    const ctx2d = new Proxy({}, {
        get(t, k) {
            if (k === 'measureText') return (txt) => ({ width: String(txt).length * 6 });
            if (k === 'fillText') return (txt, x, y) => eventos.push({ tipo: 'texto', txt, x, y });
            if (k === 'fillRect') return (x, y, w, h) => eventos.push({ tipo: 'rect', x, y, w, h });
            return () => { eventos.push({ tipo: String(k) }); };
        },
        set() { return true; },
    });
    const cont = env.el('grafica-container');
    cont.style.display = 'none';
    const canvas = env.el('grafica');
    Object.defineProperty(canvas, 'clientWidth', {
        configurable: true,
        get() { return cont.style.display === 'none' ? 0 : ancho; },
    });
    canvas.getContext = () => ctx2d;
    return { canvas, cont, eventos };
}

// Chip (rect) inmediatamente anterior a la etiqueta pedida
function chipDe(eventos, prefijo) {
    // fillText recibe números en las marcas del eje: se pasa a string
    const i = eventos.findIndex((e) => e.tipo === 'texto' && String(e.txt).startsWith(prefijo));
    assert.ok(i > -1, `falta la etiqueta "${prefijo}…" en la gráfica`);
    for (let j = i - 1; j >= 0; j--) {
        if (eventos[j].tipo === 'rect') return { rect: eventos[j], texto: eventos[i] };
    }
    assert.fail(`sin pastilla detrás de "${eventos[i].txt}"`);
}

// --- P0-1 ------------------------------------------------------------------

test('P0-1: el halo mide max(100vw, 2000px) centrado (no desaparece al scrollear en móvil)', () => {
    const css = leer('css', 'styles.css');
    const halo = /\.main-container::before \{[\s\S]*?\}/.exec(css)[0];
    assert.ok(halo, 'falta .main-container::before');

    // La regla que sustituyó al 100vw puro de la v5
    assert.match(halo, /width: max\(100vw, 2000px\)/,
        'sin 2000px de mínimo, en móvil la elipse mide 390px y su color fuerte queda detrás de las tarjetas: el brillo solo se ve arriba y al bajar la página los laterales quedan en negro');
    assert.match(halo, /left: 50%/);
    assert.match(halo, /transform: translateX\(-50%\)/);
    assert.ok(!/width: 100vw;/.test(halo), 'volvió el 100vw puro de la v5');
    assert.ok(!/transform: none/.test(halo), 'falta el centrado');

    // Sigue atado a la ventana, con su gradiente de 3 paradas por sección
    assert.match(halo, /position: fixed;/);
    assert.match(halo, /height: 100vh/);
    assert.match(halo, /radial-gradient\(ellipse at center/);
    assert.match(halo, /z-index: -1/);

    // Y el halo no se salta a la zona de scroll (sigue siendo fixed)
    assert.ok(!/position: absolute/.test(halo));
});

// --- P0-2 ------------------------------------------------------------------

test('P0-2: las pastillas de Taylor se sujetan al lienzo y no se pisan', () => {
    // 1) Estático. Las pastillas de Taylor entran por opts.marcas →
    //    grafMarcarPunto (NO por el bloque de puntos dispersos: taylor.js
    //    solo pasa marcas), así que el sujete hay que arreglarlo en los dos
    //    sitios.
    const js = leer('js', 'graficadora.js');

    const iMarcar = js.indexOf('function grafMarcarPunto');
    assert.ok(iMarcar > -1, 'falta grafMarcarPunto');
    const marcar = js.slice(iMarcar, js.indexOf('\n}', iMarcar));
    assert.ok(!/w - 96/.test(marcar),
        'el sujete de 96px fijo deja el chip de Taylor (148px) fuera del lienzo');
    assert.match(marcar, /const ancho = etiqueta\.length \* 7 \+ 8;/,
        'el sujete debe usar el ancho real del chip');
    assert.match(marcar, /const lx = Math\.min\(X\(px\) \+ 10, Math\.max\(w - ancho, 4\)\)/);

    // Y el bloque de puntos dispersos, que tenía el mismo problema
    const ini = js.indexOf('// --- Puntos dispersos');
    assert.ok(ini > -1, 'falta el bloque de puntos dispersos');
    const fin = js.indexOf('// --- Raíz aproximada', ini);
    const bloque = js.slice(ini, fin);
    assert.match(bloque, /const lx = Math\.min\(X\(pt\.x\) \+ 7, Math\.max\(w - ancho - 3, 4\)\)/,
        'lx va sin sujetar al ancho: a 390px la pastilla sale del gráfico y se cortan los últimos dígitos');
    assert.match(bloque, /const ancho = pt\.etiqueta\.length \* 6 \+ 6;/);
    assert.match(bloque, /chipsDispersos/, 'falta la lista de chips ya dibujados');
    assert.match(bloque, /if \(chocaX && chocaY\) ly = c\.ly \+ 14;/,
        'sin separación vertical las dos pastillas de Taylor (2.718 y 2.667) salen pegadas');

    // 2) Funcional: Taylor exp(x) con a=0, x=1, N=3 a 390px de ancho real
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js', 'js/taylor.js', 'js/graficadora.js']);
    const { canvas, eventos } = lienzoFalso(env, 350);
    env.el('metodo-selector').value = 'taylor';
    env.ctx.alternarMetodoUI();
    env.el('funcion-taylor').value = 'exp(x)';
    env.el('a-taylor').value = '0';
    env.el('x-taylor').value = '1';
    env.el('n-taylor').value = '3';
    env.ctx.calcularTaylor();

    assert.equal(canvas.width, 350, 'el lienzo se midió con el contenedor oculto');
    const w = 350;

    const f = chipDe(eventos, 'f(x) = ');
    const p3 = chipDe(eventos, 'P3(x) = ');

    // Dentro del lienzo, con el borde derecho visible
    for (const { rect, texto } of [f, p3]) {
        assert.ok(rect.x >= 0 && rect.x + rect.w <= w,
            `pastilla "${texto.txt}" fuera del lienzo (x=${rect.x}, ancho=${rect.w}, w=${w})`);
        assert.ok(texto.x >= 0 && texto.x <= w,
            `texto "${texto.txt}" fuera del lienzo (x=${texto.x})`);
        assert.ok(rect.x + rect.w <= w - 2,
            `la pastilla "${texto.txt}" queda pegada al borde derecho (termina en ${rect.x + rect.w})`);
    }

    // Separadas: el chip mide 13px de alto (grafChipEtiqueta)
    const dy = Math.abs(f.rect.y - p3.rect.y);
    assert.ok(dy >= 13, `las dos pastillas se pisan (dy=${dy}px, hacen falta ≥13)`);
});

// --- P1-3 ------------------------------------------------------------------

test('P1-3: el logo del header sigue con el mismo degradado que el landing', () => {
    // Sin cambio de código: en PC coincide con el landing y en el móvil solo
    // se confirma mirando la "A" de ITERA en un teléfono real (lectura del
    // texto pequeño). Aquí se blindajea que nadie lo reescriba a un degradado
    // distinto ni que un media query lo toque.
    const css = leer('css', 'styles.css');
    const grad = (sel) => [...css.matchAll(new RegExp(sel + ' \\{[^}]*\\}', 'g'))]
        .map((m) => m[0])
        .find((r) => r.includes('linear-gradient'));
    const logo = grad('.logo-title');
    assert.ok(logo, 'falta .logo-title con degradado');
    assert.equal(grad('.logo-title').match(/linear-gradient\([^)]*\)/)[0],
        grad('.landing-title').match(/linear-gradient\([^)]*\)/)[0],
        'el logo y el landing ya no comparten degradado');
    for (const b of bloquesMediaMax(css)) {
        assert.ok(!/\.logo-title[^{]*\{[^}]*linear-gradient/.test(b.cuerpo),
            'un media query reescribe el degradado del logo');
        assert.ok(!/\.logo-title[^{]*\{[^}]*background(-color)?:\s*(#|rgb|var\(--(?!accent-cyan))/i.test(b.cuerpo),
            'un media query cambia el color de fondo del logo');
    }
});

// --- P1-4 ------------------------------------------------------------------

test('P1-4: el visor de Apuntes se expande a las 2 columnas', () => {
    const css = leer('css', 'styles.css');

    // La tarjeta abierta ocupa las 2 columnas del grid de Apuntes
    assert.match(css, /\.apunte-card\.visor-abierto \{\s*grid-column: 1 \/ -1;/,
        'en media columna el documento queda apretado y el texto se ve diminuto');
    // El grid de 2 columnas sigue ahí (sin él la clase no haría nada en PC)
    assert.match(css, /@media \(min-width: 768px\) \{\s*#apuntes-remotos \{\s*display: grid;\s*grid-template-columns: repeat\(2, 1fr\)/);

    const js = leer('js', 'apuntes.js');
    assert.ok(js.includes("card.classList.add('visor-abierto')"), 'al abrir no se expande la tarjeta');
    assert.ok(js.includes("card.classList.remove('visor-abierto')"), 'al cerrar no vuelve a 1 columna');
    assert.match(js, /card\.scrollIntoView\(\{ behavior: 'smooth', block: 'nearest' \}\)/,
        'sin scrollIntoView el documento abierto puede quedar fuera de vista');
    // El toggle sigue con innerHTML: textContent borraría el glifo del ojo
    assert.match(js, /btnVer\.innerHTML = '<i class="fa-regular fa-eye"/);
    assert.ok(!/btnVer\.textContent\s*=/.test(js), 'textContent en el botón borraría el icono');
    // La propuesta traía un border-color: ... !important que no hace falta:
    // la clase es más específica que .apunte-card:hover y ya gana sola.
    const abierto = /\.apunte-card\.visor-abierto \{[^}]*\}/.exec(css)[0];
    assert.ok(abierto, 'falta la regla .apunte-card.visor-abierto');
    assert.ok(!/!important/.test(abierto), 'no hace falta !important en el borde');
});

test('P1-4: la tipografía del visor vive en CSS (.visor-documento), no en línea', () => {
    const css = leer('css', 'styles.css');
    const regla = /\.visor-documento \{[^}]*\}/.exec(css)[0];
    assert.ok(regla, 'falta la clase .visor-documento');
    assert.match(regla, /font-size: 1rem/);
    assert.match(regla, /line-height: 1\.7/);
    assert.match(regla, /padding: 28px 32px/);
    assert.match(regla, /max-height: 75vh/);
    assert.ok(!/!important/.test(regla), 'sin !important (lo pidió el equipo)');

    // .apunte-card p pinta los párrafos a 0.85rem: sin redeclararlo aquí el
    // Markdown seguiría saliendo en letra pequeña aunque el contenedor pida 1rem
    assert.match(css, /\.visor-documento p,\s*\.visor-documento li \{\s*font-size: 1rem;/,
        'los párrafos se quedan en 0.85rem por .apunte-card p');
    assert.match(css, /\.visor-documento p,[\s\S]*?max-width: 75ch;/,
        'sin 75ch las líneas se estiran hasta el borde del visor');

    // Encabezados en cian (los pinta .apunte-card h3/h4 en blanco)
    assert.match(css, /\.visor-documento h1,[\s\S]*?color: var\(--accent-cyan\)/);

    // En móvil el padding baja a 20px 16px
    assert.match(css, /@media \(max-width: 768px\) \{[\s\S]*?\.visor-documento \{\s*padding: 20px 16px;/);

    // Los estilos en línea ya no están en el JS
    const js = leer('js', 'apuntes.js');
    assert.ok(js.includes("visor.className = 'visor-documento'"), 'el visor no usa la clase');
    assert.ok(!js.includes('max-height: 600px'), 'siguen los estilos en línea del visor');
    assert.ok(!js.includes('font-size: 0.9rem'), 'sigue el font-size en línea (0.9rem)');
    assert.ok(!/visor\.style\.cssText/.test(js), 'sigue el cssText completo del visor');

    // El PDF: 70vh en PC y 60vh en móvil (los 500px/350px fijos recortaban).
    // Sin comentarios, para que un comentario entre { y height no tape la regla.
    const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.match(limpio, /object\.visor-pdf \{\s*width: 100%;\s*height: 70vh;/);
    assert.match(limpio, /object\.visor-pdf \{\s*height: 60vh;/);
    assert.ok(!/object\.visor-pdf \{[^}]*500px/.test(limpio), 'quedó el alto fijo de 500px');
    assert.ok(!/object\.visor-pdf \{[^}]*350px/.test(limpio), 'quedó el alto fijo de 350px');
});

// --- Cierre ----------------------------------------------------------------

test('Cierre: las 4 páginas piden styles.css?v=10', () => {
    const paginas = ['index.html', 'pages/calculadora.html', 'pages/apuntes.html', 'pages/social.html'];
    for (const archivo of paginas) {
        const html = leer(archivo);
        assert.ok(/href="[^"]*styles\.css\?v=10"/.test(html), `${archivo} no tiene ?v=10`);
        assert.ok(!/styles\.css\?v=9/.test(html), `${archivo} sigue en ?v=9`);
    }
});
