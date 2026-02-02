export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingStroke {
  points: DrawingPoint[];
  color: string;
  width: number;
  timestamp: number;
}

export interface DrawingTool {
  type: 'brush' | 'eraser' | 'fill';
  color: string;
  width: number;
}
