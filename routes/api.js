const express = require('express');
const { Pool } = require('pg');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

router.get('/access-token', async (req, res) => {
  try {
    const response = await fetch('https://nweb-karlo.eu.auth0.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: 'n5H7V24qqI0ic1vavVCOK7VzUzkjRkJx',
        client_secret: 'rR00xPbeCTs4hvgEaU8TGOyFoamx7FbWnIFCpHEIxLAoCfLopQ-BWMs9oJH5n6Yo',
        audience: 'https://loto-645-api',
        grant_type: 'client_credentials'
      })
    });
    
    const data = await response.json();
    res.json({ access_token: data.access_token });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get access token' });
  }
});

const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
};

const requireMachineAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  
  const token = authHeader.substring(7);
  next();
};

router.get('/round/status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        is_active,
        created_at,
        (SELECT COUNT(*) FROM tickets WHERE round_id = rounds.id) as ticket_count,
        (SELECT numbers FROM drawn_numbers WHERE round_id = rounds.id) as drawn_numbers
      FROM rounds 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      return res.json({
        hasRound: false,
        isActive: false,
        ticketCount: 0,
        drawnNumbers: null
      });
    }
    
    const round = result.rows[0];
    
    let drawnNumbers = null;
    if (round.drawn_numbers) {
      try {
        if (Array.isArray(round.drawn_numbers)) {
          drawnNumbers = round.drawn_numbers;
        } else {
          drawnNumbers = JSON.parse(round.drawn_numbers);
        }
      } catch (error) {
        drawnNumbers = null;
      }
    }
    
    res.json({
      hasRound: true,
      isActive: round.is_active,
      ticketCount: parseInt(round.ticket_count),
      drawnNumbers: drawnNumbers
    });
  } catch (error) {
    res.status(500).json({ error: 'Interna greška servera' });
  }
});

router.post('/tickets', requireAuth, async (req, res) => {
  try {
    const { idNumber, numbers } = req.body;
    
    if (!idNumber || !numbers) {
      return res.status(400).json({ error: 'Potreban je ID broj i brojevi' });
    }
    
    if (idNumber.length > 20) {
      return res.status(400).json({ error: 'ID broj je predugačak (maksimalno 20 znakova)' });
    }
    
    if (!Array.isArray(numbers) || numbers.length < 6 || numbers.length > 10) {
      return res.status(400).json({ error: 'Morate unijeti 6-10 brojeva' });
    }
    
    const uniqueNumbers = [...new Set(numbers)];
    if (uniqueNumbers.length !== numbers.length) {
      return res.status(400).json({ error: 'Duplikati brojeva nisu dozvoljeni' });
    }
    
    for (const num of numbers) {
      if (num < 1 || num > 45 || !Number.isInteger(num)) {
        return res.status(400).json({ error: 'Brojevi moraju biti cijeli brojevi između 1 i 45' });
      }
    }
    
    const roundResult = await pool.query(`
      SELECT id, is_active FROM rounds 
      WHERE is_active = true 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (roundResult.rows.length === 0) {
      return res.status(400).json({ error: 'Nema aktivnog kola za uplatu listića' });
    }
    
    const roundId = roundResult.rows[0].id;
    
    const duplicateCheck = await pool.query(`
      SELECT id FROM tickets 
      WHERE round_id = $1 AND id_number = $2
    `, [roundId, idNumber]);
    
    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Listić s ovim ID brojem već postoji u trenutnom kolu' });
    }
    
    const ticketCode = uuidv4();
    
    await pool.query(`
      INSERT INTO tickets (code, round_id, id_number, numbers, user_id, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [ticketCode, roundId, idNumber, JSON.stringify(numbers), req.user.id]);
    
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const qrData = `${baseUrl.replace(/\/$/, '')}/public/ticket/${ticketCode}`;
    
    try {
      const qrCodeBuffer = await QRCode.toBuffer(qrData, { type: 'png' });
      
      const base64Image = qrCodeBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64Image}`;
      
      res.json({ 
        success: true, 
        qrCode: dataUrl,
        ticketCode: ticketCode 
      });
    } catch (qrError) {
      res.status(500).json({ error: 'Greška pri generiranju QR koda' });
    }
    
  } catch (error) {
    res.status(500).json({ error: 'Interna greška servera' });
  }
});

router.post('/new-round', requireMachineAuth, async (req, res) => {
  try {
    const activeRound = await pool.query(`
      SELECT id FROM rounds WHERE is_active = true
    `);
    
    if (activeRound.rows.length > 0) {
      return res.status(204).send();
    }
    
    await pool.query(`
      INSERT INTO rounds (is_active, created_at) VALUES (true, NOW())
    `);
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Interna greška servera' });
  }
});

router.post('/close', requireMachineAuth, async (req, res) => {
  try {
    await pool.query(`
      UPDATE rounds SET is_active = false WHERE is_active = true
    `);
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Interna greška servera' });
  }
});

router.post('/store-results', requireMachineAuth, async (req, res) => {
  try {
    const { numbers } = req.body;
    
    if (!numbers || !Array.isArray(numbers)) {
      return res.status(400).json({ error: 'Potreban je niz brojeva' });
    }
    
    const roundResult = await pool.query(`
      SELECT id, is_active FROM rounds 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (roundResult.rows.length === 0) {
      return res.status(400).json({ error: 'Nema evidentiranih kola' });
    }
    
    const round = roundResult.rows[0];
    
    if (round.is_active) {
      return res.status(400).json({ error: 'Uplate su još uvijek aktivne' });
    }
    
    const roundId = round.id;
    
    const existingNumbers = await pool.query(`
      SELECT id FROM drawn_numbers WHERE round_id = $1
    `, [roundId]);
    
    if (existingNumbers.rows.length > 0) {
      return res.status(400).json({ error: 'Brojevi su već izvučeni za ovo kolo' });
    }
    
    await pool.query(`
      INSERT INTO drawn_numbers (round_id, numbers, drawn_at)
      VALUES ($1, $2, NOW())
    `, [roundId, JSON.stringify(numbers)]);
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Interna greška servera' });
  }
});

module.exports = router;