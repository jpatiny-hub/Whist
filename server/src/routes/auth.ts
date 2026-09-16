import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth, signToken } from '../auth/middleware';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  /** If set, links (or creates) a Player of the same name to this account. */
  linkPlayerName: z.string().min(1).max(80).optional(),
});

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide' });
  }
  const { email, name, password, linkPlayerName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, name, passwordHash } });

  if (linkPlayerName) {
    const player = await prisma.player.findUnique({ where: { name: linkPlayerName } });
    if (player && !player.accountUserId) {
      await prisma.player.update({ where: { id: player.id }, data: { accountUserId: user.id } });
    } else if (!player) {
      await prisma.player.create({ data: { name: linkPlayerName, accountUserId: user.id, createdByUserId: user.id } });
    }
  }

  const token = signToken({ userId: user.id, email: user.email, name: user.name });
  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Requête invalide' });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  const token = signToken({ userId: user.id, email: user.email, name: user.name });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});
