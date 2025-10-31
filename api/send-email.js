/*
 * Ficheiro: api/send-email.js
 * ROTA: /api/send-email (POST)
 * CORREÇÃO: Migrado de require para import.
 */

import express from 'express';
import nodemailer from 'nodemailer';

const app = express();

// Aumenta o limite do body JSON para garantir que Express possa ler a requisição POST
app.use(express.json({ limit: '50mb' })); 

const sendEmailHandler = (req, res) => {
    // Adiciona um manipulador GET (opcional, mas evita 404 no log)
    if (req.method === 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed. Use POST para envio.' });
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed.' });
    }

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
