/*
 * Ficheiro: api/analyze-problem.js
 * Modificado para usar o Google Gemini (gemini-1.5-flash)
 */

import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' })); 

// Inicializa o cliente do Gemini com a chave configurada no painel da Vercel
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Função auxiliar para extrair o mimeType e os dados base64 da string da imagem
function parseBase64Image(dataString) {
    const matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        throw new Error('Formato de imagem inválido. Esperado data URI base64.');
    }
    return {
        inlineData: {
            mimeType: matches[1],
            data: matches[2]
        }
    };
}

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
           * NÃO inclua coordenadas GPS (latitude/longitude) no texto.
           * NÃO inclua dados sobre o endereço no texto.
           * NÃO inclua a frase "a imagem mostra" no texto pois essa informação é redundante.
           - formal_description="Descrição formal e técnica do problema para uma prefeitura. Não use saudações."

        Retorne APENAS um JSON válido com esta exata estrutura:
        {
          "is_inappropriate": boolean,
          "problem_type": "string",
          "formal_description": "string"
        }
        `;

        // Prepara a imagem para o formato exigido pelo Gemini
        const imagePart = parseBase64Image(image);

        // Seleciona o modelo Flash (mais rápido para evitar timeout) e força a saída em JSON
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        // Envia o prompt de texto e a imagem simultaneamente
        const result = await model.generateContent([promptText, imagePart]);
        const aiResultString = result.response.text();
        
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
