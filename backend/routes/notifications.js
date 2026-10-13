const express = require('express');
const router = express.Router();
const db = require('../db'); 
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'abu_ride_secret_key_change_later';

// Helper middleware: Verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No authorization token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verification error:', err.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// 1. POST: Submit an issue report to admin
router.post('/reports', verifyToken, async (req, res) => {
  try {
    const { role, issue_type, description } = req.body;
    const reporter_id = req.user.id || req.user.userId;

    if (!reporter_id) {
      return res.status(400).json({ success: false, message: 'User ID missing from token payload' });
    }

    const { error } = await db.supabase
      .from('reports')
      .insert([{ reporter_id, role, issue_type, description }]);

    if (error) {
      console.error('Supabase report insert error:', error);
      throw error;
    }

    return res.json({ success: true, message: 'Report submitted successfully to admin.' });
  } catch (err) {
    console.error('Report submission error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit report: ' + (err.message || 'Database error') });
  }
});

// 2. GET: Fetch unread notifications for a user
router.get('/unread', verifyToken, async (req, res) => {
  try {
    const user_id = req.user.id || req.user.userId;

    const { data, error } = await db.supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user_id)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({ success: true, notifications: data || [] });
  } catch (err) {
    console.error('Unread notifications error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

// 3. POST: Driver triggers "Be at boarding point in 10 mins" alert
router.post('/driver/notify-passengers', verifyToken, async (req, res) => {
  try {
    const user_id = req.user.id || req.user.userId;

    // Find driver_profile ID or active vehicle for this driver user
    const { data: driverProf } = await db.supabase
      .from('driver_profiles')
      .select('id')
      .eq('user_id', user_id)
      .maybeSingle();

    const driver_id_query = driverProf?.id || user_id;

    // Query tickets using both passenger_id and user_id fallback
    let bookings = null;
    let bookingErr = null;

    // First try passenger_id (most standard for tickets table)
    const res1 = await db.supabase
      .from('tickets')
      .select('passenger_id')
      .or(`driver_id.eq.${driver_id_query},driver_id.eq.${user_id}`)
      .eq('status', 'valid');

    if (res1.error && res1.error.message.includes('passenger_id')) {
      // Fallback if passenger_id isn't present
      const res2 = await db.supabase
        .from('tickets')
        .select('*')
        .or(`driver_id.eq.${driver_id_query},driver_id.eq.${user_id}`)
        .eq('status', 'valid');
        
      bookings = res2.data;
      bookingErr = res2.error;
    } else {
      bookings = res1.data;
      bookingErr = res1.error;
    }

    if (bookingErr) {
      console.error('Error fetching booked tickets:', bookingErr);
      return res.status(500).json({ success: false, message: 'Error checking active passengers: ' + bookingErr.message });
    }

    if (!bookings || bookings.length === 0) {
      return res.json({ success: false, message: 'No active passengers found booked for your ride right now.' });
    }

    // Extract unique passenger IDs from passenger_id or user_id fields
    const uniquePassengers = [...new Set(bookings.map(b => b.passenger_id || b.user_id))].filter(Boolean);

    if (uniquePassengers.length === 0) {
      return res.json({ success: false, message: 'No valid passenger accounts attached to current bookings.' });
    }

    const notifications = uniquePassengers.map(pId => ({
      user_id: pId,
      title: 'Ride Update 🚗',
      message: 'Your driver requests you to be at the boarding point in 10 minutes!',
      type: 'driver_alert',
      is_read: false
    }));

    const { error: notifErr } = await db.supabase
      .from('notifications')
      .insert(notifications);

    if (notifErr) {
      console.error('Error inserting notifications:', notifErr);
      return res.status(500).json({ success: false, message: 'Notification table error: ' + notifErr.message });
    }

    return res.json({ success: true, message: `Notification sent to ${uniquePassengers.length} active passenger(s)!` });
  } catch (err) {
    console.error('Driver notification error:', err);
    return res.status(500).json({ success: false, message: 'Failed to notify passengers: ' + err.message });
  }
});

module.exports = router;