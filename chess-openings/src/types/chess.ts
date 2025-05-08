export interface ChessOpening {
  ecoCode: string;
  name: string;
  moves: string;
}

export interface OpeningResponse {
  opening: ChessOpening | null;
  error?: string;
} 