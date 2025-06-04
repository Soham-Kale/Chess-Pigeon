import React, { useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import useStockfish from "../../public/stockfish/stockfish";

const ChessGame = () => {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState("start");

  const onBestMove = (move) => {
    game.move({ from: move.slice(0, 2), to: move.slice(2, 4) });
    setFen(game.fen());
  };

  const { getBestMove } = useStockfish(onBestMove);

  const onDrop = (source, target) => {
    const move = game.move({ from: source, to: target, promotion: "q" });
    if (move) {
      setFen(game.fen());
      setTimeout(() => getBestMove(game.fen()), 500); // Let bot move
    }
    return true;
  };

  return (
    <div style={{ padding: 20 }}>
      <Chessboard position={fen} onPieceDrop={onDrop} />
    </div>
  );
};

export default ChessGame;
