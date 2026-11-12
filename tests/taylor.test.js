'use strict';
// ============================================================================
// Tests de Taylor / Maclaurin (js/taylor.js)
// Ejecutar con:  node --test tests/
// ============================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarModulos, salidaDe } = require('./helpers/env');

function correrTaylor({ expr, a, x, n }) {
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js', 'js/taylor.js']);
    env.el('metodo-selector').value = 'taylor';
    env.ctx.alternarMetodoUI();
    env.el('funcion-taylor').value = expr;
    env.el('a-taylor').value = String(a);
    env.el('x-taylor').value = String(x);
    env.el('n-taylor').value = String(n);
    env.ctx.calcularTaylor();
    return salidaDe(env);
}

function valorTarjeta(resumen, etiqueta) {
    const re = new RegExp(
        `resumen-label">${etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</span>\\s*<span class="resumen-value">([^<]*)<`
    );
    const m = re.exec(resumen);
    return m ? m[1] : null;
}

test('Taylor: sin(x) en [0,1] con n=5 → 0.841666666667', () => {
    const r = correrTaylor({ expr: 'sin(x)', a: 0, x: 1, n: 5 });
    assert.equal(r.hayError, false, `no debe fallar: ${r.error}`);

    const aprox = Number(valorTarjeta(r.resumen, 'Aproximación P5(x)'));
    // 1 - 1/6 + 1/120 = 0.8416666...
    assert.ok(Math.abs(aprox - (1 - 1 / 6 + 1 / 120)) < 1e-9, `P5(1) = ${aprox}`);

    const real = Number(valorTarjeta(r.resumen, 'Valor real f(x)'));
    assert.ok(Math.abs(real - Math.sin(1)) < 1e-9, `sin(1) = ${real}`);

    // n+1 filas (orden 0..n)
    assert.equal(r.filas.length, 6, 'debe haber n+1 filas');
});

test('Taylor: Maclaurin de exp(x) en x=1 con n=10 ≈ e', () => {
    const r = correrTaylor({ expr: 'exp(x)', a: 0, x: 1, n: 10 });
    assert.equal(r.hayError, false, `no debe fallar: ${r.error}`);
    const aprox = Number(valorTarjeta(r.resumen, 'Aproximación P10(x)'));
    assert.ok(Math.abs(aprox - Math.E) < 1e-7, `P10(1) = ${aprox}, e = ${Math.E}`);
});

test('Taylor: el error verdadero disminuye al subir el grado', () => {
    const errDe = (n) => {
        const r = correrTaylor({ expr: 'exp(x)', a: 0, x: 1, n });
        return Math.abs(Number(valorTarjeta(r.resumen, 'Valor real f(x)'))
            - Number(valorTarjeta(r.resumen, `Aproximación P${n}(x)`)));
    };
    assert.ok(errDe(2) > errDe(4), 'el error con n=2 debe ser mayor que con n=4');
    assert.ok(errDe(4) > errDe(8), 'el error con n=4 debe ser mayor que con n=8');
});

test('Taylor: el polinomio se muestra en KaTeX con el punto evaluado', () => {
    const r = correrTaylor({ expr: 'exp(x)', a: 0, x: 1, n: 3 });
    assert.equal(r.hayError, false);
    assert.match(r.procedimiento, /P_\{3\}\(x\)/, `falta el polinomio: ${r.procedimiento}`);
    assert.match(r.procedimiento, /P_\{3\}\(1\)/, `falta la evaluación: ${r.procedimiento}`);
    assert.ok(!r.procedimiento.includes('P_{3}(1x)'), 'no debe salir "P_{3}(1x)"');
});

test('Taylor: no debe dejar signos dobles ("+ -") en la expresión', () => {
    // sin(x) tiene derivadas impares alternando signo: es el caso propenso
    const r = correrTaylor({ expr: 'sin(x)', a: 0, x: 1, n: 5 });
    assert.equal(r.hayError, false);
    assert.equal(r.graficos.length, 1, 'debe dibujar la gráfica');
    const polinomio = r.graficos[0].opts.curvas[0].expr;
    assert.ok(!/\+\s*-/.test(polinomio), `signos dobles en: ${polinomio}`);
    assert.ok(!/\-\s*-/.test(polinomio), `signos dobles en: ${polinomio}`);
});

test('Taylor: grafica f(x) con su polinomio superpuesto y 2 marcas', () => {
    const r = correrTaylor({ expr: 'exp(x)', a: 0, x: 1, n: 3 });
    const opts = r.graficos[0].opts;
    assert.equal(r.graficos[0].expr, 'exp(x)');
    assert.equal(opts.curvas.length, 1);
    assert.equal(opts.curvas[0].etiqueta, 'P3(x)');
    assert.equal(opts.marcas.length, 2, 'marca f(x) y marca P_n(x)');
    // (campo a campo: el array viene de otro realm de JS)
    assert.equal(opts.rango.length, 2);
    assert.equal(opts.rango[0], -5);
    assert.equal(opts.rango[1], 5);
});

test('Taylor: valida grado n', () => {
    assert.match(correrTaylor({ expr: 'x^2', a: 0, x: 1, n: 0 }).error, /entero positivo/);
    assert.match(correrTaylor({ expr: 'x^2', a: 0, x: 1, n: -3 }).error, /entero positivo/);
    assert.match(correrTaylor({ expr: 'x^2', a: 0, x: 1, n: 1.5 }).error, /entero positivo/);
    assert.match(correrTaylor({ expr: 'x^2', a: 0, x: 1, n: 21 }).error, /demasiado grande/);
});

test('Taylor: valida función, centro y punto de evaluación', () => {
    assert.match(correrTaylor({ expr: '', a: 0, x: 1, n: 3 }).error, /escribe la función/);
    assert.match(correrTaylor({ expr: 'x^2', a: '', x: 1, n: 3 }).error, /completa el punto base/);
    assert.match(correrTaylor({ expr: 'x^2', a: 'abc', x: 1, n: 3 }).error, /números válidos/);
    assert.match(correrTaylor({ expr: 'x^2', a: 0, x: '', n: 3 }).error, /completa el punto base/);
});

test('Taylor: avisa si f(x) o sus derivadas no existen en el punto', () => {
    const r1 = correrTaylor({ expr: '1/x', a: 0, x: 1, n: 3 });
    assert.equal(r1.hayError, true, 'la asíntota en a=0 debe rechazarse');
    assert.match(r1.error, /no es un número real|no está definida/);

    const r2 = correrTaylor({ expr: 'x^2', a: 0, x: 1 / 0, n: 3 });
    assert.equal(r2.hayError, true, 'x infinito debe rechazarse');
});

test('Taylor: la tabla incluye derivada, coeficiente, término y error', () => {
    const r = correrTaylor({ expr: 'exp(x)', a: 0, x: 1, n: 3 });
    const cabecera = r.ctx.document.getElementById('tabla-cabecera').innerHTML;
    assert.match(cabecera, /Orden/);
    assert.match(cabecera, /Error Verdadero/);
    // fila 0: f(0)/0! = 1
    assert.match(r.filas[0], /<td data-label="Orden \(n\)">0<\/td>/);
    assert.match(r.filas[0], />1</, 'f⁽⁰⁾(0) = 1');
});
