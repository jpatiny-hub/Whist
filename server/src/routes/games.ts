import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { maxCardsForPlayers } from '../rules/rikiki';

export const gamesRouter = Router();
gamesRouter.use(requireAuth);

const RIKIKI_MIN_PLAYERS = 3;
const RIKIKI_MAX_PLAYERS = 8;

gamesRouter.get('/', async (_req, res) => {
  const games = await prisma.game.findMany({
    orderBy: { startedAt: 'desc' },
    include: { players: { include: { player: true }, orderBy: { seat: 'asc' } } },
  });
  res.json({ games });
});

const createSchema = z.object({
  type: z.enum(['WHIST', 'RIKIKI']).default('WHIST'),
  label: z.string().max(120).optional(),
  playerIds: z.array(z.string().min(1)).min(3).max(RIKIKI_MAX_PLAYERS),
  rikikiPeak: z.number().int().min(1).optional(),
  rikikiDoublePeak: z.boolean().optional(),
  rikikiZeroBidPenalty: z.boolean().optional(),
});

gamesRouter.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide' });
  }
  const { type, label, playerIds } = parsed.data;

  if (new Set(playerIds).size !== playerIds.length) {
    return res.status(400).json({ error: 'Les joueurs doivent être distincts' });
  }
  if (type === 'WHIST' && playerIds.length !== 4) {
    return res.status(400).json({ error: 'Une partie de whist se joue à 4' });
  }
  if (type === 'RIKIKI' && playerIds.length < RIKIKI_MIN_PLAYERS) {
    return res.status(400).json({ error: `Une partie de Rikiki nécessite au moins ${RIKIKI_MIN_PLAYERS} joueurs` });
  }

  const players = await prisma.player.findMany({ where: { id: { in: playerIds } } });
  if (players.length !== playerIds.length) {
    return res.status(400).json({ error: 'Un ou plusieurs joueurs sont introuvables' });
  }

  let rikikiPeak: number | null = null;
  let rikikiDoublePeak = false;
  let rikikiZeroBidPenalty = false;
  if (type === 'RIKIKI') {
    const max = maxCardsForPlayers(playerIds.length);
    rikikiPeak = parsed.data.rikikiPeak ?? max;
    if (rikikiPeak < 1 || rikikiPeak > max) {
      return res.status(400).json({ error: `Le pic de cartes doit être compris entre 1 et ${max} pour ${playerIds.length} joueurs` });
    }
    rikikiDoublePeak = parsed.data.rikikiDoublePeak ?? false;
    rikikiZeroBidPenalty = parsed.data.rikikiZeroBidPenalty ?? false;
  }

  const game = await prisma.game.create({
    data: {
      type,
      label,
      createdByUserId: req.user!.userId,
      rikikiPeak,
      rikikiDoublePeak,
      rikikiZeroBidPenalty,
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
      rikikiRounds: {
        orderBy: { roundNumber: 'asc' },
        include: {
          dealer: true,
          bids: { include: { player: true } },
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
