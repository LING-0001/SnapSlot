import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/lib/locales";
import { snapshotCopy } from "@/lib/snapshot-copy";
import SnapshotSite from "@/components/snapshot-site";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
export const dynamicParams = false;
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) return {};
  const copy = snapshotCopy[locale as Locale];
  const title = `${copy.name} — ${copy.headline.join(" ")}`;
  return {
    title, description: copy.description,
    icons: { icon: "/brand/current/snapslot.png" },
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, `/${l}/`])) },
    openGraph: { title, description: copy.description, locale, type: "website" },
  };
}
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  return <SnapshotSite locale={locale as Locale} />;
}
