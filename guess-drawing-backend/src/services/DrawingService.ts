import { DrawingStroke } from '../types';

// In-memory drawing storage
const drawings = new Map<string, DrawingStroke[]>();

export class DrawingService {
  async saveStroke(gameId: string, stroke: DrawingStroke): Promise<void> {
    if (!drawings.has(gameId)) {
      drawings.set(gameId, []);
    }
    drawings.get(gameId)!.push(stroke);
  }

  async getDrawingHistory(gameId: string): Promise<DrawingStroke[]> {
    return drawings.get(gameId) || [];
  }

  async clearDrawing(gameId: string): Promise<void> {
    drawings.set(gameId, []);
  }

  validateStroke(stroke: any): DrawingStroke {
    // Validate points (pixel coordinates for 800x600 canvas)
    const points = Array.isArray(stroke.points)
      ? stroke.points.filter((p: any) => 
          typeof p.x === 'number' && typeof p.y === 'number' &&
          p.x >= 0 && p.x <= 800 && p.y >= 0 && p.y <= 600
        )
      : [];

    // Validate color (hex format)
    const color = /^#[0-9A-F]{6}$/i.test(stroke.color) 
      ? stroke.color 
      : '#000000';

    // Validate width (1-50px to support all brush sizes)
    const width = typeof stroke.width === 'number'
      ? Math.max(1, Math.min(50, stroke.width))
      : 3;

    return {
      points,
      color,
      width,
      timestamp: Date.now(),
    };
  }
}
