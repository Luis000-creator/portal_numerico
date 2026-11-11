'use strict';
// ============================================================================
// Utilidades de prueba: DOM falso + mathjs simulado + cargador de módulos.
// Permite ejecutar los módulos reales de js/ en Node con node:test.
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..', '..');

function crearElemento(tag = 'div') {
    return {
        tagName: String(tag).toUpperCase(),
        id: '',
        value: '',
        innerHTML: '',
        innerText: '',
        textContent: '',
        className: '',
        style: { display: '' },
        dataset: {},
        children: [],
        disabled: false,
        required: false,
        selectionStart: 0,
        selectionEnd: 0,
        classList: { add() {}, remove() {}, contains() { return false; } },
        appendChild(c) { this.children.push(c); return c; },
        addEventListener() {},
        removeEventListener() {},
        setAttribute() {},
        getAttribute() { return null; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        focus() {},
        click() {},
        reset() {},
    };
}

// mathjs suficiente para bisección / punto fijo / newton en los tests.
// Soporta ^ (potencia), log (base 10), ln (natural) y funciones de Math.
function crearMathShim() {
    const alias = {
        log10: Math.log10, log: Math.log, ln: Math.log,
        sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan,
        asin: Math.asin, acos: Math.acos, atan: Math.atan,
        abs: Math.abs, exp: Math.exp, round: Math.round, floor: Math.floor,
        ceil: Math.ceil, sign: Math.sign, pi: Math.PI, e: Math.E,
        min: Math.min, max: Math.max, pow: Math.pow,
    };

    function evaluar(expr, scope = {}) {
        const e = String(expr).replace(/\^/g, '**');
        const args = Object.assign({}, alias, scope);
        const keys = Object.keys(args);
        const fn = Function(...keys, `"use strict"; return (${e});`);
        return fn(...keys.map((k) => args[k]));
    }

    return {
        evaluate: evaluar,
        parse(expr) {
            return { toTex: () => String(expr), evaluate: (scope) => evaluar(expr, scope) };
        },
        derivative() { throw new Error('derivative no soportado en el shim de tests'); },
        factorial(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; },
    };
}

/**
 * Carga los módulos reales del proyecto en un contexto aislado.
 * @param {string[]} archivos rutas relativas a la raíz del proyecto
 * @returns {{ctx: object, el: (id:string)=>object, errores: string[]}}
 */
function cargarModulos(archivos) {
    const elementos = new Map();
    const errores = [];

    const documentStub = {
        getElementById(id) {
            if (!elementos.has(id)) {
                const el = crearElemento();
                el.id = id;
                elementos.set(id, el);
            }
            return elementos.get(id);
        },
        createElement(tag) { return crearElemento(tag); },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        addEventListener() {},
        removeEventListener() {},
        body: crearElemento('body'),
        head: crearElemento('head'),
    };

    const ctx = {
        console: { log() {}, error(...a) { errores.push(a.join(' ')); }, warn() {}, info() {} },
        document: documentStub,
        math: crearMathShim(),
        navigator: { clipboard: { writeText: () => Promise.resolve() } },
        setTimeout, clearTimeout,
        Event: class Event { constructor(type) { this.type = type; } },
        Blob: class Blob {},
        URL: { createObjectURL: () => 'blob:', revokeObjectURL() {} },
        // stubs de módulos que no se cargan en estos tests
        graficarResultado() {},
        actualizarPreviewDerivada() {},
    };
    ctx.window = ctx;
    ctx.globalThis = ctx;

    vm.createContext(ctx);

    for (const archivo of archivos) {
        const abs = path.join(RAIZ, archivo);
        const codigo = fs.readFileSync(abs, 'utf8');
        vm.runInContext(codigo, ctx, { filename: archivo });
    }

    return { ctx, el: (id) => documentStub.getElementById(id), errores };
}

/** Ejecuta calcularBiseccion() con los datos indicados y devuelve la salida. */
function correrBiseccion({ expr, a, b, criterio, valor }) {
    const { ctx, el } = cargarModulos(['js/biseccion.js']);

    el('funcion').value = expr;
    el('a').value = String(a);
    el('b').value = String(b);
    el('criterio').value = criterio;
    el('valorCriterio').value = String(valor);

    ctx.calcularBiseccion();

    return {
        filas: el('tabla-cuerpo').children.map((r) => r.innerHTML),
        resumen: el('resumen-container').innerHTML,
        info: el('info-text').innerHTML,
        error: el('error-text').innerText,
        hayError: el('error-box').style.display === 'block',
        ctx,
        el,
    };
}

/** Extrae la raíz aproximada del HTML del resumen. */
function raizDelResumen(resumen) {
    const m = /x = (N\/A|-?[\d.]+)/.exec(resumen);
    return m ? m[1] : null;
}

module.exports = { cargarModulos, correrBiseccion, raizDelResumen, crearMathShim };
