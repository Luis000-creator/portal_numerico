// ============================================================================
// Itera - Vendor Lazy Loader (calculadora)
// ============================================================================
// mathjs y KaTeX solo se descargan tras la primera interacción (input/submit).
// Sin interacción no hay parse/compile de ~240KB y el TBT de carga cae.
// ============================================================================

const MATH_URL = 'https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.8.0/math.min.js';
const KATEX_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';

// Subresource Integrity: hash SHA-384 de los archivos EXACTOS de las URLs de
// arriba (versiones fijadas). Si cambia la versión, recalcular con:
//   curl -sL <URL> | openssl dgst -sha384 -binary | base64 -w0
// El navegador bloquea la carga si el archivo de la CDN no coincide.
const MATH_SRI = 'sha384-gJKcVYwVxispLQAFHIwGBvbEmMm4WableABNGVE9B88zRUh5ce+GMZJQ6ZU2dfcN';
const KATEX_SRI = 'sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8';

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

// Se exponen para poder verificarlos (tests/consola) y para reutilizarlos.
window.loadVendorScript = loadVendorScript;

window.Vendor = {
    // Hashes SRI que acompañan a cada librería (ver arriba).
    sri: { math: MATH_SRI, katex: KATEX_SRI },
    ensureMath() {
        if (typeof math !== 'undefined' && math.evaluate && math.parse) {
            return Promise.resolve();
        }
        if (!mathPromise) mathPromise = loadVendorScript(MATH_URL, MATH_SRI);
        return mathPromise;
    },
    ensureKatex() {
        if (typeof katex !== 'undefined' && katex.render) {
            return Promise.resolve();
        }
        if (!katexPromise) katexPromise = loadVendorScript(KATEX_URL, KATEX_SRI);
        return katexPromise;
    },
    // Motor completo de la calculadora: parse/evaluate + previews
    ensureCalc() {
        return Promise.all([this.ensureMath(), this.ensureKatex()]);
    },
};
