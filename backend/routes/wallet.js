const express = require('express');
const crypto = require('crypto');

const supabase = require('../supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();


// ============================================================
// GET CURRENT USER WALLET
// ============================================================

router.get(
  '/',
  authMiddleware,
  async (req, res) => {
    try {
      const {
        data: wallet,
        error,
      } = await supabase
        .from('wallets')
        .select(
          `
          id,
          user_id,
          balance,
          updated_at
          `
        )
        .eq('user_id', req.user.id)
        .maybeSingle();

      if (error) {
        console.error(
          'Wallet lookup error:',
          error
        );

        return res.status(500).json({
          success: false,
          message:
            'Could not load wallet',
        });
      }

      if (!wallet) {
        return res.status(404).json({
          success: false,
          message:
            'Wallet not found',
        });
      }

      return res.json({
        success: true,
        wallet: {
          id: wallet.id,
          user_id: wallet.user_id,
          balance: Number(wallet.balance) || 0,
          updated_at: wallet.updated_at,
        },
      });

    } catch (error) {
      console.error(
        'Wallet error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Something went wrong while loading wallet',
      });
    }
  }
);


// ============================================================
// GET CURRENT USER TRANSACTIONS
// ============================================================

router.get(
  '/transactions',
  authMiddleware,
  async (req, res) => {
    try {
      const {
        data: transactions,
        error,
      } = await supabase
        .from('transactions')
        .select(
          `
          id,
          transaction_reference,
          type,
          amount,
          balance_before,
          balance_after,
          description,
          status,
          ticket_id,
          created_at
          `
        )
        .eq('user_id', req.user.id)
        .order(
          'created_at',
          {
            ascending: false,
          }
        )
        .order(
          'id',
          {
            ascending: false,
          }
        );

      if (error) {
        console.error(
          'Transactions lookup error:',
          error
        );

        return res.status(500).json({
          success: false,
          message:
            'Could not load transactions',
        });
      }

      return res.json({
        success: true,
        transactions:
          (transactions || []).map(
            (transaction) => ({
              ...transaction,
              amount:
                Number(
                  transaction.amount
                ) || 0,
              balance_before:
                Number(
                  transaction.balance_before
                ) || 0,
              balance_after:
                Number(
                  transaction.balance_after
                ) || 0,
            })
          ),
      });

    } catch (error) {
      console.error(
        'Transactions error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Something went wrong while loading transactions',
      });
    }
  }
);


// ============================================================
// DIRECT WALLET TOP-UP
// ============================================================

router.post(
  '/topup',
  authMiddleware,
  async (req, res) => {
    try {
      const { amount } = req.body;
      const topUpAmount = Number(amount);

      // -----------------------------
      // Validate amount
      // -----------------------------
      if (!topUpAmount || topUpAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Enter a valid top-up amount',
        });
      }

      // -----------------------------
      // Get current wallet balance
      // -----------------------------
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('user_id', req.user.id)
        .maybeSingle();

      if (walletError) {
        console.error('Wallet lookup error:', walletError);
        return res.status(500).json({
          success: false,
          message: 'Could not access your wallet',
        });
      }

      if (!wallet) {
        return res.status(404).json({
          success: false,
          message: 'Wallet not found',
        });
      }

      const currentBalance = Number(wallet.balance) || 0;
      const newBalance = currentBalance + topUpAmount;

      // -----------------------------
      // Update wallet balance
      // -----------------------------
      const { error: updateError } = await supabase
        .from('wallets')
        .update({
          balance: newBalance,
          updated_at: new Date(),
        })
        .eq('user_id', req.user.id);

      if (updateError) {
        console.error('Wallet top-up update error:', updateError);
        return res.status(500).json({
          success: false,
          message: 'Could not update wallet balance',
        });
      }

      // -----------------------------
      // Create transaction record
      // -----------------------------
      const transactionReference = `TOPUP-${Date.now()}-${crypto
        .randomBytes(3)
        .toString('hex')
        .toUpperCase()}`;

      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          transaction_reference: transactionReference,
          user_id: req.user.id,
          type: 'Wallet Top-Up',
          amount: topUpAmount,
          balance_before: currentBalance,
          balance_after: newBalance,
          description: 'Direct wallet top-up',
          status: 'successful',
        });

      if (transactionError) {
        console.error('Top-up transaction error:', transactionError);
      }

      return res.status(200).json({
        success: true,
        message: 'Wallet funded successfully',
        balance: newBalance,
        transaction: {
          reference: transactionReference,
          amount: topUpAmount,
          balance_after: newBalance,
        },
      });

    } catch (error) {
      console.error('Top-up error:', error);
      return res.status(500).json({
        success: false,
        message: 'Something went wrong during wallet top-up',
      });
    }
  }
);


// ============================================================
// TRANSFER FUNDS TO ANOTHER PASSENGER
// ============================================================

router.post(
  '/transfer',
  authMiddleware,
  async (req, res) => {
    try {
      const {
        recipient_email,
        amount,
        note,
      } = req.body;

      const senderId =
        req.user.id;

      const recipientEmail =
        String(
          recipient_email || ''
        )
          .trim()
          .toLowerCase();

      const transferAmount =
        Number(amount);

      // -----------------------------
      // Validate recipient
      // -----------------------------

      if (!recipientEmail) {
        return res.status(400).json({
          success: false,
          message:
            'Enter the recipient email address',
        });
      }

      // -----------------------------
      // Validate amount
      // -----------------------------

      if (
        !transferAmount ||
        transferAmount <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Enter a valid transfer amount',
        });
      }

      if (transferAmount < 1) {
        return res.status(400).json({
          success: false,
          message:
            'The minimum transfer amount is ₦1',
        });
      }

      // -----------------------------
      // Find recipient
      // -----------------------------

      const {
        data: recipient,
        error: recipientError,
      } = await supabase
        .from('users')
        .select(
          `
          id,
          full_name,
          email,
          role,
          is_active
          `
        )
        .eq(
          'email',
          recipientEmail
        )
        .maybeSingle();

      if (recipientError) {
        console.error(
          'Recipient lookup error:',
          recipientError
        );

        return res.status(500).json({
          success: false,
          message:
            'Could not find recipient',
        });
      }

      if (!recipient) {
        return res.status(404).json({
          success: false,
          message:
            'No passenger was found with that email address',
        });
      }

      // -----------------------------
      // Prevent self-transfer
      // -----------------------------

      if (
        Number(recipient.id) ===
        Number(senderId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'You cannot transfer funds to yourself',
        });
      }

      // -----------------------------
      // Recipient must be passenger
      // -----------------------------

      if (
        recipient.role !==
        'passenger'
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Funds can only be transferred to another passenger',
        });
      }

      // -----------------------------
      // Recipient must be active
      // -----------------------------

      if (
        recipient.is_active === false
      ) {
        return res.status(400).json({
          success: false,
          message:
            'The recipient account is not active',
        });
      }

      // ======================================================
      // GET SENDER WALLET
      // ======================================================

      const {
        data: senderWallet,
        error: senderWalletError,
      } = await supabase
        .from('wallets')
        .select(
          `
          id,
          user_id,
          balance
          `
        )
        .eq(
          'user_id',
          senderId
        )
        .maybeSingle();

      if (senderWalletError) {
        console.error(
          'Sender wallet error:',
          senderWalletError
        );

        return res.status(500).json({
          success: false,
          message:
            'Could not access your wallet',
        });
      }

      if (!senderWallet) {
        return res.status(404).json({
          success: false,
          message:
            'Your wallet was not found',
        });
      }

      // ======================================================
      // GET RECIPIENT WALLET
      // ======================================================

      const {
        data: recipientWallet,
        error: recipientWalletError,
      } = await supabase
        .from('wallets')
        .select(
          `
          id,
          user_id,
          balance
          `
        )
        .eq(
          'user_id',
          recipient.id
        )
        .maybeSingle();

      if (recipientWalletError) {
        console.error(
          'Recipient wallet error:',
          recipientWalletError
        );

        return res.status(500).json({
          success: false,
          message:
            'Could not access recipient wallet',
        });
      }

      if (!recipientWallet) {
        return res.status(404).json({
          success: false,
          message:
            'Recipient wallet was not found',
        });
      }

      // ======================================================
      // CHECK BALANCE
      // ======================================================

      const senderBalance =
        Number(
          senderWallet.balance
        ) || 0;

      const recipientBalance =
        Number(
          recipientWallet.balance
        ) || 0;

      if (
        senderBalance <
        transferAmount
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Insufficient balance. Your current wallet balance is ₦${senderBalance.toLocaleString()}.`,
          balance:
            senderBalance,
        });
      }

      // ======================================================
      // CALCULATE NEW BALANCES
      // ======================================================

      const senderBalanceAfter =
        senderBalance -
        transferAmount;

      const recipientBalanceAfter =
        recipientBalance +
        transferAmount;

      // ======================================================
      // UPDATE SENDER WALLET
      // ======================================================

      const {
        error: senderUpdateError,
      } = await supabase
        .from('wallets')
        .update({
          balance:
            senderBalanceAfter,
        })
        .eq(
          'user_id',
          senderId
        );

      if (senderUpdateError) {
        console.error(
          'Sender wallet update error:',
          senderUpdateError
        );

        return res.status(500).json({
          success: false,
          message:
            'Could not update sender wallet',
        });
      }

      // ======================================================
      // UPDATE RECIPIENT WALLET
      // ======================================================

      const {
        error: recipientUpdateError,
      } = await supabase
        .from('wallets')
        .update({
          balance:
            recipientBalanceAfter,
        })
        .eq(
          'user_id',
          recipient.id
        );

      if (recipientUpdateError) {
        console.error(
          'Recipient wallet update error:',
          recipientUpdateError
        );

        // Attempt to restore sender balance
        await supabase
          .from('wallets')
          .update({
            balance:
              senderBalance,
          })
          .eq(
            'user_id',
            senderId
          );

        return res.status(500).json({
          success: false,
          message:
            'Could not update recipient wallet',
        });
      }

      // ======================================================
      // CREATE TRANSFER REFERENCE
      // ======================================================

      const transferReference =
        `TRF-${Date.now()}-${crypto
          .randomBytes(3)
          .toString('hex')
          .toUpperCase()}`;

      // ======================================================
      // RECORD TRANSFER
      // ======================================================

      const {
        error: transferError,
      } = await supabase
        .from('transfers')
        .insert({
          transfer_reference:
            transferReference,

          sender_id:
            senderId,

          receiver_id:
            recipient.id,

          amount:
            transferAmount,

          note:
            note
              ? String(note).trim()
              : null,

          status:
            'successful',
        });

      if (transferError) {
        console.error(
          'Transfer record error:',
          transferError
        );

        return res.status(500).json({
          success: false,
          message:
            'Funds were transferred but the transaction record could not be created',
        });
      }

      // ======================================================
      // SENDER TRANSACTION
      // ======================================================

      const senderTransactionReference =
        `TXN-${Date.now()}-${crypto
          .randomBytes(3)
          .toString('hex')
          .toUpperCase()}`;

      const {
        error: senderTransactionError,
      } = await supabase
        .from('transactions')
        .insert({
          transaction_reference:
            senderTransactionReference,

          user_id:
            senderId,

          type:
            'transfer_sent',

          amount:
            transferAmount,

          balance_before:
            senderBalance,

          balance_after:
            senderBalanceAfter,

          description:
            `Transfer to ${recipient.full_name} (${recipient.email})`,

          status:
            'successful',
        });

      if (senderTransactionError) {
        console.error(
          'Sender transaction error:',
          senderTransactionError
        );
      }

      // ======================================================
      // RECIPIENT TRANSACTION
      // ======================================================

      const recipientTransactionReference =
        `TXN-${Date.now()}-${crypto
          .randomBytes(3)
          .toString('hex')
          .toUpperCase()}`;

      const {
        error: recipientTransactionError,
      } = await supabase
        .from('transactions')
        .insert({
          transaction_reference:
            recipientTransactionReference,

          user_id:
            recipient.id,

          type:
            'transfer_received',

          amount:
            transferAmount,

          balance_before:
            recipientBalance,

          balance_after:
            recipientBalanceAfter,

          description:
            'Transfer received from passenger',

          status:
            'successful',
        });

      if (recipientTransactionError) {
        console.error(
          'Recipient transaction error:',
          recipientTransactionError
        );
      }

      // ======================================================
      // NOTIFY RECIPIENT
      // ======================================================

      const {
        error: notificationError,
      } = await supabase
        .from('notifications')
        .insert({
          user_id:
            recipient.id,

          title:
            'Funds Received',

          message:
            `You received ₦${transferAmount.toLocaleString()} from another passenger.`,

          type:
            'transfer',
        });

      if (notificationError) {
        console.error(
          'Notification error:',
          notificationError
        );
      }

      // ======================================================
      // RESPONSE
      // ======================================================

      return res.status(201).json({
        success: true,

        message:
          'Funds transferred successfully',

        transfer: {
          transfer_reference:
            transferReference,

          amount:
            transferAmount,

          recipient_name:
            recipient.full_name,

          recipient_email:
            recipient.email,

          balance_after:
            senderBalanceAfter,
        },
      });

    } catch (error) {
      console.error(
        'Transfer error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Something went wrong while transferring funds',
      });
    }
  }
);


module.exports = router;