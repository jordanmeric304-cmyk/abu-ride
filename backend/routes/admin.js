const express = require('express');
const supabase = require('../supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ============================================================
// ADMIN-ONLY MIDDLEWARE
// ============================================================
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Administrator access required',
    });
  }
  next();
};

// ============================================================
// GET ALL USERS (View driver approval status & info)
// ============================================================
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone, reg_or_p_number, role, is_active, is_approved, driver_custom_id, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch admin users error:', error);
      return res.status(400).json({ success: false, message: 'Could not fetch users' });
    }

    return res.json({ success: true, users });
  } catch (error) {
    console.error('Admin users endpoint error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching users' });
  }
});

// ============================================================
// GET USER TRANSACTIONS & FINANCIAL DETAILS FOR ADMIN INSPECTION
// ============================================================
router.get('/users/:id/transactions', authMiddleware, adminOnly, async (req, res) => {
  try {
    const userId = req.params.id;

    // 1. Fetch from 'transactions' table
    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // 2. Fetch from 'transfers' table
    const { data: transferData } = await supabase
      .from('transfers')
      .select('*')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    // 3. Fetch tickets bought by this user
    const { data: ticketData } = await supabase
      .from('tickets')
      .select('*')
      .or(`passenger_id.eq.${userId},user_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    // Combine history into a single sorted timeline
    const combinedHistory = [
      ...(txData || []).map(t => ({ id: `tx-${t.id}`, type: t.type || 'Transaction', amount: t.amount, created_at: t.created_at })),
      ...(transferData || []).map(t => ({ id: `tr-${t.id}`, type: 'Transfer', amount: t.amount, created_at: t.created_at })),
      ...(ticketData || []).map(t => ({ id: `tk-${t.id}`, type: 'Ticket Purchase', amount: t.fare || t.amount || 0, created_at: t.created_at }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.json({ success: true, transactions: combinedHistory });
  } catch (error) {
    console.error('Fetch user transactions error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching user transactions' });
  }
});

// ============================================================
// DELETE USER ACCOUNT
// ============================================================
router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const userId = req.params.id;

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) {
      console.error('Delete user error:', error);
      return res.status(400).json({ success: false, message: 'Could not delete user' });
    }

    return res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user endpoint error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting user' });
  }
});

// ============================================================
// APPROVE PENDING DRIVER & GENERATE CUSTOM ID
// ============================================================
router.post('/approve-driver', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { driver_id } = req.body;

    if (!driver_id) {
      return res.status(400).json({ success: false, message: 'Driver ID is required' });
    }

    const customDriverId = 'DRV-' + Math.floor(1000 + Math.random() * 9000);

    const { data: updatedDriver, error } = await supabase
      .from('users')
      .update({ 
        is_approved: true,
        driver_custom_id: customDriverId 
      })
      .eq('id', driver_id)
      .eq('role', 'driver')
      .select('id, full_name, email, is_approved, driver_custom_id')
      .single();

    if (error) {
      console.error('Approve driver error:', error);
      return res.status(400).json({ success: false, message: 'Could not approve driver account' });
    }

    return res.json({
      success: true,
      message: `Driver ${updatedDriver.full_name} (${updatedDriver.driver_custom_id}) approved successfully!`,
      driver: updatedDriver,
    });
  } catch (error) {
    console.error('Approve driver endpoint error:', error);
    return res.status(500).json({ success: false, message: 'Server error approving driver' });
  }
});

// ============================================================
// GET FLEET OVERVIEW
// ============================================================
router.get('/fleet', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('*, users:current_driver_id(full_name, email, driver_custom_id)')
      .order('vehicle_number', { ascending: true });

    if (error) {
      console.error('Fetch fleet error:', error);
      return res.status(400).json({ success: false, message: 'Could not fetch fleet overview' });
    }

    return res.json({ success: true, vehicles });
  } catch (error) {
    console.error('Fleet endpoint error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching fleet overview' });
  }
});

// ============================================================
// GET SUBMITTED ISSUE REPORTS
// ============================================================
router.get('/reports', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { data: reports, error } = await supabase
      .from('reports')
      .select('*, users:reporter_id(full_name, email, reg_or_p_number, role)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch reports error:', error);
      return res.status(400).json({ success: false, message: 'Could not fetch issue reports' });
    }

    return res.json({ success: true, reports });
  } catch (error) {
    console.error('Reports endpoint error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching reports' });
  }
});

// ============================================================
// ADMIN REPLY TO ISSUE REPORT (Sends notification to user)
// ============================================================
router.post('/reports/reply', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { report_id, user_id, message } = req.body;

    if (!user_id || !message) {
      return res.status(400).json({ success: false, message: 'User ID and message are required' });
    }

    const { error } = await supabase
      .from('notifications')
      .insert([{
        user_id: user_id,
        title: 'Admin Reply to Report 🛡️',
        message: message,
        type: 'admin_reply',
        is_read: false
      }]);

    if (error) {
      console.error('Admin reply notification error:', error);
      return res.status(400).json({ success: false, message: 'Could not send notification reply' });
    }

    return res.json({ success: true, message: 'Reply sent successfully to user!' });
  } catch (error) {
    console.error('Admin reply endpoint error:', error);
    return res.status(500).json({ success: false, message: 'Server error sending reply' });
  }
});

// ============================================================
// GET DRIVER EARNINGS
// ============================================================
router.get('/driver-earnings', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { data: earnings, error } = await supabase
      .from('driver_earnings')
      .select('id, driver_id, ticket_id, trip_id, amount, status, earned_at')
      .order('earned_at', { ascending: false });

    if (error) {
      console.error('Admin driver earnings error:', error);
      return res.status(500).json({ success: false, message: 'Failed to load driver earnings' });
    }

    const { data: drivers, error: driversError } = await supabase
      .from('users')
      .select('id, full_name, email, phone')
      .eq('role', 'driver')
      .order('full_name', { ascending: true });

    if (driversError) {
      console.error('Admin drivers lookup error:', driversError);
      return res.status(500).json({ success: false, message: 'Failed to load drivers' });
    }

    const totalMap = {};
    const dailyMap = {};

    (earnings || []).forEach((earning) => {
      const driverId = earning.driver_id;
      const amount = Number(earning.amount) || 0;

      if (!totalMap[driverId]) totalMap[driverId] = 0;

      if (earning.status !== 'cancelled') {
        totalMap[driverId] += amount;
        const date = earning.earned_at ? String(earning.earned_at).substring(0, 10) : null;
        if (date) {
          if (!dailyMap[driverId]) dailyMap[driverId] = {};
          if (!dailyMap[driverId][date]) dailyMap[driverId][date] = 0;
          dailyMap[driverId][date] += amount;
        }
      }
    });

    const driverEarnings = (drivers || []).map((driver) => {
      const daily = Object.entries(dailyMap[driver.id] || {})
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => b.date.localeCompare(a.date));

      return {
        driver_id: driver.id,
        full_name: driver.full_name,
        email: driver.email,
        phone: driver.phone,
        total_earnings: totalMap[driver.id] || 0,
        daily_earnings: daily,
      };
    });

    const totalAllDrivers = driverEarnings.reduce((total, driver) => total + Number(driver.total_earnings), 0);

    return res.json({
      success: true,
      summary: { total_drivers: driverEarnings.length, total_earnings: totalAllDrivers },
      drivers: driverEarnings,
    });
  } catch (error) {
    console.error('Admin driver earnings error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load driver earnings' });
  }
});

module.exports = router;