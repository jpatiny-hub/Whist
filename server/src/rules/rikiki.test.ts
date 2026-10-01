import { describe, expect, it } from 'vitest';
import {
  buildRoundSequence,
  computeRoundPoints,
  isForbiddenBid,
  maxCardsForPlayers,
  scoreRikikiRound,
  zeroBidPenaltyApplies,
} from './rikiki';

describe('maxCardsForPlayers', () => {
  it('4 joueurs -> 13 cartes max (52/4)', () => expect(maxCardsForPlayers(4)).toBe(13));
  it('5 joueurs -> 10 cartes max (52/5 arrondi)', () => expect(maxCardsForPlayers(5)).toBe(10));
  it('6 joueurs -> 8 cartes max', () => expect(maxCardsForPlayers(6)).toBe(8));
});

describe('buildRoundSequence', () => {
  it('monte puis redescend jusqu\'au pic configuré', () => {
    expect(buildRoundSequence(4, 5, false)).toEqual([1, 2, 3, 4, 5, 4, 3, 2, 1]);
  });
  it('rejoue le sommet deux fois si doublePeak', () => {
    expect(buildRoundSequence(4, 5, true)).toEqual([1, 2, 3, 4, 5, 5, 4, 3, 2, 1]);
  });
  it("refuse un pic au-delà du maximum théorique", () => {
    expect(() => buildRoundSequence(4, 14, false)).toThrow();
  });
});

describe('isForbiddenBid — règle du total interdit', () => {
  it('5 cartes, 4 plis déjà annoncés -> le dernier ne peut pas annoncer 1', () => {
    expect(isForbiddenBid(5, 4, 1)).toBe(true);
  });
  it('5 cartes, 5 plis déjà annoncés -> le dernier ne peut pas annoncer 0', () => {
    expect(isForbiddenBid(5, 5, 0)).toBe(true);
  });
  it('5 cartes, 4 plis déjà annoncés -> annoncer 2 reste autorisé', () => {
    expect(isForbiddenBid(5, 4, 2)).toBe(false);
  });
});

describe('scoreRikikiRound', () => {
  it('contrat rempli : 1 + 2×plis', () => expect(scoreRikikiRound(3, 3)).toBe(7));
  it('contrat de 0 rempli : 1 point', () => expect(scoreRikikiRound(0, 0)).toBe(1));
  it('contrat raté par excès : -1 par pli d\'écart', () => expect(scoreRikikiRound(3, 5)).toBe(-2));
  it('contrat raté par défaut : -1 par pli d\'écart', () => expect(scoreRikikiRound(3, 1)).toBe(-2));
});

describe('zeroBidPenaltyApplies', () => {
  it('3e annonce à 0 consécutive -> malus', () => {
    expect(zeroBidPenaltyApplies([0, 0], 0)).toBe(true);
  });
  it('seulement 2 annonces à 0 au total (une rupture) -> pas de malus', () => {
    expect(zeroBidPenaltyApplies([3, 0], 0)).toBe(false);
  });
  it("l'annonce actuelle n'est pas 0 -> jamais de malus", () => {
    expect(zeroBidPenaltyApplies([0, 0], 1)).toBe(false);
  });
});

describe('computeRoundPoints', () => {
  it('malus activé et 3e zéro consécutif : -2 en plus du score normal', () => {
    const r = computeRoundPoints(0, 0, { zeroBidPenaltyEnabled: true, previousBids: [0, 0] });
    expect(r.points).toBe(1 - 2);
    expect(r.success).toBe(true);
    expect(r.zeroBidPenalty).toBe(true);
  });
  it('malus désactivé dans les options de la partie : jamais appliqué', () => {
    const r = computeRoundPoints(0, 0, { zeroBidPenaltyEnabled: false, previousBids: [0, 0] });
    expect(r.points).toBe(1);
    expect(r.zeroBidPenalty).toBe(false);
  });
});
