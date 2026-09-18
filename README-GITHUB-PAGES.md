# Portal Numérico - versión GitHub Pages

Esta versión es estática: no necesita ejecutar Spring Boot ni tener tu laptop encendida. GitHub Pages sirve `index.html`, `calculadora.html`, `apuntes.html`, `css/` y `js/`.

## 1. Base de datos compartida

La página está preparada para Supabase (PostgreSQL). Supabase se conecta desde el navegador mediante `supabase-js`.

1. Crea un proyecto en Supabase.
2. Abre SQL Editor.
3. Ejecuta `sql/supabase.sql` (crea la tabla `apuntes` y el bucket `archivos_apuntes`).
4. Ve a Project Settings / API y copia la URL del proyecto y la Publishable/Anon key.
5. Abre `js/supabase-config.js` y reemplaza los valores de ejemplo.
6. Sube todo el proyecto a GitHub (`index.html` es la pagina raiz).

## 2. GitHub Pages

En el repositorio: Settings -> Pages -> Deploy from a branch -> `main` -> `/ (root)` -> Save.

## 3. Qué funciona sin servidor

- Resolución de bisección en el navegador (`calculadora.html`).
- Tabla de iteraciones.
- Apuntes colaborativos con formulas KaTeX y adjuntos PDF/Markdown (`apuntes.html`).
- Buscador de apuntes.
- Fondo animado.
- Apuntes compartidos mediante Supabase.
- Diseno responsive para celular.

## 4. Seguridad

El archivo `supabase-config.js` contiene una clave publicable/anon, no una clave `service_role`. La protección real de la base depende de RLS/policies. El SQL incluido permite lectura e inserción públicas porque el objetivo actual es un portal colaborativo de clase.

Si quieres que solo tus compañeros puedan publicar y que nadie externo pueda hacerlo, hay que añadir autenticación antes de publicar.
