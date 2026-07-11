// Lets a customer securely check their subscription status by mobile number.
// Used by my-plan.html.
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://kuwldjfdgzzflqucdasx.supabase.co";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

exports.handler = async function (event) {
  try {
    const mobile = event.queryStringParameters && event.queryStringParameters.mobile;

    if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
      return { statusCode: 200, body: JSON.stringify({ error: 'Please enter a valid 10-digit mobile number.' }) };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

    // Find the registration for this mobile number
    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .select('id, name')
      .eq('mobile', mobile)
      .maybeSingle();

    if (regError || !registration) {
      return { statusCode: 200, body: JSON.stringify({ error: 'No customer found with that mobile number. Please check and try again.' }) };
    }

    // Find their most recent subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('registration_id', registration.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError || !subscription) {
      return { statusCode: 200, body: JSON.stringify({ error: 'No subscription found for this mobile number yet.' }) };
    }

    // Determine display status (mirrors the logic used in admin.html)
    const today = new Date().toISOString().slice(0, 10);
    let displayStatus = subscription.status;
    if (subscription.status === 'active' && subscription.end_date < today) {
      displayStatus = 'expired';
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: displayStatus,
        name: registration.name,
        planType: subscription.plan_type,
        price: subscription.price,
        startDate: subscription.start_date,
        endDate: subscription.end_date
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
