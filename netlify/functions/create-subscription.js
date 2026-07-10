// Lets a customer self-select a subscription plan.
// Looks up (or creates) their registration by mobile number, then creates an active subscription.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://kuwldjfdgzzflqucdasx.supabase.co";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const planDurationDays = { daily: 1, weekly: 7, monthly: 30, quarterly: 90, annual: 365 };

exports.handler = async function (event) {
  try {
    const body = JSON.parse(event.body);
    const { name, mobile, email, deliveryArea, planType, menuItemId } = body;

    if (!name || !mobile || !email || !deliveryArea || !planType || !menuItemId) {
      return { statusCode: 200, body: JSON.stringify({ error: 'All fields are required, including a meal selection.' }) };
    }
    if (!/^[0-9]{10}$/.test(mobile)) {
      return { statusCode: 200, body: JSON.stringify({ error: 'Please enter a valid 10-digit mobile number.' }) };
    }
    if (!planDurationDays[planType]) {
      return { statusCode: 200, body: JSON.stringify({ error: 'Invalid plan type.' }) };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

    // Look up the selected menu item server-side (never trust a price sent from the browser)
    const { data: menuItem, error: menuError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('id', menuItemId)
      .eq('active', true)
      .maybeSingle();

    if (menuError || !menuItem) {
      return { statusCode: 200, body: JSON.stringify({ error: 'Selected meal is no longer available. Please choose another.' }) };
    }

    // Find existing registration by mobile, or create a new one
    let registrationId;
    const { data: existing } = await supabase
      .from('registrations')
      .select('id')
      .eq('mobile', mobile)
      .maybeSingle();

    if (existing) {
      registrationId = existing.id;
    } else {
      const { data: created, error: createError } = await supabase
        .from('registrations')
        .insert({ name, mobile, email, delivery_area: deliveryArea, status: 'received' })
        .select('id')
        .single();
      if (createError) {
        return { statusCode: 200, body: JSON.stringify({ error: 'Could not register: ' + createError.message }) };
      }
      registrationId = created.id;
    }

    // Price = dish price × number of days in the plan
    const durationDays = planDurationDays[planType];
    const price = menuItem.price != null ? Number(menuItem.price) * durationDays : null;

    const startDate = new Date().toISOString().slice(0, 10);
    const endDateObj = new Date();
    endDateObj.setDate(endDateObj.getDate() + durationDays - 1);
    const endDate = endDateObj.toISOString().slice(0, 10);

    const { error: subError } = await supabase.from('subscriptions').insert({
      registration_id: registrationId,
      customer_name: name,
      customer_mobile: mobile,
      customer_email: email,
      plan_type: planType,
      price,
      start_date: startDate,
      end_date: endDate,
      status: 'active',
      menu_item_id: menuItem.id,
      meal_name: menuItem.name,
      meal_type: menuItem.meal_type
    });

    if (subError) {
      return { statusCode: 200, body: JSON.stringify({ error: 'Could not create subscription: ' + subError.message }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, planType, price, startDate, endDate, mealName: menuItem.name })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
