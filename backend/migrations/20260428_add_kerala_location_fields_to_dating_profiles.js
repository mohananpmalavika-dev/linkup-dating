/**
 * Migration: Add Kerala-focused location fields to dating profiles
 * Date: 2026-04-28
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('dating_profiles', 'location_district', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    await queryInterface.addColumn('dating_profiles', 'location_locality', {
      type: Sequelize.STRING(150),
      allowNull: true
    });

    await queryInterface.addColumn('dating_profiles', 'location_pincode', {
      type: Sequelize.STRING(6),
      allowNull: true
    });

    await queryInterface.addColumn('dating_profiles', 'kerala_region', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    await queryInterface.addIndex('dating_profiles', ['location_district']);
    await queryInterface.addIndex('dating_profiles', ['location_locality']);
    await queryInterface.addIndex('dating_profiles', ['location_pincode']);
    await queryInterface.addIndex('dating_profiles', ['kerala_region']);
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('dating_profiles', ['kerala_region']);
    await queryInterface.removeIndex('dating_profiles', ['location_pincode']);
    await queryInterface.removeIndex('dating_profiles', ['location_locality']);
    await queryInterface.removeIndex('dating_profiles', ['location_district']);

    await queryInterface.removeColumn('dating_profiles', 'kerala_region');
    await queryInterface.removeColumn('dating_profiles', 'location_pincode');
    await queryInterface.removeColumn('dating_profiles', 'location_locality');
    await queryInterface.removeColumn('dating_profiles', 'location_district');
  }
};
