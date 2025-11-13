#!/bin/bash

echo "🚀 Installazione Backend L'Ora Blu"
echo "=================================="

# Controlla se Node.js è installato
if ! command -v node &> /dev/null; then
    echo "❌ Node.js non trovato. Installa Node.js prima di continuare."
    exit 1
fi

# Controlla se npm è installato
if ! command -v npm &> /dev/null; then
    echo "❌ npm non trovato. Installa npm prima di continuare."
    exit 1
fi

echo "📦 Installazione dipendenze..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dipendenze installate con successo!"
else
    echo "❌ Errore durante l'installazione delle dipendenze."
    exit 1
fi

echo "🗄️ Setup database..."
node setup-db.js

if [ $? -eq 0 ]; then
    echo "✅ Database configurato con successo!"
else
    echo "❌ Errore durante il setup del database."
    exit 1
fi

echo ""
echo "🎉 Installazione completata!"
echo ""
echo "Per avviare il server:"
echo "  npm start     (produzione)"
echo "  npm run dev   (sviluppo con auto-reload)"
echo ""
echo "Endpoints disponibili:"
echo "  🌐 API: http://localhost:3001/api/"
echo "  📊 Dashboard Admin: http://localhost:3001/admin"
echo "  📁 File uploads: http://localhost:3001/uploads/"
echo ""
