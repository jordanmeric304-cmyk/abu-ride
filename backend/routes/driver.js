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


      // --------------------------------------------------------
      // Driver becoming available
      // --------------------------------------------------------

      if (
        is_available === true &&
        !destination_id
      ) {
        return res.status(400).json({
          success: false,
          message: 'Select a destination before becoming available',
        });
      }


      // --------------------------------------------------------
      // Verify destination
      // --------------------------------------------------------

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


      // --------------------------------------------------------
      // Update driver profile
      // --------------------------------------------------------

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


      // --------------------------------------------------------
      // Get updated availability
      // --------------------------------------------------------

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
// IMPORTANT:
// driver_earnings DOES NOT HAVE created_at.
// Therefore we use id for ordering and do not request created_at.
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


      // --------------------------------------------------------
      // Format earnings
      // --------------------------------------------------------

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


      // --------------------------------------------------------
      // Calculate total earnings
      // --------------------------------------------------------

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


      // --------------------------------------------------------
      // Calculate validated tickets
      // --------------------------------------------------------

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

      console.log(
        'Checking available drivers for destination:',
        destination_id
      );


      // --------------------------------------------------------
      // Validate destination
      // --------------------------------------------------------

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


      // --------------------------------------------------------
      // Verify destination exists and is active
      // --------------------------------------------------------

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


      // --------------------------------------------------------
      // Get available drivers
      // --------------------------------------------------------

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


      // --------------------------------------------------------
      // No available drivers
      // --------------------------------------------------------

      if (
        !driverProfiles ||
        driverProfiles.length === 0
      ) {
        console.log(
          'No available drivers found for destination:',
          destination.name
        );

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


      // --------------------------------------------------------
      // Get driver users
      // --------------------------------------------------------

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


      // --------------------------------------------------------
      // Combine driver profile + user
      // --------------------------------------------------------

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


      console.log(
        `Found ${drivers.length} available driver(s) for ${destination.name}`
      );


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


module.exports = router;