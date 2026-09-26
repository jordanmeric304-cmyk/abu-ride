const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const supabase = require('../supabase');

const router = express.Router();

const JWT_SECRET =
  'abu_ride_secret_key_change_later';


// =====================================================
// REGISTER
// =====================================================

router.post('/register', async (req, res) => {
  try {
    const {
      full_name,
      email,
      phone,
      password,
      role,
    } = req.body;

    // -----------------------------
    // Validate required information
    // -----------------------------

    if (!full_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message:
          'Full name, email and password are required',
      });
    }

    // -----------------------------
    // Allowed registration roles
    // -----------------------------

    const allowedRoles = [
      'passenger',
      'driver',
    ];

    const userRole =
      allowedRoles.includes(role)
        ? role
        : 'passenger';

    // -----------------------------
    // Clean user information
    // -----------------------------

    const cleanEmail =
      email.trim().toLowerCase();

    const cleanName =
      full_name.trim();

    const cleanPhone =
      phone
        ? phone.trim()
        : null;

    // -----------------------------
    // Check if email already exists
    // -----------------------------

    const {
      data: existingUsers,
      error: existingUserError,
    } = await supabase
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .limit(1);

    if (existingUserError) {
      console.error(
        'Check existing user error:',
        existingUserError
      );

      return res.status(500).json({
        success: false,
        message:
          'Could not check existing account',
      });
    }

    if (
      existingUsers &&
      existingUsers.length > 0
    ) {
      return res.status(409).json({
        success: false,
        message:
          'An account with this email already exists',
      });
    }

    // -----------------------------
    // Hash password
    // -----------------------------

    const hashedPassword =
      await bcrypt.hash(password, 10);

    // -----------------------------
    // Create user
    // -----------------------------

    const {
      data: newUser,
      error: userError,
    } = await supabase
      .from('users')
      .insert({
        full_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        password: hashedPassword,
        role: userRole,
        is_active: true,
      })
      .select(
        `
        id,
        full_name,
        email,
        phone,
        role,
        profile_image,
        is_active
        `
      )
      .single();

    if (userError) {
      console.error(
        'Create user error:',
        userError
      );

      return res.status(500).json({
        success: false,
        message:
          'Could not create user account',
      });
    }

    const userId =
      newUser.id;

    // =====================================================
    // CREATE WALLET
    // =====================================================
    //
    // Passenger:
    //     Starting balance = ₦500
    //
    // Driver:
    //     Starting balance = ₦0
    //
    // =====================================================

    const startingBalance =
      userRole === 'passenger'
        ? 500
        : 0;

// Create wallet
const {
  error: walletError,
} = await supabase
  .from('wallets')
  .insert({
    user_id: userId,
    balance: userRole === 'passenger' ? 500 : 0,
  });




    if (walletError) {
      console.error(
        'Create wallet error:',
        walletError
      );

      // Remove user if wallet creation fails
      await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      return res.status(500).json({
        success: false,
        message:
          'Could not create user wallet',
      });
    }

    // =====================================================
    // CREATE DRIVER PROFILE
    // =====================================================

    if (userRole === 'driver') {
      const {
        error: driverError,
      } = await supabase
        .from('driver_profiles')
        .insert({
          user_id: userId,
        });

      if (driverError) {
        console.error(
          'Create driver profile error:',
          driverError
        );

        // Remove wallet
        await supabase
          .from('wallets')
          .delete()
          .eq('user_id', userId);

        // Remove user
        await supabase
          .from('users')
          .delete()
          .eq('id', userId);

        return res.status(500).json({
          success: false,
          message:
            'Could not create driver profile',
        });
      }
    }

    // =====================================================
    // CREATE JWT
    // =====================================================

    const token =
      jwt.sign(
        {
          id: userId,
          role: userRole,
        },
        JWT_SECRET,
        {
          expiresIn: '7d',
        }
      );

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(201).json({
      success: true,
      message:
        'Account created successfully',

      token,

      user: {
        id:
          newUser.id,

        full_name:
          newUser.full_name,

        email:
          newUser.email,

        phone:
          newUser.phone,

        role:
          newUser.role,

        profile_image:
          newUser.profile_image || null,

        starting_balance:
          startingBalance,
      },
    });

  } catch (error) {
    console.error(
      'Registration error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Something went wrong while creating the account',
    });
  }
});


// =====================================================
// LOGIN
// =====================================================

router.post('/login', async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    // -----------------------------
    // Validate information
    // -----------------------------

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          'Email and password are required',
      });
    }

    // -----------------------------
    // Clean email
    // -----------------------------

    const cleanEmail =
      email.trim().toLowerCase();

    // -----------------------------
    // Find user
    // -----------------------------

    const {
      data: user,
      error: userError,
    } = await supabase
      .from('users')
      .select(
        `
        id,
        full_name,
        email,
        phone,
        password,
        role,
        profile_image,
        is_active
        `
      )
      .eq('email', cleanEmail)
      .limit(1)
      .maybeSingle();

    if (userError) {
      console.error(
        'Login user lookup error:',
        userError
      );

      return res.status(500).json({
        success: false,
        message:
          'Could not access user account',
      });
    }

    // -----------------------------
    // User doesn't exist
    // -----------------------------

    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          'Invalid email or password',
      });
    }

    // -----------------------------
    // Check account status
    // -----------------------------

    if (
      user.is_active === false
    ) {
      return res.status(403).json({
        success: false,
        message:
          'This account has been deactivated',
      });
    }

    // -----------------------------
    // Compare password
    // -----------------------------

    const passwordMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message:
          'Invalid email or password',
      });
    }

    // -----------------------------
    // Create JWT
    // -----------------------------

    const token =
      jwt.sign(
        {
          id: user.id,
          role: user.role,
        },
        JWT_SECRET,
        {
          expiresIn: '7d',
        }
      );

    // -----------------------------
    // Return successful login
    // -----------------------------

    return res.json({
      success: true,

      message:
        'Login successful',

      token,

      user: {
        id:
          user.id,

        full_name:
          user.full_name,

        email:
          user.email,

        phone:
          user.phone,

        role:
          user.role,

        profile_image:
          user.profile_image || null,
      },
    });

  } catch (error) {
    console.error(
      'Login error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Something went wrong while logging in',
    });
  }
});


module.exports = router;