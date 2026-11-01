type RouteLoadingProps = { route: "home" | "inbox" | "market" | "profile" | "notifications" };

const panel = "animate-pulse rounded-2xl border border-white/10 bg-[#141028]";

export default function RouteLoading({ route }: RouteLoadingProps) {
  if (route === "profile") {
    return (
      <main className="min-h-screen bg-[#09061a]">
        <div className="h-[360px] animate-pulse bg-gradient-to-br from-violet-950 via-[#17122b] to-fuchsia-950 sm:h-[420px]" />
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className={`${panel} h-24`} />
          <div className="mt-6 grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }, (_, index) => <div key={index} className={`${panel} aspect-square`} />)}
          </div>
        </div>
      </main>
    );
  }

  if (route === "inbox") {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-3 py-5 pb-24">
        <div className={`${panel} h-[min(76vh,760px)]`}>
          <div className="border-b border-white/10 p-4"><div className="h-6 w-32 rounded bg-white/10" /></div>
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-16 rounded-xl bg-white/5" />)}
          </div>
        </div>
      </main>
    );
  }

  if (route === "market") {
    return (
      <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 pb-24">
        <div className="mb-6 h-9 w-56 animate-pulse rounded bg-white/10" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => <div key={index} className={`${panel} aspect-[4/5]`} />)}
        </div>
      </main>
    );
  }

  if (route === "notifications") {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-4 py-8 pb-24">
        <div className="mb-6 h-10 w-48 animate-pulse rounded bg-white/10" />
        <div className="space-y-3">
          {Array.from({ length: 7 }, (_, index) => <div key={index} className={`${panel} h-20`} />)}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-3 py-5 pb-24 sm:px-5">
      <div className="mb-5 h-12 w-48 animate-pulse rounded bg-white/10" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => <div key={index} className={`${panel} h-64`} />)}
        </div>
        <div className={`${panel} hidden h-96 lg:block`} />
      </div>
    </main>
  );
}
