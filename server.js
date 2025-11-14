const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (immagini)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database setup
const dbPath = path.join(__dirname, 'ora_blu.db');
const uploadsDir = path.join(__dirname, 'uploads');
fs.ensureDirSync(uploadsDir);

console.log('📂 Database:', dbPath);
console.log('📂 Uploads:', uploadsDir);

// Database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database error:', err.message);
    process.exit(1);
  }
  console.log('✅ Database connected');
});

// Create tables
db.serialize(() => {
  // Spaces table
  db.run(`CREATE TABLE IF NOT EXISTS spaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    cost INTEGER NOT NULL,
    adopted BOOLEAN DEFAULT 0,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('❌ Spaces table error:', err.message);
    else console.log('✅ Spaces table ready');
  });

  // Adoptions table
  db.run(`CREATE TABLE IF NOT EXISTS adoptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    space_id INTEGER NOT NULL,
    sponsor_name TEXT NOT NULL,
    sponsor_email TEXT,
    sponsor_phone TEXT,
    wants_to_help BOOLEAN DEFAULT 0,
    payment_proof_url TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (space_id) REFERENCES spaces (id)
  )`, (err) => {
    if (err) console.error('❌ Adoptions table error:', err.message);
    else console.log('✅ Adoptions table ready');
  });

  // Media table
  db.run(`CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    filename TEXT NOT NULL,
    url TEXT NOT NULL,
    caption TEXT,
    description TEXT,
    position INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('❌ Media table error:', err.message);
    else console.log('✅ Media table ready');
  });
});

// Insert sample spaces if empty
db.get('SELECT COUNT(*) as count FROM spaces', (err, row) => {
  if (err) {
    console.error('❌ Count error:', err.message);
    return;
  }
  
  if (row.count === 0) {
    console.log('📦 Adding sample spaces...');
    const spaces = [
      { name: 'Bagno 1', description: 'Arredo bagno completo con lavandino, tazza, bidet e doccia', cost: 3000 },
      { name: 'Cameretta 1', description: 'Camera accogliente con letti, armadi e scrivania', cost: 8000 },
      { name: 'Cucina', description: 'Il cuore della casa con elettrodomestici e mobili', cost: 12000 },
      { name: 'Sala Giochi', description: 'Spazio dedicato al gioco e alle attività ricreative', cost: 6000 },
      { name: 'Giardino', description: 'Spazio verde esterno per giocare all\'aria aperta', cost: 4000 }
    ];

    const stmt = db.prepare('INSERT INTO spaces (name, description, cost) VALUES (?, ?, ?)');
    spaces.forEach(space => {
      stmt.run(space.name, space.description, space.cost, (err) => {
        if (err) console.error(`❌ Insert error for ${space.name}:`, err.message);
        else console.log(`✅ Added: ${space.name}`);
      });
    });
    stmt.finalize();
  } else {
    console.log(`📊 Found ${row.count} existing spaces`);
  }
});

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// ===== API ROUTES =====

// GET - All spaces
app.get('/api/spaces', (req, res) => {
  console.log('📍 GET /api/spaces');
  db.all('SELECT * FROM spaces ORDER BY name', [], (err, rows) => {
    if (err) {
      console.error('❌ Spaces query error:', err.message);
      res.status(500).json({ error: 'Database error' });
    } else {
      console.log(`✅ Returning ${rows.length} spaces`);
      res.json(rows);
    }
  });
});

// GET - All adoptions
app.get('/api/adoptions', (req, res) => {
  console.log('📍 GET /api/adoptions');
  db.all(`
    SELECT a.*, s.name as space_name, s.cost as space_cost 
    FROM adoptions a 
    LEFT JOIN spaces s ON a.space_id = s.id 
    ORDER BY a.created_at DESC
  `, [], (err, rows) => {
    if (err) {
      console.error('❌ Adoptions query error:', err.message);
      res.status(500).json({ error: 'Database error' });
    } else {
      console.log(`✅ Returning ${rows.length} adoptions`);
      res.json(rows);
    }
  });
});

// GET - Stats
app.get('/api/stats', (req, res) => {
  console.log('📍 GET /api/stats');
  
  db.get('SELECT COUNT(*) as total_spaces, COUNT(CASE WHEN adopted = 1 THEN 1 END) as adopted_spaces FROM spaces', (err, spacesRow) => {
    if (err) {
      console.error('❌ Stats query error:', err.message);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    
    db.get('SELECT COUNT(*) as total_adoptions FROM adoptions', (err, adoptionsRow) => {
      if (err) {
        console.error('❌ Adoptions stats error:', err.message);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      
      const stats = {
        total_spaces: spacesRow.total_spaces,
        adopted_spaces: spacesRow.adopted_spaces,
        available_spaces: spacesRow.total_spaces - spacesRow.adopted_spaces,
        total_adoptions: adoptionsRow.total_adoptions,
        collected_amount: spacesRow.adopted_spaces * 3000,
        progress_percentage: spacesRow.total_spaces > 0 ? Math.round((spacesRow.adopted_spaces / spacesRow.total_spaces) * 100) : 0
      };
      
      console.log('✅ Stats calculated:', stats);
      res.json(stats);
    });
  });
});

// GET - Media
app.get('/api/media', (req, res) => {
  console.log('📍 GET /api/media');
  
  const queries = {
    logo: 'SELECT * FROM media WHERE type = "logo" AND active = 1 ORDER BY created_at DESC LIMIT 1',
    carousel: 'SELECT * FROM media WHERE type = "carousel" AND active = 1 ORDER BY position, created_at'
  };
  
  const media = {};
  let completed = 0;
  
  Object.keys(queries).forEach(type => {
    db.all(queries[type], [], (err, rows) => {
      if (err) {
        console.error(`❌ ${type} query error:`, err.message);
      } else {
        if (type === 'logo') {
          media.logo = rows.length > 0 ? rows[0].url : null;
        } else {
          media.carousel = rows;
        }
        console.log(`✅ ${type}: ${rows.length} items`);
      }
      
      completed++;
      if (completed === Object.keys(queries).length) {
        res.json(media);
      }
    });
  });
});

// POST - Upload space image
app.post('/api/spaces/:id/image', upload.single('image'), (req, res) => {
  const spaceId = req.params.id;
  console.log(`📍 POST /api/spaces/${spaceId}/image`);
  
  if (!req.file) {
    console.error('❌ No file uploaded');
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const imageUrl = `/uploads/${req.file.filename}`;
  console.log(`📷 Saving image: ${imageUrl}`);
  
  db.run(
    'UPDATE spaces SET image_url = ? WHERE id = ?',
    [imageUrl, spaceId],
    function(err) {
      if (err) {
        console.error('❌ Update error:', err.message);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      
      if (this.changes === 0) {
        console.error('❌ Space not found');
        res.status(404).json({ error: 'Space not found' });
        return;
      }
      
      console.log(`✅ Image updated for space ${spaceId}`);
      res.json({ success: true, image_url: imageUrl });
    }
  );
});

// POST - Upload logo
app.post('/api/media/logo', upload.single('logo'), (req, res) => {
  console.log('📍 POST /api/media/logo');
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const url = `/uploads/${req.file.filename}`;
  
  // Deactivate previous logo
  db.run('UPDATE media SET active = 0 WHERE type = "logo"', [], (err) => {
    if (err) {
      console.error('❌ Deactivate error:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Insert new logo
    db.run(
      'INSERT INTO media (type, filename, url, active) VALUES (?, ?, ?, 1)',
      ['logo', req.file.filename, url],
      function(err) {
        if (err) {
          console.error('❌ Logo insert error:', err.message);
          res.status(500).json({ error: 'Database error' });
        } else {
          console.log('✅ Logo uploaded:', url);
          res.json({ success: true, url: url });
        }
      }
    );
  });
});

// POST - Upload carousel image
app.post('/api/media/carousel', upload.single('image'), (req, res) => {
  console.log('📍 POST /api/media/carousel');
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const url = `/uploads/${req.file.filename}`;
  const caption = req.body.caption || '';
  const description = req.body.description || '';
  
  db.run(
    'INSERT INTO media (type, filename, url, caption, description, active) VALUES (?, ?, ?, ?, ?, 1)',
    ['carousel', req.file.filename, url, caption, description],
    function(err) {
      if (err) {
        console.error('❌ Carousel insert error:', err.message);
        res.status(500).json({ error: 'Database error' });
      } else {
        console.log('✅ Carousel image uploaded:', url);
        res.json({ success: true, url: url });
      }
    }
  );
});

// DELETE - Delete carousel image
app.delete('/api/media/carousel/:id', (req, res) => {
  const imageId = req.params.id;
  console.log(`📍 DELETE /api/media/carousel/${imageId}`);
  
  db.run('DELETE FROM media WHERE id = ? AND type = "carousel"', [imageId], function(err) {
    if (err) {
      console.error('❌ Delete error:', err.message);
      res.status(500).json({ error: 'Database error' });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Image not found' });
    } else {
      console.log(`✅ Carousel image ${imageId} deleted`);
      res.json({ success: true });
    }
  });
});

// POST - Create adoption
app.post('/api/spaces/:id/adopt', upload.single('paymentProof'), (req, res) => {
  const spaceId = req.params.id;
  console.log(`📍 POST /api/spaces/${spaceId}/adopt`);
  
  const { sponsorName, sponsorEmail, sponsorPhone, wantsToHelp } = req.body;
  const paymentProofUrl = req.file ? `/uploads/${req.file.filename}` : null;
  
  db.run(
    'INSERT INTO adoptions (space_id, sponsor_name, sponsor_email, sponsor_phone, wants_to_help, payment_proof_url) VALUES (?, ?, ?, ?, ?, ?)',
    [spaceId, sponsorName, sponsorEmail, sponsorPhone, wantsToHelp === 'on' ? 1 : 0, paymentProofUrl],
    function(err) {
      if (err) {
        console.error('❌ Adoption insert error:', err.message);
        res.status(500).json({ error: 'Database error' });
      } else {
        console.log(`✅ Adoption created for space ${spaceId} by ${sponsorName}`);
        
        // Mark space as adopted
        db.run('UPDATE spaces SET adopted = 1 WHERE id = ?', [spaceId]);
        
        res.json({ success: true, adoption_id: this.lastID });
      }
    }
  );
});

// ===== STATIC ROUTES =====

// Serve dashboard admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Frontend: http://localhost:${PORT}`);
  console.log(`📊 Admin: http://localhost:${PORT}/admin`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🔄 Shutting down...');
  db.close((err) => {
    if (err) console.error('❌ Database close error:', err.message);
    else console.log('✅ Database closed');
    process.exit(0);
  });
});
