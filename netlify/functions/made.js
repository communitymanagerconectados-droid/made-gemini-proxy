/* Archivo: netlify/functions/made.js - CÓDIGO FINAL MULTIPROPÓSITO (CALCULO + CHAT) */

const fetch = require('node-fetch');

// --- CONSTANTES GLOBALES ---

const API_KEY = process.env.GEMINI_API_KEY; 
const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*", 
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
};

// --- PROMPTS DE MODO DE RENDIMIENTO ---
const PERFORMANCE_PROMPT = (componentsList) => `
Tu función es evaluar la lista de componentes de PC a continuación para un rendimiento general en gaming y tareas exigentes.
DEBES RESPONDER SOLAMENTE CON UNA ÚNICA PALABRA: 'Noob', 'Veterano', 'Elite' o 'Legendario'. No incluyas explicaciones, emojis ni texto adicional.
Componentes a evaluar:
${componentsList}
`;

// --- PROMPTS DE MODO DE CHAT CONSULTIVO ---
const SYSTEM_INSTRUCTIONS_MADE = `
Eres MADE 🛍️, una Asistente de Compras Virtual experta en ensamblaje de PCs.
Tu rol es actuar como una consejera de PC. Tienes acceso a la lista actual de componentes del cliente y al historial de conversación.
OBJETIVO: Ayudar al cliente a optimizar su equipo o resolver dudas.
REGLAS:
1.  **Contexto**: Siempre evalúa la lista de componentes actual del cliente para dar consejo.
2.  **Búsqueda Externa (Precios/Disponibilidad)**: Si el cliente pregunta por precios o disponibilidad de productos en Colombia (o Amazon Colombia), DEBES usar la herramienta de búsqueda de Google.
3.  **Brevedad**: Responde de forma breve y concisa.
`;

// ----------------------------------------------------------------------
// --- FUNCIONES MANEJADORAS (Lógica de Negocio) ---
// ----------------------------------------------------------------------

/** Maneja la petición de cálculo de rendimiento simple (solo devuelve una palabra). */
async function handlePerformanceCalculation(components) {
    const componentsList = Object.entries(components).map(([key, value]) => `${key}: ${value}`).join(', ');
    const userPrompt = PERFORMANCE_PROMPT(componentsList);

    const requestBody = {
        contents: [{
            role: "user",
            parts: [{ text: userPrompt }]
        }]
    };

    const response = await fetch(`${API_ENDPOINT}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    const resultText = data.candidates[0]?.content?.parts[0]?.text || "Error de IA.";

    // La respuesta del proxy debe ser solo el texto (Noob, Veterano, Elite, Legendario)
    return {
        statusCode: response.ok ? 200 : response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({ text: resultText.trim().replace(/[^a-zA-ZñÑáéíóúÁÉÍÓÚ\s]/g, '').split(/\s+/).pop() }) // Intenta aislar solo la palabra final
    };
}


/** Maneja la consulta de Made con historial y herramienta de búsqueda. */
async function handleMadeConsultation(components, userPrompt, conversationHistory) {
    const componentsList = Object.entries(components).map(([key, value]) => `${key}: ${value}`).join(', ');

    // 1. Formatear el historial para la API de Gemini
    const contents = conversationHistory.map((message, index) => {
        let text = message.text;
        
        const isFirstUserMessage = message.role === 'user' && !conversationHistory.slice(0, index).some(m => m.role === 'user');

        if (isFirstUserMessage) {
            // Adjuntamos el SYSTEM_INSTRUCTIONS y la lista de componentes al primer mensaje de usuario
            text = SYSTEM_INSTRUCTIONS_MADE + 
                   `\n\n[CONTEXTO DE EQUIPO ACTUAL: ${componentsList}]` + 
                   "\n\nEl cliente dice: " + text;
        } else if (message.role === 'user') {
            text = "El cliente dice: " + text;
        }

        return {
            role: message.role,
            parts: [{ text: text }]
        };
    }).filter(c => c.role !== 'model' || !c.parts[0].text.includes('¡Hola! Soy Made')); // Filtra el saludo inicial

    // 2. Construcción final de la solicitud (¡CON GOOGLE SEARCH TOOL!)
    const requestBody = {
        contents: contents,
        tools: [{ googleSearch: {} }] // 💡 Habilitar la búsqueda de Google para precios
    };

    const response = await fetch(`${API_ENDPOINT}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    const resultText = data.candidates[0]?.content?.parts[0]?.text || "Error de IA.";

    return {
        statusCode: response.ok ? 200 : response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({ text: resultText }),
    };
}

// ----------------------------------------------------------------------
// --- HANDLER PRINCIPAL (El Router de Peticiones) ---
// ----------------------------------------------------------------------

exports.handler = async (event, context) => {
    
    // ... (CORS y verificaciones iniciales de API_KEY) ...
    if (event.httpMethod === "OPTIONS") { return { statusCode: 204, headers: CORS_HEADERS, body: '' }; }
    if (event.httpMethod !== "POST") { return { statusCode: 405, headers: CORS_HEADERS, body: "Método no permitido. Usa POST." }; }
    if (!API_KEY) { return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: "Clave de API no configurada en el servidor." }) }; }

    try {
        const body = JSON.parse(event.body);
        const requestType = body.request_type;

        // 💡 El Router: Decide qué función ejecutar
        if (requestType === 'PERFORMANCE_CALC') {
            const components = body.components || {};
            return handlePerformanceCalculation(components); 

        } else if (requestType === 'MADE_CONSULTATION') {
            const components = body.components || {};
            const userPrompt = body.user_prompt || '';
            const history = body.conversation_history || [];
            return handleMadeConsultation(components, userPrompt, history);

        } else {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: "request_type no especificado. Debe ser PERFORMANCE_CALC o MADE_CONSULTATION." })
            };
        }

    } catch (error) {
        console.error("Error al procesar la solicitud:", error);
        return { 
            statusCode: 500, 
            headers: CORS_HEADERS, 
            body: JSON.stringify({ error: `Error interno del servidor: ${error.message}` }) 
        };
    }
};
