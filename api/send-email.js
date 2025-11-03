/*
 * Ficheiro: api/send-email.js
 * ROTA: /api/send-email (POST)
 * ATUALIZADO: Remove o campo 'endereco' manual e foca 100% no GPS.
 */

import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';

// Inicializa o app Express
const app = express();

// Middlewares
app.use(cors()); // Habilita o CORS
app.use(express.json({ limit: '50mb' })); // Habilita JSON com limite de 50mb para a imagem

// O handler principal da rota
const sendEmailHandler = async (req, res) => {
    
    // Responde ao método GET (usado por Vercel para "acordar" a função)
    if (req.method === 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed. Use POST para envio.' });
    }

    // Garante que é um POST
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed.' });
    }

    try {
        // --- Extrai os dados (sem o campo 'endereco') ---
        const { 
            nome, 
            telefone, 
            // endereco, // REMOVIDO
            descricao, 
            imagem_base64, 
            problema,
            gps_latitude,  // Recebido do frontend
            gps_longitude  // Recebido do frontend
        } = req.body; 
        
        // Configura o Nodemailer
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS, 
            },
        });

        // --- HTML de Localização (Agora 100% focado no GPS) ---
        let locationHtml = ""; // Começa vazio
        
        // O frontend agora deve *sempre* enviar o GPS, pois é obrigatório
        if (gps_latitude && gps_longitude && gps_latitude !== "null") {
            const mapsLink = `https://www.google.com/maps?q=${gps_latitude},${gps_longitude}`;
            locationHtml = `
                <p><strong>Localização Precisa (GPS do App):</strong> 
                    <a href="${mapsLink}" target="_blank" style="font-size: 1.1em; color: #007BFF; font-weight: bold;">
                        Clique para ver no Google Maps
                    </a>
                </p>
                <p>(Coordenadas: ${gps_latitude}, ${gps_longitude})</p>
            `;
        } else {
            // Fallback caso algo falhe (embora o frontend agora exija)
            locationHtml = `<p><strong>Localização Precisa (GPS):</strong> Não fornecida (Falha no App).</p>`;
        }
        // --- Fim da Mudança ---


        // --- FORMATAÇÃO DO CORPO DO E-MAIL (Atualizado) ---
        // O template não tem mais a secção "Endereço Informado pelo Cidadão"
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
                <p><strong>Telefone/WhatsApp:</strong> <a href="https://wa.me/55${telefone}">${telefone}</a></p>
                <hr>
                <h2>📍 Detalhes da Localização</h2>
                
                ${locationHtml} <!-- <-- Bloco de HTML (agora só GPS) -->
                
                <hr>
                <p><strong>Relato Formal Gerado pela IA (Baseado na Imagem):</strong></p>
                <div style="border: 1px solid #ccc; padding: 15px; background: #f9f9f9; line-height: 1.5;">
                    ${descricao.replace(/\n/g, '<br>')}
                </div>
                <hr>
                <p>${imagem_base64 ? 'Uma imagem foi anexada para referência.' : 'Nenhuma imagem enviada.'}</p>
            `,
            attachments: [], 
        };

        // --- Anexo (Sem alteração) ---
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

        // --- Envia o e-mail (Sem alteração) ---
        await transporter.sendMail(mailOptions);
        
        res.status(200).json({ message: 'E-mail enviado com sucesso!' });

    } catch (error) {
        // Tratamento de erro
        console.error('Erro ao enviar e-mail:', error);
        return res.status(500).json({ message: 'Falha ao enviar o e-mail.' });
    }
};

// Define as rotas que este handler irá responder
app.post('/api/send-email', sendEmailHandler);
app.get('/api/send-email', sendEmailHandler); // Lida com GETs

// Exporta o app para o Vercel
export default app;

