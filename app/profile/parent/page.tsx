"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Camera, Plus, Trash2, User } from "lucide-react";
import { useLocalStorageState } from "@/lib/use-local-storage-state";

interface Child {
  id: string;
  name: string;
  dob: string;
  specialNeeds: string;
}

export default function ParentProfilePage() {
  const [children, setChildren] = useLocalStorageState<Child[]>(
    "kidcexcellence.parent.children",
    [{ id: "c1", name: "Lebo Dlamini", dob: "2022-06-15", specialNeeds: "" }],
    (value): value is Child[] => Array.isArray(value)
  );
  const [saved, setSaved] = useState(false);

  const addChild = () => {
    setChildren((prev) => [
      ...prev,
      { id: `c${Date.now()}`, name: "", dob: "", specialNeeds: "" },
    ]);
  };

  const removeChild = (id: string) => {
    setChildren((prev) => prev.filter((c) => c.id !== id));
  };

  const updateChild = (id: string, field: keyof Child, value: string) => {
    setChildren((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleSave = () => {
    const rawSession = window.localStorage.getItem("kidcexcellence.session");
    const session = rawSession ? JSON.parse(rawSession) : null;
    const userId = session?.userId ?? "local-parent";
    fetch("/api/profiles/parent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, children }),
    }).catch(() => undefined);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="min-h-screen brand-page py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-[var(--brand-ink)]">My Profile</h1>
          <p className="text-[var(--brand-muted)] mt-1">Manage your account and children&apos;s information</p>
        </div>

        {/* Cover + Avatar */}
        <div className="bg-white rounded-lg border border-[var(--brand-line)] shadow-sm overflow-hidden mb-6">
          <div
            className="h-32 relative"
            style={{ background: "linear-gradient(135deg, var(--brand-leaf), var(--brand-gold))" }}
          >
            <button className="absolute bottom-3 right-3 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-medium text-[var(--brand-ink)] flex items-center gap-1 hover:bg-white transition-colors shadow-sm">
              <Camera className="w-3.5 h-3.5" />
              Change Cover
            </button>
          </div>
          <div className="px-6 pb-6">
            <div className="relative -mt-12 mb-4 w-fit">
              <div className="w-20 h-20 rounded-lg bg-[var(--brand-ivory)] border-4 border-white shadow-md flex items-center justify-center">
                <User className="w-10 h-10 text-[var(--brand-leaf)]" />
              </div>
              <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-[var(--brand-line)] shadow-sm flex items-center justify-center hover:bg-gray-50">
                <Camera className="w-3.5 h-3.5 text-[var(--brand-muted)]" />
              </button>
            </div>
            <h2 className="text-lg font-bold text-[var(--brand-ink)]">Mpho Dlamini</h2>
            <p className="text-[var(--brand-muted)] text-sm">Parent · Phakalane, Gaborone</p>
          </div>
        </div>

        {/* Personal Info */}
        <div className="bg-white rounded-lg border border-[var(--brand-line)] shadow-sm p-6 mb-6">
          <h3 className="text-lg font-bold text-[var(--brand-ink)] mb-5">Personal Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-[var(--brand-ink)]">Full Name</Label>
              <Input defaultValue="Mpho Dlamini" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
            </div>
            <div>
              <Label className="text-sm font-medium text-[var(--brand-ink)]">Date of Birth</Label>
              <Input type="date" defaultValue="1990-03-22" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
            </div>
            <div>
              <Label className="text-sm font-medium text-[var(--brand-ink)]">Nationality</Label>
              <Input defaultValue="Motswana" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
            </div>
            <div>
              <Label className="text-sm font-medium text-[var(--brand-ink)]">Location</Label>
              <Select defaultValue="gaborone">
                <SelectTrigger className="mt-1 rounded-lg border-[var(--brand-line)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gaborone">Gaborone</SelectItem>
                  <SelectItem value="francistown">Francistown</SelectItem>
                  <SelectItem value="maun">Maun</SelectItem>
                  <SelectItem value="lobatse">Lobatse</SelectItem>
                  <SelectItem value="serowe">Serowe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium text-[var(--brand-ink)]">Phone Number</Label>
              <Input defaultValue="+267 71 234 567" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
            </div>
            <div>
              <Label className="text-sm font-medium text-[var(--brand-ink)]">Email Address</Label>
              <Input type="email" defaultValue="mpho.dlamini@gmail.com" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
            </div>
          </div>
          <div className="mt-4">
            <Label className="text-sm font-medium text-[var(--brand-ink)]">About Me</Label>
            <Textarea
              defaultValue="Loving parent of two young children based in Phakalane, Gaborone. Looking for excellent childcare and educational opportunities."
              className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)] resize-none"
              rows={3}
            />
          </div>
        </div>

        {/* Children */}
        <div className="bg-white rounded-lg border border-[var(--brand-line)] shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-[var(--brand-ink)]">My Children</h3>
            <Button
              size="sm"
              onClick={addChild}
              className="rounded-lg text-white text-sm flex items-center gap-1"
              style={{ background: "var(--brand-leaf)" }}
            >
              <Plus className="w-4 h-4" />
              Add Child
            </Button>
          </div>

          <div className="space-y-5">
            {children.map((child, idx) => (
              <div key={child.id}>
                {idx > 0 && <Separator className="mb-5" />}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
                      style={{ background: "linear-gradient(135deg, var(--brand-leaf), var(--brand-gold))" }}
                    >
                      {idx + 1}
                    </div>
                    <span className="font-semibold text-[var(--brand-ink)] text-sm">Child {idx + 1}</span>
                  </div>
                  {children.length > 1 && (
                    <button
                      onClick={() => removeChild(child.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-[var(--brand-muted)]">Child&apos;s Name</Label>
                    <Input
                      value={child.name}
                      onChange={(e) => updateChild(child.id, "name", e.target.value)}
                      placeholder="e.g. Lebo"
                      className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)] text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-[var(--brand-muted)]">Date of Birth</Label>
                    <Input
                      type="date"
                      value={child.dob}
                      onChange={(e) => updateChild(child.id, "dob", e.target.value)}
                      className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)] text-sm"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <Label className="text-xs font-medium text-[var(--brand-muted)]">
                    Special Needs / Notes <span className="text-gray-400 font-normal">(optional)</span>
                  </Label>
                  <Textarea
                    value={child.specialNeeds}
                    onChange={(e) => updateChild(child.id, "specialNeeds", e.target.value)}
                    placeholder="Any allergies, medical conditions, or special requirements..."
                    className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)] resize-none text-sm"
                    rows={2}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" className="rounded-lg border-[var(--brand-line)] text-[var(--brand-muted)]">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="rounded-lg text-white font-semibold px-8"
            style={{ background: "var(--brand-leaf)" }}
          >
            {saved ? "Saved!" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
