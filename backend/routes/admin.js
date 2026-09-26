const express = require('express');
const crypto = require('crypto');

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
// GET WALLET FUNDING REQUESTS
// ============================================================

router.get(
  '/funding-requests',
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const {
        data: requests,
        error,
      } = await supabase
        .from('funding_requests')
        .select(`
          id,
          request_reference,
          user_id,
          amount,
          note,
          status,
          admin_note,
          created_at,
          reviewed_at,
          users:user_id (
            full_name,
            email
          )
        `)
        .order('created_at', {
          ascending: false,
        });

      if (error) {
        console.error(
          'Funding requests error:',
          error
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to load funding requests',
        });
      }

      const formattedRequests =
        (requests || []).map((request) => ({
          id:
            request.id,

          request_reference:
            request.request_reference,

          user_id:
            request.user_id,

          full_name:
            request.users?.full_name || null,

          email:
            request.users?.email || null,

          amount:
            Number(request.amount) || 0,

          note:
            request.note || null,

          status:
            request.status,

          admin_note:
            request.admin_note || null,

          created_at:
            request.created_at,

          reviewed_at:
            request.reviewed_at,
        }));

      // Put pending requests first
      formattedRequests.sort((a, b) => {
        if (
          a.status === 'pending' &&
          b.status !== 'pending'
        ) {
          return -1;
        }

        if (
          a.status !== 'pending' &&
          b.status === 'pending'
        ) {
          return 1;
        }

        return (
          new Date(b.created_at) -
          new Date(a.created_at)
        );
      });

      return res.json({
        success: true,
        requests: formattedRequests,
      });

    } catch (error) {
      console.error(
        'Funding requests error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to load funding requests',
      });
    }
  }
);


// ============================================================
// APPROVE FUNDING REQUEST
// ============================================================

router.post(
  '/funding-requests/:id/approve',
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const requestId =
        Number(req.params.id);

      const adminNote =
        req.body?.admin_note
          ? String(req.body.admin_note).trim()
          : null;

      if (!requestId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid funding request ID',
        });
      }


      // --------------------------------------------------------
      // GET FUNDING REQUEST
      // --------------------------------------------------------

      const {
        data: request,
        error: requestError,
      } = await supabase
        .from('funding_requests')
        .select(`
          id,
          user_id,
          amount,
          status
        `)
        .eq('id', requestId)
        .maybeSingle();

      if (requestError) {
        console.error(
          'Funding request lookup error:',
          requestError
        );

        return res.status(500).json({
          success: false,
          message: 'Could not load funding request',
        });
      }

      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Funding request not found',
        });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message:
            'This funding request has already been reviewed',
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
        .eq('user_id', request.user_id)
        .maybeSingle();

      if (walletError) {
        console.error(
          'Wallet lookup error:',
          walletError
        );

        return res.status(500).json({
          success: false,
          message: 'Could not load passenger wallet',
        });
      }

      if (!wallet) {
        return res.status(404).json({
          success: false,
          message: 'Passenger wallet not found',
        });
      }


      // --------------------------------------------------------
      // CALCULATE NEW BALANCE
      // --------------------------------------------------------

      const balanceBefore =
        Number(wallet.balance) || 0;

      const amountAdded =
        Number(request.amount) || 0;

      if (amountAdded <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid funding amount',
        });
      }

      const balanceAfter =
        balanceBefore + amountAdded;


      // --------------------------------------------------------
      // UPDATE WALLET
      // --------------------------------------------------------

      const {
        error: walletUpdateError,
      } = await supabase
        .from('wallets')
        .update({
          balance: balanceAfter,
        })
        .eq('user_id', request.user_id);

      if (walletUpdateError) {
        console.error(
          'Wallet update error:',
          walletUpdateError
        );

        return res.status(500).json({
          success: false,
          message: 'Could not update passenger wallet',
        });
      }


      // --------------------------------------------------------
      // MARK FUNDING REQUEST APPROVED
      // --------------------------------------------------------

      const {
        error: requestUpdateError,
      } = await supabase
        .from('funding_requests')
        .update({
          status: 'approved',
          admin_note: adminNote,
          reviewed_at:
            new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('status', 'pending');

      if (requestUpdateError) {
        console.error(
          'Funding request update error:',
          requestUpdateError
        );

        // Restore wallet
        await supabase
          .from('wallets')
          .update({
            balance: balanceBefore,
          })
          .eq('user_id', request.user_id);

        return res.status(500).json({
          success: false,
          message:
            'Could not approve funding request',
        });
      }


      // --------------------------------------------------------
      // CREATE TRANSACTION
      // --------------------------------------------------------

      const transactionReference =
        `FUND-${Date.now()}-${crypto
          .randomBytes(3)
          .toString('hex')
          .toUpperCase()}`;

      const {
        error: transactionError,
      } = await supabase
        .from('transactions')
        .insert({
          transaction_reference:
            transactionReference,

          user_id:
            request.user_id,

          type:
            'wallet_funding',

          amount:
            amountAdded,

          balance_before:
            balanceBefore,

          balance_after:
            balanceAfter,

          description:
            'Wallet funding approved by administrator',

          status:
            'successful',
        });

      if (transactionError) {
        console.error(
          'Funding transaction error:',
          transactionError
        );
      }


      // --------------------------------------------------------
      // NOTIFY PASSENGER
      // --------------------------------------------------------

      const {
        error: notificationError,
      } = await supabase
        .from('notifications')
        .insert({
          user_id:
            request.user_id,

          title:
            'Wallet Funded',

          message:
            `Your wallet has been credited with ₦${amountAdded.toLocaleString()}.`,

          type:
            'payment',
        });

      if (notificationError) {
        console.error(
          'Funding notification error:',
          notificationError
        );
      }


      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      return res.json({
        success: true,

        message:
          'Funding request approved successfully',

        wallet: {
          amount_added:
            amountAdded,

          balance_before:
            balanceBefore,

          balance_after:
            balanceAfter,
        },

        transaction: {
          transaction_reference:
            transactionReference,

          amount:
            amountAdded,
        },
      });

    } catch (error) {
      console.error(
        'Approve funding error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Failed to approve funding request',
      });
    }
  }
);


// ============================================================
// REJECT FUNDING REQUEST
// ============================================================

router.post(
  '/funding-requests/:id/reject',
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const requestId =
        Number(req.params.id);

      const adminNote =
        req.body?.admin_note
          ? String(req.body.admin_note).trim()
          : null;

      if (!requestId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid funding request ID',
        });
      }


      // --------------------------------------------------------
      // FIND REQUEST
      // --------------------------------------------------------

      const {
        data: request,
        error: requestError,
      } = await supabase
        .from('funding_requests')
        .select(`
          id,
          user_id,
          amount,
          status
        `)
        .eq('id', requestId)
        .maybeSingle();

      if (requestError) {
        console.error(
          'Funding request lookup error:',
          requestError
        );

        return res.status(500).json({
          success: false,
          message: 'Could not load funding request',
        });
      }

      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Funding request not found',
        });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message:
            'This funding request has already been reviewed',
        });
      }


      // --------------------------------------------------------
      // REJECT REQUEST
      // --------------------------------------------------------

      const {
        error: updateError,
      } = await supabase
        .from('funding_requests')
        .update({
          status: 'rejected',
          admin_note: adminNote,
          reviewed_at:
            new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('status', 'pending');

      if (updateError) {
        console.error(
          'Reject funding update error:',
          updateError
        );

        return res.status(500).json({
          success: false,
          message: 'Could not reject funding request',
        });
      }


      // --------------------------------------------------------
      // NOTIFY PASSENGER
      // --------------------------------------------------------

      const {
        error: notificationError,
      } = await supabase
        .from('notifications')
        .insert({
          user_id:
            request.user_id,

          title:
            'Funding Request Rejected',

          message:
            `Your ₦${Number(
              request.amount
            ).toLocaleString()} wallet funding request was rejected.`,

          type:
            'payment',
        });

      if (notificationError) {
        console.error(
          'Rejection notification error:',
          notificationError
        );
      }


      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      return res.json({
        success: true,

        message:
          'Funding request rejected successfully',
      });

    } catch (error) {
      console.error(
        'Reject funding error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Failed to reject funding request',
      });
    }
  }
);


// ============================================================
// GET DRIVER EARNINGS
// ============================================================

router.get(
  '/driver-earnings',
  authMiddleware,
  adminOnly,
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
          earned_at
        `)
        .order('earned_at', {
          ascending: false,
        });

      if (error) {
        console.error(
          'Admin driver earnings error:',
          error
        );

        return res.status(500).json({
          success: false,
          message:
            'Failed to load driver earnings',
        });
      }


      // --------------------------------------------------------
      // GET DRIVER USERS
      // --------------------------------------------------------

      const {
        data: drivers,
        error: driversError,
      } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          email,
          phone
        `)
        .eq('role', 'driver')
        .order('full_name', {
          ascending: true,
        });

      if (driversError) {
        console.error(
          'Admin drivers lookup error:',
          driversError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to load drivers',
        });
      }


      // --------------------------------------------------------
      // CALCULATE TOTALS
      // --------------------------------------------------------

      const totalMap = {};
      const dailyMap = {};

      (earnings || []).forEach((earning) => {
        const driverId =
          earning.driver_id;

        const amount =
          Number(earning.amount) || 0;

        if (!totalMap[driverId]) {
          totalMap[driverId] = 0;
        }

        if (
          earning.status !== 'cancelled'
        ) {
          totalMap[driverId] += amount;
        }

        if (
          earning.status !== 'cancelled'
        ) {
          const date =
            earning.earned_at
              ? String(
                  earning.earned_at
                ).substring(0, 10)
              : null;

          if (date) {
            if (!dailyMap[driverId]) {
              dailyMap[driverId] = {};
            }

            if (
              !dailyMap[driverId][date]
            ) {
              dailyMap[driverId][date] = 0;
            }

            dailyMap[driverId][date] +=
              amount;
          }
        }
      });


      // --------------------------------------------------------
      // FORMAT DAILY EARNINGS
      // --------------------------------------------------------

      const driverEarnings =
        (drivers || []).map((driver) => {
          const daily =
            Object.entries(
              dailyMap[driver.id] || {}
            )
              .map(
                ([date, amount]) => ({
                  date,
                  amount,
                })
              )
              .sort(
                (a, b) =>
                  b.date.localeCompare(
                    a.date
                  )
              );

          return {
            driver_id:
              driver.id,

            full_name:
              driver.full_name,

            email:
              driver.email,

            phone:
              driver.phone,

            total_earnings:
              totalMap[driver.id] || 0,

            daily_earnings:
              daily,
          };
        });


      // --------------------------------------------------------
      // TOTAL FOR ALL DRIVERS
      // --------------------------------------------------------

      const totalAllDrivers =
        driverEarnings.reduce(
          (total, driver) =>
            total +
            Number(
              driver.total_earnings
            ),
          0
        );


      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      return res.json({
        success: true,

        summary: {
          total_drivers:
            driverEarnings.length,

          total_earnings:
            totalAllDrivers,
        },

        drivers:
          driverEarnings,
      });

    } catch (error) {
      console.error(
        'Admin driver earnings error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Failed to load driver earnings',
      });
    }
  }
);


module.exports = router;