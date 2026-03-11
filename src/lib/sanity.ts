import { createClient } from "next-sanity";
import groq from "groq";

import { env } from "@/lib/env";

export const sanityClient =
  env.sanityProjectId && env.sanityDataset
    ? createClient({
        projectId: env.sanityProjectId,
        dataset: env.sanityDataset,
        apiVersion: env.sanityApiVersion,
        useCdn: true,
        token: env.sanityToken
      })
    : null;

export const siteSettingsQuery = groq`*[_type == "siteSettings"][0]`;

export async function fetchSiteSettings() {
  if (!sanityClient) {
    return null;
  }

  return sanityClient.fetch(siteSettingsQuery);
}
