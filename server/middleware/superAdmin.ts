import { Request, Response, NextFunction } from 'express';
import { storage } from '../pgStorage';

/**
 * Super Admin Middleware - Only for system-level operations
 * 
 * Super admins have access to:
 * - System monitoring dashboard
 * - Security threat logs
 * - APM metrics and alerts
 * - Deployment management
 * - Maintenance mode controls
 * 
 * Regular admins can only access:
 * - User management
 * - Subscription management
 * - Coupons
 * - Business analytics
 */
export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = req.session.userId;
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const user = await storage.getUser(userId);
  
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  
  // Check database isSuperAdmin flag (not email whitelist)
  if (!user.isSuperAdmin) {
    console.warn(`[SuperAdmin] Access denied for user: ${user.email} (isSuperAdmin: ${user.isSuperAdmin})`);
    return res.status(403).json({ 
      error: 'Super admin access required',
      message: 'Only super admins can access system monitoring and administration.'
    });
  }
  
  console.log(`[SuperAdmin] Access granted to ${user.email}`);
  next();
}
