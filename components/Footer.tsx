import Link from "next/link";
import { Star, Globe, Share2, Camera } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7C3AED, #F9A8D4)" }}>
                <Star className="w-4 h-4 text-white fill-white" />
              </div>
              <span className="text-xl font-bold text-white">Kidcexcellence</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              Connecting Botswana families with trusted, verified childcare services. Your child deserves the very best.
            </p>
            <div className="flex gap-3 mt-4">
              <a href="#" className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center hover:bg-purple-600 transition-colors">
                <Globe className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center hover:bg-purple-600 transition-colors">
                <Share2 className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center hover:bg-purple-600 transition-colors">
                <Camera className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="#" className="hover:text-purple-400 transition-colors">About Us</Link></li>
              <li><Link href="#" className="hover:text-purple-400 transition-colors">How It Works</Link></li>
              <li><Link href="#" className="hover:text-purple-400 transition-colors">For Providers</Link></li>
              <li><Link href="/admin?admin=true" className="hover:text-purple-400 transition-colors">Admin</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="#" className="hover:text-purple-400 transition-colors">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-purple-400 transition-colors">Terms of Service</Link></li>
              <li><Link href="#" className="hover:text-purple-400 transition-colors">Contact Us</Link></li>
              <li><Link href="#" className="hover:text-purple-400 transition-colors">Help Centre</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-gray-500 text-sm">
            © 2025 Kidcexcellence. All rights reserved.
          </p>
          <p className="text-gray-500 text-sm">
            Made with ❤️ for Botswana families
          </p>
        </div>
      </div>
    </footer>
  );
}
