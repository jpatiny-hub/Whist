import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { ContractDef, Game } from '../types';
import Scoreboard from '../components/Scoreboard';
import PointsChart from '../components/PointsChart';
import HandForm from '../components/HandForm';

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [contracts, setContracts] = useState<ContractDef[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await api<{ game: Game }>(`/games/${id}`);
    setGame(res.game);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    api<{ contracts: ContractDef[] }>('/contracts').then((res) => setContracts(res.contracts));
  }, [load]);

  const seatedPlayers = useMemo(() => (game ? [...game.players].sort((a, b) => a.seat - b.seat) : []), [game]);

  const defaultDealerId = useMemo(() => {
    if (!game || seatedPlayers.length === 0) return '';
    const hands = game.hands ?? [];
    const last = hands[hands.length - 1];
    if (!last) return seatedPlayers[0].playerId;
    if (last.passedRound) return last.dealerId;
    const idx = seatedPlayers.findIndex((p) => p.playerId === last.dealerId);
    return seatedPlayers[(idx + 1) % seatedPlayers.length].playerId;
  }, [game, seatedPlayers]);

  async function closeGame() {
    if (!id) return;
    if (!confirm('Clôturer cette partie ? Elle passera en lecture seule.')) return;
    await api(`/games/${id}/close`, { method: 'POST' });
    await load();
  }

  if (loading || !game) return <p className="muted">Chargement…</p>;

  const hands = game.hands ?? [];

  return (
    <div>
      <div className="card">
        <h2>{game.label || 'Partie'}</h2>
        <p className="muted">{seatedPlayers.map((p) => p.player.name).join(' · ')}</p>
        <Scoreboard seatedPlayers={seatedPlayers} hands={hands} />
        <div className="btn-row" style={{ marginTop: 14 }}>
          <Link className="btn ghost" to={`/games/${id}/stats`} style={{ textDecoration: 'none' }}>
            Statistiques de la partie
          </Link>
          {game.status === 'OPEN' && (
            <button className="btn danger" onClick={closeGame}>
              Clôturer la partie
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Évolution des points</h2>
        <PointsChart seatedPlayers={seatedPlayers} hands={hands} />
      </div>

      {game.status === 'OPEN' && contracts.length > 0 && (
        <HandForm
          gameId={game.id}
          seatedPlayers={seatedPlayers}
          contracts={contracts}
          defaultDealerId={defaultDealerId}
          onSubmitted={load}
        />
      )}

      <div className="card">
        <h2>Historique des donnes ({hands.length})</h2>
        {hands.length === 0 && <p className="muted">Aucune donne enregistrée.</p>}
        {[...hands].reverse().map((hand) => (
          <div key={hand.id} className="declaration-row">
            <p style={{ marginTop: 0 }}>
              <strong>Donne {hand.handNumber}</strong> — donneur : {hand.dealer.name}
              {hand.pointsMultiplier > 1 && <span className="badge fail" style={{ marginLeft: 8 }}>×{hand.pointsMultiplier}</span>}
            </p>
            {hand.passedRound && <p className="muted">Tour de passe — personne n'a annoncé.</p>}
            {!hand.passedRound &&
              hand.declarations.map((decl) => (
                <p key={decl.id} className="muted">
                  {contracts.find((c) => c.code === decl.contractCode)?.label ?? decl.contractCode} —{' '}
                  {decl.declarers.map((d) => d.player.name).join(' + ')} — {decl.tricksWon} plis —{' '}
                  <span className={`badge ${decl.success ? 'success' : 'fail'}`}>{decl.success ? 'réussi' : 'échoué'}</span>
                </p>
              ))}
            {!hand.passedRound && (
              <div className="chip-row">
                {hand.playerScores.map((s) => (
                  <span key={s.id} className="chip small">
                    {s.player.name} : {s.delta >= 0 ? '+' : ''}
                    {s.delta}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
