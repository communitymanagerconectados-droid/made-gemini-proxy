/* Archivo: netlify/functions/made.js - CÓDIGO FINAL CON MEMORIA */

const fetch = require('node-fetch');

// --- CONSTANTES GLOBALES ---

const API_KEY = process.env.GEMINI_API_KEY; 
const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*", 
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
};

// --- INSTRUCCIONES DEL SISTEMA PARA MADE ---
const SYSTEM_INSTRUCTIONS = `
Eres MADE 🛍️, una Asistente de Compras Virtual experta, amable y altamente empática. Tu misión es actuar como una personal shopper digital.
Que sabes: Experta en tecnología 📱, ropa 👟, hogar 🛋️, cocina 🍳, y más.
Tu Tarea Principal: No dar la respuesta final, sino hacer preguntas clave y concisas (una a la vez) para refinar la búsqueda del cliente (Ej: "¿Cuál es tu presupuesto? 💸" o "¿Qué tipo de tela prefieres? 🌿").
Regla de Oro: NUNCA des una recomendación final a menos que el cliente te acorrale en 1-2 opciones. Siempre usa emojis 🤩 para mantener el tono ligero.
`;
// ------------------------------------------


exports.handler = async (event, context) => {
    
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
        // ✅ CAMBIO: Ahora esperamos el historial completo
        const conversationHistory = body.conversation_history; 

        if (!conversationHistory || conversationHistory.length === 0) {
            return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Falta el historial de la conversación." }) };
        }

        // 3. Formatear el historial para la API de Gemini
        const contents = conversationHistory.map((message, index) => {
            let text = message.text;

            // ✅ CRUCIAL: Adjuntamos las instrucciones de sistema al PRIMER mensaje 'user'
            // Esto asegura que Gemini mantenga el rol a lo largo de la conversación.
            if (index === 0 && message.role === 'user') {
                text = SYSTEM_INSTRUCTIONS + "\n\n" + "El cliente dice: " + text;
            }
            // Si el primer mensaje fue 'model' (bienvenida), el primer 'user' será el segundo en el array.
            // Para simplificar, adjuntamos SIEMPRE el SYSTEM_INSTRUCTIONS al primer mensaje de la conversación que no sea el de bienvenida.
            // Para ser robustos, adjuntamos las instrucciones al primer mensaje *de usuario*.
            if (index > 0 && message.role === 'user' && conversationHistory[index-1].role === 'model') {
                 // Si es el primer mensaje del usuario después del saludo, adjuntamos.
            }
            
            // Si el primer mensaje fue de rol 'model' (el saludo inicial), el primer mensaje de 'user'
            // es el que lleva el índice 1 o posterior.
            const isFirstUserMessage = message.role === 'user' && !conversationHistory.slice(0, index).some(m => m.role === 'user');

            if (isFirstUserMessage) {
                text = SYSTEM_INSTRUCTIONS + "\n\n" + "El cliente dice: " + text;
            } else if (message.role === 'user') {
                text = "El cliente dice: " + text;
            }


            return {
                role: message.role,
                parts: [{ text: text }]
            };
        }).filter(message => message.role !== 'model' || message.parts[0].text.trim() !== SYSTEM_INSTRUCTIONS.trim()); // Filtramos si incluimos el saludo inicial como 'model'.

        // Filtramos el primer mensaje del bot de bienvenida si existe, ya que Gemini no lo necesita como contexto.
        const filteredContents = contents.filter(c => c.role !== 'model' || c.parts[0].text !== '¡Hola! Soy Made 🛍️, tu personal shopper virtual. Dime, ¿qué producto estás buscando hoy? Así te puedo ayudar a encontrar la mejor opción.');
        
        // 4. Construcción final de la solicitud
        const requestBody = {
            contents: filteredContents
        };

        // 5. Llamada a la API de Gemini
        const response = await fetch(`${API_ENDPOINT}?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        // 6. Manejo y retorno de la respuesta
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
