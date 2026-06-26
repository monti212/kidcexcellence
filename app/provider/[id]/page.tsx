"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { PROVIDERS } from "@/lib/mock-data";
import {
  MapPin,
  Star,
  CheckCircle2,
  Phone,
  Mail,
  MessageCircle,
  Clock,
  Briefcase,
  ArrowLeft,
  MessageSquare,
  BarChart2,
} from "lucide-react";

const categoryLabels: Record<string, string> = {
  schools: "School",
  nurseries: "Nursery",
  nannies: "Nanny",
  babysitters: "Babysitter",
  "pediatric-clinics": "Pediatric Clinic",
  tutors: "Tutor",
};

const MOCK_REVIEWS = [
  {
    id: "r1",
    author: "Mpho Dlamini",
    avatar: "https://api.dicebear.com/7.x/personas/svg?seed=MphoR1",
    rating: 5,
    date: "March 2025",
    text: "Absolutely excellent service. My daughter has blossomed since joining and the staff are so caring and professional. Highly recommend to any parent in Gaborone.",
  },
  {
    id: "r2",
    author: "Refilwe Setlhare",
    avatar: "https://api.dicebear.com/7.x/personas/svg?seed=Refilwe2",
    rating: 5,
    date: "February 2025",
    text: "We have been very impressed with the quality of care and education. The facilities are excellent and communication with parents is outstanding.",
  },
  {
    id: "r3",
    author: "Kabelo Moeng",
    avatar: "https://api.dicebear.com/7.x/personas/svg?seed=Kabelo3",
    rating: 4,
    date: "January 2025",
    text: "Great environment for young children. The teachers are patient and the curriculum is well-structured. Only minor issue is parking can be tight at pickup time.",
  },
];

export default function ProviderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const provider = PROVIDERS.find((p) => p.id === id);
  const [compareAdded, setCompareAdded] = useState(false);

  if (!provider) return notFound();

  const isSchoolOrNursery = ["schools", "nurseries"].includes(provider.category);
  const isPersonal = ["nannies", "babysitters", "tutors"].includes(provider.category);
  const whatsappUrl = `https://wa.me/${provider.whatsapp.replace(/[^0-9]/g, "")}`;

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      {/* Back */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <Link
          href="/search"
          className="inline-flex items-center gap-1 text-gray-500 hover:text-purple-700 text-sm font-medium mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Search
        </Link>
      </div>

      {/* Hero */}
      <div className="relative h-56 sm:h-72 bg-gradient-to-br from-purple-600 to-pink-400 overflow-hidden">
        {!provider.image.includes("dicebear") && (
          <Image src={provider.image} alt={provider.name} fill className="object-cover opacity-60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Header */}
        <div className="relative -mt-16 mb-6 flex flex-col lg:flex-row gap-6">
          <div className="flex items-end gap-4">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl border-4 border-white shadow-lg overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100 shrink-0">
              <Image
                src={provider.image}
                alt={provider.name}
                width={128}
                height={128}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                  {provider.name}
                </h1>
                {provider.verified && (
                  <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-xs font-semibold text-green-700">Verified</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <Badge className="rounded-full bg-purple-100 text-purple-700 border-0">
                  {categoryLabels[provider.category]}
                </Badge>
                <span className="flex items-center gap-1 text-gray-500 text-sm">
                  <MapPin className="w-3.5 h-3.5" />
                  {provider.location}
                </span>
                <span className="flex items-center gap-1 text-yellow-500 text-sm font-semibold">
                  <Star className="w-4 h-4 fill-yellow-400" />
                  {provider.rating}
                  <span className="text-gray-400 font-normal">({provider.reviewCount} reviews)</span>
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Sidebar Card — pushed to right */}
          <div className="hidden lg:block ml-auto w-72 shrink-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-5 sticky top-24">
              <div className="text-center mb-4">
                <div className="text-2xl font-extrabold text-gray-900">
                  P {provider.price.toLocaleString()}
                </div>
                <div className="text-gray-400 text-sm">per {provider.priceUnit}</div>
              </div>
              <Separator className="mb-4" />
              <div className="space-y-2">
                <Link href="/messages">
                  <Button className="w-full rounded-xl text-white font-semibold flex items-center gap-2" style={{ background: "#7C3AED" }}>
                    <MessageSquare className="w-4 h-4" />
                    Send Message
                  </Button>
                </Link>
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full rounded-xl border-green-200 text-green-700 hover:bg-green-50 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </Button>
                </a>
                <Button
                  variant="outline"
                  className={`w-full rounded-xl flex items-center gap-2 ${compareAdded ? "bg-purple-50 border-purple-200 text-purple-700" : "border-gray-200 text-gray-600"}`}
                  onClick={() => setCompareAdded(!compareAdded)}
                >
                  <BarChart2 className="w-4 h-4" />
                  {compareAdded ? "Added to Compare" : "Add to Compare"}
                </Button>
              </div>

              {/* VIP Vet Packages */}
              <Separator className="my-4" />
              <h4 className="font-semibold text-gray-900 text-sm mb-3">Verification Packages</h4>
              <div className="space-y-2">
                <a
                  href={`${whatsappUrl}?text=Hi, I'm interested in the Standard Vet package for ${provider.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-purple-200 hover:bg-purple-50 transition-colors">
                    <div className="font-medium text-gray-800 text-sm">Standard Vet</div>
                    <div className="text-gray-500 text-xs mt-0.5">Basic background check via WhatsApp</div>
                  </div>
                </a>
                <a
                  href={`${whatsappUrl}?text=Hi, I'm interested in the VIP Vet package for ${provider.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="rounded-xl p-3 cursor-pointer transition-colors" style={{ background: "linear-gradient(135deg, #F3E8FF, #FCE7F3)", border: "1px solid #C4B5FD" }}>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-sm" style={{ color: "#7C3AED" }}>VIP Vet With Us</span>
                      <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                    </div>
                    <div className="text-xs mt-0.5 text-gray-600">Full vetting, references & in-person verification</div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="lg:max-w-[calc(100%-18rem)] lg:pr-6">
          <Tabs defaultValue="overview" className="mb-10">
            <TabsList className="bg-white border border-gray-100 rounded-2xl p-1 shadow-sm mb-6 w-full overflow-x-auto flex">
              <TabsTrigger value="overview" className="rounded-xl flex-1 text-sm">Overview</TabsTrigger>
              {(isSchoolOrNursery) && <TabsTrigger value="gallery" className="rounded-xl flex-1 text-sm">Gallery</TabsTrigger>}
              {(isSchoolOrNursery) && <TabsTrigger value="fees" className="rounded-xl flex-1 text-sm">Fees</TabsTrigger>}
              <TabsTrigger value="contact" className="rounded-xl flex-1 text-sm">Contact</TabsTrigger>
              <TabsTrigger value="reviews" className="rounded-xl flex-1 text-sm">Reviews</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
                <h2 className="text-lg font-bold text-gray-900 mb-3">About</h2>
                <p className="text-gray-600 leading-relaxed">{provider.bio}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <Briefcase className="w-5 h-5 mb-2" style={{ color: "#7C3AED" }} />
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Experience</div>
                  <div className="text-gray-800 text-sm">{provider.experience}</div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <Clock className="w-5 h-5 mb-2" style={{ color: "#7C3AED" }} />
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Availability</div>
                  <div className="text-gray-800 text-sm">{provider.availability}</div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <MapPin className="w-5 h-5 mb-2" style={{ color: "#7C3AED" }} />
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Location</div>
                  <div className="text-gray-800 text-sm">{provider.location}</div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Services Offered</h2>
                <div className="flex flex-wrap gap-2">
                  {provider.services.map((service) => (
                    <span key={service} className="bg-purple-50 text-purple-700 rounded-full px-3 py-1 text-sm font-medium">
                      {service}
                    </span>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Gallery */}
            {isSchoolOrNursery && (
              <TabsContent value="gallery">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Photo Gallery</h2>
                  {provider.gallery && provider.gallery.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {provider.gallery.map((img, i) => (
                        <div key={i} className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100 cursor-pointer group">
                          <Image
                            src={img}
                            alt={`Gallery ${i + 1}`}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-center py-10">No gallery images yet.</p>
                  )}
                </div>
              </TabsContent>
            )}

            {/* Fees */}
            {isSchoolOrNursery && (
              <TabsContent value="fees">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Fee Structure</h2>
                  {provider.fees && provider.fees.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-2 pr-4 text-gray-500 font-medium">Grade / Level</th>
                            <th className="text-right py-2 pr-4 text-gray-500 font-medium">Per Term (BWP)</th>
                            <th className="text-right py-2 text-gray-500 font-medium">Per Year (BWP)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {provider.fees.map((fee, i) => (
                            <tr key={i} className="border-b border-gray-50 hover:bg-purple-50/30 transition-colors">
                              <td className="py-3 pr-4 font-medium text-gray-900">{fee.grade}</td>
                              <td className="py-3 pr-4 text-right text-gray-700">
                                P {fee.termly.toLocaleString()}
                              </td>
                              <td className="py-3 text-right font-semibold" style={{ color: "#7C3AED" }}>
                                P {fee.annually.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="text-gray-400 text-xs mt-4">
                        * Fees shown in Botswana Pula (BWP). Contact provider for latest fee schedule and what is included.
                      </p>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-center py-10">Fee information not available. Please contact the provider directly.</p>
                  )}
                </div>
              </TabsContent>
            )}

            {/* Contact */}
            <TabsContent value="contact">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                <h2 className="text-lg font-bold text-gray-900 mb-2">Get in Touch</h2>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <Phone className="w-5 h-5 text-purple-600" />
                  <div>
                    <div className="text-xs text-gray-500 font-medium">Phone</div>
                    <div className="text-gray-800 font-medium">{provider.phone}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <Mail className="w-5 h-5 text-purple-600" />
                  <div>
                    <div className="text-xs text-gray-500 font-medium">Email</div>
                    <div className="text-gray-800 font-medium">{provider.email}</div>
                  </div>
                </div>
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-green-200 bg-green-50 cursor-pointer hover:bg-green-100 transition-colors">
                    <MessageCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <div className="text-xs text-green-600 font-medium">WhatsApp</div>
                      <div className="text-green-800 font-medium">{provider.whatsapp}</div>
                    </div>
                    <span className="ml-auto text-green-600 text-sm font-medium">Chat Now →</span>
                  </div>
                </a>
                <div className="pt-2">
                  <Link href="/messages">
                    <Button className="w-full sm:w-auto rounded-xl text-white font-semibold" style={{ background: "#7C3AED" }}>
                      Send a Message via Kidcexcellence
                    </Button>
                  </Link>
                </div>
              </div>
            </TabsContent>

            {/* Reviews */}
            <TabsContent value="reviews">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div>
                    <div className="text-4xl font-extrabold text-gray-900">{provider.rating}</div>
                    <div className="flex items-center gap-0.5 mt-1">
                      {[1,2,3,4,5].map((s) => (
                        <Star key={s} className={`w-4 h-4 ${s <= Math.round(provider.rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}`} />
                      ))}
                    </div>
                    <div className="text-gray-400 text-sm">{provider.reviewCount} reviews</div>
                  </div>
                </div>
                <div className="space-y-4">
                  {MOCK_REVIEWS.map((review) => (
                    <div key={review.id} className="border-b border-gray-50 pb-4 last:border-0">
                      <div className="flex items-start gap-3">
                        <Image
                          src={review.avatar}
                          alt={review.author}
                          width={40}
                          height={40}
                          className="rounded-full border border-gray-100 shrink-0"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-gray-900 text-sm">{review.author}</span>
                            <span className="text-gray-400 text-xs">{review.date}</span>
                          </div>
                          <div className="flex items-center gap-0.5 mb-2">
                            {[1,2,3,4,5].map((s) => (
                              <Star key={s} className={`w-3 h-3 ${s <= review.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} />
                            ))}
                          </div>
                          <p className="text-gray-600 text-sm leading-relaxed">{review.text}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Mobile Action Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex gap-3 shadow-xl z-40">
          <Link href="/messages" className="flex-1">
            <Button className="w-full rounded-xl text-white font-semibold" style={{ background: "#7C3AED" }}>
              Message
            </Button>
          </Link>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button variant="outline" className="w-full rounded-xl border-green-200 text-green-700 flex items-center gap-1">
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </Button>
          </a>
        </div>
        <div className="lg:hidden h-20" />
      </div>
    </div>
  );
}
