"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ProviderCard from "@/components/ProviderCard";
import { CATEGORIES, PROVIDERS, TESTIMONIALS } from "@/lib/mock-data";
import {
  Search,
  Star,
  Shield,
  MessageCircle,
  ChevronRight,
  Users,
  MapPin,
  CheckCircle,
} from "lucide-react";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");

  const featuredProviders = PROVIDERS.filter((p) => p.verified).slice(0, 6);

  return (
    <div className="bg-[#FAFAF9]">
      {/* Hero */}
      <section
        className="relative overflow-hidden py-20 px-4 sm:px-6 lg:px-8"
        style={{
          background:
            "linear-gradient(135deg, #7C3AED 0%, #9D4EDD 40%, #F9A8D4 100%)",
        }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-white" />
          <div className="absolute bottom-10 right-20 w-60 h-60 rounded-full bg-white" />
          <div className="absolute top-1/2 left-1/3 w-20 h-20 rounded-full bg-white" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
            <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
            <span className="text-white text-sm font-medium">
              Botswana&apos;s most trusted childcare marketplace
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
            Find trusted childcare
            <br />
            <span className="text-pink-200">near you in Botswana</span>
          </h1>

          <p className="text-white/90 text-lg sm:text-xl mb-10 max-w-2xl mx-auto">
            Connect with verified schools, nurseries, nannies, babysitters,
            clinics and tutors for your little ones aged 0–4.
          </p>

          {/* Search Bar */}
          <div className="bg-white rounded-2xl shadow-xl p-4 max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search nurseries, nannies, schools..."
                  className="pl-10 border-0 bg-gray-50 rounded-xl focus-visible:ring-purple-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={selectedLocation} onValueChange={(v) => setSelectedLocation(v ?? "")}>
                <SelectTrigger className="w-full sm:w-44 border-0 bg-gray-50 rounded-xl">
                  <MapPin className="w-4 h-4 text-gray-400 mr-1" />
                  <SelectValue placeholder="Location" />
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
              <Link href={`/search?q=${searchQuery}&location=${selectedLocation}`}>
                <Button
                  className="w-full sm:w-auto rounded-xl text-white font-semibold px-6"
                  style={{ background: "#7C3AED" }}
                >
                  Search
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-4 mt-6 text-white/80 text-sm">
            {["Schools", "Nurseries", "Nannies", "Clinics"].map((cat) => (
              <Link
                key={cat}
                href={`/search?category=${cat.toLowerCase()}`}
                className="hover:text-white transition-colors underline-offset-2 hover:underline"
              >
                {cat} →
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Browse by Category
          </h2>
          <p className="text-gray-500 text-lg">
            Find exactly the type of care your child needs
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              href={`/search?category=${cat.id}`}
              className="group bg-white rounded-2xl p-5 text-center shadow-sm border border-gray-100 hover:shadow-md hover:border-purple-200 transition-all duration-200 hover:-translate-y-1"
            >
              <div className="text-4xl mb-3">{cat.icon}</div>
              <div className="font-semibold text-gray-800 text-sm mb-1 group-hover:text-purple-700 transition-colors">
                {cat.name}
              </div>
              <div className="text-gray-400 text-xs">{cat.count}+ providers</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section
        className="py-12 px-4 sm:px-6 lg:px-8"
        style={{
          background: "linear-gradient(135deg, #7C3AED, #9D4EDD)",
        }}
      >
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {[
            { value: "500+", label: "Verified Providers", icon: <Shield className="w-6 h-6" /> },
            { value: "2,000+", label: "Families Served", icon: <Users className="w-6 h-6" /> },
            { value: "6", label: "Cities Covered", icon: <MapPin className="w-6 h-6" /> },
            { value: "100%", label: "Background Checked", icon: <CheckCircle className="w-6 h-6" /> },
          ].map((stat) => (
            <div key={stat.label} className="text-white">
              <div className="flex justify-center mb-2 opacity-70">{stat.icon}</div>
              <div className="text-3xl sm:text-4xl font-extrabold mb-1">{stat.value}</div>
              <div className="text-white/80 text-sm font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Providers */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Featured Providers
            </h2>
            <p className="text-gray-500">Top-rated, verified childcare near you</p>
          </div>
          <Link href="/search">
            <Button variant="outline" className="rounded-xl border-purple-200 text-purple-700 hover:bg-purple-50 hidden sm:flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredProviders.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </div>

        <div className="text-center mt-8 sm:hidden">
          <Link href="/search">
            <Button variant="outline" className="rounded-xl border-purple-200 text-purple-700">
              View All Providers
            </Button>
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              How Kidcexcellence Works
            </h2>
            <p className="text-gray-500 text-lg">
              Finding trusted childcare has never been easier
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-12 left-1/3 right-1/3 h-0.5 bg-gradient-to-r from-purple-200 to-pink-200" />
            {[
              {
                step: "1",
                icon: <Search className="w-6 h-6 text-purple-600" />,
                title: "Search & Filter",
                desc: "Browse verified providers by category, location, price, and ratings. Use our smart filters to narrow down to your perfect match.",
              },
              {
                step: "2",
                icon: <Users className="w-6 h-6 text-purple-600" />,
                title: "Compare Options",
                desc: "View detailed profiles, photos, fee structures, and reviews. Compare providers side by side to make the best decision for your family.",
              },
              {
                step: "3",
                icon: <MessageCircle className="w-6 h-6 text-purple-600" />,
                title: "Connect Directly",
                desc: "Message providers directly, ask questions, and arrange visits. Connect via WhatsApp for quick and easy communication.",
              },
            ].map((item) => (
              <div key={item.step} className="relative text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center shadow-sm border border-purple-100" style={{ background: "linear-gradient(135deg, #F3E8FF, #FCE7F3)" }}>
                  {item.icon}
                </div>
                <div
                  className="absolute -top-2 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                  style={{ background: "#7C3AED", marginTop: "-0.5rem" }}
                >
                  {item.step}
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Loved by Botswana Parents
          </h2>
          <p className="text-gray-500 text-lg">Real stories from real families</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed mb-5 italic">
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <Image
                  src={t.avatar}
                  alt={t.name}
                  width={44}
                  height={44}
                  className="rounded-full border-2 border-purple-100"
                />
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{t.name}</div>
                  <div className="text-gray-400 text-xs">{t.location} · {t.children}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div
          className="max-w-4xl mx-auto rounded-3xl p-10 text-center shadow-xl"
          style={{
            background: "linear-gradient(135deg, #1E1B4B 0%, #7C3AED 100%)",
          }}
        >
          <div className="text-4xl mb-4">🏫</div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Are you a childcare provider?
          </h2>
          <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
            Join Kidcexcellence and reach hundreds of families looking for
            trusted childcare in Botswana. Free to list, easy to manage.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth">
              <Button
                size="lg"
                className="rounded-2xl font-bold px-8 bg-white hover:bg-gray-100"
                style={{ color: "#7C3AED" }}
              >
                List Your Service Free
              </Button>
            </Link>
            <Link href="/search">
              <Button
                size="lg"
                variant="outline"
                className="rounded-2xl font-semibold px-8 border-white/40 text-white hover:bg-white/10"
              >
                Browse as Parent
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
