import { NextResponse } from "next/server";

import { hero, methodHighlights, seasonalOffer } from "@/lib/site-content";
import { fetchSiteSettings } from "@/lib/sanity";

export async function GET() {
  const settings = await fetchSiteSettings();

  return NextResponse.json({
    fallback: {
      hero,
      methodHighlights,
      seasonalOffer
    },
    cms: settings,
    cmsEnabled: Boolean(settings)
  });
}
