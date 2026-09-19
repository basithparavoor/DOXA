import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { regId, formId, programmeId, data, totalAmount, currency, formTitle } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Process Stripe Payment (If applicable)
    let checkoutUrl = null;
    if (totalAmount && totalAmount > 0) {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: currency.toLowerCase(),
            product_data: { name: `Registration: ${formTitle}` },
            unit_amount: Math.round(totalAmount * 100), // Stripe expects cents
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${req.headers.get('origin')}/success.html?reg_id=${regId}&form=${encodeURIComponent(formTitle)}`,
        cancel_url: `${req.headers.get('origin')}/public-form.html?slug=${formId}&error=payment_cancelled`,
        metadata: { regId, formId },
      });
      checkoutUrl = session.url;
    }

    // 2. Save Response to Database (Status: PENDING_PAYMENT or SUBMITTED)
    const status = checkoutUrl ? 'PENDING_PAYMENT' : 'SUBMITTED';
    const { error: dbError } = await supabase.from('responses').insert([{
      registration_id: regId,
      form_id: formId,
      programme_id: programmeId,
      data: data,
      status: status
    }]);

    if (dbError) throw new Error(dbError.message);

    // 3. Fire Webhook (e.g., Make.com or Zapier)
    const webhookUrl = Deno.env.get('ZAPIER_WEBHOOK_URL');
    if (webhookUrl && !checkoutUrl) {
      // Only fire webhook immediately if no payment is required. 
      // If payment is required, you'd fire this via a Stripe Webhook upon successful payment.
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regId, formTitle, data })
      }).catch(err => console.error("Webhook failed:", err));
    }

    // 4. Send Email via Resend API
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const respondentEmail = data['email'] || data['email_address']; // Assumes field ID contains 'email'
    if (resendKey && respondentEmail && !checkoutUrl) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'DOXA Notifications <noreply@yourdomain.com>',
          to: respondentEmail,
          subject: `Registration Confirmed: ${formTitle}`,
          html: `<p>Thank you for submitting your response. Your Registration ID is <strong>${regId}</strong>.</p>`
        })
      }).catch(err => console.error("Email failed:", err));
    }

    return new Response(JSON.stringify({ success: true, checkoutUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});