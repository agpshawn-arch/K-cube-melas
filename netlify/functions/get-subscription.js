// Securely looks up a single customer's subscription by mobile number.
// Uses the secret key server-side so we never expose the full subscriptions table to visitors.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://kuwldjfdgzzflqucdasx.supabase.co";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

exports.handler = async function (event) {
  try {
    const params = event.queryStringParameters || {};
    const mobile = (params.mobile || '').trim();

    if (!/^[0-9]{10}$/.test(mobile)) {
      return { statusCode: 200, body: JSON.stringify({ error: 'Please enter a valid 10-digit mobile number.' }) };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('customer_mobile', mobile)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { statusCode: 200, body: JSON.stringify({ error: 'Something went wrong. Please try again.' }) };
    }

    if (!data) {
      return { statusCode: 200, body: JSON.stringify({ error: 'No subscription found for this mobile number.' }) };
    }

    // Auto-expire check
    const today = new Date().toISOString().slice(0,10);
    const status = (data.status === 'active' && data.end_date < today) ? 'expired' : data.status;

    return {
      statusCode: 200,
      body: JSON.stringify({
        name: data.customer_name,
        planType: data.plan_type,
        price: data.price,
        startDate: data.start_date,
        endDate: data.end_date,
        status
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
