/*
 * Ficheiro: api/index.js (Servidor Principal)
 * ROTA DA IA: /api/analyze-problem (Nenhuma mudança necessária aqui)
 * ROTA DE ENVIO: /api/send-email (Atualizada para receber GPS e Telefone)
 */

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Configuração da OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// ----------------------------------------------------------------------
// ROTA 1: IDENTIFICAÇÃO E GERAÇÃO DE TEXTO POR IA (/api/analyze-problem)
// (Esta rota está PERFEITA. Nenhuma alteração necessária.)
// ----------------------------------------------------------------------

app.get('/api/analyze-problem', (req, res) => {
    res.status(405).json({ message: 'Method Not Allowed. Esta rota só aceita requisições POST com dados de imagem.' });
});

app.post('/api/analyze-problem', async (req, res) => {
    try {
        const { image, latitude, longitude } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'A imagem é obrigatória para análise.' });
        }

        const locationText = (latitude && longitude)
            ? `Localização GPS: Latitude ${latitude}, Longitude ${longitude}.`
            : `Localização GPS indisponível.`;

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
        return res.status(500).json({ error: 'Falha interna ao analisar a imagem. Verifique a chave da API.', is_inappropriate: false, problem_type: "Erro interno", formal_description: "Não foi possível gerar a descrição devido a uma falha no servidor." });
    }
});
