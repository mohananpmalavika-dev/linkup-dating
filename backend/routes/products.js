const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET MANAGED PRODUCTS (products owned by the current user) - REQUIRES AUTH
router.get('/manage', authenticateToken, async (req, res) => {
  try {
    // Extract user ID from JWT token (set by authenticateToken middleware)
    const userId = req.user?.userId || req.user?.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;

    // Debug log for authentication
    console.log('Products manage request - User:', userId, 'User object:', req.user);

    if (!userId) {
      return res.status(401).json({ 
        error: 'User not authenticated',
        message: 'Please login to view your managed products'
      });
    }

    // Check if products table exists
    const tablesResult = await db.query(`
      SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products')
    `);
    
    const productsTableExists = tablesResult.rows[0]?.exists || false;

    // If products table doesn't exist, return empty paginated response
    if (!productsTableExists) {
      return res.json({
        success: true,
        products: [],
        pagination: {
          page,
          limit,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false
        },
        counts: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          active: 0,
          disabled: 0
        }
      });
    }

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM products WHERE seller_id = $1',
      [userId]
    );

    const totalItems = parseInt(countResult.rows[0]?.total) || 0;
    const totalPages = Math.ceil(totalItems / limit);

    // Get products for this page
    const productsResult = await db.query(
      `SELECT * FROM products 
       WHERE seller_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const products = productsResult.rows || [];

    // Get counts by status
    const countsResult = await db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active,
        COUNT(CASE WHEN is_active = false THEN 1 END) as disabled
       FROM products 
       WHERE seller_id = $1`,
      [userId]
    );

    const counts = countsResult.rows[0] || {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      active: 0,
      disabled: 0
    };

    res.json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      counts: {
        total: parseInt(counts.total) || 0,
        pending: parseInt(counts.pending) || 0,
        approved: parseInt(counts.approved) || 0,
        rejected: parseInt(counts.rejected) || 0,
        active: parseInt(counts.active) || 0,
        disabled: parseInt(counts.disabled) || 0
      }
    });
  } catch (error) {
    console.error('Get managed products error:', error);
    
    // Return empty response on error instead of failing
    res.json({
      success: true,
      products: [],
      pagination: {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 12,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false
      },
      counts: {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        active: 0,
        disabled: 0
      }
    });
  }
});

// GET ALL APPROVED PRODUCTS (for browsing)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;

    // Check if products table exists
    const productsExist = await db.query(`
      SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products')
    `);

    if (!productsExist.rows[0].exists) {
      return res.json({
        success: true,
        products: [],
        pagination: {
          page,
          limit,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false
        }
      });
    }

    // Get approved products
    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM products WHERE status = $1 AND is_active = true',
      ['approved']
    );

    const totalItems = parseInt(countResult.rows[0]?.total) || 0;
    const totalPages = Math.ceil(totalItems / limit);

    const productsResult = await db.query(
      `SELECT * FROM products 
       WHERE status = $1 AND is_active = true
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      ['approved', limit, offset]
    );

    res.json({
      success: true,
      products: productsResult.rows || [],
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.json({
      success: true,
      products: [],
      pagination: {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 12,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false
      }
    });
  }
});

module.exports = router;
