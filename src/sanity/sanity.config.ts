import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";

import { env } from "@/lib/env";
import { schemaTypes } from "@/sanity/schemaTypes";

export default defineConfig({
  name: "default",
  title: "New Valkyria Studio",
  projectId: env.sanityProjectId ?? "replace-project-id",
  dataset: env.sanityDataset ?? "production",
  basePath: "/studio",
  schema: {
    types: schemaTypes
  },
  plugins: [structureTool(), visionTool()]
});
