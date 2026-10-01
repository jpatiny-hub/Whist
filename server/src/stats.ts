import { prisma } from './db';
import { CONTRACT_LADDER, CONTRACTS } from './rules/contracts';

interface ContractStat {
  contractCode: string;
  label: string;
  timesDeclared: number;
  successCount: number;
  failCount: number;
  successRate: number;
}

interface DefenseStat {
  contractCode: string;
  label: string;
  timesDefended: number;
  /** Times the contract failed while this player was a defender (the defense "won"). */
  successCount: number;
  /** Times the contract succeeded anyway (the defense "lost"). */
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
  /** Times this player's own attack (as declarer) failed while this person was one of the defenders. */
  failedAttacksAgainst: number;
}

export interface ContractBreakdown {
  contractCode: string;
  label: string;
  timesDeclared: number;
  declaredSuccessCount: number;
  declaredFailCount: number;
  declaredSuccessRate: number;
  timesDefended: number;
  defendedSuccessCount: number;
  defendedFailCount: number;
  defendedSuccessRate: number;
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
  defenseStats: DefenseStat[];
  totalDefended: number;
  totalDefenseWon: number;
  defenseSuccessRate: number;
  mostFacedContract: DefenseStat | null;
  bestDefendedContract: DefenseStat | null;
  worstDefendedContract: DefenseStat | null;
  favoritePartner: PairStat | null;
  nemesis: PairStat | null;
  bestRival: PairStat | null;
  /** The opponent who has most often been on the defending side of this player's failed attacks. */
  beteNoire: PairStat | null;
  pairStats: PairStat[];
  contractBreakdown: ContractBreakdown[];
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
  const defenseAgg = new Map<string, { defended: number; success: number; fail: number }>();
  const pairAgg = new Map<
    string,
    { handsTogether: number; netPointDiff: number; partnered: number; partnerSuccess: number; partnerFail: number; failedAttacksAgainst: number }
  >();
  const emptyPairAgg = () => ({ handsTogether: 0, netPointDiff: 0, partnered: 0, partnerSuccess: 0, partnerFail: 0, failedAttacksAgainst: 0 });
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
          const cur = pairAgg.get(key) ?? emptyPairAgg();
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
            const cur = pairAgg.get(otherId) ?? emptyPairAgg();
            cur.partnered += 1;
            if (decl.success) cur.partnerSuccess += 1;
            else cur.partnerFail += 1;
            pairAgg.set(otherId, cur);
          }

          if (!decl.success) {
            // My attack failed: credit every defender of this declaration.
            for (const gp of game.players) {
              if (declarerIds.includes(gp.playerId)) continue;
              const cur = pairAgg.get(gp.playerId) ?? emptyPairAgg();
              cur.failedAttacksAgainst += 1;
              pairAgg.set(gp.playerId, cur);
            }
          }
        } else {
          // Not a declarer on this declaration: this player was defending against it.
          const agg = defenseAgg.get(decl.contractCode) ?? { defended: 0, success: 0, fail: 0 };
          agg.defended += 1;
          if (decl.success) agg.fail += 1; // the contract succeeded despite the defense
          else agg.success += 1; // the defense beat the contract
          defenseAgg.set(decl.contractCode, agg);
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
    [...contractStats].sort((a, b) => a.successRate - b.successRate || b.timesDeclared - a.timesDeclared)[0] ?? null;

  const pairStats: PairStat[] = [...pairAgg.entries()].map(([otherId, agg]) => ({
    playerId: otherId,
    playerName: otherPlayerNames.get(otherId) ?? otherId,
    handsTogether: agg.handsTogether,
    netPointDiff: agg.netPointDiff,
    timesPartnered: agg.partnered,
    partnerSuccessCount: agg.partnerSuccess,
    partnerFailCount: agg.partnerFail,
    failedAttacksAgainst: agg.failedAttacksAgainst,
  }));

  const defenseStats: DefenseStat[] = [...defenseAgg.entries()]
    .map(([code, agg]) => ({
      contractCode: code,
      label: CONTRACTS[code]?.label ?? code,
      timesDefended: agg.defended,
      successCount: agg.success,
      failCount: agg.fail,
      successRate: agg.defended > 0 ? agg.success / agg.defended : 0,
    }))
    .sort((a, b) => b.timesDefended - a.timesDefended);

  const totalDefended = defenseStats.reduce((sum, d) => sum + d.timesDefended, 0);
  const totalDefenseWon = defenseStats.reduce((sum, d) => sum + d.successCount, 0);
  const mostFacedContract = defenseStats[0] ?? null;
  const bestDefendedContract =
    [...defenseStats].sort((a, b) => b.successRate - a.successRate || b.timesDefended - a.timesDefended)[0] ?? null;
  const worstDefendedContract =
    [...defenseStats].sort((a, b) => a.successRate - b.successRate || b.timesDefended - a.timesDefended)[0] ?? null;

  const favoritePartner =
    [...pairStats].filter((p) => p.timesPartnered > 0).sort((a, b) => b.timesPartnered - a.timesPartnered)[0] ?? null;
  const nemesis = [...pairStats].filter((p) => p.handsTogether >= 3).sort((a, b) => a.netPointDiff - b.netPointDiff)[0] ?? null;
  const bestRival = [...pairStats].filter((p) => p.handsTogether >= 3).sort((a, b) => b.netPointDiff - a.netPointDiff)[0] ?? null;
  const beteNoire =
    [...pairStats].filter((p) => p.failedAttacksAgainst > 0).sort((a, b) => b.failedAttacksAgainst - a.failedAttacksAgainst)[0] ?? null;

  const contractBreakdown: ContractBreakdown[] = CONTRACT_LADDER.map((code) => {
    const atk = contractAgg.get(code);
    const def = defenseAgg.get(code);
    return {
      contractCode: code,
      label: CONTRACTS[code]?.label ?? code,
      timesDeclared: atk?.declared ?? 0,
      declaredSuccessCount: atk?.success ?? 0,
      declaredFailCount: atk?.fail ?? 0,
      declaredSuccessRate: atk && atk.declared > 0 ? atk.success / atk.declared : 0,
      timesDefended: def?.defended ?? 0,
      defendedSuccessCount: def?.success ?? 0,
      defendedFailCount: def?.fail ?? 0,
      defendedSuccessRate: def && def.defended > 0 ? def.success / def.defended : 0,
    };
  });

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
    defenseStats,
    totalDefended,
    totalDefenseWon,
    defenseSuccessRate: totalDefended > 0 ? totalDefenseWon / totalDefended : 0,
    mostFacedContract,
    bestDefendedContract,
    worstDefendedContract,
    favoritePartner,
    nemesis,
    bestRival,
    beteNoire,
    pairStats: pairStats.sort((a, b) => b.handsTogether - a.handsTogether),
    contractBreakdown,
  };
}

export interface GameStatsPlayer {
  playerId: string;
  playerName: string;
  totalPoints: number;
  contractStats: ContractStat[];
  defenseStats: DefenseStat[];
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

  const perPlayer = new Map<
    string,
    {
      name: string;
      total: number;
      contractAgg: Map<string, { declared: number; success: number; fail: number }>;
      defenseAgg: Map<string, { defended: number; success: number; fail: number }>;
    }
  >();
  for (const gp of game.players) {
    perPlayer.set(gp.playerId, { name: gp.player.name, total: 0, contractAgg: new Map(), defenseAgg: new Map() });
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
      const declarerIds = decl.declarers.map((d) => d.playerId);
      for (const d of decl.declarers) {
        const entry = perPlayer.get(d.playerId);
        if (!entry) continue;
        const agg = entry.contractAgg.get(decl.contractCode) ?? { declared: 0, success: 0, fail: 0 };
        agg.declared += 1;
        if (decl.success) agg.success += 1;
        else agg.fail += 1;
        entry.contractAgg.set(decl.contractCode, agg);
      }
      for (const [playerId, entry] of perPlayer) {
        if (declarerIds.includes(playerId)) continue;
        const agg = entry.defenseAgg.get(decl.contractCode) ?? { defended: 0, success: 0, fail: 0 };
        agg.defended += 1;
        if (decl.success) agg.fail += 1;
        else agg.success += 1;
        entry.defenseAgg.set(decl.contractCode, agg);
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
    defenseStats: [...v.defenseAgg.entries()]
      .map(([code, agg]) => ({
        contractCode: code,
        label: CONTRACTS[code]?.label ?? code,
        timesDefended: agg.defended,
        successCount: agg.success,
        failCount: agg.fail,
        successRate: agg.defended > 0 ? agg.success / agg.defended : 0,
      }))
      .sort((a, b) => b.timesDefended - a.timesDefended),
  }));

  return { gameId, players, evolution };
}

export interface OverviewPlayer {
  playerId: string;
  playerName: string;
  gamesPlayed: number;
  gamesWon: number;
  handsPlayed: number;
  totalPoints: number;
}

export interface OverviewContractStat {
  contractCode: string;
  label: string;
  timesDeclared: number;
  successCount: number;
  failCount: number;
  successRate: number;
}

export interface OverviewStats {
  players: OverviewPlayer[];
  bestPlayer: OverviewPlayer | null;
  mostGamesPlayed: OverviewPlayer | null;
  globalContractStats: OverviewContractStat[];
  mostPlayedContract: OverviewContractStat | null;
  mostWonContract: OverviewContractStat | null;
  mostLostContract: OverviewContractStat | null;
  bestRatioContract: OverviewContractStat | null;
}

/** Minimum number of announcements before a contract is eligible for the "best win ratio" spotlight, to avoid a lone 1/1 dominating. */
const MIN_DECLARED_FOR_RATIO = 3;

export async function computeOverviewStats(): Promise<OverviewStats> {
  const players = await prisma.player.findMany();
  const games = await prisma.game.findMany({
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

  const perPlayer = new Map<string, { gamesPlayed: number; gamesWon: number; handsPlayed: number; totalPoints: number }>();
  for (const p of players) perPlayer.set(p.id, { gamesPlayed: 0, gamesWon: 0, handsPlayed: 0, totalPoints: 0 });

  const globalAgg = new Map<string, { declared: number; success: number; fail: number }>();

  for (const game of games) {
    const gameTotals = new Map<string, number>();
    for (const gp of game.players) {
      const entry = perPlayer.get(gp.playerId);
      if (entry) entry.gamesPlayed += 1;
      gameTotals.set(gp.playerId, 0);
    }
    for (const hand of game.hands) {
      for (const s of hand.playerScores) {
        gameTotals.set(s.playerId, (gameTotals.get(s.playerId) ?? 0) + s.delta);
        const entry = perPlayer.get(s.playerId);
        if (entry) {
          entry.handsPlayed += 1;
          entry.totalPoints += s.delta;
        }
      }
      for (const decl of hand.declarations) {
        const agg = globalAgg.get(decl.contractCode) ?? { declared: 0, success: 0, fail: 0 };
        agg.declared += 1;
        if (decl.success) agg.success += 1;
        else agg.fail += 1;
        globalAgg.set(decl.contractCode, agg);
      }
    }
    if (gameTotals.size > 0) {
      const max = Math.max(...gameTotals.values());
      for (const [playerId, total] of gameTotals) {
        if (total === max) {
          const entry = perPlayer.get(playerId);
          if (entry) entry.gamesWon += 1;
        }
      }
    }
  }

  const overviewPlayers: OverviewPlayer[] = players
    .map((p) => {
      const agg = perPlayer.get(p.id)!;
      return { playerId: p.id, playerName: p.name, ...agg };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);

  const bestPlayer = overviewPlayers.filter((p) => p.gamesPlayed > 0).sort((a, b) => b.totalPoints - a.totalPoints)[0] ?? null;
  const mostGamesPlayed = [...overviewPlayers].sort((a, b) => b.gamesPlayed - a.gamesPlayed)[0] ?? null;

  const globalContractStats: OverviewContractStat[] = CONTRACT_LADDER.map((code) => {
    const agg = globalAgg.get(code);
    return {
      contractCode: code,
      label: CONTRACTS[code]?.label ?? code,
      timesDeclared: agg?.declared ?? 0,
      successCount: agg?.success ?? 0,
      failCount: agg?.fail ?? 0,
      successRate: agg && agg.declared > 0 ? agg.success / agg.declared : 0,
    };
  });

  const declaredOnly = globalContractStats.filter((c) => c.timesDeclared > 0);
  const mostPlayedContract = [...declaredOnly].sort((a, b) => b.timesDeclared - a.timesDeclared)[0] ?? null;
  const mostWonContract = [...declaredOnly].sort((a, b) => b.successCount - a.successCount)[0] ?? null;
  const mostLostContract = [...declaredOnly].sort((a, b) => b.failCount - a.failCount)[0] ?? null;
  const bestRatioContract =
    declaredOnly
      .filter((c) => c.timesDeclared >= MIN_DECLARED_FOR_RATIO)
      .sort((a, b) => b.successRate - a.successRate || b.timesDeclared - a.timesDeclared)[0] ?? null;

  return {
    players: overviewPlayers,
    bestPlayer,
    mostGamesPlayed,
    globalContractStats,
    mostPlayedContract,
    mostWonContract,
    mostLostContract,
    bestRatioContract,
  };
}
