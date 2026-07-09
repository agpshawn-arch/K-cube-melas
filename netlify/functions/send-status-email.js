// Sends a "delivery successful" email to the customer when their daily order is marked delivered.
// Requires environment variable RESEND_API_KEY set in Netlify (Project configuration > Environment variables).

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://kuwldjfdgzzflqucdasx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YCajekLcdhKAryRRQyhf6A_GZd363zy";

exports.handler = async function (event) {
  try {
    const { id, status, table } = JSON.parse(event.body);

    // Only send an email when an order reaches "delivered"
    if (status !== 'delivered') {
      return { statusCode: 200, body: JSON.stringify({ skipped: true }) };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    const tableName = table === 'daily_orders' ? 'daily_orders' : 'registrations';

    const { data: order, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error || !order) {
      return { statusCode: 200, body: JSON.stringify({ error: 'Order not found' }) };
    }

    const customerEmail = order.email || order.customer_email;
    const customerName = order.name || order.customer_name;

    if (!customerEmail) {
      return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'No email on file' }) };
    }

    // Look up the notification sender email from admin_settings
    const { data: settings } = await supabase
      .from('admin_settings')
      .select('*')
      .eq('key', 'notification_email')
      .single();

    const fromAddress = settings && settings.value ? settings.value : 'K Cube Meals <onboarding@resend.dev>';

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [customerEmail],
        subject: 'Your K Cube Meals order has been delivered! 🍃',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color:#2D5F3E;">Delivered! 🍃</h2>
            <p>Hi ${customerName || 'there'},</p>
            <p>Your K Cube Meals order has been successfully delivered. We hope you enjoy your meal!</p>
            <p style="color:#888; font-size:13px;">Thank you for choosing K Cube Meals — fresh, homely, affordable.</p>
          </div>
        `
      })
    });

    const resendData = await resendResponse.json();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: resendResponse.ok, resendData })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
