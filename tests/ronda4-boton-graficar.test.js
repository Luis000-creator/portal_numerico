'use strict';
// ============================================================================
// Tests de la ronda 4 (13-nov): botón "Graficar".
// Bug reportado: el botón borraba los resultados del último Calcular y la
// gráfica no se veía nunca. Causa: graficarLibre() llamaba limpiarTabla()
// (vacía la tabla y oculta #resultado-container) y #grafica-container vive
// DENTRO de ese contenedor, así que aunque el canvas se dibujara quedaba
// invisible. Además, sin Calcular previo el padre estaba oculto desde el
// HTML y nadie lo re-mostraba.
// Ejecutar con:  node --test tests/*.test.js
// ============================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarModulos } = require('./helpers/env');

// Canvas falso: registra las operaciones de dibujo (no hay navegador).
function prepararCanvas(env) {
    const ops = [];
    const ctx2d = new Proxy({}, {
        get(t, k) {
            if (k === 'measureText') return () => ({ width: 10 });
            return () => { ops.push(String(k)); };
        },
        set() { return true; },
    });
    const canvas = env.el('grafica');
    canvas.clientWidth = 600;
    canvas.getContext = () => ctx2d;
    return ops;
}

function cargarCalculadora() {
    return cargarModulos(['js/biseccion.js', 'js/punto-fijo.js', 'js/graficadora.js']);
}

function calcular(env) {
    env.el('metodo-selector').value = 'biseccion';
    env.el('funcion').value = 'sin(x)';
    env.el('a').value = '-pi';
    env.el('b').value = 'pi';
    env.el('criterio').value = 'tolerancia';
    env.el('valorCriterio').value = '0.001';
    env.ctx.calcularBiseccion();
}

test('Graficar conserva la tabla, el resumen y los resultados del último Calcular', async () => {
    const env = cargarCalculadora();
    const ops = prepararCanvas(env);
    calcular(env);
    const filas = env.el('tabla-cuerpo').children.length;
    assert.ok(filas > 0, 'el Calcular previo debe dejar filas');
    assert.equal(env.el('resultado-container').style.display, 'block');

    ops.length = 0;
    await env.ctx.graficarLibre();

    assert.equal(env.el('resultado-container').style.display, 'block',
        'el contenedor de resultados se ocultó (el bug reportado)');
    assert.equal(env.el('tabla-cuerpo').children.length, filas,
        'la tabla del Calcular anterior se borró');
    assert.match(env.el('resumen-container').innerHTML, /x = /,
        'el resumen del Calcular anterior desapareció');
    assert.equal(env.el('error-box').style.display, 'none',
        'no debe quedar un error encima de los resultados');
    assert.ok(ops.length > 0, 'la gráfica no se dibujó');
    assert.equal(env.el('grafica-container').style.display, 'block');
    assert.equal(env.el('bloque-tabla').style.display, 'block',
        'con resultados previos la tabla debe seguir visible');
});

test('Graficar sin Calcular previo re-muestra el padre y se ve la gráfica', async () => {
    const env = cargarCalculadora();
    const ops = prepararCanvas(env);

    // Estado inicial de la página: #resultado-container oculto desde el HTML
    env.el('metodo-selector').value = 'biseccion';
    env.el('funcion').value = 'sin(x)';
    env.el('a').value = '-pi';
    env.el('b').value = 'pi';

    await env.ctx.graficarLibre();

    assert.equal(env.el('grafica-container').style.display, 'block');
    assert.equal(env.el('resultado-container').style.display, 'block',
        'el padre sigue oculto: en el navegador la gráfica no se vería');
    assert.ok(ops.length > 0, 'la gráfica no se dibujó');
    // Sin resultados no se muestra la tabla vacía (ni su divisor)
    assert.equal(env.el('bloque-tabla').style.display, 'none');
});

test('Graficar limpia un error anterior pero no toca los resultados', async () => {
    const env = cargarCalculadora();
    prepararCanvas(env);
    // Un Calcular con error deja el error-box visible y los resultados ocultos
    env.el('metodo-selector').value = 'biseccion';
    env.el('funcion').value = 'x^2 +';
    env.ctx.calcularBiseccion();
    assert.equal(env.el('error-box').style.display, 'block');

    env.el('funcion').value = 'sin(x)';
    await env.ctx.graficarLibre();

    assert.equal(env.el('error-box').style.display, 'none',
        'el error viejo ya no aplica si la gráfica salió bien');
    assert.equal(env.el('resultado-container').style.display, 'block');
    assert.equal(env.el('grafica-container').style.display, 'block');
});
