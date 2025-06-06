import React, { useState, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

const ChessGame = () => {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState("start");
  const [orientation, setOrientation] = useState("white");
  const [lastMoveSquares, setLastMoveSquares] = useState({});
  const [isUserTurn, setIsUserTurn] = useState(true);
  const [pgn, setPgn] = useState("");

  const [gameOver, setGameOver] = useState(false);
  const [moveHistory, setMoveHistory] = useState([]); // stores FEN after each move
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1); // -1 means start position
  const [possibleMoves, setPossibleMoves] = useState([]);

  const stockfishRef = useRef(null);
  const moveSound = useRef(null);

  const [moveList, setMoveList] = useState([]);

  console.log("moves printing: ", moveList);

  useEffect(() => {
    const pgn = game.pgn();
    const moveSection = pgn
      .split("\n")
      .filter((line) => !line.startsWith("["))
      .join(" ");


    const tokens = moveSection.trim().split(/\s+/);
    const groupedMoves = [];

    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].includes(".")) {
        groupedMoves.push({
          number: tokens[i].replace(".", ""),
          white: tokens[i + 1] || "",
          black: tokens[i + 2] || "",
        });
        i += 2;
      }
    }

    setMoveList(groupedMoves);
  }, [fen]); // updates on every move

  useEffect(() => {
    // Initialize Stockfish worker with chess.js
    const workerBlob = new Blob([
      `importScripts('https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js');
      ${stockfishWorkerCode}`
    ], { type: 'application/javascript' });

    stockfishRef.current = new Worker(URL.createObjectURL(workerBlob));

    moveSound.current = new Audio("/move.mp3");

    // Cleanup on component unmount
    return () => {
      if (stockfishRef.current) {
        stockfishRef.current.terminate();
      }
    };
  }, []);

  const getBestMoveFromStockfish = (fen, callback) => {
    if (!stockfishRef.current) {
      console.error("Stockfish worker not initialized");
      return;
    }

    // Set up message handler
    const handleMessage = (e) => {
      if (e.data.startsWith("bestmove")) {
        const move = e.data.split(" ")[1];
        if (move === "(none)") return;

        const from = move.slice(0, 2);
        const to = move.slice(2, 4);
        callback({ from, to });
        stockfishRef.current.removeEventListener("message", handleMessage);
      }
    };

    stockfishRef.current.addEventListener("message", handleMessage);

    // Send commands to Stockfish
    stockfishRef.current.postMessage("uci");
    stockfishRef.current.postMessage(`position fen ${fen}`);
    stockfishRef.current.postMessage("go depth 12");
  };

  const playMoveSound = () => {
    if (moveSound.current) {
      moveSound.current.currentTime = 0;
      moveSound.current.play();
    }
  };

  const onSquareClick = (square) => {
    const piece = game.get(square);
    if (!piece || piece.color !== (orientation === "white" ? "w" : "b")) {
      setPossibleMoves([]);
      return;
    }

    const moves = game.moves({ square, verbose: true });
    const destinations = moves.map((m) => m.to);
    setPossibleMoves(destinations);
  };

  const getDotStyles = () => {
    const styles = {};
    possibleMoves.forEach((square) => {
      styles[square] = {
        background: "radial-gradient(circle, #666 20%, transparent 20%)",
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      };
    });
    return styles;
  };


  const applyMove = (move) => {
    if (game.isCheckmate()) {
      setGameOver(true);
    }

    try {
      const result = game.move({ ...move, promotion: "q" });
      if (!result) {
        console.error("Invalid move:", move);
        return false;
      }

      // Update the game state
      const newFen = game.fen();
      setFen(newFen);

      // Update last move squares
      setLastMoveSquares({
        [move.from]: { background: "rgba(255, 255, 0, 0.4)" },
        [move.to]: { background: "rgba(255, 255, 0, 0.4)" },
      });

      console.log("Move applied successfully:", move);
      console.log("New FEN:", newFen);

      setPgn(game.pgn());
      playMoveSound();

      return true;
    } catch (error) {
      console.error("Error applying move:", error);
      return false;
    }
  };

  const onDrop = (source, target) => {
    if (game.turn() !== (orientation === "white" ? "w" : "b")) return false;
    if (!isUserTurn) return false;

    const move = { from: source, to: target };
    const userMoved = applyMove(move);
    if (!userMoved) return false;

    setIsUserTurn(false);

    const newHistory = moveHistory.slice(0, currentMoveIndex + 1);
    newHistory.push(game.fen());
    setMoveHistory(newHistory);
    setCurrentMoveIndex(newHistory.length - 1);

    console.log("User moved, requesting bot move...");

    setTimeout(() => {
      getBestMoveFromStockfish(game.fen(), (botMove) => {
        console.log("Received bot move:", botMove);
        const botMoved = applyMove(botMove);
        if (botMoved) {
          const updatedHistory = [...newHistory, game.fen()];
          setMoveHistory(updatedHistory);
          setCurrentMoveIndex(updatedHistory.length - 1);
        }
        setIsUserTurn(true);
      });
    }, 300);

    return true;
  };

  const handleRestart = () => {
    const newGame = new Chess();
    setGame(newGame);
    setFen("start");
    setIsUserTurn(true);
    setLastMoveSquares({});
    setMoveHistory([]);
    setCurrentMoveIndex(-1);
  };

  const handleFlip = () => {
    setOrientation((prev) => (prev === "white" ? "black" : "white"));
  };

  const handleNext = () => {
    if (currentMoveIndex + 1 >= moveHistory.length) return;

    game.load(moveHistory[currentMoveIndex + 1]);
    setFen(moveHistory[currentMoveIndex + 1]);
    setCurrentMoveIndex(currentMoveIndex + 1);
    setLastMoveSquares({});
  };

  const handleDownloadPgn = () => {
    const element = document.createElement("a");
    const file = new Blob([pgn], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = "game.pgn";
    document.body.appendChild(element);
    element.click();
  };

  const handlePrev = () => {
    if (currentMoveIndex <= 0) {
      game.reset();
      playMoveSound();
      setFen("start");
      setCurrentMoveIndex(-1);
      setLastMoveSquares({});
      return;
    }

    game.load(moveHistory[currentMoveIndex - 1]);
    setFen(moveHistory[currentMoveIndex - 1]);
    setCurrentMoveIndex(currentMoveIndex - 1);
    setLastMoveSquares({});
  };

  return (
    // <div style={{ padding: 20 }}>
    <div className="flex flex-row items-start gap-4 p-4">
      <Chessboard
        position={fen}
        onPieceDrop={onDrop}
        // boardWidth={600}
        boardOrientation={orientation}
        onSquareClick={onSquareClick}
        customSquareStyles={{
          ...lastMoveSquares,
          ...getDotStyles(),
        }}
      />

      {gameOver && <h2 style={{ color: "red", textAlign: "center" }}>Game Over</h2>}

      <div style={{ marginTop: 10 }}>
        <button className="btn" onClick={handleRestart}>♻️ Restart</button>
        <button className="btn" onClick={handleFlip}>🔄 Flip</button>
        <button className="btn" onClick={handlePrev}>⏮️ Prev</button>
        <button className="btn" onClick={handleNext}>⏭️ Next</button>
        <button className="btn" style={{ background: "linear-gradient(to right, #e67e22, #d35400)" }} onClick={handleDownloadPgn}>Download PGN</button>
      </div>

      <div className="w-64 pl-3 overflow-y-auto h-[480px] bg-white rounded shadow p-4">
        <h3 className="text-lg font-semibold mb-3">Move Analysis</h3>
        <table className="w-full text-sm table-auto border-collapse">
          <thead>
            <tr className="border-b border-gray-300 text-left">
              <th className="py-1 px-2">Turn</th>
              <th className="py-1 px-2 ">White</th>
              <th className="py-1 px-2">Black</th>
            </tr>
          </thead>
          <tbody>
            {moveList.map((turn, index) => (
              <tr key={index} className="border-b border-gray-200">
                <td className="py-1 px-2 font-medium">{index + 1}.</td>
                {/* <td className="py-1 px-2">{turn.number}</td> */}
                <td className="py-1 px-2">{turn.white}</td>
                <td className="py-1 px-2">{turn.black}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Stockfish worker code as a string
const stockfishWorkerCode = `
let currentFen = '';

self.onmessage = function(e) {
  if (e.data === "uci") {
    self.postMessage("uciok");
  } else if (e.data.startsWith("position fen")) {
    currentFen = e.data.split("position fen ")[1];
    self.postMessage("readyok");
  } else if (e.data.startsWith("go")) {
    setTimeout(() => {
      const move = generateValidMove(currentFen);
      self.postMessage("bestmove " + move);
    }, 500);
  }
};

function generateValidMove(fen) {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  
  if (moves.length === 0) {
    return 'e2e4';
  }
  
  const randomMove = moves[Math.floor(Math.random() * moves.length)];
  return randomMove.from + randomMove.to;
}
`;

export default ChessGame;
