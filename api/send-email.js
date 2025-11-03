/*
 * Ficheiro: api/send-email.js
 * ROTA: /api/send-email (POST)
 * ATUALIZADO: Inclui o campo 'telefone' e corrige o bug 'Seu Nome'.
 * SINTAXE: ES Module (import/export).
 */

import express from 'express';
import nodemailer from 'nodemailer';

const app = express();

// Aumenta o limite do body JSON
app.use(express.json({ limit: '50mb' })); 

const sendEmailHandler = (req, res) => {
    
    if (req.method === 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed. Use POST para envio.' });
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed.' });
    }

    // --- CORREÇÃO: Recebe 'telefone' e 'nome' corretamente do req.body ---
    const { 
        nome, 
        telefone, // Recebe o novo campo 'telefone'
        endereco, 
        descricao, 
        imagem_base64, 
        problema, 
        street_address,
        street_position
    } = req.body; 
    
    // Configura o Nodemailer (requer Senha de App)
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS, // Deve ser a Senha de App de 16 dígitos
        },
    });

    // --- FORMATAÇÃO DO CORPO DO E-MAIL ---
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
        subject: `[INDICAÇÃO IA] ${problema || 'Nova Indicação'} - ${street_address || 'Localização Desconhecida'}`, 
        html: `
            <h1>Nova Indicação Automatizada por IA</h1>
            <p><strong>Problema Identificado:</strong> ${problema || 'N/A'}</p>
            <hr>
            <h2>👤 Contato do Cidadão</h2>
            <p><strong>Nome:</strong> ${nome}</p>
            <p><strong>Telefone/WhatsApp:</strong> <a href="https://wa.me/55${telefone}">${telefone}</a></p>
            <hr>
            <h2>📍 Detalhes da Localização</h2>
            <p style="margin-bottom: 5px;"><strong>Endereço Estimado (IA):</strong> ${enderecoEstimadoTexto}</p>
            <p style="font-size: 0.9em; color: #555;">${coordenadasTexto}</p>
            <hr>
            <p><strong>Relato Formal Gerado pela IA:</strong></p>
            <div style="border: 1px solid #ccc; padding: 15px; background: #f9f9f9; line-height: 1.5;">
                ${descricao.replace(/\n/g, '<br>')}
            </div>
            <hr>
            <p>${imagem_base64 ? 'Uma imagem foi anexada para referência.' : 'Nenhuma imagem enviada.'}</p>
        `,
        attachments: [], 
    };

    // Cria o anexo a partir da string Base64
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
};

// Exporta o manipulador para o ambiente Serverless
export default sendEmailHandler;
