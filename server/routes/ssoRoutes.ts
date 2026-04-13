import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { configureSamlStrategy, generateSSOToken, getSamlMetadata, configureOAuth2 } from '../middleware/ssoAuth';
import { authRateLimit, tokenValidationRateLimit } from '../middleware/rateLimiting';
import { db } from '../config/database';
import { logSecurityEvent } from '../middleware/auditLogger';

const router = express.Router();

// Configure authentication strategies
const oauthProviders = configureOAuth2();

router.get('/providers', (req, res) => {
  res.json({
    google: oauthProviders.googleEnabled,
    microsoft: oauthProviders.microsoftEnabled,
  });
});

// Apply rate limiting to all auth routes
router.use(authRateLimit);

// SAML SSO Routes
router.get('/saml/metadata', getSamlMetadata);

router.post('/saml/login/:domain', async (req, res, next) => {
  try {
    // Get enterprise domain configuration
    const domainResult = await db.query(
      'SELECT * FROM enterprise_domains WHERE domain = $1 AND sso_enabled = true',
      [req.params.domain]
    );

    if (domainResult.rows.length === 0) {
      return res.status(404).json({ error: 'SSO not configured for this domain' });
    }

    const domainConfig = domainResult.rows[0];
    
    // Configure SAML strategy for this domain
    configureSamlStrategy(
      domainConfig.saml_issuer,
      domainConfig.saml_entry_point,
      domainConfig.saml_cert
    );

    // Initiate SAML authentication
    passport.authenticate('saml', {
      additionalParams: {
        RelayState: req.body.returnUrl || '/dashboard'
      }
    })(req, res, next);
  } catch (error) {
    console.error('SAML login error:', error);
    res.status(500).json({ error: 'SSO authentication failed' });
  }
});

router.post('/saml/callback', 
  passport.authenticate('saml', { session: false }),
  async (req, res) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        await logSecurityEvent('auth_failure', {
          reason: 'SAML callback without user',
          timestamp: new Date().toISOString()
        }, req);
        return res.status(401).json({ error: 'Authentication failed' });
      }

      // Generate JWT token
      const token = generateSSOToken(user);
      
      // Log successful SSO login
      await logSecurityEvent('admin_action', {
        action: 'sso_login_success',
        userId: user.id,
        authProvider: 'saml',
        timestamp: new Date().toISOString()
      }, req);

      // Update last login
      await db.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );

      const returnUrl = req.body.RelayState || '/dashboard';
      
      // Return token (in production, consider secure cookie)
      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          subscriptionTier: user.subscription_tier
        },
        returnUrl
      });
    } catch (error) {
      console.error('SAML callback error:', error);
      await logSecurityEvent('auth_failure', {
        reason: 'SAML callback processing error',
        error: error.message,
        timestamp: new Date().toISOString()
      }, req);
      res.status(500).json({ error: 'Authentication processing failed' });
    }
  }
);

// Google OAuth2 Routes
router.get('/google', 
  (req, res, next) => {
    if (!oauthProviders.googleEnabled) {
      return res.status(503).json({
        error: 'Google Sign-In is not configured',
        code: 'GOOGLE_OAUTH_NOT_CONFIGURED'
      });
    }

    return passport.authenticate('google', {
      scope: ['profile', 'email'],
      session: false
    })(req, res, next);
  }
);

router.get('/google/callback',
  (req, res, next) => {
    if (!oauthProviders.googleEnabled) {
      return res.status(503).json({
        error: 'Google Sign-In is not configured',
        code: 'GOOGLE_OAUTH_NOT_CONFIGURED'
      });
    }

    return passport.authenticate('google', { session: false })(req, res, next);
  },
  async (req, res) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        return res.status(401).json({ error: 'Google authentication failed' });
      }

      const token = generateSSOToken(user);
      
      await logSecurityEvent('admin_action', {
        action: 'oauth_login_success',
        userId: user.id,
        authProvider: 'google',
        timestamp: new Date().toISOString()
      }, req);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          subscriptionTier: user.subscription_tier
        }
      });
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.status(500).json({ error: 'OAuth processing failed' });
    }
  }
);

// Microsoft OAuth2 Routes
router.get('/microsoft',
  (req, res, next) => {
    if (!oauthProviders.microsoftEnabled) {
      return res.status(503).json({
        error: 'Microsoft Sign-In is not configured',
        code: 'MICROSOFT_OAUTH_NOT_CONFIGURED'
      });
    }

    return passport.authenticate('microsoft', { session: false })(req, res, next);
  }
);

router.get('/microsoft/callback',
  (req, res, next) => {
    if (!oauthProviders.microsoftEnabled) {
      return res.status(503).json({
        error: 'Microsoft Sign-In is not configured',
        code: 'MICROSOFT_OAUTH_NOT_CONFIGURED'
      });
    }

    return passport.authenticate('microsoft', { session: false })(req, res, next);
  },
  async (req, res) => {
    try {
      const user = req.user as any;

      if (!user) {
        return res.status(401).json({ error: 'Microsoft authentication failed' });
      }

      const token = generateSSOToken(user);

      await logSecurityEvent('admin_action', {
        action: 'oauth_login_success',
        userId: user.id,
        authProvider: 'microsoft',
        timestamp: new Date().toISOString()
      }, req);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          subscriptionTier: user.subscription_tier
        }
      });
    } catch (error) {
      console.error('Microsoft OAuth callback error:', error);
      res.status(500).json({ error: 'OAuth processing failed' });
    }
  }
);

// Enterprise domain management (admin only)
router.post('/enterprise/domains', async (req, res) => {
  try {
    // Check admin permissions
    const userId = (req as any).userId;
    const userResult = await db.query(
      'SELECT is_super_admin FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0]?.is_super_admin) {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    const {
      domain,
      organizationName,
      samlIssuer,
      samlEntryPoint,
      samlCert,
      autoProvision = true,
      defaultRole = 'member'
    } = req.body;

    const result = await db.query(`
      INSERT INTO enterprise_domains (
        domain, organization_name, sso_enabled, saml_issuer, 
        saml_entry_point, saml_cert, auto_provision, default_role
      ) VALUES ($1, $2, true, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      domain, organizationName, samlIssuer, samlEntryPoint, 
      samlCert, autoProvision, defaultRole
    ]);

    await logSecurityEvent('admin_action', {
      action: 'enterprise_domain_created',
      domain,
      organizationName,
      adminUserId: userId
    }, req);

    res.status(201).json({
      success: true,
      domain: result.rows[0]
    });
  } catch (error) {
    console.error('Enterprise domain creation error:', error);
    res.status(500).json({ error: 'Failed to create enterprise domain' });
  }
});

// List enterprise domains (admin only)
router.get('/enterprise/domains', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const userResult = await db.query(
      'SELECT is_admin, is_super_admin FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0]?.is_admin && !userResult.rows[0]?.is_super_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await db.query(`
      SELECT 
        id, domain, organization_name, sso_enabled, 
        auto_provision, default_role, created_at, updated_at
      FROM enterprise_domains 
      ORDER BY organization_name
    `);

    res.json({
      success: true,
      domains: result.rows
    });
  } catch (error) {
    console.error('List enterprise domains error:', error);
    res.status(500).json({ error: 'Failed to fetch enterprise domains' });
  }
});

// Token validation endpoint
router.post('/validate-token', tokenValidationRateLimit, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }
    
    const decoded = jwt.verify(token, secret);
    
    // Check if user still exists and is active
    const userResult = await db.query(
      'SELECT id, email, subscription_tier, deleted_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].deleted_at) {
      return res.status(401).json({ error: 'Invalid token - user not found' });
    }

    const user = userResult.rows[0];
    
    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        subscriptionTier: user.subscription_tier
      },
      expiresAt: new Date(decoded.exp * 1000)
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    console.error('Token validation error:', error);
    res.status(500).json({ error: 'Token validation failed' });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    const userId = (req as any).userId;
    
    if (userId) {
      // Invalidate all user sessions
      await db.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
      
      await logSecurityEvent('admin_action', {
        action: 'user_logout',
        userId,
        timestamp: new Date().toISOString()
      }, req);
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

export default router;