import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { CONTRACTS, scoreHand, type HandDeclaration, type TrumpSuit } from '../rules/contracts';

export const handsRouter: Router = Router({ mergeParams: true });
handsRouter.use(requireAuth);

const trumpEnum = z.enum(['COEUR', 'CARREAU', 'TREFLE', 'PIQUE']).nullable().optional();

const declarationSchema = z.object({
  contractCode: z.string(),
  declarerPlayerIds: z.array(z.string()).min(1).max(2),
  tricksWon: z.number().int().min(0).max(13),
  trumpSuit: trumpEnum,
});

const createHandSchema = z.object({
  dealerId: z.string(),
  isPasse: z.boolean().optional(),
  declarations: z.array(declarationSchema).max(4).optional(),
});

async function loadGamePlayers(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true, hands: { orderBy: { handNumber: 'desc' }, take: 1 } },
  });
  return game;
}

function validateDeclarations(declarations: z.infer<typeof declarationSchema>[], validPlayerIds: Set<string>) {
  if (declarations.length === 0) {
    return 'Ajoute au moins une déclaration de contrat';
  }
  const misereFamilyCodes = new Set(
    Object.values(CONTRACTS)
      .filter((c) => c.allowsMultipleSimultaneous)
      .map((c) => c.code),
  );
  const usedCodesOutsideMisere = new Set<string>();
  const declaringPlayers = new Set<string>();

  for (const decl of declarations) {
    const def = CONTRACTS[decl.contractCode];
    if (!def) return `Contrat inconnu : ${decl.contractCode}`;
    const expected = def.partnership ? 2 : 1;
    if (decl.declarerPlayerIds.length !== expected) {
      return `${def.label} nécessite ${expected} déclarant(s)`;
    }
    for (const pid of decl.declarerPlayerIds) {
      if (!validPlayerIds.has(pid)) return `Le joueur ${pid} ne fait pas partie de cette partie`;
      if (!def.allowsMultipleSimultaneous) {
        if (declaringPlayers.has(pid)) return 'Un joueur ne peut être déclarant que sur un seul contrat par donne (hors misères multiples)';
      }
      declaringPlayers.add(pid);
    }
    if (!def.allowsMultipleSimultaneous) {
      if (usedCodesOutsideMisere.has(decl.contractCode)) return `${def.label} ne peut être déclaré qu'une fois par donne`;
      usedCodesOutsideMisere.add(decl.contractCode);
    }
    if (def.hasTrump && !decl.trumpSuit) return `${def.label} nécessite un atout`;
  }
  return null;
}

handsRouter.post('/', async (req, res) => {
  const gameId = (req.params as { gameId: string }).gameId;
  const parsed = createHandSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide' });
  }
  const game = await loadGamePlayers(gameId);
  if (!game) return res.status(404).json({ error: 'Partie introuvable' });
  if (game.status === 'CLOSED') return res.status(400).json({ error: 'La partie est clôturée' });

  const validPlayerIds = new Set(game.players.map((p) => p.playerId));
  if (!validPlayerIds.has(parsed.data.dealerId)) {
    return res.status(400).json({ error: "Le donneur doit être l'un des 4 joueurs de la partie" });
  }
  const allPlayerIds = game.players
    .slice()
    .sort((a, b) => a.seat - b.seat)
    .map((p) => p.playerId) as [string, string, string, string];

  const nextHandNumber = (game.hands[0]?.handNumber ?? 0) + 1;
  const previousWasPasse = game.hands[0]?.passedRound ?? false;
  const pointsMultiplier = previousWasPasse ? 2 : 1;

  if (parsed.data.isPasse) {
    const hand = await prisma.hand.create({
      data: {
        gameId,
        handNumber: nextHandNumber,
        dealerId: parsed.data.dealerId,
        passedRound: true,
        pointsMultiplier: 1,
      },
      include: { dealer: true },
    });
    return res.status(201).json({ hand, deltas: {} });
  }

  const declarations = parsed.data.declarations ?? [];
  const validationError = validateDeclarations(declarations, validPlayerIds);
  if (validationError) return res.status(400).json({ error: validationError });

  let scored;
  try {
    const engineInput: HandDeclaration[] = declarations.map((d) => ({
      contractCode: d.contractCode,
      declarerPlayerIds: d.declarerPlayerIds,
      tricksWon: d.tricksWon,
      trumpSuit: (d.trumpSuit ?? null) as TrumpSuit,
    }));
    scored = scoreHand(engineInput, allPlayerIds);
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Erreur de calcul' });
  }

  const hand = await prisma.$transaction(async (tx) => {
    const created = await tx.hand.create({
      data: {
        gameId,
        handNumber: nextHandNumber,
        dealerId: parsed.data.dealerId,
        passedRound: false,
        pointsMultiplier,
      },
    });

    for (let i = 0; i < declarations.length; i++) {
      const decl = declarations[i];
      const outcome = scored.outcomes[i];
      await tx.handDeclaration.create({
        data: {
          handId: created.id,
          contractCode: decl.contractCode,
          trumpSuit: decl.trumpSuit ?? null,
          tricksWon: decl.tricksWon,
          success: outcome.success,
          declarers: { create: decl.declarerPlayerIds.map((playerId) => ({ playerId })) },
        },
      });
    }

    for (const playerId of allPlayerIds) {
      await tx.handPlayerScore.create({
        data: { handId: created.id, playerId, delta: scored.deltas[playerId] * pointsMultiplier },
      });
    }

    return tx.hand.findUnique({
      where: { id: created.id },
      include: {
        dealer: true,
        declarations: { include: { declarers: { include: { player: true } } } },
        playerScores: { include: { player: true } },
      },
    });
  });

  res.status(201).json({ hand, deltas: scored.deltas, pointsMultiplier });
});

handsRouter.post('/preview', async (req, res) => {
  const gameId = (req.params as { gameId: string }).gameId;
  const game = await loadGamePlayers(gameId);
  if (!game) return res.status(404).json({ error: 'Partie introuvable' });
  const validPlayerIds = new Set(game.players.map((p) => p.playerId));
  const allPlayerIds = game.players
    .slice()
    .sort((a, b) => a.seat - b.seat)
    .map((p) => p.playerId) as [string, string, string, string];

  const bodySchema = z.object({ declarations: z.array(declarationSchema) });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Requête invalide' });

  const validationError = validateDeclarations(parsed.data.declarations, validPlayerIds);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const engineInput: HandDeclaration[] = parsed.data.declarations.map((d) => ({
      contractCode: d.contractCode,
      declarerPlayerIds: d.declarerPlayerIds,
      tricksWon: d.tricksWon,
      trumpSuit: (d.trumpSuit ?? null) as TrumpSuit,
    }));
    const scored = scoreHand(engineInput, allPlayerIds);
    res.json({ deltas: scored.deltas, outcomes: scored.outcomes });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Erreur de calcul' });
  }
});
