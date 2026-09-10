// main menu constants.ts

import { appUrl, controlUrl, env, PATHS } from '../config/environment';

export const RANDOME_STRING_INPUT_VALUE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const RANDOM_STRING_LENGTH = 5;
export const RANDOME_NUMBER_INPUT_VALUE = '0123456789';
export const RANDOME_STRING_ONLU_ALPHABET_INPUT_VALUE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// Admin User Constants
export const ADMIN_USER = 'syed.shah@flexoffers.com';
export const EDIT_CONTRACT_OWNER_AND_STAFF_RULE_PERMISSION = 'FACILITIES.SALES.CONTRACT_OWNER_AND_STAFF_RULES.EDIT'

// Authentication messages, as rendered by the app
export const LOGIN_INVALID_CREDENTIALS_MESSAGE =
  'Invalid login attempt. The username or password is incorrect.';
export const REQUIRED_FIELD_MESSAGE = 'This field is required.';

/**
 * Keys that must never appear in an authentication response body.
 * Guards bug #682 (Resume API returned the password and security answer in
 * plaintext) against regressing into the sign-in endpoint.
 */
export const CREDENTIAL_LEAK_KEYS = [
  'password',
  'securityanswer',
  'security_answer',
  'securityquestionanswer',
] as const;

// Flex Offers Website

export const SIGNUP_URL = appUrl(PATHS.signup);

export const PASSWORD = 'Abcd@1234';
export const SECURITY_ANSWER = 'History';
export const CAPTCHA = 'hM2@J'; // (Note: ideally should be handled dynamically)
export const PHONE_NUMBER = '(201) 666-3334';
export const ZIP_CODE = '42567';

export const CREATIVE_TEXT = (programName: string) =>
  `Check out our Referral Program today for ${programName}`;

// Control Site Constants
export const CONTROL_SITE_URL = controlUrl('/manage/dashboard.aspx');
export const CONTROL_ADVERTISER_NAME = 'Playwright';
export const MANAGEMENT_SITE_URL = env.managementBaseUrl;

// Coupons & Offers Constants
// The coupon wizard validates that the Destination URL belongs to the selected
// program's *registered* domain. The "ApprovedDateTest" program is registered
// with the domain cakebrandusa.com (confirmed from the app's validation
// message), so the destination URL must live under that domain — not
// approveddatetest.com, which the wizard rejects.
export const COUPON_PROGRAM_NAME = 'ApprovedDateTest';
export const COUPON_DESTINATION_URL = 'https://cakebrandusa.com';
export const COUPON_TITLE_PREFIX = 'Test Automation - Coupon or Offer - ';
export const COUPON_DESCRIPTION_PREFIX = 'Test Automation - Coupon or Offer - ';
export const COUPON_CODE_PREFIX = 'TestAutomationCoupon-';
export const COUPON_CREATE_SUCCESS_MESSAGE =
  'Text Link successfully created. Please note that data is pushed hourly, Monday through Sunday.';
export const COUPON_UPDATE_SUCCESS_MESSAGE =
  'Text Link successfully updated. Please note that data is pushed hourly, Monday through Sunday.';
export const COUPON_PUBLISHER_REQUIRED_MESSAGE = 'Please select publisher.';
