/*
 * Ficheiro: api/analyze-problem.js
 * CORREÇÃO: Adicionado suporte para requisição OPTIONS (CORS)
 */

import express from 'express';
import OpenAI from 'openai';
import cors from 'cors'; // Garanta que 'cors' está instalado no package.json

const app = express();

// Aplica o middleware CORS para permitir acesso de qualquer origem
app.use(cors());
app.use(express.json({ limit: '50mb' })); 

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const analyzeProblemHandler = async (req, res) => {
    
    // ## CORREÇÃO CRÍTICA: Aceitar o "aperto de mão" do Android ##
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
         return res.status(405).json({ message: 'Method Not Allowed. Use POST para análise.' });
    }
    
    if (req.method !== 'POST') {
         return res.status(405).json({ message: 'Method Not Allowed.' });
    }
    
    try {
        const { image, latitude, longitude } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'A imagem é obrigatória para análise.' });
        }

        const locationText = (latitude && longitude) 
            ? `O problema foi relatado na seguinte localização GPS: Latitude ${latitude}, Longitude ${longitude}.`
            : `A localização GPS não foi fornecida.`;

        const promptText = `
        Você é um **Assistente de Serviço Cívico e Moderador de Conteúdo**. Sua tarefa primária é analisar a imagem fornecida para identificar um problema urbano.

        REGRAS DE FILTRAGEM DE SEGURANÇA:
        1.  Se a imagem contiver nudez explícita, partes íntimas, ou conteúdo sexualmente sugestivo, defina "is_inappropriate" como true.
        2.  Se a imagem não for de um problema urbano identificável (ex: é uma selfie), defina "is_inappropriate" como false e "problem_type" como "Nenhum problema urbano detectado."

        Se o conteúdo for APROPRIADO e for um PROBLEMA URBANO:
        1.  Defina "is_inappropriate" como false.
        2.  **Identificação:** Identifique o problema principal (ex: "Buraco na pavimentação", "Poste de luz queimado", "Lixo acumulado").
        
        3.  **Geração de Texto Formal (IMPORTANTE):** Gere uma descrição detalhada e objetiva (em Português do Brasil) que descreva *apenas* o problema visto na imagem.
            * **Inclua a localização:** Comece a descrição com a seguinte informação: "${locationText}".
            * **NÃO inclua saudações** (como 'Prezado Vereador').
            * **NÃO inclua uma assinatura** (como 'Atenciosamente' ou 'Seu Nome').
            * O texto deve ser *apenas* a descrição do problema.

        O Formato de Saída DEVE ser um único objeto JSON:

        {
          "is_inappropriate": true/false,
          "problem_type": "O problema identificado (uma frase curta)",
          "formal_description": "A descrição pura do problema da imagem, começando com a localização e sem saudações ou assinaturas."
        }
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: promptText },
                        { type: "image_url", image_url: { "url": image } },
                    ],
                },
            ],
            max_tokens: 1500,
        });

        const aiResultString = completion.choices[0].message.content;
        const parsedResult = JSON.parse(aiResultString);

        return res.status(200).json(parsedResult);

    } catch (error) {
        console.error('Erro na análise da IA:', error);
        return res.status(500).json({ error: 'Falha interna ao analisar a imagem.', is_inappropriate: false, problem_type: "Erro interno", formal_description: "Não foi possível gerar a descrição." });
    }
};

export default analyzeProblemHandler;
