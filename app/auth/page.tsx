"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Star, Eye, EyeOff, Baby, Briefcase } from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm"
              style={{ background: "linear-gradient(135deg, #7C3AED, #F9A8D4)" }}
            >
              <Star className="w-5 h-5 text-white fill-white" />
            </div>
            <span className="text-2xl font-extrabold" style={{ color: "#7C3AED" }}>
              Kidcexcellence
            </span>
          </Link>
          <p className="text-gray-500 text-sm mt-2">
            Trusted childcare across Botswana
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          {/* Auth Mode Toggle */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <button
              onClick={() => setIsLogin(false)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                !isLogin
                  ? "text-white shadow-sm"
                  : "text-gray-500 hover:text-purple-700"
              }`}
              style={!isLogin ? { background: "#7C3AED" } : {}}
            >
              Create Account
            </button>
            <button
              onClick={() => setIsLogin(true)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                isLogin
                  ? "text-white shadow-sm"
                  : "text-gray-500 hover:text-purple-700"
              }`}
              style={isLogin ? { background: "#7C3AED" } : {}}
            >
              Login
            </button>
          </div>

          {isLogin ? (
            <LoginForm showPassword={showPassword} setShowPassword={setShowPassword} />
          ) : (
            <SignupForm
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              showConfirmPassword={showConfirmPassword}
              setShowConfirmPassword={setShowConfirmPassword}
            />
          )}

          {/* Social Login */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-gray-500">or continue with</span>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full mt-4 rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>
          </div>

          <p className="text-center text-gray-500 text-sm mt-5">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="font-semibold hover:underline"
              style={{ color: "#7C3AED" }}
            >
              {isLogin ? "Sign up" : "Login"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginForm({
  showPassword,
  setShowPassword,
}: {
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
}) {
  return (
    <form className="space-y-4">
      <div>
        <Label htmlFor="email" className="text-gray-700 font-medium text-sm">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="your@email.com"
          className="mt-1 rounded-xl border-gray-200 focus-visible:ring-purple-500"
        />
      </div>
      <div>
        <Label htmlFor="password" className="text-gray-700 font-medium text-sm">Password</Label>
        <div className="relative mt-1">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            className="rounded-xl border-gray-200 focus-visible:ring-purple-500 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div className="text-right mt-1">
          <button type="button" className="text-xs text-purple-600 hover:underline">
            Forgot password?
          </button>
        </div>
      </div>
      <Button
        type="submit"
        className="w-full rounded-xl text-white font-semibold h-11 mt-2"
        style={{ background: "#7C3AED" }}
      >
        Login
      </Button>
    </form>
  );
}

function SignupForm({
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
}: {
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (v: boolean) => void;
}) {
  return (
    <Tabs defaultValue="parent">
      <TabsList className="grid w-full grid-cols-2 mb-6 rounded-xl bg-gray-100">
        <TabsTrigger value="parent" className="rounded-xl flex items-center gap-2 data-[state=active]:bg-white">
          <Baby className="w-4 h-4" />
          I&apos;m a Parent
        </TabsTrigger>
        <TabsTrigger value="provider" className="rounded-xl flex items-center gap-2 data-[state=active]:bg-white">
          <Briefcase className="w-4 h-4" />
          I&apos;m a Provider
        </TabsTrigger>
      </TabsList>

      <TabsContent value="parent">
        <form className="space-y-3">
          <div>
            <Label className="text-gray-700 font-medium text-sm">Full Name</Label>
            <Input placeholder="Mpho Dlamini" className="mt-1 rounded-xl border-gray-200 focus-visible:ring-purple-500" />
          </div>
          <div>
            <Label className="text-gray-700 font-medium text-sm">Email</Label>
            <Input type="email" placeholder="your@email.com" className="mt-1 rounded-xl border-gray-200 focus-visible:ring-purple-500" />
          </div>
          <div>
            <Label className="text-gray-700 font-medium text-sm">Phone Number</Label>
            <Input placeholder="+267 71 234 567" className="mt-1 rounded-xl border-gray-200 focus-visible:ring-purple-500" />
          </div>
          <div>
            <Label className="text-gray-700 font-medium text-sm">Location</Label>
            <Select>
              <SelectTrigger className="mt-1 rounded-xl border-gray-200">
                <SelectValue placeholder="Select your city" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gaborone">Gaborone</SelectItem>
                <SelectItem value="francistown">Francistown</SelectItem>
                <SelectItem value="maun">Maun</SelectItem>
                <SelectItem value="kasane">Kasane</SelectItem>
                <SelectItem value="lobatse">Lobatse</SelectItem>
                <SelectItem value="serowe">Serowe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-700 font-medium text-sm">Password</Label>
            <div className="relative mt-1">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Min. 8 characters"
                className="rounded-xl border-gray-200 focus-visible:ring-purple-500 pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label className="text-gray-700 font-medium text-sm">Confirm Password</Label>
            <div className="relative mt-1">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Repeat password"
                className="rounded-xl border-gray-200 focus-visible:ring-purple-500 pr-10"
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full rounded-xl text-white font-semibold h-11 mt-2" style={{ background: "#7C3AED" }}>
            Create Parent Account
          </Button>
        </form>
      </TabsContent>

      <TabsContent value="provider">
        <form className="space-y-3">
          <div>
            <Label className="text-gray-700 font-medium text-sm">Business / Full Name</Label>
            <Input placeholder="Sunshine ELC or Your Name" className="mt-1 rounded-xl border-gray-200 focus-visible:ring-purple-500" />
          </div>
          <div>
            <Label className="text-gray-700 font-medium text-sm">Category</Label>
            <Select>
              <SelectTrigger className="mt-1 rounded-xl border-gray-200">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="schools">School</SelectItem>
                <SelectItem value="nurseries">Nursery</SelectItem>
                <SelectItem value="nannies">Nanny</SelectItem>
                <SelectItem value="babysitters">Babysitter</SelectItem>
                <SelectItem value="pediatric-clinics">Pediatric Clinic</SelectItem>
                <SelectItem value="tutors">Tutor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-700 font-medium text-sm">Email</Label>
            <Input type="email" placeholder="your@email.com" className="mt-1 rounded-xl border-gray-200 focus-visible:ring-purple-500" />
          </div>
          <div>
            <Label className="text-gray-700 font-medium text-sm">Phone / WhatsApp</Label>
            <Input placeholder="+267 71 234 567" className="mt-1 rounded-xl border-gray-200 focus-visible:ring-purple-500" />
          </div>
          <div>
            <Label className="text-gray-700 font-medium text-sm">Location</Label>
            <Select>
              <SelectTrigger className="mt-1 rounded-xl border-gray-200">
                <SelectValue placeholder="Select your city" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gaborone">Gaborone</SelectItem>
                <SelectItem value="francistown">Francistown</SelectItem>
                <SelectItem value="maun">Maun</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-700 font-medium text-sm">Password</Label>
            <div className="relative mt-1">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Min. 8 characters"
                className="rounded-xl border-gray-200 focus-visible:ring-purple-500 pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full rounded-xl text-white font-semibold h-11 mt-2" style={{ background: "#7C3AED" }}>
            Create Provider Account
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );
}
