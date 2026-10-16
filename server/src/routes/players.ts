import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';

export const playersRouter = Router();
playersRouter.use(requireAuth);

playersRouter.get('/', async (_req, res) => {
  const players = await prisma.player.findMany({ orderBy: { name: 'asc' } });
  res.json({ players });
});

const createSchema = z.object({ name: z.string().min(1).max(80) });

playersRouter.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide' });
  }
  const existing = await prisma.player.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return res.status(409).json({ error: 'Un joueur porte déjà ce nom' });
  }
  const player = await prisma.player.create({
    data: { name: parsed.data.name, createdByUserId: req.user!.userId },
  });
  res.status(201).json({ player });
});

const renameSchema = z.object({ name: z.string().min(1).max(80) });

playersRouter.patch('/:id', async (req, res) => {
  const parsed = renameSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide' });
  }
  try {
    const player = await prisma.player.update({ where: { id: req.params.id }, data: { name: parsed.data.name } });
    res.json({ player });
  } catch {
    res.status(404).json({ error: 'Joueur introuvable, ou nom déjà pris' });
  }
});

const mergeSchema = z.object({ duplicatePlayerId: z.string().min(1) });

/**
 * Merges `duplicatePlayerId`'s entire history (games, declarations, scores,
 * dealt hands) into `:id`, then deletes the duplicate profile.
 * Refused outright if both profiles ever shared a game — unambiguously
 * reassigning scores in that case isn't possible without manual review.
 */
playersRouter.post('/:id/merge', async (req, res) => {
  const targetId = req.params.id;
  const parsed = mergeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide' });
  }
  const duplicateId = parsed.data.duplicatePlayerId;
  if (duplicateId === targetId) {
    return res.status(400).json({ error: 'Impossible de fusionner un joueur avec lui-même' });
  }

  const [target, duplicate] = await Promise.all([
    prisma.player.findUnique({ where: { id: targetId } }),
    prisma.player.findUnique({ where: { id: duplicateId } }),
  ]);
  if (!target || !duplicate) {
    return res.status(404).json({ error: 'Joueur introuvable' });
  }

  const [targetGames, duplicateGames] = await Promise.all([
    prisma.gamePlayer.findMany({ where: { playerId: targetId }, select: { gameId: true } }),
    prisma.gamePlayer.findMany({ where: { playerId: duplicateId }, select: { gameId: true } }),
  ]);
  const targetGameIds = new Set(targetGames.map((g) => g.gameId));
  const sharedGameIds = duplicateGames.filter((g) => targetGameIds.has(g.gameId)).map((g) => g.gameId);
  if (sharedGameIds.length > 0) {
    const sharedGames = await prisma.game.findMany({ where: { id: { in: sharedGameIds } } });
    return res.status(409).json({
      error:
        `${target.name} et ${duplicate.name} ont déjà participé à la/aux même(s) partie(s) ` +
        `(${sharedGames.map((g) => g.label || g.id).join(', ')}) : impossible de fusionner automatiquement. ` +
        'Corrige manuellement ces parties (ou supprime le profil en double) avant de réessayer.',
    });
  }

  if (duplicate.accountUserId && target.accountUserId) {
    return res.status(409).json({
      error: `${target.name} et ${duplicate.name} sont tous les deux liés à un compte de connexion : résous ce conflit manuellement avant de fusionner.`,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.gamePlayer.updateMany({ where: { playerId: duplicateId }, data: { playerId: targetId } });
    await tx.hand.updateMany({ where: { dealerId: duplicateId }, data: { dealerId: targetId } });
    await tx.handDeclarationPlayer.updateMany({ where: { playerId: duplicateId }, data: { playerId: targetId } });
    await tx.handPlayerScore.updateMany({ where: { playerId: duplicateId }, data: { playerId: targetId } });
    await tx.rikikiRound.updateMany({ where: { dealerId: duplicateId }, data: { dealerId: targetId } });
    await tx.rikikiBid.updateMany({ where: { playerId: duplicateId }, data: { playerId: targetId } });
    if (duplicate.accountUserId && !target.accountUserId) {
      await tx.player.update({ where: { id: duplicateId }, data: { accountUserId: null } });
      await tx.player.update({ where: { id: targetId }, data: { accountUserId: duplicate.accountUserId } });
    }
    await tx.player.delete({ where: { id: duplicateId } });
  });

  res.json({ player: await prisma.player.findUnique({ where: { id: targetId } }) });
});
