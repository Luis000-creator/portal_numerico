// ============================================================================
// Itera - Vendor Lazy Loader (calculadora + visor de Apuntes)
// ============================================================================
// mathjs, KaTeX, marked y DOMPurify solo se descargan tras la primera
// interacción (input/submit en la calculadora, abrir un apunte en Apuntes):
// sin eso no hay parse/compile de ~540KB y baja el coste de la primera carga.
// ============================================================================

const MATH_URL = 'https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.8.0/math.min.js';
const KATEX_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
// Librerías del visor Markdown de Apuntes: se cargan bajo demanda, no en
// el <head> de la página.
const MARKED_URL = 'https://cdn.jsdelivr.net/npm/marked@15.0.12/marked.min.js';
const PURIFY_URL = 'https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js';
const KATEX_CSS_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';

// Subresource Integrity: hash SHA-384 de los archivos EXACTOS de las URLs de
// arriba (versiones fijadas). Si cambia la versión, recalcular con:
//   curl -sL <URL> | openssl dgst -sha384 -binary | base64 -w0
// El navegador bloquea la carga si el archivo de la CDN no coincide.
const MATH_SRI = 'sha384-gJKcVYwVxispLQAFHIwGBvbEmMm4WableABNGVE9B88zRUh5ce+GMZJQ6ZU2dfcN';
const KATEX_SRI = 'sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8';
const MARKED_SRI = 'sha384-948ahk4ZmxYVYOc+rxN1H2gM1EJ2Duhp7uHtZ4WSLkV4Vtx5MUqnV+l7u9B+jFv+';
const PURIFY_SRI = 'sha384-+VfUPEb0PdtChMwmBcBmykRMDd+v6D/oFmB3rZM/puCMDYcIvF968OimRh4KQY9a';
const KATEX_CSS_SRI = 'sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV';

function loadVendorScript(src, integrity) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-vendor="${src}"]`);
        if (existing) {
            if (existing.dataset.loaded === '1') return resolve();
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error(`No se pudo cargar ${src}`)));
            return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.dataset.vendor = src;
        if (integrity) {
            s.integrity = integrity;
            s.crossOrigin = 'anonymous';
        }
        s.onload = () => { s.dataset.loaded = '1'; resolve(); };
        s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
        document.head.appendChild(s);
    });
}

let mathPromise = null;
let katexPromise = null;
let markdownPromise = null;
let katexCssPromise = null;

// Hoja de estilo bajo demanda (KaTeX CSS: solo se necesita cuando hay
// fórmulas que pintar). Si el <head> ya la trae (la calculadora), no se
// duplica: se resuelve de inmediato.
function loadVendorStylesheet(href, integrity) {
    return new Promise((resolve, reject) => {
        const existente = document.querySelector(`link[href="${href}"]`);
        if (existente) return resolve();
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = href;
        if (integrity) {
            l.integrity = integrity;
            l.crossOrigin = 'anonymous';
        }
        l.onload = () => resolve();
        l.onerror = () => reject(new Error(`No se pudo cargar ${href}`));
        document.head.appendChild(l);
    });
}

function asegurarKatexCss() {
    if (!katexCssPromise) katexCssPromise = loadVendorStylesheet(KATEX_CSS_URL, KATEX_CSS_SRI);
    return katexCssPromise;
}

// Se exponen para poder verificarlos (tests/consola) y para reutilizarlos.
window.loadVendorScript = loadVendorScript;
window.loadVendorStylesheet = loadVendorStylesheet;

window.Vendor = {
    // Hashes SRI que acompañan a cada librería (ver arriba).
    sri: { math: MATH_SRI, katex: KATEX_SRI, marked: MARKED_SRI, purify: PURIFY_SRI },
    ensureMath() {
        if (typeof math !== 'undefined' && math.evaluate && math.parse) {
            return Promise.resolve();
        }
        if (!mathPromise) mathPromise = loadVendorScript(MATH_URL, MATH_SRI);
        return mathPromise;
    },
    ensureKatex() {
        // JS + CSS: sin la hoja el KaTeX renderiza sin tipografía (y en
        // Apuntes la hoja ya no viene en el <head>).
        const js = (typeof katex !== 'undefined' && katex.render)
            ? Promise.resolve()
            : (katexPromise || (katexPromise = loadVendorScript(KATEX_URL, KATEX_SRI)));
        return Promise.all([asegurarKatexCss(), js]);
    },
    // Visor Markdown de Apuntes (marked traduce, DOMPurify sanitiza)
    ensureMarkdown() {
        if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
            return Promise.resolve();
        }
        if (!markdownPromise) {
            markdownPromise = Promise.all([
                loadVendorScript(MARKED_URL, MARKED_SRI),
                loadVendorScript(PURIFY_URL, PURIFY_SRI),
            ]);
        }
        return markdownPromise;
    },
    // Motor completo de la calculadora: parse/evaluate + previews
    ensureCalc() {
        return Promise.all([this.ensureMath(), this.ensureKatex()]);
    },
};
