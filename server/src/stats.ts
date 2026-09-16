import { prisma } from './db';
import { CONTRACTS } from './rules/contracts';

interface ContractStat {
  contractCode: string;
  label: string;
  timesDeclared: number;
  successCount: number;
  failCount: number;
  successRate: number;
}

interface PairStat {
  playerId: string;
  playerName: string;
  handsTogether: number;
  netPointDiff: number; // positive = this player is ahead of that rival overall
  timesPartnered: number;
  partnerSuccessCount: number;
  partnerFailCount: number;
}

export interface PlayerStats {
  playerId: string;
  playerName: string;
  gamesPlayed: number;
  gamesWon: number;
  handsPlayed: number;
  totalPoints: number;
  averagePointsPerHand: number;
  contractStats: ContractStat[];
  favoriteContract: ContractStat | null;
  mostSuccessfulContract: ContractStat | null;
  mostFailedContract: ContractStat | null;
  favoritePartner: PairStat | null;
  nemesis: PairStat | null;
  bestRival: PairStat | null;
  pairStats: PairStat[];
}

export async function computePlayerStats(playerId: string): Promise<PlayerStats | null> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return null;

  const gamePlayers = await prisma.gamePlayer.findMany({
    where: { playerId },
    select: { gameId: true },
  });
  const gameIds = gamePlayers.map((g) => g.gameId);

  const games = await prisma.game.findMany({
    where: { id: { in: gameIds } },
    include: {
      players: true,
      hands: {
        include: {
          declarations: { include: { declarers: true } },
          playerScores: true,
        },
      },
    },
  });

  const contractAgg = new Map<string, { declared: number; success: number; fail: number }>();
  const pairAgg = new Map<string, { handsTogether: number; netPointDiff: number; partnered: number; partnerSuccess: number; partnerFail: number }>();
  const otherPlayerNames = new Map<string, string>();

  let handsPlayed = 0;
  let totalPoints = 0;
  let gamesWon = 0;

  for (const game of games) {
    for (const gp of game.players) {
      if (gp.playerId !== playerId) otherPlayerNames.set(gp.playerId, '');
    }
  }
  if (otherPlayerNames.size > 0) {
    const others = await prisma.player.findMany({ where: { id: { in: [...otherPlayerNames.keys()] } } });
    for (const o of others) otherPlayerNames.set(o.id, o.name);
  }

  for (const game of games) {
    const gameTotals = new Map<string, number>();
    for (const hand of game.hands) {
      const myScore = hand.playerScores.find((s) => s.playerId === playerId);
      if (myScore) {
        handsPlayed += 1;
        totalPoints += myScore.delta;
      }
      for (const s of hand.playerScores) {
        gameTotals.set(s.playerId, (gameTotals.get(s.playerId) ?? 0) + s.delta);
        if (s.playerId !== playerId && myScore) {
          const key = s.playerId;
          const cur = pairAgg.get(key) ?? { handsTogether: 0, netPointDiff: 0, partnered: 0, partnerSuccess: 0, partnerFail: 0 };
          cur.handsTogether += 1;
          cur.netPointDiff += myScore.delta - s.delta;
          pairAgg.set(key, cur);
        }
      }

      for (const decl of hand.declarations) {
        const declarerIds = decl.declarers.map((d) => d.playerId);
        if (declarerIds.includes(playerId)) {
          const agg = contractAgg.get(decl.contractCode) ?? { declared: 0, success: 0, fail: 0 };
          agg.declared += 1;
          if (decl.success) agg.success += 1;
          else agg.fail += 1;
          contractAgg.set(decl.contractCode, agg);

          for (const otherId of declarerIds) {
            if (otherId === playerId) continue;
            const cur = pairAgg.get(otherId) ?? { handsTogether: 0, netPointDiff: 0, partnered: 0, partnerSuccess: 0, partnerFail: 0 };
            cur.partnered += 1;
            if (decl.success) cur.partnerSuccess += 1;
            else cur.partnerFail += 1;
            pairAgg.set(otherId, cur);
          }
        }
      }
    }

    if (gameTotals.size > 0) {
      const max = Math.max(...gameTotals.values());
      if ((gameTotals.get(playerId) ?? -Infinity) === max) gamesWon += 1;
    }
  }

  const contractStats: ContractStat[] = [...contractAgg.entries()]
    .map(([code, agg]) => ({
      contractCode: code,
      label: CONTRACTS[code]?.label ?? code,
      timesDeclared: agg.declared,
      successCount: agg.success,
      failCount: agg.fail,
      successRate: agg.declared > 0 ? agg.success / agg.declared : 0,
    }))
    .sort((a, b) => b.timesDeclared - a.timesDeclared);

  const favoriteContract = contractStats[0] ?? null;
  const mostSuccessfulContract =
    [...contractStats].sort((a, b) => b.successRate - a.successRate || b.timesDeclared - a.timesDeclared)[0] ?? null;
  const mostFailedContract =
    [...contractStats].sort((a, b) => 1 - a.successRate - (1 - b.successRate) || b.timesDeclared - a.timesDeclared)[0] ?? null;

  const pairStats: PairStat[] = [...pairAgg.entries()].map(([otherId, agg]) => ({
    playerId: otherId,
    playerName: otherPlayerNames.get(otherId) ?? otherId,
    handsTogether: agg.handsTogether,
    netPointDiff: agg.netPointDiff,
    timesPartnered: agg.partnered,
    partnerSuccessCount: agg.partnerSuccess,
    partnerFailCount: agg.partnerFail,
  }));

  const favoritePartner =
    [...pairStats].filter((p) => p.timesPartnered > 0).sort((a, b) => b.timesPartnered - a.timesPartnered)[0] ?? null;
  const nemesis = [...pairStats].filter((p) => p.handsTogether >= 3).sort((a, b) => a.netPointDiff - b.netPointDiff)[0] ?? null;
  const bestRival = [...pairStats].filter((p) => p.handsTogether >= 3).sort((a, b) => b.netPointDiff - a.netPointDiff)[0] ?? null;

  return {
    playerId,
    playerName: player.name,
    gamesPlayed: games.length,
    gamesWon,
    handsPlayed,
    totalPoints,
    averagePointsPerHand: handsPlayed > 0 ? totalPoints / handsPlayed : 0,
    contractStats,
    favoriteContract,
    mostSuccessfulContract,
    mostFailedContract,
    favoritePartner,
    nemesis,
    bestRival,
    pairStats: pairStats.sort((a, b) => b.handsTogether - a.handsTogether),
  };
}

export interface GameStatsPlayer {
  playerId: string;
  playerName: string;
  totalPoints: number;
  contractStats: ContractStat[];
}

export async function computeGameStats(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: { include: { player: true }, orderBy: { seat: 'asc' } },
      hands: {
        orderBy: { handNumber: 'asc' },
        include: {
          declarations: { include: { declarers: true } },
          playerScores: true,
        },
      },
    },
  });
  if (!game) return null;

  const perPlayer = new Map<string, { name: string; total: number; contractAgg: Map<string, { declared: number; success: number; fail: number }> }>();
  for (const gp of game.players) {
    perPlayer.set(gp.playerId, { name: gp.player.name, total: 0, contractAgg: new Map() });
  }

  const evolution: { handNumber: number; totals: Record<string, number> }[] = [];
  const runningTotals: Record<string, number> = {};
  for (const gp of game.players) runningTotals[gp.playerId] = 0;

  for (const hand of game.hands) {
    for (const s of hand.playerScores) {
      const entry = perPlayer.get(s.playerId);
      if (entry) entry.total += s.delta;
      runningTotals[s.playerId] = (runningTotals[s.playerId] ?? 0) + s.delta;
    }
    for (const decl of hand.declarations) {
      for (const d of decl.declarers) {
        const entry = perPlayer.get(d.playerId);
        if (!entry) continue;
        const agg = entry.contractAgg.get(decl.contractCode) ?? { declared: 0, success: 0, fail: 0 };
        agg.declared += 1;
        if (decl.success) agg.success += 1;
        else agg.fail += 1;
        entry.contractAgg.set(decl.contractCode, agg);
      }
    }
    evolution.push({ handNumber: hand.handNumber, totals: { ...runningTotals } });
  }

  const players: GameStatsPlayer[] = [...perPlayer.entries()].map(([playerId, v]) => ({
    playerId,
    playerName: v.name,
    totalPoints: v.total,
    contractStats: [...v.contractAgg.entries()]
      .map(([code, agg]) => ({
        contractCode: code,
        label: CONTRACTS[code]?.label ?? code,
        timesDeclared: agg.declared,
        successCount: agg.success,
        failCount: agg.fail,
        successRate: agg.declared > 0 ? agg.success / agg.declared : 0,
      }))
      .sort((a, b) => b.timesDeclared - a.timesDeclared),
  }));

  return { gameId, players, evolution };
}
