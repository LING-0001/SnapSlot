import { notFound } from "next/navigation";
import { Suspense } from "react";
import { locales, type Locale } from "@/lib/messages";
import { RailPrototype } from "@/components/prototype-rail";

// PROTOTYPE — three Windows rail/settings directions, switchable with ?variant=A|B|C.
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }
export default async function PrototypeRailPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  return <Suspense><RailPrototype locale={locale} /></Suspense>;
}
