import { ThemeToggle } from "@/src/lib/theme";
import { getBusinessesByClerkUserId } from "@/src/services/business";
import { auth } from "@clerk/nextjs/server";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const { userId } = await auth();

  if (userId) {
    const businesses = getBusinessesByClerkUserId(userId);
    if (businesses.length > 0) redirect(`/owner/${businesses[0].id}`);
    redirect("/setup");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="flex flex-col items-center gap-8 max-w-lg text-center">
        <Image
          src="/wrenlo-logo.svg"
          alt="wrenlo"
          width={200}
          height={60}
          priority
        />

        <p className="text-(--text-secondary) text-lg leading-relaxed">
          An AI front desk that knows your business, handles customers, and
          sends you the leads that matter.
        </p>

        <Link
          href="/sign-up"
          className="bg-brand hover:bg-brand-hover text-white font-semibold px-8 py-3 rounded-full transition-colors"
        >
          Get started
        </Link>

        <p className="text-(--text-muted) text-sm">Coming soon</p>
      </div>
    </main>
  );
}
