import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { ContractDef, GamePlayer, TrumpSuit } from '../types';

interface DeclarationDraft {
  key: number;
  family: string;
  contractCode: string;
  /** One slot per required declarer ('' = not yet chosen). Length 1 for solo contracts, 2 for partnerships (Emballage/Trou). */
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
  const familyDef = (family: string) => contracts.find((c) => c.family === family);

  function updateDecl(key: number, patch: Partial<DeclarationDraft>) {
    setDeclarations((cur) => cur.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function setFamily(key: number, family: string) {
    const levels = contracts.filter((c) => c.family === family);
    const first = levels[0];
    updateDecl(key, {
      family,
      contractCode: levels.length === 1 ? first.code : '',
      declarerPlayerIds: first?.partnership ? ['', ''] : [''],
      trumpSuit: null,
    });
  }

  function selectPlayer(d: DeclarationDraft, slot: number, playerId: string) {
    const next = [...d.declarerPlayerIds];
    next[slot] = next[slot] === playerId ? '' : playerId;
    // A player can't fill two slots of the same declaration at once.
    for (let i = 0; i < next.length; i++) {
      if (i !== slot && next[i] === playerId) next[i] = '';
    }
    updateDecl(d.key, { declarerPlayerIds: next });
  }

  function declarationComplete(d: DeclarationDraft) {
    const fam = familyDef(d.family);
    if (!fam || !d.contractCode) return false;
    const expected = fam.partnership ? 2 : 1;
    if (d.declarerPlayerIds.filter(Boolean).length !== expected) return false;
    if (fam.hasTrump && !d.trumpSuit) return false;
    return true;
  }

  function addSimultaneous(afterKey: number) {
    setDeclarations((cur) => {
      const base = cur.find((d) => d.key === afterKey);
      const next = emptyDeclaration();
      if (base) {
        const fam = familyDef(base.family);
        next.family = base.family;
        next.contractCode = base.contractCode;
        next.declarerPlayerIds = fam?.partnership ? ['', ''] : [''];
      }
      return [...cur, next];
    });
  }

  function removeDeclaration(key: number) {
    setDeclarations((cur) => (cur.length > 1 ? cur.filter((d) => d.key !== key) : cur));
  }

  const isComplete = declarations.length > 0 && declarations.every(declarationComplete);

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
          declarerPlayerIds: d.declarerPlayerIds.filter(Boolean),
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
            declarerPlayerIds: d.declarerPlayerIds.filter(Boolean),
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
        const fam = familyDef(d.family);
        const levelDef = contracts.find((c) => c.code === d.contractCode);
        const levelOptions = d.family ? contracts.filter((c) => c.family === d.family) : [];
        const isLast = idx === declarations.length - 1;
        const takenElsewhere = new Set(
          declarations.filter((other) => other.key !== d.key).flatMap((other) => other.declarerPlayerIds.filter(Boolean)),
        );

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

            {/* 1. Type de contrat */}
            <div className="field">
              <label>Type de contrat</label>
              <div className="chip-row">
                {families.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`chip small ${d.family === f ? 'selected' : ''}`}
                    onClick={() => setFamily(d.key, f)}
                  >
                    {FAMILY_LABELS[f] ?? f}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Joueur(s) */}
            {fam && (
              <div className="field">
                <label>Déclarant</label>
                <div className="chip-row">
                  {seatedPlayers.map((sp) => (
                    <button
                      key={sp.playerId}
                      type="button"
                      disabled={takenElsewhere.has(sp.playerId) || d.declarerPlayerIds[1] === sp.playerId}
                      className={`chip small ${d.declarerPlayerIds[0] === sp.playerId ? 'selected' : ''}`}
                      onClick={() => selectPlayer(d, 0, sp.playerId)}
                    >
                      {sp.player.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {fam?.partnership && (
              <div className="field">
                <label>Partenaire (celui qui emballe)</label>
                <div className="chip-row">
                  {seatedPlayers.map((sp) => (
                    <button
                      key={sp.playerId}
                      type="button"
                      disabled={takenElsewhere.has(sp.playerId) || d.declarerPlayerIds[0] === sp.playerId}
                      className={`chip small ${d.declarerPlayerIds[1] === sp.playerId ? 'selected' : ''}`}
                      onClick={() => selectPlayer(d, 1, sp.playerId)}
                    >
                      {sp.player.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Annonce (niveau) */}
            {d.family && levelOptions.length > 1 && (
              <div className="field">
                <label>Annonce</label>
                <div className="chip-row">
                  {levelOptions.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      className={`chip small ${d.contractCode === c.code ? 'selected' : ''}`}
                      onClick={() => updateDecl(d.key, { contractCode: c.code })}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Atout (couleur dans laquelle partir) */}
            {fam?.hasTrump && (
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

            {/* 5. Plis réalisés */}
            {levelDef && (
              <div className="field">
                <label>
                  Plis remportés par {fam?.partnership ? 'la paire' : 'le déclarant'}
                  {levelDef.exact ? ` (objectif exact : ${levelDef.requiredTricks})` : ` (objectif : ${levelDef.requiredTricks}+)`}
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

            {levelDef?.ruleNote && <p className="muted">{levelDef.ruleNote}</p>}

            {/* 6. Case facultative pour ajouter un contrat simultané */}
            {isLast && fam?.allowsMultipleSimultaneous && declarationComplete(d) && (
              <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={false} onChange={() => addSimultaneous(d.key)} />
                Ajouter un contrat simultané (un autre joueur fait aussi {FAMILY_LABELS[d.family] ?? d.family})
              </label>
            )}
          </div>
        );
      })}

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
