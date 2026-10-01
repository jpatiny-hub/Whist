import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Game, GamePlayer } from '../types';
import Scoreboard from './Scoreboard';
import PointsChart from './PointsChart';
import RikikiRoundForm from './RikikiRoundForm';

interface Props {
  game: Game;
  seatedPlayers: GamePlayer[];
  onReload: () => void;
  onClose: () => void;
}

export default function RikikiGameView({ game, seatedPlayers, onReload, onClose }: Props) {
  const [sequence, setSequence] = useState<number[]>([]);
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ sequence: number[]; nextRoundNumber: number }>(`/games/${game.id}/rounds/sequence`).then((res) =>
      setSequence(res.sequence),
    );
  }, [game.id]);

  const rounds = game.rikikiRounds ?? [];
  const editingRound = rounds.find((r) => r.id === editingRoundId) ?? null;

  const scoreRows = useMemo(
    () => rounds.map((r) => ({ handNumber: r.roundNumber, playerScores: r.bids.map((b) => ({ playerId: b.playerId, delta: b.points })) })),
    [rounds],
  );

  const nextRoundNumber = rounds.length + 1;
  const activeRoundNumber = editingRound?.roundNumber ?? nextRoundNumber;
  const cardsDealt = editingRound?.cardsDealt ?? sequence[activeRoundNumber - 1];
  const dealerSeatIndex = seatedPlayers.length > 0 ? (activeRoundNumber - 1) % seatedPlayers.length : 0;
  const defaultDealerId = editingRound?.dealerId ?? seatedPlayers[dealerSeatIndex]?.playerId ?? '';

  const gameOver = sequence.length > 0 && rounds.length >= sequence.length && !editingRound;

  function startEditing(roundId: string) {
    setEditingRoundId(roundId);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div>
      <div className="card">
        <h2>{game.label || 'Partie'} — Rikiki</h2>
        <p className="muted">{seatedPlayers.map((p) => p.player.name).join(' · ')}</p>
        <p className="muted">
          Pic : {game.rikikiPeak ?? '—'} cartes{game.rikikiDoublePeak ? ' · sommet rejoué 2×' : ''}
          {game.rikikiZeroBidPenalty ? ' · malus 3×0 consécutifs actif' : ''}
        </p>
        <Scoreboard seatedPlayers={seatedPlayers} hands={scoreRows} />
        <div className="btn-row" style={{ marginTop: 14 }}>
          <Link className="btn ghost" to={`/games/${game.id}/rikiki-stats`} style={{ textDecoration: 'none' }}>
            Statistiques de la partie
          </Link>
          {game.status === 'OPEN' && (
            <button className="btn danger" onClick={onClose}>
              Clôturer la partie
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Évolution des points</h2>
        <PointsChart seatedPlayers={seatedPlayers} hands={scoreRows} />
      </div>

      {game.status === 'OPEN' && sequence.length > 0 && (
        <div ref={formRef}>
          {gameOver ? (
            <div className="card">
              <h2>Partie terminée</h2>
              <p className="muted">Toutes les manches de l'ascenseur ont été jouées. Tu peux clôturer la partie.</p>
            </div>
          ) : (
            <RikikiRoundForm
              gameId={game.id}
              seatedPlayers={seatedPlayers}
              dealerId={defaultDealerId}
              cardsDealt={cardsDealt}
              roundNumber={activeRoundNumber}
              totalRounds={sequence.length}
              onSubmitted={onReload}
              editingRound={editingRound}
              onCancelEdit={() => setEditingRoundId(null)}
            />
          )}
        </div>
      )}

      <div className="card">
        <h2>Historique des manches ({rounds.length})</h2>
        {rounds.length === 0 && <p className="muted">Aucune manche enregistrée.</p>}
        {[...rounds].reverse().map((round) => (
          <div key={round.id} className="declaration-row">
            <p style={{ marginTop: 0 }}>
              <strong>
                Manche {round.roundNumber} — {round.cardsDealt} carte{round.cardsDealt > 1 ? 's' : ''}
              </strong>{' '}
              — donneur : {round.dealer.name}
              {game.status === 'OPEN' && (
                <button className="link-btn" style={{ marginLeft: 10, fontSize: 13 }} onClick={() => startEditing(round.id)}>
                  Modifier
                </button>
              )}
            </p>
            <div className="chip-row">
              {round.bids.map((b) => (
                <span key={b.id} className="chip small">
                  {b.player.name} : {b.bid}→{b.tricksWon} ({b.points >= 0 ? '+' : ''}
                  {b.points})
                  {b.zeroBidPenalty ? ' ⚠' : ''}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
