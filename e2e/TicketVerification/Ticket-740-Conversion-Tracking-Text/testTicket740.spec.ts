import { expect, test } from "@playwright/test";
import { AUTH_FILE, appUrl } from "../../../config/environment";
import { dismissPaymentReminderIfPresent } from "../../../utility/appActions";

/**
 * TICKET #740 — Conversion Tracking > Edit JavaScript Code
 * Page: /app/settings/trackingpixel
 *
 * Requirement (from the ticket):
 *   1. Change "Javascript" to "JavaScript".
 *   2. Remove the extra space/line after the </script> tag.
 *
 * The test asserts the FIXED behaviour, so it fails until the fix ships.
 */
test.describe("@ticket-740 Conversion Tracking JavaScript text", () => {
  test.use({ storageState: AUTH_FILE });

  test('the conversion-tracking area spells "JavaScript" correctly @ticket-740', async ({
    page,
  }) => {
    await page.goto(appUrl("/app/settings/trackingpixel"), {
      waitUntil: "domcontentloaded",
    });
    await dismissPaymentReminderIfPresent(page);
    await expect(page).not.toHaveURL(/\/signin/i);

    // Look at the conversion-tracking content specifically.
    const bodyText = await page.locator("body").innerText();

    // Requirement 1: the correct casing is present, the incorrect one is gone.
    expect(bodyText, "page did not render the tracking content").toMatch(
      /conversion tracking/i,
    );
    expect(
      /\bJavascript\b/.test(bodyText),
      'the mis-cased "Javascript" is still shown (ticket #740 not fixed)',
    ).toBe(false);
    expect(
      /\bJavaScript\b/.test(bodyText),
      'expected the correctly-cased "JavaScript"',
    ).toBe(true);
  });
});
