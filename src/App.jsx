import React from "react";
import ChessGame from "./components/ChessGame";
import ChessPGNPlayer from "./ChessPGNPlayer";

function App() {
  return (
    <div>
      <h2>Chess Game Viewer</h2>
      <ChessGame/>
      {/* <ChessPGNPlayer /> */}
    </div>
  );
}

export default App;
