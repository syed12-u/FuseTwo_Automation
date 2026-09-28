// Stand-in for an advertiser storefront running the FuseTwo JavaScript.
//
// The flow under test is: publisher link → advertiser site (entry page stores
// the click) → purchase → confirmation page calls FuseTwoTrack.track(), which
// POSTs the order to the tracking host's da.ashx. Test programs point at real
// third-party domains that do not carry our script, so the merchant pages are
// served from page.route() instead. The FuseTwo library itself is the real one
// from the environment under test, and da.ashx is the real endpoint.

import { BrowserContext, Page, Request, Response } from "@playwright/test";
import { appUrl } from "../config/environment";

/** Placeholder merchant origin; never resolved — every request is fulfilled by route(). */
export const MERCHANT_ORIGIN = "https://qa-merchant.fusetwo-automation.test";

export interface OrderItem {
  sku: string;
  amount: number;
  quantity: number;
  commissionid?: string;
}

export interface TestOrder {
  order_number: string;
  order_amount: number;
  order_coupon?: string;
  order_currency?: string;
  order_geo?: string;
  order_commissionid?: string;
  order_items: OrderItem[];
}

/** A two-product order with different quantities and a coupon, as the diagnosis tool asks for. */
export function sampleOrder(): TestOrder {
  const items: OrderItem[] = [
    { sku: "QA-SKU-1", amount: 20, quantity: 2, commissionid: "C101" },
    { sku: "QA-SKU-2", amount: 12.5, quantity: 1 },
  ];
  const total = items.reduce((sum, i) => sum + i.amount * i.quantity, 0) - 5;
  return {
    order_number: `QA-${Date.now()}`,
    order_amount: total,
    order_coupon: "QA5OFF",
    order_currency: "USD",
    order_geo: "USA",
    order_commissionid: "C101",
    order_items: items,
  };
}

function loaderSnippet(advertiserId: string): string {
  const lib = appUrl("/vendors/FuseTwo/FuseTwo.tracking.lib.js");
  // Same loader the Conversion Tracking dialog generates, pointed at this env.
  return `!function(){var e=window.FuseTwoTrack=window.FuseTwoTrack||[];if(e.invoked)return;e.invoked=!0,e.methods=["init","getClick","track"],e.factory=function(r){return function(){var t=Array.prototype.slice.call(arguments);return t.unshift(r),e.push(t),e}};for(var r=0;r<e.methods.length;r++){var t=e.methods[r];e[t]=e.factory(t)}e.init=function(r){var t=document.createElement("script");t.async=!0,t.src=${JSON.stringify(lib)};document.head.appendChild(t),e.advertiserId=r}}();
FuseTwoTrack.init(${JSON.stringify(advertiserId)});`;
}

/**
 * Serve a landing page (stores the click id from the URL) and a confirmation
 * page (posts the order) for every URL under `origin`.
 */
export async function installMerchantSite(
  context: BrowserContext,
  advertiserId: string,
  order: TestOrder,
  origin = MERCHANT_ORIGIN,
) {
  await context.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    const isConfirmation = url.pathname.startsWith("/checkout/confirmation");
    const body = isConfirmation
      ? `<h1>Order confirmed</h1><script>${loaderSnippet(advertiserId)}
FuseTwoTrack.track(Object.assign(${JSON.stringify(order)}, { order_platform: "JavaScript" }));</script>`
      : `<h1>QA merchant</h1><script>${loaderSnippet(advertiserId)}
FuseTwoTrack.getClick();</script>`;
    return route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head></head><body>${body}</body></html>`,
    });
  });
}

export interface CapturedConversion {
  request: Request;
  response: Response | null;
  params: URLSearchParams;
  items: OrderItem[];
}

/** Open the merchant confirmation page and capture the da.ashx conversion call. */
export async function placeOrder(
  page: Page,
  origin = MERCHANT_ORIGIN,
): Promise<CapturedConversion> {
  const [request] = await Promise.all([
    page.waitForRequest((r) => /\/da\.ashx\?/i.test(r.url()), {
      timeout: 30_000,
    }),
    page.goto(`${origin}/checkout/confirmation`, {
      waitUntil: "domcontentloaded",
    }),
  ]);
  const response = await request.response();
  return {
    request,
    response,
    params: new URL(request.url()).searchParams,
    items: JSON.parse(request.postData() ?? "[]"),
  };
}
