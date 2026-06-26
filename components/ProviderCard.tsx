import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Star, CheckCircle2 } from "lucide-react";
import type { Provider } from "@/lib/mock-data";

interface ProviderCardProps {
  provider: Provider;
  onAddToCompare?: (id: string) => void;
  inCompare?: boolean;
}

const categoryColors: Record<string, string> = {
  schools: "bg-blue-100 text-blue-700",
  nurseries: "bg-green-100 text-green-700",
  nannies: "bg-pink-100 text-pink-700",
  babysitters: "bg-orange-100 text-orange-700",
  "pediatric-clinics": "bg-red-100 text-red-700",
  tutors: "bg-yellow-100 text-yellow-700",
};

const categoryLabels: Record<string, string> = {
  schools: "School",
  nurseries: "Nursery",
  nannies: "Nanny",
  babysitters: "Babysitter",
  "pediatric-clinics": "Pediatric Clinic",
  tutors: "Tutor",
};

export default function ProviderCard({ provider, onAddToCompare, inCompare }: ProviderCardProps) {
  const isPersonAvatar = provider.image.includes("dicebear");

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col">
      {/* Image */}
      <div className="relative h-48 bg-gray-100 overflow-hidden">
        {isPersonAvatar ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
            <Image
              src={provider.image}
              alt={provider.name}
              width={120}
              height={120}
              className="rounded-full object-cover border-4 border-white shadow-md"
            />
          </div>
        ) : (
          <Image
            src={provider.image}
            alt={provider.name}
            fill
            className="object-cover"
          />
        )}
        {provider.verified && (
          <div className="absolute top-3 right-3 bg-white rounded-full px-2 py-1 flex items-center gap-1 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-xs font-semibold text-green-700">Verified</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-gray-900 text-base leading-tight line-clamp-2">{provider.name}</h3>
          <Badge className={`shrink-0 text-xs font-medium rounded-full ${categoryColors[provider.category] || "bg-gray-100 text-gray-700"}`}>
            {categoryLabels[provider.category] || provider.category}
          </Badge>
        </div>

        <div className="flex items-center gap-1 text-gray-500 text-sm mb-3">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{provider.location}</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="font-semibold text-gray-900 text-sm">{provider.rating}</span>
            <span className="text-gray-400 text-sm">({provider.reviewCount})</span>
          </div>
          <div className="text-right">
            <span className="font-bold text-gray-900 text-sm">
              P {provider.price.toLocaleString()}
            </span>
            <span className="text-gray-400 text-xs ml-1">/{provider.priceUnit}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-auto">
          <Link href={`/provider/${provider.id}`} className="flex-1">
            <Button
              className="w-full rounded-xl text-white font-semibold text-sm"
              style={{ background: "#7C3AED" }}
            >
              View Profile
            </Button>
          </Link>
          {onAddToCompare && (
            <Button
              variant="outline"
              size="sm"
              className={`rounded-xl text-xs border-purple-200 ${inCompare ? "bg-purple-50 text-purple-700" : "text-gray-600"}`}
              onClick={() => onAddToCompare(provider.id)}
            >
              {inCompare ? "Added" : "Compare"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
