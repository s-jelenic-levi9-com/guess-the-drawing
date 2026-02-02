import { Router, Request, Response } from 'express';
import { RoomManager } from '../services/RoomManager';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Create game room
router.post('/create', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { settings } = req.body;
    const roomManager = req.app.get('roomManager') as RoomManager;

    const room = roomManager.createRoom(
      req.user!.userId,
      req.user!.username,
      settings
    );

    res.json({ room });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Get active rooms
router.get('/active', (req: Request, res: Response) => {
  try {
    const roomManager = req.app.get('roomManager') as RoomManager;
    const rooms = roomManager.getActiveRooms();

    res.json({ rooms });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

// Get room details
router.get('/:roomCode', (req: Request, res: Response) => {
  try {
    const { roomCode } = req.params;
    const roomManager = req.app.get('roomManager') as RoomManager;
    
    const room = roomManager.getRoom(roomCode);
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({ room });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to get room' });
  }
});

export default router;
