/*
 * Ficheiro: api/analyze-problem.js
 * ROTA: /api/analyze-problem (POST)
 * ATUALIZADO: Convertido para sintaxe 'import' (ESM)
 * e confirma o uso de 'latitude' e 'longitude'.
 */

import express from 'express';
import OpenAI from 'openai';
import cors from 'cors';

// Inicializa o app Express
const app = express();

// Middlewares
app.use(cors()); // Habilita o CORS
app.use(express.json({ limit: '50mb' })); // Habilita JSON com limite de 50mb para a imagem

// Inicializa o cliente OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// O handler principal da rota
const analyzeProblemHandler = async (req, res) => {
    
    // Responde ao método GET (usado por Vercel para "acordar" a função)
    if (req.method === 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed. Use POST com dados de imagem.' });
    }
    
    // Garante que é um POST
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed.' });
    }

    try {
        // Extrai os dados do corpo da requisição
        const { image, latitude, longitude } = req.body;

        // Validação básica
        if (!image) {
            return res.status(400).json({ error: 'A imagem é obrigatória para análise.' });
        }

        // Formata o texto de localização (se existir)
        const locationText = (latitude && longitude && latitude !== "null") 
            ? `Localização GPS: Latitude ${latitude}, Longitude ${longitude}.`
            : `Localização GPS indisponível.`;

        // Prompt de IA (incluindo regras de segurança e o texto de localização)
        const promptText = `
        Você é um **Assistente de Serviço Cívico e Moderador de Conteúdo**. Sua tarefa primária é analisar a imagem fornecida.

        REGRAS DE FILTRAGEM DE SEGURANÇA (MUITO IMPORTANTES):
        1.  Se a imagem contiver nudez explícita, partes íntimas, ou conteúdo sexualmente sugestivo, você DEVE parar imediatamente a análise e definir "is_inappropriate" como true.
        2.  Se a imagem não for de um problema urbano identificável (ex: é uma selfie, uma paisagem que não tem nada de errado), defina "is_inappropriate" como false e "problem_type" como "Nenhum problema urbano detectado."

        Se o conteúdo for APROPRIADO e for um PROBLEMA URBANO:
        1.  Defina "is_inappropriate" como false.
        2.  **Identificação:** Identifique o problema principal (ex: "Buraco na pavimentação", "Poste de luz queimado", "Lixo acumulado").
        3.  **Geração de Texto Formal:** Gere uma descrição detalhada e formal (em Português do Brasil) em formato de corpo de e-mail. Use um tom respeitoso e solicite uma providência.
        4.  **Localização:** Inclua a seguinte informação de localização no início da descrição gerada: "${locationText}".

        O Formato de Saída DEVE ser um único objeto JSON, contendo SEMPRE os três campos, mesmo em caso de erro de detecção ou filtragem:

        {
          "is_inappropriate": true/false,
          "problem_type": "O problema identificado (uma frase curta)",
          "formal_description": "O corpo completo da reclamação formal com a localização (ou uma mensagem de erro se imprópria)."
        }
        `;

        // Chamada para a API da OpenAI (gpt-4o)
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            response_format: { type: "json_object" }, // Pede a resposta em formato JSON
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: promptText },
                        { type: "image_url", image_url: { "url": image } }, // Envia a imagem (base64 data URI)
                    ],
                },
            ],
            max_tokens: 1500,
        });

        // Obtém e faz o parse da resposta JSON da IA
        const aiResultString = completion.choices[0].message.content;
        const parsedResult = JSON.parse(aiResultString);

        // Retorna o JSON parseado para o frontend
        return res.status(200).json(parsedResult);

    } catch (error) {
        // Tratamento de erro
        console.error('Erro na análise da IA:', error);
        return res.status(500).json({ 
            error: 'Falha interna ao analisar a imagem. Verifique a chave da API.', 
            is_inappropriate: false, 
            problem_type: "Erro interno", 
            formal_description: "Não foi possível gerar a descrição devido a uma falha no servidor." 
        });
    }
};

// Define as rotas que este handler irá responder
app.post('/api/analyze-problem', analyzeProblemHandler);
app.get('/api/analyze-problem', analyzeProblemHandler); // Lida com GETs

// Exporta o app para o Vercel (ou outro)
export default app;
