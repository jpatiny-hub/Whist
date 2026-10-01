/**
 * Rikiki (aka "l'ascenseur" / Oh Hell!) scoring engine.
 *
 * Each round every player bids (announces) exactly how many tricks they will
 * take, then must hit that number exactly. The number of cards dealt starts
 * at 1, climbs to a configurable peak, then comes back down to 1 — "the
 * elevator". Trump is drawn automatically from the deck each round and is
 * not tracked by this app (it doesn't affect scoring).
 */

/** Theoretical ceiling on cards-per-player for a round: the deck (52 cards) must cover every player. */
export function maxCardsForPlayers(numPlayers: number): number {
  if (numPlayers < 2) throw new Error('Il faut au moins 2 joueurs');
  return Math.floor(52 / numPlayers);
}

/**
 * Builds the up-then-down sequence of cards dealt per round, e.g. peak=5 ->
 * [1,2,3,4,5,4,3,2,1], or with doublePeak -> [1,2,3,4,5,5,4,3,2,1] (the peak
 * round is played twice before coming back down).
 */
export function buildRoundSequence(numPlayers: number, peak: number, doublePeak: boolean): number[] {
  const max = maxCardsForPlayers(numPlayers);
  if (peak < 1 || peak > max) {
    throw new Error(`Le pic de cartes doit être compris entre 1 et ${max} pour ${numPlayers} joueurs`);
  }
  const up: number[] = [];
  for (let n = 1; n <= peak; n++) up.push(n);
  const down: number[] = [];
  for (let n = peak - 1; n >= 1; n--) down.push(n);
  return doublePeak ? [...up, peak, ...down] : [...up, ...down];
}

/**
 * The classic "screw the dealer" constraint: the total of every bid in the
 * round can never equal the number of cards dealt. Only meaningful for the
 * last player left to bid in a round (earlier bidders have no way to know
 * what the final total will need to avoid).
 */
export function isForbiddenBid(cardsDealt: number, bidsSoFarTotal: number, proposedBid: number): boolean {
  return bidsSoFarTotal + proposedBid === cardsDealt;
}

/** Points for a single player's round: contract made = 1 + 2×tricks; missed = -1 per trick of gap. */
export function scoreRikikiRound(bid: number, tricksWon: number): number {
  if (bid === tricksWon) return 1 + 2 * tricksWon;
  return -Math.abs(tricksWon - bid);
}

/** True if this bid is a player's 3rd consecutive 0, triggering the optional malus. */
export function zeroBidPenaltyApplies(previousBids: number[], currentBid: number): boolean {
  if (currentBid !== 0) return false;
  const lastTwo = previousBids.slice(-2);
  return lastTwo.length === 2 && lastTwo.every((b) => b === 0);
}

export const ZERO_BID_PENALTY = -2;

/**
 * Total points for a player's round, folding in the optional zero-bid malus.
 * `previousBids` is that player's bid history for the current game, oldest first,
 * NOT including the current round.
 */
export function computeRoundPoints(
  bid: number,
  tricksWon: number,
  options: { zeroBidPenaltyEnabled: boolean; previousBids: number[] },
): { points: number; success: boolean; zeroBidPenalty: boolean } {
  const success = bid === tricksWon;
  const base = scoreRikikiRound(bid, tricksWon);
  const penalty = options.zeroBidPenaltyEnabled && zeroBidPenaltyApplies(options.previousBids, bid);
  return { points: penalty ? base + ZERO_BID_PENALTY : base, success, zeroBidPenalty: !!penalty };
}
