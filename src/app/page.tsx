import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/lib/theme";
import { getBusinessesByClerkUserId } from "@/services/business";
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

        <p className="text-muted-foreground text-lg leading-relaxed">
          An AI front desk that knows your business, handles customers, and
          sends you the leads that matter.
        </p>

        <Button asChild size="lg" className="rounded-full px-8">
          <Link href="/sign-up">Get started</Link>
        </Button>

        <p className="text-muted-foreground text-sm">Coming soon</p>
      </div>
    </main>
  );
}
