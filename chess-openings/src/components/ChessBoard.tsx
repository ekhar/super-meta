import { useState, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

interface ChessBoardProps {
  onPositionChange?: (fen: string) => void;
}

export function ChessBoard({ onPositionChange }: ChessBoardProps) {
  const [game] = useState(new Chess());
  const [currentOpening, setCurrentOpening] = useState<string | null>(null);
  const [pgn, setPgn] = useState<string>('');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);

  const formatMoves = (moves: string[]) => {
    return moves.reduce((acc, move, index) => {
      if (index % 2 === 0) {
        return acc + `${Math.floor(index / 2) + 1}. ${move}${index + 1 < moves.length ? ' ' : ''}`;
      }
      return acc + `${move} `;
    }, '').trim();
  };

  const makeMove = useCallback((move: { from: string; to: string; promotion?: string }) => {
    try {
      const result = game.move(move);
      
      if (result) {
        const newHistory = game.history();
        setMoveHistory(newHistory);
        setPgn(formatMoves(newHistory));
        onPositionChange?.(game.fen());
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
    game.reset();
    setMoveHistory([]);
    setPgn('');
    onPositionChange?.(game.fen());
    setCurrentOpening(null);
  }, [game, onPositionChange]);

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
        <div className="pgn-display" style={{ 
          marginTop: '1rem', 
          padding: '1rem', 
          backgroundColor: '#f5f5f5',
          color: '#333',
          borderRadius: '4px',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          textAlign: 'left',
          maxWidth: '500px',
          margin: '1rem auto',
          border: '1px solid #ddd',
          fontSize: '14px',
          lineHeight: '1.6',
          letterSpacing: '0.5px'
        }}>
          {pgn || 'Game start'}
        </div>
      </div>
    </div>
  );
} 