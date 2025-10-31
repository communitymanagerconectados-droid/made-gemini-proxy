/* Archivo: netlify/functions/made.js - CÓDIGO FINAL CON MEMORIA Y EFICIENCIA */

const fetch = require('node-fetch');

// --- CONSTANTES GLOBALES ---

const API_KEY = process.env.GEMINI_API_KEY; 
const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*", 
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
};

// --- INSTRUCCIONES DEL SISTEMA PARA MADE (¡CORREGIDAS PARA SER BREVES!) ---
const SYSTEM_INSTRUCTIONS = `
Eres MADE 🛍️, una Asistente de Compras Virtual experta, amable y altamente empática.
OBJETIVO PRINCIPAL: Identificar la necesidad del cliente, sus criterios (presupuesto, uso, etc.) y responder de forma BREVE, RÁPIDA y eficiente.
REGLAS ESTRICTAS DE EFICIENCIA:
1.  **LÍMITE DE PREGUNTAS**: NO hagas más de 3 preguntas CLAVE en total durante la conversación. Utiliza las primeras 2-3 preguntas para obtener toda la información esencial (presupuesto, uso principal, características).
2.  **CONCISIÓN EXTREMA**: Sé extremadamente CONCISA en todas tus respuestas y preguntas. Ve directo al punto y responde con el menor número de palabras posible. No des introducciones o cierres excesivamente largos.
3.  **ACCIÓN RÁPIDA**: Una vez que tengas la información esencial, ofrece la recomendación o el siguiente paso, sin dar rodeos.
4.  **TONO**: Mantén un tono amigable y usa emojis 🤩, pero la prioridad es la eficiencia y la brevedad.
`;
// ------------------------------------------


exports.handler = async (event, context) => {
    
    // 1. Manejo de Peticiones 'preflight' (CORS) y Verificaciones Iniciales
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, headers: CORS_HEADERS, body: "Método no permitido. Usa POST." };
    }
    if (!API_KEY) {
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: "Clave de API no configurada en el servidor." }) };
    }

    try {
        const body = JSON.parse(event.body);
        const conversationHistory = body.conversation_history; 

        if (!conversationHistory || conversationHistory.length === 0) {
            return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Falta el historial de la conversación." }) };
        }

        // 2. Formatear el historial para la API de Gemini
        const contents = conversationHistory.map((message, index) => {
            let text = message.text;
            
            // Determinar si es el primer mensaje del usuario para adjuntar las instrucciones
            const isFirstUserMessage = message.role === 'user' && !conversationHistory.slice(0, index).some(m => m.role === 'user');

            if (isFirstUserMessage) {
                // Adjuntamos las instrucciones de sistema al primer mensaje de usuario
                text = SYSTEM_INSTRUCTIONS + "\n\n" + "El cliente dice: " + text;
            } else if (message.role === 'user') {
                // Los mensajes subsiguientes del usuario solo se etiquetan
                text = "El cliente dice: " + text;
            }

            return {
                role: message.role,
                parts: [{ text: text }]
            };
        });

        // Filtramos el mensaje de bienvenida del bot si existe, para que no interfiera con el rol
        const filteredContents = contents.filter(c => c.role !== 'model' || !c.parts[0].text.includes('¡Hola! Soy Made'));
        
        // 3. Construcción final de la solicitud
        const requestBody = {
            contents: filteredContents
        };

        // 4. Llamada a la API de Gemini
        const response = await fetch(`${API_ENDPOINT}?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        // 5. Manejo y retorno de la respuesta
        const data = await response.json();

        if (!response.ok) {
            const errorMessage = data.error ? data.error.message : "Error desconocido de Gemini.";
            return {
                statusCode: response.status,
                headers: CORS_HEADERS, 
                body: JSON.stringify({ error: errorMessage })
            };
        }

        const geminiResponseText = data.candidates[0].content.parts[0].text; 

        return {
            statusCode: 200,
            headers: CORS_HEADERS, 
            body: JSON.stringify({ text: geminiResponseText }),
        };

    } catch (error) {
        console.error("Error al procesar la solicitud:", error);
        return { 
            statusCode: 500, 
            headers: CORS_HEADERS, 
            body: JSON.stringify({ error: "Error interno del servidor (Proxy)." }) 
        }
    }
};
