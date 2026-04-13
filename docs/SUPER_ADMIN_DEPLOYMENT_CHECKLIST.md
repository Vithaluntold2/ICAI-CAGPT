# Super Admin Deployment Checklist

## 🚨 CRITICAL - Must Complete Before Deployment

### 1. Database Migration (REQUIRED)
- [ ] **Fix database connection** (currently failing with ENOTFOUND)
- [ ] **Run migration**: `npm run db:push`
- [ ] **Verify new tables exist**:
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_name IN ('system_alerts', 'maintenance_tasks', 'ai_provider_costs');
  ```
- [ ] **Verify schema changes**:
  ```sql
  -- Check isSuperAdmin column exists
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'users' AND column_name = 'is_super_admin';
  
  -- Check modelRoutingLogs has cost fields
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'model_routing_logs' AND column_name IN ('tokens_used', 'cost_usd');
  ```

### 2. Create Super Admin Users (REQUIRED)
```sql
-- Set existing admin as super admin
UPDATE users 
SET "isSuperAdmin" = true 
WHERE email = 'your-admin@email.com';

-- Verify
SELECT id, email, "isAdmin", "isSuperAdmin" 
FROM users 
WHERE "isSuperAdmin" = true;
```

### 3. Remove Old Environment Variable (OPTIONAL)
```bash
# Remove SUPER_ADMIN_EMAILS from .env (no longer used)
# New auth uses database isSuperAdmin flag
```

---

## ⚠️ Known Limitations (Document for Users)

### AI Cost Tracking
- **Token Breakdown Estimation**: If provider doesn't return detailed breakdown, uses 70/30 split (prompt/completion)
- **Pricing Staleness**: Hardcoded pricing as of 2024 - will need manual updates when providers change rates
- **Anonymous Users**: Costs for non-authenticated requests are not logged (by design)
- **Blocking vs Async**: Currently uses `setImmediate()` - consider Bull/BullMQ for high-volume production

### System Alerts
- **No Alert Generation**: Tables exist but no services generate alerts yet
- **Manual Creation Only**: Alerts must be created via API or SQL until automated triggers are added

### Maintenance Tasks
- **No Scheduler**: Tasks can be created but won't auto-execute until scheduler is implemented
- **Manual Execution**: Use `/api/admin/system/maintenance/:id/execute` endpoint

---

## 🧪 Testing Checklist

### Authentication
- [ ] Regular user **cannot** access `/api/superadmin/*` (403 Forbidden)
- [ ] Regular admin **cannot** access `/api/superadmin/*` (403 Forbidden)
- [ ] Super admin **can** access `/api/superadmin/*` (200 OK)
- [ ] Non-authenticated **cannot** access (401 Unauthorized)

### AI Cost Tracking
```bash
# Test cost logging
curl -X POST http://localhost:5000/api/conversations \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -d '{"message": "What is tax?"}'

# Verify cost logged
SELECT * FROM ai_provider_costs ORDER BY created_at DESC LIMIT 1;
```

### System Alerts
```bash
# Create test alert
curl -X POST http://localhost:5000/api/superadmin/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "type": "warning",
    "severity": "medium",
    "source": "system",
    "message": "Test alert"
  }'

# Retrieve alerts
curl http://localhost:5000/api/admin/system/alerts
```

### Maintenance Tasks
```bash
# Create task
curl -X POST http://localhost:5000/api/superadmin/maintenance \
  -d '{
    "name": "Test Task",
    "taskType": "manual",
    "status": "scheduled"
  }'

# Execute task
curl -X POST http://localhost:5000/api/admin/system/maintenance/TASK_ID/execute
```

### AI Cost Endpoint
```bash
# Get all costs (last 30 days)
curl http://localhost:5000/api/superadmin/ai-costs

# Filter by date
curl "http://localhost:5000/api/superadmin/ai-costs?startDate=2026-01-01&endDate=2026-01-31"

# Filter by provider
curl "http://localhost:5000/api/superadmin/ai-costs?provider=openai"
```

---

## 📊 Monitoring After Deployment

### Database Growth
```sql
-- Monitor aiProviderCosts table size
SELECT 
  COUNT(*) as total_records,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record,
  pg_size_pretty(pg_total_relation_size('ai_provider_costs')) as table_size
FROM ai_provider_costs;

-- Daily cost totals
SELECT 
  DATE(date) as day,
  SUM(cost_usd) / 100.0 as total_cost_usd,
  COUNT(*) as request_count
FROM ai_provider_costs
WHERE date >= NOW() - INTERVAL '7 days'
GROUP BY DATE(date)
ORDER BY day DESC;
```

### Alert Volume
```sql
SELECT 
  severity,
  acknowledged,
  COUNT(*) as count
FROM system_alerts
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY severity, acknowledged;
```

### Performance Impact
- Monitor API response times before/after cost logging
- Check if cost logging errors spike (database issues)
- Verify `setImmediate()` doesn't cause memory leaks under load

---

## 🔧 Rollback Plan

If issues occur after deployment:

### Disable Cost Logging
```typescript
// In aiOrchestrator.ts, comment out cost logging:
// if (userId && aiResponse.tokensUsed > 0 && ...) { ... }
```

### Disable Super Admin Routes
```typescript
// In routes.ts, add middleware to block:
app.use('/api/superadmin/*', (req, res) => {
  res.status(503).json({ error: 'Super admin features temporarily disabled' });
});
```

### Database Rollback
```sql
-- If needed, drop new tables (data loss!)
DROP TABLE IF EXISTS ai_provider_costs CASCADE;
DROP TABLE IF EXISTS maintenance_tasks CASCADE;
DROP TABLE IF EXISTS system_alerts CASCADE;

-- Remove new columns
ALTER TABLE users DROP COLUMN IF EXISTS "isSuperAdmin";
ALTER TABLE model_routing_logs DROP COLUMN IF EXISTS tokens_used;
ALTER TABLE model_routing_logs DROP COLUMN IF EXISTS cost_usd;
```

---

## 📝 Post-Deployment Tasks

### High Priority
- [ ] Implement async cost logging queue (Bull/BullMQ)
- [ ] Add budget thresholds and alerts
- [ ] Create frontend dashboard for AI costs
- [ ] Implement maintenance task scheduler

### Medium Priority
- [ ] Move pricing to database with versioning
- [ ] Add alert generation triggers in services
- [ ] Implement cost validation against actual bills
- [ ] Add CSRF protection to super admin routes

### Low Priority
- [ ] Historical cost recalculation with old pricing
- [ ] Cost prediction/forecasting
- [ ] Multi-currency support
- [ ] Export costs to accounting systems

---

## 🆘 Troubleshooting

### "Relation does not exist" Errors
**Cause**: Database migration not run
**Fix**: Run `npm run db:push`

### "Super admin access required" for Admin Users
**Cause**: User doesn't have `isSuperAdmin = true`
**Fix**: Run SQL to set flag or check middleware

### Cost Logging Not Working
**Check**:
1. Is `userId` being passed to `processQuery()`?
2. Are tokens > 0?
3. Is provider/model defined?
4. Check console for async errors (setImmediate logs)

### Costs Don't Match Bills
**Check**:
1. Verify pricing data is current
2. Check if provider changed token counting
3. Review token breakdown estimation logic
4. Compare total_tokens vs prompt+completion split

---

## ✅ Sign-Off

- [ ] Database migration completed successfully
- [ ] At least one super admin user created
- [ ] All tests passing
- [ ] Monitoring dashboards updated
- [ ] Team trained on new features
- [ ] Rollback plan reviewed and understood

**Deployed By**: _________________  
**Date**: _________________  
**Verified By**: _________________  
**Notes**: _________________
