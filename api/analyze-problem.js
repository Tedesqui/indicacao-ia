/*
 * Ficheiro: api/analyze-problem.js
 * ATENÇÃO: Revertido para gpt-4o para TESTE (provavelmente causará timeout na Vercel gratuita)
 */

import express from 'express';
import OpenAI from 'openai';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' })); 

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const analyzeProblemHandler = async (req, res) => {
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
         return res.status(405).json({ message: 'Method Not Allowed.' });
    }
    
    try {
        const { image, latitude, longitude } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'A imagem é obrigatória.' });
        }

        const locationText = (latitude && longitude) 
            ? `Localização GPS: ${latitude}, ${longitude}.`
            : `Localização GPS indisponível.`;

        const promptText = `
        Você é um Assistente de Serviço Cívico. Analise a imagem.
        
        1. Se tiver nudez/inapropriado: is_inappropriate=true.
        2. Se NÃO for problema urbano: problem_type="Nenhum problema urbano".
        3. Se for problema:
           - is_inappropriate=false
           - problem_type="Resumo curto (ex: Buraco na rua)"
           - formal_description="Descrição formal e técnica do problema para uma prefeitura. Comece citando a localização: ${locationText}. Não use saudações."

        Retorne APENAS JSON:
        {
          "is_inappropriate": boolean,
          "problem_type": "string",
          "formal_description": "string"
        }
        `;

        const completion = await openai.chat.completions.create({
            // ## MUDANÇA: Voltando para GPT-4o completo ##
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
            max_tokens: 1500, // Aumentado novamente, mas pode ser limitado pelo timeout
        });

        const aiResultString = completion.choices[0].message.content;
        const parsedResult = JSON.parse(aiResultString);

        return res.status(200).json(parsedResult);

    } catch (error) {
        console.error('Erro:', error);
        return res.status(500).json({ 
            error: 'Erro interno.', 
            problem_type: "Erro no servidor", 
            formal_description: "Ocorreu um erro ao processar sua solicitação. Tente novamente." 
        });
    }
};

export default analyzeProblemHandler;
