import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { buildRoundSequence, computeRoundPoints, isForbiddenBid } from '../rules/rikiki';

export const rikikiRouter: Router = Router({ mergeParams: true });
rikikiRouter.use(requireAuth);

const bidSchema = z.object({
  playerId: z.string(),
  bid: z.number().int().min(0),
  tricksWon: z.number().int().min(0),
});

const roundSchema = z.object({
  dealerId: z.string(),
  bids: z.array(bidSchema).min(1),
});

async function loadRikikiGame(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: true,
      rikikiRounds: { orderBy: { roundNumber: 'asc' }, include: { bids: true } },
    },
  });
  if (!game || game.type !== 'RIKIKI') return null;
  return game;
}

type RikikiGame = NonNullable<Awaited<ReturnType<typeof loadRikikiGame>>>;

/**
 * Validates and scores a round's bids against the game's current state.
 * `excludeRoundNumber` lets an edit recompute the zero-bid-penalty history
 * without counting the round being edited against itself.
 */
function computeRoundOutcome(
  game: RikikiGame,
  roundNumber: number,
  dealerId: string,
  bids: { playerId: string; bid: number; tricksWon: number }[],
  excludeRoundNumber?: number,
): { error: string } | { cardsDealt: number; results: { playerId: string; bid: number; tricksWon: number; points: number; success: boolean; zeroBidPenalty: boolean }[] } {
  const validPlayerIds = new Set(game.players.map((p) => p.playerId));
  const sequence = buildRoundSequence(game.players.length, game.rikikiPeak ?? game.players.length, game.rikikiDoublePeak ?? false);
  if (roundNumber < 1 || roundNumber > sequence.length) {
    return { error: 'Toutes les manches de cette partie ont déjà été jouées' };
  }
  const cardsDealt = sequence[roundNumber - 1];

  if (!validPlayerIds.has(dealerId)) return { error: "Le donneur doit être l'un des joueurs de la partie" };
  if (bids.length !== game.players.length) return { error: 'Chaque joueur doit avoir une annonce' };
  const seenPlayers = new Set<string>();
  for (const b of bids) {
    if (!validPlayerIds.has(b.playerId)) return { error: `Le joueur ${b.playerId} ne fait pas partie de cette partie` };
    if (seenPlayers.has(b.playerId)) return { error: 'Chaque joueur ne peut avoir qu\'une annonce par manche' };
    seenPlayers.add(b.playerId);
    if (b.bid > cardsDealt) return { error: `Une annonce ne peut pas dépasser le nombre de cartes distribuées (${cardsDealt})` };
    if (b.tricksWon > cardsDealt) return { error: `Le nombre de plis ne peut pas dépasser le nombre de cartes distribuées (${cardsDealt})` };
  }
  if (seenPlayers.size !== validPlayerIds.size) return { error: 'Il manque l\'annonce d\'au moins un joueur' };

  const tricksTotal = bids.reduce((sum, b) => sum + b.tricksWon, 0);
  if (tricksTotal !== cardsDealt) {
    return { error: `Le total des plis remportés (${tricksTotal}) doit être égal au nombre de cartes distribuées (${cardsDealt})` };
  }

  const dealerBid = bids.find((b) => b.playerId === dealerId)!;
  const othersBidTotal = bids.filter((b) => b.playerId !== dealerId).reduce((sum, b) => sum + b.bid, 0);
  if (isForbiddenBid(cardsDealt, othersBidTotal, dealerBid.bid)) {
    return {
      error: `Le donneur annonce en dernier et ne peut pas annoncer ${dealerBid.bid} ici : le total des annonces ne peut jamais être égal au nombre de cartes distribuées (${cardsDealt})`,
    };
  }

  // Bid history per player, most recent first excluded of the round being edited (if any).
  const history = new Map<string, number[]>();
  for (const round of game.rikikiRounds) {
    if (excludeRoundNumber && round.roundNumber === excludeRoundNumber) continue;
    if (round.roundNumber >= roundNumber) continue;
    for (const b of round.bids) {
      const arr = history.get(b.playerId) ?? [];
      arr.push(b.bid);
      history.set(b.playerId, arr);
    }
  }

  const results = bids.map((b) => {
    const r = computeRoundPoints(b.bid, b.tricksWon, {
      zeroBidPenaltyEnabled: !!game.rikikiZeroBidPenalty,
      previousBids: history.get(b.playerId) ?? [],
    });
    return { playerId: b.playerId, bid: b.bid, tricksWon: b.tricksWon, points: r.points, success: r.success, zeroBidPenalty: r.zeroBidPenalty };
  });

  return { cardsDealt, results };
}

rikikiRouter.get('/sequence', async (req, res) => {
  const { gameId } = req.params as { gameId: string };
  const game = await loadRikikiGame(gameId);
  if (!game) return res.status(404).json({ error: 'Partie Rikiki introuvable' });
  const sequence = buildRoundSequence(game.players.length, game.rikikiPeak ?? game.players.length, game.rikikiDoublePeak ?? false);
  res.json({ sequence, nextRoundNumber: game.rikikiRounds.length + 1 });
});

rikikiRouter.post('/preview', async (req, res) => {
  const { gameId } = req.params as { gameId: string };
  const game = await loadRikikiGame(gameId);
  if (!game) return res.status(404).json({ error: 'Partie Rikiki introuvable' });
  const parsed = roundSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide' });

  const roundNumber = game.rikikiRounds.length + 1;
  const outcome = computeRoundOutcome(game, roundNumber, parsed.data.dealerId, parsed.data.bids);
  if ('error' in outcome) return res.status(400).json({ error: outcome.error });
  res.json(outcome);
});

rikikiRouter.post('/', async (req, res) => {
  const { gameId } = req.params as { gameId: string };
  const game = await loadRikikiGame(gameId);
  if (!game) return res.status(404).json({ error: 'Partie Rikiki introuvable' });
  if (game.status === 'CLOSED') return res.status(400).json({ error: 'La partie est clôturée' });
  const parsed = roundSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide' });

  const roundNumber = game.rikikiRounds.length + 1;
  const outcome = computeRoundOutcome(game, roundNumber, parsed.data.dealerId, parsed.data.bids);
  if ('error' in outcome) return res.status(400).json({ error: outcome.error });

  const round = await prisma.$transaction(async (tx) => {
    const created = await tx.rikikiRound.create({
      data: {
        gameId,
        roundNumber,
        cardsDealt: outcome.cardsDealt,
        dealerId: parsed.data.dealerId,
      },
    });
    await tx.rikikiBid.createMany({
      data: outcome.results.map((r) => ({
        roundId: created.id,
        playerId: r.playerId,
        bid: r.bid,
        tricksWon: r.tricksWon,
        success: r.success,
        zeroBidPenalty: r.zeroBidPenalty,
        points: r.points,
      })),
    });
    return tx.rikikiRound.findUnique({
      where: { id: created.id },
      include: { dealer: true, bids: { include: { player: true } } },
    });
  });

  res.status(201).json({ round });
});

rikikiRouter.put('/:roundId', async (req, res) => {
  const { gameId, roundId } = req.params as { gameId: string; roundId: string };
  const game = await loadRikikiGame(gameId);
  if (!game) return res.status(404).json({ error: 'Partie Rikiki introuvable' });
  if (game.status === 'CLOSED') return res.status(400).json({ error: 'La partie est clôturée, modification impossible' });

  const existingRound = game.rikikiRounds.find((r) => r.id === roundId);
  if (!existingRound) return res.status(404).json({ error: 'Manche introuvable' });

  const parsed = roundSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide' });

  const outcome = computeRoundOutcome(game, existingRound.roundNumber, parsed.data.dealerId, parsed.data.bids, existingRound.roundNumber);
  if ('error' in outcome) return res.status(400).json({ error: outcome.error });

  const round = await prisma.$transaction(async (tx) => {
    await tx.rikikiBid.deleteMany({ where: { roundId } });
    await tx.rikikiRound.update({ where: { id: roundId }, data: { dealerId: parsed.data.dealerId } });
    await tx.rikikiBid.createMany({
      data: outcome.results.map((r) => ({
        roundId,
        playerId: r.playerId,
        bid: r.bid,
        tricksWon: r.tricksWon,
        success: r.success,
        zeroBidPenalty: r.zeroBidPenalty,
        points: r.points,
      })),
    });
    return tx.rikikiRound.findUnique({
      where: { id: roundId },
      include: { dealer: true, bids: { include: { player: true } } },
    });
  });

  res.json({ round });
});
