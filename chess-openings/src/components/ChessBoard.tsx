import { useState, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { findOpening } from '../services/openingService';
import type { ChessOpening } from '../types/chess';

interface ChessBoardProps {
  onPositionChange?: (fen: string) => void;
}

export function ChessBoard({ onPositionChange }: ChessBoardProps) {
  const [game] = useState(new Chess());
  const [currentOpening, setCurrentOpening] = useState<ChessOpening | null>(null);
  const [pgn, setPgn] = useState<string>('');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Format moves for display in the UI
  const formatMovesForDisplay = (moves: string[]) => {
    return moves.reduce((acc, move, index) => {
      if (index % 2 === 0) {
        return acc + `${Math.floor(index / 2) + 1}. ${move}${index + 1 < moves.length ? ' ' : ''}`;
      }
      return acc + `${move} `;
    }, '').trim();
  };

  // Format moves for database query
  const formatMovesForQuery = (moves: string[]) => {
    let formattedMoves = '';
    moves.forEach((move, index) => {
      if (index % 2 === 0) {
        formattedMoves += `${Math.floor(index / 2) + 1} ${move}`;
      } else {
        formattedMoves += ` ${move}`;
      }
      if (index < moves.length - 1 && index % 2 === 1) {
        formattedMoves += ' ';
      }
    });
    return formattedMoves.trim();
  };

  const updateOpening = useCallback(async (moves: string[]) => {
    if (moves.length === 0) {
      setCurrentOpening(null);
      return;
    }

    setIsSearching(true);
    const formattedMoves = formatMovesForQuery(moves);
    console.log('Formatted moves for query:', formattedMoves);
    try {
      const opening = await findOpening(formattedMoves);
      console.log('Found opening:', opening);
      setCurrentOpening(opening);
    } catch (error) {
      console.error('Error finding opening:', error);
      setCurrentOpening(null);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const makeMove = useCallback((move: { from: string; to: string; promotion?: string }) => {
    try {
      const result = game.move(move);
      
      if (result) {
        const newHistory = game.history();
        setMoveHistory(newHistory);
        setPgn(formatMovesForDisplay(newHistory));
        updateOpening(newHistory);
        onPositionChange?.(game.fen());
        return true;
      }
    } catch (e) {
      console.error('Invalid move:', e);
    }
    return false;
  }, [game, onPositionChange, updateOpening]);

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
        <div className="opening-info" style={{ marginTop: '1rem' }}>
          {moveHistory.length > 0 ? (
            isSearching ? (
              <div>Identifying opening...</div>
            ) : currentOpening ? (
              <>
                <div><strong>ECO:</strong> {currentOpening.ecoCode}</div>
                <div><strong>Opening:</strong> {currentOpening.name}</div>
              </>
            ) : (
              <div><strong>Opening:</strong> Unknown</div>
            )
          ) : (
            <div><strong>Opening:</strong> Game start</div>
          )}
        </div>
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