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

// GET - Ottieni dettagli di un singolo spazio
app.get('/api/spaces/:id', (req, res) => {
  const spaceId = req.params.id;
  
  const query = `
    SELECT s.*, 
           a.sponsor_name, a.sponsor_email, a.sponsor_phone, 
           a.wants_to_help, a.payment_proof_url, a.status as adoption_status,
           a.created_at as adoption_date, a.notes
    FROM spaces s
    LEFT JOIN adoptions a ON s.id = a.space_id AND s.adopted = 1
    WHERE s.id = ?
  `;
  
  db.get(query, [spaceId], (err, row) => {
    if (err) {
      console.error('Errore recupero spazio:', err.message);
      res.status(500).json({ error: 'Errore del database' });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'Spazio non trovato' });
      return;
    }
    
    const space = {
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
        adoptionDate: row.adoption_date,
        notes: row.notes
      } : null
    };
    
    res.json(space);
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

// PUT - Aggiorna stato adozione (admin)
app.put('/api/adoptions/:id/status', (req, res) => {
  const adoptionId = req.params.id;
  const { status, notes } = req.body;
  
  const allowedStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
  if (!allowedStatuses.includes(status)) {
    res.status(400).json({ error: 'Status non valido' });
    return;
  }
  
  db.run(
    'UPDATE adoptions SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, notes, adoptionId],
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
      
      res.json({
        message: 'Stato aggiornato con successo',
        adoptionId: adoptionId,
        status: status
      });
    }
  );
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

// =================
// ADMIN DASHBOARD HTML
// =================
app.get('/admin', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Dashboard - L'Ora Blu</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
            tailwind.config = {
                theme: {
                    extend: {
                        colors: {
                            'ora-blue': '#64748b',
                            'ora-orange': '#ea580c'
                        }
                    }
                }
            }
        </script>
    </head>
    <body class="bg-gray-50">
        <div class="container mx-auto p-6">
            <h1 class="text-3xl font-bold text-ora-blue mb-8">Dashboard Admin - L'Ora Blu</h1>
            
            <!-- Stats -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div class="bg-white p-6 rounded-lg shadow">
                    <h3 class="text-lg font-semibold text-gray-700">Spazi Totali</h3>
                    <p class="text-2xl font-bold text-ora-orange" id="totalSpaces">-</p>
                </div>
                <div class="bg-white p-6 rounded-lg shadow">
                    <h3 class="text-lg font-semibold text-gray-700">Spazi Adottati</h3>
                    <p class="text-2xl font-bold text-green-600" id="adoptedSpaces">-</p>
                </div>
                <div class="bg-white p-6 rounded-lg shadow">
                    <h3 class="text-lg font-semibold text-gray-700">Raccolto</h3>
                    <p class="text-2xl font-bold text-ora-blue" id="totalRaised">-</p>
                </div>
                <div class="bg-white p-6 rounded-lg shadow">
                    <h3 class="text-lg font-semibold text-gray-700">Volontari</h3>
                    <p class="text-2xl font-bold text-purple-600" id="volunteers">-</p>
                </div>
            </div>

            <!-- Tabs -->
            <div class="mb-6">
                <nav class="flex space-x-8">
                    <button class="tab-btn py-2 px-4 border-b-2 font-medium text-sm border-ora-orange text-ora-orange" onclick="showTab('spaces')">
                        Gestione Spazi
                    </button>
                    <button class="tab-btn py-2 px-4 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700" onclick="showTab('adoptions')">
                        Adozioni
                    </button>
                </nav>
            </div>

            <!-- Spaces Tab -->
            <div id="spaces-tab" class="tab-content">
                <div class="bg-white rounded-lg shadow overflow-hidden">
                    <table class="min-w-full">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spazio</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Costo</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Immagine</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
                            </tr>
                        </thead>
                        <tbody id="spaces-table" class="bg-white divide-y divide-gray-200">
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Adoptions Tab -->
            <div id="adoptions-tab" class="tab-content hidden">
                <div class="bg-white rounded-lg shadow overflow-hidden">
                    <table class="min-w-full">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spazio</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sponsor</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contatti</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volontario</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
                            </tr>
                        </thead>
                        <tbody id="adoptions-table" class="bg-white divide-y divide-gray-200">
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Modal per upload immagine -->
        <div id="imageModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
            <div class="bg-white p-6 rounded-lg max-w-md w-full mx-4">
                <h3 class="text-lg font-semibold mb-4">Carica Immagine Cantiere</h3>
                <form id="imageForm" enctype="multipart/form-data">
                    <input type="hidden" id="spaceId" name="spaceId">
                    <input type="file" id="imageFile" name="image" accept="image/*" class="mb-4 w-full">
                    <div class="flex gap-3">
                        <button type="button" onclick="closeImageModal()" class="px-4 py-2 bg-gray-300 rounded">Annulla</button>
                        <button type="submit" class="px-4 py-2 bg-ora-orange text-white rounded">Carica</button>
                    </div>
                </form>
            </div>
        </div>

        <script>
            let currentTab = 'spaces';
            
            async function loadStats() {
                try {
                    const response = await fetch('/api/stats');
                    const stats = await response.json();
                    document.getElementById('totalSpaces').textContent = stats.totalSpaces;
                    document.getElementById('adoptedSpaces').textContent = stats.adoptedSpaces;
                    document.getElementById('totalRaised').textContent = '€' + stats.totalRaised.toLocaleString();
                    document.getElementById('volunteers').textContent = stats.volunteersAvailable;
                } catch (error) {
                    console.error('Errore caricamento statistiche:', error);
                }
            }

            async function loadSpaces() {
                try {
                    const response = await fetch('/api/spaces');
                    const spaces = await response.json();
                    const tableBody = document.getElementById('spaces-table');
                    
                    tableBody.innerHTML = spaces.map(space => \`
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="text-sm font-medium text-gray-900">\${space.name}</div>
                                <div class="text-sm text-gray-500">\${space.description.substring(0, 60)}...</div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                €\${space.cost.toLocaleString()}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full \${space.adopted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                                    \${space.adopted ? 'Adottato' : 'Disponibile'}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                \${space.imageUrl ? 
                                    \`<img src="\${space.imageUrl}" class="h-10 w-10 object-cover rounded" alt="Cantiere">\` : 
                                    '<span class="text-gray-400">Nessuna</span>'
                                }
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button onclick="openImageModal(\${space.id})" class="text-ora-orange hover:text-ora-orange/80">
                                    \${space.imageUrl ? 'Cambia' : 'Aggiungi'} Immagine
                                </button>
                            </td>
                        </tr>
                    \`).join('');
                } catch (error) {
                    console.error('Errore caricamento spazi:', error);
                }
            }

            async function loadAdoptions() {
                try {
                    const response = await fetch('/api/adoptions');
                    const adoptions = await response.json();
                    const tableBody = document.getElementById('adoptions-table');
                    
                    tableBody.innerHTML = adoptions.map(adoption => \`
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="text-sm font-medium text-gray-900">\${adoption.spaceName}</div>
                                <div class="text-sm text-gray-500">€\${adoption.spaceCost.toLocaleString()}</div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                \${adoption.sponsorName}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div>\${adoption.sponsorEmail || 'N/A'}</div>
                                <div>\${adoption.sponsorPhone || 'N/A'}</div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full \${adoption.wantsToHelp ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}">
                                    \${adoption.wantsToHelp ? 'Sì' : 'No'}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full status-\${adoption.status}">
                                    \${adoption.status}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <select onchange="updateAdoptionStatus(\${adoption.id}, this.value)" class="text-sm border rounded px-2 py-1">
                                    <option value="pending" \${adoption.status === 'pending' ? 'selected' : ''}>Pending</option>
                                    <option value="confirmed" \${adoption.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                                    <option value="completed" \${adoption.status === 'completed' ? 'selected' : ''}>Completed</option>
                                    <option value="cancelled" \${adoption.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                                </select>
                                \${adoption.paymentProofUrl ? \`<a href="\${adoption.paymentProofUrl}" target="_blank" class="ml-2 text-blue-600 hover:text-blue-900">📄</a>\` : ''}
                            </td>
                        </tr>
                    \`).join('');
                } catch (error) {
                    console.error('Errore caricamento adozioni:', error);
                }
            }

            function showTab(tab) {
                // Update tab buttons
                document.querySelectorAll('.tab-btn').forEach(btn => {
                    btn.classList.remove('border-ora-orange', 'text-ora-orange');
                    btn.classList.add('border-transparent', 'text-gray-500');
                });
                event.target.classList.remove('border-transparent', 'text-gray-500');
                event.target.classList.add('border-ora-orange', 'text-ora-orange');
                
                // Update tab content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.add('hidden');
                });
                document.getElementById(\`\${tab}-tab\`).classList.remove('hidden');
                
                currentTab = tab;
                if (tab === 'adoptions') {
                    loadAdoptions();
                }
            }

            function openImageModal(spaceId) {
                document.getElementById('spaceId').value = spaceId;
                document.getElementById('imageModal').classList.remove('hidden');
                document.getElementById('imageModal').classList.add('flex');
            }

            function closeImageModal() {
                document.getElementById('imageModal').classList.add('hidden');
                document.getElementById('imageModal').classList.remove('flex');
                document.getElementById('imageForm').reset();
            }

            async function updateAdoptionStatus(adoptionId, status) {
                try {
                    const response = await fetch(\`/api/adoptions/\${adoptionId}/status\`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ status })
                    });
                    
                    if (response.ok) {
                        alert('Status aggiornato!');
                        loadAdoptions();
                        loadStats();
                    }
                } catch (error) {
                    console.error('Errore aggiornamento status:', error);
                    alert('Errore aggiornamento status');
                }
            }

            document.getElementById('imageForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData();
                const spaceId = document.getElementById('spaceId').value;
                const imageFile = document.getElementById('imageFile').files[0];
                
                if (!imageFile) {
                    alert('Seleziona un file');
                    return;
                }
                
                formData.append('image', imageFile);
                
                try {
                    const response = await fetch(\`/api/spaces/\${spaceId}/image\`, {
                        method: 'PUT',
                        body: formData
                    });
                    
                    if (response.ok) {
                        alert('Immagine caricata!');
                        closeImageModal();
                        loadSpaces();
                    }
                } catch (error) {
                    console.error('Errore upload immagine:', error);
                    alert('Errore caricamento immagine');
                }
            });

            // Load initial data
            document.addEventListener('DOMContentLoaded', () => {
                loadStats();
                loadSpaces();
            });
        </script>
        
        <style>
            .status-pending { @apply bg-yellow-100 text-yellow-800; }
            .status-confirmed { @apply bg-blue-100 text-blue-800; }
            .status-completed { @apply bg-green-100 text-green-800; }
            .status-cancelled { @apply bg-red-100 text-red-800; }
        </style>
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
  console.log(\`🚀 Server in esecuzione su http://localhost:\${PORT}\`);
  console.log(\`📊 Dashboard admin: http://localhost:\${PORT}/admin\`);
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
