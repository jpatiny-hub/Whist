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

export interface Game {
  id: string;
  label: string | null;
  status: 'OPEN' | 'CLOSED';
  startedAt: string;
  endedAt: string | null;
  players: GamePlayer[];
  hands?: Hand[];
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

export interface GameStatsPlayer {
  playerId: string;
  playerName: string;
  totalPoints: number;
  contractStats: ContractStat[];
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
