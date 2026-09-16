import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';

export const gamesRouter = Router();
gamesRouter.use(requireAuth);

gamesRouter.get('/', async (_req, res) => {
  const games = await prisma.game.findMany({
    orderBy: { startedAt: 'desc' },
    include: { players: { include: { player: true }, orderBy: { seat: 'asc' } } },
  });
  res.json({ games });
});

const createSchema = z.object({
  label: z.string().max(120).optional(),
  playerIds: z.array(z.string().min(1)).length(4, 'Une partie de whist se joue à 4'),
});

gamesRouter.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide' });
  }
  const { label, playerIds } = parsed.data;
  if (new Set(playerIds).size !== 4) {
    return res.status(400).json({ error: 'Les 4 joueurs doivent être distincts' });
  }
  const players = await prisma.player.findMany({ where: { id: { in: playerIds } } });
  if (players.length !== 4) {
    return res.status(400).json({ error: 'Un ou plusieurs joueurs sont introuvables' });
  }

  const game = await prisma.game.create({
    data: {
      label,
      createdByUserId: req.user!.userId,
      players: {
        create: playerIds.map((playerId, seat) => ({ playerId, seat })),
      },
    },
    include: { players: { include: { player: true }, orderBy: { seat: 'asc' } } },
  });
  res.status(201).json({ game });
});

gamesRouter.get('/:id', async (req, res) => {
  const game = await prisma.game.findUnique({
    where: { id: req.params.id },
    include: {
      players: { include: { player: true }, orderBy: { seat: 'asc' } },
      hands: {
        orderBy: { handNumber: 'asc' },
        include: {
          dealer: true,
          declarations: { include: { declarers: { include: { player: true } } } },
          playerScores: { include: { player: true } },
        },
      },
    },
  });
  if (!game) return res.status(404).json({ error: 'Partie introuvable' });
  res.json({ game });
});

gamesRouter.post('/:id/close', async (req, res) => {
  const game = await prisma.game.findUnique({ where: { id: req.params.id } });
  if (!game) return res.status(404).json({ error: 'Partie introuvable' });
  if (game.status === 'CLOSED') return res.status(400).json({ error: 'La partie est déjà clôturée' });
  const updated = await prisma.game.update({
    where: { id: req.params.id },
    data: { status: 'CLOSED', endedAt: new Date() },
  });
  res.json({ game: updated });
});
