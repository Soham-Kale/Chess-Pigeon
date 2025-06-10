import React, { useState, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import moveSoundFile from "/move.mp3";
import "./App.css"

const ChessPGNPlayer = () => {
    const [game, setGame] = useState(new Chess());
    const [orientation, setOrientation] = useState("white");
    const [isUserTurn, setIsUserTurn] = useState(true);
    const [pgn, setPgn] = useState("");

    const [fen, setFen] = useState("start");
    const [moves, setMoves] = useState([]);
    const [index, setIndex] = useState(0);
    const [lastMoveSquares, setLastMoveSquares] = useState({});
    const intervalRef = useRef(null);
    const audioRef = useRef(new Audio(moveSoundFile));
    const [currentMoveInfo, setCurrentMoveInfo] = useState("");

    const [gameOver, setGameOver] = useState(false);
    const [moveHistory, setMoveHistory] = useState([]);
    const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
    const [possibleMoves, setPossibleMoves] = useState([]);

    const stockfishRef = useRef(null);
    const moveSound = useRef(null);

    const [moveList, setMoveList] = useState([]);
    const [analysis, setAnalysis] = useState([]);
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
        fetch("/sample.pgn")
            .then((res) => res.text())
            .then((pgn) => {
                game.loadPgn(pgn);
                const allMovesVerbose = game.history({ verbose: true });
                setMoves(allMovesVerbose);

                const analysisList = allMovesVerbose.map((move, idx) => ({
                    moveNumber: Math.floor(idx / 2) + 1,
                    move: move.san,
                    player: move.color === "w" ? "White" : "Black",
                    captured: move.captured || "-",
                    check: move.flags.includes("c") ? "Check" : "",
                    mate: move.flags.includes("m") ? "Mate" : "",
                    from: move.from,
                    to: move.to
                }));

                setAnalysis(analysisList);
                game.reset();
                setFen(game.fen());
            });
    }, [game]);

    const goToIndex = (i) => {
        const tempGame = new Chess();
        let moveInfo = "";
        for (let j = 0; j < i; j++) {
            const move = tempGame.move(moves[j]);
            if (j === i - 1) {
                moveInfo = `${move.color === "w" ? "White" : "Black"} played ${move.san}`;
                if (move.captured) moveInfo += `, captured ${move.captured}`;
                setLastMoveSquares({
                    [move.from]: { background: "rgba(255, 255, 0, 0.5)" },
                    [move.to]: { background: "rgba(0, 255, 0, 0.5)" },
                });
                audioRef.current.play();
            }
        }
        setCurrentMoveInfo(moveInfo);
        setIndex(i);
        setFen(tempGame.fen());
    };

    const handleNext = () => {
        if (index < moves.length) goToIndex(index + 1);
    };

    const handlePrev = () => {
        if (index > 0) goToIndex(index - 1);
    };

    const handleAuto = () => {
        if (intervalRef.current) return;
        intervalRef.current = setInterval(() => {
            setIndex((prev) => {
                const next = prev + 1;
                if (next > moves.length) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                    return prev;
                }
                goToIndex(next);
                return next;
            });
        }, 1500);
    };

    const handleStop = () => {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
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

        const newHistory = moveHistory.slice(0, currentMoveIndex + 1);
        newHistory.push(game.fen());
        setMoveHistory(newHistory);
        setCurrentMoveIndex(newHistory.length - 1);

        // Request analysis for the current position
        stockfishRef.current.postMessage(`position fen ${game.fen()}`);
        stockfishRef.current.postMessage("go depth 10");

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
    };

    return (
        <div className="app">
            {/* <div className="header">
                <div className="game-info">
                    <h1>Queen's Pawn Opening: Mikénas Defense</h1>
                </div>
                <div className="player-info">
                </div>
            </div> */}

            {/* Main Game Area */}
            <div className="game-container">
                <div className="board-section">
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
                        <button onClick={handlePrev}>⏮ Prev</button>
                        <button onClick={handleNext}>⏭ Next</button>
                        <button onClick={handleAuto}>▶️ Auto</button>
                        <button onClick={handleStop}>⏹ Stop</button>
                        <button onClick={handleRestart}>Restart</button>
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
                            <div>No.</div>
                            <div>Player</div>
                            <div>From</div>
                            <div>To</div>
                        </div>
                        <div className="table-body">
                            {analysis.map((a, i) => (
  <div
    key={i}
    className={`analysis-row ${a.player} ${i === index - 1 ? "highlight" : ""}`}
  >
    <div className="move-info">{i + 1}.</div>
    <div style={{ marginLeft: 10 }}>{a.player}</div>
    <div style={{ marginLeft: 12 }}>{a.from}</div>
    <div style={{ marginLeft: 12 }}>{a.to}</div>
    <div style={{ marginLeft: 12 }}>{a.check}</div>
    <div style={{ marginLeft: 12 }}>{a.mate}</div>
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

export default ChessPGNPlayer;