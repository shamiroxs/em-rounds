
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-[#0B1220] text-white">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-7">
        <div>
          <span className="text-xl font-bold tracking-tight">
            EM ROUNDS <span className="text-cyan-400">with PK</span>
          </span>
        </div>

        <span className="rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300">
          Medical Education
        </span>
      </header>

      <section className="flex flex-1 items-center justify-center px-6 py-20">
        <div className="max-w-3xl text-center">
          <p className="mb-6 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            Learn · Practise · Master
          </p>

          <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-7xl">
            EMERGENCY
            <br />
            MEDICINE
            <span className="block text-cyan-400">Education.</span>
          </h1>

          <p className="mx-auto mt-8 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
            A structured learning platform for emergency medicine.
            Explore clinical topics, strengthen your knowledge and
            develop confidence in emergency care.
          </p>

          <div className="mt-12">
            <span className="inline-block rounded-lg bg-cyan-500 px-7 py-3 font-semibold text-slate-950">
              EM ROUNDS with PK
            </span>
          </div>

          <p className="mt-16 text-sm text-slate-500">
            An educational initiative by Dr. Roshan PK
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-800 px-6 py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} EM ROUNDS with PK. All rights reserved.
      </footer>
    </main>
  );
}
