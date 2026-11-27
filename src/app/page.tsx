import Link from "next/link";

const features = [
  {
    number: "01",
    title: "Appointments",
    description:
      "Keep your schedule organised. Manage bookings, track appointment status and give every client a smoother experience.",
  },
  {
    number: "02",
    title: "Sales & POS",
    description:
      "Handle service and product sales, payments and transactions from one simple point of sale.",
  },
  {
    number: "03",
    title: "Customer Management",
    description:
      "Keep customer information, visit history and relationships organised in one place.",
  },
  {
    number: "04",
    title: "Staff Management",
    description:
      "Manage your team, assign services and understand staff performance across your branches.",
  },
  {
    number: "05",
    title: "Inventory",
    description:
      "Monitor products, stock levels and inventory movements without losing track of your supplies.",
  },
  {
    number: "06",
    title: "Reports & Accounting",
    description:
      "Understand your revenue, expenses and business performance with organised reports.",
  },
];

function DashboardPreview() {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div className="absolute -inset-5 rounded-[32px] bg-[#244333]/5 blur-2xl" />

      <div className="relative overflow-hidden rounded-xl border border-[#deded5] bg-[#faf9f6] shadow-[0_24px_80px_rgba(30,45,35,0.10)]">
        <div className="flex h-10 items-center gap-2 border-b border-[#e6e5dd] bg-white px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-[#d9ddd4]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#d9ddd4]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#d9ddd4]" />
          <div className="mx-auto rounded-md bg-[#f5f5f1] px-12 py-1 text-[9px] text-[#92958d]">
            app.psm.com/dashboard
          </div>
        </div>

        <div className="flex min-h-[390px] sm:min-h-[450px]">
          <aside className="hidden w-44 shrink-0 border-r border-[#e5e5dc] bg-[#f0f1eb] p-4 sm:block">
            <div className="mb-8">
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#244333]">
                PSM.
              </p>
              <p className="mt-1 text-[7px] tracking-[0.2em] text-[#8c9589]">
                BUSINESS MANAGEMENT
              </p>
            </div>

            <p className="mb-3 text-[8px] font-medium tracking-[0.15em] text-[#92998e]">
              WORKSPACE
            </p>

            {[
              "Dashboard",
              "Appointments",
              "Customers",
              "Services",
              "Products",
              "Inventory",
              "Sales",
              "Expenses",
              "Accounting",
              "Reports",
            ].map((item, index) => (
              <div
                key={item}
                className={`mb-1 rounded-md px-3 py-2 text-[10px] ${
                  index === 0
                    ? "border-l-2 border-[#244333] bg-[#e6ebe4] font-semibold text-[#244333]"
                    : "text-[#69766b]"
                }`}
              >
                {item}
              </div>
            ))}
          </aside>

          <div className="min-w-0 flex-1">
            <div className="flex h-14 items-center justify-between border-b border-[#e6e5dd] bg-white px-4 sm:px-7">
              <div>
                <p className="text-xs font-medium text-[#293d31]">
                  Business overview
                </p>
                <p className="mt-0.5 text-[9px] text-[#92958d]">
                  Welcome back to your workspace
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#244333] text-[9px] font-semibold text-white">
                  P
                </div>
                <span className="hidden text-[10px] text-[#536156] sm:block">
                  Business owner
                </span>
              </div>
            </div>

            <div className="p-4 sm:p-7">
              <div className="mb-6 flex items-end justify-between">
                <div>
                  <p className="text-[9px] font-medium tracking-[0.15em] text-[#879287]">
                    OVERVIEW
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-[#263c2e] sm:text-2xl">
                    Your salon at a glance.
                  </h3>
                  <p className="mt-1 text-[10px] text-[#92958d]">
                    A clear view of your business activity.
                  </p>
                </div>
                <div className="hidden rounded-md border border-[#e4e4db] px-3 py-2 text-[9px] text-[#69766b] sm:block">
                  Today
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  {
                    label: "Today's Revenue",
                    value: "₦ 485,000",
                    note: "Completed payments",
                  },
                  {
                    label: "Appointments",
                    value: "24",
                    note: "Today's bookings",
                  },
                  {
                    label: "Total Customers",
                    value: "1,284",
                    note: "Customer records",
                  },
                  {
                    label: "Pending Expenses",
                    value: "08",
                    note: "Awaiting payment",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg border border-[#e4e3da] bg-white p-3 sm:p-4"
                  >
                    <p className="text-[9px] text-[#7e897e]">{stat.label}</p>
                    <p className="mt-3 text-lg font-semibold tracking-tight text-[#294232] sm:text-xl">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-[8px] text-[#a0a49a]">
                      {stat.note}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1.5fr_1fr]">
                <div className="rounded-lg border border-[#e4e3da] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#344738]">
                      Revenue overview
                    </p>
                    <span className="text-[8px] text-[#92958d]">
                      LAST 7 DAYS
                    </span>
                  </div>

                  <div className="mt-6 flex h-24 items-end justify-between gap-2 border-b border-l border-[#edede7] px-2">
                    {[35, 55, 43, 75, 50, 90, 68].map((height, i) => (
                      <div
                        key={i}
                        className="w-full rounded-t-sm bg-[#829687]/70"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>

                  <div className="mt-2 flex justify-between text-[8px] text-[#a0a49a]">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                      (day) => (
                        <span key={day}>{day}</span>
                      ),
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-[#e4e3da] bg-white p-4">
                  <p className="text-xs font-semibold text-[#344738]">
                    Recent activity
                  </p>
                  <div className="mt-4 space-y-4">
                    {[
                      ["New appointment", "Client booking received"],
                      ["Payment completed", "Service payment recorded"],
                      ["Stock updated", "Inventory movement recorded"],
                    ].map(([title, detail]) => (
                      <div key={title} className="flex gap-2">
                        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#78917c]" />
                        <div>
                          <p className="text-[9px] font-medium text-[#536156]">
                            {title}
                          </p>
                          <p className="mt-1 text-[8px] text-[#a0a49a]">
                            {detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-center text-[8px] text-[#a0a49a]">
                A unified workspace for your salon business
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#faf9f6] text-[#293b30]">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-[#e9e8e0] bg-[#faf9f6]/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#244333] text-sm font-semibold text-white">
              P
            </div>
            <div>
              <p className="text-sm font-bold tracking-[0.13em] text-[#244333]">
                PSM
              </p>
              <p className="text-[8px] tracking-[0.18em] text-[#92958d]">
                SALON MANAGEMENT
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="text-xs text-[#657268] transition hover:text-[#244333]"
            >
              Features
            </a>
            <a
              href="#about"
              className="text-xs text-[#657268] transition hover:text-[#244333]"
            >
              About
            </a>
          </nav>

          <div className="flex items-center gap-3 sm:gap-5">
            <Link
              href="/login"
              className="text-xs font-medium text-[#536156] transition hover:text-[#244333]"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-[#244333] px-4 py-2.5 text-xs font-medium text-white transition hover:bg-[#345b43] sm:px-5"
            >
              Get started <span className="ml-1">→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-5 pb-20 pt-20 sm:px-8 sm:pb-28 sm:pt-28 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#e4e5dc] bg-white px-4 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#66836b]" />
              <span className="text-[9px] font-medium tracking-[0.17em] text-[#718073]">
                SALON BUSINESS MANAGEMENT
              </span>
            </div>

            <h1 className="text-4xl font-semibold leading-[1.12] tracking-[-0.045em] text-[#263c2e] sm:text-5xl lg:text-6xl">
              Run your salon.
              <br />
              <span className="text-[#819384]">Everything in order.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-[#7d877d] sm:text-base">
              One organised workspace for appointments, sales, customers, staff,
              inventory and the everyday operations of your salon.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="flex w-full items-center justify-center gap-3 rounded-md bg-[#244333] px-7 py-3.5 text-xs font-medium text-white transition hover:bg-[#345b43] sm:w-auto"
              >
                Create your account <span>→</span>
              </Link>
              <a
                href="#features"
                className="w-full rounded-md border border-[#dedfd6] bg-white px-7 py-3.5 text-center text-xs font-medium text-[#536156] transition hover:border-[#aab7aa] sm:w-auto"
              >
                Explore features
              </a>
            </div>

            <p className="mt-5 text-[10px] text-[#a0a49a]">
              Designed to bring clarity to your salon business.
            </p>
          </div>

          <DashboardPreview />
        </div>
      </section>

      {/* Introduction */}
      <section
        id="about"
        className="border-y border-[#e9e8e0] bg-[#f1f2ec] px-5 py-20 sm:px-8 lg:px-12"
      >
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.18em] text-[#819384]">
              A BETTER WAY TO MANAGE
            </p>
            <h2 className="mt-4 max-w-lg text-3xl font-semibold leading-tight tracking-[-0.035em] text-[#293e31] sm:text-4xl">
              Spend less time managing tasks. More time growing your business.
            </h2>
          </div>
          <div>
            <p className="text-sm leading-7 text-[#778276]">
              Running a salon means keeping track of many moving parts. PSM
              brings your essential business operations together so you can work
              with more clarity, stay organised and make informed decisions.
            </p>
            <p className="mt-4 text-sm leading-7 text-[#778276]">
              From the first appointment to the final payment, your business has
              one place to stay organised.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-5 py-24 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.18em] text-[#819384]">
                EVERYTHING CONNECTED
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-[#293e31] sm:text-4xl">
                Your salon, organised.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[#879087]">
              The essential tools you need to manage your operations from one
              central workspace.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.number}
                className="group rounded-lg border border-[#e6e5dc] bg-white p-7 transition duration-200 hover:-translate-y-1 hover:border-[#c7d0c5] hover:shadow-[0_12px_35px_rgba(40,60,45,0.05)]"
              >
                <span className="text-[10px] font-medium tracking-[0.15em] text-[#9ca99b]">
                  {feature.number}
                </span>
                <h3 className="mt-8 text-lg font-semibold tracking-tight text-[#304536]">
                  {feature.title}
                </h3>
                <p className="mt-3 text-xs leading-6 text-[#858e83]">
                  {feature.description}
                </p>
                <div className="mt-6 h-px w-8 bg-[#b4c2b3] transition-all duration-200 group-hover:w-14" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="px-5 pb-24 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-xl bg-[#244333] px-6 py-16 text-center sm:px-12 sm:py-20">
          <p className="text-[10px] font-medium tracking-[0.2em] text-[#b9c8b9]">
            A MORE ORGANISED BUSINESS STARTS HERE
          </p>
          <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
            Bring your entire salon together.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-[#d0d9d0]/75">
            Give your salon a more organised way to manage its everyday
            operations.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex items-center gap-3 rounded-md bg-[#faf9f6] px-7 py-3.5 text-xs font-semibold text-[#244333] transition hover:bg-white"
          >
            Get started with PSM <span>→</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e8e7df] px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-bold tracking-[0.13em] text-[#244333]">
              PSM.
            </p>
            <p className="mt-1 text-[9px] text-[#92958d]">
              Salon business management.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-[11px] text-[#778276] hover:text-[#244333]"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-[11px] text-[#778276] hover:text-[#244333]"
            >
              Create account
            </Link>
          </div>

          <p className="text-[10px] text-[#a0a49a]">
            © 2026 PSM-App. All rights reserved.{" "}
          </p>
        </div>
      </footer>
    </main>
  );
}
