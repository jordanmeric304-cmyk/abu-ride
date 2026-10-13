const express = require('express');
const router = express.Router();
// NOTE: Make sure these require paths match how your driver.js imports supabase and middleware
const supabase = require('../supabaseClient'); 
const authMiddleware = require('../middleware/auth');

// 1. POST: Submit an issue report to admin
router.post('/reports', authMiddleware, async (req, res) => {
  try {
    const { role, issue_type, description } = req.body;
    const reporter_id = req.user.id;

    const { error } = await supabase
      .from('reports')
      .insert([{ reporter_id, role, issue_type, description }]);

    if (error) throw error;

    return res.json({ success: true, message: 'Report submitted successfully to admin.' });
  } catch (err) {
    console.error('Report submission error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit report' });
  }
});

// 2. POST: Driver triggers "Be at boarding point in 10 mins" alert
router.post('/driver/notify-passengers', authMiddleware, async (req, res) => {
  try {
    const driver_id = req.user.id;
    
    // Find bookings associated with this driver
    const { data: bookings, error: bookingErr } = await supabase
      .from('bookings')
      .select('passenger_id')
      .eq('driver_id', driver_id)
      .eq('status', 'active');

    if (bookingErr) throw bookingErr;

    if (!bookings || bookings.length === 0) {
      return res.json({ success: false, message: 'No active passengers found for your ride.' });
    }

    // Insert notifications for all booked passengers
    const notifications = bookings.map(b => ({
      user_id: b.passenger_id,
      title: 'Ride Update 🚗',
      message: 'Your driver requests you to be at the boarding point in 10 minutes!',
      type: 'driver_alert'
    }));

    const { error: notifErr } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notifErr) throw notifErr;

    return res.json({ success: true, message: 'Notification sent to all passengers!' });
  } catch (err) {
    console.error('Driver notification error:', err);
    return res.status(500).json({ success: false, message: 'Failed to notify passengers' });
  }
});

module.exports = router;