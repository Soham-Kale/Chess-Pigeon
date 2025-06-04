// useStockfish.js
import { useEffect, useRef } from "react";

const useStockfish = (onBestMove) => {
  const stockfishRef = useRef(null);

  useEffect(() => {
    stockfishRef.current = new Worker("/stockfish/stockfish.js");
    return () => {
      stockfishRef.current.terminate();
    };
  }, []);

  const getBestMove = (fen) => {
    stockfishRef.current.postMessage("uci");
    stockfishRef.current.postMessage("position fen " + fen);
    stockfishRef.current.postMessage("go depth 10");

    stockfishRef.current.onmessage = (event) => {
      if (event.data.startsWith("bestmove")) {
        const move = event.data.split(" ")[1];
        onBestMove(move);
      }
    };
  };

  return { getBestMove };
};

export default useStockfish;
