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


// ----------------------------------------------------------------
// ROTA 2: ENVIO DE E-MAIL ADAPTADA (/api/send-email)
// (MODIFICADA PARA INCLUIR GPS DE ALTA PRECISÃO)
// ----------------------------------------------------------------

app.post('/api/send-email', (req, res) => {
    // --- MODIFICADO: Capturando os novos campos ---
    const {
        nome,
        telefone, // <-- NOVO
        endereco, // Endereço por extenso (automático)
        latitude, // <-- NOVO
        longitude, // <-- NOVO
        descricao,
        imagem_base64,
        problema
    } = req.body;

    // Configura o Nodemailer
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    // --- MODIFICADO: Template de E-mail atualizado ---
    const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const telefoneFormatado = telefone ? `<a href="https://wa.me/55${telefone}">${telefone}</a>` : 'Não informado';

    const mailOptions = {
        from: `Formulário de Indicação IA <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_RECEIVER,
        subject: `[INDICAÇÃO IA] ${problema || 'Nova Indicação de Problema Urbano'}`,
        html: `
            <h1>Nova Indicação Automatizada por IA</h1>
            <p><strong>Problema Identificado:</strong> ${problema || 'N/A'}</p>
            <hr>
            <h2>👤 Contato do Cidadão</h2>
            <p><strong>Nome:</strong> ${nome}</p>
            <p><strong>Telefone/WhatsApp:</strong> ${telefoneFormatado}</p>
            <hr>
            <h2>📍 Detalhes da Localização (GPS de Alta Precisão)</h2>
            <p><strong>Endereço aproximado (via Geocoding):</strong></p>
            <p style="font-size: 1.1em; background: #f9f9ff; border: 1px solid #ccc; padding: 10px;">
                ${endereco || 'Endereço por extenso não disponível.'}
            </p>
            <p><strong>Coordenadas Exatas:</strong> ${latitude}, ${longitude}</p>
            <p><strong><a href="${googleMapsLink}" target="_blank">Ver no Google Maps</a></strong></p>
            <hr>
            <p><strong>Relato Formal Gerado pela IA (Baseado na Imagem e Local):</strong></p>
            <div style="border: 1px solid #ccc; padding: 15px; background: #f9f9f9; line-height: 1.5;">
                ${descricao.replace(/\n/g, '<br>')}
            </div>
            <hr>
            <p>${imagem_base64 ? 'Uma imagem foi anexada para referência.' : 'Nenhuma imagem enviada.'}</p>
        `,
        attachments: [],
    };

    // Anexo (Nenhuma mudança aqui)
    if (imagem_base64) {
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
