import { expect, test } from "@playwright/test";
import ReconcileSalesPage from "../../pages/ReconcileSalesPage";
import { AUTH_FILE, env } from "../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../utility/appActions";
import {
  isMailboxAvailable,
  mailboxUnavailableReason,
  readMailBody,
  waitForMailTo,
} from "../../utility/mailbox";

/**
 * "Sales Adjustment Notice" e-mail: after an adjustment is posted through the
 * reconciliation API, the advertiser account receives a notice whose body
 * names the order, the program and the new amount that were sent.
 *
 * The notice goes to the advertiser account's e-mail (FO_USERNAME). The suite
 * can only read the QA mailbox and its plus-addresses, so this test runs only
 * when the advertiser account is one of those; otherwise it skips and says why.
 */
const toNumber = (s: string) => Number(s.replace(/[$,]/g, ""));
const mailboxLocalPart = (address: string) => address.split("@")[0].split("+")[0].toLowerCase();
const mailboxDomain = (address: string) => address.split("@")[1]?.toLowerCase();
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** "$1,234.50", "1234.50" and "$ 1234.50" all count as the same amount in a mail body. */
const amountPattern = (amount: number) => {
  const [whole, cents] = amount.toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",?");
  return new RegExp(`(?<![\\d.])\\$?\\s?${grouped}\\.${cents}(?!\\d)`);
};

test.describe("Reconcile Sales - Sales Adjustment Notice e-mail @write", () => {
  test.use({ storageState: AUTH_FILE });
  test.setTimeout(6 * 60 * 1000);

  test("an API sale adjustment produces a Sales Adjustment Notice whose body names the order, program and amount sent", async ({
    page,
  }) => {
    const recipient = env.advertiser.username ?? "";
    const readable =
      isMailboxAvailable() &&
      mailboxLocalPart(recipient) === mailboxLocalPart(env.graph.mailbox) &&
      mailboxDomain(recipient) === mailboxDomain(env.graph.mailbox);
    test.skip(
      !readable,
      !isMailboxAvailable()
        ? mailboxUnavailableReason()
        : `the notice is sent to ${recipient}, which is not the readable QA mailbox (${env.graph.mailbox})`,
    );

    const reconcile = new ReconcileSalesPage(page);
    await reconcile.navigateToReconcileSales();
    await dismissPaymentReminderIfPresent(page);

    const found = await reconcile.findPendingSale();
    const sale = found.record;
    await reconcile.closeSalesDetails(found.dialog);
    const original = toNumber(sale["Sale Amount"]);
    const adjusted = Math.round((original + 3) * 100) / 100;

    await reconcile.openApiReconcileDrawer();
    const token = await reconcile.readApiToken();
    const trackingId = await reconcile.lookupTrackingId(sale["Program"]);
    await page.keyboard.press("Escape");

    const since = new Date(Date.now() - 60_000);
    const post = (amount: number, oldAmount: number, reason: string) =>
      reconcile.uploadReconciledSales(
        [{
          AdvertiserTrackingId: trackingId,
          OrderNumber: sale["Order Number"],
          SaleAdjustmentModel: { SaleAdjustmentAmount: amount, SaleAdjustmentReason: reason, OldSaleAdjustmentAmount: oldAmount },
        }],
        token,
      );

    try {
      expect((await post(adjusted, original, "Incorrect amount")).status).toBe(200);

      const mail = await waitForMailTo(recipient, {
        subjectMatch: /Sales? Adjustment/i,
        since,
        timeoutMs: 4 * 60_000,
      });
      console.log(`notice: "${mail.subject}" at ${mail.receivedTime}`);
      expect(mail.subject).toMatch(/Sales? Adjustment Notice/i);
      expect(mail.to.toLowerCase()).toContain(recipient.toLowerCase());

      // The body must describe the adjustment that was actually sent: the
      // same order number, program (advertiser program name) and new amount.
      const body = await readMailBody(recipient, mail);
      console.log(`notice body: ${body.text.slice(0, 400)}`);
      expect(body.text, "order number missing from the notice body").toMatch(
        new RegExp(escapeRegExp(sale["Order Number"]), "i"),
      );
      expect(body.text, "program name missing from the notice body").toMatch(
        new RegExp(escapeRegExp(sale["Program"]), "i"),
      );
      expect(body.text, `adjusted amount ${adjusted} missing from the notice body`).toMatch(
        amountPattern(adjusted),
      );
    } finally {
      expect((await post(original, adjusted, "Revert QA adjustment")).status).toBe(200);
    }
  });
});
