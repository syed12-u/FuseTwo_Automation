// Read the real QA mailbox so tests can follow the signup verification e-mail.
//
// Registration e-mails are plus-addressed (syed.shah+auto...@flexoffers.com),
// so every automated signup lands in one real inbox and can be matched back to
// the test that created it by its unique recipient address. No fake or
// throwaway mail domain is involved.
//
// Two backends:
//
//   outlook  Reads the signed-in Outlook profile over COM. Needs no
//            credentials at all - it reuses the Windows session of whoever runs
//            the tests. Workstations only; Outlook must be installed.
//
//   graph    Microsoft Graph with an Azure AD app registration (Mail.Read
//            application permission). This is the backend for CI, where there
//            is no Outlook profile.
//
// "auto" (the default) prefers Graph when it is configured and otherwise falls
// back to Outlook on Windows.
//
// A mailbox password is deliberately unsupported: Microsoft has disabled basic
// authentication on modern tenants and MFA would block it, so a password could
// not work even if supplied.

import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";
import { env, isMailboxConfigured } from "../config/environment";

const execFileAsync = promisify(execFile);
const GRAPH = "https://graph.microsoft.com/v1.0";
const PS_SCRIPT = path.resolve(__dirname, "outlookMailbox.ps1");

export type MailboxBackend = "graph" | "outlook";

export interface MailMatch {
  subject: string;
  to: string;
  receivedTime: string;
}

export interface MailFilter {
  timeoutMs?: number;
  /** Only match messages whose subject matches this. */
  subjectMatch?: RegExp;
  /** Ignore messages whose subject matches this (e.g. the verification e-mail). */
  subjectNotLike?: RegExp;
  /** Only match messages received at/after this time. */
  since?: Date;
}

export interface VerificationMail {
  subject: string;
  to: string;
  receivedTime: string;
  /**
   * The link behind the "Verify email address" call to action.
   *
   * These e-mails are sent through HubSpot, so this is normally a HubSpot
   * tracking redirect (hubspotlinks.com/Ctc/...) rather than a URL on the
   * advertiser host. It must be followed, not pattern-matched against the app
   * domain - an earlier version filtered on the app host and found nothing.
   */
  link: string;
}

/** Which backend will be used, or null when none is available. */
export function mailboxBackend(): MailboxBackend | null {
  const requested = (process.env.MAILBOX_BACKEND ?? "auto").toLowerCase();

  if (requested === "graph") return isMailboxConfigured() ? "graph" : null;
  if (requested === "outlook")
    return process.platform === "win32" ? "outlook" : null;

  if (isMailboxConfigured()) return "graph";
  return process.platform === "win32" ? "outlook" : null;
}

export function isMailboxAvailable(): boolean {
  return mailboxBackend() !== null;
}

export function mailboxUnavailableReason(): string {
  return (
    "No mailbox backend available. Either run on a Windows machine with Outlook " +
    'signed in (backend "outlook"), or set GRAPH_TENANT_ID / GRAPH_CLIENT_ID / ' +
    'GRAPH_CLIENT_SECRET for an Azure AD app with Mail.Read (backend "graph"). ' +
    "See .env.example."
  );
}

// --------------------------------------------------------------------------
// Outlook COM backend
// --------------------------------------------------------------------------

interface OutlookResult {
  found: boolean;
  error?: string;
  subject?: string;
  to?: string;
  receivedTime?: string;
  verifyLinks?: string[];
  linkCount?: number;
}

async function waitViaOutlook(
  recipient: string,
  timeoutMs: number,
): Promise<VerificationMail> {
  const timeoutSeconds = Math.ceil(timeoutMs / 1000);

  const { stdout } = await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      PS_SCRIPT,
      "-Recipient",
      recipient,
      "-TimeoutSeconds",
      String(timeoutSeconds),
    ],
    {
      timeout: timeoutMs + 60_000,
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
    },
  );

  let result: OutlookResult;
  try {
    result = JSON.parse(stdout.trim());
  } catch {
    throw new Error(
      `Could not parse the Outlook reader output:\n${stdout.slice(0, 500)}`,
    );
  }

  if (!result.found) {
    throw new Error(
      result.error ?? `No message for ${recipient} was found in Outlook.`,
    );
  }

  const links = result.verifyLinks ?? [];
  if (links.length === 0) {
    throw new Error(
      `Found "${result.subject}" for ${recipient} but no verify/confirm link in it ` +
        `(${
          result.linkCount ?? 0
        } links total). The e-mail template may have changed.`,
    );
  }

  return {
    subject: result.subject ?? "",
    to: result.to ?? recipient,
    receivedTime: result.receivedTime ?? "",
    link: links[0],
  };
}

// --------------------------------------------------------------------------
// Microsoft Graph backend
// --------------------------------------------------------------------------

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000)
    return cachedToken.token;

  const url = `https://login.microsoftonline.com/${env.graph.tenantId}/oauth2/v2.0/token`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.graph.clientId!,
      client_secret: env.graph.clientSecret!,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Could not obtain a Graph token (HTTP ${response.status}). Check the app ` +
        `registration and that admin consent was granted.\n${(
          await response.text()
        ).slice(0, 400)}`,
    );
  }

  const json = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.token;
}

/** Anchors whose visible text asks the reader to verify. */
function verifyLinksFromHtml(html: string): string[] {
  const anchors = html.matchAll(
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>(.*?)<\/a>/gis,
  );
  const links: string[] = [];

  for (const anchor of anchors) {
    const text = anchor[2].replace(/<[^>]+>/g, " ");
    if (/verify|confirm|activate/i.test(text)) {
      links.push(anchor[1].replace(/&amp;/g, "&"));
    }
  }
  return [...new Set(links)];
}

async function waitViaGraph(
  recipient: string,
  timeoutMs: number,
): Promise<VerificationMail> {
  const target = recipient.toLowerCase();
  const deadline = Date.now() + timeoutMs;
  const mailbox = encodeURIComponent(env.graph.mailbox);

  while (Date.now() < deadline) {
    const token = await getAccessToken();
    const url =
      `${GRAPH}/users/${mailbox}/mailFolders/inbox/messages` +
      `?$top=40&$orderby=receivedDateTime desc` +
      `&$select=subject,receivedDateTime,toRecipients,body`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(
        `Graph rejected the mailbox read (HTTP ${response.status}) for ${env.graph.mailbox}. ` +
          `The app registration needs Mail.Read (application) with admin consent.\n` +
          `${(await response.text()).slice(0, 400)}`,
      );
    }

    const json = (await response.json()) as { value: any[] };
    for (const message of json.value) {
      const recipients: string[] = (message.toRecipients ?? []).map((r: any) =>
        (r.emailAddress?.address ?? "").toLowerCase(),
      );
      if (!recipients.includes(target)) continue;

      const links = verifyLinksFromHtml(message.body?.content ?? "");
      if (links.length === 0) {
        throw new Error(
          `Found "${message.subject}" for ${recipient} but no verify/confirm link in it. ` +
            `The e-mail template may have changed.`,
        );
      }

      return {
        subject: message.subject ?? "",
        to: target,
        receivedTime: message.receivedDateTime,
        link: links[0],
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  throw new Error(
    `No message for ${recipient} arrived in ${env.graph.mailbox} within ${
      timeoutMs / 1000
    }s.`,
  );
}

// --------------------------------------------------------------------------

/**
 * Wait for the verification e-mail sent to `recipient` and return the link
 * behind its call to action.
 */
export async function waitForVerificationMail(
  recipient: string,
  options: { timeoutMs?: number } = {},
): Promise<VerificationMail> {
  const timeoutMs = options.timeoutMs ?? 180_000;
  const backend = mailboxBackend();

  if (backend === "graph") return waitViaGraph(recipient, timeoutMs);
  if (backend === "outlook") return waitViaOutlook(recipient, timeoutMs);
  throw new Error(mailboxUnavailableReason());
}

/**
 * Wait for any message to `recipient` matching the filter, and return its
 * metadata. Used for status-change notifications, which have no verification
 * link but do need to be confirmed as delivered.
 */
export async function waitForMailTo(
  recipient: string,
  filter: MailFilter = {},
): Promise<MailMatch> {
  const timeoutMs = filter.timeoutMs ?? 120_000;
  const backend = mailboxBackend();
  if (!backend) throw new Error(mailboxUnavailableReason());

  if (backend === "outlook") {
    const args = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      PS_SCRIPT,
      "-Recipient",
      recipient,
      "-TimeoutSeconds",
      String(Math.ceil(timeoutMs / 1000)),
    ];
    if (filter.subjectMatch)
      args.push("-SubjectMatch", filter.subjectMatch.source);
    if (filter.subjectNotLike)
      args.push("-SubjectNotLike", filter.subjectNotLike.source);
    if (filter.since) args.push("-SinceIso", filter.since.toISOString());

    const { stdout } = await execFileAsync("powershell.exe", args, {
      timeout: timeoutMs + 60_000,
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
    });
    const result = JSON.parse(stdout.trim());
    if (!result.found) {
      throw new Error(
        result.error ?? `No matching message for ${recipient} in Outlook.`,
      );
    }
    return {
      subject: result.subject ?? "",
      to: result.to ?? recipient,
      receivedTime: result.receivedTime ?? "",
    };
  }

  // Graph
  const target = recipient.toLowerCase();
  const deadline = Date.now() + timeoutMs;
  const mailbox = encodeURIComponent(env.graph.mailbox);

  while (Date.now() < deadline) {
    const token = await getAccessToken();
    const url =
      `${GRAPH}/users/${mailbox}/mailFolders/inbox/messages` +
      `?$top=40&$orderby=receivedDateTime desc` +
      `&$select=subject,receivedDateTime,toRecipients`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(
        `Graph rejected the mailbox read (HTTP ${response.status}).`,
      );
    }
    const json = (await response.json()) as { value: any[] };

    for (const message of json.value) {
      const recipients: string[] = (message.toRecipients ?? []).map((r: any) =>
        (r.emailAddress?.address ?? "").toLowerCase(),
      );
      if (!recipients.includes(target)) continue;
      const subject: string = message.subject ?? "";
      if (filter.subjectMatch && !filter.subjectMatch.test(subject)) continue;
      if (filter.subjectNotLike && filter.subjectNotLike.test(subject))
        continue;
      if (filter.since && new Date(message.receivedDateTime) < filter.since)
        continue;
      return { subject, to: target, receivedTime: message.receivedDateTime };
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  throw new Error(
    `No matching message for ${recipient} within ${timeoutMs / 1000}s.`,
  );
}
