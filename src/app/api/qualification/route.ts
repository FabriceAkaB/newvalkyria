import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getResendClient } from "@/lib/resend";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { birth_year, club, division, phone, email, expectations } = body;

    if (env.resendApiKey) {
      const resend = getResendClient();
      void resend.emails.send({
        from: env.resendFrom,
        to: "jpaka06@gmail.com",
        subject: `Nouvelle qualification — ${email}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a2e;max-width:600px">
            <h2 style="font-size:20px;margin-bottom:4px">Nouvelle qualification reçue</h2>
            <p style="color:#666;font-size:13px;margin-top:0">New Valkyria · ${new Date().toLocaleString("fr-CA", { timeZone: "America/Toronto" })}</p>
            <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">
              <tr style="background:#f4f0fb">
                <td style="padding:8px 12px;font-weight:bold;width:40%">Année de naissance</td>
                <td style="padding:8px 12px">${birth_year}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;font-weight:bold;background:#fafafa">Club</td>
                <td style="padding:8px 12px">${club}</td>
              </tr>
              <tr style="background:#f4f0fb">
                <td style="padding:8px 12px;font-weight:bold">Division</td>
                <td style="padding:8px 12px">${division}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;font-weight:bold;background:#fafafa">Téléphone</td>
                <td style="padding:8px 12px"><a href="tel:${phone}">${phone}</a></td>
              </tr>
              <tr style="background:#f4f0fb">
                <td style="padding:8px 12px;font-weight:bold">Courriel</td>
                <td style="padding:8px 12px"><a href="mailto:${email}">${email}</a></td>
              </tr>
              <tr>
                <td style="padding:8px 12px;font-weight:bold;background:#fafafa">Attentes</td>
                <td style="padding:8px 12px">${expectations}</td>
              </tr>
            </table>
            <p style="margin-top:24px;font-size:13px;color:#888">Ce message a été envoyé automatiquement par le site New Valkyria.</p>
          </div>
        `
      });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
