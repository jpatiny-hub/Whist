export type TrumpSuit = 'COEUR' | 'CARREAU' | 'TREFLE' | 'PIQUE' | null;

export type ContractFamily =
  | 'EMBALLAGE'
  | 'SOLO'
  | 'ABONDANCE'
  | 'PICCOLO'
  | 'PETITE_MISERE'
  | 'GRANDE_MISERE'
  | 'MISERE_ETALEE'
  | 'TROU'
  | 'GRAND_CHELEM';

export interface ContractDef {
  code: string;
  family: ContractFamily;
  label: string;
  requiredTricks: number;
  exact: boolean;
  partnership: boolean;
  allowsMultipleSimultaneous: boolean;
  hasTrump: boolean;
  rankValue: number;
  ruleNote?: string;
}

export interface Player {
  id: string;
  name: string;
}

export interface GamePlayer {
  id: string;
  seat: number;
  playerId: string;
  player: Player;
}

export type GameType = 'WHIST' | 'RIKIKI';

export interface Game {
  id: string;
  type: GameType;
  label: string | null;
  status: 'OPEN' | 'CLOSED';
  startedAt: string;
  endedAt: string | null;
  rikikiPeak: number | null;
  rikikiDoublePeak: boolean | null;
  rikikiZeroBidPenalty: boolean | null;
  players: GamePlayer[];
  hands?: Hand[];
  rikikiRounds?: RikikiRound[];
}

/** Minimal shape Scoreboard/PointsChart need — satisfied by both Hand and an adapted RikikiRound. */
export interface ScoreableRound {
  handNumber: number;
  playerScores: { playerId: string; delta: number }[];
}

export interface RikikiBid {
  id: string;
  playerId: string;
  player: Player;
  bid: number;
  tricksWon: number;
  success: boolean;
  zeroBidPenalty: boolean;
  points: number;
}

export interface RikikiRound {
  id: string;
  roundNumber: number;
  cardsDealt: number;
  dealerId: string;
  dealer: Player;
  bids: RikikiBid[];
}

export interface HandDeclarationPlayer {
  id: string;
  playerId: string;
  player: Player;
}

export interface HandDeclaration {
  id: string;
  contractCode: string;
  trumpSuit: TrumpSuit;
  tricksWon: number;
  success: boolean;
  declarers: HandDeclarationPlayer[];
}

export interface HandPlayerScore {
  id: string;
  playerId: string;
  player: Player;
  delta: number;
}

export interface Hand {
  id: string;
  handNumber: number;
  dealerId: string;
  dealer: Player;
  passedRound: boolean;
  pointsMultiplier: number;
  declarations: HandDeclaration[];
  playerScores: HandPlayerScore[];
}

export interface ContractStat {
  contractCode: string;
  label: string;
  timesDeclared: number;
  successCount: number;
  failCount: number;
  successRate: number;
}

export interface PairStat {
  playerId: string;
  playerName: string;
  handsTogether: number;
  netPointDiff: number;
  timesPartnered: number;
  partnerSuccessCount: number;
  partnerFailCount: number;
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

export interface DefenseStat {
  contractCode: string;
  label: string;
  timesDefended: number;
  successCount: number;
  failCount: number;
  successRate: number;
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
  beteNoire: PairStat | null;
  pairStats: PairStat[];
  contractBreakdown: ContractBreakdown[];
}

export interface GameStatsPlayer {
  playerId: string;
  playerName: string;
  totalPoints: number;
  contractStats: ContractStat[];
  defenseStats: DefenseStat[];
}

export interface GameStats {
  gameId: string;
  players: GameStatsPlayer[];
  evolution: { handNumber: number; totals: Record<string, number> }[];
}

export interface PointsTableRow {
  tricks: number;
  success: boolean;
  declarerDelta: number;
  opponentDelta: number;
}

export interface ContractsResponse {
  contracts: ContractDef[];
  ladder: string[];
  byCode: Record<string, ContractDef>;
  pointsTables: Record<string, PointsTableRow[]>;
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

export interface RikikiPairStat {
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

export interface RikikiGameStatsPlayer {
  playerId: string;
  playerName: string;
  totalPoints: number;
  roundsWon: number;
  roundsPlayed: number;
}

export interface RikikiGameStats {
  gameId: string;
  players: RikikiGameStatsPlayer[];
  evolution: { handNumber: number; totals: Record<string, number> }[];
}
