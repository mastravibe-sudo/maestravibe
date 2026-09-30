// path: maestra-vibe/app/page.tsx  (poori file replace karo)
import DbFeed from "@/components/DbFeed";
import HomeHero from "@/components/HomeHero";

export default function Home() {
  return (
    <>
      <div className="mx-auto max-w-3xl px-4">
        <HomeHero />
      </div>
      <div id="feed" className="scroll-mt-4">
        <DbFeed />
      </div>
    </>
  );
}