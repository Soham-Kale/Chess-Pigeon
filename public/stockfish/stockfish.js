import { Chess } from "chess.js";

// Stockfish Web Worker
let currentFen = '';

self.onmessage = function(e) {
  if (e.data === "uci") {
    self.postMessage("uciok");
  } else if (e.data.startsWith("position fen")) {
    // Store the current FEN position
    currentFen = e.data.split("position fen ")[1];
    self.postMessage("readyok");
  } else if (e.data.startsWith("go")) {
    // Generate a valid move based on the current position
    setTimeout(() => {
      const move = generateValidMove(currentFen);
      self.postMessage("bestmove " + move);
    }, 500);
  }
};

function generateValidMove(fen) {
  // Create a new chess instance with the current position
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  
  if (moves.length === 0) {
    return 'e2e4'; // Default move if no legal moves are found
  }
  
  // Get a random legal move
  const randomMove = moves[Math.floor(Math.random() * moves.length)];
  return randomMove.from + randomMove.to;
}
