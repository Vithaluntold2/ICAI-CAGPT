import { Route, Switch } from 'wouter';
import SuperAdminLayout from './components/SuperAdminLayout';
import { ProtectedRoute } from './components/ProtectedRoute';

// Landing & Auth Pages
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Chat from './pages/Chat';
import SharedConversation from './pages/SharedConversation';

// Static/Info Pages
import Features from './pages/Features';
import Docs from './pages/Docs';
import Blog from './pages/Blog';
import API from './pages/API';
import UserIntegrations from './pages/Integrations';
import Support from './pages/Support';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
import VoiceCreditsSettings from './pages/VoiceCreditsSettings';
import SearchPage from './pages/Search';

// Professional Features Pages
import ScenarioSimulator from './pages/ScenarioSimulator';
import DeliverableComposer from './pages/DeliverableComposer';
import ForensicIntelligence from './pages/ForensicIntelligence';
import Roundtable from './pages/Roundtable';

// SuperAdmin Pages
import SuperAdminDashboard from './pages/superadmin/Dashboard';
import SystemHealthPage from './pages/admin/SystemMonitoring'; // Using SystemMonitoring as health page
import SecurityThreats from './pages/superadmin/SecurityThreats';
import Deployments from './pages/superadmin/Deployments';
import Maintenance from './pages/superadmin/Maintenance';
import Alerts from './pages/superadmin/Alerts';
import Performance from './pages/superadmin/Performance';
import Integrations from './pages/superadmin/Integrations';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import Users from './pages/admin/Users';
import Subscriptions from './pages/admin/Subscriptions';
import Coupons from './pages/admin/Coupons';
import TrainingDataDashboard from './pages/admin/TrainingDataDashboard';

function App() {
  return (
    <Switch>
      {/* SuperAdmin Routes */}
      <Route path="/superadmin">
        <ProtectedRoute requireAdmin>
          <SuperAdminLayout>
            <SuperAdminDashboard />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/health">
        <ProtectedRoute requireAdmin>
          <SuperAdminLayout>
            <SystemHealthPage />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/threats">
        <ProtectedRoute requireAdmin>
          <SuperAdminLayout>
            <SecurityThreats />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/deployments">
        <ProtectedRoute requireAdmin>
          <SuperAdminLayout>
            <Deployments />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/maintenance">
        <ProtectedRoute requireAdmin>
          <SuperAdminLayout>
            <Maintenance />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/alerts">
        <ProtectedRoute requireAdmin>
          <SuperAdminLayout>
            <Alerts />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/performance">
        <ProtectedRoute requireAdmin>
          <SuperAdminLayout>
            <Performance />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/integrations">
        <ProtectedRoute requireAdmin>
          <SuperAdminLayout>
            <Integrations />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>
      
      
      
      

      {/* Admin Routes */}
      <Route path="/admin">
        <ProtectedRoute requireAdmin>
          <AdminDashboard />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/users">
        <ProtectedRoute requireAdmin>
          <Users />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/subscriptions">
        <ProtectedRoute requireAdmin>
          <Subscriptions />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/coupons">
        <ProtectedRoute requireAdmin>
          <Coupons />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/training-data">
        <ProtectedRoute requireAdmin>
          <TrainingDataDashboard />
        </ProtectedRoute>
      </Route>

      

      

      {/* CA GPT Search — AI-powered search engine */}
      <Route path="/search">
        <ProtectedRoute>
          <SearchPage />
        </ProtectedRoute>
      </Route>

      {/* Auth Route */}
      <Route path="/auth">
        <Auth />
      </Route>

      {/* Shared Conversation Route - Public access */}
      <Route path="/shared/:token">
        <SharedConversation />
      </Route>

      {/* Chat Route - Main app after login */}
      <Route path="/chat">
        <ProtectedRoute>
          <Chat />
        </ProtectedRoute>
      </Route>
      
      {/* Professional Features Routes */}
      <Route path="/scenarios">
        <ProtectedRoute>
          <ScenarioSimulator />
        </ProtectedRoute>
      </Route>
      
      <Route path="/deliverables">
        <ProtectedRoute>
          <DeliverableComposer />
        </ProtectedRoute>
      </Route>
      
      <Route path="/forensics">
        <ProtectedRoute>
          <ForensicIntelligence />
        </ProtectedRoute>
      </Route>
      
      <Route path="/roundtable">
        <ProtectedRoute>
          <Roundtable />
        </ProtectedRoute>
      </Route>

      {/* Static/Info Pages */}
      <Route path="/features">
        <Features />
      </Route>
      
      <Route path="/docs">
        <Docs />
      </Route>
      
      <Route path="/blog">
        <Blog />
      </Route>
      
      <Route path="/api">
        <API />
      </Route>
      
      <Route path="/integrations">
        <UserIntegrations />
      </Route>
      
      <Route path="/support">
        <Support />
      </Route>

      
      <Route path="/settings">
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      </Route>
      
      <Route path="/settings/voice-credits">
        <ProtectedRoute>
          <VoiceCreditsSettings />
        </ProtectedRoute>
      </Route>
      
      <Route path="/analytics">
        <ProtectedRoute>
          <Analytics />
        </ProtectedRoute>
      </Route>

      {/* Default Route - Landing Page */}
      <Route path="/">
        <Landing />
      </Route>
    </Switch>
  );
}

export default App;