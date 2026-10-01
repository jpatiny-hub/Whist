import { prisma } from './db';

interface RikikiPairStat {
  playerId: string;
  playerName: string;
  roundsTogether: number;
  netPointDiff: number;
}

export interface RikikiPlayerStats {
  playerId: string;
  playerName: string;
  gamesPlayed: number;
  gamesWon: number;
  roundsPlayed: number;
  roundsWon: number;
  successRate: number;
  totalPoints: number;
  averagePointsPerRound: number;
  longestWinStreak: number;
  biggestSuccessfulBid: number | null;
  nemesis: RikikiPairStat | null;
  souffreDouleur: RikikiPairStat | null;
  pairStats: RikikiPairStat[];
}

export async function computeRikikiPlayerStats(playerId: string): Promise<RikikiPlayerStats | null> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return null;

  const gamePlayers = await prisma.gamePlayer.findMany({
    where: { playerId, game: { type: 'RIKIKI' } },
    select: { gameId: true },
  });
  const gameIds = gamePlayers.map((g) => g.gameId);

  const games = await prisma.game.findMany({
    where: { id: { in: gameIds } },
    include: {
      players: true,
      rikikiRounds: { orderBy: { roundNumber: 'asc' }, include: { bids: true } },
    },
  });

  const otherPlayerNames = new Map<string, string>();
  for (const game of games) {
    for (const gp of game.players) {
      if (gp.playerId !== playerId) otherPlayerNames.set(gp.playerId, '');
    }
  }
  if (otherPlayerNames.size > 0) {
    const others = await prisma.player.findMany({ where: { id: { in: [...otherPlayerNames.keys()] } } });
    for (const o of others) otherPlayerNames.set(o.id, o.name);
  }

  let roundsPlayed = 0;
  let roundsWon = 0;
  let totalPoints = 0;
  let gamesWon = 0;
  let longestWinStreak = 0;
  let biggestSuccessfulBid: number | null = null;
  const pairAgg = new Map<string, { roundsTogether: number; netPointDiff: number }>();

  for (const game of games) {
    const gameTotals = new Map<string, number>();
    for (const gp of game.players) gameTotals.set(gp.playerId, 0);
    let currentStreak = 0;

    for (const round of game.rikikiRounds) {
      const myBid = round.bids.find((b) => b.playerId === playerId);
      for (const b of round.bids) {
        gameTotals.set(b.playerId, (gameTotals.get(b.playerId) ?? 0) + b.points);
        if (myBid && b.playerId !== playerId) {
          const key = b.playerId;
          const cur = pairAgg.get(key) ?? { roundsTogether: 0, netPointDiff: 0 };
          cur.roundsTogether += 1;
          cur.netPointDiff += myBid.points - b.points;
          pairAgg.set(key, cur);
        }
      }
      if (myBid) {
        roundsPlayed += 1;
        totalPoints += myBid.points;
        if (myBid.success) {
          roundsWon += 1;
          currentStreak += 1;
          longestWinStreak = Math.max(longestWinStreak, currentStreak);
          biggestSuccessfulBid = biggestSuccessfulBid === null ? myBid.bid : Math.max(biggestSuccessfulBid, myBid.bid);
        } else {
          currentStreak = 0;
        }
      }
    }

    if (gameTotals.size > 0) {
      const max = Math.max(...gameTotals.values());
      if ((gameTotals.get(playerId) ?? -Infinity) === max) gamesWon += 1;
    }
  }

  const pairStats: RikikiPairStat[] = [...pairAgg.entries()].map(([otherId, agg]) => ({
    playerId: otherId,
    playerName: otherPlayerNames.get(otherId) ?? otherId,
    roundsTogether: agg.roundsTogether,
    netPointDiff: agg.netPointDiff,
  }));

  const nemesis = [...pairStats].filter((p) => p.roundsTogether >= 3).sort((a, b) => a.netPointDiff - b.netPointDiff)[0] ?? null;
  const souffreDouleur = [...pairStats].filter((p) => p.roundsTogether >= 3).sort((a, b) => b.netPointDiff - a.netPointDiff)[0] ?? null;

  return {
    playerId,
    playerName: player.name,
    gamesPlayed: games.length,
    gamesWon,
    roundsPlayed,
    roundsWon,
    successRate: roundsPlayed > 0 ? roundsWon / roundsPlayed : 0,
    totalPoints,
    averagePointsPerRound: roundsPlayed > 0 ? totalPoints / roundsPlayed : 0,
    longestWinStreak,
    biggestSuccessfulBid,
    nemesis,
    souffreDouleur,
    pairStats: pairStats.sort((a, b) => b.roundsTogether - a.roundsTogether),
  };
}

export interface RikikiGameStatsPlayer {
  playerId: string;
  playerName: string;
  totalPoints: number;
  roundsWon: number;
  roundsPlayed: number;
}

export async function computeRikikiGameStats(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: { include: { player: true }, orderBy: { seat: 'asc' } },
      rikikiRounds: { orderBy: { roundNumber: 'asc' }, include: { bids: true } },
    },
  });
  if (!game || game.type !== 'RIKIKI') return null;

  const perPlayer = new Map<string, { name: string; total: number; won: number; played: number }>();
  for (const gp of game.players) perPlayer.set(gp.playerId, { name: gp.player.name, total: 0, won: 0, played: 0 });

  const evolution: { handNumber: number; totals: Record<string, number> }[] = [];
  const runningTotals: Record<string, number> = {};
  for (const gp of game.players) runningTotals[gp.playerId] = 0;

  for (const round of game.rikikiRounds) {
    for (const b of round.bids) {
      const entry = perPlayer.get(b.playerId);
      if (entry) {
        entry.total += b.points;
        entry.played += 1;
        if (b.success) entry.won += 1;
      }
      runningTotals[b.playerId] = (runningTotals[b.playerId] ?? 0) + b.points;
    }
    evolution.push({ handNumber: round.roundNumber, totals: { ...runningTotals } });
  }

  const players: RikikiGameStatsPlayer[] = [...perPlayer.entries()].map(([playerId, v]) => ({
    playerId,
    playerName: v.name,
    totalPoints: v.total,
    roundsWon: v.won,
    roundsPlayed: v.played,
  }));

  return { gameId, players, evolution };
}
