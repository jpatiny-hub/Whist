import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { ContractDef, GamePlayer, TrumpSuit } from '../types';

interface DeclarationDraft {
  key: number;
  family: string;
  contractCode: string;
  declarerPlayerIds: string[];
  tricksWon: number;
  trumpSuit: TrumpSuit;
}

const TRUMP_LABELS: Record<Exclude<TrumpSuit, null>, string> = {
  COEUR: '♥ Cœur',
  CARREAU: '♦ Carreau',
  TREFLE: '♣ Trèfle',
  PIQUE: '♠ Pique',
};

const FAMILY_LABELS: Record<string, string> = {
  EMBALLAGE: 'Proposition / Emballage',
  SOLO: 'Solo',
  ABONDANCE: 'Abondance',
  PICCOLO: 'Piccolo',
  PETITE_MISERE: 'Petite misère',
  GRANDE_MISERE: 'Grande misère',
  MISERE_ETALEE: 'Misère étalée',
  TROU: 'Trou',
  GRAND_CHELEM: 'Grand chelem',
};

let idCounter = 0;

function emptyDeclaration(): DeclarationDraft {
  return { key: idCounter++, family: '', contractCode: '', declarerPlayerIds: [], tricksWon: 0, trumpSuit: null };
}

interface Props {
  gameId: string;
  seatedPlayers: GamePlayer[];
  contracts: ContractDef[];
  defaultDealerId: string;
  onSubmitted: () => void;
}

export default function HandForm({ gameId, seatedPlayers, contracts, defaultDealerId, onSubmitted }: Props) {
  const [dealerId, setDealerId] = useState(defaultDealerId);
  const [declarations, setDeclarations] = useState<DeclarationDraft[]>([emptyDeclaration()]);
  const [preview, setPreview] = useState<Record<string, number> | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setDealerId(defaultDealerId), [defaultDealerId]);

  const families = useMemo(() => [...new Set(contracts.map((c) => c.family))], [contracts]);

  function updateDecl(key: number, patch: Partial<DeclarationDraft>) {
    setDeclarations((cur) => cur.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function setFamily(key: number, family: string) {
    const levels = contracts.filter((c) => c.family === family);
    const first = levels[0];
    updateDecl(key, {
      family,
      contractCode: levels.length === 1 ? first.code : '',
      declarerPlayerIds: [],
      trumpSuit: null,
    });
  }

  function toggleDeclarer(d: DeclarationDraft, playerId: string) {
    const def = contracts.find((c) => c.code === d.contractCode);
    const max = def?.partnership ? 2 : 1;
    let next: string[];
    if (d.declarerPlayerIds.includes(playerId)) {
      next = d.declarerPlayerIds.filter((id) => id !== playerId);
    } else if (d.declarerPlayerIds.length >= max) {
      next = max === 1 ? [playerId] : d.declarerPlayerIds;
    } else {
      next = [...d.declarerPlayerIds, playerId];
    }
    updateDecl(d.key, { declarerPlayerIds: next });
  }

  const canAddMore = declarations.every((d) => {
    const def = contracts.find((c) => c.code === d.contractCode);
    return def?.allowsMultipleSimultaneous;
  });

  function addDeclaration() {
    setDeclarations((cur) => [...cur, emptyDeclaration()]);
  }

  function removeDeclaration(key: number) {
    setDeclarations((cur) => (cur.length > 1 ? cur.filter((d) => d.key !== key) : cur));
  }

  const isComplete = declarations.every((d) => {
    const def = contracts.find((c) => c.code === d.contractCode);
    if (!def) return false;
    const expected = def.partnership ? 2 : 1;
    if (d.declarerPlayerIds.length !== expected) return false;
    if (def.hasTrump && !d.trumpSuit) return false;
    return true;
  });

  useEffect(() => {
    if (!isComplete) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewError(null);
    api<{ deltas: Record<string, number> }>(`/games/${gameId}/hands/preview`, {
      method: 'POST',
      body: JSON.stringify({
        declarations: declarations.map((d) => ({
          contractCode: d.contractCode,
          declarerPlayerIds: d.declarerPlayerIds,
          tricksWon: d.tricksWon,
          trumpSuit: d.trumpSuit,
        })),
      }),
    })
      .then((res) => {
        if (!cancelled) setPreview(res.deltas);
      })
      .catch((err) => {
        if (!cancelled) setPreviewError(err instanceof ApiError ? err.message : 'Erreur de calcul');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(declarations), isComplete]);

  async function submitPasse() {
    setBusy(true);
    setSubmitError(null);
    try {
      await api(`/games/${gameId}/hands`, { method: 'POST', body: JSON.stringify({ dealerId, isPasse: true }) });
      setDeclarations([emptyDeclaration()]);
      onSubmitted();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!isComplete) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await api(`/games/${gameId}/hands`, {
        method: 'POST',
        body: JSON.stringify({
          dealerId,
          declarations: declarations.map((d) => ({
            contractCode: d.contractCode,
            declarerPlayerIds: d.declarerPlayerIds,
            tricksWon: d.tricksWon,
            trumpSuit: d.trumpSuit,
          })),
        }),
      });
      setDeclarations([emptyDeclaration()]);
      setPreview(null);
      onSubmitted();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Nouvelle donne</h2>
      {submitError && <div className="error-box">{submitError}</div>}

      <div className="field">
        <label htmlFor="dealer">Donneur</label>
        <select id="dealer" value={dealerId} onChange={(e) => setDealerId(e.target.value)}>
          {seatedPlayers.map((sp) => (
            <option key={sp.playerId} value={sp.playerId}>
              {sp.player.name}
            </option>
          ))}
        </select>
      </div>

      {declarations.map((d, idx) => {
        const family = d.family;
        const def = contracts.find((c) => c.code === d.contractCode);
        const levelOptions = family ? contracts.filter((c) => c.family === family) : [];
        return (
          <div className="declaration-row" key={d.key}>
            {declarations.length > 1 && (
              <button className="remove-decl" onClick={() => removeDeclaration(d.key)} aria-label="Retirer">
                ✕
              </button>
            )}
            <p className="muted" style={{ marginTop: 0 }}>
              Déclaration {idx + 1}
            </p>

            <div className="field">
              <label>Type de contrat</label>
              <div className="chip-row">
                {families.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`chip small ${family === f ? 'selected' : ''}`}
                    onClick={() => setFamily(d.key, f)}
                  >
                    {FAMILY_LABELS[f] ?? f}
                  </button>
                ))}
              </div>
            </div>

            {family && levelOptions.length > 1 && (
              <div className="field">
                <label>Niveau</label>
                <div className="chip-row">
                  {levelOptions.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      className={`chip small ${d.contractCode === c.code ? 'selected' : ''}`}
                      onClick={() => updateDecl(d.key, { contractCode: c.code, declarerPlayerIds: [] })}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {def?.hasTrump && (
              <div className="field">
                <label>Atout</label>
                <div className="chip-row">
                  {(Object.keys(TRUMP_LABELS) as Exclude<TrumpSuit, null>[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`chip small ${d.trumpSuit === s ? 'selected' : ''}`}
                      onClick={() => updateDecl(d.key, { trumpSuit: s })}
                    >
                      {TRUMP_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {def && (
              <div className="field">
                <label>{def.partnership ? 'Déclarants (2 : celui qui propose + celui qui emballe)' : 'Déclarant'}</label>
                <div className="chip-row">
                  {seatedPlayers.map((sp) => (
                    <button
                      key={sp.playerId}
                      type="button"
                      className={`chip small ${d.declarerPlayerIds.includes(sp.playerId) ? 'selected' : ''}`}
                      onClick={() => toggleDeclarer(d, sp.playerId)}
                    >
                      {sp.player.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {def && (
              <div className="field">
                <label>
                  Plis remportés par {def.partnership ? 'la paire' : 'le déclarant'}
                  {def.exact ? ` (objectif exact : ${def.requiredTricks})` : ` (objectif : ${def.requiredTricks}+)`}
                </label>
                <input
                  type="number"
                  min={0}
                  max={13}
                  value={d.tricksWon}
                  onChange={(e) => updateDecl(d.key, { tricksWon: Number(e.target.value) })}
                />
              </div>
            )}

            {def?.ruleNote && <p className="muted">{def.ruleNote}</p>}
          </div>
        );
      })}

      {canAddMore && (
        <button type="button" className="btn ghost" onClick={addDeclaration} style={{ marginBottom: 14 }}>
          + Ajouter une déclaration simultanée (misère multiple)
        </button>
      )}

      {previewError && <div className="error-box">{previewError}</div>}
      {preview && (
        <div className="card" style={{ background: 'rgba(255,255,255,.04)' }}>
          <p className="muted" style={{ marginTop: 0 }}>
            Aperçu des points
          </p>
          {seatedPlayers.map((sp) => (
            <div key={sp.playerId} className="ladder-row">
              <span>{sp.player.name}</span>
              <span className={preview[sp.playerId] >= 0 ? 'positive' : 'negative'}>
                {preview[sp.playerId] >= 0 ? '+' : ''}
                {preview[sp.playerId]}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="btn-row" style={{ marginTop: 14 }}>
        <button className="btn" disabled={!isComplete || busy} onClick={submit}>
          Valider la donne
        </button>
        <button className="btn secondary" disabled={busy} onClick={submitPasse}>
          Tour de passe (personne n'annonce)
        </button>
      </div>
    </div>
  );
}
