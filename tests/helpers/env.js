'use strict';
// ============================================================================
// Utilidades de prueba: DOM falso + mathjs simulado + cargador de módulos.
// Permite ejecutar los módulos reales de js/ en Node con node:test.
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..', '..');

// ----------------------------------------------------------------------------
// DOM falso
// ----------------------------------------------------------------------------

// Soporta los selectores mínimos que usan los módulos:
//   [data-campo="x"] | .clase | #id | input[data-campo="y"]
function coincide(el, sel) {
    const partes = String(sel).trim().split(/\s+/);
    const ultima = partes[partes.length - 1];

    const mAttr = /\[data-([\w-]+)="([^"]*)"\]/.exec(ultima);
    const mClase = /\.([\w-]+)/.exec(ultima);
    const mId = /#([\w-]+)/.exec(ultima);
    const mTag = /^([a-zA-Z]+)/.exec(ultima.replace(/\[.*?\]/g, '').replace(/[.#].*$/, ''));

    if (mTag && el.tagName !== mTag[1].toUpperCase()) return false;
    if (mAttr && String(el.dataset[mAttr[1]]) !== mAttr[2]) return false;
    if (mClase && !String(el.className).split(/\s+/).includes(mClase[1])) return false;
    if (mId && el.id !== mId[1]) return false;
    if (!mAttr && !mClase && !mId && !mTag) return false;
    return true;
}

function crearElemento(tag = 'div') {
    const el = {
        tagName: String(tag).toUpperCase(),
        id: '',
        type: '',
        value: '',
        innerText: '',
        textContent: '',
        className: '',
        placeholder: '',
        step: '',
        min: '',
        max: '',
        title: '',
        style: { display: '' },
        dataset: {},
        children: [],
        disabled: false,
        required: false,
        selectionStart: 0,
        selectionEnd: 0,
        parentElement: null,
        classList: {
            _set: new Set(),
            add(c) { this._set.add(c); },
            remove(c) { this._set.delete(c); },
            contains(c) { return this._set.has(c); },
        },
        appendChild(c) { this.children.push(c); c.parentElement = this; return c; },
        removeChild(c) {
            const i = this.children.indexOf(c);
            if (i >= 0) this.children.splice(i, 1);
            return c;
        },
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {},
        setAttribute() {},
        getAttribute() { return null; },
        focus() {},
        click() {},
        reset() {},
        querySelector(sel) {
            for (const c of this.children) {
                if (coincide(c, sel)) return c;
                const h = c.querySelector(sel);
                if (h) return h;
            }
            return null;
        },
        querySelectorAll(sel) {
            const out = [];
            for (const c of this.children) {
                if (coincide(c, sel)) out.push(c);
                out.push(...c.querySelectorAll(sel));
            }
            return out;
        },
    };

    // innerHTML con el comportamiento que necesita el código de producción:
    // asignar '' limpia también los hijos (limpiarTabla / ocultarProcedimiento).
    let html = '';
    Object.defineProperty(el, 'innerHTML', {
        get() { return html; },
        set(v) {
            html = String(v);
            if (html === '') this.children.length = 0;
        },
        configurable: true,
    });

    return el;
}

// ----------------------------------------------------------------------------
// mathjs simulado: parser con AST, evaluación y DERIVACIÓN SIMBÓLICA
// (necesario para las series de Taylor, que derivan con math.derivative)
// ----------------------------------------------------------------------------

const FN_MATH = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sqrt: Math.sqrt, exp: Math.exp, abs: Math.abs,
    log: Math.log, ln: Math.log, log10: Math.log10,
    floor: Math.floor, ceil: Math.ceil, round: Math.round,
    sign: Math.sign, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
};

function tokenizar(src) {
    const toks = [];
    const re = /\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|([+\-*/^(),]))/y;
    let i = 0;
    while (i < src.length) {
        re.lastIndex = i;
        const m = re.exec(src);
        if (!m) throw new Error(`token inválido en "${src.slice(i)}"`);
        if (m[1] !== undefined) toks.push({ t: 'num', v: Number(m[1]) });
        else if (m[2] !== undefined) toks.push({ t: 'id', v: m[2] });
        else toks.push({ t: 'op', v: m[3] });
        i = re.lastIndex;
    }
    return toks;
}

function parseExpr(src) {
    const toks = tokenizar(String(src));
    let p = 0;
    const peek = () => toks[p];
    const sig = () => toks[p++];

    function expr() {
        let n = term();
        while (peek() && (peek().v === '+' || peek().v === '-')) {
            const op = sig().v;
            n = { k: 'bin', op, a: n, b: term() };
        }
        return n;
    }
    function term() {
        let n = unary();
        while (peek() && (peek().v === '*' || peek().v === '/')) {
            const op = sig().v;
            n = { k: 'bin', op, a: n, b: unary() };
        }
        return n;
    }
    function unary() {
        if (peek() && peek().v === '-') { sig(); return { k: 'neg', a: unary() }; }
        if (peek() && peek().v === '+') { sig(); return unary(); }
        return power();
    }
    function power() {
        const base = atom();
        if (peek() && peek().v === '^') { sig(); return { k: 'bin', op: '^', a: base, b: unary() }; }
        return base;
    }
    function atom() {
        const tk = peek();
        if (!tk) throw new Error('expresión incompleta');
        if (tk.t === 'num') { sig(); return { k: 'num', v: tk.v }; }
        if (tk.t === 'op' && tk.v === '(') {
            sig();
            const n = expr();
            if (!peek() || peek().v !== ')') throw new Error('falta ")"');
            sig();
            return n;
        }
        if (tk.t === 'id') {
            sig();
            if (peek() && peek().v === '(') {
                sig();
                const args = [];
                if (peek() && peek().v !== ')') {
                    args.push(expr());
                    while (peek() && peek().v === ',') { sig(); args.push(expr()); }
                }
                if (!peek() || peek().v !== ')') throw new Error('falta ")"');
                sig();
                return { k: 'fn', name: tk.v, args };
            }
            if (tk.v === 'pi') return { k: 'num', v: Math.PI };
            if (tk.v === 'e') return { k: 'num', v: Math.E };
            return { k: 'var', name: tk.v };
        }
        throw new Error(`token inesperado "${tk.v}"`);
    }

    const n = expr();
    if (p !== toks.length) throw new Error('sobra texto en la expresión');
    return n;
}

function evalAst(n, scope = {}) {
    switch (n.k) {
        case 'num': return n.v;
        case 'var': {
            if (n.name in scope) return Number(scope[n.name]);
            if (n.name in FN_MATH) return FN_MATH[n.name];
            throw new Error(`variable desconocida "${n.name}"`);
        }
        case 'neg': return -evalAst(n.a, scope);
        case 'fn': {
            const f = FN_MATH[n.name];
            if (!f) throw new Error(`función desconocida "${n.name}"`);
            return f(...n.args.map((a) => evalAst(a, scope)));
        }
        case 'bin': {
            const a = evalAst(n.a, scope);
            const b = evalAst(n.b, scope);
            switch (n.op) {
                case '+': return a + b;
                case '-': return a - b;
                case '*': return a * b;
                case '/': return a / b;
                case '^': return Math.pow(a, b);
            }
            throw new Error('op desconocida');
        }
    }
    throw new Error('nodo desconocido');
}

function diffAst(n, v) {
    switch (n.k) {
        case 'num': return { k: 'num', v: 0 };
        case 'var': return { k: 'num', v: n.name === v ? 1 : 0 };
        case 'neg': return { k: 'neg', a: diffAst(n.a, v) };
        case 'fn': {
            if (!n.args || n.args.length !== 1) throw new Error(`no sé derivar "${n.name}" con ${n.args ? n.args.length : 0} argumentos`);
            const u = n.args[0];
            const du = diffAst(u, v);
            const comp = (f, ...extra) => ({ k: 'fn', name: f, args: [...extra, u] });
            switch (n.name) {
                case 'sin': return { k: 'bin', op: '*', a: comp('cos'), b: du };
                case 'cos': return { k: 'neg', a: { k: 'bin', op: '*', a: comp('sin'), b: du } };
                case 'tan': return { k: 'bin', op: '/', a: du, b: { k: 'bin', op: '^', a: comp('cos'), b: { k: 'num', v: 2 } } };
                case 'exp': return { k: 'bin', op: '*', a: comp('exp'), b: du };
                case 'log': case 'ln': return { k: 'bin', op: '/', a: du, b: u };
                case 'log10': return { k: 'bin', op: '/', a: du, b: { k: 'bin', op: '*', a: u, b: { k: 'num', v: Math.LN10 } } };
                case 'sqrt': return { k: 'bin', op: '/', a: du, b: { k: 'bin', op: '*', a: { k: 'num', v: 2 }, b: comp('sqrt') } };
                case 'abs': return { k: 'bin', op: '*', a: { k: 'fn', name: 'sign', args: [u] }, b: du };
                case 'asin': return { k: 'bin', op: '/', a: du, b: { k: 'fn', name: 'sqrt', args: [{ k: 'bin', op: '-', a: { k: 'num', v: 1 }, b: { k: 'bin', op: '^', a: u, b: { k: 'num', v: 2 } } }] } };
                case 'acos': return { k: 'neg', a: { k: 'bin', op: '/', a: du, b: { k: 'fn', name: 'sqrt', args: [{ k: 'bin', op: '-', a: { k: 'num', v: 1 }, b: { k: 'bin', op: '^', a: u, b: { k: 'num', v: 2 } } }] } } };
                case 'atan': return { k: 'bin', op: '/', a: du, b: { k: 'bin', op: '+', a: { k: 'num', v: 1 }, b: { k: 'bin', op: '^', a: u, b: { k: 'num', v: 2 } } } };
                default: throw new Error(`no sé derivar "${n.name}"`);
            }
        }
        case 'bin': {
            const { op } = n;
            const da = diffAst(n.a, v);
            const db = diffAst(n.b, v);
            if (op === '+' || op === '-') {
                return { k: 'bin', op, a: da, b: db };
            }
            if (op === '*') {
                return {
                    k: 'bin', op: '+',
                    a: { k: 'bin', op: '*', a: da, b: n.b },
                    b: { k: 'bin', op: '*', a: n.a, b: db },
                };
            }
            if (op === '/') {
                return {
                    k: 'bin', op: '/',
                    a: { k: 'bin', op: '-', a: { k: 'bin', op: '*', a: da, b: n.b }, b: { k: 'bin', op: '*', a: n.a, b: db } },
                    b: { k: 'bin', op: '^', a: n.b, b: { k: 'num', v: 2 } },
                };
            }
            if (op === '^') {
                // exponencial constante: n·u^(n-1)·u'
                if (n.b.k === 'num') {
                    const e = n.b.v;
                    return {
                        k: 'bin', op: '*',
                        a: { k: 'bin', op: '*', a: { k: 'num', v: e }, b: { k: 'bin', op: '^', a: n.a, b: { k: 'num', v: e - 1 } } },
                        b: da,
                    };
                }
                // caso general: u^v · (v'·ln u + v·u'/u)
                return {
                    k: 'bin', op: '*',
                    a: n,
                    b: {
                        k: 'bin', op: '+',
                        a: { k: 'bin', op: '*', a: db, b: { k: 'fn', name: 'log', args: [n.a] } },
                        b: { k: 'bin', op: '/', a: { k: 'bin', op: '*', a: n.b, b: da }, b: n.a },
                    },
                };
            }
            throw new Error(`op desconocida "${op}"`);
        }
    }
    throw new Error('nodo desconocido');
}

// ¿Hay que envolver `hijo` entre paréntesis dentro de una operación `padre`?
// Regla idéntica a la precedencia aritmética, aplicada al LaTeX de prueba.
function requiereParent(padreOp, hijo, esDerecho) {
    if (hijo.k === 'num' || hijo.k === 'var' || hijo.k === 'fn') return false;
    const opHijo = hijo.k === 'neg' ? '-' : hijo.op;
    if (padreOp === '*' || padreOp === '^') return true;
    if (padreOp === '-') return esDerecho && (opHijo === '+' || opHijo === '-');
    return false; // padre '+' o '/' (este último usa \frac{...})
}

function texAst(n) {
    switch (n.k) {
        case 'num': return String(n.v);
        case 'var': return n.name;
        case 'neg': return `-${texAst(n.a)}`;
        case 'fn': return `\\${n.name}\\left(${n.args.map(texAst).join(', ')}\\right)`;
        case 'bin': {
            if (n.op === '/') return `\\frac{${texAst(n.a)}}{${texAst(n.b)}}`;
            if (n.op === '^') {
                const base = requiereParent('^', n.a, false) ? `\\left(${texAst(n.a)}\\right)` : texAst(n.a);
                return `${base}^{${texAst(n.b)}}`;
            }
            const opTex = n.op === '*' ? ' \\cdot ' : ` ${n.op} `;
            const env = (hijo, derecha) => (requiereParent(n.op, hijo, derecha) ? `\\left(${texAst(hijo)}\\right)` : texAst(hijo));
            return `${env(n.a, false)}${opTex}${env(n.b, true)}`;
        }
    }
    return '?';
}

function envolver(nodo) {
    return {
        __ast: nodo,
        evaluate(scope) { return evalAst(nodo, scope || {}); },
        toTex() { return texAst(nodo); },
        toString() { return texAst(nodo); },
    };
}

function crearMathShim() {
    return {
        parse(expr) { return envolver(parseExpr(String(expr).replace(/\*\*/g, '^'))); },
        derivative(nodo, variable) {
            const ast = nodo && nodo.__ast ? nodo.__ast : parseExpr(String(nodo));
            return envolver(diffAst(ast, variable || 'x'));
        },
        evaluate(expr, scope) {
            const s = String(expr).replace(/\*\*/g, '^');
            try {
                return evalAst(parseExpr(s), scope || {});
            } catch (e) {
                // último recurso: JavaScript puro (mismas reglas para ^ -> **)
                const args = Object.assign({}, FN_MATH, { pi: Math.PI, e: Math.E, ln: Math.log }, scope);
                const keys = Object.keys(args);
                return Function(...keys, `"use strict"; return (${s.replace(/\^/g, '**')});`)(...keys.map((k) => args[k]));
            }
        },
        factorial(n) {
            if (n < 0 || !Number.isInteger(n)) return NaN;
            let r = 1;
            for (let i = 2; i <= n; i++) r *= i;
            return r;
        },
    };
}

// KaTeX simulado: guarda el LaTeX para poder asertarlo en los tests.
function crearKatexShim(registro) {
    return {
        render(latex, el) {
            registro.push(latex);
            if (el) el.innerHTML = `$$${latex}$$`;
            return '';
        },
        renderToString(latex) {
            registro.push(latex);
            return `\\htmlClass{test}{${latex}}`;
        },
    };
}

// ----------------------------------------------------------------------------
// Cargador de módulos
// ----------------------------------------------------------------------------

/**
 * Carga los módulos reales del proyecto en un contexto aislado.
 * @param {string[]} archivos rutas relativas a la raíz del proyecto
 * @returns {{ctx: object, el: (id:string)=>object, errores: string[], graficos: object[], latex: string[]}}
 */
function cargarModulos(archivos) {
    const elementos = new Map();
    const errores = [];
    const graficos = [];
    const latex = [];

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
        katex: crearKatexShim(latex),
        navigator: { clipboard: { writeText: () => Promise.resolve() } },
        setTimeout, clearTimeout,
        Event: class Event { constructor(type) { this.type = type; } },
        Blob: class Blob {},
        URL: { createObjectURL: () => 'blob:', revokeObjectURL() {} },
        // stubs de módulos que no se cargan en estos tests (graficadora real
        // necesita canvas; aquí solo registramos lo que se le pidió dibujar)
        graficarResultado(expr, opts) { graficos.push({ expr, opts: opts || {} }); },
        actualizarPreviewDerivada() {},
        addEventListener() {},
        removeEventListener() {},
    };
    ctx.window = ctx;
    ctx.globalThis = ctx;

    vm.createContext(ctx);

    for (const archivo of archivos) {
        const abs = path.join(RAIZ, archivo);
        const codigo = fs.readFileSync(abs, 'utf8');
        vm.runInContext(codigo, ctx, { filename: archivo });
    }

    return {
        ctx,
        el: (id) => documentStub.getElementById(id),
        errores,
        graficos,
        latex,
    };
}

/** Lee el estado típico de la UI tras un cálculo. */
function salidaDe(env) {
    return {
        filas: env.el('tabla-cuerpo').children.map((r) => r.innerHTML),
        resumen: env.el('resumen-container').innerHTML,
        info: env.el('info-text').innerHTML,
        error: env.el('error-text').innerText,
        hayError: env.el('error-box').style.display === 'block',
        procedimiento: env.el('procedimiento-katex').innerHTML,
        graficos: env.graficos,
        latex: env.latex,
        ctx: env.ctx,
        el: env.el,
    };
}

/** Ejecuta calcularBiseccion() con los datos indicados y devuelve la salida. */
function correrBiseccion({ expr, a, b, criterio, valor }) {
    const env = cargarModulos(['js/biseccion.js']);

    env.el('funcion').value = expr;
    env.el('a').value = String(a);
    env.el('b').value = String(b);
    env.el('criterio').value = criterio;
    env.el('valorCriterio').value = String(valor);

    env.ctx.calcularBiseccion();

    return salidaDe(env);
}

/** Extrae la raíz aproximada del HTML del resumen. */
function raizDelResumen(resumen) {
    const m = /x = (N\/A|-?[\d.]+)/.exec(resumen);
    return m ? m[1] : null;
}

module.exports = {
    cargarModulos,
    correrBiseccion,
    raizDelResumen,
    salidaDe,
    crearMathShim,
};
