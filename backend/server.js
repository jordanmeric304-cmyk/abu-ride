require('dotenv').config();

const express = require('express');
const cors = require('cors');

const db = require('./db');
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const ticketRoutes = require('./routes/tickets');
const adminRoutes = require('./routes/admin');
const driverRoutes = require('./routes/driver');
const notificationRoutes = require('./routes/notifications'); // <-- Added notifications require

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'ABU Ride backend is running',
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working',
  });
});

app.get('/api/destinations', async (req, res) => {
  try {
    const { data, error } = await db.supabase
      .from('destinations')
      .select(`
        id,
        name,
        description,
        fare,
        estimated_minutes
      `)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Supabase destinations error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to load destinations',
        error: error.message,
      });
    }

    res.json({
      success: true,
      destinations: data || [],
    });
  } catch (error) {
    console.error('Destinations error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to load destinations',
    });
  }
});
/*
  Authentication routes
*/
app.use('/api/auth', authRoutes);

/*
  Wallet routes
*/
app.use('/api/wallet', walletRoutes);

/*
  Ticket and QR routes
*/
app.use('/api/tickets', ticketRoutes);

/*
  Admin routes
*/
app.use('/api/admin', adminRoutes);

/*
  Driver routes
*/
app.use('/api/driver', driverRoutes);

/*
  Notification & Report routes
*/
app.use('/api/notifications', notificationRoutes); // <-- Added notification route mount

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `Server running on port ${PORT}`
  );
});