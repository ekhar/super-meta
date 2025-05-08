import { useState, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

interface ChessBoardProps {
  onPositionChange?: (fen: string) => void;
}

export function ChessBoard({ onPositionChange }: ChessBoardProps) {
  const [game, setGame] = useState(new Chess());
  const [currentOpening, setCurrentOpening] = useState<string | null>(null);

  const makeMove = useCallback((move: { from: string; to: string; promotion?: string }) => {
    try {
      const newGame = new Chess(game.fen());
      const result = newGame.move(move);
      
      if (result) {
        setGame(newGame);
        onPositionChange?.(newGame.fen());
        return true;
      }
    } catch (e) {
      console.error('Invalid move:', e);
    }
    return false;
  }, [game, onPositionChange]);

  const onDrop = useCallback((sourceSquare: string, targetSquare: string) => {
    return makeMove({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q' // always promote to queen for simplicity
    });
  }, [makeMove]);

  const resetBoard = useCallback(() => {
    const newGame = new Chess();
    setGame(newGame);
    onPositionChange?.(newGame.fen());
    setCurrentOpening(null);
  }, [onPositionChange]);

  useEffect(() => {
    // This will be replaced with actual API call to your database
    const moves = game.history().join(' ');
    console.log('Current moves:', moves);
    // TODO: Add API call to get opening
  }, [game]);

  return (
    <div className="chess-board-container">
      <div style={{ width: '500px', margin: '0 auto' }}>
        <Chessboard 
          position={game.fen()} 
          onPieceDrop={onDrop}
          boardWidth={500}
        />
      </div>
      <div className="controls" style={{ marginTop: '1rem', textAlign: 'center' }}>
        <button onClick={resetBoard}>Reset Board</button>
        {currentOpening && (
          <div className="opening-name" style={{ marginTop: '1rem' }}>
            Opening: {currentOpening}
          </div>
        )}
      </div>
    </div>
  );
} 