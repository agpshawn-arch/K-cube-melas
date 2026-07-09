// Sends the current active menu to all registered customers.
// Requires environment variable RESEND_API_KEY set in Netlify.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://kuwldjfdgzzflqucdasx.supabase.co";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

exports.handler = async function () {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('active', true)
      .order('meal_type', { ascending: true });

    if (menuError || !menuItems || menuItems.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ error: 'No active menu items found' }) };
    }

    const { data: registrations, error: regError } = await supabase
      .from('registrations')
      .select('email, name');

    if (regError || !registrations || registrations.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ error: 'No customers found' }) };
    }

    const { data: settings } = await supabase
      .from('admin_settings')
      .select('*')
      .eq('key', 'notification_email')
      .single();

    const fromAddress = settings && settings.value ? settings.value : 'K Cube Meals <onboarding@resend.dev>';

    const menuHtml = menuItems.map(item => `
      <div style="padding:10px 0; border-bottom:1px solid #eee;">
        <strong>${item.name}</strong> ${item.meal_type ? `(${item.meal_type})` : ''}<br/>
        <span style="color:#666; font-size:13px;">${item.description || ''}</span><br/>
        <span style="color:#2D5F3E; font-weight:bold;">₹${item.price || '-'}</span>
      </div>
    `).join('');

    // Dedupe emails
    const uniqueEmails = [...new Set(registrations.map(r => r.email).filter(Boolean))];

    let sentCount = 0;
    for (const email of uniqueEmails) {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [email],
          subject: "Today's Menu — K Cube Meals 🍃",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color:#2D5F3E;">Today's Menu 🍃</h2>
              ${menuHtml}
              <p style="color:#888; font-size:13px; margin-top:20px;">K Cube Meals — Fresh, Homely, Affordable</p>
            </div>
          `
        })
      });
      if (resp.ok) sentCount++;
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, sentCount, total: uniqueEmails.length }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

