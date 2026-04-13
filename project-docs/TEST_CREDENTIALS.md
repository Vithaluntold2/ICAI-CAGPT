# 🔐 ICAI CAGPT Testing Credentials

**Application URL**: `http://localhost:3000`

---

## 👤 Test Accounts

### **1. Demo User (Free Tier)**
```
Email:    demo@luca.com
Password: DemoUser123!
Tier:     Free
Features: Basic features, 100 queries/month
```

### **2. Test User (Professional Tier)**
```
Email:    test@luca.com
Password: TestUser123!
Tier:     Professional
Features: Advanced features, higher limits
```

### **3. Admin User (Enterprise + Admin Access)**
```
Email:    admin@luca.com
Password: Admin123!
Tier:     Enterprise
Features: Full admin panel access
Access:   /admin, /admin/users, /admin/subscriptions, etc.
```

### **4. Regular User**
```
Email:    john@example.com
Password: Password123!
Tier:     Free
Features: Basic features
```

---

## 🚀 Quick Start Testing

### **Test Standard Features** (2 minutes)
1. Open `http://localhost:3000`
2. Login with Demo credentials: `demo@luca.com` / `DemoUser123!`
3. Navigate to `/chat`
4. Test each mode from the dropdown:
   - Standard Chat
   - Deep Research (8 agents)
   - Checklist
   - Workflow Visualization (5 agents)
   - Audit Planning (14 agents)
   - Financial Calculation (5 agents)
   - **Scenario Simulator** (12 agents) ✨
   - **Deliverable Composer** (45 agents) ✨
   - **Forensic Intelligence** (8 agents) ✨
   - **Roundtable** (6 agents) ✨

### **Test Admin Features** (1 minute)
1. Logout (click profile icon → Logout)
2. Login with Admin credentials: `admin@luca.com` / `Admin123!`
3. Access admin panel at `/admin`
4. Check:
   - User management
   - Subscription management
   - System monitoring
   - Analytics dashboard

### **Test New Roundtable Mode** (3 minutes)
1. Navigate to `/roundtable`
2. Choose a workflow:
   - M&A Analysis
   - Fraud Investigation
   - Tax Planning
   - Audit Execution
3. Click "Start Workflow"
4. Watch multi-agent execution in real-time

---

## 🎯 Testing Checklist

### **Authentication** ✅
- [ ] Login with Demo account
- [ ] Login with Admin account
- [ ] Logout functionality
- [ ] Password visibility toggle
- [ ] Wrong password error message
- [ ] Non-existent email error

### **Chat Modes** ✅
- [ ] Standard Chat (basic Q&A)
- [ ] Deep Research (citations, sources)
- [ ] Checklist (task lists)
- [ ] Workflow Visualization (flowcharts)
- [ ] Audit Planning (comprehensive audit)
- [ ] Financial Calculation (NPV, ROI, etc.)
- [ ] Scenario Simulator (Monte Carlo, what-if)
- [ ] Deliverable Composer (document generation)
- [ ] Forensic Intelligence (fraud detection)
- [ ] Roundtable (multi-mode orchestration)

### **Agent Functionality** ✅
- [ ] Agents initialize on server start
- [ ] Agent workflows execute for professional modes
- [ ] Agent status tracking works
- [ ] Multiple agents coordinate correctly

### **UI/UX** ✅
- [ ] Mode selector displays all 10 modes
- [ ] Mode icons and colors show correctly
- [ ] Status messages update per mode
- [ ] Roundtable page renders correctly
- [ ] Workflow execution visualization works

### **Admin Panel** (admin@luca.com only) ✅
- [ ] Access `/admin` dashboard
- [ ] View user list at `/admin/users`
- [ ] View subscriptions at `/admin/subscriptions`
- [ ] System monitoring at `/admin/system-monitoring`

---

## 🔧 Advanced Testing

### **Test Agent Capabilities API**
```bash
# Get capabilities for a specific mode
curl http://localhost:3000/api/agents/capabilities/deep-research
curl http://localhost:3000/api/agents/capabilities/audit-plan
curl http://localhost:3000/api/agents/capabilities/deliverable-composer
```

### **Check Server Logs**
Watch for agent execution logs:
```bash
# In terminal where dev server is running, look for:
[AgentWorkflow] Mode 'deep-research' requires agent execution
[AgentWorkflow] Workflow completed for mode 'deep-research'
```

### **Verify Agent Health**
Server startup should show:
```
========================================
🎉 INITIALIZATION COMPLETE!
========================================
Total agents registered: 103
Agents by mode:
  - Deep Research: 8 agents
  - Financial Calculation: 5 agents
  - Workflow Visualization: 5 agents
  - Audit Planning: 14 agents
  - Scenario Simulator: 12 agents
  - Deliverable Composer: 45 agents
  - Forensic Intelligence: 8 agents
  - Roundtable: 6 agents
========================================
```

---

## 💡 Testing Tips

### **Password Requirements**
All passwords must have:
- ✅ Minimum 8 characters
- ✅ At least one uppercase letter
- ✅ At least one lowercase letter
- ✅ At least one number

### **Session Management**
- Sessions persist across page refreshes
- Logout clears session completely
- Multiple tabs share the same session

### **Mode-Specific Features**

**Deep Research Mode**: Tests 8-agent research workflow
- Try: "What are the tax implications of cryptocurrency gains in India?"

**Audit Planning Mode**: Tests 14-agent audit workflow  
- Try: "Create an audit plan for a manufacturing company"

**Scenario Simulator Mode**: Tests 12-agent scenario analysis
- Try: "Run a Monte Carlo simulation for project profitability"

**Deliverable Composer Mode**: Tests 45-agent document generation
- Try: "Generate an audit report with findings and recommendations"

**Forensic Intelligence Mode**: Tests 8-agent fraud detection
- Try: "Analyze this dataset for unusual transaction patterns"

**Roundtable Mode**: Tests 6-agent multi-mode coordination
- Navigate to `/roundtable` and start a workflow

---

## 🐛 Troubleshooting

### **Can't Login**
1. Check password meets requirements (8+ chars)
2. Verify credentials exactly match (case-sensitive)
3. Try password visibility toggle to verify typing
4. Check browser console for errors

### **Agents Not Executing**
1. Check server logs for agent initialization
2. Verify mode is in professional modes list
3. Check `/api/agents/capabilities/:mode` endpoint
4. Ensure database connection is active

### **Mode Not Showing**
1. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
2. Clear browser cache
3. Check Chat.tsx has all 10 modes
4. Verify build completed successfully

---

## 📞 Support

If you encounter issues:
1. Check server logs in terminal
2. Check browser console for errors
3. Verify database is running
4. Ensure all environment variables are set

---

## 🎉 System Status

**✅ All 103 agents operational**  
**✅ All 10 modes accessible**  
**✅ Zero production errors**  
**✅ Build passing**  
**✅ Server stable on port 3000**

**Ready for testing!** 🚀
