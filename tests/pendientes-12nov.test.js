'use strict';
// ============================================================================
// Pendientes de la ronda 2 (12-nov): SRI, mensajes de dominio compartidos,
// aviso previo del intervalo automático solo-polos, pistas de raíz doble /
// asíntota, gráfica independiente y el flash de Apuntes.
// ============================================================================

const test = require('node:test');
const assert = require('node:assert');
const { cargarModulos, salidaDe, correrBiseccion } = require('./helpers/env.js');

// ----------------------------------------------------------------------------
// 1. SRI en el cargador de librerías
// ----------------------------------------------------------------------------

test('vendor-loader: mathjs y KaTeX se cargan con integrity (SRI) fijado', () => {
    const env = cargarModulos(['js/vendor-loader.js']);
    assert.equal(typeof env.ctx.loadVendorScript, 'function');
    assert.equal(
        env.ctx.Vendor.sri.math,
        'sha384-gJKcVYwVxispLQAFHIwGBvbEmMm4WableABNGVE9B88zRUh5ce+GMZJQ6ZU2dfcN',
    );
    assert.equal(
        env.ctx.Vendor.sri.katex,
        'sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8',
    );
});

test('vendor-loader: loadVendorScript aplica integrity y crossOrigin', async () => {
    const env = cargarModulos(['js/vendor-loader.js']);
    let script = null;
    env.ctx.document.createElement = (tag) => {
        script = { tagName: String(tag).toUpperCase(), dataset: {} };
        return script;
    };
    // El módulo resuelve la promesa desde onload: lo disparamos al insertar.
    env.ctx.document.head.appendChild = (el) => { if (el.onload) el.onload(); };
    await env.ctx.loadVendorScript('https://cdn.example/lib.js', 'sha384-abc');
    assert.equal(script.integrity, 'sha384-abc');
    assert.equal(script.crossOrigin, 'anonymous');
});

// ----------------------------------------------------------------------------
// 2. mensajeErrorEvaluacion reutilizado en Newton y Punto Fijo
// ----------------------------------------------------------------------------

test('Newton: fuera de dominio de f(x) usa mensajeErrorEvaluacion', () => {
    const env = cargarModulos(['js/biseccion.js', 'js/newton-raphson.js']);
    env.el('funcion-newton').value = 'sqrt(x) - 1';
    env.el('x0-newton').value = '-2';
    env.el('criterio').value = 'tolerancia';
    env.el('valorCriterio').value = '0.001';

    env.ctx.calcularNewton();

    const s = salidaDe(env);
    assert.ok(s.hayError);
    assert.match(s.error, /f\(x\) no está definida en x = -2/);
});

test('Punto Fijo: fuera de dominio de g(x) usa mensajeErrorEvaluacion', () => {
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js']);
    env.el('funcion-gx').value = 'ln(x)';
    env.el('x0').value = '-1';
    env.el('criterio').value = 'tolerancia';
    env.el('valorCriterio').value = '0.001';

    env.ctx.calcularPuntoFijo();

    const s = salidaDe(env);
    assert.ok(s.hayError);
    assert.match(s.error, /g\(x\) no está definida en x = -1/);
});

test('Punto Fijo: un infinito en g(x) se reporta como divergencia', () => {
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js']);
    env.el('funcion-gx').value = '1/(x - 1)';
    env.el('x0').value = '1';
    env.el('criterio').value = 'tolerancia';
    env.el('valorCriterio').value = '0.001';

    env.ctx.calcularPuntoFijo();

    const s = salidaDe(env);
    assert.ok(s.hayError);
    assert.match(s.error, /g\(x\) tiende a \+∞ en la iteración 1/);
});

// ----------------------------------------------------------------------------
// 3. Intervalo automático: paso fino + aviso previo si solo hay polos
// ----------------------------------------------------------------------------

test('buscarIntervaloAuto: paso 0.25 encuentra la raíz de tan(x) - 4.5', () => {
    const env = cargarModulos(['js/biseccion.js']);
    const [a, b, modo] = env.ctx.buscarIntervaloAuto('tan(x) - 4.5');
    assert.equal(modo, 'auto');
    assert.ok(a < 1.3522 && 1.3522 < b, `intervalo [${a}, ${b}]: la raíz 1.3522 queda fuera`);
});

test('buscarIntervaloAuto: raíz exacta en el extremo sigue detectada', () => {
    const env = cargarModulos(['js/biseccion.js']);
    const [a, b, modo] = env.ctx.buscarIntervaloAuto('x^2 - 4');
    assert.equal(modo, 'exacta');
    assert.ok(Math.abs(a + 2) < 1e-9 || Math.abs(b + 2) < 1e-9, `[${a}, ${b}] no contiene -2`);
});

test('buscarIntervaloAuto: una función sin raíces, solo con polo, queda como discontinuo', () => {
    const env = cargarModulos(['js/biseccion.js']);
    const [, , modo] = env.ctx.buscarIntervaloAuto('1/(x - 0.53)');
    assert.equal(modo, 'discontinuo');
});

test('calcularBiseccion: avisa ANTES de calcular si el automático solo encontró polos', () => {
    const env = cargarModulos(['js/biseccion.js']);
    env.el('funcion').value = '1/(x - 0.53)';
    env.el('a').value = '';
    env.el('b').value = '';
    env.el('criterio').value = 'tolerancia';
    env.el('valorCriterio').value = '0.001';

    env.ctx.calcularBiseccion();

    const s = salidaDe(env);
    assert.match(s.info, /solo encontró discontinuidades \(polos\)/);
    assert.equal(s.filas.length, 0, 'no debe bisectar una discontinuidad');
    assert.notEqual(env.el('info-box').style.display, 'none');
    assert.equal(env.el('resultado-container').style.display, 'none');
});

// ----------------------------------------------------------------------------
// 4. Pistas cuando f(a) y f(b) no cambian de signo
// ----------------------------------------------------------------------------

test('Bisección: pista de raíz doble en (x - 1)^2', () => {
    const r = correrBiseccion({ expr: '(x - 1)^2', a: 0, b: 2, criterio: 'tolerancia', valor: 0.001 });
    assert.ok(r.hayError);
    assert.match(r.error, /Teorema de Bolzano/);
    assert.match(r.error, /raíz doble/);
    assert.match(r.error, /Newton o Punto Fijo/);
});

test('Bisección: pista de asíntota en tan(x) cruzando π/2 sin cambio global', () => {
    const r = correrBiseccion({ expr: 'tan(x)', a: 1, b: 4.5, criterio: 'tolerancia', valor: 0.001 });
    assert.ok(r.hayError);
    assert.match(r.error, /Teorema de Bolzano/);
    assert.match(r.error, /asíntota verticales|discontinuidad \(polo\)/);
});

test('Bisección: pista de raíz escondida dentro del intervalo (sin(x) en [2, 8])', () => {
    const r = correrBiseccion({ expr: 'sin(x)', a: 2, b: 8, criterio: 'tolerancia', valor: 0.001 });
    assert.ok(r.hayError);
    assert.match(r.error, /hay una raíz entre/);
});

// ----------------------------------------------------------------------------
// 5. Gráfica independiente (botón "Graficar")
// ----------------------------------------------------------------------------

test('graficarLibre: dibuja la función del método activo con su intervalo', async () => {
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js', 'js/graficadora.js']);
    const llamadas = [];
    env.ctx.graficarResultado = (expr, opts) => llamadas.push({ expr, opts });

    env.el('metodo-selector').value = 'biseccion';
    env.el('funcion').value = 'x^2 - 4';
    env.el('a').value = '1';
    env.el('b').value = '3';
    await env.ctx.graficarLibre();

    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0].expr, 'x^2 - 4');
    assert.equal(llamadas[0].opts.a, 1);
    assert.equal(llamadas[0].opts.b, 3);
});

test('graficarLibre: Taylor usa [min(a,x)-2, max(a,x)+2] como rango', async () => {
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js', 'js/graficadora.js']);
    const llamadas = [];
    env.ctx.graficarResultado = (expr, opts) => llamadas.push({ expr, opts });

    env.el('metodo-selector').value = 'taylor';
    env.el('funcion-taylor').value = 'exp(x)';
    env.el('a-taylor').value = '0';
    env.el('x-taylor').value = '1';
    await env.ctx.graficarLibre();

    assert.equal(llamadas.length, 1);
    assert.deepEqual(llamadas[0].opts.rango, [-2, 3]);
});

test('graficarLibre: sin intervalo válido usa [-10, 10] y Punto Fijo dibuja y = x', async () => {
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js', 'js/graficadora.js']);
    const llamadas = [];
    env.ctx.graficarResultado = (expr, opts) => llamadas.push({ expr, opts });

    env.el('metodo-selector').value = 'puntofijo';
    env.el('funcion-gx').value = 'cos(x)';
    env.el('x0').value = '1';
    await env.ctx.graficarLibre();

    assert.equal(llamadas.length, 1);
    assert.deepEqual(llamadas[0].opts.rango, [-10, 10]);
    assert.equal(llamadas[0].opts.identidad, true);
});

test('graficarLibre: rechaza funciones con error de sintaxis antes de dibujar', async () => {
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js', 'js/graficadora.js']);
    const llamadas = [];
    env.ctx.graficarResultado = (expr, opts) => llamadas.push({ expr, opts });

    env.el('metodo-selector').value = 'biseccion';
    env.el('funcion').value = 'x^2 +';
    await env.ctx.graficarLibre();

    assert.equal(llamadas.length, 0);
    assert.equal(env.el('error-box').style.display, 'block');
    assert.match(env.el('error-text').innerText, /sintaxis/);
});

test('Botón Graficar: visible en métodos con función, oculto en Lagrange', () => {
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js', 'js/graficadora.js']);
    const btn = env.el('btn-graficar-libre');
    btn.style.display = 'none';

    env.el('metodo-selector').value = 'biseccion';
    env.ctx.alternarMetodoUI();
    assert.equal(btn.style.display, '');

    env.el('metodo-selector').value = 'lagrangelineal';
    env.ctx.alternarMetodoUI();
    assert.equal(btn.style.display, 'none');
});

// ----------------------------------------------------------------------------
// 6. Apuntes: sin flash de "sin resultados" durante la carga
// ----------------------------------------------------------------------------

test('Apuntes: los mensajes se ocultan mientras hay skeletons', () => {
    const env = cargarModulos(['js/apuntes.js']);
    const cont = env.el('apuntes-remotos');
    env.el('apuntes-vacio').style.display = 'block';
    env.el('apuntes-sin-resultados').style.display = 'block';

    env.ctx.mostrarEsqueletosApuntes(cont, 2);

    assert.equal(env.el('apuntes-vacio').style.display, 'none');
    assert.equal(env.el('apuntes-sin-resultados').style.display, 'none');
});

test('Apuntes: filtrarContenido no muestra mensajes mientras carga', () => {
    const env = cargarModulos(['js/apuntes.js']);
    const cont = env.el('apuntes-remotos');
    cont.getAttribute = () => 'true'; // aria-busy activo (skeletons)
    env.el('buscador').value = 'algo';

    env.ctx.filtrarContenido();

    assert.equal(env.el('apuntes-sin-resultados').style.display, 'none');
    assert.equal(env.el('apuntes-vacio').style.display, 'none');
});

test('Apuntes: publicarApunte rechaza títulos con URL (sin login)', async () => {
    const env = cargarModulos(['js/apuntes.js']);
    let alerta = '';
    env.ctx.alert = (m) => { alerta = String(m); };

    const form = {
        titulo: { value: 'https://spam.example/promo' },
        contenido: { value: 'contenido' },
        querySelector: () => ({ disabled: false, textContent: '' }),
        reset() {},
    };
    await env.ctx.publicarApunte({ preventDefault() {}, currentTarget: form });

    assert.match(alerta, /no puede contener enlaces/);
});

test('Apuntes: publicarApunte rechaza títulos de más de 200 caracteres', async () => {
    const env = cargarModulos(['js/apuntes.js']);
    let alerta = '';
    env.ctx.alert = (m) => { alerta = String(m); };

    const form = {
        titulo: { value: 'a'.repeat(201) },
        contenido: { value: 'contenido' },
        querySelector: () => ({ disabled: false, textContent: '' }),
        reset() {},
    };
    await env.ctx.publicarApunte({ preventDefault() {}, currentTarget: form });

    assert.match(alerta, /200 caracteres/);
});
