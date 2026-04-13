import { Request, Response, NextFunction } from 'express';
import { storage } from '../pgStorage';

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = req.session.userId;
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const user = await storage.getUser(userId);
  
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}
