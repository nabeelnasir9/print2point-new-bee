const stripe = require("stripe")(
  "sk_test_51H31ubHTxsLPmt2x2JnX3LVJOt3tN12TNEPL5XGXdbeGrheQ8LK3g2jpxxkJ53gtnmnOJzBb2MXxYDYMBaSzAIjf00tfbNQYVN",
);

const paymentMethods = async () => {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: "cus_QmFicZU7WpX57G", // The customer's Stripe ID
  });
  console.log(paymentMethods);
};

paymentMethods();
