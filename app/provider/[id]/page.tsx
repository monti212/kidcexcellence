import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { ProviderAnalyticsTracker } from "@/components/ProviderAnalyticsTracker";
import { Icon, Star, type IconName } from "@/components/kidcellence/Icon";
import { ProviderCard } from "@/components/kidcellence/ProviderCard";
import { CompareToggle } from "@/components/kidcellence/profile/CompareToggle";
import { routes } from "@/lib/kidcellence/routes";
import {
  categoryIcon,
  formatPrice,
  initialsOf,
  providerPhoto,
  providerTint,
} from "@/lib/kidcellence/provider-display";
import { allProvidersFromStore, getCategoryLabel } from "@/lib/platform-service";
import {
  SESSION_COOKIE_NAME,
  getSessionByToken,
  readStore,
} from "@/lib/platform-store";
import { getVerificationDocuments } from "@/lib/verification-requirements";

const h2Style: CSSProperties = { margin: 0, fontSize: 24, fontWeight: 800 };
const detailTile: CSSProperties = { borderRadius: 18, padding: 18, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 };
const outlineAction: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, minHeight: 44, borderRadius: 14, border: "1px solid #d7edf0", background: "#ffffff", color: "#3f3e44", fontWeight: 700, fontSize: 14, textDecoration: "none", overflowWrap: "anywhere" };

export default async function ProviderProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await readStore();
  const allProviders = allProvidersFromStore(store);
  const provider = allProviders.find((item) => item.id === id);
  if (!provider) notFound();

  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const auth = await getSessionByToken(sessionToken);
  const categoryLabel = getCategoryLabel(provider.category);
  const isSpecialist = ["pediatric-clinics", "pediatric-therapy", "child-psychologists"].includes(provider.category);
  const canViewSpecialistPrice = !isSpecialist || auth?.user.role === "parent" || auth?.user.role === "admin";
  const profileDetails = [
    provider.ownerFullName ? ["nanny", "Owner / contact person", provider.ownerFullName] : null,
    provider.age ? ["nanny", "Age", `${provider.age} years old`] : null,
    provider.stayArrangement
      ? ["helper", "Stay arrangement", provider.stayArrangement === "stay-in" ? "Stay in" : "Stay out"]
      : null,
    provider.hasChildren
      ? ["nanny", "Has kids", provider.hasChildren === "yes" ? `Yes${provider.childrenCount ? `, ${provider.childrenCount}` : ""}` : "No"]
      : null,
    typeof provider.willingToRelocate === "boolean"
      ? ["pin", "Relocation", provider.willingToRelocate ? "Willing to relocate" : "Not relocating"]
      : null,
    typeof provider.childrenCount === "number"
      ? ["nanny", "Own children", String(provider.childrenCount)]
      : null,
    provider.yearsExperience
      ? ["shieldCheck", "Years experience", `${provider.yearsExperience} years`]
      : null,
    provider.careAges ? ["nanny", "Care ages", provider.careAges] : null,
    provider.languages?.length
      ? ["message", "Languages", provider.languages.join(", ")]
      : null,
    provider.qualifications?.length
      ? ["tutor", "Qualifications", provider.qualifications.join(", ")]
      : null,
    provider.tradingHours ? ["clock", "Trading hours", provider.tradingHours] : null,
    provider.numberPlate ? ["transport", "Number plate", provider.numberPlate] : null,
    provider.prdp ? ["shieldCheck", "PRDP", provider.prdp] : null,
    provider.availability ? ["clock", "Availability", provider.availability] : null,
    provider.experience ? ["shieldCheck", "Experience", provider.experience] : null,
  ].filter(Boolean) as Array<[IconName, string, string]>;

  const hasPrice = provider.price > 0;
  const showPrice = hasPrice && canViewSpecialistPrice;
  const photo = providerPhoto(provider);
  const heroImage = provider.coverImage ?? photo;
  const galleryImages = (provider.gallery ?? []).filter(Boolean).slice(0, 4);
  const tint = providerTint(provider.id);
  const verifiedDocuments = provider.verified ? getVerificationDocuments(provider.category) : [];
  const similar = allProviders
    .filter((item) => item.id !== provider.id && item.category === provider.category)
    .sort((a, b) => Number(b.location === provider.location) - Number(a.location === provider.location))
    .slice(0, 4);
  const phone = provider.phone?.trim();
  const email = provider.email?.trim();
  const whatsappDigits = provider.whatsapp?.replace(/[^0-9]/g, "") ?? "";

  return (
    <div style={{ color: "#3f3e44", background: "#ffffff" }}>
      <ProviderAnalyticsTracker providerId={provider.id} />
      <div style={{ maxWidth: 1280, margin: "0 auto", paddingTop: 28, paddingBottom: 72, display: "flex", flexDirection: "column", gap: 28 }} className="px-4 sm:px-6">
        <nav aria-label="Breadcrumb" style={{ fontSize: 14, color: "#686973", overflowWrap: "anywhere" }}>
          <Link href={routes.home} style={{ color: "#2a7b86" }}>Home</Link>
          {" / "}
          <Link href={routes.search({ category: provider.category })} style={{ color: "#2a7b86" }}>{categoryLabel}</Link>
          {" / "}
          <span>{provider.name}</span>
        </nav>

        {/* Gallery */}
        <div
          className={`grid gap-3 overflow-hidden ${galleryImages.length ? "grid-cols-2 sm:grid-cols-4 sm:grid-rows-[210px_210px]" : "grid-cols-1"}`}
          style={{ borderRadius: 28 }}
        >
          <div
            className={`kc-dots relative ${galleryImages.length ? "col-span-2 h-[260px] sm:row-span-2 sm:h-auto" : "h-[260px] sm:h-[320px]"}`}
            style={{ backgroundColor: tint, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {heroImage ? (
              <Image
                src={heroImage}
                alt={`${provider.name} ${provider.coverImage ? "cover photo" : "profile picture"}`}
                fill
                priority
                sizes="(min-width: 640px) 640px, 100vw"
                className="object-cover"
              />
            ) : (
              <span aria-hidden="true" style={{ width: 140, height: 140, borderRadius: "50%", background: "#ffffff", color: "#2a7b86", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 46, fontWeight: 800, boxShadow: "0 8px 20px rgba(63,62,68,.12)" }}>
                {initialsOf(provider.name)}
              </span>
            )}
          </div>
          {galleryImages.map((image, index) => (
            <div key={`${image}-${index}`} className="relative h-[140px] sm:h-auto" style={{ background: "#f4fbfc" }}>
              <Image
                src={image}
                alt={`${provider.name} gallery photo ${index + 1}`}
                fill
                sizes="(min-width: 640px) 320px, 50vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
        {!galleryImages.length && (
          <p style={{ margin: "-16px 0 0", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "#686973" }}>
            <Icon name="image" size={18} color="#686973" />
            Gallery photos have not been added yet.
          </p>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 40, alignItems: "flex-start" }}>
          {/* Main column */}
          <div style={{ flex: "999 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: 32 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f4fbfc", color: provider.verified ? "#2a7b86" : "#3f3e44", border: "1px solid #d7edf0", fontWeight: 800, fontSize: 13, padding: "6px 12px", borderRadius: 999 }}>
                  <Icon name={provider.verified ? "shieldCheck" : categoryIcon(provider.category)} size={16} color="#2a7b86" strokeWidth={2.2} />
                  {provider.verified ? `Verified ${categoryLabel.toLowerCase()}` : categoryLabel}
                </span>
                {provider.featured && (
                  <span style={{ background: "#ffcc2f", fontWeight: 800, fontSize: 13, padding: "6px 12px", borderRadius: 999 }}>Featured</span>
                )}
                {provider.age && (
                  <span style={{ background: "#fff5d3", fontWeight: 800, fontSize: 13, padding: "6px 12px", borderRadius: 999 }}>Age {provider.age}</span>
                )}
              </div>
              <h1 className="text-[34px] sm:text-[44px]" style={{ margin: 0, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1.1, overflowWrap: "anywhere" }}>{provider.name}</h1>
              <p style={{ margin: 0, fontSize: 17, color: "#686973", display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
                <span>
                  {categoryLabel}
                  {provider.stayArrangement ? ` · ${provider.stayArrangement === "stay-in" ? "Live-in" : "Live-out"}` : ""}
                </span>
                {provider.location && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Icon name="pin" size={16} color="#686973" />
                    {provider.location}
                  </span>
                )}
                {provider.languages?.length ? <span>{provider.languages.join(", ")}</span> : null}
              </p>
              {provider.reviewCount > 0 && (
                <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 700 }} aria-label={`${provider.rating} out of 5 rating from ${provider.reviewCount} reviews`}>
                  <Star size={18} color="#ffcc2f" />
                  {provider.rating} · {provider.reviewCount} parent reviews
                </p>
              )}
            </div>

            {provider.bio && (
              <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h2 style={h2Style}>About</h2>
                <p style={{ margin: 0, fontSize: 17, lineHeight: 1.7, whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{provider.bio}</p>
              </section>
            )}

            {provider.services.length > 0 && (
              <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <h2 style={h2Style}>Services</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))", gap: 12 }}>
                  {provider.services.map((service, index) => (
                    <div key={service} style={{ ...detailTile, background: index % 4 < 2 ? "#f4fbfc" : "#fff5d3" }}>
                      <strong>{service}</strong>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {profileDetails.length > 0 && (
              <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <h2 style={h2Style}>Details</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))", gap: 12 }}>
                  {profileDetails.map(([icon, title, body]) => (
                    <div key={title} style={{ ...detailTile, background: "#ffffff", border: "1px solid #d7edf0" }}>
                      <Icon name={icon} size={20} color="#2a7b86" style={{ marginBottom: 6 }} />
                      <strong style={{ fontSize: 14 }}>{title}</strong>
                      <span style={{ color: "#686973", fontSize: 14, lineHeight: 1.5, overflowWrap: "anywhere" }}>{body}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {provider.fees && provider.fees.length > 0 && (
              <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <h2 style={h2Style}>Fee structure</h2>
                <div style={{ overflowX: "auto", border: "1px solid #d7edf0", borderRadius: 18 }}>
                  <table className="kc-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th scope="col">Program</th>
                        <th scope="col">Termly</th>
                        <th scope="col">Annual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provider.fees.map((fee) => (
                        <tr key={fee.grade}>
                          <td style={{ fontWeight: 700 }}>{fee.grade}</td>
                          <td style={{ color: "#686973" }}>P {fee.termly.toLocaleString()}</td>
                          <td style={{ color: "#686973" }}>P {fee.annually.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {(provider.mission || provider.vision || provider.values || provider.medicalAids || provider.references || provider.companyProfileUrl) && (
              <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <h2 style={h2Style}>Additional details</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: 16 }}>
                  {([
                    ["Mission", provider.mission],
                    ["Vision", provider.vision],
                    ["Values", provider.values],
                    ["Medical aids", provider.medicalAids],
                  ] as const).map(([title, body]) =>
                    body ? (
                      <div key={title}>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{title}</h3>
                        <p style={{ margin: "4px 0 0", fontSize: 15, lineHeight: 1.6, color: "#686973", overflowWrap: "anywhere" }}>{body}</p>
                      </div>
                    ) : null
                  )}
                  {provider.companyProfileUrl && (
                    <div>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Company profile</h3>
                      <a href={provider.companyProfileUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", marginTop: 4, fontSize: 15, fontWeight: 800, color: "#2a7b86" }}>
                        Download company profile
                      </a>
                    </div>
                  )}
                  {provider.references && (
                    <div>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>References</h3>
                      <p style={{ margin: "4px 0 0", fontSize: 15, lineHeight: 1.6, color: "#686973", overflowWrap: "anywhere" }}>{provider.references}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {provider.verified && verifiedDocuments.length > 0 && (
              <section className="p-5 sm:p-7" style={{ background: "#fff5d3", borderRadius: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 48, height: 48, flexShrink: 0, borderRadius: "50%", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name="shieldCheck" size={26} color="#2a7b86" />
                  </span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>What Kidcellence verified</h2>
                    <p style={{ margin: "2px 0 0", color: "#686973", fontSize: 14 }}>Reviewed by our team. Documents are never shown publicly.</p>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 230px), 1fr))", gap: 10 }}>
                  {verifiedDocuments.map((document) => (
                    <div key={document.key} style={{ background: "#ffffff", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
                      <Icon name="check" size={20} color="#2a7b86" strokeWidth={2.4} style={{ flexShrink: 0 }} />
                      {document.label}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Contact card */}
          <aside className="p-5 sm:p-7" style={{ flex: "1 1 340px", minWidth: 0, background: "#ffffff", borderRadius: 28, boxShadow: "0 18px 48px rgba(42,123,134,.14)", border: "1px solid #d7edf0", display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, overflowWrap: "anywhere" }}>Interested in {provider.name}?</h2>
            <div>
              <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".6px", color: "#686973" }}>Pricing</span>
              <div style={{ fontSize: showPrice ? 28 : 18, fontWeight: 800, marginTop: 2 }}>
                {showPrice
                  ? formatPrice(provider)
                  : hasPrice && !canViewSpecialistPrice
                    ? "Sign in as a parent to view pricing"
                    : "Contact for pricing"}
              </div>
            </div>
            <p style={{ margin: 0, color: "#686973", fontSize: 15, lineHeight: 1.6 }}>
              Send a message to ask about availability. You can share your children&apos;s details from your profile.
            </p>
            <Link href={`/messages?provider=${provider.id}`} className="kc-btn" style={{ borderRadius: 16, padding: 16, fontSize: 16 }}>
              <Icon name="message" size={20} color="#ffffff" />
              Send a message
            </Link>
            <div style={{ display: "grid", gap: 8 }}>
              {phone && (
                <a href={`tel:${phone.replace(/\s/g, "")}`} style={outlineAction}>{phone}</a>
              )}
              {email && (
                <a href={`mailto:${email}`} style={outlineAction}>Email provider</a>
              )}
              {whatsappDigits && (
                <a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noreferrer" style={outlineAction}>WhatsApp</a>
              )}
            </div>
            <CompareToggle providerId={provider.id} />
            <div style={{ borderTop: "1px solid #d7edf0", paddingTop: 14, fontSize: 14, lineHeight: 1.6, color: "#686973" }}>
              Kidcellence recommends confirming references, visit times, fees, and child safety policies before booking.
            </div>
          </aside>
        </div>

        {similar.length > 0 && (
          <section style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 16 }}>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>More {categoryLabel.toLowerCase()} providers</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: 24 }}>
              {similar.map((item) => (
                <ProviderCard key={item.id} provider={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
