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
      reg_or_p_number, // Handles Reg. Number for students, P Number for staff, etc.
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

    const cleanRegOrPNumber =
      reg_or_p_number
        ? reg_or_p_number.trim()
        : null;

    // -----------------------------
    // Approval & Driver ID Logic
    // -----------------------------
    // Passengers (Students, Staff, Others) are auto-approved (is_approved = true)
    // Drivers require admin approval (is_approved = false) and get a unique ID
    const isApproved = userRole === 'passenger';
    const driverCustomId =
      userRole === 'driver'
        ? 'DRV-' + Math.floor(1000 + Math.random() * 9000)
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
        reg_or_p_number: cleanRegOrPNumber,
        password: hashedPassword,
        role: userRole,
        is_active: true,
        is_approved: isApproved,
        driver_custom_id: driverCustomId,
      })
      .select(
        `
        id,
        full_name,
        email,
        phone,
        reg_or_p_number,
        role,
        profile_image,
        is_active,
        is_approved,
        driver_custom_id
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

    const startingBalance =
      userRole === 'passenger'
        ? 500
        : 0;

    const {
      error: walletError,
    } = await supabase
      .from('wallets')
      .insert({
        user_id: userId,
        balance: startingBalance,
      });

    if (walletError) {
      console.error(
        'Create wallet error:',
        walletError
      );

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

        await supabase
          .from('wallets')
          .delete()
          .eq('user_id', userId);

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
          is_approved: isApproved,
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
        userRole === 'driver'
          ? 'Account created successfully. Awaiting administrator approval.'
          : 'Account created successfully',

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

        reg_or_p_number:
          newUser.reg_or_p_number,

        role:
          newUser.role,

        is_approved:
          newUser.is_approved,

        driver_custom_id:
          newUser.driver_custom_id,

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
        reg_or_p_number,
        password,
        role,
        profile_image,
        is_active,
        is_approved,
        driver_custom_id
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

    // Check if driver is approved by admin
    if (
      user.role === 'driver' &&
      user.is_approved === false
    ) {
      return res.status(403).json({
        success: false,
        message:
          'Your driver account is pending administrator approval',
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
          is_approved: user.is_approved,
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

        reg_or_p_number:
          user.reg_or_p_number,

        role:
          user.role,

        is_approved:
          user.is_approved,

        driver_custom_id:
          user.driver_custom_id,

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