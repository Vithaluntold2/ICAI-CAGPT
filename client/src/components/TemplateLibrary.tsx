/**
 * Template Library Component
 * Browse and select templates for different professional modes
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, FileText, Calculator, Workflow, CheckSquare, GitBranch, FileEdit, Eye, Plus, Upload } from 'lucide-react';
import { TemplateUpload } from './TemplateUpload';
import type { Template } from '../../../server/services/core/templateManager';

interface TemplateLibraryProps {
  onSelectTemplate?: (template: Template) => void;
  onCreateTemplate?: () => void;
  selectedMode?: string;
}

const modeIcons: Record<string, any> = {
  'deep-research': Search,
  'financial-calculation': Calculator,
  'workflow-visualization': Workflow,
  'audit-planning': CheckSquare,
  'scenario-simulator': GitBranch,
  'deliverable-composer': FileEdit,
  'forensic-intelligence': Eye,
};

const categoryColors: Record<string, string> = {
  query: 'bg-rai-100 text-rai-800',
  document: 'bg-green-100 text-green-800',
  workflow: 'bg-primary/15 text-primary',
  report: 'bg-orange-100 text-orange-800',
  analysis: 'bg-pink-100 text-pink-800',
  calculation: 'bg-rai-100 text-rai-800',
};

export function TemplateLibrary({ onSelectTemplate, onCreateTemplate, selectedMode }: TemplateLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const queryClient = useQueryClient();

  // Fetch templates
  const { data: templates, isLoading, refetch } = useQuery<Template[]>({
    queryKey: ['templates', selectedMode, selectedCategory, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedMode) params.append('mode', selectedMode);
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/templates?${params}`);
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
  });

  const handleUploadSuccess = () => {
    // Refresh templates list after successful upload
    refetch();
    queryClient.invalidateQueries({ queryKey: ['templates'] });
  };

  const filteredTemplates = templates || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Template Library</h2>
          <p className="text-muted-foreground">Browse and select reusable templates</p>
        </div>
        <div className="flex items-center gap-2">
          <TemplateUpload onUploadSuccess={handleUploadSuccess} />
          {onCreateTemplate && (
            <Button onClick={onCreateTemplate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="query">Query</TabsTrigger>
          <TabsTrigger value="document">Document</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="calculation">Calculation</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-3 bg-gray-200 rounded w-full" />
                    <div className="h-3 bg-gray-200 rounded w-5/6 mt-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No templates found</p>
                {onCreateTemplate && (
                  <Button onClick={onCreateTemplate} variant="outline" className="mt-4">
                    Create Your First Template
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => {
                const ModeIcon = modeIcons[template.mode] || FileText;
                
                return (
                  <Card 
                    key={template.id} 
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => onSelectTemplate?.(template)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <ModeIcon className="h-5 w-5 text-muted-foreground" />
                          <CardTitle className="text-base line-clamp-1">
                            {template.name}
                          </CardTitle>
                        </div>
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${categoryColors[template.category]}`}
                        >
                          {template.category}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2">
                        {template.description}
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      <div className="space-y-2">
                        {/* Variables count */}
                        <div className="text-sm text-muted-foreground">
                          {template.content.variables.length} variable{template.content.variables.length !== 1 ? 's' : ''}
                        </div>

                        {/* Metadata */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            v{template.metadata.version}
                          </Badge>
                          {template.metadata.isPublic && (
                            <Badge variant="outline" className="text-xs">
                              Public
                            </Badge>
                          )}
                          <span>{template.metadata.usageCount} uses</span>
                        </div>

                        {/* Tags */}
                        {template.metadata.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-2">
                            {template.metadata.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
