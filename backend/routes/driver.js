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
// UPDATE DRIVER AVAILABILITY (Fixed Crash)
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

    // Also update vehicle active status if going offline
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
// GET ALL VEHICLES (01 to 20) FOR DRIVER SELECTION
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
// DRIVER SELECTS A VEHICLE (01 to 20)
// ============================================================

router.post('/select-vehicle', authMiddleware, driverOnly, async (req, res) => {
  try {
    const { vehicle_id } = req.body;
    const driver_id = req.user.id;

    if (!vehicle_id) {
      return res.status(400).json({ success: false, message: 'Vehicle ID is required' });
    }

    // Unassign driver from any other vehicle first to prevent duplicates
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
// GET ACTIVE VEHICLES FOR PASSENGERS (Strictly Filters Available & Online Only)
// ============================================================

router.get('/active-vehicles', authMiddleware, async (req, res) => {
  try {
    const { destination_id } = req.query;

    // 1. Fetch active vehicles with checked-in drivers
    const { data: vehicles, error: vehicleError } = await supabase
      .from('vehicles')
      .select('*, trips(*)')
      .eq('is_active', true)
      .not('current_driver_id', 'is', null);

    if (vehicleError) {
      console.error('Fetch active vehicles error:', vehicleError);
      return res.status(400).json({ success: false, message: 'Could not fetch active vehicles' });
    }

    if (!vehicles || vehicles.length === 0) {
      return res.json({ success: true, vehicles: [] });
    }

    const driverIds = vehicles.map(v => v.current_driver_id).filter(Boolean);

    // 2. Fetch driver profiles to check if they are *truly* available (`is_available = true`) and match destination
    const { data: driverProfiles } = await supabase
      .from('driver_profiles')
      .select('user_id, destination_id, is_available')
      .in('user_id', driverIds)
      .eq('is_available', true);

    const availableDriverIds = new Set((driverProfiles || []).map(p => p.user_id));

    // 3. Fetch user names
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, email, username')
      .in('id', driverIds);

    // 4. Format and strictly filter out offline drivers or destination mismatches
    const formattedVehicles = vehicles.map(vehicle => {
      // If driver is not actually available in driver_profiles, skip them entirely
      if (!availableDriverIds.has(vehicle.current_driver_id)) {
        return null;
      }

      const profile = (driverProfiles || []).find(p => p.user_id === vehicle.current_driver_id);
      const user = (users || []).find(u => u.id === vehicle.current_driver_id);

      if (destination_id && Number(profile?.destination_id) !== Number(destination_id)) {
        return null;
      }

      const activeTrip = vehicle.trips?.find(trip => trip.completed_at === null);
      const bookedSeats = activeTrip ? Number(activeTrip.total_booked_seats || 0) : 0;
      const availableSeats = Math.max(0, 10 - bookedSeats);

      if (availableSeats <= 0) {
        return null; // Skip full vehicles
      }

      const displayName = user?.username || user?.full_name || user?.email?.split('@')[0] || 'Driver';

      return {
        vehicle_id: vehicle.id,
        vehicle_number: vehicle.vehicle_number || `Vehicle ${vehicle.id}`,
        driver_id: vehicle.current_driver_id,
        driver_name: displayName,
        destination_id: profile?.destination_id || null,
        available_seats: availableSeats,
      };
    }).filter(Boolean);

    return res.json({ success: true, vehicles: formattedVehicles });
  } catch (error) {
    console.error('Active vehicles endpoint error:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching active vehicles' });
  }
});

module.exports = router;