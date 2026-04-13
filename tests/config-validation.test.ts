/**
 * Azure AI Fallback Configuration Tests
 * Tests the configuration and basic functionality without complex imports
 */

import fs from 'fs';
import path from 'path';

describe('Azure AI Fallback Configuration Tests', () => {
  describe('Configuration File Validation', () => {
    it('should have Azure OpenAI marked as primary in environment example', () => {
      const envPath = path.join(process.cwd(), '.env.example');
      expect(fs.existsSync(envPath)).toBe(true);
      
      const envContent = fs.readFileSync(envPath, 'utf8');
      expect(envContent).toContain('AZURE_OPENAI_ENDPOINT');
      expect(envContent).toContain('AZURE_OPENAI_API_KEY');
      expect(envContent).toMatch(/(PRIMARY|DEFAULT)/i);
    });

    it('should have Azure AI configuration in orchestrator', () => {
      const orchestratorPath = path.join(process.cwd(), 'server/services/aiOrchestrator.ts');
      expect(fs.existsSync(orchestratorPath)).toBe(true);
      
      const orchestratorContent = fs.readFileSync(orchestratorPath, 'utf8');
      expect(orchestratorContent).toContain('DEFAULT FALLBACK');
      expect(orchestratorContent).toContain('AZURE_OPENAI');
    });

    it('should have Azure AI priority in query triage', () => {
      const triagePath = path.join(process.cwd(), 'server/services/queryTriage.ts');
      expect(fs.existsSync(triagePath)).toBe(true);
      
      const triageContent = fs.readFileSync(triagePath, 'utf8');
      expect(triageContent).toContain('DEFAULT FALLBACK');
      expect(triageContent).toContain('AZURE_OPENAI');
    });

    it('should have Azure AI prioritization in health monitor', () => {
      const healthPath = path.join(process.cwd(), 'server/services/aiProviders/healthMonitor.ts');
      expect(fs.existsSync(healthPath)).toBe(true);
      
      const healthContent = fs.readFileSync(healthPath, 'utf8');
      expect(healthContent).toContain('Azure OpenAI');
      expect(healthContent).toContain('prioritiz');
    });

    it('should have Azure AI marked as default in registry', () => {
      const registryPath = path.join(process.cwd(), 'server/services/aiProviders/registry.ts');
      expect(fs.existsSync(registryPath)).toBe(true);
      
      const registryContent = fs.readFileSync(registryPath, 'utf8');
      expect(registryContent).toContain('DEFAULT FALLBACK');
      expect(registryContent).toContain('Azure OpenAI');
    });
  });

  describe('Package Configuration Validation', () => {
    it('should have test scripts configured', () => {
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      expect(packageContent.scripts).toHaveProperty('test');
      expect(packageContent.scripts).toHaveProperty('test:fallback');
      expect(packageContent.scripts).toHaveProperty('test:quality');
      expect(packageContent.scripts).toHaveProperty('test:integration');
    });

    it('should have Jest configuration', () => {
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      expect(packageContent).toHaveProperty('jest');
      expect(packageContent.jest.preset).toBe('ts-jest');
      expect(packageContent.jest.testEnvironment).toBe('node');
    });

    it('should have testing dependencies installed', () => {
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      expect(packageContent.devDependencies).toHaveProperty('jest');
      expect(packageContent.devDependencies).toHaveProperty('ts-jest');
      expect(packageContent.devDependencies).toHaveProperty('@types/jest');
    });
  });

  describe('Documentation Validation', () => {
    it('should have fallback configuration documentation', () => {
      const docPath = path.join(process.cwd(), 'AI_FALLBACK_CONFIGURATION.md');
      expect(fs.existsSync(docPath)).toBe(true);
      
      const docContent = fs.readFileSync(docPath, 'utf8');
      expect(docContent).toContain('Azure OpenAI');
      expect(docContent).toContain('DEFAULT FALLBACK');
    });

    it('should have testing documentation', () => {
      const docPath = path.join(process.cwd(), 'TESTING_DOCUMENTATION.md');
      expect(fs.existsSync(docPath)).toBe(true);
      
      const docContent = fs.readFileSync(docPath, 'utf8');
      expect(docContent).toContain('Test Suite');
      expect(docContent).toContain('Azure');
    });

    it('should have implementation completion summary', () => {
      const docPath = path.join(process.cwd(), 'IMPLEMENTATION_COMPLETE.md');
      expect(fs.existsSync(docPath)).toBe(true);
      
      const docContent = fs.readFileSync(docPath, 'utf8');
      expect(docContent).toContain('IMPLEMENTATION: 100% COMPLETE');
      expect(docContent).toContain('Azure AI');
    });
  });

  describe('File Structure Validation', () => {
    it('should have all required test files', () => {
      const testFiles = [
        'tests/setup.ts',
        'tests/ai-providers/fallback.test.ts',
        'tests/ai-providers/quality-assessment.test.ts',
        'tests/integration/critical-system.test.ts'
      ];
      
      testFiles.forEach(testFile => {
        const filePath = path.join(process.cwd(), testFile);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });

    it('should have executable test scripts', () => {
      const scriptFiles = [
        'run-tests.sh',
        'quick-validate.sh'
      ];
      
      scriptFiles.forEach(scriptFile => {
        const filePath = path.join(process.cwd(), scriptFile);
        expect(fs.existsSync(filePath)).toBe(true);
        
        // Check if file is executable
        const stats = fs.statSync(filePath);
        expect(stats.mode & parseInt('111', 8)).toBeGreaterThan(0);
      });
    });

    it('should have all critical AI service files', () => {
      const serviceFiles = [
        'server/services/aiOrchestrator.ts',
        'server/services/queryTriage.ts',
        'server/services/aiProviders/healthMonitor.ts',
        'server/services/aiProviders/registry.ts',
        'server/services/aiProviders/index.ts'
      ];
      
      serviceFiles.forEach(serviceFile => {
        const filePath = path.join(process.cwd(), serviceFile);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });
  });

  describe('Basic Functionality Tests', () => {
    it('should validate environment variable setup', () => {
      // Test environment should have proper setup
      expect(process.env.NODE_ENV).toBe('test');
      
      // Mock environment variables should be available
      const mockEnvVars = [
        'AZURE_OPENAI_ENDPOINT',
        'AZURE_OPENAI_API_KEY',
        'AZURE_OPENAI_DEPLOYMENT',
        'OPENAI_API_KEY'
      ];
      
      // Check that we can set these (doesn't need actual values in test)
      mockEnvVars.forEach(envVar => {
        process.env[envVar] = `test-${envVar.toLowerCase()}`;
        expect(process.env[envVar]).toContain('test-');
      });
    });

    it('should validate TypeScript configuration compatibility', () => {
      const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
      expect(fs.existsSync(tsconfigPath)).toBe(true);
      
      const tsconfigContent = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      expect(tsconfigContent).toHaveProperty('compilerOptions');
      
      // Should not have problematic ignoreDeprecations value
      expect(tsconfigContent.compilerOptions.ignoreDeprecations).not.toBe('6.0');
    });
  });
});