// "Ask a question": a dialog any page can open to ask a reader who has read a book something about
// it, with the reader filled in, and the book named at the start of the question. The dialog's code
// loads the first time it opens, with a spinner in an empty dialog meanwhile.
import { Suspense, createContext, useContext, useState } from "react";
import { Modal } from "react-bootstrap";

import { LoadingSpinner, lazyPage } from "./Loading.jsx";
import { modalManager } from "./modalManager.js";

const AskQuestionModal = lazyPage(() => import("./AskQuestionModal.jsx"));

const AskContext = createContext(() => {});

export const useAskQuestion = () => useContext(AskContext);

export function AskQuestionProvider({ children }) {
  const [prefill, setPrefill] = useState(null); // { reader, book? } while open
  const close = () => setPrefill(null);

  return (
    <AskContext.Provider value={setPrefill}>
      {children}
      {prefill && (
        <Suspense
          fallback={
            <Modal show onHide={close} centered manager={modalManager}>
              <LoadingSpinner label="Loading the question form…" minHeight="20rem" />
            </Modal>
          }
        >
          <AskQuestionModal prefill={prefill} onClose={close} />
        </Suspense>
      )}
    </AskContext.Provider>
  );
}
