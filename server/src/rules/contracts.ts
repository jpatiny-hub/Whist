/**
 * Whist scoring engine.
 *
 * Encodes the contract catalogue and point table from whisthub.com/fr/rules,
 * with one deliberate house-rule change requested by the user: the "Trou"
 * (forced contract triggered by holding 3-4 aces) can no longer be played
 * for only 8 tricks. It always requires a minimum of 9 tricks; success pays
 * out between 9 and 12 tricks, or on a capot (13 tricks). The failure
 * penalty stays the flat -16 from the original rule.
 *
 * All values below were verified against the worked examples the user
 * copied from whisthub.com/fr/rules (see contracts.test.ts).
 */

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

export type TrumpSuit = 'COEUR' | 'CARREAU' | 'TREFLE' | 'PIQUE' | null;

/** Suit strength, strongest first — used only to break ties between contracts of equal value. */
export const TRUMP_ORDER: Exclude<TrumpSuit, null>[] = ['COEUR', 'CARREAU', 'TREFLE', 'PIQUE'];

export interface ContractDef {
  code: string;
  family: ContractFamily;
  label: string;
  /** Contracted trick target. For "exact" contracts this is also the only winning trick count. */
  requiredTricks: number;
  /** true = success requires *exactly* requiredTricks (misère family, Piccolo, Grand Chelem). false = "at least". */
  exact: boolean;
  /** true = 2 declarers play together against the 2 opponents (Emballage, Trou). false = 1 declarer alone against the 3 others, tripled. */
  partnership: boolean;
  /** true = several players may declare this contract independently in the same hand (misère family). */
  allowsMultipleSimultaneous: boolean;
  /** Needs a trump suit chosen. */
  hasTrump: boolean;
  /** Reference-only comparison value used for the bid-strength ladder (tripled for solo-type contracts). */
  rankValue: number;
  ruleNote?: string;
}

const emballageLinear = (n: number) => 3 * n - 16;
/** Success value depends only on tricks actually won, not on the level bid. */
const emballageSuccessValue = (tricksWon: number) => (tricksWon === 13 ? 30 : emballageLinear(tricksWon));
const emballageFailureValue = (level: number, tricksWon: number) =>
  emballageLinear(level) + 3 * (level - tricksWon);

const SOLO_TABLE: Record<number, Record<number, number>> = {
  5: { 5: 3, 6: 4, 7: 5, 8: 6 },
  6: { 6: 4, 7: 5, 8: 6 },
  7: { 7: 5, 8: 6 },
  8: { 8: 7 },
};
const soloSuccessValue = (level: number, tricksWon: number) => {
  const cappedT = Math.min(tricksWon, 8);
  return SOLO_TABLE[level][cappedT] ?? SOLO_TABLE[level][8];
};
const soloFailureValue = (level: number, tricksWon: number) =>
  SOLO_TABLE[level][level] + 1 * (level - tricksWon);

const ABONDANCE_TABLE: Record<number, number> = { 9: 10, 10: 15, 11: 20, 12: 30 };
const abondanceSuccessValue = (level: number, tricksWon: number) => ABONDANCE_TABLE[Math.min(tricksWon, 12)];
const abondanceFailureValue = (level: number) => ABONDANCE_TABLE[level];

/** House rule: Trou always needs >= 9 tricks (the classic "8 tricks with the last ace" option is removed). */
const TROU_MIN_TRICKS = 9;
const trouSuccessValue = (tricksWon: number) => (tricksWon === 13 ? 30 : 16);
const TROU_FAILURE_VALUE = 16;

export const CONTRACTS: Record<string, ContractDef> = {};

function register(def: ContractDef) {
  CONTRACTS[def.code] = def;
}

// --- Emballage (proposition + emballage), levels 8..13, partnership of 2 ---
for (const level of [8, 9, 10, 11, 12, 13]) {
  register({
    code: `EMBALLAGE_${level}`,
    family: 'EMBALLAGE',
    label: `Emballage ${level}`,
    requiredTricks: level,
    exact: false,
    partnership: true,
    allowsMultipleSimultaneous: false,
    hasTrump: true,
    rankValue: emballageSuccessValue(level),
  });
}

// --- Solo, levels 5..8, single declarer ---
for (const level of [5, 6, 7, 8]) {
  register({
    code: `SOLO_${level}`,
    family: 'SOLO',
    label: `Solo ${level}`,
    requiredTricks: level,
    exact: false,
    partnership: false,
    allowsMultipleSimultaneous: false,
    hasTrump: true,
    rankValue: soloSuccessValue(level, level) * 3,
  });
}

// --- Abondance, levels 9..12, single declarer, only biddable on the first round ---
for (const level of [9, 10, 11, 12]) {
  register({
    code: `ABONDANCE_${level}`,
    family: 'ABONDANCE',
    label: `Abondance ${level}`,
    requiredTricks: level,
    exact: false,
    partnership: false,
    allowsMultipleSimultaneous: false,
    hasTrump: true,
    rankValue: abondanceSuccessValue(level, level) * 3,
  });
}

register({
  code: 'PETITE_MISERE',
  family: 'PETITE_MISERE',
  label: 'Petite misère',
  requiredTricks: 0,
  exact: true,
  partnership: false,
  allowsMultipleSimultaneous: true,
  hasTrump: false,
  rankValue: 6 * 3,
  ruleNote: 'Chaque joueur écarte une carte avant de jouer. Sans atout.',
});

register({
  code: 'PICCOLO',
  family: 'PICCOLO',
  label: 'Piccolo',
  requiredTricks: 1,
  exact: true,
  partnership: false,
  allowsMultipleSimultaneous: true,
  hasTrump: false,
  rankValue: 8 * 3,
  ruleNote: 'Exactement 1 pli, sans atout.',
});

register({
  code: 'GRANDE_MISERE',
  family: 'GRANDE_MISERE',
  label: 'Grande misère',
  requiredTricks: 0,
  exact: true,
  partnership: false,
  allowsMultipleSimultaneous: true,
  hasTrump: false,
  rankValue: 12 * 3,
  ruleNote: 'Comme petite misère mais sans écart possible. Sans atout.',
});

register({
  code: 'MISERE_ETALEE',
  family: 'MISERE_ETALEE',
  label: 'Misère étalée',
  requiredTricks: 0,
  exact: true,
  partnership: false,
  allowsMultipleSimultaneous: true,
  hasTrump: false,
  rankValue: 24 * 3,
  ruleNote: 'Comme grande misère, mais les cartes sont étalées face visible avant le premier pli. Sans atout.',
});

register({
  code: 'TROU',
  family: 'TROU',
  label: 'Trou',
  requiredTricks: TROU_MIN_TRICKS,
  exact: false,
  partnership: true,
  allowsMultipleSimultaneous: false,
  hasTrump: true,
  rankValue: 16,
  ruleNote:
    "Règle personnalisée de cette application : le Trou ne peut plus se jouer en 8 plis. Il faut toujours au " +
    'moins 9 plis pour réussir (12 plis max hors capot). Les points perdus en cas d’échec restent -16, comme dans la règle standard.',
});

register({
  code: 'GRAND_CHELEM',
  family: 'GRAND_CHELEM',
  label: 'Grand chelem',
  requiredTricks: 13,
  exact: true,
  partnership: false,
  allowsMultipleSimultaneous: false,
  hasTrump: true,
  rankValue: 60 * 3,
  ruleNote: "Le déclarant doit entamer le premier pli et remporter les 13 plis.",
});

/** Contracts ranked from weakest to strongest, as listed on whisthub.com/fr/rules (Trou included for reference only, it is never bid). */
export const CONTRACT_LADDER: string[] = [
  'EMBALLAGE_8',
  'SOLO_5',
  'EMBALLAGE_9',
  'SOLO_6',
  'EMBALLAGE_10',
  'SOLO_7',
  'EMBALLAGE_11',
  'PETITE_MISERE',
  'EMBALLAGE_12',
  'SOLO_8',
  'PICCOLO',
  'EMBALLAGE_13',
  'ABONDANCE_9',
  'TROU',
  'GRANDE_MISERE',
  'ABONDANCE_10',
  'ABONDANCE_11',
  'MISERE_ETALEE',
  'ABONDANCE_12',
  'GRAND_CHELEM',
];

export interface ContractOutcome {
  success: boolean;
  /** Signed points earned/lost by the declaring side, per player on that side (already includes the x3 for solo-type contracts). */
  declarerDelta: number;
  /** Signed points earned/lost by each of the non-declaring players. Always the mirror of declarerDelta's per-opponent-unit value. */
  opponentDelta: number;
}

/**
 * Computes the point swing for a single contract declaration.
 * `tricksWon` is the number of tricks taken by the declaring side (the pair for Emballage/Trou, the lone player otherwise).
 */
export function scoreContract(code: string, tricksWon: number): ContractOutcome {
  const def = CONTRACTS[code];
  if (!def) throw new Error(`Contrat inconnu : ${code}`);
  if (tricksWon < 0 || tricksWon > 13) throw new Error('tricksWon doit être compris entre 0 et 13');

  const success = def.exact ? tricksWon === def.requiredTricks : tricksWon >= def.requiredTricks;

  let unitValue: number; // value per opponent (base table value, before x3 for solo-type)
  switch (def.family) {
    case 'EMBALLAGE':
      unitValue = success ? emballageSuccessValue(tricksWon) : emballageFailureValue(def.requiredTricks, tricksWon);
      break;
    case 'SOLO':
      unitValue = success
        ? soloSuccessValue(def.requiredTricks, tricksWon)
        : soloFailureValue(def.requiredTricks, tricksWon);
      break;
    case 'ABONDANCE':
      unitValue = success ? abondanceSuccessValue(def.requiredTricks, tricksWon) : abondanceFailureValue(def.requiredTricks);
      break;
    case 'TROU':
      unitValue = success ? trouSuccessValue(tricksWon) : TROU_FAILURE_VALUE;
      break;
    case 'PETITE_MISERE':
      unitValue = 6;
      break;
    case 'GRANDE_MISERE':
      unitValue = 12;
      break;
    case 'MISERE_ETALEE':
      unitValue = 24;
      break;
    case 'PICCOLO':
      unitValue = 8;
      break;
    case 'GRAND_CHELEM':
      unitValue = 60;
      break;
    default:
      throw new Error(`Famille de contrat non gérée : ${def.family}`);
  }

  const sign = success ? 1 : -1;
  const opponentDelta = -sign * unitValue;
  const declarerDelta = def.partnership ? sign * unitValue : sign * unitValue * 3;

  return { success, declarerDelta, opponentDelta };
}

export interface HandDeclaration {
  contractCode: string;
  /** Player ids on the declaring side: 2 for Emballage/Trou, 1 otherwise. */
  declarerPlayerIds: string[];
  tricksWon: number;
  trumpSuit?: TrumpSuit;
}

/**
 * Scores a full hand, which may contain several simultaneous declarations
 * (e.g. two players both going Petite Misère). Returns the signed point
 * delta for every one of the four players at the table.
 */
export function scoreHand(declarations: HandDeclaration[], allPlayerIds: [string, string, string, string]): {
  deltas: Record<string, number>;
  outcomes: (ContractOutcome & { contractCode: string; declarerPlayerIds: string[] })[];
} {
  const deltas: Record<string, number> = Object.fromEntries(allPlayerIds.map((id) => [id, 0]));
  const outcomes: (ContractOutcome & { contractCode: string; declarerPlayerIds: string[] })[] = [];

  for (const decl of declarations) {
    const def = CONTRACTS[decl.contractCode];
    if (!def) throw new Error(`Contrat inconnu : ${decl.contractCode}`);
    const expectedDeclarers = def.partnership ? 2 : 1;
    if (decl.declarerPlayerIds.length !== expectedDeclarers) {
      throw new Error(`${def.label} nécessite ${expectedDeclarers} déclarant(s), reçu ${decl.declarerPlayerIds.length}`);
    }
    const outcome = scoreContract(decl.contractCode, decl.tricksWon);
    outcomes.push({ ...outcome, contractCode: decl.contractCode, declarerPlayerIds: decl.declarerPlayerIds });

    for (const pid of allPlayerIds) {
      if (decl.declarerPlayerIds.includes(pid)) {
        deltas[pid] += outcome.declarerDelta;
      } else {
        deltas[pid] += outcome.opponentDelta;
      }
    }
  }

  return { deltas, outcomes };
}

export function listContracts(): ContractDef[] {
  return CONTRACT_LADDER.map((code) => CONTRACTS[code]);
}
