const express = require('express');
const router = express.Router();
const db = require('../db'); // Matches your existing backend db configuration

const jwt = require('jsonwebtoken');

// Helper middleware: Verify custom app JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No authorization token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify using your backend JWT secret (or decode if secret isn't strict)
    const secret = process.env.JWT_SECRET || 'your-secret-key'; // Match whatever secret your auth.js uses
    const decoded = jwt.verify(token, secret);

    req.user = decoded; // Contains userId and role
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
    const reporter_id = req.user.id;

    const { error } = await db.supabase
      .from('reports')
      .insert([{ reporter_id, role, issue_type, description }]);

    if (error) throw error;

    return res.json({ success: true, message: 'Report submitted successfully to admin.' });
  } catch (err) {
    console.error('Report submission error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit report: ' + err.message });
  }
});

// 2. GET: Fetch unread notifications for a user
router.get('/unread', verifyToken, async (req, res) => {
  try {
    const user_id = req.user.id;

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
    const driver_id = req.user.id;
    
    const { data: bookings, error: bookingErr } = await db.supabase
      .from('tickets')
      .select('user_id')
      .eq('driver_id', driver_id)
      .eq('status', 'valid');

    if (bookingErr) throw bookingErr;

    if (!bookings || bookings.length === 0) {
      return res.json({ success: false, message: 'No active passengers found for your ride.' });
    }

    const notifications = bookings.map(b => ({
      user_id: b.user_id,
      title: 'Ride Update 🚗',
      message: 'Your driver requests you to be at the boarding point in 10 minutes!',
      type: 'driver_alert'
    }));

    const { error: notifErr } = await db.supabase
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