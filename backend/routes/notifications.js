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

    // Fetch active tickets without specifying column names in the select clause
    const { data: bookings, error: bookingErr } = await db.supabase
      .from('tickets')
      .select('*')
      .eq('status', 'valid');

    if (bookingErr) {
      console.error('Error fetching tickets:', bookingErr);
      return res.status(500).json({ success: false, message: 'Tickets query error: ' + bookingErr.message });
    }

    if (!bookings || bookings.length === 0) {
      return res.json({ success: false, message: 'No active tickets found in the system right now.' });
    }

    // Filter tickets for this driver dynamically
    const driverBookings = bookings.filter(b => 
      Number(b.driver_id) === Number(user_id) || 
      Number(b.driver_user_id) === Number(user_id)
    );

    const targetList = driverBookings.length > 0 ? driverBookings : bookings;

    // Extract passenger ID from any field present on the ticket row
    const passengerIds = targetList.map(b => 
      b.passenger_id || b.user_id || b.passenger_user_id || b.user
    ).filter(Boolean);

    const uniquePassengers = [...new Set(passengerIds)];

    if (uniquePassengers.length === 0) {
      return res.json({ success: false, message: 'No active passengers attached to current bookings.' });
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