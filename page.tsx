"use client";
 
import HeroVideo from "@/app/components/heroVideo";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
 
const sections = [
  {
    title: "About Us",
    text: "We build modern, scalable and high-performance web applications for businesses worldwide.",
    img: "imag/about us.png",
    link:"/aboutUs",
  },
  {
    title: "Services",
    text: "We provide full-stack development, UI/UX design, and cloud-based solutions.",
    img: "imag/our services.png",
    link:"/services",
  },
  {
    title: "Projects",
    text: "Explore our innovative projects built with modern technologies like React, Next.js and Node.js.",
    img: "imag/our projects.png",
    link:"/projects",
  },
  {
    title: "Our Team",
    text: "A passionate team of developers, designers and creators working together to build amazing products.",
    img: "imag/our team.png",
    link:"/ourTeam",
  },
  {
    title: "Careers",
    text: "Join our growing team and build your future with exciting opportunities in tech.",
    img: "imag/our careers.png",
    link:"/careers",
  },
];
 
export default function Home() {
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
 const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      sectionRefs.current.forEach((section) => {
        if (!section) return;
        const rect = section.getBoundingClientRect();
        const progress = (window.innerHeight - rect.top) / (rect.height + window.innerHeight);
        const parallax = Math.max(-0.4, Math.min(0.4, progress - 0.5)) * 45;
 
        const image = section.querySelector(".parallax-media") as HTMLElement;
        if (image) {
          image.style.transform = `translateY(${parallax}px) scale(1.08)`;
        }
      });
    };
 
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
 
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-950 dark:to-gray-900">
 
      {/* 🔥 HERO SECTION */}
      <section className="relative w-full h-screen overflow-hidden">
        <div className="absolute inset-0">
          <HeroVideo />
        </div>
        {/* <div className="absolute inset-0 bg-black/50" /> */}
       
        {/* Optional Hero Content */}
        <div className="absolute inset-0 flex items-center justify-center text-center z-10 px-6">
          <div className="max-w-4xl">
            <h1 className="text-6xl md:text-7xl font-bold text-white tracking-tighter mb-6">
              
            </h1>
            <p className="text-xl text-gray-200 max-w-2xl mx-auto">
              
            </p>
          </div>
        </div>
      </section>
 
      {/* 📄 PREMIUM SECTIONS */}
      <div className="bg-white dark:bg-gray-950 py-28 lg:py-36 space-y-36 overflow-hidden">
        {sections.map((item, index) => (
          <section
            key={item.title}
            ref={(el) => { sectionRefs.current[index] = el; }}
            className="max-w-7xl mx-auto px-6 lg:px-8"
          >
            <div className={`grid md:grid-cols-2 gap-16 lg:gap-24 items-center ${index % 2 !== 0 ? 'md:flex-row-reverse' : ''}`}>
 
              {/* === MEDIA SIDE - Heavy Cinematic Look === */}
              <div className="relative group">
                <div className="relative rounded-[3rem] overflow-hidden shadow-2xl shadow-black/60 border border-gray-100 dark:border-gray-800 bg-black">
                 
                  <img
                    src={item.img}
                    alt={item.title}
                    className="parallax-media w-full aspect-[16/10] object-cover transition-transform duration-1000"
                  />
 
                  {/* Layered Overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30" />
 
                  {/* Hover Shine */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                 
                  {/* Glass Border */}
                  <div className="absolute inset-0 rounded-[3rem] border border-white/20 pointer-events-none" />
                </div>
 
                {/* Floating Decorative Badge */}
                <div className="absolute -top-6 -right-6 bg-gradient-to-br from-blue-600 to-purple-600 text-white px-6 py-3 rounded-2xl font-semibold shadow-2xl flex items-center gap-2 text-sm z-10">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                  </span>
                  LIVE PREVIEW
                </div>
              </div>
 
              {/* === CONTENT SIDE === */}
              <div className="space-y-10">
                <div className="flex items-center gap-4">
                  <div className="h-0.5 w-16 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 rounded-full" />
                  <span className="uppercase tracking-[4px] text-xs font-semibold text-blue-600 dark:text-blue-400">
                    {String(index + 1).padStart(2, "0")} — FEATURE
                  </span>
                </div>
 
                <h2 className="text-5xl lg:text-6xl xl:text-7xl font-bold leading-none tracking-tighter text-gray-900 dark:text-white">
                  {item.title}
                </h2>
 
                <p className="text-2xl text-gray-600 dark:text-gray-300 leading-relaxed max-w-lg">
                  {item.text}
                </p>
 
                <div className="flex flex-wrap gap-4 pt-6">
                  <button
                    onClick={() => router.push(item.link)}
                    className="group relative px-10 py-5 text-lg font-semibold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl overflow-hidden hover:scale-105 active:scale-95 transition-all duration-300 shadow-xl shadow-indigo-500/30 flex items-center gap-3"
                  >
                    Explore {item.title}

                    <span className="group-hover:translate-x-2 transition duration-300">
                      →
                    </span>

                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-[250%] transition-transform duration-700" />
                  </button>
                </div>
 
                {/* Trust Bar */}
                <div className="pt-8 flex items-center gap-8 text-sm text-gray-500 dark:text-gray-400">
                  <div>✓ Trusted by 12,000+ businesses</div>
                  <div>4.98 ★★★★★</div>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}