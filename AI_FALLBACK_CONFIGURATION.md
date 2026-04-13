# AI Provider Fallback Configuration

## Default Fallback Hierarchy

**ICAI CAGPT is configured with Azure OpenAI as the default fallback provider.**

### Provider Priority Order

1. **Primary Provider** (based on query classification)
   - Chosen dynamically based on query type, complexity, and requirements
   - Examples: Claude for complex reasoning, Perplexity for research, Gemini for simple queries

2. **Secondary Fallbacks** (health-based routing)
   - Additional providers based on availability and health scores
   - Filtered by provider health monitoring system

3. **🔄 Azure OpenAI (DEFAULT FALLBACK)**
   - **Always included** in the fallback chain
   - **Prioritized** when multiple healthy providers are available
   - Acts as the ultimate fallback when all other providers fail

4. **OpenAI (Secondary Fallback)**
   - Included as additional fallback option
   - Lower priority than Azure OpenAI

### Configuration

#### Environment Variables
```env
# Azure OpenAI (PRIMARY/DEFAULT PROVIDER)
AZURE_OPENAI_ENDPOINT=your-resource-name.openai.azure.com
AZURE_OPENAI_API_KEY=your-azure-openai-api-key-here
AZURE_OPENAI_DEPLOYMENT=gpt-4o

# OpenAI (Secondary Fallback)
OPENAI_API_KEY=your-openai-api-key-here
```

### How It Works

1. **Query Classification**: System analyzes the user query and selects optimal primary provider
2. **Health Filtering**: Unhealthy providers are filtered out based on recent failures
3. **Intelligent Routing**: Providers are tried in health-optimized order
4. **Azure AI Guarantee**: If any provider fails, Azure OpenAI is guaranteed to be tried
5. **Graceful Degradation**: System provides user-friendly error messages if all providers fail

### Benefits

- **Reliability**: Azure OpenAI provides enterprise-grade availability
- **Cost Optimization**: Different providers used based on query complexity
- **Performance**: Health monitoring ensures fastest available provider is used
- **Redundancy**: Multiple fallback layers prevent service interruptions

### Monitoring

The system tracks:
- Provider health scores (0-100)
- Success/failure rates
- Response times
- Rate limit status
- Quota usage

### Error Handling

When providers fail:
- Automatic failover to next healthy provider
- Azure OpenAI prioritized in fallback chain
- Detailed error logging and health tracking
- User-friendly error messages for quota/auth issues

---

**Key Takeaway**: No matter what happens with other AI providers, Azure OpenAI will always be attempted as the default fallback, ensuring maximum reliability for your ICAI CAGPT deployment.