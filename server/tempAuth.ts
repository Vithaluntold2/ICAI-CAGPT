/**
 * Temporary Simple Auth - Skip Database for Quick Testing
 */

import express from 'express';
import bcrypt from 'bcryptjs';

const app = express();

// Simple in-memory user store
const TEMP_USER = {
  id: 'admin-123',
  email: 'admin@sterling.com',
  name: 'Admin User',
  password: '$2b$12$CANcfQRbJw1raN0pQbHYQe4C84hHydY7zm6gG.IOtfhuWmTCHV11e', // password123456
  subscription_tier: 'professional',
  is_admin: true,
  email_verified: true
};

export function setupTempAuth(app: express.Application) {
  // Override the login route temporarily
  app.post("/api/auth/login", async (req, res) => {
    try {
      console.log('🔧 Using temporary auth system...');
      const { email, password } = req.body;
      
      // Check if it's our temp user
      if (email !== TEMP_USER.email) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      // Check password
      const validPassword = await bcrypt.compare(password, TEMP_USER.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      // Set session
      req.session.userId = TEMP_USER.id;
      
      console.log('✅ Temporary login successful');
      
      return res.status(200).json({
        message: "Login successful",
        user: {
          id: TEMP_USER.id,
          email: TEMP_USER.email,
          name: TEMP_USER.name,
          subscription_tier: TEMP_USER.subscription_tier,
          isAdmin: TEMP_USER.is_admin  // Frontend expects isAdmin not is_admin
        }
      });
      
    } catch (error) {
      console.error('Temp auth error:', error);
      return res.status(500).json({ error: "Login failed" });
    }
  });
  
  // Override user lookup for session middleware
  app.use((req, res, next) => {
    if (req.session?.userId === TEMP_USER.id) {
      (req as any).user = TEMP_USER;
    }
    next();
  });
  
  console.log('🔧 Temporary authentication system active');
  console.log('📧 Email: admin@sterling.com');
  console.log('🔑 Password: password123456');
}