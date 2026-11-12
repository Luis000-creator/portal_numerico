'use strict';
// ============================================================================
// Tests de regresión de la revisión del 12 de noviembre.
// Cubre: visibilidad de #resultado-container (Taylor/Lagrange/Simpson),
// detección de polos, estado de raíz exacta, conteo de iteraciones,
// arrastre del valor del criterio, resultados obsoletos tras un error,
// error de dominio vs. sintaxis y no presentar como raíz lo que no convergió.
// Ejecutar con:  node --test tests/*.test.js
// ============================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarModulos, correrBiseccion, salidaDe } = require('./helpers/env');

// --- helpers de lectura del resumen ---

function tarjeta(resumen, label) {
    const re = new RegExp(
        `resumen-label">${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</span>\\s*<span class="resumen-value(?:[^"]*)">([^<]*)`
    );
    return re.exec(resumen)?.[1] ?? null;
}

function estadoDe(resumen) {
    return tarjeta(resumen, 'Estado');
}

function etiquetaRaiz(resumen) {
    const m = /resumen-label">([^<]*)<\/span>\s*<span class="resumen-value">x = /.exec(resumen);
    return m ? m[1] : null;
}

function correrPuntoFijo({ g, x0, criterio, valor }) {
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js']);
    env.el('metodo-selector').value = 'puntofijo';
    env.ctx.alternarMetodoUI();
    env.el('funcion-gx').value = g;
    env.el('x0').value = String(x0);
    env.el('criterio').value = criterio;
    env.el('valorCriterio').value = String(valor);
    env.ctx.calcularPuntoFijo();
    return salidaDe(env);
}

// ============================================================================
// 1) #resultado-container debe quedar visible (críticos 1, 2, 3 y 6)
// ============================================================================

test('resultado-container se muestra al calcular (Taylor, Lagrange y Simpson)', () => {
    // Taylor: P5(1) de exp(x) = 2.71666666667
    let env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js', 'js/taylor.js']);
    env.el('metodo-selector').value = 'taylor';
    env.ctx.alternarMetodoUI();
    Object.assign(env.el('funcion-taylor'), { value: 'exp(x)' });
    Object.assign(env.el('a-taylor'), { value: '0' });
    Object.assign(env.el('x-taylor'), { value: '1' });
    env.el('n-taylor').value = '5';
    env.ctx.calcularTaylor();
    assert.equal(env.el('resultado-container').style.display, 'block',
        'Taylor: el contenedor seguía oculto, así que no se veía NADA');
    assert.match(salidaDe(env).resumen, /2\.71666666667/);

    // Simpson: int_0^2 x^2 dx = 2.666666667
    env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js', 'js/simpson.js']);
    env.el('metodo-selector').value = 'simpson';
    env.ctx.alternarMetodoUI();
    Object.assign(env.el('funcion-simpson'), { value: 'x^2' });
    Object.assign(env.el('a-simpson'), { value: '0' });
    Object.assign(env.el('b-simpson'), { value: '2' });
    env.el('n-simpson').value = '4';
    env.ctx.calcularSimpson();
    assert.equal(env.el('resultado-container').style.display, 'block',
        'Simpson: el contenedor seguía oculto');
    assert.match(salidaDe(env).resumen, /2\.666666667/);

    // Lagrange lineal: (1,2), (3,6) en x=2 → y=4
    env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js', 'js/lagrange.js']);
    env.el('metodo-selector').value = 'lagrangelineal';
    env.ctx.alternarMetodoUI();
    Object.assign(env.el('x0-lineal'), { value: '1' });
    Object.assign(env.el('y0-lineal'), { value: '2' });
    Object.assign(env.el('x1-lineal'), { value: '3' });
    Object.assign(env.el('y1-lineal'), { value: '6' });
    env.el('x-lineal').value = '2';
    env.ctx.calcularLagrangeLineal();
    assert.equal(env.el('resultado-container').style.display, 'block',
        'Lagrange lineal: el contenedor seguía oculto');
    assert.match(salidaDe(env).resumen, /y = 4/);
});

// ============================================================================
// 2) Polos: un cambio de signo por división entre cero NO es una raíz
// ============================================================================

test('detectarPolo distingue 1/(x-2) de una raíz real', () => {
    const { ctx } = cargarModulos(['js/biseccion.js']);

    assert.equal(ctx.detectarPolo('1/(x-2)', 2.000244), true,
        'f salta de -∞ a +∞ creciendo: es un polo');
    assert.equal(ctx.detectarPolo('tan(x)', Math.PI / 2 + 1e-4), true,
        'tan(x) tiene asíntota vertical: es un polo');

    // Raíces genuinas: |f| DECRECE al acercarse, no crece
    assert.equal(ctx.detectarPolo('x^2 - 4', 2), false);
    assert.equal(ctx.detectarPolo('x^3 - x - 2', 1.5213), false);
    assert.equal(ctx.detectarPolo('exp(x) - 2*x - 1', 0), false);
});

test('Bisección no presenta un polo como raíz (crítico 4)', () => {
    const r = correrBiseccion({ expr: '1/(x-2)', a: 0, b: 3, criterio: 'tolerancia', valor: 0.001 });

    assert.equal(r.hayError, false, `no debe lanzar error: ${r.error}`);
    assert.equal(etiquetaRaiz(r.resumen), 'Posible polo (sin raíz)',
        `tarjeta equivocada: ${r.resumen}`);
    assert.match(estadoDe(r.resumen), /Sin raíz: discontinuidad/);
    assert.ok(!/Criterio (alcanzado|cumplido)/.test(estadoDe(r.resumen)),
        'no debe decir que se cumplió un criterio cuando no hay raíz');
    assert.match(r.info, /polo/i, `falta el aviso: ${r.info}`);
    // La gráfica no debe marcar "raíz" sobre el polo
    assert.equal(r.graficos[0]?.opts?.raiz, null);
});

// ============================================================================
// 3) Estado honesto: raíz exacta, criterio por Δx y residuo grande
// ============================================================================

test('raíz exacta en un extremo: estado "cumplido" y 0 iteraciones (crítico 5)', () => {
    const r = correrBiseccion({ expr: 'x^2 - 4', a: -2.25, b: -2, criterio: 'tolerancia', valor: 0.001 });

    assert.equal(r.hayError, false, r.error);
    assert.match(estadoDe(r.resumen), /Criterio cumplido: f\(x\) = 0 \(raíz exacta en el extremo\)/);
    assert.equal(tarjeta(r.resumen, 'Iteraciones'), '0');
    assert.match(tarjeta(r.resumen, 'f(x) Final'), /^0\.000000$/);
});

test('criterio cumplido por Δx con residuo grande lo explica (crítico 8)', () => {
    // Quíntica: x ≈ 3.024414 pero f(x) final = 0.067 >> tolerancia 0.001
    const r = correrBiseccion({
        expr: 'x^5 - 3*x^4 + x - 5', a: 2, b: 4, criterio: 'tolerancia', valor: 0.001,
    });

    assert.equal(r.hayError, false, r.error);
    assert.match(estadoDe(r.resumen), /Criterio cumplido: Δx ≤ 0\.001/,
        `el estado debe decir QUÉ criterio se cumplió: ${estadoDe(r.resumen)}`);
    assert.match(r.info, /mayor que la tolerancia/,
        `falta el aviso de residuo: ${r.info}`);
});

test('el conteo de iteraciones coincide con las filas de la tabla', () => {
    const r = correrBiseccion({ expr: 'x^3 - x - 2', a: 1, b: 2, criterio: 'tolerancia', valor: 0.001 });
    assert.equal(r.hayError, false, r.error);
    assert.equal(tarjeta(r.resumen, 'Iteraciones'), String(r.filas.length),
        'la tarjeta decía otro número que el de filas visibles');

    const pf = correrPuntoFijo({ g: 'x^2 - 2', x0: 1.9, criterio: 'tolerancia', valor: 0.001 });
    assert.equal(pf.filas.length, 100, 'mensaje decía 100, tabla 100 filas');
    assert.equal(tarjeta(pf.resumen, 'Iteraciones'), String(pf.filas.length),
        'antes decía 101 (n contado después del incremento)');
});

// ============================================================================
// 4) Punto fijo: no presentar como raíz algo que no convergió (crítico 7)
// ============================================================================

test('Punto Fijo sin convergencia con tolerancia no se muestra como raíz', () => {
    const r = correrPuntoFijo({ g: 'x^2 - 2', x0: 1.9, criterio: 'tolerancia', valor: 0.001 });

    assert.equal(etiquetaRaiz(r.resumen), 'Último iterado (sin converger)',
        `tarjeta equivocada: ${r.resumen.slice(0, 200)}`);
    assert.match(estadoDe(r.resumen), /Criterio no alcanzado/);
    assert.match(r.info, /NO convergió/, `falta el aviso: ${r.info}`);
    assert.ok(!/NO es una raíz verificada/.test(r.error), 'es un aviso, no un error bloqueante');
    // Sin raíz verificada, la gráfica no debe marcar un punto fijo
    assert.equal(r.graficos[0]?.opts?.raiz, null);
    // La recta y = x debe dibujarse para ver la intersección
    assert.equal(r.graficos[0]?.opts?.identidad, true);
});

test('Punto Fijo con iteraciones cumplidas pero residuo enorme tampoco es raíz', () => {
    // El criterio "100 iteraciones" se cumple, pero |g(x)-x| = 1.8: diverge.
    const r = correrPuntoFijo({ g: 'x^2 - 2', x0: 1.9, criterio: 'iteraciones', valor: 100 });

    assert.equal(etiquetaRaiz(r.resumen), 'Último iterado (sin converger)');
    assert.match(estadoDe(r.resumen), /sin convergencia/);
    assert.match(r.resumen, /1\.801416/, `residuo visible en la tarjeta: ${r.resumen}`);
    assert.equal(r.graficos[0]?.opts?.raiz, null);
});

test('Punto Fijo que sí converge conserva la etiqueta de raíz', () => {
    const r = correrPuntoFijo({ g: 'cos(x)', x0: 0.5, criterio: 'tolerancia', valor: 1e-6 });

    assert.equal(r.hayError, false, r.error);
    assert.equal(etiquetaRaiz(r.resumen), 'Raíz Aproximada');
    assert.match(estadoDe(r.resumen), /Criterio cumplido: \|g\(x\) - x\|/);
    assert.match(r.resumen, /x = 0\.739085/);
    assert.notEqual(r.graficos[0]?.opts?.raiz, null);
});

// ============================================================================
// 5) UI: arrastre del criterio y resultados obsoletos tras un error
// ============================================================================

test('cambiar de criterio o de método resetea el valor del criterio', () => {
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js', 'js/newton-raphson.js']);
    const { ctx, el } = env;

    el('criterio').value = 'iteraciones';
    ctx.mostrarCampoCriterio(true);
    assert.equal(el('valorCriterio').value, '100');

    // Cambiar a tolerancia no debe arrastrar "100" como tolerancia
    el('criterio').value = 'tolerancia';
    ctx.mostrarCampoCriterio(true);
    assert.equal(el('valorCriterio').value, '0.001',
        `se arrastró el valor anterior: "${el('valorCriterio').value}"`);

    // Cambiar de método tampoco debe heredar el valor
    el('valorCriterio').value = '42';
    el('metodo-selector').value = 'puntofijo';
    ctx.alternarMetodoUI();
    assert.equal(el('valorCriterio').value, '0.001',
        'Punto Fijo heredó el valor de Bisección');
});

test('un error nuevo oculta los resultados del cálculo anterior', () => {
    const env = cargarModulos(['js/biseccion.js']);
    const { ctx, el } = env;

    el('funcion').value = 'x^2 - 4';
    el('a').value = '1';
    el('b').value = '3';
    el('criterio').value = 'tolerancia';
    el('valorCriterio').value = '0.001';
    ctx.calcularBiseccion();
    assert.equal(el('resultado-container').style.display, 'block',
        'el cálculo válido debe mostrar resultados');

    // Intervalo inválido: f(5) = 21 y f(1) = -3… usamos a > b
    el('a').value = '5';
    el('b').value = '1';
    ctx.calcularBiseccion();

    assert.match(el('error-text').innerText, /intervalo/i, `falta error: ${el('error-text').innerText}`);
    assert.equal(el('resultado-container').style.display, 'none',
        'los resultados viejos seguían visibles junto a los datos nuevos');
    assert.equal(el('grafica-container').style.display, 'none');
});

// ============================================================================
// 6) Errores: dominio vs. sintaxis, y handler del router
// ============================================================================

test('fuera de dominio se reporta como dominio, no como sintaxis', () => {
    const r = correrBiseccion({ expr: 'sqrt(x) - 1', a: -1, b: 4, criterio: 'tolerancia', valor: 0.001 });
    assert.equal(r.hayError, true);
    assert.match(r.error, /fuera del dominio/,
        `decía "revisa la sintaxis" con la sintaxis correcta: ${r.error}`);
    assert.ok(!/sintaxis/.test(r.error));
});

test('sintaxis inválida sigue reportándose como error de sintaxis', () => {
    const r = correrBiseccion({ expr: 'x^3 - x - 2 @', a: 1, b: 2, criterio: 'tolerancia', valor: 0.001 });
    assert.equal(r.hayError, true);
    assert.match(r.error, /sintaxis/i);
});

test('el router muestra el error si un método lanza excepción', async () => {
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js']);
    const { ctx, el } = env;
    el('metodo-selector').value = 'biseccion';

    // 1) excepción síncrona (antes quedaba como "no pasa nada")
    ctx.calcularBiseccion = () => { throw new Error('boom síncrono'); };
    await ctx.ejecutarCalculo({ preventDefault() {} });
    assert.match(el('error-text').innerText, /boom síncrono/,
        `sin try/catch el fallo quedaba silenciado: "${el('error-text').innerText}"`);

    // 2) promesa rechazada (handler async)
    el('error-box').style.display = 'none';
    ctx.calcularBiseccion = () => Promise.reject(new Error('boom async'));
    await ctx.ejecutarCalculo({ preventDefault() {} });
    await new Promise((r) => setImmediate(r)); // deja correr el .catch
    assert.match(el('error-text').innerText, /boom async/);
});

// ============================================================================
// 7) Formato: tolerancias diminutas y ceros con signo
// ============================================================================

test('una tolerancia de 1e-12 no se muestra como ≤ 0.000000', () => {
    const r = correrBiseccion({ expr: 'x^2 - 4', a: 1, b: 3, criterio: 'tolerancia', valor: 1e-12 });
    assert.equal(r.hayError, false, r.error);
    assert.match(r.resumen, /1\.000000e-12/,
        `la tolerancia se imprimió redondeada a cero: ${r.resumen}`);
    assert.ok(!/≤ 0\.000000/.test(r.resumen));
});

test('nunca se imprime "-0.000000" en las tarjetas', () => {
    const env = cargarModulos(['js/biseccion.js']);
    env.ctx.mostrarResumen(-1e-9, -0, 1, 'iteraciones', 5, null, true, { abs: false });
    const resumen = env.el('resumen-container').innerHTML;
    assert.ok(!/-0\.000000/.test(resumen),
        `cero con signo en el resumen: ${resumen}`);
    assert.match(resumen, /x = 0\.000000/);
});

// ============================================================================
// 8) Newton: el primer x no se duplica en la lista de iterados
// ============================================================================

test('Newton no duplica el primer punto en xs', () => {
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js', 'js/newton-raphson.js']);
    env.el('metodo-selector').value = 'newton';
    env.ctx.alternarMetodoUI();
    env.el('funcion-newton').value = 'x^3 - x - 2';
    env.el('x0-newton').value = '1';
    env.el('criterio').value = 'tolerancia';
    env.el('valorCriterio').value = '0.001';
    env.ctx.calcularNewton();

    const xs = env.graficos[0]?.opts?.xs;
    assert.ok(Array.isArray(xs) && xs.length >= 2, 'faltan los iterados en la gráfica');
    assert.notEqual(xs[0], xs[1],
        `el primer x aparecía dos veces: ${JSON.stringify(xs.slice(0, 3))}`);
    assert.match(salidaDe(env).resumen, /x = 1\.5213\d*/);
});
