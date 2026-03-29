require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server: SocketIO } = require('socket.io');
const cors = require('cors');

const connectDB = require('./config/db');
const { loadAccount } = require('./config/algorand');
const authRoutes = require('./routes/authRoutes');
const voteRoutes = require('./routes/voteRoutes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
const httpServer = http.createServer(app);

// ── Socket.io setup ───────────────────────────────────────────────────────
const io = new SocketIO(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // Send current results on connect
  socket.on('requestResults', async () => {
    try {
      const Vote = require('./models/Vote');
      const results = await Vote.aggregate([
        { $group: { _id: { candidateId: '$candidateId', candidate: '$candidate' }, votes: { $sum: 1 } } },
        { $project: { _id: 0, candidateId: '$_id.candidateId', candidate: '$_id.candidate', votes: 1 } },
        { $sort: { votes: -1 } },
      ]);
      socket.emit('currentResults', {
        results,
        totalVotes: results.reduce((s, r) => s + r.votes, 0),
      });
    } catch (err) {
      socket.emit('socketError', { message: 'Failed to fetch results' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Request logger (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`→ ${req.method} ${req.originalUrl}`);
    next();
  });
}

// ── Routes ─────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'VoxChain API is running', timestamp: new Date().toISOString() });
});

app.use('/api', authRoutes);
app.use('/api', voteRoutes);

app.use(notFound);
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  loadAccount();
  httpServer.listen(PORT, () => {
    console.log(`\n🚀 VoxChain API  →  http://localhost:${PORT}`);
    console.log(`   Socket.io     →  enabled`);
    console.log(`   Environment   →  ${process.env.NODE_ENV || 'development'}\n`);
  });
};

start();

const shutdown = (signal) => {
  console.log(`\n${signal} — shutting down...`);
  httpServer.close(() => process.exit(0));
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err.message);
  httpServer.close(() => process.exit(1));
});
