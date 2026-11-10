// Every route the Kidcellence UI links to, in one place. These are the live
// application's routes; the design export's own URLs (/browse, /family,
// /dashboard) are mapped onto them here.
export const routes = {
  home: "/",
  browse: "/search",
  compare: "/compare",
  pricing: "/pricing",
  messages: "/messages",
  auth: "/auth",
  login: "/auth?mode=login",
  providerSignup: "/auth?role=provider",
  parentProfile: "/profile/parent",
  providerDashboard: "/profile/provider",
  settings: "/settings",
  admin: "/admin",
  adminFeatured: "/admin/featured-providers",
  safety: "/safety",
  help: "/help",
  privacy: "/privacy",
  terms: "/terms",
  provider: (id: string) => `/provider/${encodeURIComponent(id)}`,
  search: (params: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
    const text = query.toString();
    return text ? `/search?${text}` : "/search";
  },
} as const;
