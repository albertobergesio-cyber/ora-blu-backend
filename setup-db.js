const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');

// Railway usa il filesystem temporaneo, quindi creiamo il DB in memoria o nella root
const isDevelopment = process.env.NODE_ENV !== 'production';
const dbPath = isDevelopment 
  ? path.join(__dirname, 'database', 'ora_blu.db')
  : path.join(__dirname, 'ora_blu.db'); // Railway: nella root

// Crea la directory del database solo in sviluppo
if (isDevelopment) {
  const dbDir = path.join(__dirname, 'database');
  fs.ensureDirSync(dbDir);
}

// Crea la directory per le immagini
const uploadsDir = path.join(__dirname, 'uploads');
fs.ensureDirSync(uploadsDir);

console.log('📁 Database path:', dbPath);
console.log('📁 Uploads path:', uploadsDir);

// Crea il database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Errore apertura database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connesso al database SQLite.');
});

// Crea le tabelle
db.serialize(() => {
  
  // Tabella spazi/stanze
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
      console.error('❌ Errore creazione tabella spaces:', err.message);
    } else {
      console.log('✅ Tabella spaces creata.');
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
      console.error('❌ Errore creazione tabella adoptions:', err.message);
    } else {
      console.log('✅ Tabella adoptions creata.');
    }
  });

  // Inserisci i dati iniziali degli spazi
  const spaces = [
    {
      name: 'Bagno 1',
      description: 'Contribuirai ad arredare il bagno con lavandino, tazza, bidet e piatto doccia (se rimane qualcosa compreremo anche degli asciugamani nuovi)',
      cost: 3000
    },
    {
      name: 'Vacanza',
      description: 'Manderemo i bambini in gita per qualche giorno durante il trasloco e pagherai le loro vacanze dell\'anno nuovo durante questo momento di cambiamento',
      cost: 5000
    },
    {
      name: 'Cameretta 1',
      description: 'Ikea ci ha regalato i lettini e con il tuo contributo arrederemo la stanza con scrivanie, sedie, due mobili, comodini e un bel tappeto accogliente',
      cost: 3000
    },
    {
      name: 'Cameretta 2',
      description: 'Ikea ci ha regalato i lettini e con il tuo contributo arrederemo la stanza con scrivanie, sedie, due mobili, comodini e un bel tappeto accogliente',
      cost: 3000
    },
    {
      name: 'Cameretta 3',
      description: 'Ikea ci ha regalato i lettini e con il tuo contributo arrederemo la stanza con scrivanie, sedie, due mobili, comodini e un bel tappeto accogliente',
      cost: 3000
    },
    {
      name: 'Cameretta 4',
      description: 'Ikea ci ha regalato i lettini e con il tuo contributo arrederemo la stanza con scrivanie, sedie, due mobili, comodini e un bel tappeto accogliente',
      cost: 3000
    },
    {
      name: 'Cameretta 5',
      description: 'Ikea ci ha regalato i lettini e con il tuo contributo arrederemo la stanza con scrivanie, sedie, due mobili, comodini e un bel tappeto accogliente',
      cost: 3000
    },
    {
      name: 'Cucina - Elettrodomestici (frigo e forno)',
      description: 'Elettrodomestici essenziali per la cucina: frigo e forno per preparare pasti nutrienti',
      cost: 3000
    },
    {
      name: 'Lavanderia - Lavatrici',
      description: 'Lavatrici professionali per garantire vestiti sempre puliti e profumati',
      cost: 2000
    },
    {
      name: 'Lavanderia - Asciugatrici',
      description: 'Asciugatrici efficienti per completare il ciclo di cura degli indumenti',
      cost: 3000
    },
    {
      name: 'Cucina - Elettrodomestici (fuochi, cappa e robot)',
      description: 'Piano cottura, cappa aspirante e robot da cucina per cucinare insieme',
      cost: 3000
    },
    {
      name: 'Cucina - Mobili e pensili',
      description: 'Mobili e pensili per organizzare e riporre tutto il necessario in cucina',
      cost: 3000
    },
    {
      name: 'Cucina - Tavolo e sedie',
      description: 'Un grande tavolo con sedie dove condividere i pasti tutti insieme',
      cost: 3000
    },
    {
      name: 'Soggiorno e TV',
      description: 'Area relax con televisione per momenti di svago e condivisione',
      cost: 3000
    },
    {
      name: 'Divano e tappeto gioco',
      description: 'Divano comodo e tappeto morbido per giocare e rilassarsi insieme',
      cost: 3000
    },
    {
      name: 'Giardino',
      description: 'Attrezzature e arredi per il giardino, spazio all\'aperto per giocare',
      cost: 3000
    },
    {
      name: 'Bagno 2',
      description: 'Secondo bagno completo per garantire comfort e privacy',
      cost: 3000
    },
    {
      name: 'Bagno 3',
      description: 'Terzo bagno per completare i servizi della struttura',
      cost: 3000
    },
    {
      name: 'Sala visite per incontri con i genitori',
      description: 'Spazio dedicato agli incontri con le famiglie d\'origine dei bambini',
      cost: 3000
    },
    {
      name: 'Armadi e libreria',
      description: 'Armadi per organizzare vestiti e librerie per custodire libri e giochi',
      cost: 3000
    }
  ];

  // Controlla se ci sono già dati
  db.get('SELECT COUNT(*) as count FROM spaces', (err, row) => {
    if (err) {
      console.error('❌ Errore controllo dati:', err.message);
      return;
    }
    
    if (row.count === 0) {
      console.log('🔄 Inserimento dati iniziali...');
      const insertStmt = db.prepare(`
        INSERT INTO spaces (name, description, cost) 
        VALUES (?, ?, ?)
      `);
      
      spaces.forEach((space, index) => {
        insertStmt.run([space.name, space.description, space.cost], (err) => {
          if (err) {
            console.error(`❌ Errore inserimento spazio ${index + 1}:`, err.message);
          } else {
            console.log(`✅ Spazio ${index + 1}/20 inserito: ${space.name}`);
          }
        });
      });
      
      insertStmt.finalize(() => {
        console.log('🎉 Tutti i dati iniziali inseriti!');
      });
    } else {
      console.log(`ℹ️ Database già popolato con ${row.count} spazi.`);
    }
  });
});

// Chiudi il database
db.close((err) => {
  if (err) {
    console.error('❌ Errore chiusura database:', err.message);
  } else {
    console.log('✅ Setup database completato!');
    console.log('🚀 Pronto per avviare il server!');
  }
});
