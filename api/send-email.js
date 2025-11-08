/*
 * Ficheiro: api/send-email.js
 * ROTA: /api/send-email (POST)
 * ATUALIZADO: Recebe dados do GPS (lat, lon, endereço por extenso) e telefone.
 */

import express from 'express';
import nodemailer from 'nodemailer';

const app = express();
app.use(express.json({ limit: '50mb' })); 

const sendEmailHandler = (req, res) => {
    
    if (req.method === 'GET') {
         return res.status(405).json({ message: 'Method Not Allowed. Use POST para envio.' });
    }
    
    if (req.method !== 'POST') {
         return res.status(405).json({ message: 'Method Not Allowed.' });
    }

    // --- MODIFICADO: Recebendo os novos campos do GPS e telefone ---
    const { 
        nome, 
        telefone, // <-- NOVO
        endereco, // <-- Agora vem do GPS/Geocoder
        descricao, 
        imagem_base64, 
        problema,
        latitude, // <-- NOVO
        longitude // <-- NOVO
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

    // --- FORMATAÇÃO DO CORPO DO E-MAIL ---
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

    // Cria o anexo a partir da string Base64 (Sem alteração)
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

export default sendEmailHandler;
