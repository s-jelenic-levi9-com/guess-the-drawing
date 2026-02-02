import { Router, Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { generateToken, generateRefreshToken } from '../utils/jwt';
import Joi from 'joi';

const router = Router();

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { username, email, password } = value;
    const userService = req.app.get('userService') as UserService;

    // Create user (throws if email/username exists)
    const user = await userService.create(username, email, password);

    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = value;
    const userService = req.app.get('userService') as UserService;

    const user = await userService.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await userService.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await userService.updateLastLogin(user.id);

    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
