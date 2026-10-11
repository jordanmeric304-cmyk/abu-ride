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

router.get(
  '/profile',
  authMiddleware,
  driverOnly,
  async (req, res) => {
    try {
      const {
        data: driver,
        error,
      } = await supabase
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

        return res.status(500).json({
          success: false,
          message: 'Something went wrong while loading driver profile',
        });
      }

      if (!driver) {
        return res.status(404).json({
          success: false,
          message: 'Driver profile not found',
        });
      }

      return res.json({
        success: true,

        driver: {
          id: driver.users?.id || driver.user_id,

          full_name:
            driver.users?.full_name || null,

          email:
            driver.users?.email || null,

          phone:
            driver.users?.phone || null,

          profile_image:
            driver.users?.profile_image || null,

          driver_license_number:
            driver.driver_license_number || null,

          vehicle_number:
            driver.vehicle_number || null,

          vehicle_type:
            driver.vehicle_type || null,

          is_available:
            Boolean(driver.is_available),

          destination_id:
            driver.destination_id || null,

          total_trips:
            Number(driver.total_trips) || 0,

          total_earnings:
            Number(driver.total_earnings) || 0,

          updated_at:
            driver.updated_at || null,
        },
      });

    } catch (error) {
      console.error('Driver profile error:', error);

      return res.status(500).json({
        success: false,
        message: 'Something went wrong while loading driver profile',
      });
    }
  }
);


// ============================================================
// GET DRIVER AVAILABILITY
// ============================================================

router.get(
  '/availability',
  authMiddleware,
  driverOnly,
  async (req, res) => {
    try {
      const {
        data: driver,
        error,
      } = await supabase
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

        return res.status(500).json({
          success: false,
          message: 'Something went wrong while loading availability',
        });
      }

      if (!driver) {
        return res.status(404).json({
          success: false,
          message: 'Driver profile not found',
        });
      }

      return res.json({
        success: true,

        availability: {
          is_available:
            Boolean(driver.is_available),

          destination_id:
            driver.destination_id || null,

          destination_name:
            driver.destinations?.name || null,

          destination_fare:
            driver.destinations?.fare != null
              ? Number(driver.destinations.fare)
              : null,
        },
      });

    } catch (error) {
      console.error('Driver availability error:', error);

      return res.status(500).json({
        success: false,
        message: 'Something went wrong while loading availability',
      });
    }
  }
);


// ============================================================
// UPDATE DRIVER AVAILABILITY
// ============================================================

router.post(
  '/availability',
  authMiddleware,
  driverOnly,
  async (req, res) => {
    try {
      const {
        destination_id,
        is_available,
      } = req.body;


      if (
        is_available === true &&
        !destination_id
      ) {
        return res.status(400).json({
          success: false,
          message: 'Select a destination before becoming available',
        });
      }


      if (destination_id) {
        const {
          data: destination,
          error: destinationError,
        } = await supabase
          .from('destinations')
          .select(`
            id,
            name,
            fare
          `)
          .eq(
            'id',
            Number(destination_id)
          )
          .eq(
            'is_active',
            true
          )
          .maybeSingle();

        if (destinationError) {
          console.error(
            'Destination lookup error:',
            destinationError
          );

          return res.status(500).json({
            success: false,
            message: 'Could not verify selected destination',
          });
        }

        if (!destination) {
          return res.status(404).json({
            success: false,
            message: 'Selected destination not found',
          });
        }
      }


      let updateData;

      if (is_available === true) {
        updateData = {
          destination_id: Number(destination_id),
          is_available: true,
        };
      } else {
        updateData = {
          is_available: false,
        };
      }


      const {
        error: updateError,
      } = await supabase
        .from('driver_profiles')
        .update(updateData)
        .eq(
          'user_id',
          req.user.id
        );

      if (updateError) {
        console.error(
          'Update availability error:',
          updateError
        );

        return res.status(500).json({
          success: false,
          message: 'Could not update driver availability',
        });
      }


      const {
        data: updated,
        error: updatedError,
      } = await supabase
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
        .eq(
          'user_id',
          req.user.id
        )
        .maybeSingle();

      if (updatedError) {
        console.error(
          'Updated availability lookup error:',
          updatedError
        );

        return res.status(500).json({
          success: false,
          message:
            'Availability was updated but could not be loaded',
        });
      }


      return res.json({
        success: true,

        message:
          is_available === true
            ? 'You are now available for passengers'
            : 'You are now unavailable',

        availability: {
          is_available:
            Boolean(updated?.is_available),

          destination_id:
            updated?.destination_id || null,

          destination_name:
            updated?.destinations?.name || null,

          destination_fare:
            updated?.destinations?.fare != null
              ? Number(updated.destinations.fare)
              : null,
        },
      });

    } catch (error) {
      console.error(
        'Update availability error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Something went wrong while updating availability',
      });
    }
  }
);


// ============================================================
// GET DRIVER TRIP HISTORY
// ============================================================

router.get(
  '/history',
  authMiddleware,
  driverOnly,
  async (req, res) => {
    try {
      const {
        data: trips,
        error,
      } = await supabase
        .from('trips')
        .select(`
          id,
          driver_id,
          destination_id,
          status,
          started_at,
          completed_at,
          created_at,
          destinations:destination_id (
            id,
            name,
            fare,
            estimated_minutes
          )
        `)
        .eq(
          'driver_id',
          req.user.id
        )
        .order(
          'id',
          {
            ascending: false,
          }
        );

      if (error) {
        console.error(
          'Driver history error:',
          error
        );

        return res.status(500).json({
          success: false,
          message:
            'Something went wrong while loading trip history',
        });
      }

      return res.json({
        success: true,

        trips:
          (trips || []).map(
            (trip) => ({
              id:
                trip.id,

              driver_id:
                trip.driver_id,

              destination_id:
                trip.destination_id,

              status:
                trip.status,

              started_at:
                trip.started_at,

              completed_at:
                trip.completed_at,

              created_at:
                trip.created_at,

              destination_name:
                trip.destinations?.name || null,

              fare:
                trip.destinations?.fare != null
                  ? Number(
                      trip.destinations.fare
                    )
                  : 0,

              estimated_minutes:
                trip.destinations?.estimated_minutes ?? null,
            })
          ),
      });

    } catch (error) {
      console.error(
        'Driver history error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Something went wrong while loading trip history',
      });
    }
  }
);


// ============================================================
// GET DRIVER EARNINGS
// ============================================================

router.get(
  '/earnings',
  authMiddleware,
  driverOnly,
  async (req, res) => {
    try {
      const {
        data: earnings,
        error,
      } = await supabase
        .from('driver_earnings')
        .select(`
          id,
          driver_id,
          ticket_id,
          trip_id,
          amount,
          status,
          tickets:ticket_id (
            id,
            ticket_reference,
            destination_id,
            destinations:destination_id (
              id,
              name,
              fare
            )
          )
        `)
        .eq(
          'driver_id',
          req.user.id
        )
        .order(
          'id',
          {
            ascending: false,
          }
        );

      if (error) {
        console.error(
          'Driver earnings error:',
          error
        );

        return res.status(500).json({
          success: false,
          message:
            'Something went wrong while loading driver earnings',
        });
      }


      const formattedEarnings =
        (earnings || []).map(
          (earning) => ({
            id:
              earning.id,

            amount:
              Number(
                earning.amount
              ) || 0,

            status:
              earning.status || null,

            ticket_reference:
              earning.tickets
                ?.ticket_reference || null,

            destination_name:
              earning.tickets
                ?.destinations
                ?.name || null,

            trip_id:
              earning.trip_id || null,

            ticket_id:
              earning.ticket_id || null,
          })
        );


      const totalEarnings =
        formattedEarnings.reduce(
          (
            total,
            earning
          ) => {
            if (
              earning.status !==
              'cancelled'
            ) {
              return (
                total +
                earning.amount
              );
            }

            return total;
          },
          0
        );


      const totalValidatedTickets =
        formattedEarnings.filter(
          (earning) =>
            earning.status !==
            'cancelled'
        ).length;


      return res.json({
        success: true,

        summary: {
          total_validated_tickets:
            totalValidatedTickets,

          total_earnings:
            totalEarnings,
        },

        earnings:
          formattedEarnings,
      });

    } catch (error) {
      console.error(
        'Driver earnings error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Something went wrong while loading driver earnings',
      });
    }
  }
);


// ============================================================
// GET AVAILABLE DRIVERS FOR PASSENGERS
// ============================================================

router.get(
  '/available',
  authMiddleware,
  async (req, res) => {
    try {
      const {
        destination_id,
      } = req.query;

      if (!destination_id) {
        return res.status(400).json({
          success: false,
          message: 'Destination is required',
        });
      }

      const destinationId =
        Number(destination_id);

      if (
        !Number.isInteger(destinationId) ||
        destinationId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid destination',
        });
      }

      const {
        data: destination,
        error: destinationError,
      } = await supabase
        .from('destinations')
        .select(`
          id,
          name,
          fare,
          description
        `)
        .eq(
          'id',
          destinationId
        )
        .eq(
          'is_active',
          true
        )
        .maybeSingle();

      if (destinationError) {
        console.error(
          'Destination lookup error:',
          destinationError
        );

        return res.status(500).json({
          success: false,
          message:
            'Something went wrong while loading destination',
        });
      }

      if (!destination) {
        return res.status(404).json({
          success: false,
          message: 'Destination not found',
        });
      }

      const {
        data: driverProfiles,
        error: driverError,
      } = await supabase
        .from('driver_profiles')
        .select(`
          user_id,
          vehicle_number,
          vehicle_type,
          is_available,
          destination_id
        `)
        .eq(
          'destination_id',
          destinationId
        )
        .eq(
          'is_available',
          true
        );

      if (driverError) {
        console.error(
          'Available drivers query error:',
          driverError
        );

        return res.status(500).json({
          success: false,
          message:
            'Something went wrong while loading available drivers',
        });
      }

      if (
        !driverProfiles ||
        driverProfiles.length === 0
      ) {
        return res.json({
          success: true,

          destination: {
            id:
              destination.id,

            name:
              destination.name,

            fare:
              Number(
                destination.fare
              ) || 0,
          },

          drivers: [],
        });
      }

      const driverIds =
        driverProfiles.map(
          (driver) =>
            driver.user_id
        );

      const {
        data: users,
        error: userError,
      } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          email,
          phone,
          role,
          profile_image,
          is_active
        `)
        .in(
          'id',
          driverIds
        )
        .eq(
          'role',
          'driver'
        )
        .eq(
          'is_active',
          true
        );

      if (userError) {
        console.error(
          'Available driver users query error:',
          userError
        );

        return res.status(500).json({
          success: false,
          message:
            'Something went wrong while loading available drivers',
        });
      }

      const drivers =
        driverProfiles
          .map(
            (profile) => {
              const user =
                users.find(
                  (item) =>
                    Number(
                      item.id
                    ) ===
                    Number(
                      profile.user_id
                    )
                );

              if (!user) {
                return null;
              }

              return {
                id:
                  user.id,

                full_name:
                  user.full_name,

                email:
                  user.email,

                phone:
                  user.phone,

                profile_image:
                  user.profile_image ||
                  null,

                vehicle_number:
                  profile.vehicle_number || null,

                vehicle_type:
                  profile.vehicle_type || null,

                is_available:
                  Boolean(
                    profile.is_available
                  ),

                destination_id:
                  destination.id,

                destination_name:
                  destination.name,

                fare:
                  Number(
                    destination.fare
                  ) || 0,
              };
            }
          )
          .filter(Boolean);

      return res.json({
        success: true,

        destination: {
          id:
            destination.id,

          name:
            destination.name,

          fare:
            Number(
              destination.fare
            ) || 0,
        },

        drivers,
      });

    } catch (error) {
      console.error(
        'Available drivers error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Something went wrong while loading available drivers',
      });
    }
  }
);


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
// GET ACTIVE VEHICLES FOR PASSENGERS (Extracts exact driver username/identity)
// ============================================================

router.get('/active-vehicles', authMiddleware, async (req, res) => {
  try {
    const { destination_id } = req.query;

    // 1. Fetch active vehicles checked in with a driver
    const { data: vehicles, error: vehicleError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('is_active', true)
      .not('current_driver_id', 'is', null);

    if (vehicleError) {
      console.error('Fetch active vehicles error:', vehicleError);
      return res.status(400).json({ success: false, message: 'Could not fetch active vehicles' });
    }

    if (!vehicles || vehicles.length === 0) {
      return res.json({ success: true, vehicles: [] });
    }

    // 2. Extract driver user IDs
    const driverIds = vehicles.map(v => v.current_driver_id).filter(Boolean);

    // 3. Fetch driver profiles and user table fields
    const { data: driverProfiles } = await supabase
      .from('driver_profiles')
      .select('user_id, destination_id, driver_license_number')
      .in('user_id', driverIds);

    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, email, phone')
      .in('id', driverIds);

    // 4. Combine data and determine exact driver username/handle
    const formattedVehicles = vehicles.map(vehicle => {
      const profile = (driverProfiles || []).find(p => p.user_id === vehicle.current_driver_id);
      const user = (users || []).find(u => u.id === vehicle.current_driver_id);

      // Filter by destination if requested
      if (destination_id && Number(profile?.destination_id) !== Number(destination_id)) {
        return null;
      }

      // Determine best username display:
      // 1. user.username (if present on table)
      // 2. user.full_name
      // 3. email prefix (e.g. "john" from "john@gmail.com")
      const emailPrefix = user?.email ? user.email.split('@')[0] : null;
      const exactDriverName = user?.username || user?.full_name || emailPrefix || `Driver_${vehicle.current_driver_id}`;

      return {
        vehicle_id: vehicle.id,
        vehicle_number: vehicle.vehicle_number || `Vehicle ${vehicle.id}`,
        driver_id: vehicle.current_driver_id,
        driver_name: exactDriverName,
        destination_id: profile?.destination_id || null,
        available_seats: 10,
      };
    }).filter(Boolean);

    return res.json({ success: true, vehicles: formattedVehicles });
  } catch (error) {
    console.error('Active vehicles endpoint error:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching active vehicles' });
  }
});

// ============================================================
// ISSUE REPORTING (Passengers & Drivers)
// ============================================================

router.post('/report-issue', authMiddleware, async (req, res) => {
  try {
    const { category, description } = req.body;
    const reporter_id = req.user.id;
    const reporter_role = req.user.role;

    if (!category || !description) {
      return res.status(400).json({ success: false, message: 'Category and description are required' });
    }

    const { data: newReport, error: reportError } = await supabase
      .from('reports')
      .insert({
        reporter_id,
        reporter_role: reporter_role || 'passenger',
        category,
        description,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (reportError) {
      console.error('Report issue error:', reportError);
      return res.status(400).json({ success: false, message: 'Could not submit issue report' });
    }

    return res.status(201).json({
      success: true,
      message: 'Issue reported successfully. Admin will review shortly.',
      report: newReport
    });
  } catch (error) {
    console.error('Report issue endpoint error:', error);
    return res.status(500).json({ success: false, message: 'Server error while reporting issue' });
  }
});

module.exports = router;