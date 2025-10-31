/*
 * Ficheiro: api/send-email.js
 * ROTA: /api/send-email (POST)
 * ATUALIZADO: Inclui street_address e street_position no e-mail.
 * SINTAXE: ES Module (import/export).
 */

import express from 'express';
import nodemailer from 'nodemailer';
// Buffer é um módulo nativo do Node.js, e em ES Modules pode ser acessado globalmente ou importado
// Não é estritamente necessário importar, mas é boa prática para clareza em alguns ambientes.
// Usaremos a referência global Buffer.
// import { Buffer } from 'buffer'; 

const app = express();

// Aumenta o limite do body JSON para garantir que Express possa ler a requisição POST
app.use(express.json({ limit: '50mb' })); 

const sendEmailHandler = (req, res) => {
    
    if (req.method === 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed. Use POST para envio.' });
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed.' });
    }

    // --- RECEBENDO OS NOVOS CAMPOS DO FRONTEND ---
    const { 
        nome, 
        endereco, // GPS Bruto
        descricao, 
        imagem_base64, 
        problema, 
        street_address, // Nome da Rua + Cidade/Estado (Estimado pela IA)
        street_position // INÍCIO, MEIO, FINAL (Estimado pela IA)
    } = req.body; 
    
    // Configura o Nodemailer
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    // --- FORMATAÇÃO DO ENDEREÇO PARA O CORPO DO E-MAIL ---
    const enderecoEstimadoTexto = street_address && street_position ?
        `<b>${street_address}</b> (Posição: ${street_position})` :
        `Endereço Estimado Indisponível`;
        
    const coordenadasTexto = endereco ? 
        `Latitude/Longitude: ${endereco}` :
        `Coordenadas: Não capturadas`;

    // Montagem do E-mail
    const mailOptions = {
        from: `Formulário de Indicação IA <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_RECEIVER,
        subject: `[INDICAÇÃO IA] ${problema || 'Nova Indicação de Problema Urbano'} - ${street_address || 'Localização Desconhecida'}`, 
        html: `
            <h1>Nova Indicação Automatizada por IA</h1>
            <p><strong>Problema Identificado:</strong> ${problema || 'N/A'}</p>
            <hr>
            <h2>📍 Detalhes da Localização</h2>
            <p style="margin-bottom: 5px;"><strong>Endereço Estimado (IA):</strong> ${enderecoEstimadoTexto}</p>
            <p style="font-size: 0.9em; color: #555;">${coordenadasTexto}</p>
            <hr>
            <p><strong>Relato Formal Gerado pela IA:</strong></p>
            <div style="border: 1px solid #ccc; padding: 15px; background: #f9f9f9; line-height: 1.5;">
                ${descricao.replace(/\n/g, '<br>')}
            </div>
            <p style="margin-top: 15px;"><strong>Enviado por:</strong> ${nome}</p>
            <hr>
            <p>${imagem_base64 ? 'Uma imagem foi anexada para referência.' : 'Nenhuma imagem enviada.'}</p>
        `,
        attachments: [], 
    };

    // Cria o anexo a partir da string Base64
    if (imagem_base64) {
        // Remove o prefixo 'data:image/jpeg;base64,'
        const base64Data = imagem_base64.replace(/^data:image\/\w+;base64,/, "");
        // Buffer é global em Node.js ES Modules.
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
};

// Exporta o manipulador para o ambiente Serverless
export default sendEmailHandler;
