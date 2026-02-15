import { useState, useEffect } from "react";
import { useOrganizations } from "@/hooks/use-organizations";
import { useUserRoles, useAddUserRole, useDeleteUserRole } from "@/hooks/use-user-roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, UserPlus, Building2, Save, Target, Eye } from "lucide-react";
import { api, buildUrl } from "@shared/routes";

export default function Settings() {
  const { data: orgs, isLoading: orgsLoading } = useOrganizations();
  const org = orgs?.[0];
  const orgId = org?.id;

  const { data: roles, isLoading: rolesLoading } = useUserRoles(orgId || 0);
  const addRole = useAddUserRole(orgId || 0);
  const deleteRole = useDeleteUserRole(orgId || 0);
  const { toast } = useToast();

  const [orgForm, setOrgForm] = useState({
    name: "",
    address: "",
    phone: "",
    website: "",
    contactEmail: "",
    mission: "",
    vision: "",
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("can_view");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (org) {
      setOrgForm({
        name: org.name || "",
        address: (org as any).address || "",
        phone: (org as any).phone || "",
        website: (org as any).website || "",
        contactEmail: (org as any).contactEmail || "",
        mission: (org as any).mission || "",
        vision: (org as any).vision || "",
      });
    }
  }, [org]);

  const saveOrgProfile = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      const url = buildUrl(api.organizations.update.path, { id: orgId });
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orgForm),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Saved", description: "Organization profile updated." });
    } catch {
      toast({ title: "Error", description: "Failed to save profile.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = () => {
    if (!inviteEmail) return;
    addRole.mutate({ email: inviteEmail, role: inviteRole }, {
      onSuccess: () => {
        setInviteEmail("");
        setInviteRole("can_view");
      },
    });
  };

  if (orgsLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <p className="text-muted-foreground">No organization found. Create one from the Dashboard first.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-heading font-bold text-slate-900" data-testid="text-settings-title">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your organization profile and team members.</p>
      </div>

      {/* Organization Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Organization Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={orgForm.name}
                onChange={e => setOrgForm(f => ({ ...f, name: e.target.value }))}
                data-testid="input-org-name"
              />
            </div>
            <div>
              <Label htmlFor="org-email">Contact Email</Label>
              <Input
                id="org-email"
                type="email"
                value={orgForm.contactEmail}
                onChange={e => setOrgForm(f => ({ ...f, contactEmail: e.target.value }))}
                data-testid="input-org-email"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="org-address">Address</Label>
            <Input
              id="org-address"
              value={orgForm.address}
              onChange={e => setOrgForm(f => ({ ...f, address: e.target.value }))}
              placeholder="123 Main St, Los Angeles, CA 90012"
              data-testid="input-org-address"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="org-phone">Phone</Label>
              <Input
                id="org-phone"
                value={orgForm.phone}
                onChange={e => setOrgForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="(213) 555-0100"
                data-testid="input-org-phone"
              />
            </div>
            <div>
              <Label htmlFor="org-website">Website</Label>
              <Input
                id="org-website"
                value={orgForm.website}
                onChange={e => setOrgForm(f => ({ ...f, website: e.target.value }))}
                placeholder="https://example.org"
                data-testid="input-org-website"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={saveOrgProfile} disabled={saving} data-testid="button-save-org">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mission & Vision */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Mission & Vision
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="org-mission" className="flex items-center gap-1.5 mb-1.5">
              <Target className="w-3.5 h-3.5 text-muted-foreground" /> Mission Statement
            </Label>
            <Textarea
              id="org-mission"
              value={orgForm.mission}
              onChange={e => setOrgForm(f => ({ ...f, mission: e.target.value }))}
              placeholder="Describe your organization's mission and purpose..."
              rows={3}
              data-testid="input-org-mission"
            />
          </div>
          <div>
            <Label htmlFor="org-vision" className="flex items-center gap-1.5 mb-1.5">
              <Eye className="w-3.5 h-3.5 text-muted-foreground" /> Vision Statement
            </Label>
            <Textarea
              id="org-vision"
              value={orgForm.vision}
              onChange={e => setOrgForm(f => ({ ...f, vision: e.target.value }))}
              placeholder="Describe your organization's long-term vision..."
              rows={3}
              data-testid="input-org-vision"
            />
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={saveOrgProfile} disabled={saving} data-testid="button-save-mission">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invite Form */}
          <div className="flex flex-col sm:flex-row gap-3 p-4 bg-muted/50 rounded-lg">
            <Input
              placeholder="user@example.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="flex-1"
              data-testid="input-invite-email"
            />
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="w-48" data-testid="select-invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="can_edit">Can Edit</SelectItem>
                <SelectItem value="can_view">Can View</SelectItem>
                <SelectItem value="can_view_download">Can View & Download</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleInvite} disabled={addRole.isPending || !inviteEmail} data-testid="button-invite">
              {addRole.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Member"}
            </Button>
          </div>

          {/* Members List */}
          {rolesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : roles && roles.length > 0 ? (
            <div className="space-y-2">
              {roles.map((role: any) => (
                <div key={role.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                        {role.user?.firstName?.[0] || "?"}{role.user?.lastName?.[0] || ""}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {role.user?.firstName} {role.user?.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{role.user?.email || "No email"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {{"admin": "Admin", "can_edit": "Can Edit", "can_view": "Can View", "can_view_download": "Can View & Download"}[role.role as string] || role.role}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteRole.mutate(role.id)}
                      data-testid={`button-remove-role-${role.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No team members assigned yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
