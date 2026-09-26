const express = require('express');
const crypto = require('crypto');

const supabase = require('../supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ============================================================
// PASSENGER-ONLY MIDDLEWARE
// ============================================================

const passengerOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'passenger') {
    return res.status(403).json({
      success: false,
      message: 'Passenger access required',
    });
  }

  next();
};

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
// GET LATEST TICKET
// ============================================================
// IMPORTANT:
// We deliberately do NOT use:
//
// trips (
//   driver_profiles:driver_id (...)
// )
//
// because Supabase was resolving that relationship through the
// users table and producing:
//
// users_2.vehicle_number does not exist
//
// Instead, we fetch the ticket, destination, driver user and
// driver profile separately.
// ============================================================

router.get(
  '/latest',
  authMiddleware,
  passengerOnly,
  async (req, res) => {
    try {
      // --------------------------------------------------------
      // GET LATEST TICKET
      // --------------------------------------------------------

      const {
        data: tickets,
        error: ticketError,
      } = await supabase
        .from('tickets')
        .select(`
          id,
          ticket_reference,
          qr_token,
          amount,
          status,
          purchased_at,
          expires_at,
          used_at,
          passenger_id,
          destination_id,
          trip_id
        `)
        .eq(
          'passenger_id',
          req.user.id
        )
        .order(
          'id',
          {
            ascending: false,
          }
        )
        .limit(1);

      if (ticketError) {
        console.error(
          'Latest ticket Supabase error:',
          ticketError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to load latest ticket',
        });
      }

      if (
        !tickets ||
        tickets.length === 0
      ) {
        return res.json({
          success: true,
          ticket: null,
        });
      }

      const rawTicket = tickets[0];

      // --------------------------------------------------------
      // GET DESTINATION
      // --------------------------------------------------------

      const {
        data: destination,
        error: destinationError,
      } = await supabase
        .from('destinations')
        .select(`
          id,
          name,
          description,
          fare,
          estimated_minutes
        `)
        .eq(
          'id',
          rawTicket.destination_id
        )
        .maybeSingle();

      if (destinationError) {
        console.error(
          'Latest ticket destination error:',
          destinationError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to load ticket destination',
        });
      }

      // --------------------------------------------------------
      // GET TRIP
      // --------------------------------------------------------

      let trip = null;

      if (rawTicket.trip_id) {
        const {
          data: tripData,
          error: tripError,
        } = await supabase
          .from('trips')
          .select(`
            id,
            driver_id,
            destination_id,
            status,
            started_at,
            completed_at
          `)
          .eq(
            'id',
            rawTicket.trip_id
          )
          .maybeSingle();

        if (tripError) {
          console.error(
            'Latest ticket trip error:',
            tripError
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to load ticket trip',
          });
        }

        trip = tripData;
      }

      // --------------------------------------------------------
      // GET DRIVER USER
      // --------------------------------------------------------

      let driverUser = null;

      if (trip?.driver_id) {
        const {
          data: userData,
          error: driverUserError,
        } = await supabase
          .from('users')
          .select(`
            id,
            full_name,
            phone,
            email,
            role,
            is_active
          `)
          .eq(
            'id',
            trip.driver_id
          )
          .maybeSingle();

        if (driverUserError) {
          console.error(
            'Latest ticket driver user error:',
            driverUserError
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to load ticket driver',
          });
        }

        driverUser = userData;
      }

      // --------------------------------------------------------
      // GET DRIVER PROFILE
      // --------------------------------------------------------
      // vehicle_number and vehicle_type are taken directly
      // from driver_profiles.
      // --------------------------------------------------------

      let driverProfile = null;

      if (trip?.driver_id) {
        const {
          data: profileData,
          error: driverProfileError,
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
            'user_id',
            trip.driver_id
          )
          .maybeSingle();

        if (driverProfileError) {
          console.error(
            'Latest ticket driver profile error:',
            driverProfileError
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to load driver profile',
          });
        }

        driverProfile = profileData;
      }

      // --------------------------------------------------------
      // BUILD TICKET RESPONSE
      // --------------------------------------------------------

      const ticket = {
        id:
          rawTicket.id,

        ticket_reference:
          rawTicket.ticket_reference,

        qr_token:
          rawTicket.qr_token,

        amount:
          Number(rawTicket.amount) || 0,

        status:
          rawTicket.status,

        purchased_at:
          rawTicket.purchased_at,

        expires_at:
          rawTicket.expires_at,

        used_at:
          rawTicket.used_at,

        destination:
          destination?.name || null,

        destination_name:
          destination?.name || null,

        destination_description:
          destination?.description || null,

        destination_id:
          rawTicket.destination_id,

        driver_id:
          trip?.driver_id || null,

        driver_name:
          driverUser?.full_name || null,

        driver_phone:
          driverUser?.phone || null,

        vehicle_number:
          driverProfile?.vehicle_number || null,

        vehicle_type:
          driverProfile?.vehicle_type || null,

        trip_id:
          rawTicket.trip_id,
      };

      // --------------------------------------------------------
      // CHECK EXPIRATION
      // --------------------------------------------------------

      if (
        ticket.status === 'active' &&
        ticket.expires_at &&
        new Date(ticket.expires_at) <
          new Date()
      ) {
        const {
          error: updateError,
        } = await supabase
          .from('tickets')
          .update({
            status: 'expired',
          })
          .eq(
            'id',
            ticket.id
          )
          .eq(
            'status',
            'active'
          );

        if (updateError) {
          console.error(
            'Ticket expiration update error:',
            updateError
          );
        } else {
          ticket.status = 'expired';
        }
      }

      // --------------------------------------------------------
      // RETURN TICKET
      // --------------------------------------------------------

      return res.json({
        success: true,
        ticket,
      });

    } catch (error) {
      console.error(
        'Latest ticket error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to load latest ticket',
      });
    }
  }
);

// ============================================================
// PURCHASE TICKET
// ============================================================

router.post(
  '/purchase',
  authMiddleware,
  passengerOnly,
  async (req, res) => {
    let walletUpdated = false;
    let balanceBefore = 0;
    let balanceAfter = 0;
    let tripId = null;
    let ticketId = null;

    try {
      const {
        destination_id,
        driver_id,
      } = req.body;

      // --------------------------------------------------------
      // VALIDATE REQUEST
      // --------------------------------------------------------

      if (!destination_id) {
        return res.status(400).json({
          success: false,
          message: 'Destination is required',
        });
      }

      if (!driver_id) {
        return res.status(400).json({
          success: false,
          message: 'Please select a driver',
        });
      }

      const destinationId =
        Number(destination_id);

      const driverId =
        Number(driver_id);

      if (
        !Number.isInteger(destinationId) ||
        destinationId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid destination',
        });
      }

      if (
        !Number.isInteger(driverId) ||
        driverId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid driver',
        });
      }

      // --------------------------------------------------------
      // GET DESTINATION
      // --------------------------------------------------------

      const {
        data: destination,
        error: destinationError,
      } = await supabase
        .from('destinations')
        .select(`
          id,
          name,
          description,
          fare,
          estimated_minutes,
          is_active
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
          message: 'Could not load destination',
        });
      }

      if (!destination) {
        return res.status(404).json({
          success: false,
          message: 'Destination not found or inactive',
        });
      }

      // --------------------------------------------------------
      // VERIFY DRIVER
      // --------------------------------------------------------
      // driver_profiles.destination_id is used here.
      // NOT location_id.
      // --------------------------------------------------------

      const {
        data: driver,
        error: driverError,
      } = await supabase
        .from('driver_profiles')
        .select(`
          user_id,
          is_available,
          destination_id,
          vehicle_number,
          vehicle_type,
          users:user_id (
            id,
            full_name,
            phone,
            role,
            is_active
          )
        `)
        .eq(
          'user_id',
          driverId
        )
        .eq(
          'destination_id',
          destinationId
        )
        .eq(
          'is_available',
          true
        )
        .maybeSingle();

      if (driverError) {
        console.error(
          'Driver lookup error:',
          driverError
        );

        return res.status(500).json({
          success: false,
          message: 'Could not verify selected driver',
        });
      }

      if (
        !driver ||
        !driver.users ||
        driver.users.role !== 'driver' ||
        driver.users.is_active !== true
      ) {
        return res.status(409).json({
          success: false,
          message:
            'This driver is no longer available for the selected destination',
        });
      }

      // --------------------------------------------------------
      // GET PASSENGER WALLET
      // --------------------------------------------------------

      const {
        data: wallet,
        error: walletError,
      } = await supabase
        .from('wallets')
        .select(`
          id,
          user_id,
          balance
        `)
        .eq(
          'user_id',
          req.user.id
        )
        .maybeSingle();

      if (walletError) {
        console.error(
          'Wallet lookup error:',
          walletError
        );

        return res.status(500).json({
          success: false,
          message: 'Could not load wallet',
        });
      }

      if (!wallet) {
        return res.status(404).json({
          success: false,
          message: 'Wallet not found',
        });
      }

      // --------------------------------------------------------
      // CALCULATE FARE
      // --------------------------------------------------------

      balanceBefore =
        Number(wallet.balance) || 0;

      const fare =
        Number(destination.fare) || 0;

      if (fare < 0) {
        return res.status(500).json({
          success: false,
          message: 'Invalid destination fare',
        });
      }

      if (balanceBefore < fare) {
        return res.status(400).json({
          success: false,
          message:
            `Insufficient wallet balance. Your balance is ₦${balanceBefore.toLocaleString()} and the fare is ₦${fare.toLocaleString()}.`,
          balance: balanceBefore,
          fare,
        });
      }

      balanceAfter =
        balanceBefore - fare;

      // --------------------------------------------------------
      // DEDUCT WALLET BALANCE
      // --------------------------------------------------------

      const {
        error: walletUpdateError,
      } = await supabase
        .from('wallets')
        .update({
          balance: balanceAfter,
        })
        .eq(
          'user_id',
          req.user.id
        );

      if (walletUpdateError) {
        console.error(
          'Wallet update error:',
          walletUpdateError
        );

        return res.status(500).json({
          success: false,
          message: 'Could not update wallet balance',
        });
      }

      walletUpdated = true;

      // --------------------------------------------------------
      // CREATE TRIP
      // --------------------------------------------------------

      const {
        data: trip,
        error: tripError,
      } = await supabase
        .from('trips')
        .insert({
          driver_id: driverId,
          destination_id: destinationId,
          status: 'active',
          started_at:
            new Date().toISOString(),
        })
        .select(`
          id
        `)
        .single();

      if (tripError) {
        console.error(
          'Trip creation error:',
          tripError
        );

        await supabase
          .from('wallets')
          .update({
            balance: balanceBefore,
          })
          .eq(
            'user_id',
            req.user.id
          );

        walletUpdated = false;

        return res.status(500).json({
          success: false,
          message: 'Could not create trip',
        });
      }

      tripId =
        trip.id;

      // --------------------------------------------------------
      // GENERATE TICKET REFERENCE
      // --------------------------------------------------------

      const ticketReference =
        `TKT-${Date.now()}-${crypto
          .randomBytes(4)
          .toString('hex')
          .toUpperCase()}`;

      // --------------------------------------------------------
      // GENERATE QR TOKEN
      // --------------------------------------------------------

      const qrToken =
        crypto
          .randomBytes(32)
          .toString('hex');

      // --------------------------------------------------------
      // CREATE TICKET
      // --------------------------------------------------------

      const purchasedAt =
        new Date();

      const expiresAt =
        new Date(
          purchasedAt.getTime() +
          30 * 60 * 1000
        );

      const {
        data: ticket,
        error: ticketError,
      } = await supabase
        .from('tickets')
        .insert({
          ticket_reference:
            ticketReference,

          qr_token:
            qrToken,

          passenger_id:
            req.user.id,

          trip_id:
            tripId,

          destination_id:
            destinationId,

          amount:
            fare,

          status:
            'active',

          purchased_at:
            purchasedAt.toISOString(),

          expires_at:
            expiresAt.toISOString(),
        })
        .select(`
          id,
          ticket_reference,
          qr_token,
          passenger_id,
          trip_id,
          destination_id,
          amount,
          status,
          purchased_at,
          expires_at
        `)
        .single();

      if (ticketError) {
        console.error(
          'Ticket creation error:',
          ticketError
        );

        await supabase
          .from('wallets')
          .update({
            balance: balanceBefore,
          })
          .eq(
            'user_id',
            req.user.id
          );

        await supabase
          .from('trips')
          .delete()
          .eq(
            'id',
            tripId
          );

        walletUpdated = false;
        tripId = null;

        return res.status(500).json({
          success: false,
          message: 'Could not create ticket',
        });
      }

      ticketId =
        ticket.id;

      // --------------------------------------------------------
      // GENERATE TRANSACTION REFERENCE
      // --------------------------------------------------------

      const transactionReference =
        `TXN-${Date.now()}-${crypto
          .randomBytes(4)
          .toString('hex')
          .toUpperCase()}`;

      // --------------------------------------------------------
      // RECORD TRANSACTION
      // --------------------------------------------------------

      const {
        error: transactionError,
      } = await supabase
        .from('transactions')
        .insert({
          transaction_reference:
            transactionReference,

          user_id:
            req.user.id,

          type:
            'ticket_purchase',

          amount:
            fare,

          balance_before:
            balanceBefore,

          balance_after:
            balanceAfter,

          description:
            `Bus fare payment to ${destination.name}`,

          ticket_id:
            ticket.id,

          status:
            'successful',
        });

      if (transactionError) {
        console.error(
          'Transaction creation error:',
          transactionError
        );

        await supabase
          .from('tickets')
          .delete()
          .eq(
            'id',
            ticket.id
          );

        await supabase
          .from('trips')
          .delete()
          .eq(
            'id',
            tripId
          );

        await supabase
          .from('wallets')
          .update({
            balance:
              balanceBefore,
          })
          .eq(
            'user_id',
            req.user.id
          );

        return res.status(500).json({
          success: false,
          message:
            'Could not record payment transaction',
        });
      }

      // --------------------------------------------------------
      // NOTIFICATION
      // --------------------------------------------------------

      const {
        error: notificationError,
      } = await supabase
        .from('notifications')
        .insert({
          user_id:
            req.user.id,

          title:
            'Ticket Purchased',

          message:
            `Your ticket to ${destination.name} has been successfully purchased.`,

          type:
            'ticket',
        });

      if (notificationError) {
        // Notification failure must NOT cancel
        // an otherwise successful ticket purchase.
        console.error(
          'Notification creation error:',
          notificationError
        );
      }

      // --------------------------------------------------------
      // SUCCESS RESPONSE
      // --------------------------------------------------------

      return res.status(201).json({
        success: true,

        message:
          'Ticket purchased successfully',

        ticket: {
          id:
            ticket.id,

          ticket_reference:
            ticket.ticket_reference,

          qr_token:
            ticket.qr_token,

          destination_id:
            destination.id,

          destination:
            destination.name,

          destination_name:
            destination.name,

          amount:
            fare,

          driver_id:
            driverId,

          driver_name:
            driver.users.full_name,

          driver_phone:
            driver.users.phone,

          vehicle_number:
            driver.vehicle_number,

          vehicle_type:
            driver.vehicle_type,

          trip_id:
            tripId,

          status:
            ticket.status,

          purchased_at:
            ticket.purchased_at,

          expires_at:
            ticket.expires_at,
        },

        wallet: {
          balance_before:
            balanceBefore,

          balance_after:
            balanceAfter,
        },

        transaction: {
          transaction_reference:
            transactionReference,

          amount:
            fare,
        },
      });

    } catch (error) {
      console.error(
        'Purchase ticket error:',
        error
      );

      // --------------------------------------------------------
      // EMERGENCY ROLLBACK
      // --------------------------------------------------------

      try {
        if (ticketId) {
          await supabase
            .from('tickets')
            .delete()
            .eq(
              'id',
              ticketId
            );
        }

        if (tripId) {
          await supabase
            .from('trips')
            .delete()
            .eq(
              'id',
              tripId
            );
        }

        if (walletUpdated) {
          await supabase
            .from('wallets')
            .update({
              balance:
                balanceBefore,
            })
            .eq(
              'user_id',
              req.user.id
            );
        }
      } catch (rollbackError) {
        console.error(
          'Purchase rollback error:',
          rollbackError
        );
      }

      return res.status(500).json({
        success: false,
        message:
          'Something went wrong while purchasing the ticket',
      });
    }
  }
);

// ============================================================
// VALIDATE QR TICKET
// ============================================================

router.post(
  '/validate',
  authMiddleware,
  driverOnly,
  async (req, res) => {
    try {
      const {
        qr_token,
      } = req.body;

      if (!qr_token) {
        return res.status(400).json({
          success: false,
          message: 'QR token is required',
        });
      }

      // --------------------------------------------------------
      // FIND TICKET
      // --------------------------------------------------------

      const {
        data: ticket,
        error: ticketError,
      } = await supabase
        .from('tickets')
        .select(`
          id,
          ticket_reference,
          qr_token,
          amount,
          status,
          purchased_at,
          expires_at,
          used_at,
          trip_id,
          passenger_id,
          destination_id,

          destinations (
            id,
            name
          ),

          users:passenger_id (
            full_name,
            email
          ),

          trips (
            driver_id
          )
        `)
        .eq(
          'qr_token',
          qr_token
        )
        .maybeSingle();

      if (ticketError) {
        console.error(
          'QR ticket lookup error:',
          ticketError
        );

        return res.status(500).json({
          success: false,
          message: 'Could not verify QR ticket',
        });
      }

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Invalid QR ticket',
        });
      }

      // --------------------------------------------------------
      // CHECK STATUS
      // --------------------------------------------------------

      if (ticket.status === 'used') {
        return res.status(400).json({
          success: false,
          message:
            'This ticket has already been used',
        });
      }

      if (ticket.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message:
            'This ticket has been cancelled',
        });
      }

      // --------------------------------------------------------
      // CHECK EXPIRATION
      // --------------------------------------------------------

      if (
        ticket.status === 'expired' ||
        (
          ticket.expires_at &&
          new Date(ticket.expires_at) <
            new Date()
        )
      ) {
        await supabase
          .from('tickets')
          .update({
            status:
              'expired',
          })
          .eq(
            'id',
            ticket.id
          );

        return res.status(400).json({
          success: false,
          message:
            'This ticket has expired',
        });
      }

      // --------------------------------------------------------
      // CHECK ASSIGNED DRIVER
      // --------------------------------------------------------

      const assignedDriver =
        ticket.trips?.driver_id;

      if (
        assignedDriver &&
        Number(assignedDriver) !==
          Number(req.user.id)
      ) {
        return res.status(403).json({
          success: false,
          message:
            'This ticket belongs to another driver',
        });
      }

      // --------------------------------------------------------
      // MARK TICKET AS USED
      // --------------------------------------------------------

      const {
        data: updatedTicket,
        error: updateTicketError,
      } = await supabase
        .from('tickets')
        .update({
          status:
            'used',

          used_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          ticket.id
        )
        .eq(
          'status',
          'active'
        )
        .select(
          'id'
        )
        .maybeSingle();

      if (updateTicketError) {
        console.error(
          'Ticket validation update error:',
          updateTicketError
        );

        return res.status(500).json({
          success: false,
          message:
            'Could not validate ticket',
        });
      }

      if (!updatedTicket) {
        return res.status(400).json({
          success: false,
          message:
            'This ticket has already been validated',
        });
      }

      // --------------------------------------------------------
      // COMPLETE TRIP
      // --------------------------------------------------------

      if (ticket.trip_id) {
        const {
          error: tripError,
        } = await supabase
          .from('trips')
          .update({
            status:
              'completed',

            completed_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            ticket.trip_id
          );

        if (tripError) {
          console.error(
            'Trip completion error:',
            tripError
          );
        }
      }

      // --------------------------------------------------------
      // UPDATE DRIVER STATISTICS
      // --------------------------------------------------------

      const {
        data: driverProfile,
        error: driverProfileError,
      } = await supabase
        .from('driver_profiles')
        .select(`
          total_trips,
          total_earnings
        `)
        .eq(
          'user_id',
          req.user.id
        )
        .maybeSingle();

      if (driverProfileError) {
        console.error(
          'Driver profile lookup error:',
          driverProfileError
        );
      } else if (driverProfile) {
        const currentTrips =
          Number(
            driverProfile.total_trips
          ) || 0;

        const currentEarnings =
          Number(
            driverProfile.total_earnings
          ) || 0;

        const ticketAmount =
          Number(ticket.amount) || 0;

        const {
          error: statisticsError,
        } = await supabase
          .from('driver_profiles')
          .update({
            total_trips:
              currentTrips + 1,

            total_earnings:
              currentEarnings +
              ticketAmount,
          })
          .eq(
            'user_id',
            req.user.id
          );

        if (statisticsError) {
          console.error(
            'Driver statistics update error:',
            statisticsError
          );
        }
      }

      // --------------------------------------------------------
      // DRIVER EARNINGS
      // --------------------------------------------------------

      const {
        error: earningsError,
      } = await supabase
        .from('driver_earnings')
        .insert({
          driver_id:
            req.user.id,

          ticket_id:
            ticket.id,

          trip_id:
            ticket.trip_id,

          amount:
            Number(ticket.amount) || 0,

          status:
            'pending',
        });

      if (earningsError) {
        console.error(
          'Driver earnings error:',
          earningsError
        );
      }

      // --------------------------------------------------------
      // PASSENGER NOTIFICATION
      // --------------------------------------------------------

      const destinationName =
        ticket.destinations?.name ||
        'your destination';

      const {
        error: notificationError,
      } = await supabase
        .from('notifications')
        .insert({
          user_id:
            ticket.passenger_id,

          title:
            'Ticket Validated',

          message:
            `Your ticket to ${destinationName} has been validated successfully.`,

          type:
            'ticket',
        });

      if (notificationError) {
        console.error(
          'Validation notification error:',
          notificationError
        );
      }

      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      return res.json({
        success: true,

        message:
          'Ticket validated successfully',

        ticket: {
          ticket_reference:
            ticket.ticket_reference,

          passenger_name:
            ticket.users?.full_name ||
            null,

          passenger_email:
            ticket.users?.email ||
            null,

          destination_name:
            destinationName,

          amount:
            Number(ticket.amount) || 0,

          purchased_at:
            ticket.purchased_at,

          expires_at:
            ticket.expires_at,

          validated_at:
            new Date().toISOString(),
        },
      });

    } catch (error) {
      console.error(
        'Validate ticket error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Something went wrong while validating the ticket',
      });
    }
  }
);

// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports = router;