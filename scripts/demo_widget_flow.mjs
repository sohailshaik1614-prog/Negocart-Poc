// End-to-End Live Demonstration of Phase 5 Customer Negotiation Widget Flow
// Executes the exact user-specified multi-round scenario against the live NegoZaar backend

async function demonstrateCustomerWidgetFlow() {
  const base = "http://localhost:3000";
  const storeKey = "pub_live_apex_9a8b7c6d5e4f3a2b1c";
  const productId = "e0000000-0000-0000-0000-000000000001"; // Artisan Leather Weekend Duffel Bag

  console.log("================================================================================");
  console.log("NEGOZAAR CUSTOMER-FACING NEGOTIATION WIDGET: LIVE DEMONSTRATION");
  console.log("================================================================================");
  console.log("Storefront PDP View:");
  console.log("  Store: Apex Luxury Lifestyle (apex-luxury.myshopify.com)");
  console.log("  Product: Artisan Leather Weekend Duffel Bag");
  console.log("  Listed Retail Price: ₹2,000");
  console.log("  [ Add to Cart ]");
  console.log("  [ Negotiate Price ✨ ]  <-- Injected by NegoZaar Storefront Embed SDK");
  console.log("--------------------------------------------------------------------------------\n");

  // Step 1: Customer clicks [ Negotiate Price ]
  console.log(">> Customer clicks [ Negotiate Price ] button...");
  const initRes = await fetch(`${base}/api/v1/widget/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicStoreKey: storeKey,
      productId: productId,
      deviceFingerprint: "demo_shopper_device_42",
    }),
  });

  const initData = await initRes.json();
  if (!initRes.ok) {
    throw new Error(`Init failed: ${JSON.stringify(initData)}`);
  }

  const sessionToken = initData.sessionToken;
  const initialGreeting = initData.view.messages[0].messageText;

  console.log(`[Session Created] ID: ${initData.view.sessionId}`);
  console.log(`[Round 0/${initData.view.maxRounds}]`);
  console.log(`NegoZaar AI:`);
  console.log(`  "${initialGreeting}"\n`);

  // Step 2: Customer Round 1
  console.log(">> Customer submits Offer 1:");
  console.log('Customer: "Can you do ₹1,500?"');
  const round1Res = await fetch(`${base}/api/v1/widget/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionToken,
      proposedAmount: 1500,
      message: "Can you do ₹1,500?",
    }),
  });

  const round1Data = await round1Res.json();
  const round1AiMsg = round1Data.view.messages[round1Data.view.messages.length - 1].messageText;
  console.log(`[Round ${round1Data.view.currentRound}/${round1Data.view.maxRounds} - AI Counter: ₹${round1Data.view.currentOffer}]`);
  console.log(`NegoZaar AI:`);
  console.log(`  "${round1AiMsg}"\n`);

  // Step 3: Customer Round 2
  console.log(">> Customer submits Offer 2:");
  console.log('Customer: "₹1,600?"');
  const round2Res = await fetch(`${base}/api/v1/widget/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionToken,
      proposedAmount: 1600,
      message: "₹1,600?",
    }),
  });

  const round2Data = await round2Res.json();
  const round2AiMsg = round2Data.view.messages[round2Data.view.messages.length - 1].messageText;
  console.log(`[Round ${round2Data.view.currentRound}/${round2Data.view.maxRounds} - AI Counter: ₹${round2Data.view.currentOffer}]`);
  console.log(`NegoZaar AI:`);
  console.log(`  "${round2AiMsg}"\n`);

  // Step 4: Customer Round 3 (Final attempt)
  console.log(">> Customer submits Offer 3 (Final Attempt):");
  console.log('Customer: "₹1,600."');
  const round3Res = await fetch(`${base}/api/v1/widget/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionToken,
      proposedAmount: 1600,
      message: "₹1,600.",
    }),
  });

  const round3Data = await round3Res.json();
  const round3AiMsg = round3Data.view.messages[round3Data.view.messages.length - 1].messageText;
  console.log(`[Round ${round3Data.view.currentRound}/${round3Data.view.maxRounds} - Status: ${round3Data.view.status}]`);
  console.log(`NegoZaar AI:`);
  console.log(`  "${round3AiMsg}"\n`);

  // Step 5: Customer accepts final offer
  console.log(">> Customer accepts final offer...");
  const acceptRes = await fetch(`${base}/api/v1/widget/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken }),
  });

  const acceptData = await acceptRes.json();
  console.log(`[Deal Closed!]`);
  console.log(`  Agreed Price: ₹${acceptData.agreedPrice.toLocaleString()}`);
  console.log(`  Original Retail: ₹2,000`);
  console.log(`  Savings Conceded: ₹${(2000 - acceptData.agreedPrice).toLocaleString()} (${((2000 - acceptData.agreedPrice)/2000 * 100).toFixed(1)}%)`);
  console.log(`  Generated Coupon Code: ${acceptData.discountCode}`);
  console.log(`  Checkout Redirect: ${acceptData.checkoutUrl || "N/A"}`);
  console.log("================================================================================");
}

demonstrateCustomerWidgetFlow().catch(console.error);
