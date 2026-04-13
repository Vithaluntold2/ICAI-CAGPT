import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'not_configured';
  message?: string;
}

router.get('/health/azure', async (req: Request, res: Response) => {
  const results: HealthCheckResult[] = [];

  // Check Azure OpenAI
  const azureOpenAIKey = process.env.AZURE_OPENAI_API_KEY;
  const azureOpenAIEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureOpenAIDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  
  if (azureOpenAIKey && azureOpenAIEndpoint && azureOpenAIDeployment) {
    try {
      const response = await fetch(
        `${azureOpenAIEndpoint}openai/deployments/${azureOpenAIDeployment}/chat/completions?api-version=2024-08-01-preview`,
        {
          method: 'POST',
          headers: {
            'api-key': azureOpenAIKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5,
          }),
        }
      );
      
      if (response.ok) {
        results.push({
          service: 'Azure OpenAI',
          status: 'healthy',
          message: `Deployment: ${azureOpenAIDeployment}`,
        });
      } else {
        results.push({
          service: 'Azure OpenAI',
          status: 'unhealthy',
          message: `HTTP ${response.status}: ${response.statusText}`,
        });
      }
    } catch (error: any) {
      results.push({
        service: 'Azure OpenAI',
        status: 'unhealthy',
        message: error.message,
      });
    }
  } else {
    results.push({
      service: 'Azure OpenAI',
      status: 'not_configured',
      message: 'Missing credentials',
    });
  }

  // Check Azure Document Intelligence
  const azureDocIntelKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  const azureDocIntelEndpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  
  if (azureDocIntelKey && azureDocIntelEndpoint) {
    try {
      // Simple endpoint check - just verify the service is reachable
      const response = await fetch(`${azureDocIntelEndpoint}formrecognizer/info?api-version=2023-07-31`, {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': azureDocIntelKey,
        },
      });
      
      if (response.ok || response.status === 404) {
        // 404 is also acceptable - means service is reachable but endpoint might be different
        results.push({
          service: 'Azure Document Intelligence',
          status: 'healthy',
          message: 'Service reachable',
        });
      } else {
        results.push({
          service: 'Azure Document Intelligence',
          status: 'unhealthy',
          message: `HTTP ${response.status}`,
        });
      }
    } catch (error: any) {
      results.push({
        service: 'Azure Document Intelligence',
        status: 'unhealthy',
        message: error.message,
      });
    }
  } else {
    results.push({
      service: 'Azure Document Intelligence',
      status: 'not_configured',
      message: 'Missing credentials',
    });
  }

  // Check Azure Key Vault
  const azureKeyVaultUrl = process.env.AZURE_KEYVAULT_URL;
  const azureClientId = process.env.AZURE_CLIENT_ID;
  const azureTenantId = process.env.AZURE_TENANT_ID;
  
  if (azureKeyVaultUrl && azureClientId && azureTenantId) {
    results.push({
      service: 'Azure Key Vault',
      status: 'healthy',
      message: 'Credentials configured',
    });
  } else {
    results.push({
      service: 'Azure Key Vault',
      status: 'not_configured',
      message: 'Missing credentials',
    });
  }

  const allHealthy = results.every(r => r.status === 'healthy');
  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json({
    overall: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: results,
  });
});

export default router;
