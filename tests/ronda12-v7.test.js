'use strict';
// ============================================================================
// Tests de la ronda 12 (13-nov): "Portal Numérico — Correcciones v7" sobre la
// base "Ronda 11" (386a35e). Cubre:
//   P0-1 visor expandido: se levanta el tope de 75ch (el texto ocupa todo el
//       ancho de la tarjeta y el H1 centrado deja de quedar a medias)
//   P0-2 visor en móvil: sin doble margen (el panel cancela con
//       margin-inline: -15px el padding de la tarjeta y vuelve a la raya)
//   P1-3 apunte PDF de prueba: sin cambio de código (se publica en el bucket
//       de Supabase, no en el repositorio; ver la nota al final)
//   P1-5 menor: etiquetas del eje Y con pastilla y clamp dentro del lienzo
//       (antes "22" tocaba la esquina superior derecha, con la caja del
//       texto saliéndose por arriba)
//   P1-6 "midad"→"mitad": sin cambio de código (el .md vive en Supabase)
//   Cierre: bump ?v de las 4 páginas (hoy ?v=12)
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

// Canvas falso que registra pastillas (fillRect) y texto (fillText) con el
// align y el tamaño de fuente vigentes, para poder medir la caja real de
// cada etiqueta y comprobar que ninguna toca el borde del lienzo.
function lienzoFalso(env, ancho) {
    const eventos = [];
    let alinear = 'left';
    let fuente = '10px monospace';
    const px = (f) => {
        const m = /(\d+(?:\.\d+)?)px/.exec(String(f));
        return m ? Number(m[1]) : 10;
    };
    const ctx2d = new Proxy({}, {
        get(t, k) {
            if (k === 'measureText') return (txt) => ({ width: String(txt).length * px(fuente) * 0.6 });
            if (k === 'fillText') return (txt, x, y) =>
                eventos.push({ tipo: 'texto', txt: String(txt), x, y, alinear, fuente: px(fuente) });
            if (k === 'fillRect') return (x, y, w, h) => eventos.push({ tipo: 'rect', x, y, w, h });
            return () => { };
        },
        set(t, k, v) {
            if (k === 'textAlign') alinear = v;
            else if (k === 'font') fuente = v;
            return true;
        },
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

// Caja de un texto (Courier: 0,6em por carácter, como mide el navegador)
function cajaDe(t) {
    const ancho = t.txt.length * t.fuente * 0.6;
    if (t.alinear === 'right') return { x0: t.x - ancho, x1: t.x };
    if (t.alinear === 'center') return { x0: t.x - ancho / 2, x1: t.x + ancho / 2 };
    return { x0: t.x, x1: t.x + ancho };
}

// --- P0-1 ------------------------------------------------------------------

test('P0-1: el visor expandido levanta el tope de 75ch (texto a todo el ancho)', () => {
    const css = leer('css', 'styles.css');

    // El tope sigue para las tarjetas colapsadas: ahí la columna sí es angosta
    const base = /\.visor-documento p,\s*\.visor-documento li \{[^}]*\}/.exec(css);
    assert.ok(base, 'falta la regla base de 75ch del visor');
    assert.match(base[0], /max-width: 75ch;/,
        'el tope de lectura de 75ch es de la tarjeta colapsada: sin él las líneas se estiran a la columna completa');

    // La regla del estado expandido: solo p/li, con especificidad más alta
    // (3 clases) para ganarle a la base aunque esté declarada después.
    const expandida = /\.apunte-card\.visor-abierto \.visor-documento p,\s*\.apunte-card\.visor-abierto \.visor-documento li \{[^}]*\}/.exec(css);
    assert.ok(expandida, 'falta la regla que levanta el tope al expandir');
    assert.match(expandida[0], /max-width: none;/,
        'con el visor a 2 columnas (~1136px) y el texto en 75ch (~680px) quedaban 400px de negro a la derecha y el H1 centrado sobre un ancho con el que no coincidía');

    // Nada vuelve a meter un tope cuando la tarjeta está abierta
    const reglas = [];
    const reG = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = reG.exec(css))) {
        reglas.push({ sel: m[1].replace(/\/\*[\s\S]*?\*\//g, ' ').trim(), cuerpo: m[2] });
    }
    for (const r of reglas.filter((r) => r.sel.includes('.visor-abierto'))) {
        assert.ok(!/max-width:\s*\d/.test(r.cuerpo),
            `la regla "${r.sel}" vuelve a cortar el ancho del visor expandido`);
    }
});

// --- P0-2 ------------------------------------------------------------------

test('P0-2: el panel del visor en móvil no va con doble margen', () => {
    const css = leer('css', 'styles.css');

    // La tarjeta pinta 15px de padding: eso es lo que hay que cancelar
    const tarjeta = /\.apunte-card,\s*\.card \{[^}]*\}/.exec(css);
    assert.ok(tarjeta && /padding: 15px;/.test(tarjeta[0]), 'falta el padding de 15px de la tarjeta');

    const bloques768 = bloquesMediaMax(css)
        .filter((b) => b.ancho === 768)
        .map((b) => b.cuerpo)
        .join('\n');

    // Reglas del bloque de móvil, por selector
    const reglas = [];
    const reG = /([^{}]+)\{([^{}]*)\}/g;
    let g;
    while ((g = reG.exec(bloques768))) reglas.push({ sel: g[1].trim(), cuerpo: g[2] });

    // El panel se extiende hasta el borde interior de la tarjeta…
    const base = reglas.find((r) => r.sel === '.visor-documento');
    assert.ok(base && /margin-inline: -15px;/.test(base.cuerpo),
        'en móvil el panel estaba inset dos veces (15px de la tarjeta + 16px propios): el texto no arrancaba donde el título de la tarjeta');

    // …y su padding horizontal vuelve a la raya del texto de la tarjeta
    const expandida = reglas.find((r) => r.sel === '.apunte-card.visor-abierto .visor-documento');
    assert.ok(expandida, 'falta la regla móvil del visor expandido');
    assert.match(expandida.cuerpo, /padding:\s*[\d.]+px\s+15px;/,
        'el padding horizontal del panel debe ser el mismo que el de la tarjeta (15px) para que el texto quede a la misma raya que el título');
});

// --- P1-5 (estático) -------------------------------------------------------

test('P1-5: las etiquetas del eje Y se recogen, se pintan al final y con clamp', () => {
    const js = leer('js', 'graficadora.js');

    // 1) Se recogen con la cuadrícula…
    assert.ok(js.includes('const etiquetasEjeY = [];'),
        'faltan las etiquetas del eje Y recogidas junto a la cuadrícula');

    // 2) …y se pintan DESPUÉS del intervalo punteado (si no, las guiones de
    //    [a, b] y las curvas quedan encima de la pastilla)
    assert.ok(
        js.indexOf('// --- Etiquetas del eje Y:') > js.indexOf('// --- Intervalo [a, b] ---'),
        'las etiquetas del eje Y deben dibujarse después del intervalo punteado, como las del eje X');

    // 3) Clamp horizontal: pastilla entera dentro del lienzo con 1px de
    //    margen, anclada al mismo aire de 10px que antes
    assert.ok(js.includes('const chipX = Math.min(Math.max(w - 10 - ancho, 1), Math.max(w - 1 - ancho, 1));'),
        'falta el clamp horizontal de la etiqueta Y');

    // 4) Clamp vertical: 14px sobre su línea, con 6px de mínimo por arriba
    //    (la marca de ymax cae en py = 0) y sin pisar la banda del eje X
    assert.ok(js.includes('const chipY = Math.min(Math.max(et.py - 14, 6), Math.max(alto - 14, 6));'),
        'falta el clamp vertical de la etiqueta Y');

    // 5) El clamp viejo (texto suelto en w - 10) ya no existe
    assert.ok(!js.includes('const ly = Math.max(py, 12);'),
        'quedó el clamp viejo de la etiqueta Y');
    assert.ok(!/fillText\(Number\(gy\.toPrecision\(4\)\), w - 10/.test(js),
        'la etiqueta Y sigue escribiéndose en w - 10 sin pastilla');

    // 6) No pisa las pastillas ya colocadas (a/b y eje X)
    assert.ok(js.includes('const pildoras = [];'),
        'falta el registro de pastillas que evita que la etiqueta Y pise las de a/b o las del eje X');
});

// --- P1-5 (funcional) ------------------------------------------------------

test('P1-5: con el lienzo a 350px, "22" ya no toca la esquina y toda la etiqueta Y lleva pastilla', () => {
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js', 'js/taylor.js', 'js/graficadora.js']);
    const { canvas, eventos } = lienzoFalso(env, 350);

    // La gráfica libre de Taylor: rango [min(a,x)-2, max(a,x)+2] = [-2, 3]
    env.ctx.graficarResultado('exp(x)', {
        rango: [-2, 3],
        curvas: [{ expr: 'exp(x)', color: '#00f0ff', etiqueta: 'f(x)', principal: true }],
    });

    const w = canvas.width;
    const alto = canvas.height;
    assert.ok(w >= 300 && alto >= 200, `lienzo inesperado: ${w}x${alto}`);

    // 1) Nada de lo pintado sale del lienzo. Antes la marca de ymax (py = 0)
    //    escribía "22" con la caja del texto en y = -3: cortada por arriba y
    //    pegada a la esquina superior derecha.
    const pastillas = eventos.filter((e) => e.tipo === 'rect' && e.h >= 10);
    assert.ok(pastillas.length >= 5, `se esperaban pastillas de los ejes (hay ${pastillas.length})`);
    for (const p of pastillas) {
        assert.ok(p.x >= 1 && p.y >= 1 && p.x + p.w <= w - 1 && p.y + p.h <= alto - 1,
            `pastilla fuera del lienzo: x=[${p.x}, ${p.x + p.w}] y=[${p.y}, ${p.y + p.h}] en ${w}x${alto}`);
    }
    for (const t of eventos.filter((e) => e.tipo === 'texto')) {
        const c = cajaDe(t);
        assert.ok(c.x0 >= 1 && c.x1 <= w - 1 && t.y - t.fuente >= 1 && t.y <= alto - 1,
            `el texto "${t.txt}" toca un borde: caja x=[${c.x0.toFixed(1)}, ${c.x1.toFixed(1)}] y=${t.y} en ${w}x${alto}`);
    }

    // 2) Las etiquetas de la columna derecha (las del eje Y) llevan pastilla
    //    debajo, con la caja del texto DENTRO de la pastilla.
    const ejeY = eventos.filter((e) => {
        if (e.tipo !== 'texto') return false;
        const c = cajaDe(e);
        return c.x0 > w - 60 && e.y < alto - 20;
    });
    assert.ok(ejeY.length >= 5, `faltan etiquetas del eje Y (hay ${ejeY.length})`);
    for (const t of ejeY) {
        const c = cajaDe(t);
        const pastilla = eventos.some((e) =>
            e.tipo === 'rect' && e.h >= 10 &&
            Math.abs(e.y - (t.y - 11)) < 0.5 &&
            e.x <= c.x0 + 0.01 && e.x + e.w >= c.x1 - 0.01);
        assert.ok(pastilla, `la etiqueta Y "${t.txt}" no tiene pastilla debajo`);
    }
});

// --- Cierre ----------------------------------------------------------------

test('Cierre: las 4 páginas piden styles.css?v=12', () => {
    const paginas = ['index.html', 'pages/calculadora.html', 'pages/apuntes.html', 'pages/social.html'];
    for (const archivo of paginas) {
        const html = leer(archivo);
        assert.ok(/href="[^"]*styles\.css\?v=12"/.test(html), `${archivo} no tiene ?v=12`);
        assert.ok(!/styles\.css\?v=(?!12)\d/.test(html), `${archivo} sigue en una versión vieja`);
    }
});

// ============================================================================
// Nota de la ronda 12 (P1-3 / P1-6): dos pendientes NO son de código.
//   P1-3 "publicar un apunte PDF de prueba": HECHO el 13-nov desde la API
//   pública (la restricción CHECK de archivo_url solo admite URLs del bucket
//   de Supabase, así que no puede resolverse desde este repositorio):
//     - storage: archivos_apuntes/prueba-visor.pdf  (200, application/pdf)
//     - fila:    id 51, "Prueba del visor PDF (ronda 12)"
//   Sin test de red por diseño; para quitarlo, SQL Editor en Supabase
//   (delete from public.apuntes where id = 51), porque RLS no permite
//   DELETE público.
//   P1-6 (corregir "midad"→"mitad" y la fórmula de x_m en el .md de
//   Bisección) tampoco es de código: el Markdown vive en la columna
//   contenido de Supabase, no en el repo.
// ============================================================================
