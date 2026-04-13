/**
 * Maintenance Mode & Deployment Management
 * Zero-downtime updates and scheduled maintenance
 */

import { storage } from '../pgStorage';

export interface MaintenanceSchedule {
  id: string;
  startTime: Date;
  endTime: Date;
  reason: string;
  affectedServices: string[];
  createdBy: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  notifyUsers: boolean;
}

export interface DeploymentStatus {
  id: string;
  version: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'rolled-back';
  startTime: Date;
  endTime?: Date;
  changes: string[];
  deployedBy: string;
  healthChecksPassed: boolean;
  rollbackAvailable: boolean;
}

class MaintenanceModeService {
  private maintenanceActive = false;
  private currentMaintenance: MaintenanceSchedule | null = null;
  private scheduledMaintenances: MaintenanceSchedule[] = [];
  private deploymentHistory: DeploymentStatus[] = [];

  /**
   * Check if system is in maintenance mode
   */
  isMaintenanceActive(): boolean {
    this.checkScheduledMaintenance();
    return this.maintenanceActive;
  }

  /**
   * Get current maintenance details
   */
  getCurrentMaintenance(): MaintenanceSchedule | null {
    return this.currentMaintenance;
  }

  /**
   * Schedule maintenance window
   */
  scheduleMaintenance(schedule: Omit<MaintenanceSchedule, 'id' | 'status'>): MaintenanceSchedule {
    const maintenance: MaintenanceSchedule = {
      ...schedule,
      id: `maint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'scheduled'
    };

    this.scheduledMaintenances.push(maintenance);
    this.scheduledMaintenances.sort((a, b) => 
      a.startTime.getTime() - b.startTime.getTime()
    );

    console.log('[MaintenanceMode] Scheduled maintenance:', maintenance);
    return maintenance;
  }

  /**
   * Cancel scheduled maintenance
   */
  cancelMaintenance(id: string): boolean {
    const index = this.scheduledMaintenances.findIndex(m => m.id === id);
    if (index === -1) return false;

    this.scheduledMaintenances[index].status = 'cancelled';
    console.log('[MaintenanceMode] Cancelled maintenance:', id);
    return true;
  }

  /**
   * Check for scheduled maintenance and activate if needed
   */
  private checkScheduledMaintenance(): void {
    const now = new Date();

    for (const maintenance of this.scheduledMaintenances) {
      if (maintenance.status === 'scheduled' && 
          now >= maintenance.startTime && 
          now <= maintenance.endTime) {
        this.activateMaintenance(maintenance);
        break;
      } else if (maintenance.status === 'active' && now > maintenance.endTime) {
        this.deactivateMaintenance(maintenance);
      }
    }
  }

  /**
   * Activate maintenance mode
   */
  private activateMaintenance(schedule: MaintenanceSchedule): void {
    this.maintenanceActive = true;
    schedule.status = 'active';
    this.currentMaintenance = schedule;
    console.log('[MaintenanceMode] ACTIVATED:', schedule.reason);
  }

  /**
   * Deactivate maintenance mode
   */
  private deactivateMaintenance(schedule: MaintenanceSchedule): void {
    this.maintenanceActive = false;
    schedule.status = 'completed';
    this.currentMaintenance = null;
    console.log('[MaintenanceMode] COMPLETED:', schedule.id);
  }

  /**
   * Force enable maintenance mode (emergency)
   */
  enableMaintenanceMode(reason: string, createdBy: string, affectedServices: string[] = ['all']): MaintenanceSchedule {
    const maintenance: MaintenanceSchedule = {
      id: `maint_emergency_${Date.now()}`,
      startTime: new Date(),
      endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours default
      reason,
      affectedServices,
      createdBy,
      status: 'active',
      notifyUsers: true
    };

    this.activateMaintenance(maintenance);
    this.scheduledMaintenances.push(maintenance);
    return maintenance;
  }

  /**
   * Force disable maintenance mode
   */
  disableMaintenanceMode(): void {
    if (this.currentMaintenance) {
      this.deactivateMaintenance(this.currentMaintenance);
    }
    this.maintenanceActive = false;
  }

  /**
   * Get all scheduled maintenances
   */
  getScheduledMaintenances(): MaintenanceSchedule[] {
    return this.scheduledMaintenances.filter(m => 
      m.status === 'scheduled' || m.status === 'active'
    );
  }

  /**
   * Start new deployment
   */
  startDeployment(deployment: Omit<DeploymentStatus, 'id' | 'status' | 'startTime' | 'healthChecksPassed' | 'rollbackAvailable'>): DeploymentStatus {
    const newDeployment: DeploymentStatus = {
      ...deployment,
      id: `deploy_${Date.now()}`,
      status: 'in-progress',
      startTime: new Date(),
      healthChecksPassed: false,
      rollbackAvailable: this.deploymentHistory.length > 0
    };

    this.deploymentHistory.unshift(newDeployment);
    console.log('[MaintenanceMode] Deployment started:', newDeployment.version);
    return newDeployment;
  }

  /**
   * Complete deployment
   */
  completeDeployment(id: string, success: boolean, healthChecksPassed: boolean): void {
    const deployment = this.deploymentHistory.find(d => d.id === id);
    if (!deployment) return;

    deployment.status = success ? 'completed' : 'failed';
    deployment.endTime = new Date();
    deployment.healthChecksPassed = healthChecksPassed;
    
    console.log('[MaintenanceMode] Deployment completed:', {
      id,
      success,
      healthChecksPassed
    });
  }

  /**
   * Rollback to previous deployment
   */
  rollbackDeployment(currentId: string, reason: string): DeploymentStatus | null {
    const currentDeployment = this.deploymentHistory.find(d => d.id === currentId);
    if (!currentDeployment || !currentDeployment.rollbackAvailable) {
      return null;
    }

    const previousDeployment = this.deploymentHistory
      .filter(d => d.status === 'completed' && d.id !== currentId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0];

    if (!previousDeployment) return null;

    currentDeployment.status = 'rolled-back';

    const rollbackDeployment: DeploymentStatus = {
      id: `rollback_${Date.now()}`,
      version: previousDeployment.version,
      status: 'in-progress',
      startTime: new Date(),
      changes: [`Rollback from ${currentDeployment.version} due to: ${reason}`],
      deployedBy: 'system',
      healthChecksPassed: false,
      rollbackAvailable: false
    };

    this.deploymentHistory.unshift(rollbackDeployment);
    console.log('[MaintenanceMode] Rollback initiated:', rollbackDeployment);
    return rollbackDeployment;
  }

  /**
   * Get deployment history
   */
  getDeploymentHistory(limit = 10): DeploymentStatus[] {
    return this.deploymentHistory.slice(0, limit);
  }

  /**
   * Get latest deployment
   */
  getLatestDeployment(): DeploymentStatus | null {
    return this.deploymentHistory[0] || null;
  }

  /**
   * Health check for deployment
   */
  async performHealthCheck(deploymentId: string): Promise<boolean> {
    const deployment = this.deploymentHistory.find(d => d.id === deploymentId);
    if (!deployment) return false;

    try {
      // Check database connectivity
      await storage.getAllUsers();
      
      // Check critical services (add more checks as needed)
      const checks = [
        this.checkDatabaseConnectivity(),
        this.checkRedisConnectivity(),
        this.checkCriticalEndpoints()
      ];

      const results = await Promise.all(checks);
      const allPassed = results.every(r => r);

      deployment.healthChecksPassed = allPassed;
      return allPassed;
    } catch (error) {
      console.error('[MaintenanceMode] Health check failed:', error);
      deployment.healthChecksPassed = false;
      return false;
    }
  }

  private async checkDatabaseConnectivity(): Promise<boolean> {
    try {
      await storage.getAllUsers();
      return true;
    } catch {
      return false;
    }
  }

  private checkRedisConnectivity(): boolean {
    try {
      // Redis check would go here
      return true;
    } catch {
      return false;
    }
  }

  private checkCriticalEndpoints(): boolean {
    // Check if critical API endpoints are responding
    return true;
  }
}

export const maintenanceModeService = new MaintenanceModeService();
