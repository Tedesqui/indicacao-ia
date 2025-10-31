/*
 * Ficheiro: api/index.js (ou o nome do seu arquivo de servidor principal)
 * CONTÉM: ROTA DA IA (/api/analyze-problem) E ROTA DE ENVIO (/api/send-email)
 * ATUALIZADO: Inclui filtragem de segurança na análise da IA.
 */

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
app.use(cors());

// Habilita o Express para ler corpos JSON (essencial para a Base64)
// Aumentamos o limite para suportar a imagem base64 (até 10MB)
app.use(express.json({ limit: '10mb' })); 


// Configuração da OpenAI
// ATENÇÃO: A variável OPENAI_API_KEY deve ser configurada no ambiente.
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// ----------------------------------------------------------------------
// ROTA 1: IDENTIFICAÇÃO E GERAÇÃO DE TEXTO POR IA (/api/analyze-problem)
// ----------------------------------------------------------------------
app.post('/api/analyze-problem', async (req, res) => {
    try {
        const { image, latitude, longitude } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'A imagem é obrigatória para análise.' });
        }

        const locationText = (latitude && longitude) 
            ? `Localização GPS: Latitude ${latitude}, Longitude ${longitude}.`
            : `Localização GPS indisponível.`;

        // Prompt de IA para Identificação, Formalização E FILTRAGEM DE CONTEÚDO
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
        // Em caso de falha completa da API, retorna um erro genérico
        return res.status(500).json({ error: 'Falha interna ao analisar a imagem. Verifique a chave da API.', is_inappropriate: false, problem_type: "Erro interno", formal_description: "Não foi possível gerar a descrição devido a uma falha no servidor." });
    }
});


// ----------------------------------------------------------------
// ROTA 2: ENVIO DE E-MAIL ADAPTADA (/api/send-email)
// ----------------------------------------------------------------

app.post('/api/send-email', (req, res) => {
    // Dados são extraídos do corpo JSON
    const { nome, endereco, descricao, imagem_base64, problema } = req.body; 
    
    // Configura o Nodemailer
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    // Montagem do E-mail
    const mailOptions = {
        from: `Formulário de Indicação IA <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_RECEIVER,
        subject: `[INDICAÇÃO IA] ${problema || 'Nova Indicação de Problema Urbano'}`, 
        html: `
            <h1>Nova Indicação Automatizada por IA</h1>
            <p><strong>Problema Identificado:</strong> ${problema || 'N/A'}</p>
            <p><strong>Relato Formal Gerado pela IA:</strong></p>
            <div style="border: 1px solid #ccc; padding: 15px; background: #f9f9f9;">
                ${descricao.replace(/\n/g, '<br>')}
            </div>
            <p><strong>Enviado por:</strong> ${nome}</p>
            <p><strong>Localização (GPS):</strong> ${endereco}</p>
            <hr>
            <p>${imagem_base64 ? 'Uma imagem foi anexada para referência.' : 'Nenhuma imagem enviada.'}</p>
        `,
        attachments: [], 
    };

    // Cria o anexo a partir da string Base64
    if (imagem_base64) {
        // Remove o prefixo 'data:image/jpeg;base64,'
        const base64Data = imagem_base64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        mailOptions.attachments.push({
            filename: `problema-urbano-${Date.now()}.jpeg`, 
            content: imageBuffer,
            contentType: 'image/jpeg',
        });
    }

    // Envia o e-mail
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Erro ao enviar e-mail:', error);
            return res.status(500).json({ message: 'Falha ao enviar o e-mail.' });
        }
        res.status(200).json({ message: 'E-mail enviado com sucesso!' });
    });
});

module.exports = app;