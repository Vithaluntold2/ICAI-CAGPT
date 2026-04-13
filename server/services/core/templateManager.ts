/**
 * Template Management Service
 * Manages reusable templates for queries, documents, and workflows
 */

import { EventEmitter } from 'events';
import type { ProfessionalMode } from '../../../shared/types/agentTypes';

export interface Template {
  id: string;
  name: string;
  description: string;
  mode: ProfessionalMode;
  category: TemplateCategory;
  
  // Template content
  content: {
    prompt?: string;
    variables: TemplateVariable[];
    structure?: any; // For document templates
    workflow?: any; // For workflow templates
  };
  
  // Metadata
  metadata: {
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    version: string;
    isPublic: boolean;
    tags: string[];
    usageCount: number;
  };
}

export type TemplateCategory = 
  | 'query'
  | 'document'
  | 'workflow'
  | 'report'
  | 'analysis'
  | 'calculation';

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
  };
}

export interface RenderedTemplate {
  templateId: string;
  content: any;
  variables: Record<string, any>;
  timestamp: Date;
}

/**
 * Template Manager
 * Central service for managing and rendering templates
 */
export class TemplateManager extends EventEmitter {
  private templates: Map<string, Template> = new Map();
  private templatesByMode: Map<ProfessionalMode, Set<string>> = new Map();
  private templatesByCategory: Map<TemplateCategory, Set<string>> = new Map();

  constructor() {
    super();
    this.initializeDefaultTemplates();
  }

  /**
   * Initialize default templates for each professional mode
   */
  private initializeDefaultTemplates(): void {
    const defaultTemplates: Omit<Template, 'id' | 'metadata'>[] = [
      // Deep Research Templates
      {
        name: 'Tax Law Research',
        description: 'Template for researching specific tax laws and regulations',
        mode: 'deep-research',
        category: 'query',
        content: {
          prompt: 'Research {{jurisdiction}} tax law regarding {{topic}}. Focus on {{aspects}}. Consider recent updates since {{year}}.',
          variables: [
            { name: 'jurisdiction', type: 'string', description: 'Tax jurisdiction (e.g., India, US, UK)', required: true },
            { name: 'topic', type: 'string', description: 'Specific tax topic to research', required: true },
            { name: 'aspects', type: 'string', description: 'Specific aspects to focus on', required: false, defaultValue: 'compliance requirements and penalties' },
            { name: 'year', type: 'number', description: 'Year to consider updates from', required: false, defaultValue: new Date().getFullYear() - 1 },
          ],
        },
      },
      // Financial Calculation Templates
      {
        name: 'NPV Calculation',
        description: 'Net Present Value calculation template',
        mode: 'financial-calculation',
        category: 'calculation',
        content: {
          prompt: 'Calculate NPV for project {{projectName}} with discount rate {{discountRate}}% and cash flows: {{cashFlows}}',
          variables: [
            { name: 'projectName', type: 'string', description: 'Name of the project', required: true },
            { name: 'discountRate', type: 'number', description: 'Discount rate percentage', required: true },
            { name: 'cashFlows', type: 'array', description: 'Array of annual cash flows', required: true },
          ],
        },
      },
      // Audit Planning Templates
      {
        name: 'Risk Assessment Template',
        description: 'Template for initial audit risk assessment',
        mode: 'audit-planning',
        category: 'analysis',
        content: {
          prompt: 'Conduct risk assessment for {{clientName}} in {{industry}} sector. Focus on {{riskAreas}}.',
          variables: [
            { name: 'clientName', type: 'string', description: 'Client organization name', required: true },
            { name: 'industry', type: 'string', description: 'Industry sector', required: true },
            { name: 'riskAreas', type: 'string', description: 'Specific risk areas to assess', required: false, defaultValue: 'financial reporting, compliance, operations' },
          ],
        },
      },
      // Deliverable Composer Templates
      {
        name: 'Audit Report Template',
        description: 'Standard audit report structure',
        mode: 'deliverable-composer',
        category: 'document',
        content: {
          variables: [
            { name: 'clientName', type: 'string', description: 'Client name', required: true },
            { name: 'auditPeriod', type: 'string', description: 'Period covered by audit', required: true },
            { name: 'findings', type: 'array', description: 'Audit findings', required: true },
            { name: 'recommendations', type: 'array', description: 'Recommendations', required: true },
          ],
          structure: {
            sections: [
              { title: 'Executive Summary', order: 1 },
              { title: 'Scope and Objectives', order: 2 },
              { title: 'Methodology', order: 3 },
              { title: 'Findings', order: 4 },
              { title: 'Recommendations', order: 5 },
              { title: 'Conclusion', order: 6 },
            ],
          },
        },
      },
      // Scenario Simulator Templates
      {
        name: 'Tax Strategy Scenario',
        description: 'Template for tax strategy scenario analysis',
        mode: 'scenario-simulator',
        category: 'analysis',
        content: {
          prompt: 'Simulate tax impact of {{strategyName}} for {{entityType}} with revenue {{revenue}} and expenses {{expenses}}.',
          variables: [
            { name: 'strategyName', type: 'string', description: 'Name of tax strategy', required: true },
            { name: 'entityType', type: 'string', description: 'Type of business entity', required: true },
            { name: 'revenue', type: 'number', description: 'Annual revenue', required: true },
            { name: 'expenses', type: 'number', description: 'Annual expenses', required: true },
          ],
        },
      },
    ];

    defaultTemplates.forEach(template => {
      this.createTemplate(template, 'system');
    });

    console.log(`[TemplateManager] Initialized ${defaultTemplates.length} default templates`);
  }

  /**
   * Create a new template
   */
  createTemplate(
    template: Omit<Template, 'id' | 'metadata'>,
    userId: string
  ): Template {
    const fullTemplate: Template = {
      ...template,
      id: `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0',
        isPublic: false,
        tags: [],
        usageCount: 0,
      },
    };

    this.templates.set(fullTemplate.id, fullTemplate);

    // Index by mode
    if (!this.templatesByMode.has(fullTemplate.mode)) {
      this.templatesByMode.set(fullTemplate.mode, new Set());
    }
    this.templatesByMode.get(fullTemplate.mode)!.add(fullTemplate.id);

    // Index by category
    if (!this.templatesByCategory.has(fullTemplate.category)) {
      this.templatesByCategory.set(fullTemplate.category, new Set());
    }
    this.templatesByCategory.get(fullTemplate.category)!.add(fullTemplate.id);

    this.emit('template:created', fullTemplate);
    console.log(`[TemplateManager] Created template: ${fullTemplate.name}`);

    return fullTemplate;
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): Template | null {
    return this.templates.get(templateId) || null;
  }

  /**
   * Get templates by mode
   */
  getTemplatesByMode(mode: ProfessionalMode): Template[] {
    const templateIds = this.templatesByMode.get(mode);
    if (!templateIds) return [];

    return Array.from(templateIds)
      .map(id => this.templates.get(id))
      .filter((t): t is Template => t !== undefined);
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: TemplateCategory): Template[] {
    const templateIds = this.templatesByCategory.get(category);
    if (!templateIds) return [];

    return Array.from(templateIds)
      .map(id => this.templates.get(id))
      .filter((t): t is Template => t !== undefined);
  }

  /**
   * Search templates
   */
  searchTemplates(query: {
    mode?: ProfessionalMode;
    category?: TemplateCategory;
    tags?: string[];
    searchText?: string;
  }): Template[] {
    let results = Array.from(this.templates.values());

    // Filter by mode
    if (query.mode) {
      results = results.filter(t => t.mode === query.mode);
    }

    // Filter by category
    if (query.category) {
      results = results.filter(t => t.category === query.category);
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter(t =>
        query.tags!.some(tag => t.metadata.tags.includes(tag))
      );
    }

    // Filter by search text
    if (query.searchText) {
      const searchLower = query.searchText.toLowerCase();
      results = results.filter(t =>
        t.name.toLowerCase().includes(searchLower) ||
        t.description.toLowerCase().includes(searchLower)
      );
    }

    return results;
  }

  /**
   * Render template with variables
   */
  renderTemplate(
    templateId: string,
    variables: Record<string, any>
  ): RenderedTemplate | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    // Validate variables
    const validation = this.validateVariables(template, variables);
    if (!validation.valid) {
      throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
    }

    // Increment usage count
    template.metadata.usageCount++;

    // Render content
    let rendered: any;

    if (template.content.prompt) {
      // Render prompt template
      rendered = this.renderPrompt(template.content.prompt, variables);
    } else if (template.content.structure) {
      // Render document structure
      rendered = this.renderStructure(template.content.structure, variables);
    } else if (template.content.workflow) {
      // Render workflow
      rendered = { ...template.content.workflow, variables };
    }

    const result: RenderedTemplate = {
      templateId,
      content: rendered,
      variables,
      timestamp: new Date(),
    };

    this.emit('template:rendered', result);
    return result;
  }

  /**
   * Render prompt with variable substitution
   */
  private renderPrompt(prompt: string, variables: Record<string, any>): string {
    let rendered = prompt;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return rendered;
  }

  /**
   * Render document structure
   */
  private renderStructure(structure: any, variables: Record<string, any>): any {
    return {
      ...structure,
      variables,
    };
  }

  /**
   * Validate template variables
   */
  private validateVariables(
    template: Template,
    variables: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const varDef of template.content.variables) {
      const value = variables[varDef.name];

      // Check required
      if (varDef.required && (value === undefined || value === null)) {
        errors.push(`Required variable '${varDef.name}' is missing`);
        continue;
      }

      if (value === undefined || value === null) continue;

      // Check type
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== varDef.type) {
        errors.push(`Variable '${varDef.name}' has wrong type (expected ${varDef.type}, got ${actualType})`);
      }

      // Check validation rules
      if (varDef.validation) {
        if (varDef.validation.min !== undefined && value < varDef.validation.min) {
          errors.push(`Variable '${varDef.name}' is below minimum (${varDef.validation.min})`);
        }
        if (varDef.validation.max !== undefined && value > varDef.validation.max) {
          errors.push(`Variable '${varDef.name}' exceeds maximum (${varDef.validation.max})`);
        }
        if (varDef.validation.enum && !varDef.validation.enum.includes(value)) {
          errors.push(`Variable '${varDef.name}' must be one of: ${varDef.validation.enum.join(', ')}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Update template
   */
  updateTemplate(
    templateId: string,
    updates: Partial<Omit<Template, 'id' | 'metadata'>>
  ): Template | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    Object.assign(template, updates);
    template.metadata.updatedAt = new Date();

    this.emit('template:updated', template);
    return template;
  }

  /**
   * Delete template
   */
  deleteTemplate(templateId: string): boolean {
    const template = this.templates.get(templateId);
    if (!template) return false;

    this.templates.delete(templateId);
    this.templatesByMode.get(template.mode)?.delete(templateId);
    this.templatesByCategory.get(template.category)?.delete(templateId);

    this.emit('template:deleted', templateId);
    return true;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const templates = Array.from(this.templates.values());

    return {
      totalTemplates: templates.length,
      templatesByMode: Object.fromEntries(
        Array.from(this.templatesByMode.entries()).map(([mode, ids]) => [mode, ids.size])
      ),
      templatesByCategory: Object.fromEntries(
        Array.from(this.templatesByCategory.entries()).map(([cat, ids]) => [cat, ids.size])
      ),
      totalUsage: templates.reduce((sum, t) => sum + t.metadata.usageCount, 0),
      mostUsed: templates.sort((a, b) => 
        b.metadata.usageCount - a.metadata.usageCount
      ).slice(0, 5).map(t => ({ name: t.name, usageCount: t.metadata.usageCount })),
    };
  }
}

// Singleton instance
export const templateManager = new TemplateManager();
