'use strict';
// ============================================================================
// Tests de la ronda 10 (13-nov): "Portal Numérico — Correcciones v5" sobre la
// base "Ronda 9" (0cc9edb). Cubre:
//   P0-1 fila CALCULAR+GRAFICAR apilada en ≤768px (no desborda a 390px)
//   P0-2 polinomio de Taylor con coeficientes a 6 cifras significativas
//   P0-3 opción del selector acortada a "Taylor y Maclaurin"
//   P0-4 halo a 100vw (fullscreen sin cortes)
//   P1-5 espacio del criterio después del <br> (textContent "0.001 ó")
//   P1-6 pastilla de la raíz: lienzo medido ya visible + chip a 11px
//   P1-7 etiquetas del eje X sujetas al lienzo y sin solaparse
//   P1-8 logo del header con el mismo degradado que el landing
//   P1-9 borde continuo en degradado en las tarjetas del landing
//   Cierre: bump ?v=9 en las 4 páginas
// Ejecutar con:  node --test tests/*.test.js
// ============================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cargarModulos, salidaDe, correrBiseccion } = require('./helpers/env');

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

function valorTarjeta(resumen, etiqueta) {
    const esc = etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Hasta </span> (no hasta el primer "<"): la fórmula del criterio lleva
    // un <br class="criterio-salto"> en medio.
    const m = new RegExp(
        'resumen-label">' + esc + '</span>\\s*<span class="resumen-value[^"]*">([\\s\\S]*?)</span>'
    ).exec(resumen);
    return m ? m[1] : null;
}

// Canvas falso que registra el texto y las pastillas dibujadas. El ancho
// depende de #grafica-container: mientras siga oculto (como en el HTML)
// devuelve 0, igual que en el navegador. Así se comprueba que se MIDE ya
// visible: con la medición antes de mostrar, w caía al respaldo de 600px.
function lienzoFalso(env, ancho) {
    const eventos = [];
    const ctx2d = new Proxy({}, {
        get(t, k) {
            if (k === 'measureText') return () => ({ width: 10 });
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

function biseccionMovil(env) {
    env.el('metodo-selector').value = 'biseccion';
    env.el('funcion').value = 'x^2 - 4';
    env.el('a').value = '1';
    env.el('b').value = '3';
    env.el('criterio').value = 'tolerancia';
    env.el('valorCriterio').value = '0.001';
    env.ctx.calcularBiseccion();
}

// --- P0-1 ------------------------------------------------------------------

test('P0-1: la fila CALCULAR + GRAFICAR se apila en ≤768px (390px no desborda)', () => {
    const css = leer('css', 'styles.css');

    // La fila base sigue en horizontal, con los dos botones a partes iguales
    const base = /\.form-actions \{[^}]*\}/.exec(css)[0];
    assert.match(base, /display: flex;/, 'la fila sigue siendo flex');
    assert.match(css, /\.form-actions > button \{[^}]*flex: 1;/);
    // El submit no puede encogerse por debajo de su contenido (nowrap +
    // letter-spacing): en 390px eso es exactamente lo que desbordaba.
    assert.match(css, /button\[type="submit"\] \{[^}]*white-space: nowrap;/);

    // En ≤768px (390px entra) los dos botones se apilan a todo el ancho
    const angostos = bloquesMediaMax(css).filter((b) => b.ancho <= 768);
    const conColumna = angostos.find((b) =>
        /\.form-actions\s*\{[^}]*flex-direction: column/.test(b.cuerpo));
    assert.ok(conColumna,
        'falta .form-actions { flex-direction: column } en ≤768px: a 390px GRAFICAR queda fuera de pantalla');

    // Nada en esa regla pueda volver a desbordar
    const regla = /\.form-actions\s*\{([^}]*)\}/.exec(conColumna.cuerpo)[1];
    assert.ok(!/min-width/.test(regla), 'min-width impediría encoger el botón');
    assert.ok(!/flex-wrap:\s*nowrap/.test(regla), 'nowrap mantendría la fila en horizontal');
    assert.ok(!/width:\s*[\d.]+(px|rem|em)/.test(regla), 'un ancho fijo volvería a desbordar');

    // Los dos botones viven dentro de .form-actions (si no, la regla no los cubre)
    const html = leer('pages', 'calculadora.html');
    const fila = /<div class="form-actions">[\s\S]*?<\/div>/.exec(html)[0];
    assert.match(fila, /type="submit"/, 'falta CALCULAR en la fila');
    assert.match(fila, /btn-graficar/, 'falta GRAFICAR en la fila');
});

// --- P0-2 ------------------------------------------------------------------

test('P0-2: taylorPartes formatea los coeficientes a 6 cifras significativas', () => {
    const js = leer('js', 'taylor.js');
    const partes = /function taylorPartes[\s\S]*?\n\}/.exec(js)[0];
    assert.match(partes, /toPrecision\(6\)/, 'el coeficiente debe ir a 6 cifras');
    assert.ok(!partes.includes('numTexto(Math.abs(c))'),
        'sigue numTexto en los coeficientes: 0.166666666667·x³ no cabe a 390px');
    // numTexto sigue formateando el centro a (no es un coeficiente)
    assert.ok(partes.includes('numTexto(a)'), 'el centro a sigue por numTexto');

    // numTexto sigue intacto para el criterio, los intervalos y el resto
    const biseccion = leer('js', 'biseccion.js');
    assert.match(biseccion, /function numTexto[\s\S]*?toPrecision\(12\)/);
});

test('P0-2: el P3 de exp(x) se pinta con 0.166667 y sin 0.166666666667', () => {
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js', 'js/taylor.js']);
    env.el('metodo-selector').value = 'taylor';
    env.ctx.alternarMetodoUI();
    env.el('funcion-taylor').value = 'exp(x)';
    env.el('a-taylor').value = '0';
    env.el('x-taylor').value = '1';
    env.el('n-taylor').value = '3';
    env.ctx.calcularTaylor();
    const r = salidaDe(env);
    assert.equal(r.hayError, false, `no debe fallar: ${r.error}`);

    const expr = r.graficos[0].opts.curvas[0].expr;
    assert.match(expr, /0\.166667/, `falta el coeficiente redondeado: ${expr}`);
    assert.ok(!/0\.166666666667/.test(expr), 'sigue el coeficiente con 12 cifras en la expresión');
    assert.match(r.procedimiento, /0\.166667/, 'el KaTeX debe salir con 6 cifras');
    assert.ok(!/0\.166666666667/.test(r.procedimiento), 'el KaTeX sigue con 12 cifras');
    // Y la aproximación de la tarjeta no pierde precisión (va por numTexto):
    // P3(1) = 1 + 1 + 1/2 + 1/6 con el coeficiente exacto (si el coeficiente
    // fuera 0.166667 la tarjeta daría 2.666667 y fallaría aquí)
    const esperado = 1 + 1 + 1 / 2 + 1 / 6;
    const tarjeta = Number(valorTarjeta(r.resumen, 'Aproximación P3(x)'));
    assert.ok(Math.abs(tarjeta - esperado) < 1e-9,
        `la tarjeta debe conservar la precisión (dio ${tarjeta}, esperado ${esperado})`);
});

// --- P0-3 ------------------------------------------------------------------

test('P0-3: el selector acorta la opción a "Taylor y Maclaurin"', () => {
    const html = leer('pages', 'calculadora.html');
    assert.match(html, /<option value="taylor">Taylor y Maclaurin<\/option>/,
        'el texto largo no cabe antes del chevron a 390px');
    assert.ok(!/<option value="taylor">Series de Taylor/.test(html),
        'sigue el texto largo en el <option>');

    // El título de la sección (H1) sigue con el nombre completo
    const puntoFijo = leer('js', 'punto-fijo.js');
    assert.ok(puntoFijo.includes("titulo: 'Series de Taylor y Maclaurin'"),
        'el H1 debe seguir diciendo el nombre completo');
});

// --- P0-4 ------------------------------------------------------------------

test('P0-4: el halo cubre todo el ancho (100vw, sin centrado fijo)', () => {
    const css = leer('css', 'styles.css');
    const halo = /\.main-container::before \{[\s\S]*?\}/.exec(css)[0];
    assert.match(halo, /width: 100vw/, 'en fullscreen 2000px no llegaba a los laterales');
    assert.match(halo, /left: 0;/);
    assert.match(halo, /transform: none;/);
    assert.ok(!/translateX/.test(halo), 'quedó el centrado que no escala con el viewport');
    assert.ok(!/2000px/.test(halo), 'quedó el ancho fijo');
    assert.match(halo, /height: 100vh/);
    assert.match(halo, /position: fixed;/);
});

// --- P1-5 ------------------------------------------------------------------

test('P1-5: el espacio del criterio va después del <br> (textContent "0.001 ó")', () => {
    const js = leer('js', 'biseccion.js');
    assert.ok(js.includes('}<br class="criterio-salto"> ó |Δx| ≤'),
        'el espacio debe ir DESPUÉS del <br> y antes de la "ó"');
    assert.ok(!js.includes('} <br class="criterio-salto">'),
        'el espacio antes del <br> se pierde al ocultarlo en escritorio');

    const r = correrBiseccion({ expr: 'x^2 - 4', a: 1, b: 3, criterio: 'tolerancia', valor: 0.001 });
    const valor = valorTarjeta(r.resumen, 'Criterio de Paro');
    assert.ok(valor, 'falta la tarjeta Criterio de Paro');
    const texto = valor.replace(/<[^>]*>/g, '');
    assert.equal(texto, '|f(x)| ≤ 0.001 ó |Δx| ≤ 0.001', `textContent: "${texto}"`);
    assert.ok(!/0\.001ó/.test(texto), 'sigue "0.001ó" sin espacio');
});

// --- P1-6 ------------------------------------------------------------------

test('P1-6: el lienzo se mide ya visible y dibuja la pastilla "x ≈ 2"', () => {
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js', 'js/graficadora.js']);
    const { canvas, cont, eventos } = lienzoFalso(env, 350);

    biseccionMovil(env);

    assert.equal(cont.style.display, 'block', 'el contenedor de la gráfica debe mostrarse');
    assert.equal(canvas.width, 350,
        'se midió con el contenedor oculto: w cayó al respaldo de 600px y el bitmap se estiraba (etiquetas ilegibles en móvil)');

    const textos = eventos.filter((e) => e.tipo === 'texto').map((e) => e.txt);
    assert.ok(textos.includes('x ≈ 2'),
        `falta la pastilla de la raíz en la gráfica de Bisección: ${textos.join(' | ')}`);
    // Y la etiqueta va a 11px (grafMarcarPunto), más legible en móvil
    const js = leer('js', 'graficadora.js');
    const marcar = /function grafMarcarPunto\([\s\S]*?\n\}/.exec(js)[0];
    assert.match(marcar, /11px monospace/, 'la pastilla de la raíz debe ir a 11px');
    assert.ok(!/10px monospace/.test(marcar), 'sigue la pastilla a 10px');
    assert.match(marcar, /Y\(py\) - 12/, 'la etiqueta debe separarse más del eje');
});

test('P1-6: se muestra el lienzo ANTES de medir su ancho', () => {
    const js = leer('js', 'graficadora.js');
    const ini = js.indexOf('function graficarResultado');
    assert.ok(ini > -1, 'falta graficarResultado');
    const iLienzo = js.indexOf('// --- Lienzo (con DPR', ini);
    const iMedir = js.indexOf('const w = Math.max(200', ini);
    assert.ok(iLienzo > -1 && iMedir > -1 && iLienzo < iMedir, 'falta el bloque de medición');
    const tramo = js.slice(iLienzo, iMedir);
    assert.match(tramo, /cont\.style\.display = 'block';/, 'el contenedor se muestra al final');
    assert.match(tramo, /canvas\.style\.display = 'block';/, 'el canvas se muestra al final');
    assert.match(tramo, /mostrarSeccionGrafica\(\);/, 'el padre de resultados se re-muestra al final');
});

// --- P1-7 ------------------------------------------------------------------

test('P1-7: las etiquetas del eje X quedan dentro del lienzo y sin solaparse', () => {
    const js = leer('js', 'graficadora.js');
    assert.ok(js.includes('Math.max(w - 1 - ancho, 1)'), 'falta el sujet del chip al borde derecho');
    assert.ok(js.includes('Math.min(Math.max(chipIzq, 1), Math.max(w - 1 - ancho, 1))'),
        'el chip debe recortarse a 1px de cada borde');
    assert.match(js, /const solapa = chipsEjeX\.some/, 'falta el control de solape');
    assert.ok(js.includes('if (solapa) continue;'), 'la etiqueta que choca debe saltarse');
    // El sujete mínimo de la izquierda (v4 P1-1) sigue intacto
    assert.ok(js.includes('Math.max(et.px + 3, 4)'));
});

test('P1-7: a 390px ningún texto ni pastilla sale del lienzo', () => {
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js', 'js/graficadora.js']);
    const { eventos } = lienzoFalso(env, 350);
    biseccionMovil(env);

    const w = 350;
    for (const e of eventos) {
        if (e.tipo === 'texto') {
            assert.ok(e.x >= 0 && e.x <= w, `texto "${e.txt}" fuera del lienzo (x=${e.x})`);
        } else if (e.tipo === 'rect') {
            assert.ok(e.x >= 0 && e.x + e.w <= w,
                `pastilla fuera del lienzo (x=${e.x}, ancho=${e.w})`);
        }
    }
    assert.ok(eventos.some((e) => e.tipo === 'rect'), 'la gráfica debe dibujar pastillas');
});

// --- P1-8 ------------------------------------------------------------------

test('P1-8: el logo del header usa el mismo degradado que el landing', () => {
    const css = leer('css', 'styles.css');
    const conGrad = (selector) => [...css.matchAll(new RegExp(selector + ' \\{[^}]*\\}', 'g'))]
        .map((m) => m[0])
        .find((r) => r.includes('linear-gradient'));

    const logo = conGrad('\\.logo-title');
    const landing = conGrad('\\.landing-title');
    assert.ok(logo, 'falta el degradado en .logo-title');
    assert.ok(landing, 'falta el degradado en .landing-title');

    const grad = (bloque) => /linear-gradient\([^)]*\)/.exec(bloque)[0];
    assert.equal(grad(logo), grad(landing),
        'el ITERA del header debe ser idéntico al del landing');
    assert.equal(grad(logo), 'linear-gradient(135deg, #00f0ff, #bd00ff, #ff007b)');
    assert.match(logo, /background-clip: text/);
    assert.match(logo, /-webkit-text-fill-color: transparent/);
});

// --- P1-9 ------------------------------------------------------------------

test('P1-9: el borde en degradado del landing solo se ve a la izquierda y arriba', () => {
    const css = leer('css', 'styles.css');
    const reglas = [...css.matchAll(/\.card-landing \{[^}]*\}/g)].map((m) => m[0]);
    const borde = reglas.find((r) => r.includes('border: 3px solid transparent'));
    assert.ok(borde, 'falta el borde de 3px transparente (doble fondo)');

    // Tinte por dentro, degradado por debajo del borde: dobla la esquina
    assert.match(borde, /linear-gradient\(160deg, rgba\(255, 255, 255, 0\.045\), rgba\(255, 255, 255, 0\.015\)\) padding-box/);
    assert.match(borde, /linear-gradient\(90deg, #00f0ff, #bd00ff, #ff007b\) border-box/);
    // El radio vive en la otra regla .card-landing (color de texto + radius):
    // sin él el borde en degradado saldría en esquinas rectas
    assert.ok(reglas.some((r) => /border-radius: var\(--radius-lg\)/.test(r)),
        'el borde debe seguir el radio de la tarjeta');

    // Solo izquierda y arriba: sin área de borde a la derecha/abajo, la capa
    // border-box queda tapada por las dos de padding-box y el degradado no
    // recorre la tarjeta por completo
    assert.match(borde, /border-right: 0;/, 'el borde no debe verse a la derecha');
    assert.match(borde, /border-bottom: 0;/, 'el borde no debe verse abajo');
    assert.ok(!/border: 3px solid transparent;\s*background/.test(borde),
        'falta anular right/bottom: el degradado daría toda la vuelta');

    // El tinte es translúcido: sin una capa OPACA debajo, el degradado se
    // ve a través de él y la tarjeta entera queda en cian→magenta (texto
    // ilegible). La capa opaca va TAMBIÉN a padding-box, entre las dos.
    const capas = (borde.match(/linear-gradient\(/g) || []).length;
    assert.ok(capas >= 3, `hacen falta 3 capas de background (hay ${capas})`);
    assert.match(borde, /linear-gradient\(var\(--card-bg\), var\(--card-bg\)\) padding-box/,
        'falta la capa opaca que tapa el degradado por dentro');
    const orden = [
        borde.indexOf('rgba(255, 255, 255, 0.045)'),
        borde.indexOf('var(--card-bg)'),
        borde.indexOf('#00f0ff, #bd00ff, #ff007b'),
    ];
    assert.ok(orden.every((i) => i > -1) && orden[0] < orden[1] && orden[1] < orden[2],
        'el orden debe ser: tinte, base opaca, degradado del borde');

    // Fuera las dos piezas que cortaban la esquina superior derecha
    assert.ok(!css.includes('.card-landing::before'), 'sigue la franja superior suelta');
    assert.ok(!/\.card-landing--(?:cyan|violet|magenta)[^{]*\{\s*border-left/.test(css),
        'sigue el border-left por variante');

    // El hover no rompe el borde (capa border-box + borde transparente)
    const hover = [...css.matchAll(/\.card-landing:hover \{[^}]*\}/g)].map((m) => m[0]);
    assert.ok(hover.some((r) => r.includes('border-box')),
        'el hover reescribía el background a una sola capa y perdía el borde');
    assert.ok(hover.some((r) => r.includes('border-color: transparent')),
        'falta el hover que impide que .apunte-card:hover tape el degradado con cian');
});

// --- Cierre ----------------------------------------------------------------

test('Cierre: las 4 páginas piden styles.css?v=9 (ninguna queda en ?v=8)', () => {
    const paginas = ['index.html', 'pages/calculadora.html', 'pages/apuntes.html', 'pages/social.html'];
    for (const archivo of paginas) {
        const html = leer(archivo);
        assert.ok(/href="[^"]*styles\.css\?v=9"/.test(html), `${archivo} no tiene ?v=9`);
        assert.ok(!/styles\.css\?v=8/.test(html), `${archivo} sigue en ?v=8`);
    }
});
