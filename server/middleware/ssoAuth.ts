import { Request, Response, NextFunction } from 'express';
import { Strategy as SamlStrategy } from '@node-saml/passport-saml';
import passport from 'passport';
import { db } from '../config/database';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

interface SamlUser {
  nameID: string;
  email: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  role?: string;
}

interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

// SAML Strategy Configuration
export const configureSamlStrategy = (issuer: string, entryPoint: string, cert: string) => {
  passport.use(new SamlStrategy({
    issuer,
    entryPoint,
    cert,
    callbackUrl: `${process.env.BASE_URL}/auth/saml/callback`,
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    validateInResponseTo: true,
    requestIdExpirationPeriodMs: 28800000, // 8 hours
    cacheProvider: new Map() // Simple in-memory cache for request IDs
  }, async (profile: any, done: any) => {
    try {
      const samlUser: SamlUser = {
        nameID: profile.nameID,
        email: profile.email || profile.nameID,
        firstName: profile.firstName,
        lastName: profile.lastName,
        department: profile.department,
        role: profile.role
      };

      // Find or create user
      let userResult = await db.query(
        'SELECT * FROM users WHERE email = $1',
        [samlUser.email]
      );

      let user;
      if (userResult.rows.length === 0) {
        // Create new enterprise user
        const insertResult = await db.query(`
          INSERT INTO users (
            email, 
            first_name, 
            last_name, 
            subscription_tier, 
            auth_provider,
            external_id,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, 'enterprise', 'saml', $4, NOW(), NOW())
          RETURNING *
        `, [samlUser.email, samlUser.firstName, samlUser.lastName, samlUser.nameID]);
        
        user = insertResult.rows[0];
      } else {
        user = userResult.rows[0];
        
        // Update user info from SAML
        await db.query(`
          UPDATE users 
          SET 
            first_name = COALESCE($2, first_name),
            last_name = COALESCE($3, last_name),
            external_id = $4,
            last_login = NOW(),
            updated_at = NOW()
          WHERE id = $1
        `, [user.id, samlUser.firstName, samlUser.lastName, samlUser.nameID]);
      }

      return done(null, user);
    } catch (error) {
      console.error('SAML authentication error:', error);
      return done(error, null);
    }
  }));
};

// JWT token generation for SSO users
export const generateSSOToken = (user: any): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  
  const payload = {
    userId: user.id,
    email: user.email,
    subscriptionTier: user.subscription_tier,
    authProvider: 'saml',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    nonce: crypto.randomBytes(16).toString('hex')
  };

  return jwt.sign(payload, secret);
};

// Middleware to validate JWT tokens
export const validateJWT = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Let other auth methods handle this
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }
    
    const decoded = jwt.verify(token, secret) as any;

    // Verify user still exists and is active
    const userResult = await db.query(
      'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token - user not found' });
    }

    req.userId = decoded.userId;
    req.user = userResult.rows[0];
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('JWT validation error:', error);
    res.status(500).json({ error: 'Token validation failed' });
  }
};

// SAML metadata endpoint
export const getSamlMetadata = (req: Request, res: Response) => {
  const metadata = `<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     entityID="${process.env.BASE_URL}/auth/saml/metadata">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true"
                      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                                 Location="${process.env.BASE_URL}/auth/saml/callback"
                                 index="1" />
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;

  res.set('Content-Type', 'application/xml');
  res.send(metadata);
};

// Enterprise domain validation
export const validateEnterpriseDomain = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user || user.subscription_tier !== 'enterprise') {
      return next();
    }

    // Check if user's domain is registered for enterprise SSO
    const email = user.email;
    const domain = email.split('@')[1];

    const domainResult = await db.query(
      'SELECT * FROM enterprise_domains WHERE domain = $1 AND sso_enabled = true',
      [domain]
    );

    if (domainResult.rows.length === 0 && user.auth_provider !== 'saml') {
      return res.status(403).json({ 
        error: 'Enterprise users must authenticate via SSO',
        domain,
        ssoRequired: true
      });
    }

    next();
  } catch (error) {
    console.error('Enterprise domain validation error:', error);
    res.status(500).json({ error: 'Domain validation failed' });
  }
};

// OAuth2 configuration for other providers (Google, Microsoft)
export const configureOAuth2 = () => {
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const microsoftClientId = process.env.MICROSOFT_CLIENT_ID || process.env.MS_GRAPH_CLIENT_ID;
  const microsoftClientSecret = process.env.MICROSOFT_CLIENT_SECRET || process.env.MS_GRAPH_CLIENT_SECRET;
  const microsoftTenantId = process.env.MICROSOFT_TENANT_ID || process.env.MS_GRAPH_TENANT_ID;
  const microsoftConfigured = Boolean(
    microsoftClientId &&
    microsoftClientSecret &&
    microsoftTenantId
  );

  // Google OAuth2 Strategy
  if (googleConfigured) {
    const GoogleStrategy = require('passport-google-oauth20').Strategy;
    
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BASE_URL}/api/auth/sso/google/callback`
    }, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        const email = profile.emails[0].value;
        
        let userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        
        let user;
        if (userResult.rows.length === 0) {
          const insertResult = await db.query(`
            INSERT INTO users (
              email, first_name, last_name, subscription_tier, 
              auth_provider, external_id, created_at, updated_at
            ) VALUES ($1, $2, $3, 'free', 'google', $4, NOW(), NOW())
            RETURNING *
          `, [email, profile.name.givenName, profile.name.familyName, profile.id]);
          
          user = insertResult.rows[0];
        } else {
          user = userResult.rows[0];
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }));
  }

  // Microsoft OAuth2 Strategy
  if (microsoftConfigured) {
    const MicrosoftStrategy = require('passport-microsoft').Strategy;

    passport.use(new MicrosoftStrategy({
      clientID: microsoftClientId,
      clientSecret: microsoftClientSecret,
      callbackURL: `${process.env.BASE_URL}/api/auth/sso/microsoft/callback`,
      scope: ['user.read'],
      tenant: microsoftTenantId,
    }, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        const email = profile?.emails?.[0]?.value || profile?.mail || profile?.userPrincipalName;
        if (!email) {
          return done(new Error('Unable to resolve Microsoft account email'), null);
        }

        const firstName = profile?.name?.givenName || profile?.givenName || '';
        const lastName = profile?.name?.familyName || profile?.surname || '';
        const externalId = profile?.id || profile?.oid || profile?.sub;

        let userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);

        let user;
        if (userResult.rows.length === 0) {
          const insertResult = await db.query(`
            INSERT INTO users (
              email, first_name, last_name, subscription_tier,
              auth_provider, external_id, created_at, updated_at
            ) VALUES ($1, $2, $3, 'free', 'microsoft', $4, NOW(), NOW())
            RETURNING *
          `, [email, firstName, lastName, externalId]);

          user = insertResult.rows[0];
        } else {
          user = userResult.rows[0];
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }));
  }

  return {
    googleEnabled: googleConfigured,
    microsoftEnabled: microsoftConfigured,
  };
};