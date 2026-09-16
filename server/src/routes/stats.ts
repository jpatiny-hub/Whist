import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { computeGameStats, computePlayerStats } from '../stats';
import { CONTRACT_LADDER, CONTRACTS, listContracts, scoreContract } from '../rules/contracts';

export const statsRouter = Router();
statsRouter.use(requireAuth);

statsRouter.get('/players/:id', async (req, res) => {
  const stats = await computePlayerStats(req.params.id);
  if (!stats) return res.status(404).json({ error: 'Joueur introuvable' });
  res.json({ stats });
});

statsRouter.get('/games/:id', async (req, res) => {
  const stats = await computeGameStats(req.params.id);
  if (!stats) return res.status(404).json({ error: 'Partie introuvable' });
  res.json({ stats });
});

export const contractsRouter = Router();
contractsRouter.use(requireAuth);
contractsRouter.get('/', (_req, res) => {
  const contracts = listContracts();
  const pointsTables = Object.fromEntries(
    contracts.map((c) => [
      c.code,
      Array.from({ length: 14 }, (_, tricks) => ({ tricks, ...scoreContract(c.code, tricks) })).filter(
        (row) => row.tricks >= Math.max(0, c.requiredTricks - 2),
      ),
    ]),
  );
  res.json({ contracts, ladder: CONTRACT_LADDER, byCode: CONTRACTS, pointsTables });
});
