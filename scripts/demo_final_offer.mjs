// Demonstration of the Take-it-or-Leave-it Final Offer Scenario
async function demonstrateFinalOfferScenario() {
  const base = "http://localhost:3000";
  const storeKey = "pub_live_apex_9a8b7c6d5e4f3a2b1c";
  const productId = "e0000000-0000-0000-0000-000000000001";

  console.log("================================================================================");
  console.log("DEMONSTRATION: FINAL OFFER (TAKE IT OR LEAVE IT) SCENARIO");
  console.log("================================================================================");

  // Init
  const initRes = await fetch(`${base}/api/v1/widget/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicStoreKey: storeKey, productId }),
  });
  const { sessionToken, view } = await initRes.json();
  console.log(`[Session Initialized] Round 0/${view.maxRounds}`);

  // Round 1: Low offer
  console.log('\nCustomer: "Can you do ₹1,200?" (Below floor of ₹1,500)');
  const r1 = await fetch(`${base}/api/v1/widget/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken, proposedAmount: 1200, message: "Can you do ₹1,200?" }),
  }).then(r => r.json());
  console.log(`NegoZaar AI: "${r1.view.messages[r1.view.messages.length - 1].messageText}"`);

  // Round 2: Still low
  console.log('\nCustomer: "How about ₹1,350?"');
  const r2 = await fetch(`${base}/api/v1/widget/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken, proposedAmount: 1350, message: "How about ₹1,350?" }),
  }).then(r => r.json());
  console.log(`NegoZaar AI: "${r2.view.messages[r2.view.messages.length - 1].messageText}"`);

  // Round 3: Final attempt
  console.log('\nCustomer: "₹1,400 is my max." (Attempt 3/3 - Final Attempt)');
  const r3 = await fetch(`${base}/api/v1/widget/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken, proposedAmount: 1400, message: "₹1,400 is my max." }),
  }).then(r => r.json());
  console.log(`[Status: ${r3.view.status}]`);
  console.log(`NegoZaar AI (Final Offer): "${r3.view.messages[r3.view.messages.length - 1].messageText}"`);

  // Attempt 4 should be rejected by attempt limits
  console.log('\nCustomer tries 4th attempt: "₹1,450?"');
  const r4 = await fetch(`${base}/api/v1/widget/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken, proposedAmount: 1450, message: "₹1,450?" }),
  }).then(r => r.json());
  console.log(`Guard Block Result: ${r4.error}`);
  console.log("================================================================================");
}

demonstrateFinalOfferScenario().catch(console.error);
