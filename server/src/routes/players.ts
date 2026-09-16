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
