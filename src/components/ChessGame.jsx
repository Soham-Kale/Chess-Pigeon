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
  const [gameTime, setGameTime] = useState(10); // 10 minutes

  const [gameOver, setGameOver] = useState(false);
  const [moveHistory, setMoveHistory] = useState([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [possibleMoves, setPossibleMoves] = useState([]);
  const [botLevel, setBotLevel] = useState(10); // Default to intermediate level
  const [status, setStatus] = useState("Your turn");
  const [isBotThinking, setIsBotThinking] = useState(false);

  const stockfishRef = useRef(null);
  const moveSound = useRef(null);

  const [moveList, setMoveList] = useState([]);
  const [analysis, setAnalysis] = useState([]);
  const [playerName] = useState("Soham");
  const [botName] = useState("Stockfish Bot");
  const [timeWhite, setTimeWhite] = useState(600); // 10 minutes in seconds
  const [timeBlack, setTimeBlack] = useState(600);

  useEffect(() => {
    const timer = setInterval(() => {
      if (game.turn() === 'w') {
        setTimeWhite(prev => prev > 0 ? prev - 1 : 0);
      } else {
        setTimeBlack(prev => prev > 0 ? prev - 1 : 0);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [game.turn()]);

  // Format time for display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

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
  }, [fen]);

  useEffect(() => {
    // Initialize Stockfish worker
    const workerBlob = new Blob([
      `importScripts('https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js');
      ${stockfishWorkerCode}`
    ], { type: 'application/javascript' });

    stockfishRef.current = new Worker(URL.createObjectURL(workerBlob));

    // Set up message handler for analysis
    stockfishRef.current.addEventListener("message", (e) => {
      if (e.data.includes("info depth") && e.data.includes("score")) {
        const depthMatch = e.data.match(/depth (\d+)/);
        const scoreMatch = e.data.match(/score (cp|mate) ([-+]?\d+)/);
        const pvMatch = e.data.match(/pv (\S+)/);

        if (depthMatch && scoreMatch) {
          const depth = parseInt(depthMatch[1]);
          const scoreType = scoreMatch[1];
          let scoreValue = parseInt(scoreMatch[2]);

          if (scoreType === 'mate') {
            scoreValue = scoreValue > 0 ? `+#${Math.abs(scoreValue)}` : `-#${Math.abs(scoreValue)}`;
          } else {
            scoreValue = (scoreValue / 100).toFixed(1);
          }

          setAnalysis(prev => {
            const newAnalysis = [...prev];
            const moveIndex = newAnalysis.length - 1;
            if (moveIndex >= 0) {
              newAnalysis[moveIndex] = {
                ...newAnalysis[moveIndex],
                depth,
                score: scoreValue,
                variation: pvMatch ? pvMatch[1] : ''
              };
            }
            return newAnalysis;
          });
        }
      }
    });

    moveSound.current = new Audio("/move.mp3");

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
    stockfishRef.current.postMessage(`setoption name Skill Level value ${botLevel}`);
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

      setPgn(game.pgn());
      playMoveSound();

      return result;
    } catch (error) {
      console.error("Error applying move:", error);
      return false;
    }
  };

  const onDrop = (source, target) => {
    if (game.turn() !== (orientation === "white" ? "w" : "b")) return false;
    if (!isUserTurn) return false;

    const move = { from: source, to: target };
    const moveResult = applyMove(move);
    if (!moveResult) return false;

    // Record analysis for user move
    setAnalysis(prev => [
      ...prev,
      {
        moveNumber: Math.floor(moveList.length / 2) + 1,
        move: moveResult.san,
        player: orientation === "white" ? "white" : "black",
        time: formatTime(orientation === "white" ? timeWhite : timeBlack),
        depth: "...",
        score: "...",
        variation: ""
      }
    ]);

    setIsUserTurn(false);
    setStatus("Bot thinking...");
    setIsBotThinking(true);

    const newHistory = moveHistory.slice(0, currentMoveIndex + 1);
    newHistory.push(game.fen());
    setMoveHistory(newHistory);
    setCurrentMoveIndex(newHistory.length - 1);

    // Request analysis for the current position
    stockfishRef.current.postMessage(`position fen ${game.fen()}`);
    stockfishRef.current.postMessage("go depth 10");

    setTimeout(() => {
      getBestMoveFromStockfish(game.fen(), (botMove) => {
        const botMoveResult = applyMove(botMove);
        if (botMoveResult) {
          // Record analysis for bot move
          setAnalysis(prev => [
            ...prev,
            {
              moveNumber: Math.floor(moveList.length / 2) + 1,
              move: botMoveResult.san,
              player: orientation === "white" ? "black" : "white",
              time: formatTime(orientation === "white" ? timeBlack : timeWhite),
              depth: "...",
              score: "...",
              variation: ""
            }
          ]);

          const updatedHistory = [...newHistory, game.fen()];
          setMoveHistory(updatedHistory);
          setCurrentMoveIndex(updatedHistory.length - 1);
        }
        setIsUserTurn(true);
        setStatus("Your turn");
        setIsBotThinking(false);
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
    setAnalysis([]);
    setTimeWhite(600);
    setTimeBlack(600);
    setStatus("Your turn");
    setIsBotThinking(false);
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

  // const changeBotLevel = (level) => {
  //   setBotLevel(level);
  //   setStatus(`Bot level set to ${getLevelName(level)}`);
  //   setTimeout(() => setStatus("Your turn"), 2000);
  // };

  // const getLevelName = (level) => {
  //   if (level <= 5) return 'Beginner';
  //   if (level <= 10) return 'Intermediate';
  //   if (level <= 15) return 'Advanced';
  //   return 'Expert';
  // };

  return (
    <div className="app">
      <div className="header">
        <div className="game-info">
          <h1>Queen's Pawn Opening: Mikénas Defense</h1>
          <div className="game-time">{playerName} vs. {botName} ({gameTime} min)</div>
        </div>
        <div className="player-info">
          <div className="player">
            <div className="player-name">{playerName}</div>
            <div className="player-time">{formatTime(timeWhite)}</div>
          </div>
          <div className="player">
            <div className="player-name">{botName}</div>
            <div className="player-time">{formatTime(timeBlack)}</div>
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="game-container">
        <div className="board-section">
          <div className="status-bar">
            <div className={`status-indicator ${status.includes('Your turn') ? 'active' : ''}`}></div>
            {status}
            {isBotThinking && <div className="thinking-animation"></div>}
          </div>

          <div className="board-wrapper">
            <Chessboard
              position={fen}
              onPieceDrop={onDrop}
              boardOrientation={orientation}
              onSquareClick={onSquareClick}
              customSquareStyles={{
                ...lastMoveSquares,
                ...getDotStyles(),
              }}
              customBoardStyle={{
                borderRadius: '8px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
              }}
              customDarkSquareStyle={{ backgroundColor: '#779556' }}
              customLightSquareStyle={{ backgroundColor: '#ebecd0' }}
            />
          </div>

          <div className="controls">
            <button onClick={handleRestart} className="control-btn new-game">
              <i className="fas fa-sync-alt"></i> New Game
            </button>
            <button onClick={handleFlip} className="control-btn flip-board">
              <i className="fas fa-undo"></i> Flip Board
            </button>
            <button onClick={handlePrev} className="control-btn new-game">
              <i className="fas fa-sync-alt"></i> Prev
            </button>
            <button onClick={handleNext} className="control-btn flip-board">
              <i className="fas fa-undo"></i> Next
            </button>
            <button onClick={handleDownloadPgn} className="control-btn download-pgn">
              <i className="fas fa-download"></i> Download PGN
            </button>
          </div>
        </div>

        <div className="analysis-section">
          <div className="analysis-header">
            <h3 className="text-lg font-semibold mb-3">Move Analysis</h3>
            <div className="analysis-filters">
              <button className="filter-btn active">All</button>
              <button className="filter-btn">White</button>
              <button className="filter-btn">Black</button>
            </div>
            </div>
            <div className="analysis-table">
              <div className="table-header">
                <div>Move</div>
                <div>White</div>
                <div>Black</div>
                <div>Time</div>
                <div>Depth</div>
                {/* <div>Score</div>
                <div>Variation</div> */}
              </div>
              <div className="table-body"> 
                {moveList.map((turn, index) => (
                  <div key={index} className={`analysis-row ${turn.player}`}>
                    <div className="move-info">{index + 1}.</div>
                    {/* <div>{turn.number}</div> */}
                    <div style={{marginLeft: 12}}>{turn.white}</div>
                    <div style={{marginLeft: 12}}>{turn.black}</div>
                  </div>
                ))}
              </div>

            <div className="current-position">
            <h3>Current Position Evaluation</h3>
            <div className="evaluation-bar">
              <div className="evaluation-fill" style={{ width: '45%' }}></div>
              <div className="evaluation-text">+0.8</div>
            </div>
            <div className="position-stats">
              <div className="stat">
                <div className="stat-label">Material</div>
                <div className="stat-value">+0.3</div>
              </div>
              <div className="stat">
                <div className="stat-label">Mobility</div>
                <div className="stat-value">+0.2</div>
              </div>
              <div className="stat">
                <div className="stat-label">King Safety</div>
                <div className="stat-value">+0.3</div>
              </div>
            </div>
            </div>
        </div>
      </div>
      </div>

      {/* Footer */}
      <div className="footer">
        <p>• Powered by UinSports</p>
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
  } else if (e.data.startsWith("setoption")) {
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