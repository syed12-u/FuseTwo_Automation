import { expect, test } from "@playwright/test";
import SignUpPage, {
  type CreatedAdvertiser,
} from "../../pages/FlexOffersSignUpPage";
import ManagementAdvertiserPage from "../../pages/ManagementAdvertiserPage";
import { ADVERTISER_STATUSES } from "../../fixtures/onboardingData";
import {
  isMailboxAvailable,
  mailboxUnavailableReason,
  waitForMailTo,
} from "../../utility/mailbox";

/**
 * Status-change e-mail notifications.
 *
 * Changing an advertiser's status does NOT send an e-mail on its own — that was
 * confirmed by watching the mailbox across many status changes. Instead,
 * submitting a status change opens an "Advertiser Email Notification" dialog
 * where staff optionally pick a template and press Send. This suite covers that
 * optional flow: the dialog appears, offers the expected templates, is
 * pre-addressed to the advertiser, and actually delivers when Send is used.
 *
 * @write throughout (creates an advertiser and sends real mail); the delivery
 * check additionally needs a mailbox backend and skips clearly without one.
 */
test.describe("Onboarding - status-change email notification @write", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(6 * 60 * 1000);

  let advertiser: CreatedAdvertiser;
  let advertiserId: string;

  /** A status different from the current one, so a change always occurs. */
  function differentStatus(current: string): string {
    const candidates = [
      ADVERTISER_STATUSES.followUp,
      ADVERTISER_STATUSES.collectPayment,
      ADVERTISER_STATUSES.initialSetup,
    ];
    return (
      candidates.find(
        (c) => !ManagementAdvertiserPage.sameStatus(current, c),
      ) ?? ADVERTISER_STATUSES.approved
    );
  }

  test("registering and locating the advertiser in management @blocker", async ({
    page,
  }) => {
    const signUp = new SignUpPage(page);
    advertiser = await signUp.registerNewAdvertiser();
    await expect(page.getByText(/thank you/i).first()).toBeVisible({
      timeout: 60_000,
    });

    const management = new ManagementAdvertiserPage(page);
    advertiserId = await management.searchAndOpen(advertiser.companyName);
    expect(advertiserId).toMatch(/^\d+$/);
    console.log(`advertiser ${advertiserId} <${advertiser.email}>`);
  });

  test("a status change opens the email dialog, pre-addressed with the expected templates @blocker", async ({
    page,
  }) => {
    expect(advertiserId, "registration step did not complete").toBeTruthy();

    const management = new ManagementAdvertiserPage(page);
    await management.openAdvertiserById(advertiserId);

    const current = await management.readStatus();
    const target = differentStatus(current);
    console.log(`current="${current}" -> target="${target}"`);

    await management.openChangeStatusDialog();
    await management.statusSelect.selectOption({ label: target });
    if (
      await management.statusDialogNotes
        .isVisible({ timeout: 3_000 })
        .catch(() => false)
    ) {
      await management.statusDialogNotes.fill("status email dialog test");
    }
    await expect(management.statusDialogSubmit).toBeEnabled({
      timeout: 30_000,
    });
    await management.statusDialogSubmit.click();

    // The notification dialog is the thing under test.
    await expect(management.emailDialog).toBeVisible({ timeout: 30_000 });

    const recipient = await management.emailRecipient();
    expect(
      recipient.toLowerCase(),
      "email dialog is not pre-addressed to the advertiser",
    ).toContain(advertiser.email.toLowerCase());

    const templates = await management.availableEmailTemplates();
    console.log(`templates offered: ${templates.join(", ")}`);
    expect(templates.length, "no e-mail templates offered").toBeGreaterThan(0);

    // Cancel — delivery is covered by the next test.
    await management.emailCancelButton.click();
    await expect(management.emailDialog).toBeHidden();
  });

  // KNOWN BUG: the "Advertiser Email Notification" dialog accepts a template and
  // closes cleanly on Send, but no e-mail is delivered. Confirmed on dev on
  // 2026-08-24: across many status changes plus an explicit Send of the
  // "Approval Login Information" template, zero notification e-mails reached the
  // advertiser inbox, while "Verify Your Email" consistently arrives within a
  // minute — so the mail path works, but status notifications do not dispatch.
  // Kept as an assertion so it starts passing (and the tag can be removed) once
  // delivery is fixed.
  test("sending a status template delivers an email to the advertiser @known-bug", async ({
    page,
  }) => {
    test.skip(!isMailboxAvailable(), mailboxUnavailableReason());
    expect(advertiserId, "registration step did not complete").toBeTruthy();

    const since = new Date(Date.now() - 60_000);
    const management = new ManagementAdvertiserPage(page);
    await management.openAdvertiserById(advertiserId);

    const current = await management.readStatus();
    const target = differentStatus(current);

    // Send a concrete template rather than the default first option
    // ("Advertiser or Publisher"), which behaves as a placeholder and does not
    // dispatch. "Approval Login Information" is a real, always-available template.
    const template = "Approval Login Information";
    console.log(
      `current="${current}" -> target="${target}", template="${template}"`,
    );

    const result = await management.changeStatus(
      target,
      "status email delivery test",
      {
        action: "send",
        template,
      },
    );
    console.log(
      `changed=${result.changed} sent template="${result.emailedTemplate}"`,
    );
    expect(result.changed, `status did not change from "${current}"`).toBe(
      true,
    );
    expect(result.emailedTemplate, "no template was sent").toBeTruthy();

    // Delivery: a message to this advertiser that is not the signup verification
    // e-mail, arriving after Send was pressed.
    const mail = await waitForMailTo(advertiser.email, {
      timeoutMs: 180_000,
      subjectNotLike: /verify your email/i,
      since,
    });
    console.log(`delivered: "${mail.subject}" at ${mail.receivedTime}`);
    expect(mail.to.toLowerCase()).toContain(advertiser.email.toLowerCase());
  });
});
