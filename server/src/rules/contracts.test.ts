import { describe, expect, it } from 'vitest';
import { scoreContract, scoreHand } from './contracts';

// Every case below is one of the worked examples the user copied verbatim
// from whisthub.com/fr/rules, so this file is the source of truth proving
// the engine matches the site's official point table.

describe('scoreContract — exemples officiels whisthub', () => {
  it('Rachel: Solo 6, remporte 7 plis -> +15 / adversaires -5', () => {
    const r = scoreContract('SOLO_6', 7);
    expect(r.success).toBe(true);
    expect(r.declarerDelta).toBe(15);
    expect(r.opponentDelta).toBe(-5);
  });

  it('Joey+Ross: Emballage 12, remportent 10 plis -> -26 chacun / adversaires +26', () => {
    const r = scoreContract('EMBALLAGE_12', 10);
    expect(r.success).toBe(false);
    expect(r.declarerDelta).toBe(-26);
    expect(r.opponentDelta).toBe(26);
  });

  it('Monica: Solo 7, remporte 10 plis -> +18 (pas de surplis au-delà de 8) / adversaires -6', () => {
    const r = scoreContract('SOLO_7', 10);
    expect(r.success).toBe(true);
    expect(r.declarerDelta).toBe(18);
    expect(r.opponentDelta).toBe(-6);
  });

  it('Phoebe: Abondance 9, remporte 11 plis -> +60 / adversaires -20', () => {
    const r = scoreContract('ABONDANCE_9', 11);
    expect(r.success).toBe(true);
    expect(r.declarerDelta).toBe(60);
    expect(r.opponentDelta).toBe(-20);
  });

  it('Rachel: Abondance 11, remporte seulement 9 plis -> -60 / adversaires +20', () => {
    const r = scoreContract('ABONDANCE_11', 9);
    expect(r.success).toBe(false);
    expect(r.declarerDelta).toBe(-60);
    expect(r.opponentDelta).toBe(20);
  });

  it('Chandler+Joey: Trou (atout changé, >= 9 plis), remportent 8 plis -> -16 chacun / adversaires +16', () => {
    const r = scoreContract('TROU', 8);
    expect(r.success).toBe(false);
    expect(r.declarerDelta).toBe(-16);
    expect(r.opponentDelta).toBe(16);
  });

  it('Rachel+Ross: Trou, remportent les 13 plis (capot) -> +30 chacun / adversaires -30', () => {
    const r = scoreContract('TROU', 13);
    expect(r.success).toBe(true);
    expect(r.declarerDelta).toBe(30);
    expect(r.opponentDelta).toBe(-30);
  });

  it("règle maison : le Trou échoue toujours en dessous de 9 plis (l'ancienne règle des 8 plis avec le dernier as est supprimée)", () => {
    const r = scoreContract('TROU', 8);
    expect(r.success).toBe(false);
  });

  it('Emballage 8 réussi tout juste (8 plis) -> +8 / adversaires -8', () => {
    const r = scoreContract('EMBALLAGE_8', 8);
    expect(r.success).toBe(true);
    expect(r.declarerDelta).toBe(8);
    expect(r.opponentDelta).toBe(-8);
  });

  it('Emballage 13 (capot exigé) réussi -> +30 / adversaires -30', () => {
    const r = scoreContract('EMBALLAGE_13', 13);
    expect(r.success).toBe(true);
    expect(r.declarerDelta).toBe(30);
  });

  it('Emballage 13 raté d\'un pli (12 plis) -> -26 / adversaires +26', () => {
    const r = scoreContract('EMBALLAGE_13', 12);
    expect(r.success).toBe(false);
    expect(r.declarerDelta).toBe(-26);
    expect(r.opponentDelta).toBe(26);
  });

  it('Piccolo réussi (exactement 1 pli) -> +24 / adversaires -8', () => {
    const r = scoreContract('PICCOLO', 1);
    expect(r.success).toBe(true);
    expect(r.declarerDelta).toBe(24);
    expect(r.opponentDelta).toBe(-8);
  });

  it('Piccolo raté avec 0 pli -> -24 / adversaires +8', () => {
    const r = scoreContract('PICCOLO', 0);
    expect(r.success).toBe(false);
    expect(r.declarerDelta).toBe(-24);
  });

  it('Piccolo raté avec 2 plis (trop de plis) -> -24 / adversaires +8', () => {
    const r = scoreContract('PICCOLO', 2);
    expect(r.success).toBe(false);
    expect(r.declarerDelta).toBe(-24);
  });

  it('Grand Chelem réussi -> +180 / adversaires -60', () => {
    const r = scoreContract('GRAND_CHELEM', 13);
    expect(r.success).toBe(true);
    expect(r.declarerDelta).toBe(180);
    expect(r.opponentDelta).toBe(-60);
  });
});

describe('scoreHand — déclarations simultanées', () => {
  it('Monica et Chandler vont tous deux grande misère : Monica réussit (0 pli), Chandler échoue (1 pli)', () => {
    const players: [string, string, string, string] = ['monica', 'chandler', 'opp1', 'opp2'];
    const { deltas } = scoreHand(
      [
        { contractCode: 'GRANDE_MISERE', declarerPlayerIds: ['monica'], tricksWon: 0 },
        { contractCode: 'GRANDE_MISERE', declarerPlayerIds: ['chandler'], tricksWon: 1 },
      ],
      players,
    );
    expect(deltas.monica).toBe(48);
    expect(deltas.chandler).toBe(-48);
    expect(deltas.opp1).toBe(0);
    expect(deltas.opp2).toBe(0);
    // La somme totale doit toujours être nulle.
    expect(Object.values(deltas).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('Emballage 12 raté : la somme des points reste nulle', () => {
    const players: [string, string, string, string] = ['joey', 'ross', 'opp1', 'opp2'];
    const { deltas } = scoreHand(
      [{ contractCode: 'EMBALLAGE_12', declarerPlayerIds: ['joey', 'ross'], tricksWon: 10 }],
      players,
    );
    expect(deltas.joey).toBe(-26);
    expect(deltas.ross).toBe(-26);
    expect(deltas.opp1).toBe(26);
    expect(deltas.opp2).toBe(26);
    expect(Object.values(deltas).reduce((a, b) => a + b, 0)).toBe(0);
  });
});
