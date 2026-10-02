// ==========================================================
// PORTAL NUMÉRICO - CONEXIÓN CON SUPABASE
// ==========================================================

// URL pública del proyecto
const SUPABASE_URL =
    "https://ekmgyckzxhuiyzlncryw.supabase.co";

// Publishable Key pública.
// Esta clave puede utilizarse en el frontend de GitHub Pages.
const SUPABASE_KEY =
    "sb_publishable_xQlhnjx88qMmDn0wBsbY5A_19a-h7QI";

// Crear cliente de Supabase (solo si el UMD ya cargó; con defer el orden está garantizado)
if (window.supabase && window.supabase.createClient) {
    window.supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );
} else {
    window.addEventListener('load', () => {
        if (window.supabase && window.supabase.createClient && !window.supabaseClient) {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            if (document.getElementById('apuntes-remotos') && typeof cargarApuntesRemotos === 'function') {
                cargarApuntesRemotos();
            }
        }
    });
}
