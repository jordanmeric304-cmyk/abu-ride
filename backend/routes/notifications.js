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

// 1. POST: Submit an issue report to admin (Saved to DB regardless of admin online/offline status)
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
    const driver_user_id = req.user.id || req.user.userId;

    // A. Check for destination from active driver availability
    const { data: availability } = await db.supabase
      .from('driver_availability')
      .select('destination_id')
      .eq('driver_id', driver_user_id)
      .maybeSingle();

    const driverDestinationId = availability?.destination_id;

    // B. Query valid tickets matching the destination if available
    let ticketQuery = db.supabase
      .from('tickets')
      .select('*')
      .eq('status', 'valid');

    if (driverDestinationId) {
      ticketQuery = ticketQuery.eq('destination_id', driverDestinationId);
    }

    const { data: bookings, error: bookingErr } = await ticketQuery;

    if (bookingErr) {
      console.error('Error fetching tickets:', bookingErr);
      return res.status(500).json({ success: false, message: 'Tickets query error: ' + bookingErr.message });
    }

    // Fallback to all valid active tickets across all routes if no match on specific destination
    let activeTickets = bookings;
    if (!activeTickets || activeTickets.length === 0) {
      const { data: allValidTickets } = await db.supabase
        .from('tickets')
        .select('*')
        .eq('status', 'valid');
      activeTickets = allValidTickets || [];
    }

    if (activeTickets.length === 0) {
      return res.json({ success: false, message: 'No paid passengers with active tickets found right now.' });
    }

    // C. Extract unique passenger IDs (handling column name variations)
    const passengerIds = activeTickets.map(t => 
      t.passenger_id || t.user_id || t.passenger_user_id
    ).filter(Boolean);

    const uniquePassengerIds = [...new Set(passengerIds)];

    if (uniquePassengerIds.length === 0) {
      return res.json({ success: false, message: 'No valid passenger accounts attached to active tickets.' });
    }

    // D. Store notifications in DB for all passengers (works whether logged in or out)
    const notifications = uniquePassengerIds.map(pId => ({
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

    return res.json({ 
      success: true, 
      message: `Notification broadcasted to ${uniquePassengerIds.length} passenger(s) who bought tickets!` 
    });
  } catch (err) {
    console.error('Driver notification error:', err);
    return res.status(500).json({ success: false, message: 'Failed to notify passengers: ' + err.message });
  }
});

module.exports = router;