const express = require('express');
const { Pool } = require('pg');
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

router.get('/ticket/:ticketCode', async (req, res) => {
  try {
    const { ticketCode } = req.params;
    
    const ticketResult = await pool.query(`
      SELECT 
        t.code,
        t.id_number,
        t.numbers,
        t.created_at,
        r.id as round_id,
        r.is_active,
        dn.numbers as drawn_numbers,
        dn.drawn_at
      FROM tickets t
      JOIN rounds r ON t.round_id = r.id
      LEFT JOIN drawn_numbers dn ON r.id = dn.round_id
      WHERE t.code = $1
    `, [ticketCode]);
    
    if (ticketResult.rows.length === 0) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>LOTO 6/45 LISTIĆ</title>
          <link rel="stylesheet" href="/css/style.css">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
          <div class="container">
            <h1>LOTO 6/45 LISTIĆ</h1>
            <div class="ticket-info">
              <h2>LISTIĆ NIJE PRONAĐEN</h2>
              <p>Listić s kodom ${ticketCode} nije pronađen.</p>
            </div>
            <div class="back-link">
              <a href="/">← Povratak na početnu</a>
            </div>
          </div>
        </body>
        </html>
      `);
    }
    
    const ticket = ticketResult.rows[0];
    
    let ticketNumbers;
    try {
      ticketNumbers = JSON.parse(ticket.numbers);
    } catch (error) {
      ticketNumbers = Array.isArray(ticket.numbers) ? ticket.numbers : [];
    }
    
    let drawnNumbers = null;
    if (ticket.drawn_numbers) {
      try {
        drawnNumbers = JSON.parse(ticket.drawn_numbers);
      } catch (error) {
        drawnNumbers = Array.isArray(ticket.drawn_numbers) ? ticket.drawn_numbers : null;
      }
    }
    
    let matches = 0;
    if (drawnNumbers) {
      matches = ticketNumbers.filter(num => drawnNumbers.includes(num)).length;
    }
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>LOTO 6/45 LISTIĆ</title>
        <link rel="stylesheet" href="/css/style.css">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${!drawnNumbers ? '<meta http-equiv="refresh" content="15">' : ''}
      </head>
      <body>
        <div class="container">
          <h1>LOTO 6/45 LISTIĆ</h1>
          
          <div class="ticket-info">
            <h2>INFORMACIJE O LISTIĆU</h2>
            <p><strong>Kod listića:</strong> ${ticket.code}</p>
            <p><strong>ID broj:</strong> ${ticket.id_number}</p>
            <p><strong>Uplaćeno:</strong> ${new Date(ticket.created_at).toLocaleString('hr-HR', { timeZone: 'Europe/Zagreb' })}</p>
            <p><strong>Status kola:</strong> ${ticket.is_active ? 'Aktivno' : 'Zatvoreno'}</p>
          </div>
          
          <div class="ticket-numbers">
            <h3>VAŠI BROJEVI:</h3>
            <div class="number-grid">
              ${ticketNumbers.map(num => `<span class="number">${num}</span>`).join('')}
            </div>
          </div>
          
          ${drawnNumbers ? `
            <div class="drawn-numbers">
              <h3>IZVUČENI BROJEVI:</h3>
              <div class="number-grid">
                ${drawnNumbers.map(num => `<span class="number drawn">${num}</span>`).join('')}
              </div>
              <p><strong>Izvučeno:</strong> ${new Date(ticket.drawn_at).toLocaleString('hr-HR', { timeZone: 'Europe/Zagreb' })}</p>
            </div>
            
            <div class="results">
              <h3>REZULTATI</h3>
              <p><strong>Pogodaka:</strong> ${matches} od ${ticketNumbers.length}</p>
              ${matches === ticketNumbers.length ? '<p class="jackpot">JACKPOT!</p>' : ''}
            </div>
          ` : `
            <div class="waiting">
              <p>Brojevi još nisu izvučeni za ovo kolo.</p>
            </div>
          `}
          
          <div class="back-link">
            <a href="/">← Povratak na početnu</a>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>LOTO 6/45 LISTIĆ</title>
        <link rel="stylesheet" href="/css/style.css">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body>
        <div class="container">
          <h1>LOTO 6/45 LISTIĆ</h1>
          <div class="ticket-info">
            <h2>GREŠKA</h2>
            <p>Dogodila se greška pri učitavanju listića.</p>
          </div>
          <div class="back-link">
            <a href="/">← Povratak na početnu</a>
          </div>
        </div>
      </body>
      </html>
    `);
  }
});

module.exports = router;