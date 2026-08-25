import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProviderAnalyticsTracker } from "@/components/ProviderAnalyticsTracker";
import {
  allProvidersFromStore,
  getCategoryById,
  getCategoryIcon,
} from "@/lib/platform-service";
import {
  SESSION_COOKIE_NAME,
  getSessionByToken,
  readStore,
} from "@/lib/platform-store";
import {
  ArrowLeft,
  CalendarDays,
  Car,
  CheckCircle2,
  GraduationCap,
  Languages,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";

export default async function ProviderProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await readStore();
  const provider = allProvidersFromStore(store).find((item) => item.id === id);
  if (!provider) notFound();

  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const auth = await getSessionByToken(sessionToken);
  const category = getCategoryById(provider.category);
  const categoryIcon = getCategoryIcon(provider.category);
  const isSpecialist = ["pediatric-clinics", "pediatric-therapy", "child-psychologists"].includes(provider.category);
  const canViewSpecialistPrice = !isSpecialist || auth?.user.role === "parent" || auth?.user.role === "admin";
  const profileDetails = [
    provider.ownerFullName ? [UserRound, "Owner / contact person", provider.ownerFullName] : null,
    provider.age ? [UserRound, "Age", `${provider.age} years old`] : null,
    provider.stayArrangement
      ? [UserRound, "Stay arrangement", provider.stayArrangement === "stay-in" ? "Stay in" : "Stay out"]
      : null,
    provider.hasChildren
      ? [UserRound, "Has kids", provider.hasChildren === "yes" ? `Yes${provider.childrenCount ? `, ${provider.childrenCount}` : ""}` : "No"]
      : null,
    typeof provider.willingToRelocate === "boolean"
      ? [MapPin, "Relocation", provider.willingToRelocate ? "Willing to relocate" : "Not relocating"]
      : null,
    typeof provider.childrenCount === "number"
      ? [UserRound, "Own children", String(provider.childrenCount)]
      : null,
    provider.yearsExperience
      ? [ShieldCheck, "Years experience", `${provider.yearsExperience} years`]
      : null,
    provider.careAges ? [UserRound, "Care ages", provider.careAges] : null,
    provider.languages?.length
      ? [Languages, "Languages", provider.languages.join(", ")]
      : null,
    provider.qualifications?.length
      ? [GraduationCap, "Qualifications", provider.qualifications.join(", ")]
      : null,
    provider.tradingHours ? [CalendarDays, "Trading hours", provider.tradingHours] : null,
    provider.numberPlate ? [Car, "Number plate", provider.numberPlate] : null,
    provider.prdp ? [ShieldCheck, "PRDP", provider.prdp] : null,
    [CalendarDays, "Availability", provider.availability],
    [ShieldCheck, "Experience", provider.experience],
  ].filter(Boolean) as Array<[typeof Star, string, string]>;
  const gallery = provider.gallery?.length ? provider.gallery : [provider.image];
  const hasPrice = provider.price > 0;
  const showPrice = hasPrice && canViewSpecialistPrice;
  const filledStars = Math.round(provider.rating);

  return (
    <div className="brand-page min-h-screen">
      <ProviderAnalyticsTracker providerId={provider.id} />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/search" className="mb-6 inline-flex items-center gap-2 text-sm font-black text-[var(--brand-leaf)]">
          <ArrowLeft className="h-4 w-4" />
          Back to providers
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <main className="space-y-6">
            <section className="brand-card overflow-hidden">
              <div className="relative min-h-[30rem] overflow-hidden bg-[var(--brand-sky)] sm:min-h-[34rem]">
                <Image
                  src={provider.coverImage ?? provider.image}
                  alt={`${provider.name} cover photo`}
                  fill
                  priority
                  sizes="(min-width: 1024px) 816px, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--brand-ink)]/82 via-[var(--brand-ink)]/24 to-transparent" />
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[var(--brand-ink)]/55 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-white sm:bottom-7 sm:left-7 sm:right-7">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Badge className="rounded-md border-0 bg-[var(--brand-gold)] text-[var(--brand-ink)]">
                      {category?.icon} {category?.name}
                    </Badge>
                    {provider.verified && (
                      <Badge className="rounded-md border-0 bg-white text-[var(--brand-leaf)]">
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        Verified
                      </Badge>
                    )}
                    {provider.age && (
                      <Badge className="rounded-md border-0 bg-white/90 text-[var(--brand-ink)]">
                        <UserRound className="mr-1 h-3.5 w-3.5" />
                        Age {provider.age}
                      </Badge>
                    )}
                  </div>
                  <h1 className="max-w-3xl text-4xl font-black leading-none sm:text-5xl">{provider.name}</h1>
                  <p className="mt-3 flex items-center gap-2 text-sm text-white/85">
                    <MapPin className="h-4 w-4" />
                    {provider.location}
                  </p>
                </div>
              </div>
            </section>

            <section className="brand-card p-6">
              <h2 className="text-2xl font-black text-[var(--brand-ink)]">About this provider</h2>
              <p className="mt-3 leading-7 text-[var(--brand-muted)]">{provider.bio}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] p-4">
                  <div className="mb-3 flex" aria-label={`${provider.rating} out of 5 rating`}>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star
                        key={index}
                        className={`h-4 w-4 ${
                          index < filledStars
                            ? "fill-[var(--brand-gold)] text-[var(--brand-gold)]"
                            : "text-[var(--brand-line)]"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-sm font-black text-[var(--brand-ink)]">
                    {provider.rating ? `${provider.rating} rating` : "New provider"}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[var(--brand-muted)]">
                    {provider.reviewCount ? `${provider.reviewCount} parent reviews` : "No parent reviews yet"}
                  </div>
                </div>
                {profileDetails.map(([Icon, title, body]) => {
                  const TypedIcon = Icon as typeof Star;
                  return (
                    <div key={title as string} className="rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] p-4">
                      <TypedIcon className="mb-3 h-5 w-5 text-[var(--brand-leaf)]" />
                      <div className="text-sm font-black text-[var(--brand-ink)]">{title as string}</div>
                      <div className="mt-1 text-xs leading-5 text-[var(--brand-muted)]">{body as string}</div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="brand-card p-6">
              <h2 className="text-2xl font-black text-[var(--brand-ink)]">Services</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {provider.services.map((service) => (
                  <span key={service} className="rounded-md bg-[var(--brand-ivory)] px-3 py-2 text-sm font-bold text-[var(--brand-muted)]">
                    {service}
                  </span>
                ))}
              </div>
            </section>

            {provider.fees && (
              <section className="brand-card p-6">
                <h2 className="text-2xl font-black text-[var(--brand-ink)]">Fee structure</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--brand-line)] text-left text-[var(--brand-muted)]">
                        <th className="py-3 pr-4 font-black">Program</th>
                        <th className="py-3 pr-4 font-black">Termly</th>
                        <th className="py-3 font-black">Annual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provider.fees.map((fee) => (
                        <tr key={fee.grade} className="border-b border-[var(--brand-line)] last:border-0">
                          <td className="py-3 pr-4 font-bold text-[var(--brand-ink)]">{fee.grade}</td>
                          <td className="py-3 pr-4 text-[var(--brand-muted)]">P {fee.termly.toLocaleString()}</td>
                          <td className="py-3 text-[var(--brand-muted)]">P {fee.annually.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {(provider.mission || provider.vision || provider.values || provider.medicalAids || provider.references || provider.companyProfileUrl) && (
              <section className="brand-card p-6">
                <h2 className="text-2xl font-black text-[var(--brand-ink)]">Additional details</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {provider.mission && (
                    <div>
                      <h3 className="text-sm font-black text-[var(--brand-ink)]">Mission</h3>
                      <p className="mt-1 text-sm leading-6 text-[var(--brand-muted)]">{provider.mission}</p>
                    </div>
                  )}
                  {provider.vision && (
                    <div>
                      <h3 className="text-sm font-black text-[var(--brand-ink)]">Vision</h3>
                      <p className="mt-1 text-sm leading-6 text-[var(--brand-muted)]">{provider.vision}</p>
                    </div>
                  )}
                  {provider.values && (
                    <div>
                      <h3 className="text-sm font-black text-[var(--brand-ink)]">Values</h3>
                      <p className="mt-1 text-sm leading-6 text-[var(--brand-muted)]">{provider.values}</p>
                    </div>
                  )}
                  {provider.medicalAids && (
                    <div>
                      <h3 className="text-sm font-black text-[var(--brand-ink)]">Medical aids</h3>
                      <p className="mt-1 text-sm leading-6 text-[var(--brand-muted)]">{provider.medicalAids}</p>
                    </div>
                  )}
                  {provider.companyProfileUrl && (
                    <div>
                      <h3 className="text-sm font-black text-[var(--brand-ink)]">Company profile</h3>
                      <a
                        href={provider.companyProfileUrl}
                        className="mt-1 inline-flex text-sm font-black text-[var(--brand-leaf)] hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Download company profile
                      </a>
                    </div>
                  )}
                  {provider.references && (
                    <div>
                      <h3 className="text-sm font-black text-[var(--brand-ink)]">References</h3>
                      <p className="mt-1 text-sm leading-6 text-[var(--brand-muted)]">{provider.references}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            <section className="brand-card p-6">
              <h2 className="text-2xl font-black text-[var(--brand-ink)]">Reviews</h2>
              <div className="mt-4 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] p-4">
                <div className="flex items-center gap-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star
                      key={index}
                      className={`h-4 w-4 ${
                        index < filledStars
                          ? "fill-[var(--brand-gold)] text-[var(--brand-gold)]"
                          : "text-[var(--brand-line)]"
                      }`}
                    />
                  ))}
                  <span className="text-sm font-black text-[var(--brand-ink)]">
                    {provider.reviewCount ? `${provider.reviewCount} reviews` : "No reviews yet"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--brand-muted)]">
                  Parent reviews will appear here once families share feedback after contacting this provider.
                </p>
              </div>
            </section>
          </main>

          <aside className="space-y-6">
            <section className="brand-card sticky top-24 p-5">
              <div className="text-sm font-black uppercase tracking-[0.16em] text-[var(--brand-leaf)]">
                Contact provider
              </div>
              <div className="mt-3 text-3xl font-black text-[var(--brand-ink)]">
                {showPrice ? (
                  <>
                    P {provider.price.toLocaleString()}
                    <span className="text-sm text-[var(--brand-muted)]"> /{provider.priceUnit}</span>
                  </>
                ) : hasPrice && !canViewSpecialistPrice ? (
                  <span className="text-xl">Sign in as a parent to view pricing</span>
                ) : (
                  "Contact for pricing"
                )}
              </div>
              <div className="mt-5 grid gap-2">
                <Link href={`/messages?provider=${provider.id}`}>
                  <Button className="w-full rounded-lg bg-[var(--brand-leaf)] font-black text-white hover:bg-[var(--brand-coral)]">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Book Now
                  </Button>
                </Link>
                <a href={`tel:${provider.phone.replace(/\s/g, "")}`}>
                  <Button variant="outline" className="w-full rounded-lg border-[var(--brand-line)] bg-white font-black text-[var(--brand-ink)]">
                    <Phone className="mr-2 h-4 w-4" />
                    {provider.phone}
                  </Button>
                </a>
                <a href={`mailto:${provider.email}`}>
                  <Button variant="outline" className="w-full rounded-lg border-[var(--brand-line)] bg-white font-black text-[var(--brand-ink)]">
                    <Mail className="mr-2 h-4 w-4" />
                    Email provider
                  </Button>
                </a>
                <a href={`https://wa.me/${provider.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="w-full rounded-lg border-[var(--brand-line)] bg-white font-black text-[var(--brand-ink)]">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    WhatsApp
                  </Button>
                </a>
              </div>
              <div className="mt-5 rounded-lg bg-[var(--brand-ivory)] p-4 text-sm leading-6 text-[var(--brand-muted)]">
                Kidcellence recommends confirming references, visit times,
                fees, and child safety policies before booking.
              </div>
            </section>

            <section className="brand-card p-5">
              <h2 className="font-black text-[var(--brand-ink)]">Photos</h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {gallery.slice(0, 4).map((image, index) => (
                  <div key={`${image}-${index}`} className="relative aspect-square overflow-hidden rounded-lg bg-[var(--brand-ivory)]">
                    <Image
                      src={image}
                      alt={
                        index === 0
                          ? `${provider.name} profile picture`
                          : `${provider.name} gallery photo ${index + 1}`
                      }
                      fill
                      sizes="(min-width: 1024px) 160px, 50vw"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
              {!provider.gallery?.length && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--brand-ivory)] px-3 py-2 text-xs font-bold text-[var(--brand-muted)]">
                  <span className="text-base">{categoryIcon}</span>
                  Gallery photos have not been added yet.
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
