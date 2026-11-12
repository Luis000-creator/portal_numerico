# Portal Numérico

Proyecto académico para la materia de Métodos Numéricos. Plataforma web estática con calculadora interactiva de los siete métodos, apuntes colaborativos con fórmulas LaTeX y fondo animado de partículas.

## Métodos disponibles

La calculadora (`pages/calculadora.html`) implementa los 7 métodos de la materia:

1. **Bisección** — con intervalo automático, detección de polos y verificación del residuo.
2. **Punto fijo** — con aviso de divergencia (`|g'(x₀)| ≥ 1`) y recta `y = x` en la gráfica.
3. **Newton-Raphson** — derivada automática con mathjs.
4. **Series de Taylor / Maclaurin** — evaluación de `Pₙ(x)` con tabla de términos.
5. **Interpolación lineal de Lagrange** — con dos puntos.
6. **Interpolación polinomial de Lagrange** — con n puntos editables.
7. **Regla de Simpson 1/3** — con n par, tabla de nodos y valor final `I ≈`.

## Estructura

```
portal_numerico/
├── index.html              # Landing page (bienvenida, página raíz)
├── pages/
│   ├── calculadora.html    # Calculadora: los 7 métodos
│   ├── apuntes.html        # Apuntes colaborativos con visor PDF/Markdown
│   └── social.html         # Redes y contacto del equipo
├── README-GITHUB-PAGES.md  # Guía de despliegue en GitHub Pages
├── css/
│   └── styles.css          # Estilos del sitio (tema oscuro + responsive)
├── js/
│   ├── supabase-config.js  # Conexión con Supabase (clave pública)
│   ├── biseccion.js        # Evaluador mathjs, bisección y helpers compartidos
│   ├── punto-fijo.js       # Selector de método y punto fijo
│   ├── newton-raphson.js   # Newton-Raphson con derivada simbólica
│   ├── taylor.js           # Series de Taylor / Maclaurin
│   ├── lagrange.js         # Interpolación lineal y polinomial
│   ├── simpson.js          # Regla de Simpson 1/3
│   ├── graficadora.js      # Gráfica en canvas (curvas, raíz, y = x)
│   ├── apuntes.js          # Apuntes en Supabase, KaTeX y visor integrado
│   ├── vendor-loader.js    # Carga diferida de mathjs y KaTeX
│   └── canvas-animation.js # Animación de estrellas y símbolos
├── tests/
│   └── *.test.js           # Suite de regresión (node:test, sin dependencias)
├── sql/
│   └── supabase.sql        # Esquema de la tabla apuntes (ejecutar en Supabase)
```

## Tests

No requieren dependencias: usan `node:test` de Node.js (≥ 18).

```bash
node --test tests/*.test.js
```

Se lista explícitamente `tests/*.test.js` en lugar de `node --test tests/`: en algunos
entornos (p. ej. Node 24) el comando con directorio no recoge los archivos y falla.

## Despliegue

Ver `README-GITHUB-PAGES.md` para los pasos de base de datos y GitHub Pages.
