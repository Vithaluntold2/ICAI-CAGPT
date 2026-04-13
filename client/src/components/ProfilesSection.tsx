import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users, Briefcase, User, Star, UserPlus } from "lucide-react";

interface Profile {
  id: string;
  name: string;
  type: 'business' | 'personal' | 'family';
  description?: string;
  isDefault: boolean;
  createdAt: string;
}

interface ProfileMember {
  id: string;
  profileId: string;
  name: string;
  email?: string;
  relationship?: string;
  role: string;
}

export default function ProfilesSection() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false);

  // Form states
  const [profileName, setProfileName] = useState("");
  const [profileType, setProfileType] = useState<'business' | 'personal' | 'family'>('business');
  const [profileDescription, setProfileDescription] = useState("");
  
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRelationship, setMemberRelationship] = useState<string>("");

  // Fetch profiles
  const { data: profilesData, isLoading } = useQuery<{ profiles: Profile[] }>({
    queryKey: ['/api/profiles'],
  });

  const profiles: Profile[] = profilesData?.profiles || [];

  // Fetch members for selected profile
  const { data: membersData } = useQuery<{ members: ProfileMember[] }>({
    queryKey: ['/api/profiles', selectedProfile?.id, 'members'],
    enabled: !!selectedProfile && selectedProfile.type === 'family',
  });

  const members: ProfileMember[] = membersData?.members || [];

  // Create profile mutation
  const createProfileMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; description?: string }) => {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create profile');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Created",
        description: "Your new profile has been created successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profiles'] });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    }
  });

  // Delete profile mutation
  const deleteProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete profile');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Deleted",
        description: "Profile has been deleted successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profiles'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    }
  });

  // Set default profile mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isDefault: true })
      });
      if (!res.ok) throw new Error('Failed to update profile');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Default Profile Updated",
        description: "Your default profile has been changed."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profiles'] });
    }
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async ({ profileId, data }: { profileId: string; data: any }) => {
      const res = await fetch(`/api/profiles/${profileId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to add member');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Member Added",
        description: "Family member has been added successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profiles', selectedProfile?.id, 'members'] });
      resetMemberForm();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    }
  });

  // Delete member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: async ({ profileId, memberId }: { profileId: string; memberId: string }) => {
      const res = await fetch(`/api/profiles/${profileId}/members/${memberId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to remove member');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Member Removed",
        description: "Family member has been removed successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profiles', selectedProfile?.id, 'members'] });
    }
  });

  const resetForm = () => {
    setProfileName("");
    setProfileType('business');
    setProfileDescription("");
  };

  const resetMemberForm = () => {
    setMemberName("");
    setMemberEmail("");
    setMemberRelationship("");
  };

  const handleCreateProfile = () => {
    if (!profileName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Profile name is required"
      });
      return;
    }

    createProfileMutation.mutate({
      name: profileName,
      type: profileType,
      description: profileDescription || undefined
    });
  };

  const handleDeleteProfile = (profileId: string) => {
    if (confirm("Are you sure you want to delete this profile?")) {
      deleteProfileMutation.mutate(profileId);
    }
  };

  const handleAddMember = () => {
    if (!memberName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Member name is required"
      });
      return;
    }

    if (!selectedProfile) return;

    addMemberMutation.mutate({
      profileId: selectedProfile.id,
      data: {
        name: memberName,
        email: memberEmail || undefined,
        relationship: memberRelationship || undefined
      }
    });
  };

  const getProfileIcon = (type: string) => {
    switch (type) {
      case 'business':
        return <Briefcase className="h-5 w-5" />;
      case 'personal':
        return <User className="h-5 w-5" />;
      case 'family':
        return <Users className="h-5 w-5" />;
      default:
        return <User className="h-5 w-5" />;
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading profiles...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Profiles</h3>
          <p className="text-sm text-muted-foreground">
            Manage your business, personal, and family profiles
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-profile">
              <Plus className="h-4 w-4 mr-2" />
              Create Profile
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Profile</DialogTitle>
              <DialogDescription>
                Add a business, personal, or family profile to organize your accounting.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Profile Name</Label>
                <Input
                  id="profile-name"
                  placeholder="e.g., My Consulting Business"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  data-testid="input-profile-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="profile-type">Profile Type</Label>
                <Select 
                  value={profileType} 
                  onValueChange={(value) => setProfileType(value as 'business' | 'personal' | 'family')}
                >
                  <SelectTrigger data-testid="select-profile-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="family">Family</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {profileType === 'personal' && "Only one personal profile allowed"}
                  {profileType === 'family' && "You can add family members to this profile"}
                  {profileType === 'business' && "You can create multiple business profiles"}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="profile-description">Description (Optional)</Label>
                <Textarea
                  id="profile-description"
                  placeholder="Add notes about this profile..."
                  value={profileDescription}
                  onChange={(e) => setProfileDescription(e.target.value)}
                  rows={3}
                  data-testid="input-profile-description"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateProfile}
                disabled={createProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {createProfileMutation.isPending ? "Creating..." : "Create Profile"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {profiles.map((profile) => (
          <Card key={profile.id} className="relative" data-testid={`profile-card-${profile.id}`}>
            {profile.isDefault && (
              <Badge className="absolute top-2 right-2" variant="default">
                <Star className="h-3 w-3 mr-1" />
                Default
              </Badge>
            )}
            
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {getProfileIcon(profile.type)}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">{profile.name}</CardTitle>
                  <CardDescription className="capitalize">{profile.type}</CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              {profile.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {profile.description}
                </p>
              )}
              
              <div className="flex items-center gap-2">
                {!profile.isDefault && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDefaultMutation.mutate(profile.id)}
                    data-testid={`button-set-default-${profile.id}`}
                  >
                    Set as Default
                  </Button>
                )}
                
                {profile.type === 'family' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedProfile(profile);
                      setIsMembersDialogOpen(true);
                    }}
                    data-testid={`button-manage-members-${profile.id}`}
                  >
                    <UserPlus className="h-3 w-3 mr-1" />
                    Members
                  </Button>
                )}
                
                {!profile.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteProfile(profile.id)}
                    data-testid={`button-delete-profile-${profile.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Family Members Dialog */}
      <Dialog open={isMembersDialogOpen} onOpenChange={setIsMembersDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Family Members - {selectedProfile?.name}</DialogTitle>
            <DialogDescription>
              Manage members of your family profile
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="border rounded-lg p-4 space-y-3">
              <h4 className="font-medium">Add New Member</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="member-name">Name</Label>
                  <Input
                    id="member-name"
                    placeholder="John Doe"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    data-testid="input-member-name"
                  />
                </div>
                <div>
                  <Label htmlFor="member-email">Email (Optional)</Label>
                  <Input
                    id="member-email"
                    type="email"
                    placeholder="john@example.com"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    data-testid="input-member-email"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="member-relationship">Relationship</Label>
                <Select value={memberRelationship} onValueChange={setMemberRelationship}>
                  <SelectTrigger data-testid="select-member-relationship">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spouse">Spouse</SelectItem>
                    <SelectItem value="child">Child</SelectItem>
                    <SelectItem value="parent">Parent</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleAddMember}
                disabled={addMemberMutation.isPending}
                className="w-full"
                data-testid="button-add-member"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {addMemberMutation.isPending ? "Adding..." : "Add Member"}
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Current Members ({members.length})</h4>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No members added yet
                </p>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`member-${member.id}`}
                    >
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {member.relationship && (
                            <span className="capitalize">{member.relationship}</span>
                          )}
                          {member.email && (
                            <>
                              <span>•</span>
                              <span>{member.email}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (selectedProfile && confirm("Remove this member?")) {
                            deleteMemberMutation.mutate({
                              profileId: selectedProfile.id,
                              memberId: member.id
                            });
                          }
                        }}
                        data-testid={`button-remove-member-${member.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
