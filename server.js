const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (immagini)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database connection
const dbPath = path.join(__dirname, 'database', 'ora_blu.db');
const db = new sqlite3.Database(dbPath);

// Configurazione Multer per upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accetta solo immagini e PDF
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = allowedTypes.test(file.mimetype);
    
    if (extName && mimeType) {
      return cb(null, true);
    } else {
      cb(new Error('Solo immagini (JPG, PNG, GIF) e PDF sono permessi!'));
    }
  }
});

// =================
// API ROUTES
// =================

// GET - Ottieni tutti gli spazi
app.get('/api/spaces', (req, res) => {
  const query = `
    SELECT s.*, 
           a.sponsor_name, a.sponsor_email, a.sponsor_phone, 
           a.wants_to_help, a.payment_proof_url, a.status as adoption_status,
           a.created_at as adoption_date
    FROM spaces s
    LEFT JOIN adoptions a ON s.id = a.space_id AND s.adopted = 1
    ORDER BY s.id
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Errore recupero spazi:', err.message);
      res.status(500).json({ error: 'Errore del database' });
      return;
    }
    
    const spaces = rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      cost: row.cost,
      adopted: Boolean(row.adopted),
      adoptedBy: row.sponsor_name,
      imageUrl: row.image_url,
      adoption: row.sponsor_name ? {
        sponsorName: row.sponsor_name,
        sponsorEmail: row.sponsor_email,
        sponsorPhone: row.sponsor_phone,
        wantsToHelp: Boolean(row.wants_to_help),
        paymentProofUrl: row.payment_proof_url,
        status: row.adoption_status,
        adoptionDate: row.adoption_date
      } : null
    }));
    
    res.json(spaces);
  });
});

// POST - Adotta uno spazio
app.post('/api/spaces/:id/adopt', upload.single('paymentProof'), (req, res) => {
  const spaceId = req.params.id;
  const { sponsorName, sponsorEmail, sponsorPhone, wantsToHelp } = req.body;
  const paymentProofUrl = req.file ? `/uploads/${req.file.filename}` : null;
  
  if (!sponsorName) {
    res.status(400).json({ error: 'Nome/azienda sponsor è obbligatorio' });
    return;
  }
  
  // Verifica se lo spazio esiste e non è già adottato
  db.get('SELECT * FROM spaces WHERE id = ?', [spaceId], (err, space) => {
    if (err) {
      console.error('Errore verifica spazio:', err.message);
      res.status(500).json({ error: 'Errore del database' });
      return;
    }
    
    if (!space) {
      res.status(404).json({ error: 'Spazio non trovato' });
      return;
    }
    
    if (space.adopted) {
      res.status(400).json({ error: 'Spazio già adottato' });
      return;
    }
    
    // Inizia transazione
    db.serialize(() => {
      // Aggiorna lo spazio come adottato
      db.run(
        'UPDATE spaces SET adopted = 1, adopted_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [sponsorName, spaceId],
        function(err) {
          if (err) {
            console.error('Errore aggiornamento spazio:', err.message);
            res.status(500).json({ error: 'Errore aggiornamento spazio' });
            return;
          }
          
          // Inserisci i dettagli dell'adozione
          db.run(
            `INSERT INTO adoptions (space_id, sponsor_name, sponsor_email, sponsor_phone, 
             wants_to_help, payment_proof_url, status) 
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [spaceId, sponsorName, sponsorEmail, sponsorPhone, wantsToHelp === 'true' ? 1 : 0, paymentProofUrl],
            function(err) {
              if (err) {
                console.error('Errore inserimento adozione:', err.message);
                res.status(500).json({ error: 'Errore inserimento adozione' });
                return;
              }
              
              res.json({
                message: 'Spazio adottato con successo!',
                adoptionId: this.lastID,
                spaceId: spaceId,
                sponsorName: sponsorName
              });
            }
          );
        }
      );
    });
  });
});

// PUT - Aggiorna immagine di uno spazio (admin)
app.put('/api/spaces/:id/image', upload.single('image'), (req, res) => {
  const spaceId = req.params.id;
  
  if (!req.file) {
    res.status(400).json({ error: 'Nessun file caricato' });
    return;
  }
  
  const imageUrl = `/uploads/${req.file.filename}`;
  
  db.run(
    'UPDATE spaces SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [imageUrl, spaceId],
    function(err) {
      if (err) {
        console.error('Errore aggiornamento immagine:', err.message);
        res.status(500).json({ error: 'Errore aggiornamento immagine' });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: 'Spazio non trovato' });
        return;
      }
      
      res.json({
        message: 'Immagine aggiornata con successo',
        imageUrl: imageUrl
      });
    }
  );
});

// GET - Ottieni tutte le adozioni
app.get('/api/adoptions', (req, res) => {
  const query = `
    SELECT a.*, s.name as space_name, s.cost as space_cost
    FROM adoptions a
    JOIN spaces s ON a.space_id = s.id
    ORDER BY a.created_at DESC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Errore recupero adozioni:', err.message);
      res.status(500).json({ error: 'Errore del database' });
      return;
    }
    
    const adoptions = rows.map(row => ({
      id: row.id,
      spaceId: row.space_id,
      spaceName: row.space_name,
      spaceCost: row.space_cost,
      sponsorName: row.sponsor_name,
      sponsorEmail: row.sponsor_email,
      sponsorPhone: row.sponsor_phone,
      wantsToHelp: Boolean(row.wants_to_help),
      paymentProofUrl: row.payment_proof_url,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json(adoptions);
  });
});

// GET - Statistiche campagna
app.get('/api/stats', (req, res) => {
  const queries = {
    totalSpaces: 'SELECT COUNT(*) as count FROM spaces',
    adoptedSpaces: 'SELECT COUNT(*) as count FROM spaces WHERE adopted = 1',
    totalRaised: 'SELECT COALESCE(SUM(s.cost), 0) as total FROM spaces s WHERE s.adopted = 1',
    totalGoal: 'SELECT SUM(cost) as total FROM spaces',
    volunteersAvailable: 'SELECT COUNT(*) as count FROM adoptions WHERE wants_to_help = 1',
    pendingAdoptions: 'SELECT COUNT(*) as count FROM adoptions WHERE status = "pending"'
  };
  
  const stats = {};
  const promises = [];
  
  Object.keys(queries).forEach(key => {
    promises.push(new Promise((resolve, reject) => {
      db.get(queries[key], [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          stats[key] = row.count !== undefined ? row.count : row.total;
          resolve();
        }
      });
    }));
  });
  
  Promise.all(promises)
    .then(() => {
      stats.progressPercentage = (stats.totalRaised / stats.totalGoal) * 100;
      res.json(stats);
    })
    .catch(err => {
      console.error('Errore recupero statistiche:', err.message);
      res.status(500).json({ error: 'Errore recupero statistiche' });
    });
});

// Dashboard admin semplice
app.get('/admin', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Dashboard - L'Ora Blu</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50 p-8">
        <h1 class="text-3xl font-bold mb-8">Dashboard Admin - L'Ora Blu</h1>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-700">Spazi Adottati</h3>
                <p class="text-2xl font-bold text-green-600" id="adoptedSpaces">-</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-700">Raccolto</h3>
                <p class="text-2xl font-bold text-blue-600" id="totalRaised">-</p>
            </div>
        </div>

        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-bold mb-4">Spazi</h2>
            <div id="spacesList"></div>
        </div>

        <div class="bg-white rounded-lg shadow p-6 mt-6">
            <h2 class="text-xl font-bold mb-4">Adozioni</h2>
            <div id="adoptionsList"></div>
        </div>

        <script>
            async function loadData() {
                try {
                    const [spacesRes, adoptionsRes, statsRes] = await Promise.all([
                        fetch('/api/spaces'),
                        fetch('/api/adoptions'),
                        fetch('/api/stats')
                    ]);
                    
                    const spaces = await spacesRes.json();
                    const adoptions = await adoptionsRes.json();
                    const stats = await statsRes.json();
                    
                    document.getElementById('adoptedSpaces').textContent = stats.adoptedSpaces;
                    document.getElementById('totalRaised').textContent = '€' + stats.totalRaised.toLocaleString();
                    
                    document.getElementById('spacesList').innerHTML = spaces.map(space => 
                        '<div class="border-b py-2">' +
                        '<strong>' + space.name + '</strong> - €' + space.cost.toLocaleString() + 
                        (space.adopted ? ' (Adottato da: ' + space.adoptedBy + ')' : ' (Disponibile)') +
                        '</div>'
                    ).join('');
                    
                    document.getElementById('adoptionsList').innerHTML = adoptions.map(adoption =>
                        '<div class="border-b py-2">' +
                        '<strong>' + adoption.spaceName + '</strong> - ' + adoption.sponsorName +
                        (adoption.sponsorEmail ? ' (' + adoption.sponsorEmail + ')' : '') +
                        ' - Status: ' + adoption.status +
                        (adoption.wantsToHelp ? ' - 🤝 Volontario disponibile' : '') +
                        '</div>'
                    ).join('');
                    
                } catch (error) {
                    console.error('Errore caricamento dati:', error);
                }
            }
            
            loadData();
            setInterval(loadData, 30000); // Ricarica ogni 30 secondi
        </script>
    </body>
    </html>
  `);
});

// Error handler
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File troppo grande. Massimo 5MB.' });
    }
  }
  
  console.error('Errore server:', error);
  res.status(500).json({ error: 'Errore interno del server' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server in esecuzione su http://localhost:${PORT}`);
  console.log(`📊 Dashboard admin: http://localhost:${PORT}/admin`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🔄 Chiusura server...');
  db.close((err) => {
    if (err) {
      console.error('Errore chiusura database:', err.message);
    } else {
      console.log('✅ Database chiuso.');
    }
    process.exit(0);
  });
});
