import { createContext, useCallback, useContext, useRef, useState } from "react";

// Vervangt window.confirm/window.prompt door een eigen gestylede modal.
// Een Promise-gebaseerde useConfirm()-hook i.p.v. lokale state per pagina,
// zodat elke aanroepplek dezelfde blokkerende if(!(await confirm(...)))
// return-stijl kan gebruiken als voorheen met window.confirm
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [inputWaarde, setInputWaarde] = useState("");
  const [inputFout, setInputFout] = useState("");
  const resolveRef = useRef(null);

  const confirm = useCallback((opties) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setInputWaarde("");
      setInputFout("");
      setDialog(opties);
    });
  }, []);

  function sluiten(resultaat) {
    setDialog(null);
    resolveRef.current?.(resultaat);
    resolveRef.current = null;
  }

  function handleBevestig() {
    if (dialog?.requireInput) {
      const getrimd = inputWaarde.trim();
      if (!getrimd) {
        setInputFout(dialog.inputRequiredError ?? "Dit veld is verplicht.");
        return;
      }
      sluiten(getrimd);
      return;
    }
    sluiten(true);
  }

  function handleAnnuleer() {
    sluiten(dialog?.requireInput ? null : false);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div className="confirm-overlay" onMouseDown={handleAnnuleer}>
          <div
            className="confirm-kaart"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-titel"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-titel" className="confirm-titel">
              {dialog.title}
            </h2>
            <p className="confirm-bericht">{dialog.message}</p>

            {dialog.requireInput && (
              <div className="auth-field confirm-veld">
                <input
                  autoFocus
                  value={inputWaarde}
                  placeholder={dialog.inputPlaceholder}
                  onChange={(e) => {
                    setInputWaarde(e.target.value);
                    setInputFout("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleBevestig();
                  }}
                />
                {inputFout && <p className="auth-error">{inputFout}</p>}
              </div>
            )}

            <div className="confirm-acties">
              <button type="button" className="confirm-annuleer" onClick={handleAnnuleer}>
                {dialog.cancelText ?? "Annuleren"}
              </button>
              <button
                type="button"
                className={dialog.danger ? "confirm-bevestig confirm-bevestig--danger" : "confirm-bevestig"}
                onClick={handleBevestig}
                autoFocus={!dialog.requireInput}
              >
                {dialog.confirmText ?? "Bevestigen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

// confirm({ title, message, confirmText?, cancelText?, danger? }) => Promise<boolean>
// confirm({ ..., requireInput: true, inputPlaceholder?, inputRequiredError? }) => Promise<string|null>
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
