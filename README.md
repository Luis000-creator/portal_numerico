# Portal Numerico

Proyecto academico para la materia de Metodos Numericos. Plataforma web estatica con calculadora interactiva del Metodo de Biseccion, apuntes colaborativos con formulas LaTeX y fondo animado de particulas.

## Estructura

```
portal_numerico/
├── index.html              # Landing page (bienvenida, pagina raiz)
├── calculadora.html        # Calculadora del metodo de biseccion
├── apuntes.html            # Apuntes colaborativos con visor PDF/Markdown
├── README-GITHUB-PAGES.md  # Guia de despliegue en GitHub Pages
├── css/
│   └── styles.css          # Estilos del sitio (tema oscuro + responsive)
├── js/
│   ├── supabase-config.js  # Conexion con Supabase (clave publica)
│   ├── biseccion.js        # Evaluador mathjs y metodo de biseccion
│   ├── apuntes.js          # Apuntes en Supabase, KaTeX y visor integrado
│   └── canvas-animation.js # Animacion de estrellas y simbolos
└── sql/
    └── supabase.sql        # Esquema de la tabla apuntes (ejecutar en Supabase)
```

## Despliegue

Ver `README-GITHUB-PAGES.md` para los pasos de base de datos y GitHub Pages.
