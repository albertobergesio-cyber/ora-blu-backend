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

// GET - Statistiche base per il frontend
app.get('/api/stats', (req, res) => {
  const queries = {
    totalSpaces: 'SELECT COUNT(*) as count FROM spaces',
    adoptedSpaces: 'SELECT COUNT(*) as count FROM spaces WHERE adopted = 1',
    totalRaised: 'SELECT COALESCE(SUM(s.cost), 0) as total FROM spaces s WHERE s.adopted = 1',
    totalGoal: 'SELECT SUM(cost) as total FROM spaces'
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
      // Calcola la percentuale di progresso
      stats.progressPercentage = stats.totalGoal > 0 ? (stats.totalRaised / stats.totalGoal) * 100 : 0;
      res.json(stats);
    })
    .catch(err => {
      console.error('Errore recupero statistiche:', err.message);
      res.status(500).json({ error: 'Errore recupero statistiche' });
    });
});

// Dashboard admin moderna
app.get('/admin', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard Admin - L'Ora Blu</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
    <style>
        [x-cloak] { display: none !important; }
        .modal { backdrop-filter: blur(8px); }
        .status-pending { background-color: #fef3c7; color: #92400e; border-color: #fde68a; }
        .status-approved { background-color: #dbeafe; color: #1e40af; border-color: #bfdbfe; }
        .status-confirmed { background-color: #dcfce7; color: #166534; border-color: #bbf7d0; }
        .status-completed { background-color: #d1fae5; color: #065f46; border-color: #a7f3d0; }
        .status-cancelled { background-color: #fee2e2; color: #991b1b; border-color: #fecaca; }
        .status-rejected { background-color: #f3f4f6; color: #374151; border-color: #d1d5db; }
    </style>
</head>
<body class="bg-gray-50" x-data="adminDashboard()" x-init="init()">
    
    <!-- Header -->
    <header class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4 py-6">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg flex items-center justify-center">
                        <div class="w-6 h-6 bg-orange-500 rounded-full"></div>
                    </div>
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">Dashboard Admin</h1>
                        <p class="text-sm text-gray-600">L'Ora Blu - Gestione Campagna</p>
                    </div>
                </div>
                <button @click="refreshData()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                    <svg class="w-4 h-4 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
                    </svg>
                    Aggiorna
                </button>
            </div>
        </div>
    </header>

    <!-- Stats Cards -->
    <div class="max-w-7xl mx-auto px-4 py-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <div class="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
                            </svg>
                        </div>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-500">Spazi Totali</p>
                        <p class="text-2xl font-bold text-gray-900" x-text="stats.totalSpaces || 0"></p>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <div class="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                            </svg>
                        </div>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-500">Spazi Adottati</p>
                        <p class="text-2xl font-bold text-gray-900" x-text="stats.adoptedSpaces || 0"></p>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <div class="w-8 h-8 bg-emerald-500 rounded-md flex items-center justify-center">
                            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clip-rule="evenodd"/>
                            </svg>
                        </div>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-500">Raccolto</p>
                        <p class="text-2xl font-bold text-gray-900" x-text="'€' + (stats.totalRaised || 0).toLocaleString()"></p>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <div class="w-8 h-8 bg-orange-500 rounded-md flex items-center justify-center">
                            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        </div>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-500">Progressi</p>
                        <p class="text-2xl font-bold text-gray-900" x-text="((stats.progressPercentage || 0)).toFixed(1) + '%'"></p>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <div class="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
                            </svg>
                        </div>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-500">Volontari</p>
                        <p class="text-2xl font-bold text-gray-900" x-text="stats.volunteersAvailable || 0"></p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="bg-white rounded-lg shadow mb-6">
            <div class="border-b border-gray-200">
                <nav class="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                    <button @click="activeTab = 'spaces'" 
                            :class="activeTab === 'spaces' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
                            class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
                        <svg class="w-4 h-4 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
                        </svg>
                        Gestione Spazi
                    </button>
                    <button @click="activeTab = 'adoptions'" 
                            :class="activeTab === 'adoptions' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
                            class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
                        <svg class="w-4 h-4 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        Gestione Adozioni
                        <span x-show="stats.pendingAdoptions > 0" class="ml-2 bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full" x-text="stats.pendingAdoptions"></span>
                    </button>
                    <button @click="activeTab = 'analytics'" 
                            :class="activeTab === 'analytics' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
                            class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
                        <svg class="w-4 h-4 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
                        </svg>
                        Analytics
                    </button>
                </nav>
            </div>
        </div>

        <!-- Spaces Tab -->
        <div x-show="activeTab === 'spaces'" x-cloak>
            <div class="bg-white rounded-lg shadow overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-medium text-gray-900">Gestione Spazi</h3>
                    <p class="mt-1 text-sm text-gray-500">Gestisci immagini e dettagli degli spazi della campagna</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spazio</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Costo</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Immagine</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <template x-for="space in spaces" :key="space.id">
                                <tr>
                                    <td class="px-6 py-4">
                                        <div>
                                            <div class="text-sm font-medium text-gray-900" x-text="space.name"></div>
                                            <div class="text-sm text-gray-500" x-text="space.description.substring(0, 80) + '...'"></div>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" x-text="'€' + space.cost.toLocaleString()"></td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span x-show="space.adopted" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            ✓ Adottato
                                        </span>
                                        <span x-show="!space.adopted" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                            Disponibile
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <div x-show="space.imageUrl" class="flex items-center">
                                            <img :src="space.imageUrl" 
                                                 class="h-10 w-10 object-cover rounded" alt="Cantiere">
                                        </div>
                                        <div x-show="!space.imageUrl" class="text-sm text-gray-400">Nessuna immagine</div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button @click="openImageModal(space)" 
                                                class="text-blue-600 hover:text-blue-900 mr-3">
                                            <span x-text="space.imageUrl ? 'Cambia' : 'Aggiungi'"></span> Foto
                                        </button>
                                        <button x-show="space.adopted" @click="viewAdoptionDetails(space)" 
                                                class="text-green-600 hover:text-green-900">
                                            Dettagli
                                        </button>
                                    </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Adoptions Tab -->
        <div x-show="activeTab === 'adoptions'" x-cloak>
            <div class="bg-white rounded-lg shadow overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-medium text-gray-900">Gestione Adozioni</h3>
                    <p class="mt-1 text-sm text-gray-500">Gestisci le richieste di adozione e cambia gli stati</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spazio</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sponsor</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contatti</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volontario</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <template x-for="adoption in adoptions" :key="adoption.id">
                                <tr>
                                    <td class="px-6 py-4">
                                        <div>
                                            <div class="text-sm font-medium text-gray-900" x-text="adoption.spaceName"></div>
                                            <div class="text-sm text-gray-500" x-text="'€' + adoption.spaceCost.toLocaleString()"></div>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4">
                                        <div class="text-sm font-medium text-gray-900" x-text="adoption.sponsorName"></div>
                                        <div class="text-sm text-gray-500" x-text="new Date(adoption.createdAt).toLocaleDateString()"></div>
                                    </td>
                                    <td class="px-6 py-4">
                                        <div class="text-sm text-gray-900" x-text="adoption.sponsorEmail || 'N/A'"></div>
                                        <div class="text-sm text-gray-500" x-text="adoption.sponsorPhone || 'N/A'"></div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span x-show="adoption.wantsToHelp" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            🤝 Disponibile
                                        </span>
                                        <span x-show="!adoption.wantsToHelp" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                            No
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <select @change="updateAdoptionStatus(adoption.id, $event.target.value)"
                                                :value="adoption.status"
                                                class="text-xs px-2 py-1 rounded border">
                                            <option value="pending">⏳ In Attesa</option>
                                            <option value="approved">✅ Approvato</option>
                                            <option value="confirmed">💰 Confermato</option>
                                            <option value="completed">🎉 Completato</option>
                                            <option value="cancelled">❌ Cancellato</option>
                                            <option value="rejected">🚫 Rifiutato</option>
                                        </select>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button @click="openAdoptionModal(adoption)" 
                                                class="text-blue-600 hover:text-blue-900 mr-3">
                                            Dettagli
                                        </button>
                                        <a x-show="adoption.paymentProofUrl" 
                                           :href="adoption.paymentProofUrl" 
                                           target="_blank" 
                                           class="text-green-600 hover:text-green-900">
                                            📄 Ricevuta
                                        </a>
                                    </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Analytics Tab -->
        <div x-show="activeTab === 'analytics'" x-cloak>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Progress Chart -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h3 class="text-lg font-medium text-gray-900 mb-4">Progresso Campagna</h3>
                    <div class="space-y-4">
                        <div class="flex justify-between text-sm">
                            <span>Raccolto</span>
                            <span x-text="'€' + (stats.totalRaised || 0).toLocaleString() + ' / €' + (stats.totalGoal || 62000).toLocaleString()"></span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-4">
                            <div class="bg-gradient-to-r from-blue-500 to-green-500 h-4 rounded-full transition-all duration-1000" 
                                 :style="'width: ' + (stats.progressPercentage || 0) + '%'"></div>
                        </div>
                        <p class="text-sm text-gray-600" x-text="(stats.progressPercentage || 0).toFixed(1) + '% dell\\'obiettivo raggiunto'"></p>
                    </div>
                </div>

                <!-- Status Distribution -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h3 class="text-lg font-medium text-gray-900 mb-4">Distribuzione Stati</h3>
                    <div class="space-y-3">
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-gray-600">In Attesa</span>
                            <span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm" x-text="getStatusCount('pending')"></span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-gray-600">Approvati</span>
                            <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm" x-text="getStatusCount('approved')"></span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-gray-600">Confermati</span>
                            <span class="bg-green-100 text-green-800 px-2 py-1 rounded text-sm" x-text="getStatusCount('confirmed')"></span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-gray-600">Completati</span>
                            <span class="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-sm" x-text="getStatusCount('completed')"></span>
                        </div>
                    </div>
                </div>

                <!-- Recent Activity -->
                <div class="bg-white rounded-lg shadow p-6 lg:col-span-2">
                    <h3 class="text-lg font-medium text-gray-900 mb-4">Attività Recente</h3>
                    <div class="space-y-4">
                        <template x-for="adoption in adoptions.slice(0, 5)" :key="'recent-' + adoption.id">
                            <div class="flex items-center space-x-3">
                                <div class="flex-shrink-0">
                                    <div class="w-8 h-8 rounded-full flex items-center justify-center bg-blue-100 text-blue-800">
                                        <span class="text-xs">
                                            <span x-show="adoption.status === 'pending'">⏳</span>
                                            <span x-show="adoption.status === 'approved'">✅</span>
                                            <span x-show="adoption.status === 'confirmed'">💰</span>
                                            <span x-show="adoption.status === 'completed'">🎉</span>
                                            <span x-show="adoption.status === 'cancelled'">❌</span>
                                            <span x-show="adoption.status === 'rejected'">🚫</span>
                                        </span>
                                    </div>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-medium text-gray-900" x-text="adoption.sponsorName + ' ha adottato ' + adoption.spaceName"></p>
                                    <p class="text-sm text-gray-500" x-text="new Date(adoption.createdAt).toLocaleString()"></p>
                                </div>
                                <div class="flex-shrink-0 text-sm text-gray-500" x-text="'€' + adoption.spaceCost.toLocaleString()"></div>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Image Upload Modal -->
    <div x-show="showImageModal" x-cloak class="fixed inset-0 z-50 overflow-y-auto modal" style="background: rgba(0, 0, 0, 0.5);">
        <div class="flex items-center justify-center min-h-screen px-4">
            <div @click.away="showImageModal = false" class="relative bg-white rounded-lg shadow-xl max-w-md w-full">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-medium text-gray-900">Upload Immagine Cantiere</h3>
                    <p class="text-sm text-gray-500" x-text="selectedSpace ? selectedSpace.name : ''"></p>
                </div>
                <div class="px-6 py-4">
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Seleziona Immagine</label>
                        <input type="file" @change="handleImageUpload($event)" accept="image/*" 
                               class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100">
                    </div>
                    <div x-show="uploadProgress > 0" class="mb-4">
                        <div class="flex justify-between text-sm text-gray-600 mb-1">
                            <span>Upload in corso...</span>
                            <span x-text="uploadProgress + '%'"></span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                 :style="'width: ' + uploadProgress + '%'"></div>
                        </div>
                    </div>
                    <div class="flex justify-end space-x-3">
                        <button @click="showImageModal = false" 
                                class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md">
                            Annulla
                        </button>
                        <button @click="uploadImage()" :disabled="!selectedImage" 
                                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-md">
                            Upload
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Adoption Details Modal -->
    <div x-show="showAdoptionModal" x-cloak class="fixed inset-0 z-50 overflow-y-auto modal" style="background: rgba(0, 0, 0, 0.5);">
        <div class="flex items-center justify-center min-h-screen px-4">
            <div @click.away="showAdoptionModal = false" class="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-medium text-gray-900">Dettagli Adozione</h3>
                </div>
                <div x-show="selectedAdoption" class="px-6 py-4 space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Spazio</label>
                            <p class="text-sm text-gray-900" x-text="selectedAdoption ? selectedAdoption.spaceName : ''"></p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Costo</label>
                            <p class="text-sm text-gray-900" x-text="selectedAdoption ? '€' + selectedAdoption.spaceCost.toLocaleString() : ''"></p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Sponsor</label>
                            <p class="text-sm text-gray-900" x-text="selectedAdoption ? selectedAdoption.sponsorName : ''"></p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Data Adozione</label>
                            <p class="text-sm text-gray-900" x-text="selectedAdoption ? new Date(selectedAdoption.createdAt).toLocaleString() : ''"></p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Email</label>
                            <p class="text-sm text-gray-900" x-text="selectedAdoption ? (selectedAdoption.sponsorEmail || 'Non fornita') : ''"></p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Telefono</label>
                            <p class="text-sm text-gray-900" x-text="selectedAdoption ? (selectedAdoption.sponsorPhone || 'Non fornito') : ''"></p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Volontario Trasloco</label>
                            <span x-show="selectedAdoption && selectedAdoption.wantsToHelp" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                🤝 Disponibile
                            </span>
                            <span x-show="selectedAdoption && !selectedAdoption.wantsToHelp" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Non disponibile
                            </span>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Stato</label>
                            <span x-show="selectedAdoption" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border" 
                                  x-text="selectedAdoption ? getStatusText(selectedAdoption.status) : ''"></span>
                        </div>
                    </div>
                    
                    <div x-show="selectedAdoption && selectedAdoption.paymentProofUrl" class="border-t pt-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Ricevuta Pagamento</label>
                        <a :href="selectedAdoption ? selectedAdoption.paymentProofUrl : '#'" 
                           target="_blank" 
                           class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                            📄 Visualizza Ricevuta
                        </a>
                    </div>

                    <div class="border-t pt-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Note</label>
                        <textarea x-model="adoptionNotes" rows="3" 
                                  class="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                  placeholder="Aggiungi note per questa adozione..."></textarea>
                        <button @click="saveNotes()" 
                                class="mt-2 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                            Salva Note
                        </button>
                    </div>
                </div>
                <div class="px-6 py-4 bg-gray-50 text-right">
                    <button @click="showAdoptionModal = false" 
                            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                        Chiudi
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script>
        function adminDashboard() {
            return {
                activeTab: 'spaces',
                spaces: [],
                adoptions: [],
                stats: {},
                showImageModal: false,
                showAdoptionModal: false,
                selectedSpace: null,
                selectedAdoption: null,
                selectedImage: null,
                uploadProgress: 0,
                adoptionNotes: '',

                async init() {
                    await this.refreshData();
                },

                async refreshData() {
                    try {
                        const [spacesRes, adoptionsRes, statsRes] = await Promise.all([
                            fetch('/api/spaces'),
                            fetch('/api/adoptions'),
                            fetch('/api/stats')
                        ]);

                        if (spacesRes.ok) this.spaces = await spacesRes.json();
                        if (adoptionsRes.ok) this.adoptions = await adoptionsRes.json();
                        if (statsRes.ok) this.stats = await statsRes.json();
                    } catch (error) {
                        console.error('Error loading data:', error);
                        alert('Errore nel caricamento dei dati');
                    }
                },

                openImageModal(space) {
                    this.selectedSpace = space;
                    this.showImageModal = true;
                },

                openAdoptionModal(adoption) {
                    this.selectedAdoption = adoption;
                    this.adoptionNotes = adoption.notes || '';
                    this.showAdoptionModal = true;
                },

                handleImageUpload(event) {
                    this.selectedImage = event.target.files[0];
                },

                async uploadImage() {
                    if (!this.selectedImage || !this.selectedSpace) return;

                    const formData = new FormData();
                    formData.append('image', this.selectedImage);

                    try {
                        this.uploadProgress = 0;
                        const xhr = new XMLHttpRequest();
                        
                        xhr.upload.addEventListener('progress', (e) => {
                            if (e.lengthComputable) {
                                this.uploadProgress = Math.round((e.loaded / e.total) * 100);
                            }
                        });

                        xhr.onload = () => {
                            if (xhr.status === 200) {
                                alert('Immagine caricata con successo!');
                                this.showImageModal = false;
                                this.refreshData();
                                this.uploadProgress = 0;
                            } else {
                                alert('Errore nell\\'upload dell\\'immagine');
                                this.uploadProgress = 0;
                            }
                        };

                        xhr.open('PUT', \`/api/spaces/\${this.selectedSpace.id}/image\`);
                        xhr.send(formData);
                    } catch (error) {
                        console.error('Upload error:', error);
                        alert('Errore nell\\'upload dell\\'immagine');
                        this.uploadProgress = 0;
                    }
                },

                async updateAdoptionStatus(adoptionId, newStatus) {
                    try {
                        const response = await fetch(\`/api/adoptions/\${adoptionId}/status\`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ status: newStatus }),
                        });

                        if (response.ok) {
                            await this.refreshData();
                            alert('Stato aggiornato con successo!');
                        } else {
                            alert('Errore nell\\'aggiornamento dello stato');
                        }
                    } catch (error) {
                        console.error('Error updating status:', error);
                        alert('Errore nell\\'aggiornamento dello stato');
                    }
                },

                async saveNotes() {
                    if (!this.selectedAdoption) return;

                    try {
                        const response = await fetch(\`/api/adoptions/\${this.selectedAdoption.id}/notes\`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ notes: this.adoptionNotes }),
                        });

                        if (response.ok) {
                            alert('Note salvate con successo!');
                            await this.refreshData();
                        } else {
                            alert('Errore nel salvataggio delle note');
                        }
                    } catch (error) {
                        console.error('Error saving notes:', error);
                        alert('Errore nel salvataggio delle note');
                    }
                },

                viewAdoptionDetails(space) {
                    const adoption = this.adoptions.find(a => a.spaceId === space.id);
                    if (adoption) {
                        this.openAdoptionModal(adoption);
                    }
                },

                getStatusCount(status) {
                    return this.adoptions.filter(a => a.status === status).length;
                },

                getStatusText(status) {
                    const statusMap = {
                        'pending': '⏳ In Attesa',
                        'approved': '✅ Approvato',
                        'confirmed': '💰 Confermato',
                        'completed': '🎉 Completato',
                        'cancelled': '❌ Cancellato',
                        'rejected': '🚫 Rifiutato'
                    };
                    return statusMap[status] || status;
                }
            }
        }
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
