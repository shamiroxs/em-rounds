import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main className="app-shell flex flex-col">
      <header className="site-header mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-7">
        <div>
         <span className="brand text-xl">
          EM ROUNDS <span className="brand-accent">with PK</span>
        </span>
        </div>

        <div className="flex items-center gap-3">
        <ThemeToggle />
        </div>
      </header>

      <section className="hero-section flex flex-1 items-center justify-center px-6 py-20">
        <div className="max-w-3xl text-center">
          <p className="eyebrow mb-6">
            Learn · Practise · Master
          </p>

          <h1 className="hero-title">
            EMERGENCY
            <br />
            MEDICINE
            <span className="hero-accent block">Education.</span>
          </h1>

          <p className="body-copy mx-auto mt-8 max-w-xl text-base sm:text-lg">
            A structured learning platform for emergency medicine.
            Explore clinical topics, strengthen your knowledge and
            develop confidence in emergency care.
          </p>

          <div className="mt-12 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="/signup" className="primary-button">
              Create your account
            </a>
            <a href="/login" className="secondary-button">
              Sign in
            </a>
          </div>

          <p className="mt-16 text-sm"
              style={{ color: "var(--subtle)" }}>
            An educational initiative by Dr. Roshan PK
          </p>
        </div>
      </section>

      <footer className="site-footer px-6 py-6 text-center text-xs">
        © 2026 EM ROUNDS with PK. All rights reserved.
      </footer>
    </main>
  );
}
