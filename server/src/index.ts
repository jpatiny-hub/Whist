import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authRouter } from './routes/auth';
import { playersRouter } from './routes/players';
import { gamesRouter } from './routes/games';
import { handsRouter } from './routes/hands';
import { statsRouter, contractsRouter } from './routes/stats';

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((o) => o.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/players', playersRouter);
app.use('/api/games', gamesRouter);
app.use('/api/games/:gameId/hands', handsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/contracts', contractsRouter);

// In production, serve the built web app from the same process so the whole
// group only needs one deployed server (see README "Déploiement").
const webDist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
app.use(express.static(webDist));
app.get(/^(?!\/api\/).*/, (_req, res, next) => {
  res.sendFile(path.join(webDist, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Whist API en écoute sur http://localhost:${port}`);
});
