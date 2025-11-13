# Backend L'Ora Blu - Sistema di Gestione Campagna Crowdfunding

Sistema backend completo per gestire la campagna di crowdfunding "Facciamola bella!" de L'Ora Blu, con database SQLite, API REST e dashboard admin.

## 🚀 Installazione Rapida

### Prerequisiti
- Node.js (versione 14 o superiore)
- npm (incluso con Node.js)

### Setup

1. **Clona o estrai i file del backend**
2. **Esegui lo script di installazione:**
   ```bash
   chmod +x install.sh
   ./install.sh
   ```

3. **Avvia il server:**
   ```bash
   npm start          # Produzione
   npm run dev        # Sviluppo (auto-reload)
   ```

## 📊 Accesso al Sistema

- **API Base URL:** `http://localhost:3001/api/`
- **Dashboard Admin:** `http://localhost:3001/admin`
- **File Uploads:** `http://localhost:3001/uploads/`

## 🗄️ Database

Il sistema utilizza SQLite con le seguenti tabelle:

### `spaces` - Spazi della campagna
- `id` - ID univoco
- `name` - Nome dello spazio
- `description` - Descrizione dettagliata
- `cost` - Costo dell'adozione
- `adopted` - Se è stato adottato (0/1)
- `adopted_by` - Nome del sponsor
- `image_url` - URL immagine del cantiere
- `created_at`, `updated_at` - Timestamp

### `adoptions` - Dettagli adozioni
- `id` - ID univoco dell'adozione
- `space_id` - Riferimento allo spazio
- `sponsor_name` - Nome/azienda sponsor
- `sponsor_email` - Email del sponsor
- `sponsor_phone` - Telefono del sponsor
- `wants_to_help` - Disponibilità per il volontariato (0/1)
- `payment_proof_url` - URL ricevuta di pagamento
- `status` - Stato: pending/confirmed/completed/cancelled
- `notes` - Note admin
- `created_at`, `updated_at` - Timestamp

## 🔌 API Endpoints

### Spazi
- `GET /api/spaces` - Lista tutti gli spazi
- `GET /api/spaces/:id` - Dettagli spazio specifico
- `POST /api/spaces/:id/adopt` - Adotta uno spazio
- `PUT /api/spaces/:id/image` - Carica immagine cantiere (multipart/form-data)

### Adozioni
- `GET /api/adoptions` - Lista tutte le adozioni
- `PUT /api/adoptions/:id/status` - Aggiorna stato adozione

### Statistiche
- `GET /api/stats` - Statistiche campagna

## 📱 Frontend Integration

Per connettere il frontend React al backend, aggiorna le chiamate API:

```javascript
// Esempio di adozione spazio
const adoptSpace = async (spaceId, formData) => {
  const response = await fetch(`http://localhost:3001/api/spaces/${spaceId}/adopt`, {
    method: 'POST',
    body: formData // Include file upload
  });
  return response.json();
};

// Carica spazi con immagini
const loadSpaces = async () => {
  const response = await fetch('http://localhost:3001/api/spaces');
  const spaces = await response.json();
  // spaces[].imageUrl contiene l'URL dell'immagine se presente
  return spaces;
};
```

## 👨‍💼 Dashboard Admin

Accedi a `http://localhost:3001/admin` per:

### Gestione Spazi
- Visualizzare tutti gli spazi
- Caricare/aggiornare immagini del cantiere
- Vedere stato adozioni

### Gestione Adozioni
- Lista completa delle adozioni
- Dettagli sponsor e contatti
- Aggiornare stati (pending → confirmed → completed)
- Visualizzare ricevute di pagamento
- Identificare volontari disponibili per il trasloco

### Statistiche
- Spazi totali e adottati
- Importo raccolto vs obiettivo
- Numero volontari disponibili
- Progressi della campagna

## 📁 Struttura File

```
ora-blu-backend/
├── server.js           # Server principale
├── setup-db.js        # Setup database
├── package.json        # Dipendenze
├── install.sh          # Script installazione
├── database/           # Database SQLite
│   └── ora_blu.db
└── uploads/           # File caricati
    ├── images/        # Immagini cantiere
    └── receipts/      # Ricevute pagamento
```

## 🔧 Configurazione

### Variabili Environment (opzionali)
```bash
PORT=3001                    # Porta server
DATABASE_PATH=./database/    # Path database
UPLOADS_PATH=./uploads/      # Path upload files
```

### CORS
Il server è configurato per accettare richieste da qualsiasi origine. Per produzione, limita i domini in `server.js`:

```javascript
app.use(cors({
  origin: ['http://localhost:3000', 'https://tuodominio.com']
}));
```

## 📷 Upload Immagini

### Limiti File
- **Dimensione max:** 5MB
- **Formati:** JPG, PNG, GIF, PDF
- **Storage:** Filesystem locale (`/uploads/`)

### Esempi API
```javascript
// Upload immagine cantiere (admin)
const uploadImage = async (spaceId, imageFile) => {
  const formData = new FormData();
  formData.append('image', imageFile);
  
  const response = await fetch(`/api/spaces/${spaceId}/image`, {
    method: 'PUT',
    body: formData
  });
  
  return response.json(); // { imageUrl: "/uploads/filename.jpg" }
};
```

## 🔒 Sicurezza

### Considerazioni Produzione
- [ ] Autenticazione admin dashboard
- [ ] Rate limiting sulle API
- [ ] Validazione input più rigorosa
- [ ] HTTPS
- [ ] Backup database automatico
- [ ] Logs strutturati

## 🐛 Debug

### Logs
```bash
# Avvia con logs dettagliati
DEBUG=* npm run dev
```

### Database
```bash
# Accedi direttamente al database
sqlite3 database/ora_blu.db
.tables
.schema spaces
SELECT * FROM adoptions;
```

## 📧 Supporto

Per problemi tecnici:
1. Controlla i logs del server
2. Verifica la struttura del database
3. Controlla i permessi file uploads/
4. Testa gli endpoint con curl/Postman

### Test API
```bash
# Test base
curl http://localhost:3001/api/spaces

# Test upload
curl -X PUT \
  -F "image=@test.jpg" \
  http://localhost:3001/api/spaces/1/image
```

---

**Sviluppato per L'Ora Blu - Libera Compagnia di Arti & Mestieri Sociali**
