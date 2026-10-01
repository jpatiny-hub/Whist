import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { GamePlayer, RikikiRound } from '../types';

interface BidDraft {
  playerId: string;
  bid: number;
  tricksWon: number;
}

interface Props {
  gameId: string;
  seatedPlayers: GamePlayer[];
  dealerId: string;
  cardsDealt: number;
  roundNumber: number;
  totalRounds: number;
  onSubmitted: () => void;
  editingRound?: RikikiRound | null;
  onCancelEdit?: () => void;
}

function initialBids(seatedPlayers: GamePlayer[], editingRound?: RikikiRound | null): BidDraft[] {
  if (editingRound) {
    return seatedPlayers.map((sp) => {
      const existing = editingRound.bids.find((b) => b.playerId === sp.playerId);
      return { playerId: sp.playerId, bid: existing?.bid ?? 0, tricksWon: existing?.tricksWon ?? 0 };
    });
  }
  return seatedPlayers.map((sp) => ({ playerId: sp.playerId, bid: 0, tricksWon: 0 }));
}

export default function RikikiRoundForm({
  gameId,
  seatedPlayers,
  dealerId,
  cardsDealt,
  roundNumber,
  totalRounds,
  onSubmitted,
  editingRound = null,
  onCancelEdit,
}: Props) {
  const isEditing = !!editingRound;
  const [bids, setBids] = useState<BidDraft[]>(() => initialBids(seatedPlayers, editingRound));
  const [preview, setPreview] = useState<{ cardsDealt: number; results: { playerId: string; points: number; success: boolean; zeroBidPenalty: boolean }[] } | null>(
    null,
  );
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBids(initialBids(seatedPlayers, editingRound));
    setPreview(null);
    setSubmitError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRound?.id, roundNumber]);

  function updateBid(playerId: string, patch: Partial<BidDraft>) {
    setBids((cur) => cur.map((b) => (b.playerId === playerId ? { ...b, ...patch } : b)));
  }

  const tricksTotal = bids.reduce((sum, b) => sum + b.tricksWon, 0);
  const bidsTotal = bids.reduce((sum, b) => sum + b.bid, 0);
  const tricksValid = tricksTotal === cardsDealt;

  useEffect(() => {
    if (!tricksValid) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewError(null);
    api<{ cardsDealt: number; results: { playerId: string; points: number; success: boolean; zeroBidPenalty: boolean }[] }>(
      `/games/${gameId}/rounds/preview`,
      { method: 'POST', body: JSON.stringify({ dealerId, bids }) },
    )
      .then((res) => {
        if (!cancelled) setPreview(res);
      })
      .catch((err) => {
        if (!cancelled) setPreviewError(err instanceof ApiError ? err.message : 'Erreur de calcul');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(bids), dealerId, tricksValid]);

  async function submit() {
    if (!tricksValid) return;
    setBusy(true);
    setSubmitError(null);
    try {
      const url = isEditing ? `/games/${gameId}/rounds/${editingRound!.id}` : `/games/${gameId}/rounds`;
      await api(url, { method: isEditing ? 'PUT' : 'POST', body: JSON.stringify({ dealerId, bids }) });
      onSubmitted();
      onCancelEdit?.();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  const dealer = seatedPlayers.find((sp) => sp.playerId === dealerId);
  // Bidding order: starts left of the dealer, dealer bids last.
  const dealerIdx = seatedPlayers.findIndex((sp) => sp.playerId === dealerId);
  const orderedPlayers =
    dealerIdx === -1 ? seatedPlayers : [...seatedPlayers.slice(dealerIdx + 1), ...seatedPlayers.slice(0, dealerIdx + 1)];

  return (
    <div className="card">
      <h2>
        {isEditing ? `Modifier la manche ${roundNumber}` : `Manche ${roundNumber} / ${totalRounds}`} — {cardsDealt} carte
        {cardsDealt > 1 ? 's' : ''}
      </h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Donneur : {dealer?.player.name ?? '—'} (annonce en dernier)
      </p>
      {submitError && <div className="error-box">{submitError}</div>}

      {orderedPlayers.map((sp) => {
        const b = bids.find((x) => x.playerId === sp.playerId)!;
        const isDealer = sp.playerId === dealerId;
        return (
          <div className="declaration-row" key={sp.playerId}>
            <p className="muted" style={{ marginTop: 0 }}>
              {sp.player.name}
              {isDealer ? ' (donneur)' : ''}
            </p>
            <div className="field">
              <label>Annonce (plis visés)</label>
              <input
                type="number"
                min={0}
                max={cardsDealt}
                value={b.bid}
                onChange={(e) => updateBid(sp.playerId, { bid: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Plis remportés</label>
              <input
                type="number"
                min={0}
                max={cardsDealt}
                value={b.tricksWon}
                onChange={(e) => updateBid(sp.playerId, { tricksWon: Number(e.target.value) })}
              />
            </div>
          </div>
        );
      })}

      <p className="muted">
        Total des annonces : {bidsTotal} — Total des plis : {tricksTotal}/{cardsDealt}
        {!tricksValid && <span className="negative"> (doit être égal à {cardsDealt})</span>}
      </p>

      {previewError && <div className="error-box">{previewError}</div>}
      {preview && (
        <div className="card" style={{ background: 'rgba(255,255,255,.04)' }}>
          <p className="muted" style={{ marginTop: 0 }}>
            Aperçu des points
          </p>
          {seatedPlayers.map((sp) => {
            const r = preview.results.find((x) => x.playerId === sp.playerId);
            if (!r) return null;
            return (
              <div key={sp.playerId} className="ladder-row">
                <span>
                  {sp.player.name}
                  {r.zeroBidPenalty ? ' (malus 0×3)' : ''}
                </span>
                <span className={r.points >= 0 ? 'positive' : 'negative'}>
                  {r.points >= 0 ? '+' : ''}
                  {r.points}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="btn-row" style={{ marginTop: 14 }}>
        <button className="btn" disabled={!tricksValid || busy} onClick={submit}>
          {isEditing ? 'Enregistrer les modifications' : 'Valider la manche'}
        </button>
        {isEditing && (
          <button className="btn ghost" disabled={busy} onClick={() => onCancelEdit?.()}>
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}
