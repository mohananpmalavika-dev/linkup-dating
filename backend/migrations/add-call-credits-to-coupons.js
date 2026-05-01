'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Add call_credits_value column to coupons table if it doesn't exist
      await queryInterface.addColumn(
        'coupons',
        'call_credits_value',
        {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          comment: 'Number of call credits this coupon provides',
          allowNull: true
        },
        { transaction }
      );

      await transaction.commit();
      console.log('✓ Migration: Added call_credits_value to coupons table');
    } catch (error) {
      await transaction.rollback();
      if (error.message.includes('already exists')) {
        console.log('✓ Column already exists, skipping');
      } else {
        throw error;
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('coupons', 'call_credits_value', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
