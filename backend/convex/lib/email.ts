/**
 * Resend email notification (spec 04 / ADR 0003).
 *
 * Sends the audit-ready notification from the Convex action. A missing key or
 * any Resend error is logged and NEVER thrown — email must not fail the audit.
 */

export type SendAuditReadyEmailArgs = {
  to: string
  domain: string
  auditId: string
}

/** Fire-and-forget; resolves (never rejects) regardless of outcome. */
export async function sendAuditReadyEmail(args: SendAuditReadyEmailArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !from) {
    console.log(
      `[email] Skipping audit-ready email to ${args.to}: RESEND_API_KEY / RESEND_FROM_EMAIL not set`,
    )
    return
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: `Your audit of ${args.domain} is ready`,
        text: `Good news — the audit of ${args.domain} finished successfully. Open EZ Audit to view the results.`,
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      console.error(
        `[email] Resend request failed: HTTP ${response.status}${detail ? ` — ${detail.slice(0, 300)}` : ""}`,
      )
    } else {
      console.log(`[email] Audit-ready email sent to ${args.to} for ${args.domain}`)
    }
  } catch (error) {
    console.error("[email] Unexpected error sending audit-ready email:", error)
  }
}
