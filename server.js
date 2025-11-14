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

// Database connection con setup automatico
const isDevelopment = process.env.NODE_ENV !== 'production';
const dbPath = isDevelopment 
  ? path.join(__dirname, 'database', 'ora_blu.db')
  : path.join(__dirname, 'ora_blu.db'); // Railway: nella root

// Crea la directory database solo in sviluppo
if (isDevelopment) {
  const dbDir = path.join(__dirname, 'database');
  fs.ensureDirSync(dbDir);
}

console.log('📁 Database path:', dbPath);
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Errore connessione database:', err.message);
  } else {
    console.log('✅ Database connesso:', dbPath);
    // Setup automatico tabelle all'avvio
    setupDatabase();
  }
});

// Funzione per setup automatico delle tabelle
function setupDatabase() {
  console.log('🔧 Setup automatico database...');
  
  db.serialize(() => {
    // Tabella spazi
    db.run(`CREATE TABLE IF NOT EXISTS spaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      cost INTEGER NOT NULL,
      adopted BOOLEAN DEFAULT 0,
      adopted_by TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('❌ Errore tabella spaces:', err.message);
      } else {
        console.log('✅ Tabella spaces OK');
      }
    });

    // Tabella adozioni  
    db.run(`CREATE TABLE IF NOT EXISTS adoptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      space_id INTEGER NOT NULL,
      sponsor_name TEXT NOT NULL,
      sponsor_email TEXT,
      sponsor_phone TEXT,
      wants_to_help BOOLEAN DEFAULT 0,
      payment_proof_url TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (space_id) REFERENCES spaces (id)
    )`, (err) => {
      if (err) {
        console.error('❌ Errore tabella adoptions:', err.message);
      } else {
        console.log('✅ Tabella adoptions OK');
        // Popola dati iniziali se necessario
        populateInitialData();
      }
    });
  });
}

// Popola dati iniziali
function populateInitialData() {
  db.get('SELECT COUNT(*) as count FROM spaces', (err, row) => {
    if (err) {
      console.error('❌ Errore controllo dati:', err.message);
      return;
    }
    
    if (row.count === 0) {
      console.log('🔄 Popolamento dati iniziali...');
      const spaces = [
        { name: 'Bagno 1', description: 'Contribuirai ad arredare il bagno con lavandino, tazza, bidet e piatto doccia', cost: 3000 },
        { name: 'Vacanza', description: 'Manderemo i bambini in gita per qualche giorno durante il trasloco', cost: 5000 },
        { name: 'Cameretta 1', description: 'Ikea ci ha regalato i lettini, arrederemo con scrivanie, sedie, mobili', cost: 3000 },
        { name: 'Cameretta 2', description: 'Ikea ci ha regalato i lettini, arrederemo con scrivanie, sedie, mobili', cost: 3000 },
        { name: 'Cameretta 3', description: 'Ikea ci ha regalato i lettini, arrederemo con scrivanie, sedie, mobili', cost: 3000 },
        { name: 'Cameretta 4', description: 'Ikea ci ha regalato i lettini, arrederemo con scrivanie, sedie, mobili', cost: 3000 },
        { name: 'Cameretta 5', description: 'Ikea ci ha regalato i lettini, arrederemo con scrivanie, sedie, mobili', cost: 3000 },
        { name: 'Cucina - Frigo e Forno', description: 'Elettrodomestici essenziali per preparare pasti nutrienti', cost: 3000 },
        { name: 'Lavanderia - Lavatrici', description: 'Lavatrici professionali per vestiti sempre puliti', cost: 2000 },
        { name: 'Lavanderia - Asciugatrici', description: 'Asciugatrici efficienti per il ciclo di cura', cost: 3000 },
        { name: 'Cucina - Fuochi e Cappa', description: 'Piano cottura, cappa aspirante e robot da cucina', cost: 3000 },
        { name: 'Cucina - Mobili', description: 'Mobili e pensili per organizzare tutto il necessario', cost: 3000 },
        { name: 'Cucina - Tavolo', description: 'Grande tavolo con sedie per i pasti insieme', cost: 3000 },
        { name: 'Soggiorno e TV', description: 'Area relax con televisione per momenti di svago', cost: 3000 },
        { name: 'Divano e Tappeto', description: 'Divano comodo e tappeto per giocare e rilassarsi', cost: 3000 },
        { name: 'Giardino', description: 'Attrezzature e arredi per lo spazio all\'aperto', cost: 3000 },
        { name: 'Bagno 2', description: 'Secondo bagno completo per comfort e privacy', cost: 3000 },
        { name: 'Bagno 3', description: 'Terzo bagno per completare i servizi', cost: 3000 },
        { name: 'Sala Visite', description: 'Spazio per incontri con le famiglie d\'origine', cost: 3000 },
        { name: 'Armadi e Libreria', description: 'Armadi per vestiti e librerie per libri e giochi', cost: 3000 }
      ];
      
      const insertStmt = db.prepare('INSERT INTO spaces (name, description, cost) VALUES (?, ?, ?)');
      spaces.forEach(space => {
        insertStmt.run([space.name, space.description, space.cost]);
      });
      insertStmt.finalize(() => {
        console.log(`🎉 Inseriti ${spaces.length} spazi iniziali!`);
      });
    } else {
      console.log(`ℹ️ Database già popolato con ${row.count} spazi.`);
    }
  });
}

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

// PUT - Aggiorna stato adozione
app.put('/api/adoptions/:id/status', (req, res) => {
  const adoptionId = req.params.id;
  const { status } = req.body;
  
  const validStatuses = ['pending', 'approved', 'confirmed', 'completed', 'cancelled', 'rejected'];
  
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Stato non valido' });
    return;
  }
  
  db.run(
    'UPDATE adoptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, adoptionId],
    function(err) {
      if (err) {
        console.error('Errore aggiornamento stato:', err.message);
        res.status(500).json({ error: 'Errore aggiornamento stato' });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: 'Adozione non trovata' });
        return;
      }
      
      res.json({ message: 'Stato aggiornato con successo' });
    }
  );
});

// PUT - Aggiorna note adozione
app.put('/api/adoptions/:id/notes', (req, res) => {
  const adoptionId = req.params.id;
  const { notes } = req.body;
  
  db.run(
    'UPDATE adoptions SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [notes, adoptionId],
    function(err) {
      if (err) {
        console.error('Errore aggiornamento note:', err.message);
        res.status(500).json({ error: 'Errore aggiornamento note' });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: 'Adozione non trovata' });
        return;
      }
      
      res.json({ message: 'Note aggiornate con successo' });
    }
  );
});

// GET - Statistiche dettagliate
app.get('/api/stats/detailed', (req, res) => {
  const queries = {
    totalSpaces: 'SELECT COUNT(*) as count FROM spaces',
    adoptedSpaces: 'SELECT COUNT(*) as count FROM spaces WHERE adopted = 1',
    totalRaised: 'SELECT COALESCE(SUM(s.cost), 0) as total FROM spaces s WHERE s.adopted = 1',
    totalGoal: 'SELECT SUM(cost) as total FROM spaces',
    volunteersAvailable: 'SELECT COUNT(*) as count FROM adoptions WHERE wants_to_help = 1',
    pendingAdoptions: 'SELECT COUNT(*) as count FROM adoptions WHERE status = "pending"',
    approvedAdoptions: 'SELECT COUNT(*) as count FROM adoptions WHERE status = "approved"',
    confirmedAdoptions: 'SELECT COUNT(*) as count FROM adoptions WHERE status = "confirmed"',
    completedAdoptions: 'SELECT COUNT(*) as count FROM adoptions WHERE status = "completed"',
    cancelledAdoptions: 'SELECT COUNT(*) as count FROM adoptions WHERE status = "cancelled"',
    rejectedAdoptions: 'SELECT COUNT(*) as count FROM adoptions WHERE status = "rejected"'
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
      console.error('Errore recupero statistiche dettagliate:', err.message);
      res.status(500).json({ error: 'Errore recupero statistiche dettagliate' });
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
