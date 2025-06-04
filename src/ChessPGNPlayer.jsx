import React, { useEffect, useState, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import "./App.css";

const ChessPGNPlayer = () => {
    const [game] = useState(new Chess());
    const [fen, setFen] = useState("start");
    const [moves, setMoves] = useState([]);
    const [index, setIndex] = useState(0);
    const intervalRef = useRef(null);

    useEffect(() => {
        fetch("/sample.pgn")
        .then((res) => res.text())
        .then((pgn) => {
            game.loadPgn(pgn);
            const allMoves = game.history();
            setMoves(allMoves);
            game.reset();
            setFen(game.fen());
        });
    }, [game]);

    const goToIndex = (i) => {
        const tempGame = new Chess();
        for (let j = 0; j < i; j++) {
        tempGame.move(moves[j]);
        }
        setIndex(i);
        setFen(tempGame.fen());
    };

    const handleNext = () => {
        if (index < moves.length) {
        goToIndex(index + 1);
        }
    };

    const handlePrev = () => {
        if (index > 0) {
        goToIndex(index - 1);
        }
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
        }, 1000);
    };

    const handleStop = () => {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
    };

    const handleReset = () => {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        game.reset();
        setFen("start");
        setMoves([]);
        setIndex(0);
    }

    return (
        <div style={{ padding: 20 }}>
        <Chessboard  position={fen} arePiecesDraggable={false} />
        <div style={{ marginTop: 10 }}>
            <button className="btn" onClick={handlePrev}>⏮ Prev</button>
            <button className="btn" onClick={handleNext}>⏭ Next</button>
            <button className="btn" onClick={handleAuto}>▶️ Auto</button>
            <button className="btn" onClick={handleStop}>⏹ Stop</button>
            <button className="btn" onClick={handleReset}>⏹ Reset</button>
        </div>
        <p>Move: {index}/{moves.length}</p>
        </div>
    );
};

export default ChessPGNPlayer;