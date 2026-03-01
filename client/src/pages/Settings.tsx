import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useOrganizations } from "@/hooks/use-organizations";
import { useUserRoles, useAddUserRole, useDeleteUserRole } from "@/hooks/use-user-roles";
import {
  useServiceAreas,
  useCreateServiceArea,
  useDeleteServiceArea,
  LA_COUNTY_SPAS,
  type ServiceArea,
} from "@/hooks/use-service-areas";
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
import { Loader2, Trash2, UserPlus, Building2, Save, Target, Eye, EyeOff, MapPin, Plus, Lock, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { api, buildUrl } from "@shared/routes";

export default function Settings() {
  const { data: orgs, isLoading: orgsLoading } = useOrganizations();
  const org = orgs?.[0];
  const orgId = org?.id;

  const { data: roles, isLoading: rolesLoading } = useUserRoles(orgId || 0);
  const addRole = useAddUserRole(orgId || 0);
  const deleteRole = useDeleteUserRole(orgId || 0);
  const { data: serviceAreas = [], isLoading: areasLoading } = useServiceAreas(orgId);
  const createArea = useCreateServiceArea(orgId || 0);
  const deleteArea = useDeleteServiceArea(orgId || 0);
  const { toast } = useToast();

  const [orgForm, setOrgForm] = useState({
    name: "",
    address: "",
    phone: "",
    website: "",
    contactEmail: "",
    mission: "",
    vision: "",
    annualBudgetRange: "",
    targetPopulationFocus: "",
    primaryFundingType: "",
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("can_view");
  const [invitePassword, setInvitePassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [newArea, setNewArea] = useState({ name: "", lat: "", lng: "", description: "" });
  const [seedingAreas, setSeedingAreas] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setProfileForm({
          firstName: user.user_metadata?.first_name || "",
          lastName: user.user_metadata?.last_name || "",
        });
      }
    });
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    const { error } = await supabase.auth.updateUser({
      data: { first_name: profileForm.firstName, last_name: profileForm.lastName },
    });
    setSavingProfile(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated", description: "Your name has been saved." });
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password updated", description: "Your password has been changed." });
    }
  };

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
        annualBudgetRange: (org as any).annualBudgetRange || "",
        targetPopulationFocus: (org as any).targetPopulationFocus || "",
        primaryFundingType: (org as any).primaryFundingType || "",
      });
    }
  }, [org]);

  const saveOrgProfile = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      const url = buildUrl(api.organizations.update.path, { id: orgId });
      await apiRequest("PUT", url, orgForm);
      toast({ title: "Saved", description: "Organization profile updated." });
    } catch {
      toast({ title: "Error", description: "Failed to save profile.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddArea = () => {
    const lat = parseFloat(newArea.lat);
    const lng = parseFloat(newArea.lng);
    if (!newArea.name || isNaN(lat) || isNaN(lng)) {
      toast({ title: "Validation error", description: "Name, latitude, and longitude are required.", variant: "destructive" });
      return;
    }
    createArea.mutate(
      { name: newArea.name.trim(), lat, lng, description: newArea.description || undefined },
      { onSuccess: () => setNewArea({ name: "", lat: "", lng: "", description: "" }) }
    );
  };

  const handleSeedLaSPAs = async () => {
    if (!orgId) return;
    setSeedingAreas(true);
    try {
      for (const spa of LA_COUNTY_SPAS) {
        await createArea.mutateAsync(spa);
      }
      toast({ title: "Seeded", description: "LA County SPAs added as service areas." });
    } catch {
      toast({ title: "Error", description: "Some areas may not have been added.", variant: "destructive" });
    } finally {
      setSeedingAreas(false);
    }
  };

  const handleInvite = () => {
    if (!inviteEmail) return;
    addRole.mutate({ email: inviteEmail, role: inviteRole, password: invitePassword || undefined }, {
      onSuccess: () => {
        setInviteEmail("");
        setInvitePassword("");
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

      {/* Your Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4" /> Your Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First Name</Label>
              <Input
                value={profileForm.firstName}
                onChange={e => setProfileForm(f => ({ ...f, firstName: e.target.value }))}
                placeholder="First name"
              />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input
                value={profileForm.lastName}
                onChange={e => setProfileForm(f => ({ ...f, lastName: e.target.value }))}
                placeholder="Last name"
              />
            </div>
          </div>
          <Button onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Name
          </Button>
        </CardContent>
      </Card>

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

      {/* Organization Context */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Organization Context
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="org-budget-range">Annual Budget Range</Label>
              <Select
                value={orgForm.annualBudgetRange || "__none__"}
                onValueChange={v => setOrgForm(f => ({ ...f, annualBudgetRange: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger id="org-budget-range" data-testid="select-org-budget-range">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Not specified —</SelectItem>
                  <SelectItem value="Under $500K">Under $500K</SelectItem>
                  <SelectItem value="$500K–$1M">$500K–$1M</SelectItem>
                  <SelectItem value="$1M–$5M">$1M–$5M</SelectItem>
                  <SelectItem value="$5M–$10M">$5M–$10M</SelectItem>
                  <SelectItem value="Over $10M">Over $10M</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="org-pop-focus">Target Population Focus</Label>
              <Select
                value={orgForm.targetPopulationFocus || "__none__"}
                onValueChange={v => setOrgForm(f => ({ ...f, targetPopulationFocus: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger id="org-pop-focus" data-testid="select-org-pop-focus">
                  <SelectValue placeholder="Select population" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Not specified —</SelectItem>
                  <SelectItem value="Youth / Children">Youth / Children</SelectItem>
                  <SelectItem value="Adults">Adults</SelectItem>
                  <SelectItem value="Seniors / Elderly">Seniors / Elderly</SelectItem>
                  <SelectItem value="Veterans">Veterans</SelectItem>
                  <SelectItem value="Homeless / Housing-insecure">Homeless / Housing-insecure</SelectItem>
                  <SelectItem value="Formerly Incarcerated">Formerly Incarcerated</SelectItem>
                  <SelectItem value="Families">Families</SelectItem>
                  <SelectItem value="Immigrants / Refugees">Immigrants / Refugees</SelectItem>
                  <SelectItem value="General Community">General Community</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="org-funding-type">Primary Funding Type</Label>
              <Select
                value={orgForm.primaryFundingType || "__none__"}
                onValueChange={v => setOrgForm(f => ({ ...f, primaryFundingType: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger id="org-funding-type" data-testid="select-org-funding-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Not specified —</SelectItem>
                  <SelectItem value="Government Grants">Government Grants</SelectItem>
                  <SelectItem value="Private Foundations">Private Foundations</SelectItem>
                  <SelectItem value="Individual Donors">Individual Donors</SelectItem>
                  <SelectItem value="Corporate Sponsors">Corporate Sponsors</SelectItem>
                  <SelectItem value="Fee for Service">Fee for Service</SelectItem>
                  <SelectItem value="Mixed / Multiple Sources">Mixed / Multiple Sources</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={saveOrgProfile} disabled={saving} data-testid="button-save-context">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Service Areas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Service Areas
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedLaSPAs}
              disabled={seedingAreas}
              data-testid="button-seed-spas"
            >
              {seedingAreas ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Seed LA County SPAs
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Define named regions (cities, counties, SPAs, etc.) and their coordinates. These are used for map geocoding in reports.
          </p>

          {/* Add form */}
          <div className="grid sm:grid-cols-4 gap-2 p-3 bg-muted/50 rounded-lg">
            <div>
              <Label className="text-xs mb-1 block">Name</Label>
              <Input
                placeholder="e.g. SPA 6"
                value={newArea.name}
                onChange={e => setNewArea(f => ({ ...f, name: e.target.value }))}
                data-testid="input-area-name"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Latitude</Label>
              <Input
                placeholder="34.0549"
                value={newArea.lat}
                onChange={e => setNewArea(f => ({ ...f, lat: e.target.value }))}
                data-testid="input-area-lat"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Longitude</Label>
              <Input
                placeholder="-118.2578"
                value={newArea.lng}
                onChange={e => setNewArea(f => ({ ...f, lng: e.target.value }))}
                data-testid="input-area-lng"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Description (optional)</Label>
              <Input
                placeholder="Metro LA"
                value={newArea.description}
                onChange={e => setNewArea(f => ({ ...f, description: e.target.value }))}
                data-testid="input-area-desc"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleAddArea}
              disabled={createArea.isPending}
              data-testid="button-add-area"
            >
              {createArea.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Add Area
            </Button>
          </div>

          {/* Areas list */}
          {areasLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : serviceAreas.length > 0 ? (
            <div className="divide-y rounded-lg border overflow-hidden">
              {serviceAreas.map((area: ServiceArea) => (
                <div key={area.id} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <span className="text-sm font-medium">{area.name}</span>
                    {area.description && (
                      <span className="text-xs text-muted-foreground ml-2">— {area.description}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-mono">
                      {area.lat.toFixed(4)}, {area.lng.toFixed(4)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive h-7 w-7"
                      onClick={() => deleteArea.mutate(area.id)}
                      data-testid={`button-delete-area-${area.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No service areas defined. Add one above or seed LA County SPAs.
            </p>
          )}
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
          <div className="flex flex-col gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="flex-1"
                data-testid="input-invite-email"
              />
              <Input
                type="password"
                placeholder="Temporary password"
                value={invitePassword}
                onChange={e => setInvitePassword(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="flex-1" data-testid="select-invite-role">
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
            <p className="text-xs text-muted-foreground">Enter a temporary password to create the account instantly, or leave blank to send an email invite.</p>
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

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="w-4 h-4" /> Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>New Password</Label>
            <div className="relative">
              <Input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                onClick={() => setShowNewPassword(v => !v)}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <div>
            <Label>Confirm Password</Label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirmPassword(v => !v)}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={changingPassword}>
            {changingPassword ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Update Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
