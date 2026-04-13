import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';

interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

// Set RLS context for database queries
export const setRLSContext = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.userId) {
    // Validate UUID format to prevent injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    await db.query('SELECT set_config($1, $2, true)', ['app.current_user_id', req.userId]);
  }
  next();
};

// Universal authorization middleware
export const requirePermission = (resource: string, action: string = 'read') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check user subscription and permissions
      const userResult = await db.query(
        'SELECT subscription_tier, is_admin, is_super_admin FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }

      const user = userResult.rows[0];
      
      // Admin bypass
      if (user.is_admin || user.is_super_admin) {
        return next();
      }

      // Check resource-specific permissions
      const hasPermission = await checkResourcePermission(userId, user.subscription_tier, resource, action);
      
      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: `${action} access to ${resource}`,
          userTier: user.subscription_tier
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Authorization check failed' });
    }
  };
};

// Check profile access permissions
export const requireProfileAccess = (role: string = 'viewer') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      const profileId = req.params.profileId || req.body.profileId;

      if (!userId || !profileId) {
        return res.status(400).json({ error: 'User ID and Profile ID required' });
      }

      // Check if user has access to profile
      const accessResult = await db.query(`
        SELECT pm.role, p.user_id as owner_id
        FROM profiles p
        LEFT JOIN profile_members pm ON p.id = pm.profile_id AND pm.user_id = $1
        WHERE p.id = $2
      `, [userId, profileId]);

      if (accessResult.rows.length === 0) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      const access = accessResult.rows[0];
      const isOwner = access.owner_id === userId;
      const memberRole = access.role;

      // Role hierarchy: owner > admin > member > viewer
      const roleHierarchy = { owner: 4, admin: 3, member: 2, viewer: 1 };
      const requiredLevel = roleHierarchy[role as keyof typeof roleHierarchy] || 1;
      const userLevel = isOwner ? 4 : (roleHierarchy[memberRole as keyof typeof roleHierarchy] || 0);

      if (userLevel < requiredLevel) {
        return res.status(403).json({ 
          error: 'Insufficient profile permissions',
          required: role,
          current: isOwner ? 'owner' : memberRole || 'none'
        });
      }

      next();
    } catch (error) {
      console.error('Profile access check error:', error);
      res.status(500).json({ error: 'Profile access check failed' });
    }
  };
};

// Check subscription tier requirements
export const requireSubscription = (minTier: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userResult = await db.query(
        'SELECT subscription_tier FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }

      const userTier = userResult.rows[0].subscription_tier;
      const tierHierarchy = { free: 1, plus: 2, professional: 3, enterprise: 4 };
      
      const userLevel = tierHierarchy[userTier as keyof typeof tierHierarchy] || 0;
      const requiredLevel = tierHierarchy[minTier as keyof typeof tierHierarchy] || 0;

      if (userLevel < requiredLevel) {
        return res.status(403).json({ 
          error: 'Subscription upgrade required',
          required: minTier,
          current: userTier
        });
      }

      next();
    } catch (error) {
      console.error('Subscription check error:', error);
      res.status(500).json({ error: 'Subscription check failed' });
    }
  };
};

// Resource permission checker
async function checkResourcePermission(userId: string, subscriptionTier: string, resource: string, action: string): Promise<boolean> {
  // Validate inputs to prevent injection
  const validTiers = ['free', 'plus', 'professional', 'enterprise'];
  const validActions = ['read', 'write', 'create', 'delete', 'admin'];
  
  if (!validTiers.includes(subscriptionTier) || !validActions.includes(action)) {
    return false;
  }
  
  // Check feature flags with parameterized query
  const featureFlagResult = await db.query(
    'SELECT enabled_plans FROM feature_flags WHERE feature_name = $1',
    [resource]
  );

  if (featureFlagResult.rows.length > 0) {
    const enabledPlans = featureFlagResult.rows[0].enabled_plans;
    if (!enabledPlans.includes(subscriptionTier)) {
      return false;
    }
  }

  // Check usage quotas for write operations
  if (['write', 'create'].includes(action)) {
    const quotaResult = await db.query(`
      SELECT 
        CASE 
          WHEN $2 = 'conversations' THEN queries_used < queries_limit
          WHEN $2 = 'documents' THEN documents_used < documents_limit
          WHEN $2 = 'profiles' THEN profiles_used < profiles_limit
          ELSE true
        END as within_quota
      FROM usage_quotas 
      WHERE user_id = $1
    `, [userId, resource]);

    if (quotaResult.rows.length > 0 && !quotaResult.rows[0].within_quota) {
      return false;
    }
  }

  return true;
}

export { AuthenticatedRequest };