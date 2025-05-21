import express from 'express';
import { randomUUID } from 'crypto';

const app = express();
const PORT = 3000;

// Almacenamiento en memoria
const codigos = [];

// Agregar CORS y logging
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  console.log(`${req.method} ${req.url}`, req.body);
  next();
});

app.use(express.json({ type: 'application/json' }));

// GET /codigos
app.get('/codigos', (req, res) => {
  console.log('Códigos actuales:', codigos);
  res.json(codigos);
});

// GET /codigos/:id
app.get('/codigos/:id', (req, res) => {
  const codigo = codigos.find(c => c.id === req.params.id);
  if (codigo) res.json(codigo);
  else res.status(404).json({ message: 'Código no encontrado' });
});

// POST /codigos
app.post('/codigos', (req, res) => {
  console.log('Recibiendo código:', req.body);
  const { data, type } = req.body;
  if (!data || !type) {
    console.log('Error: Faltan campos requeridos');
    return res.status(400).json({ message: 'Faltan campos requeridos' });
  }

  const id = randomUUID().replace(/-/g, '').slice(0, 12);
  const nuevoCodigo = { id, data, type };
  codigos.push(nuevoCodigo);
  console.log('Código guardado exitosamente:', nuevoCodigo);
  res.status(201).json(nuevoCodigo);
});

// DELETE /codigos/:id
app.delete('/codigos/:id', (req, res) => {
  const index = codigos.findIndex(c => c.id === req.params.id);
  if (index !== -1) {
    codigos.splice(index, 1);
    res.json({ message: 'Código eliminado' });
  } else {
    res.status(404).json({ message: 'Código no encontrado' });
  }
});

// Inicializar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  process.exit(0);
});
