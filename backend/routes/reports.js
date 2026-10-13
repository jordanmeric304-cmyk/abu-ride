const express = require('express');
const supabase = require('../supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ============================================================
// SUBMIT A NEW ISSUE REPORT (Passengers & Drivers)
// ============================================================
router.post('/', authMiddleware, async (req, res) => {
  try {
    const reporter_id = req.user.id;
    const { title, subject, message, issue_type, category } = req.body;

    const reportMessage = message || req.body.description || req.body.details;
    const reportTitle = title || subject || issue_type || category || 'Issue Report';

    if (!reportMessage) {
      return res.status(400).json({
        success: false,
        message: 'Report details or message are required',
      });
    }

    const { data: report, error } = await supabase
      .from('reports')
      .insert([
        {
          reporter_id,
          user_id: reporter_id,
          title: reportTitle,
          message: reportMessage,
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Submit report error:', error);
      return res.status(400).json({
        success: false,
        message: 'Could not log report in database',
      });
    }

    return res.json({
      success: true,
      message: 'Report submitted successfully. An administrator will review it shortly!',
      report,
    });
  } catch (error) {
    console.error('Submit report endpoint error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error submitting report',
    });
  }
});

module.exports = router;