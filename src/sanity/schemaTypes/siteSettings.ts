import { defineField, defineType } from "sanity";

export const siteSettingsType = defineType({
  name: "siteSettings",
  title: "Site Settings",
  type: "document",
  fields: [
    defineField({
      name: "heroTitle",
      title: "Hero Title",
      type: "string",
      validation: (rule) => rule.required()
    }),
    defineField({
      name: "heroDescription",
      title: "Hero Description",
      type: "text",
      rows: 4
    }),
    defineField({
      name: "primaryCta",
      title: "Primary CTA",
      type: "string"
    }),
    defineField({
      name: "offerPrice",
      title: "Offer Price",
      type: "string"
    }),
    defineField({
      name: "offerSummary",
      title: "Offer Summary",
      type: "text",
      rows: 3
    })
  ]
});
