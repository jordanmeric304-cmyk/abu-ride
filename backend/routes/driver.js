const express = require('express');
const supabase = require('../supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ============================================================
// DRIVER-ONLY MIDDLEWARE
// ============================================================

const driverOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'driver') {
    return res.status(403).json({
      success: false,
      message: 'Driver access required',
    });
  }
  next();
};

// ============================================================
// GET DRIVER PROFILE
// ============================================================

router.get('/profile', authMiddleware, driverOnly, async (req, res) => {
  try {
    const { data: driver, error } = await supabase
      .from('driver_profiles')
      .select(`
        user_id,
        driver_license_number,
        vehicle_number,
        vehicle_type,
        is_available,
        destination_id,
        total_trips,
        total_earnings,
        updated_at,
        users:user_id (
          id,
          full_name,
          email,
          phone,
          profile_image
        )
      `)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) {
      console.error('Driver profile error:', error);
      return res.status(500).json({ success: false, message: 'Something went wrong while loading driver profile' });
    }

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found' });
    }

    return res.json({
      success: true,
      driver: {
        id: driver.users?.id || driver.user_id,
        full_name: driver.users?.full_name || null,
        email: driver.users?.email || null,
        phone: driver.users?.phone || null,
        profile_image: driver.users?.profile_image || null,
        driver_license_number: driver.driver_license_number || null,
        vehicle_number: driver.vehicle_number || null,
        vehicle_type: driver.vehicle_type || null,
        is_available: Boolean(driver.is_available),
        destination_id: driver.destination_id || null,
        total_trips: Number(driver.total_trips) || 0,
        total_earnings: Number(driver.total_earnings) || 0,
        updated_at: driver.updated_at || null,
      },
    });
  } catch (error) {
    console.error('Driver profile error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong while loading driver profile' });
  }
});

// ============================================================
// GET DRIVER AVAILABILITY
// ============================================================

router.get('/availability', authMiddleware, driverOnly, async (req, res) => {
  try {
    const { data: driver, error } = await supabase
      .from('driver_profiles')
      .select(`
        is_available,
        destination_id,
        destinations:destination_id (
          id,
          name,
          fare
        )
      `)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) {
      console.error('Driver availability error:', error);
      return res.status(500).json({ success: false, message: 'Something went wrong while loading availability' });
    }

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found' });
    }

    return res.json({
      success: true,
      availability: {
        is_available: Boolean(driver.is_available),
        destination_id: driver.destination_id || null,
        destination_name: driver.destinations?.name || null,
        destination_fare: driver.destinations?.fare != null ? Number(driver.destinations.fare) : null,
      },
    });
  } catch (error) {
    console.error('Driver availability error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong while loading availability' });
  }
});

// ============================================================
// UPDATE DRIVER AVAILABILITY
// ============================================================

router.post('/availability', authMiddleware, driverOnly, async (req, res) => {
  try {
    const { destination_id, is_available } = req.body;

    if (is_available === true && !destination_id) {
      return res.status(400).json({
        success: false,
        message: 'Select a destination before becoming available',
      });
    }

    let updateData = {
      is_available: Boolean(is_available),
    };

    if (destination_id) {
      updateData.destination_id = Number(destination_id);
    }

    if (is_available === false) {
      updateData.destination_id = null;
    }

    const { error: updateError } = await supabase
      .from('driver_profiles')
      .update(updateData)
      .eq('user_id', req.user.id);

    if (updateError) {
      console.error('Update availability error:', updateError);
      return res.status(500).json({ success: false, message: 'Could not update driver availability' });
    }

    if (is_available === false) {
      await supabase
        .from('vehicles')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('current_driver_id', req.user.id);
    }

    return res.json({
      success: true,
      message: is_available === true ? 'You are now available for passengers' : 'You are now unavailable',
    });
  } catch (error) {
    console.error('Update availability error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong while updating availability' });
  }
});

// ============================================================
// GET ALL VEHICLES FOR DRIVER SELECTION
// ============================================================

router.get('/vehicles', authMiddleware, driverOnly, async (req, res) => {
  try {
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('vehicle_number', { ascending: true });

    if (error) {
      console.error('Fetch vehicles error:', error);
      return res.status(400).json({ success: false, message: 'Could not fetch vehicles' });
    }

    return res.json({ success: true, vehicles });
  } catch (error) {
    console.error('Vehicles endpoint error:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching vehicles' });
  }
});

// ============================================================
// DRIVER SELECTS A VEHICLE
// ============================================================

router.post('/select-vehicle', authMiddleware, driverOnly, async (req, res) => {
  try {
    const { vehicle_id } = req.body;
    const driver_id = req.user.id;

    if (!vehicle_id) {
      return res.status(400).json({ success: false, message: 'Vehicle ID is required' });
    }

    await supabase
      .from('vehicles')
      .update({ current_driver_id: null, is_active: false })
      .eq('current_driver_id', driver_id);

    const { data: updatedVehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .update({
        current_driver_id: driver_id,
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', vehicle_id)
      .select()
      .single();

    if (vehicleError) {
      console.error('Select vehicle error:', vehicleError);
      return res.status(400).json({ success: false, message: 'Could not assign vehicle' });
    }

    return res.json({
      success: true,
      message: `Successfully checked into ${updatedVehicle.vehicle_number}`,
      vehicle: updatedVehicle
    });
  } catch (error) {
    console.error('Select vehicle endpoint error:', error);
    return res.status(500).json({ success: false, message: 'Server error during vehicle selection' });
  }
});

// ============================================================
// GET ACTIVE VEHICLES FOR PASSENGERS
// ============================================================

router.get('/active-vehicles', authMiddleware, async (req, res) => {
  try {
    const { destination_id } = req.query;

    let driverQuery = supabase
      .from('driver_profiles')
      .select('user_id, destination_id, is_available, vehicle_number')
      .eq('is_available', true);

    if (destination_id) {
      driverQuery = driverQuery.eq('destination_id', Number(destination_id));
    }

    const { data: availableDrivers, error: driverError } = await driverQuery;

    if (driverError) {
      console.error('Fetch available drivers error:', driverError);
      return res.status(400).json({ success: false, message: 'Could not fetch available drivers' });
    }

    if (!availableDrivers || availableDrivers.length === 0) {
      return res.json({ success: true, vehicles: [] });
    }

    const driverIds = availableDrivers.map(d => d.user_id);

    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, email, username')
      .in('id', driverIds);

    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('*')
      .in('current_driver_id', driverIds);

    const result = availableDrivers.map(profile => {
      const user = (users || []).find(u => u.id === profile.user_id);
      const vehicle = (vehicles || []).find(v => v.current_driver_id === profile.user_id);

      const username = user?.username || user?.email?.split('@')[0] || 'driver';
      const vehicleNumber = vehicle?.vehicle_number || profile.vehicle_number || '01';

      return {
        id: vehicle?.id || profile.user_id,
        driver_id: profile.user_id,
        vehicle_id: vehicle?.id,
        driver_name: username,
        username: username,
        vehicle_number: vehicleNumber,
        is_available: true,
        destination_id: profile.destination_id,
        available_seats: 10,
      };
    });
    
    return res.json({ success: true, vehicles: result });
  } catch (error) {
    console.error('Active vehicles endpoint error:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching active vehicles' });
  }
});

// ============================================================
// GET DRIVER TRIP HISTORY
// ============================================================

router.get('/trips', authMiddleware, driverOnly, async (req, res) => {
  try {
    const driverId = req.user.id;

    const { data: trips, error } = await supabase
      .from('trips')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch driver trips error:', error);
      return res.status(400).json({ success: false, message: 'Could not fetch trip history' });
    }

    return res.json({ success: true, trips: trips || [] });
  } catch (error) {
    console.error('Driver trips endpoint error:', error);
    return res.status(500).json({ success: false, message: 'Server error loading trips' });
  }
});

// ============================================================
// GET DRIVER EARNINGS HISTORY & SUMMARY
// ============================================================

router.get('/earnings', authMiddleware, driverOnly, async (req, res) => {
  try {
    const driverId = req.user.id;

    const { data: earnings, error } = await supabase
      .from('driver_earnings')
      .select('*')
      .eq('driver_id', driverId)
      .order('earned_at', { ascending: false });

    if (error) {
      console.error('Fetch driver earnings error:', error);
      return res.status(400).json({ success: false, message: 'Could not fetch earnings' });
    }

    const earningsList = earnings || [];

    let totalEarnings = 0;
    let validatedTicketsCount = 0;

    earningsList.forEach((item) => {
      if (item.status !== 'cancelled') {
        totalEarnings += Number(item.amount) || 0;
        validatedTicketsCount += 1;
      }
    });

    return res.json({
      success: true,
      summary: {
        total_earnings: totalEarnings,
        total_validated_tickets: validatedTicketsCount,
      },
      earnings: earningsList,
    });
  } catch (error) {
    console.error('Driver earnings endpoint error:', error);
    return res.status(500).json({ success: false, message: 'Server error loading earnings' });
  }
});

module.exports = router;